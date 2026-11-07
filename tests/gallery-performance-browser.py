"""Measure real gallery image responses; run against a started SKAUT server.

Uses fresh browser contexts and actual files, without request interception or
timing claims. Byte comparisons use the same photographed items' preserved
originals, counted once per item, rather than the entire unrelated archive.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = os.environ.get('SKAUT_GALLERY_ORIGIN', 'http://127.0.0.1:4173').rstrip('/')
OUTPUT = ROOT / 'artifacts/gallery/performance-verification.json'
PROFILES = [
    ('desktop', 1440, 1000, 1),
    ('mobile', 390, 844, 1),
    ('mobile-retina', 390, 844, 2),
]


def media_path(url):
    return urlsplit(urljoin(ORIGIN + '/', url)).path


def candidates(photo, field):
    return {media_path(item['src']): item for item in photo.get(field, [])}


def image_state(locator):
    return locator.evaluate('''image => ({
        currentSrc: image.currentSrc,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        renderedWidth: image.getBoundingClientRect().width,
        sizes: image.sizes,
        srcset: image.srcset
    })''')


def assert_candidate(state, choices, required_width, label):
    assert state['complete'] and state['naturalWidth'] > 0, f'{label}: image did not load'
    selected_path = media_path(state['currentSrc'])
    assert selected_path in choices, f'{label}: unrecorded candidate {selected_path}'
    assert urlsplit(state['currentSrc']).netloc == urlsplit(ORIGIN).netloc, f'{label}: non-local candidate'
    widths = sorted({item['width'] for item in choices.values()})
    desired = min(required_width, max(widths))
    adequate = next((width for width in widths if width >= desired), widths[-1])
    actual = choices[selected_path]['width']
    # Allow Chromium's small density rounding, while rejecting undersized images
    # and a larger file than the smallest candidate that meets the declared size.
    assert actual >= desired * 0.85, f'{label}: {actual}px is too small for {required_width:.1f}px'
    assert actual <= adequate, f'{label}: unnecessary {actual}px candidate instead of <= {adequate}px'
    return {
        'path': selected_path,
        'candidateWidth': actual,
        'renderedWidth': round(state['renderedWidth'], 2),
        'requiredWidth': round(required_width, 2),
        'sizes': state['sizes'],
    }


def main():
    source = json.loads((ROOT / 'content/gallery-source-manifest.json').read_text())
    original_bytes = {str(photo['id']): photo['originalBytes'] for photo in source['photos']}
    result = {
        'galleryPerformanceBrowser': 'running',
        'origin': ORIGIN,
        'verifiedAt': datetime.now(timezone.utc).isoformat(),
        'measurement': 'Actual gallery image response bodies including album navigation covers and wall/viewer media, unique URLs per fresh browser context; excludes HTML, metadata, fonts and site chrome. No download-duration claim.',
        'baseline': 'Preserved originalBytes for exactly the unique photo IDs requested in each phase, counted once per photo.',
        'profiles': [],
    }
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
        manifest_response = browser.new_context().request.get(ORIGIN + '/gallery-manifest.json')
        assert manifest_response.ok, 'Public manifest unavailable'
        manifest = manifest_response.json()
        photos = {str(photo['id']): photo for photo in manifest['photos']}
        assert all(photo.get('variants') and photo.get('displayVariants') and photo.get('thumbnail') for photo in photos.values()), 'Run responsive asset generation first'
        assets = {}
        wall_paths = set()
        display_paths = set()
        thumbnail_paths = set()
        originals = {media_path(photo['original']) for photo in photos.values()}
        for photo_id, photo in photos.items():
            assert photo_id in original_bytes, f'Missing original byte provenance for {photo_id}'
            wall_paths.add(media_path(photo['preview']))
            for variant in photo['variants']:
                wall_paths.add(media_path(variant['src']))
                assets[media_path(variant['src'])] = {'photoId': photo_id, 'width': variant['width']}
            for variant in photo['displayVariants']:
                display_paths.add(media_path(variant['src']))
                assets[media_path(variant['src'])] = {'photoId': photo_id, 'width': variant['width']}
            thumbnail = media_path(photo['thumbnail'])
            thumbnail_paths.add(thumbnail)
            assets[thumbnail] = {'photoId': photo_id, 'width': None}
            assets.setdefault(media_path(photo['preview']), {'photoId': photo_id, 'width': None})
        display_only = display_paths - wall_paths

        for name, width, height, dpr in PROFILES:
            context = browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=dpr)
            page = context.new_page()
            responses = []
            requests = []
            page_errors = []
            failed_images = []
            page.on('response', lambda response: responses.append(response) if response.request.resource_type == 'image' else None)
            page.on('request', lambda request: requests.append(request.url) if request.resource_type == 'image' else None)
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            page.on('requestfailed', lambda request: failed_images.append({'url': request.url, 'failure': request.failure}) if request.resource_type == 'image' else None)

            def snapshot():
                # wait_until=networkidle below ensures bodies have completed;
                # response.body() reads Chromium's actual received image bytes.
                measured = {}
                for response in responses:
                    path = media_path(response.url)
                    if path not in assets or path in measured:
                        continue
                    assert response.ok, f'{name}: image HTTP {response.status}: {path}'
                    body_size = len(response.body())
                    assert body_size > 0, f'{name}: empty image response {path}'
                    measured[path] = {
                        'path': path,
                        **assets[path],
                        'responseBodyBytes': body_size,
                        'contentLength': response.headers.get('content-length'),
                    }
                ids = {row['photoId'] for row in measured.values()}
                actual = sum(row['responseBodyBytes'] for row in measured.values())
                baseline = sum(original_bytes[photo_id] for photo_id in ids)
                return {
                    'uniquePhotoCount': len(ids),
                    'uniqueImageResponseCount': len(measured),
                    'responseImageBytes': actual,
                    'matchedOriginalBytes': baseline,
                    'savedBytes': baseline - actual,
                    'reductionPercent': round(100 * (1 - actual / baseline), 2) if baseline else None,
                    'images': list(measured.values()),
                }

            page.goto(ORIGIN + '/galeria', wait_until='networkidle')
            expect(page.locator('#gallery-grid [data-gallery-photo]')).to_have_count(36)
            assert page.evaluate('scrollY') == 0, f'{name}: initial measurement was scrolled'
            first = page.locator('#gallery-grid [data-gallery-photo]').first
            photo = photos[first.get_attribute('data-gallery-photo')]
            page.wait_for_function('''() => {const image=document.querySelector('#gallery-grid img');return image && image.complete && image.naturalWidth>0;}''')
            wall = image_state(first.locator('img'))
            wall_selection = assert_candidate(wall, candidates(photo, 'variants'), wall['renderedWidth'] * dpr, name + ' wall')
            initial_requests = {media_path(url) for url in requests}
            cover_paths = set(page.locator('.gallery-album-cover img').evaluate_all('images=>images.map(image=>new URL(image.src).pathname)'))
            initial = snapshot()
            assert 0 < initial['uniquePhotoCount'] < 36, f'{name}: lazy loading fetched the entire 36-image batch'
            assert not initial_requests.intersection(originals), f'{name}: original downloaded before viewer'
            assert not initial_requests.intersection(display_only), f'{name}: viewer-only derivative downloaded before opening'
            assert not (initial_requests.intersection(thumbnail_paths) - cover_paths), f'{name}: thumbnail strip prefetched'

            first.click()
            expect(page.locator('#gallery-viewer')).to_be_visible()
            page.wait_for_function('''() => {const image=document.querySelector('#gallery-full-image');return image && image.complete && image.naturalWidth>0;}''')
            # A cached full image can be ready before the browser starts loading
            # native-lazy thumbnails revealed by showModal(). Page-level idle
            # alone is not an image-readiness condition, especially under load.
            page.wait_for_function('''() => {
                const strip=document.querySelector('.gallery-thumbnails');
                if(!strip)return false;
                const bounds=strip.getBoundingClientRect();
                const visible=[...strip.querySelectorAll('img')].filter(image=>{
                    const rect=image.getBoundingClientRect();
                    return rect.width>0 && rect.height>0 && rect.right>bounds.left && rect.left<bounds.right && rect.bottom>0 && rect.top<innerHeight;
                });
                return visible.length>0 && visible.every(image=>image.complete && image.naturalWidth>0);
            }''')
            page.wait_for_load_state('networkidle')
            viewer = image_state(page.locator('#gallery-full-image'))
            available_width = page.locator('.gallery-viewer-stage').evaluate('''stage => {const style=getComputedStyle(stage);return stage.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);}''')
            viewer_selection = assert_candidate(viewer, candidates(photo, 'displayVariants'), available_width * dpr, name + ' viewer')
            expect(page.locator('#gallery-original')).to_have_attribute('href', photo['original'])
            strip = page.locator('.gallery-thumbnails img').evaluate_all('images => images.map(image => ({src: image.src,complete: image.complete,naturalWidth: image.naturalWidth}))')
            assert strip and all(media_path(image['src']) in thumbnail_paths for image in strip), f'{name}: strip uses larger previews'
            assert all('/responsive/180/' in media_path(image['src']) for image in strip), f'{name}: strip lacks 180px files'
            assert any(image['complete'] and image['naturalWidth'] > 0 for image in strip), f'{name}: strip images did not load'
            assert not {media_path(url) for url in requests}.intersection(originals), f'{name}: original automatically downloaded by viewer'
            with_viewer = snapshot()
            assert with_viewer['responseImageBytes'] < with_viewer['matchedOriginalBytes'], f'{name}: derivatives did not reduce image bytes'
            assert not page_errors, page_errors
            assert not failed_images, failed_images
            result['profiles'].append({
                'name': name, 'viewport': {'width': width, 'height': height}, 'deviceScaleFactor': dpr,
                'initialWallSelection': wall_selection, 'viewerSelection': viewer_selection,
                'beforeScrollAndViewer': initial, 'afterViewerOpen': with_viewer,
                'originalImageRequests': 0, 'viewerOnlyRequestsBeforeOpen': 0,
                'albumCoverRequestsBeforeOpen': len(initial_requests.intersection(cover_paths)),
                'albumCoverResponseBytesBeforeOpen': sum(image['responseBodyBytes'] for image in initial['images'] if image['path'] in cover_paths),
                'albumCoverSources': sorted(cover_paths),
                'thumbnailStripSources': [media_path(image['src']) for image in strip],
                'pageErrors': page_errors,
            })
            page.locator('#gallery-close').click()
            expect(first).to_be_focused()
            if name == 'desktop':
                external = next((album for album in manifest.get('albums', []) if album['id'] == 'miedzy-memorialem-a-walnym'), None)
                assert external and len(external['photoIds']) == 107, 'Expected the preserved 107-image additional album'
                page.locator(f'[data-gallery-album="{external["id"]}"]').click()
                expect(page.locator('#gallery-grid [data-gallery-photo]')).to_have_count(36)
                expect(page.locator('#gallery-collection-title')).to_have_text(external['title'])
                assert 'album=' + quote(external['id']) in page.url, 'Selected album URL not shareable'
                result['additionalAlbum'] = {'id': external['id'], 'photoCount': 107, 'selection': 'passed'}
            context.close()
        browser.close()
    result['galleryPerformanceBrowser'] = 'passed'
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({
        'galleryPerformanceBrowser': 'passed',
        'artifact': str(OUTPUT),
        'profiles': [{
            'name': profile['name'],
            'initialPhotoCount': profile['beforeScrollAndViewer']['uniquePhotoCount'],
            'initialImageBytes': profile['beforeScrollAndViewer']['responseImageBytes'],
            'withViewerImageBytes': profile['afterViewerOpen']['responseImageBytes'],
            'matchedOriginalBytes': profile['afterViewerOpen']['matchedOriginalBytes'],
            'reductionPercent': profile['afterViewerOpen']['reductionPercent'],
        } for profile in result['profiles']],
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()

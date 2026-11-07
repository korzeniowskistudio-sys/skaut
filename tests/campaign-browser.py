"""Bounded local/live checks for distinct supplied campaign images and articles."""
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = os.environ.get('SKAUT_GALLERY_ORIGIN', 'http://127.0.0.1:4173').rstrip('/')
OUTPUT = ROOT / 'artifacts/gallery'
NEWS_IMAGES = ['02', '03', '04', '05', '07', '08', '11', '12', '13', '14', '15', '16', '17', '18', '19']


def loaded_image(page, locator):
    locator.scroll_into_view_if_needed()
    expect(locator).to_be_visible()
    page.wait_for_function('image=>image.complete && image.naturalWidth>0',
                           arg=locator.element_handle(), timeout=15000)
    return locator.evaluate('''image=>({src:image.getAttribute('src'),currentSrc:image.currentSrc,
        naturalRatio:image.naturalWidth/image.naturalHeight,
        renderedRatio:image.getBoundingClientRect().width/image.getBoundingClientRect().height,
        objectFit:getComputedStyle(image).objectFit})''')


def main():
    metadata = json.loads((ROOT / 'content/campaign-image-sources.json').read_text())
    supplied = {photo['id']: photo for photo in metadata['photos']}
    assert len(supplied) == 19, 'Expected the complete supplied campaign set'
    expected_news = [supplied['photo-' + number]['src'] for number in NEWS_IMAGES]
    result = {'campaignBrowser': 'running', 'origin': ORIGIN, 'suppliedImages': len(supplied), 'profiles': []}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
        for width in [1440, 390]:
            context = browser.new_context(viewport={'width': width, 'height': 1000}, has_touch=width < 780, reduced_motion='reduce')
            page = context.new_page()
            errors, failed_images = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed_images.append(response.url) if response.request.resource_type == 'image' and response.status >= 400 else None)
            page.goto(ORIGIN + '/', wait_until='networkidle')
            home = page.locator('main img').evaluate_all('images=>images.map(image=>image.getAttribute("src"))')
            assert home == ['/assets/hero.webp', supplied['photo-01']['src'], supplied['photo-06']['src']], home
            assert len(set(home)) == 3
            primary = [supplied['photo-01']['src'], supplied['photo-06']['src']]
            for selector, identity in [('.news-preview img', 'photo-01'), ('.image-story>img', 'photo-06')]:
                state = loaded_image(page, page.locator(selector).first)
                assert urlsplit(state['currentSrc']).path in {variant['src'] for variant in supplied[identity]['variants']}
                assert state['objectFit'] == 'cover'

            page.goto(ORIGIN + '/aktualnosci', wait_until='networkidle')
            illustrated = page.locator('.news-item img')
            expect(illustrated).to_have_count(15)
            actual_news = illustrated.evaluate_all('images=>images.map(image=>image.getAttribute("src"))')
            assert actual_news == expected_news, actual_news
            assert len(set(actual_news)) == 15
            first_article = page.locator('.news-item a').first.get_attribute('href')
            last_article = page.locator('.news-item a').nth(14).get_attribute('href')
            older_article = page.locator('.news-item a').nth(15).get_attribute('href')
            page.locator('#news-search').fill('Licencja klubowa 2027')
            expect(page.locator('.news-item img')).to_have_count(1)
            expect(page.locator('.news-item img')).to_have_attribute('src', expected_news[0])
            page.locator('#news-search').fill('')

            # First and newly appended fifteenth card share their image with
            # the single-article endpoint; older source history stays intact.
            for url, expected_source in [(first_article, expected_news[0]), (last_article, expected_news[-1])]:
                page.goto(ORIGIN + url, wait_until='networkidle')
                image = page.locator('.article img')
                expect(image).to_have_attribute('src', expected_source)
                state = loaded_image(page, image)
                assert abs(state['naturalRatio'] - state['renderedRatio']) < 0.01, 'Article image stretched'
                expect(page.locator('.article a[href^="/archiwum/"]')).to_have_count(1)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Article overflow'
            page.goto(ORIGIN + older_article, wait_until='networkidle')
            expect(page.locator('.article img')).to_have_count(0)
            expect(page.locator('.article a[href^="/archiwum/"]')).to_have_count(1)

            for route, selector, identity in [('/klub', '.image-story>img', 'photo-09'), ('/moj-skaut', '.account-photo>img', 'photo-10')]:
                page.goto(ORIGIN + route, wait_until='networkidle')
                state = loaded_image(page, page.locator(selector))
                assert state['src'] == supplied[identity]['src']
                assert urlsplit(state['currentSrc']).path in {variant['src'] for variant in supplied[identity]['variants']}
                assert state['objectFit'] == 'cover'
                primary.append(state['src'])
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Primary image overflow'
            assert len(set(primary)) == 4
            assert set(primary + actual_news) == {photo['src'] for photo in supplied.values()}, 'Supplied image missing or repeated'
            assert not errors, errors
            assert not failed_images, failed_images
            result['profiles'].append({'width': width, 'primarySources': primary, 'newsIllustrations': len(actual_news),
                                       'distinctSuppliedSources': len(set(primary + actual_news)),
                                       'cardArticleConsistency': 'passed', 'intrinsicArticleRatio': 'passed',
                                       'olderPlaceholderRemoval': 'passed', 'pageErrors': errors, 'failedImages': failed_images})
            context.close()
        browser.close()
    result['campaignBrowser'] = 'passed'
    output = OUTPUT / 'campaign-verification.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'campaignBrowser': 'passed', 'artifact': str(output), 'suppliedImages': 19, 'newsIllustrations': 15,
                      'profiles': [1440, 390]}, ensure_ascii=False))


if __name__ == '__main__':
    main()

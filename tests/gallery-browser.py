"""Real browser acceptance for the original SKAUT gallery, locally or deployed."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

origin=os.environ.get('SKAUT_GALLERY_ORIGIN','http://127.0.0.1:4173')
out=Path('artifacts/gallery');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
    page=browser.new_page(viewport={'width':1487,'height':1058},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(origin+'/galeria?ref=gallery-check#albums',wait_until='networkidle')
    expect(page.locator('.gallery-page')).to_be_visible()
    expect(page.locator('[data-gallery-album]')).to_have_count(15)
    expect(page.locator('[data-gallery-album][aria-pressed="true"]')).to_have_attribute('data-gallery-album','final-ligi-2023')
    assert page.locator('.gallery-album-cover').evaluate_all('covers=>covers.every(cover=>Math.abs(cover.getBoundingClientRect().width-cover.getBoundingClientRect().height)<1)')
    assert page.locator('.gallery-album-cover img').evaluate_all('images=>images.every(image=>/\/responsive\/(180|360)\//.test(image.getAttribute("src")))')
    for album,photo in [('source-post-6746','6853'),('source-post-6483','6522'),('source-post-7304','7382')]:
        assert page.locator(f'[data-gallery-album="{album}"] img').get_attribute('src').endswith('/'+photo+'.webp')
    expect(page.locator('#gallery-grid button[data-gallery-photo]')).to_have_count(36)
    first=page.locator('#gallery-grid button[data-gallery-photo]').first
    first_id=first.get_attribute('data-gallery-photo')
    first.click();expect(page.locator('#gallery-viewer')).to_be_visible()
    page.locator('#gallery-viewer [data-gallery-thumbnail]').first.focus()
    page.keyboard.press('ArrowRight')
    page.keyboard.press('ArrowRight')
    expect(page.locator('#gallery-position')).to_contain_text('3 /')
    expect(page.locator('#gallery-viewer [aria-current="true"]')).to_be_focused()
    expect(page.locator('#gallery-viewer img').first).to_have_attribute('src',__import__('re').compile(r'^/assets/gallery/'))
    page.keyboard.press('Escape');expect(page.locator('#gallery-viewer')).not_to_be_visible()
    expect(first).to_be_focused()
    page.locator('#gallery-more').click()
    expect(page.locator('#gallery-grid button[data-gallery-photo]')).to_have_count(72)
    page.locator('[data-gallery-collection="all"]').click()
    expect(page.locator('#gallery-year')).to_be_visible()
    page.locator('#gallery-year').select_option('2018')
    expect(page.locator('#gallery-grid button[data-gallery-photo]')).to_have_count(14)
    assert page.locator('#gallery-grid img').evaluate_all('(images)=>images.every(i=>i.getAttribute("src").startsWith("/assets/gallery/"))')
    external=page.locator('[data-gallery-album="miedzy-memorialem-a-walnym"]')
    external.focus();page.keyboard.press('Enter')
    expect(external).to_have_attribute('aria-pressed','true')
    expect(page.locator('[data-gallery-collection="album"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('#gallery-year')).not_to_be_visible()
    expect(page.locator('#gallery-grid [data-gallery-photo]')).to_have_count(36)
    expect(page.locator('#gallery-count')).to_contain_text('107')
    assert 'album=miedzy-memorialem-a-walnym' in page.url and 'ref=gallery-check' in page.url and page.url.endswith('#albums')
    page.go_back()
    expect(page.locator('[data-gallery-album="final-ligi-2023"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('#gallery-count')).to_contain_text('112')
    for album in ['source-post-6322','source-post-937','final-ligi-2023']:
        page.locator(f'[data-gallery-album="{album}"]').click()
        expect(page.locator(f'[data-gallery-album="{album}"]')).to_have_attribute('aria-pressed','true')
        expect(page.locator('[data-gallery-album][aria-pressed="true"]')).to_have_count(1)
    page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
    page.screenshot(path=str(out/'desktop.png'),animations='disabled')
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Mobile overflow'
    page.screenshot(path=str(out/'mobile-albums.png'),animations='disabled')
    page.screenshot(path=str(out/'mobile.png'),full_page=True,animations='disabled')
    page.locator('#gallery-grid button[data-gallery-photo]').first.click()
    expect(page.locator('#gallery-viewer')).to_be_visible()
    assert page.locator('#gallery-close').bounding_box()['width']>=44
    page.screenshot(path=str(out/'viewer-mobile.png'),animations='disabled')
    page.locator('#gallery-close').click()
    page.set_viewport_size({'width':320,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'320px overflow'
    page.locator('[data-gallery-album="miedzy-memorialem-a-walnym"]').click()
    expect(page.locator('[data-gallery-album="miedzy-memorialem-a-walnym"]')).to_have_attribute('aria-pressed','true')
    page.reload(wait_until='networkidle')
    expect(page.locator('[data-gallery-album="miedzy-memorialem-a-walnym"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('#gallery-count')).to_contain_text('107')
    rail=page.locator('#gallery-albums').bounding_box();selected=page.locator('[data-gallery-album="miedzy-memorialem-a-walnym"]').bounding_box()
    assert selected['x']>=rail['x']-1 and selected['x']+selected['width']<=rail['x']+rail['width']+1,'Shared album cover not revealed'
    assert not errors,errors
    print(json.dumps({'galleryBrowser':'passed','origin':origin,'checks':['15 square album covers','small cover images','audited cover selection','album keyboard selection','archive-to-album selection','album history Back','shared album URL','repeated album switching','album photographs','progressive loading','image viewer','arrow keys','Escape','focus return','archive collection','year filter','local photo URLs','desktop composition','390px/320px layout','mobile viewer'],'pageErrors':errors}))
    browser.close()

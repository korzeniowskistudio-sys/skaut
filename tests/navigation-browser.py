"""Bounded real-Chrome acceptance of the integrated bold header navigation."""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ORIGIN = os.environ.get('SKAUT_GALLERY_ORIGIN', 'http://127.0.0.1:4173').rstrip('/')
OUTPUT = Path(__file__).resolve().parents[1] / 'artifacts/navigation'
LABELS = ['Klub', 'Treningi', 'Kalendarz', 'Aktualności', 'Galeria', 'Mój SKAUT']
PROFILES = [(320, 844, True), (390, 844, True), (844, 390, True), (1024, 900, False), (1440, 1000, False)]


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
        for width, height, touch in PROFILES:
            context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=touch, reduced_motion='reduce')
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(ORIGIN + '/galeria', wait_until='networkidle')
            navigation = page.locator('#navigation')
            expect(navigation.locator('.navigation-label')).to_have_count(6)
            assert navigation.locator('.navigation-label').all_text_contents() == LABELS
            before = page.locator('.header').bounding_box()
            compact = width <= 780 or (touch and width <= 1100 and height <= 600)
            if compact:
                expect(navigation).not_to_be_visible()
                page.get_by_role('button', name='Otwórz menu', exact=True).click()
                expect(navigation).to_be_visible()
                expect(page.get_by_role('button', name='Zamknij menu', exact=True)).to_have_attribute('aria-expanded', 'true')
                assert page.locator('main').evaluate('(main)=>main.inert'), 'Covered page remains keyboard-focusable'
                assert not page.locator('#mobile-navigation').evaluate('(nav)=>nav.inert'), 'Bottom tabs were blocked'
                bounds = navigation.bounding_box()
                bottom = page.locator('#mobile-navigation').bounding_box()
                assert bounds['y'] >= before['height'] - 1
                assert bounds['y'] + bounds['height'] <= bottom['y'] + 1
                for label in LABELS:
                    link = navigation.get_by_role('link', name=label, exact=True)
                    link.focus()
                    box = link.bounding_box()
                    assert box['height'] >= 44 and box['width'] >= 44
                page.keyboard.press('Escape')
                expect(navigation).not_to_be_visible()
                expect(page.get_by_role('button', name='Otwórz menu', exact=True)).to_have_attribute('aria-expanded', 'false')
                assert not page.locator('main').evaluate('(main)=>main.inert'), 'Content remained inert after closing'
                page.get_by_role('button', name='Otwórz menu', exact=True).click()
            else:
                expect(navigation).to_be_visible()
                boxes = navigation.locator('a').evaluate_all('(links)=>links.map(a=>{const r=a.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,height:r.height,scroll:a.scrollWidth,width:a.clientWidth}})')
                assert all(box['height'] >= 44 and box['scroll'] <= box['width'] + 1 for box in boxes), boxes
                assert all(left['right'] <= right['left'] + 1 for left, right in zip(boxes, boxes[1:])), boxes
                brand = page.locator('.brand').bounding_box()
                assert boxes[0]['left'] >= brand['x'] + brand['width'] - 1, 'Links overlap the brand'
                utilities = page.locator('.header > .sound-toggle,.header > .basket-link').evaluate_all('(items)=>items.map(item=>item.getBoundingClientRect().left)')
                assert boxes[-1]['right'] <= min(utilities) + 1, 'Links overlap header utilities'
                page.get_by_role('navigation', name='Menu główne', exact=True).get_by_role('link', name='Klub', exact=True).focus()
            for label in LABELS:
                expect(navigation.get_by_role('link', name=label, exact=True)).to_have_count(1)
            current = navigation.get_by_role('link', name='Galeria', exact=True)
            expect(current).to_have_attribute('aria-current', 'page')
            page.keyboard.press('Tab')
            current.focus()
            assert current.evaluate('(a)=>getComputedStyle(a).outlineStyle') != 'none'
            assert page.locator('.header').bounding_box()['height'] == before['height'], 'Header shifted'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
            page.screenshot(path=str(OUTPUT / f'header-{width}-{height}.png'))
            navigation.get_by_role('link', name='Klub', exact=True).click()
            expect(page).to_have_url(ORIGIN + '/klub')
            expect(navigation.locator('a[href="/klub"]')).to_have_attribute('aria-current', 'page')
            if compact:
                expect(navigation).not_to_be_visible()
            assert not errors, errors
            results.append({'width': width, 'height': height, 'touch': touch, 'pageErrors': errors})
            context.close()
        browser.close()
    report = {'navigationBrowser': 'passed', 'origin': ORIGIN, 'profiles': results}
    (OUTPUT / 'verification.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == '__main__':
    main()

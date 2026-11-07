"""Real-browser acceptance for mobile tabs, sticky header and native gallery.

Run against a started server; SKAUT_GALLERY_ORIGIN and CHROMIUM_PATH also
support the deployed site and a locally installed Chrome executable.
"""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = os.environ.get('SKAUT_GALLERY_ORIGIN', 'http://127.0.0.1:4173').rstrip('/')
OUTPUT = ROOT / 'artifacts/gallery'
PROFILES = [
    {'width': 320, 'height': 844, 'touch': True},
    {'width': 390, 'height': 844, 'touch': True},
    {'width': 430, 'height': 932, 'touch': True},
    {'width': 844, 'height': 390, 'touch': True},
    {'width': 932, 'height': 430, 'touch': True},
    {'width': 844, 'height': 900, 'touch': False},
    {'width': 1440, 'height': 1000, 'touch': False},
]


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    result = {'mobileBrowser': 'running', 'origin': ORIGIN, 'profiles': [], 'screenshots': []}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
        for profile in PROFILES:
            context = browser.new_context(
                viewport={'width': profile['width'], 'height': profile['height']},
                has_touch=profile['touch'], reduced_motion='reduce',
            )
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(ORIGIN + '/galeria', wait_until='networkidle')
            navigation = page.locator('#mobile-navigation')
            expect(navigation).to_have_count(1)
            app_mode = profile['width'] <= 780 or (profile['touch'] and profile['width'] <= 1100 and profile['height'] <= 600)
            if not app_mode:
                expect(navigation).not_to_be_visible()
                assert page.locator('.header').evaluate('header=>getComputedStyle(header).position') == 'relative'
                assert page.locator('.header').bounding_box()['height'] == 104
                assert not errors, errors
                result['profiles'].append({**profile, 'result': 'desktop unchanged', 'pageErrors': errors})
                context.close()
                continue

            expect(page.get_by_role('navigation', name='Główna nawigacja mobilna', exact=True)).to_be_visible()
            expect(navigation.locator('[aria-current=page]')).to_have_attribute('href', '/galeria')
            assert page.locator('.header').bounding_box()['height'] == 72
            targets = navigation.locator('a').evaluate_all('''links=>links.map(link=>({
                label:link.textContent,width:link.getBoundingClientRect().width,
                height:link.getBoundingClientRect().height,
                labelWidth:link.querySelector('span').getBoundingClientRect().width,
                fontSize:getComputedStyle(link).fontSize
            }))''')
            assert len(targets) == 5
            for target in targets:
                assert target['width'] >= 44 and target['height'] >= 44, target
                assert target['labelWidth'] <= target['width'], target
                assert target['fontSize'] == '12px', target
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), f'Overflow at {profile}'
            page.evaluate('window.scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})')
            page.evaluate('new Promise(requestAnimationFrame)')
            assert page.locator('.header').bounding_box()['y'] == 0, 'Header stopped being sticky'
            footer = page.locator('.footer').bounding_box()
            bar = navigation.bounding_box()
            assert footer['y'] + footer['height'] <= bar['y'] + 1, 'Footer hidden under fixed tabs'
            page.locator('#menu-toggle').click()
            expect(page.locator('#menu-toggle')).to_have_attribute('aria-expanded', 'true')
            menu = page.locator('#navigation').bounding_box()
            assert menu['y'] >= 72 and menu['y'] + menu['height'] <= bar['y'] + 1, 'Menu covered by fixed tabs'
            assert page.locator('#navigation').evaluate('menu=>getComputedStyle(menu).overflowY') == 'auto'
            expect(page.locator('#navigation .sound-toggle')).to_have_count(1)
            if profile['width'] == 844:
                screenshot = OUTPUT / 'mobile-menu-landscape.png'
                page.screenshot(path=str(screenshot))
                result['screenshots'].append(str(screenshot))
            page.locator('#menu-toggle').click()

            navigation.locator('a[href="/kalendarz"]').click()
            expect(navigation.locator('[aria-current=page]')).to_have_attribute('href', '/kalendarz')
            navigation.locator('a[href="/treningi"]').click()
            expect(navigation.locator('[aria-current=page]')).to_have_attribute('href', '/treningi')
            expect(navigation.locator('[aria-current=page]')).to_have_count(1)
            expect(page.locator('#finder')).to_be_visible()
            controls = page.locator('#finder input,#finder select,#finder button').evaluate_all('''controls=>controls.map(control=>({
                height:control.getBoundingClientRect().height,fontSize:parseFloat(getComputedStyle(control).fontSize)
            }))''')
            assert controls and all(control['height'] >= 44 and control['fontSize'] >= 16 for control in controls), controls

            navigation.locator('a[href="/galeria"]').focus()
            page.keyboard.press('Enter')
            expect(page.locator('#gallery-grid [data-gallery-photo]')).to_have_count(36)
            expect(navigation.locator('[aria-current=page]')).to_have_attribute('href', '/galeria')
            first = page.locator('#gallery-grid [data-gallery-photo]').first
            first.click()
            expect(page.locator('#gallery-viewer')).to_be_visible()
            expect(page.locator('#gallery-close')).to_be_focused()
            page.keyboard.press('Escape')
            expect(page.locator('#gallery-viewer')).not_to_be_visible()
            expect(first).to_be_focused()
            if profile['width'] in [390, 844]:
                screenshot = OUTPUT / f'mobile-navigation-{profile["width"]}.png'
                page.screenshot(path=str(screenshot))
                result['screenshots'].append(str(screenshot))

            # Real archive navigation starts a new document and has no matching
            # bottom tab. The menu and five links remain available there.
            page.goto(ORIGIN + '/archiwum/kontakt.html', wait_until='networkidle')
            expect(page.locator('#mobile-navigation')).to_have_count(1)
            expect(page.locator('#mobile-navigation [aria-current=page]')).to_have_count(0)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            expect(page.get_by_role('navigation', name='Główna nawigacja mobilna', exact=True)).to_be_visible()
            assert not errors, errors
            result['profiles'].append({
                **profile, 'result': 'passed', 'tabTargets': targets, 'barHeight': bar['height'],
                'checks': ['sticky header', 'visible footer', 'scrollable menu', 'sound in menu',
                           'distinct active tabs', 'touch controls', 'keyboard link',
                           'gallery modal focus', 'archive navigation'],
                'pageErrors': errors,
            })
            context.close()
        browser.close()
    result['mobileBrowser'] = 'passed'
    output = OUTPUT / 'mobile-verification.json'
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'mobileBrowser': 'passed', 'profiles': len(PROFILES), 'artifact': str(output),
                      'screenshots': result['screenshots']}, ensure_ascii=False))


if __name__ == '__main__':
    main()

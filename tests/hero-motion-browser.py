"""Check the timed hero effect and its controls in a real browser."""
import os
from playwright.sync_api import expect, sync_playwright

origin = os.environ.get('SKAUT_HERO_ORIGIN', 'http://127.0.0.1:4173')
chrome = os.environ.get('CHROMIUM_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=chrome, args=['--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script('''
      window.heroFrames = {loaded: 0, first: 0, eyes: [0, 0], frames: 0};
      document.addEventListener('load', e => {
        if (e.target.matches?.('.hero-photo > img')) heroFrames.loaded = performance.now();
      }, true);
      const proto = WebGLRenderingContext.prototype;
      const draw = proto.drawArrays, eyes = proto.uniform2fv;
      proto.uniform2fv = function (location, values) {
        if (this.canvas.classList.contains('hero-motion-layer')) {
          values.forEach((value, i) => { heroFrames.eyes[i] = Math.max(heroFrames.eyes[i], value); });
        }
        return eyes.apply(this, arguments);
      };
      proto.drawArrays = function () {
        if (this.canvas.classList.contains('hero-motion-layer')) {
          heroFrames.first ||= performance.now();
          heroFrames.frames++;
        }
        return draw.apply(this, arguments);
      };
    ''')
    page.goto(origin + '/')
    photo = page.locator('.hero-photo > img')
    layer = page.locator('.hero-motion-layer')
    pause = page.get_by_role('button', name='Wstrzymaj animację zdjęcia')
    expect(photo).to_be_visible()
    expect(pause).to_be_visible()
    assert photo.evaluate('img => img.getAnimations().length === 0')
    expect(layer).to_have_count(0)
    page.wait_for_function('() => heroFrames.eyes[0] > .7', timeout=10_000)
    state = page.evaluate('() => heroFrames')
    assert state['loaded'] and state['first'] - state['loaded'] >= 4990, state
    expect(layer).to_be_visible()

    page.evaluate("() => window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})")
    expect(layer).not_to_be_visible()
    frame_count = page.evaluate('() => heroFrames.frames')
    page.wait_for_timeout(200)
    assert page.evaluate('() => heroFrames.frames') == frame_count
    page.evaluate("() => window.scrollTo({top:0,behavior:'instant'})")
    page.wait_for_function('() => heroFrames.eyes[1] > .7', timeout=10_000)
    pause.click()
    expect(layer).not_to_be_visible()
    expect(page.get_by_role('button', name='Włącz animację zdjęcia')).to_be_visible()

    page.emulate_media(reduced_motion='reduce')
    expect(page.locator('.hero-motion-toggle')).not_to_be_visible()
    expect(photo).to_be_visible()
    page.locator('#navigation a[href="/klub"]').click()
    expect(layer).to_have_count(0)
    page.go_back()
    expect(photo).to_be_visible()
    expect(layer).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('Hero motion passed: five-second hold, both blinks, offscreen stop, pause, reduced motion and route cleanup.')

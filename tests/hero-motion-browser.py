"""Check the timed hero effect and its lifecycle in a real browser."""
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
      window.heroFrames = {loaded: 0, first: 0, eyes: [0, 0], slide: 0, frames: 0};
      document.addEventListener('load', e => {
        if (e.target.matches?.('.hero-photo > img')) heroFrames.loaded = performance.now();
      }, true);
      const proto = WebGLRenderingContext.prototype;
      const draw = proto.drawArrays, eyes = proto.uniform2fv, slide = proto.uniform1f;
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
      proto.uniform1f = function (location, value) {
        if (this.canvas.classList.contains('hero-motion-layer')) {
          heroFrames.slide = Math.max(heroFrames.slide, value);
        }
        return slide.apply(this, arguments);
      };
    ''')
    page.goto(origin + '/')
    photo = page.locator('.hero-photo > img')
    layer = page.locator('.hero-motion-layer')
    expect(photo).to_be_visible()
    assert photo.evaluate('img => img.getAnimations().length === 0')
    expect(layer).to_have_count(0)
    # Isolate the photograph from the separate page-wide smoke animation.
    page.locator('.home-smoke').evaluate("smoke => smoke.style.visibility = 'hidden'")
    # Sample the ceiling and the woman's face, then a point on the man's face.
    # The first two used to pick up movement from a broadly feathered shift.
    patches = photo.evaluate('''img => {
      const rect = img.getBoundingClientRect();
      const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
      const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
      const [x, y] = getComputedStyle(img).objectPosition.split(' ').map(parseFloat);
      const left = rect.left + (rect.width - width) * x / 100;
      const top = rect.top + (rect.height - height) * y / 100;
      return [[1380,150,55,90], [756,240,66,65], [1150,155,63,60]].map(([px,py,w,h]) => ({
        x: left + px * width / 1672, y: top + py * height / 941,
        width: w * width / 1672, height: h * height / 941,
      }));
    }''')
    before = [page.screenshot(clip=patch) for patch in patches]
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
    page.wait_for_function('() => heroFrames.eyes[1] > .7 && heroFrames.slide > .9', timeout=10_000)
    expect(layer).to_be_visible()
    during = [page.screenshot(clip=patch) for patch in patches]
    assert before[:2] == during[:2], 'The background and foreground must stay still during the rear slide.'
    assert before[2] != during[2], 'The man must move during the rear slide.'
    expect(page.locator('.hero-motion-toggle')).to_have_count(0)

    page.emulate_media(reduced_motion='reduce')
    expect(layer).not_to_be_visible()
    expect(photo).to_be_visible()
    page.locator('#navigation a[href="/klub"]').click()
    expect(layer).to_have_count(0)
    page.go_back()
    expect(photo).to_be_visible()
    expect(layer).to_have_count(0)
    assert not errors, errors
    browser.close()
    print('Hero motion passed: five-second hold, both blinks, isolated rear slide, offscreen stop, reduced motion and route cleanup.')

"""Transition lifecycle, sound opt-in and reduced-motion acceptance in Chromium."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
origin=os.environ.get('SKAUT_GALLERY_ORIGIN','http://127.0.0.1:4173')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.__audioContexts=[];const OriginalAudioContext=window.AudioContext;window.AudioContext=class extends OriginalAudioContext{constructor(...args){super(...args);window.__audioContexts.push(this);}};''')
 page.goto(origin+'/',wait_until='networkidle')
 button=page.get_by_role('button',name='Włącz dźwięk przejść',exact=True)
 expect(button).to_have_attribute('aria-pressed','false')
 assert page.evaluate('window.__audioContexts.length')==0,'Audio started without opt-in'
 button.click()
 expect(page.get_by_role('button',name='Wyłącz dźwięk przejść',exact=True)).to_have_attribute('aria-pressed','true')
 assert page.evaluate('window.__audioContexts.length')==1
 assert page.evaluate('window.__audioContexts[0].state')=='running'
 page.get_by_role('navigation').get_by_role('link',name='Galeria',exact=True).click()
 expect(page.locator('.gallery-page')).to_be_visible()
 page.locator('#gallery-grid button[data-gallery-photo]').first.click()
 page.keyboard.press('Escape')
 page.evaluate('''()=>{const n=document.querySelector('#navigation');n.querySelector('a[href="/klub"]').click();n.querySelector('a[href="/galeria"]').click();n.querySelector('a[href="/aktualnosci"]').click();}''')
 expect(page.get_by_role('heading',name='Aktualności.',exact=True)).to_be_visible()
 assert page.url.endswith('/aktualnosci')
 assert page.locator('dialog[open]').count()==0
 page.get_by_role('button',name='Wyłącz dźwięk przejść',exact=True).click()
 expect(page.get_by_role('button',name='Włącz dźwięk przejść',exact=True)).to_have_attribute('aria-pressed','false')
 for width in [320,390,800,1024,1440]:
  page.set_viewport_size({'width':width,'height':900})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Header/page overflow at {width}px'
 reduced=browser.new_context(reduced_motion='reduce',viewport={'width':390,'height':844})
 rp=reduced.new_page();rp.goto(origin+'/galeria',wait_until='networkidle')
 expect(rp.locator('#gallery-grid button[data-gallery-photo]').first).to_be_visible()
 assert rp.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
 rp.get_by_role('button',name='Otwórz menu').click()
 rp.get_by_role('navigation').get_by_role('link',name='Klub',exact=True).click()
 expect(rp.get_by_role('heading',name='Skupienie. Sport. SKAUT.',exact=True)).to_be_visible()
 assert rp.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0
 assert not errors,errors
 result={'motionBrowser':'passed','origin':origin,'checks':['silent default','trusted-gesture audio activation','sound toggle state','real running AudioContext','gallery navigation','rapid navigation last-intent wins','dialog cleanup','sound off','320/390/800/1024/1440px layouts','reduced-motion navigation'],'pageErrors':errors}
 Path('artifacts/gallery/motion-verification.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result))
 browser.close()

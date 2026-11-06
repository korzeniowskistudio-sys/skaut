"""Real Chromium checks against an explicitly started DEMO_MODE server."""
import json
import os
from uuid import uuid4
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
out=root/'artifacts';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1487,'height':1058},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
 expect(page.get_by_role('heading',name='Znajdź swój rytm.')).to_be_visible()
 page.evaluate('document.fonts.ready');page.screenshot(path=str(out/'home-desktop.png'),full_page=True)
 page.screenshot(path=str(out/'home-viewport.png'))
 page.get_by_label('Rodzaj treningu').select_option('pistolet')
 page.get_by_role('button',name='Sprawdź terminy').click()
 expect(page.get_by_role('heading',name='Znajdź swój trening.')).to_be_visible()
 expect(page.locator('.event-row')).to_have_count(1)
 page.get_by_role('button',name='Dodaj do koszyka').click()
 page.get_by_role('link',name='Koszyk, wydarzenia: 1').click()
 expect(page.get_by_role('heading',name='Twój koszyk.')).to_be_visible()
 page.get_by_role('link',name='Zaloguj się i zarezerwuj').click()
 page.get_by_role('button',name='Otwórz konto demonstracyjne').click()
 expect(page.get_by_role('heading',name='Twój koszyk.')).to_be_visible()
 page.get_by_role('button',name='Wyślij rezerwację').click()
 expect(page.get_by_role('heading',name='Twój harmonogram')).to_be_visible()
 expect(page.get_by_text('Oczekuje na potwierdzenie',exact=True)).to_be_visible()
 page.screenshot(path=str(out/'member-desktop.png'),full_page=True)
 cancelled_before=page.locator('.status.cancelled').count()
 page.get_by_role('button',name='Anuluj',exact=True).click()
 expect(page.locator('.status.cancelled')).to_have_count(cancelled_before+1)
 page.get_by_role('tab',name='Wiadomości',exact=True).click()
 message='Sprawdzam działanie wiadomości '+str(uuid4())
 page.get_by_label('Twoja wiadomość').fill(message)
 page.get_by_role('button',name='Wyślij wiadomość').click()
 expect(page.get_by_text(message,exact=True)).to_be_visible()
 page.get_by_role('link',name='Aktualności',exact=True).first.click()
 page.get_by_label('Szukaj w aktualnościach').fill('Skupienie')
 expect(page.locator('.news-item')).to_have_count(1)
 page.locator('.news-item a').click()
 expect(page.locator('.body-copy')).to_contain_text('artykuł demonstracyjny')
 page.get_by_role('link',name='Klub',exact=True).click()
 expect(page.get_by_role('heading',name='Skupienie. Sport. SKAUT.')).to_be_visible()
 page.goto('http://127.0.0.1:4173/')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
 page.screenshot(path=str(out/'home-mobile.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow'
 page.get_by_role('button',name='Otwórz menu').click()
 expect(page.get_by_role('navigation').get_by_role('link',name='Aktualności')).to_be_visible()
 page.get_by_role('navigation').get_by_role('link',name='Aktualności').click()
 expect(page.get_by_role('heading',name='Aktualności.')).to_be_visible()
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'News mobile overflow'
 assert not errors, errors
 print(json.dumps({'passed':['desktop hero','training filter','basket','demo login','SQL reservation','cancellation','member message','news search and detail','club page','mobile layout','mobile navigation'],'pageErrors':errors},ensure_ascii=False))
 browser.close()

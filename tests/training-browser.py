"""Sample training filters and real-event replacement, without writing to SQL."""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

origin=os.environ.get('SKAUT_GALLERY_ORIGIN','http://127.0.0.1:4173')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=browser.new_page(viewport={'width':390,'height':844},has_touch=True)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/api/events**',lambda route:route.fulfill(json=[]))
 page.goto(origin+'/treningi',wait_until='networkidle')
 expect(page.locator('[data-sample-training]')).to_have_count(10)
 expect(page.locator('[data-add]')).to_have_count(0)
 expect(page.get_by_text('Przykładowe treningi.',exact=True)).to_be_visible()
 assert page.locator('.event-kind :is(.ph,.training-type-icon)').count()==10
 page.locator('[data-training-type="pistolet"]').click()
 expect(page.locator('[data-sample-training]')).to_have_count(3)
 link=page.get_by_role('link',name='Zobacz w kalendarzu').first
 target=link.get_attribute('href');link.click()
 expect(page.locator('.calendar-page')).to_be_visible()
 assert page.url.endswith(target)
 assert page.locator('[data-sample-event]').count()>0
 page.goto(origin+'/treningi?type=karabin&date=2000-01-01',wait_until='networkidle')
 expect(page.get_by_text('Brak terminów dla tego wyboru',exact=True)).to_be_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.unroute('**/api/events**')
 real={'id':'real-published-event','type':'pistolet','title':'Opublikowany trening','startsAt':'2099-01-02T17:00:00Z','location':'Miejsce podane przez klub','price':10000,'available':3}
 page.route('**/api/events**',lambda route:route.fulfill(json=[real]))
 page.goto(origin+'/treningi',wait_until='networkidle')
 expect(page.locator('[data-sample-training]')).to_have_count(0)
 expect(page.locator('[data-add]')).to_have_count(1)
 expect(page.get_by_text('Opublikowany trening',exact=True)).to_be_visible()
 page.locator('[data-training-type="karabin"]').click()
 expect(page.get_by_text('Brak terminów dla tego wyboru',exact=True)).to_be_visible()
 expect(page.locator('[data-sample-training]')).to_have_count(0)
 assert not errors,errors
 result={'trainingBrowser':'passed','origin':origin,'checks':['10 labelled examples','discipline icons','type filtering','sample-to-calendar date link','empty date filter','no fake checkout','real data replaces every example','filtered real empty does not restore samples','390px layout'],'pageErrors':errors}
 Path('artifacts/gallery/training-verification.json').write_text(json.dumps(result,indent=2))
 print(json.dumps(result));browser.close()

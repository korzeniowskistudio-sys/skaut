"""Verify live schedule browsing and failure fallback without making a reservation."""
import os
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

origin=os.environ.get('SKAUT_ORIGIN','http://127.0.0.1:4176')
host='www.zbrojownia.ksskaut.pl'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    for width, english in [(320,False),(390,True),(1440,False)]:
        page=browser.new_page(viewport={'width':width,'height':850},timezone_id='America/New_York',reduced_motion='reduce')
        page.set_default_timeout(15000)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        feed=page.request.get(origin+'/api/zbrojownia/events',timeout=15000).json()
        assert feed['state']=='current' and feed['events'],feed['state']
        event=next(e for e in feed['events'] if e['type']=='karabin')
        training='/en/training' if english else '/treningi'
        calendar='/en/calendar' if english else '/kalendarz'
        book='Book on Zbrojownia' if english else 'Rezerwuj w Zbrojowni'
        page.goto(origin+training)
        expect(page.locator('[data-zbrojownia-event]').first).to_be_visible()
        expect(page.locator('[data-add]')).to_have_count(0)
        expect(page.locator('[data-sample-training]')).to_have_count(0)
        page.locator('[data-training-type="karabin"]').click()
        row=page.locator('[data-zbrojownia-event]').filter(has_text=event['title']).first
        expect(row.get_by_role('link',name=book)).to_have_attribute('href',event['bookingUrl'])
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        page.goto(origin+calendar+'?type=karabin&date='+event['day'])
        expect(page.locator('[data-calendar-day][aria-pressed="true"]')).to_have_attribute('data-calendar-day',event['day'])
        card=page.locator('#calendar-agenda .calendar-event').filter(has_text=event['title']).first
        link=card.get_by_role('link',name=book)
        expect(link).to_have_attribute('href',event['bookingUrl'])
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        assert urlsplit(event['bookingUrl']).netloc==host
        if width==1440:
            # GET the official public event page only.
            assert page.request.get(event['bookingUrl'],timeout=15000).ok
            page.goto(origin+'/')
            expect(page.locator('[data-home-events] [data-zbrojownia-event]').first).to_be_visible()
        page.route('**/api/zbrojownia/events',lambda route:route.fulfill(json={'state':'unavailable','events':[]}))
        page.goto(origin+training)
        expect(page.locator('[data-zbrojownia-event]')).to_have_count(0)
        expect(page.locator('[data-sample-training]')).to_have_count(0)
        expect(page.locator('.booking-source a')).to_have_attribute('href','https://'+host+'/')
        page.goto(origin+calendar)
        expect(page.locator('[data-sample-event]')).to_have_count(0)
        expect(page.locator('.booking-source a')).to_be_visible()
        assert not errors,errors
        print(f'{width}px {"EN" if english else "PL"}: filters, dates, booking handoff and outage fallback passed',flush=True)
        page.close()
    browser.close()

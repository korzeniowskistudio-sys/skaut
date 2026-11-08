"""Check migrated public pages and verify that the booking path stays on SKAUT."""
import os
from playwright.sync_api import sync_playwright, expect

origin=os.environ.get('SKAUT_ORIGIN','http://127.0.0.1:4176')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    for width, english in [(320,False),(390,True),(1440,False)]:
        page=browser.new_page(viewport={'width':width,'height':850},timezone_id='America/New_York',reduced_motion='reduce')
        errors=[]
        old_requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:old_requests.append(request.url) if '//www.zbrojownia.ksskaut.pl/' in request.url else None)
        schedule=page.request.get(origin+'/zbrojownia/schedule.json').json()
        index=page.request.get(origin+'/zbrojownia/index.json').json()
        assert len(index['events'])>=480 and len(index['products'])==16 and len(index['pages'])==6
        event=next(e for e in schedule if e['type']=='karabin')
        training='/en/training' if english else '/treningi'
        calendar='/en/calendar' if english else '/kalendarz'
        detail=event['path'].replace('/wydarzenia/','/en/events/',1) if english else event['path']
        label='Event details' if english else 'Szczegóły wydarzenia'
        page.goto(origin+training)
        expect(page.locator('[data-imported-event]').first).to_be_visible()
        expect(page.locator('[data-add]')).to_have_count(0)
        page.locator('[data-training-type="karabin"]').click()
        card=page.locator('[data-imported-event]').filter(has_text=event['title']).first
        link=card.get_by_role('link',name=label)
        expect(link).to_have_attribute('href',detail)
        link.click()
        expect(page.get_by_role('heading',name=event['title'],exact=True).first).to_be_visible()
        expect(page.locator('.imported-body')).to_be_visible()
        assert page.url==origin+detail
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,detail)
        sample=next(e for e in schedule if e['slug']=='trening-ipsc-lvl-2-2026-11-11')
        sample_path=sample['path'].replace('/wydarzenia/','/en/events/',1) if english else sample['path']
        page.goto(origin+sample_path)
        expect(page.locator('.imported-options').first).to_be_visible()

        page.goto(origin+calendar+'?type=karabin&date='+event['day'])
        expect(page.locator('[data-calendar-day][aria-pressed="true"]')).to_have_attribute('data-calendar-day',event['day'])
        card=page.locator('#calendar-agenda .calendar-event').filter(has_text=event['title']).first
        expect(card.get_by_role('link',name=label)).to_have_attribute('href',detail)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,calendar)

        archive='/en/events' if english else '/wydarzenia'
        page.goto(origin+archive+'?period=all')
        expect(page.locator('#imported-events li')).to_have_count(30)
        page.locator('#imported-more').click()
        expect(page.locator('#imported-events li')).to_have_count(60)
        page.locator('#event-search').fill(event['title'])
        expect(page.locator('#imported-events li')).to_have_count(1)

        shop='/en/shop' if english else '/sklep'
        page.goto(origin+shop)
        expect(page.locator('.imported-product')).to_have_count(len(index['products'])+1)
        expect(page.locator('.imported-product a').first).to_have_attribute('href',shop+'/kalendarz-skaut-2027')
        product=page.locator('.imported-product a').nth(1)
        expect(product.locator('img')).to_be_visible()
        product.click()
        expect(page.locator('main .imported-pictures img').first).to_be_visible()
        expect(page.locator('.imported-body')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,shop)

        if width==1440:
            page.goto(origin+'/sklep/informacje/regulamin')
            assert len(page.locator('.imported-body').inner_text())>8000
            page.goto(origin+'/archiwum/targi-ks-skaut-od-22lr-do-338.html')
            expect(page.locator('a[href*="zbrojownia.ksskaut.pl"]')).to_have_count(0)
            expect(page.locator('a[href^="/wydarzenia"]').first).to_be_visible()
        assert not errors,errors
        assert not old_requests,old_requests
        print(f'{width}px {"EN" if english else "PL"}: local event details, archive, product and navigation passed',flush=True)
        page.close()
    browser.close()

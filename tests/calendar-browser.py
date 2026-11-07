"""Calendar acceptance: illustrations stay local; real events keep Warsaw dates."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

origin=os.environ.get('SKAUT_CALENDAR_ORIGIN','http://127.0.0.1:4173')
out=Path('artifacts/calendar');out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'))
    context=browser.new_context(viewport={'width':1487,'height':1058},timezone_id='America/New_York')
    page=context.new_page()
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    before=page.request.get(origin+'/api/events').json()
    page.goto(origin+'/kalendarz',wait_until='networkidle')
    expect(page.locator('.calendar-page')).to_be_visible()
    if not before:
        expect(page.get_by_text('Przykładowy kalendarz',exact=True)).to_be_visible()
        expect(page.locator('.calendar-upcoming .calendar-event')).to_have_count(10)
        assert page.locator('.calendar-page [data-add]').count()==0
        assert page.locator('.calendar-page .price,.calendar-page .availability').count()==0
    provider=page.evaluate("""async()=>{
      const c=await import('/calendar.js');window.calendarTestModule=c;
      const fixed=new Date('2026-03-28T22:00:00Z'),events=c.sampleCalendarEvents(fixed);
      return {events,stable:JSON.stringify(events)===JSON.stringify(c.sampleCalendarEvents(fixed)),
        rollover:c.eventDateKey('2026-11-07T23:30:00Z'),firstDay:c.eventDateKey(events[0].startsAt),
        firstTime:new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit'}).format(new Date(events[0].startsAt))};
    }""")
    assert provider['stable'] and len(provider['events'])==10
    assert provider['rollover']=='2026-11-08' and provider['firstDay']=='2026-03-29' and provider['firstTime']=='10:00',provider
    assert all(event['sample'] and event['id'].startswith('sample-') for event in provider['events'])
    assert all(not any(field in event for field in ('price','capacity','available','location')) for event in provider['events'])
    page.evaluate("""()=>{window.calendarCleanup=calendarTestModule.renderCalendar({main:document.querySelector('main'),events:[]})}""")
    page.locator('[data-calendar-filter="pistolet"]').click()
    expect(page.locator('[data-calendar-filter="pistolet"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('.calendar-upcoming .calendar-event')).to_have_count(3)
    page.locator('.calendar-upcoming [data-calendar-pick]').first.click()
    expect(page.locator('#calendar-agenda .calendar-event')).to_have_count(1)
    expect(page.locator('#calendar-agenda .calendar-sample-tag')).to_have_text('Wydarzenie przykładowe')
    selected=page.locator('[data-calendar-day][aria-pressed="true"]').get_attribute('data-calendar-day')
    page.locator(f'[data-calendar-day="{selected}"]').focus();page.keyboard.press('ArrowRight')
    assert page.locator('[data-calendar-day][aria-pressed="true"]').get_attribute('data-calendar-day')!=selected
    initial_month=page.locator('#calendar-month-title').text_content()
    page.locator('[data-calendar-action="next"]').click()
    assert page.locator('#calendar-month-title').text_content()!=initial_month
    page.locator('[data-calendar-action="prev"]').click()
    expect(page.locator('#calendar-month-title')).to_have_text(initial_month)
    page.locator('[data-calendar-action="today"]').click()
    expect(page.locator('[data-calendar-day][aria-current="date"]')).to_have_attribute('aria-pressed','true')
    link_date=page.evaluate("()=>calendarTestModule.eventDateKey(calendarTestModule.sampleCalendarEvents().find(e=>e.type==='pistolet').startsAt)")
    page.goto(origin+'/kalendarz?type=pistolet&date='+link_date,wait_until='networkidle')
    expect(page.locator('[data-calendar-filter="pistolet"]')).to_have_attribute('aria-pressed','true')
    expect(page.locator(f'[data-calendar-day="{link_date}"]')).to_have_attribute('aria-pressed','true')
    page.screenshot(path=str(out/'desktop.png'))
    page.set_viewport_size({'width':320,'height':760})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),'320px page overflow'
    buttons=page.locator('.calendar-day').evaluate_all('(buttons)=>buttons.map(b=>({width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))')
    assert all(button['width']>=44 and button['height']>=44 for button in buttons),buttons
    assert page.locator('.calendar-days').evaluate('(strip)=>strip.scrollWidth>strip.clientWidth'),'Mobile day strip should swipe'
    page.screenshot(path=str(out/'mobile.png'))
    page.emulate_media(reduced_motion='reduce')
    real=page.evaluate("""async()=>{
      const c=await import('/calendar.js');window.calendarCleanup?.();
      history.replaceState({},'',location.pathname+'?date=2026-11-08&type=karabin');
      const event={id:'calendar-test-only',type:'karabin',title:'Published fixture',startsAt:'2026-11-07T23:30:00Z',location:'Published fixture location'};
      window.calendarCleanup=c.renderCalendar({main:document.querySelector('main'),events:[event]});
      document.querySelector('[data-calendar-pick]')?.click();
      return {sampleCount:document.querySelectorAll('[data-sample-event]').length,heading:document.querySelector('#calendar-agenda-title').textContent,link:document.querySelector('#calendar-agenda a')?.getAttribute('href')};
    }""")
    assert real['sampleCount']==0 and real['link']=='/treningi?date=2026-11-08&type=karabin',real
    expect(page.locator('.calendar-sample')).to_have_count(0)
    expect(page.locator('[data-calendar-day="2026-11-08"] .calendar-day-title')).to_have_text('Published fixture')
    expect(page.locator('#calendar-agenda')).to_contain_text('Published fixture location')
    assert page.locator('#calendar-agenda a').get_attribute('href')=='/treningi?date=2026-11-08&type=karabin'
    assert page.evaluate('document.getAnimations().length')==0
    after=page.request.get(origin+'/api/events').json()
    assert before==after,'Calendar illustrations must not create backend events'
    assert not errors,errors
    print(json.dumps({'calendarBrowser':'passed','checks':['read-only samples','Warsaw DST/timezone','type filters','selected agenda','keyboard dates','month navigation','deep links','320px swiping/targets','real-event separation','no backend writes'],'pageErrors':errors}))
    browser.close()

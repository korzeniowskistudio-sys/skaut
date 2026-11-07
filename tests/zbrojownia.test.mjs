import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { parseSchedule, createScheduleFeed } from '../server/zbrojownia.mjs';

const now = Date.parse('2026-11-07T11:30:00Z');
const root = 'https://www.zbrojownia.ksskaut.pl';
const card = ({slug='trening',title='Trening KARABIN &#8211; jesień',day='2026-11-08',category='- Treningi',url=root+'/events/'+slug+'/',hours='09:00 - 15:00'}={}) =>
  `<div class='filter_item mep-event-list-loop mep_event_grid_item' data-title="${title}" data-city-name="Jawiszowice" data-category="${category}" data-date="${day}"><div class="mep_list_event_details"><a href="${url}"><h2 class='mep_list_title'>${title}</h2><li class="mep_list_location_name"><h6>Brzeszcze &amp; Jawiszowice</h6></li><li class="mep_list_event_date"><h5>8 listopada, 2026</h5><h5>${hours}</h5></li></a></div></div>`;

test('public schedule preserves official links, Warsaw dates and display times', () => {
  const entries = parseSchedule(card()+card({slug:'kurs',title:'Szkolenie PZSS',day:'2026-11-10',hours:'',category:'- Szkolenia'}), now);
  assert.deepEqual(entries.map(e=>[e.bookingUrl,e.type,e.title,e.location,e.startsAt,e.startTime]), [
    [root+'/events/trening/','karabin','Trening KARABIN – jesień','Brzeszcze & Jawiszowice','2026-11-08T08:00:00.000Z','09:00'],
    [root+'/events/kurs/','szkolenia','Szkolenie PZSS','Brzeszcze & Jawiszowice','2026-11-10T12:00:00.000Z',null],
  ]);
});

test('schedule excludes past, protected, non-event and unsafe links; detects missing markup', () => {
  assert.deepEqual(parseSchedule([
    card({day:'2026-11-06'}),card({slug:'obsluga',category:'- Zawody - obsługa'}),
    card({slug:'prywatny',title:'Zabezpieczone: trening'}),card({slug:'cegielki',title:'Dopłaty dodatkowe'}),
    card({url:'https://example.org/events/a/'}),card({url:root+'/events/a/?add-to-cart=1'}),
    card({day:'2026-11-31'}),card(),card(),
  ].join(''), now).map(e=>e.id),['zbrojownia:trening']);
  assert.throws(()=>parseSchedule('<h1>Temporarily unavailable</h1>', now));
});

test('feed coalesces requests and stops serving old schedules after its fallback window', async () => {
  let clock=now, calls=0, offline=false;
  const feed=createScheduleFeed({clock:()=>clock,fetcher:async(url,options)=>{
    calls++;
    assert.equal(url,root+'/');
    assert.equal(options.redirect,'error');
    if(offline)throw new Error('network unavailable');
    return new Response(card(),{headers:{'Content-Type':'text/html'}});
  }});
  const [a,b]=await Promise.all([feed(),feed()]);
  assert.equal(a.state,'current');
  assert.equal(b.events.length,1);
  assert.equal(calls,1);
  offline=true;
  clock+=6*60*1000;
  assert.equal((await feed()).state,'stale');
  assert.equal((await feed()).events.length,1);
  assert.equal(calls,2);
  clock+=30*60*1000;
  assert.deepEqual(await feed(),{state:'unavailable',events:[]});
});

test('public schedule endpoint is separate from local inventory and the member session', async () => {
  const store=createStore(':memory:');
  const server=createApp({store,scheduleFeed:async()=>({state:'current',events:parseSchedule(card(),now)})});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base='http://127.0.0.1:'+server.address().port;
    const result=await fetch(base+'/api/zbrojownia/events');
    assert.equal(result.status,200);
    assert.equal(result.headers.get('set-cookie'),null);
    assert.equal((await result.json()).events[0].id,'zbrojownia:trening');
    assert.deepEqual(await (await fetch(base+'/api/events')).json(),[]);
  } finally {
    await new Promise(resolve=>server.close(resolve));
    store.close();
  }
});

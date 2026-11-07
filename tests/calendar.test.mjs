import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleCalendarEvents,eventDateKey} from '../public/calendar.js';

test('calendar examples share Warsaw dates and never carry reservation inventory',()=>{
 const now=new Date('2026-10-24T22:30:00Z');
 assert.equal(eventDateKey(now),'2026-10-25');
 assert.equal(eventDateKey('invalid'),'');
 const examples=sampleCalendarEvents(now);
 assert.equal(examples.length,10);
 assert.deepEqual(examples,sampleCalendarEvents(now));
 assert.deepEqual(new Set(examples.map(event=>event.type)),new Set(['pierwszy-raz','pistolet','karabin','zawody']));
 for(const event of examples){
  assert.match(event.id,/^sample-/);
  assert.equal(event.sample,true);
  assert.ok(eventDateKey(event.startsAt)>'2026-10-25');
  for(const field of ['price','capacity','available','location'])assert.equal(Object.hasOwn(event,field),false);
 }
 // After the autumn clock change, an 18:00 club session is still 18:00 Warsaw.
 const pistol=examples.find(event=>event.type==='pistolet');
 assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hour:'2-digit',minute:'2-digit'}).format(new Date(pistol.startsAt)),'18:00');
});

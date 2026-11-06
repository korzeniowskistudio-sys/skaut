import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';

function setup() {
  const s=createStore(':memory:');
  const a=s.createMember({name:'Anna',email:'anna@example.test',passwordHash:'hash'});
  const b=s.createMember({name:'Jan',email:'jan@example.test',passwordHash:'hash'});
  const event=s.createEvent({title:'Trening testowy',type:'pistolet',startsAt:new Date(Date.now()+86400000).toISOString(),capacity:1,price:12000,location:'Miejsce testowe',description:'Opis testowy'});
  return {s,a,b,event};
}
test('checkout persists server price and replays the same order without another place',()=>{
  const {s,a,event}=setup();
  const first=s.checkout(a.id,[event.id],'checkout-key-123456');
  assert.equal(first.total,12000); assert.equal(first.status,'awaiting_confirmation');
  assert.equal(s.checkout(a.id,[event.id],'checkout-key-123456').id,first.id);
  assert.equal(s.memberOverview(a.id).bookings.length,1);
  assert.equal(s.listEvents()[0].available,0);s.close();
});
test('last place cannot be oversold and a rejected order leaves no partial records',()=>{
  const {s,a,b,event}=setup();s.checkout(a.id,[event.id],'first-member-key');
  assert.throws(()=>s.checkout(b.id,[event.id],'second-member-key'),e=>e.code==='SOLD_OUT');
  assert.equal(s.memberOverview(b.id).bookings.length,0);s.close();
});
test('cancellation enforces ownership, releases capacity and does not expose another member',()=>{
  const {s,a,b,event}=setup();const o=s.checkout(a.id,[event.id],'first-member-key');
  const booking=s.memberOverview(a.id).bookings[0];
  assert.throws(()=>s.cancelBooking(b.id,booking.id),e=>e.status===404);
  assert.equal(s.memberOverview(b.id).bookings.length,0);
  s.cancelBooking(a.id,booking.id);assert.equal(s.listEvents()[0].available,1);
  assert.equal(s.getOrder(a.id,o.id).status,'cancelled');s.close();
});
test('invalid, duplicate and past events do not create orders; expired holds release capacity',()=>{
  const {s,a,b,event}=setup();
  assert.throws(()=>s.checkout(a.id,[event.id,event.id],'duplicate-key-123'),e=>e.status===400);
  assert.throws(()=>s.checkout(a.id,['missing'],'missing-key-1234'),e=>e.status===404);
  s.checkout(a.id,[event.id],'first-member-key');
  s.db.prepare("UPDATE bookings SET hold_until = '2000-01-01T00:00:00.000Z'").run();
  assert.equal(s.listEvents()[0].available,1);
  assert.doesNotThrow(()=>s.checkout(b.id,[event.id],'second-member-key'));s.close();
});
test('a multi-event basket rolls back completely if any event is full',()=>{
  const {s,a,b,event}=setup();
  const second=s.createEvent({title:'Inny trening',type:'karabin',startsAt:new Date(Date.now()+172800000).toISOString(),capacity:2,price:5000,location:'Test'});
  s.checkout(a.id,[event.id],'first-member-key');
  assert.throws(()=>s.checkout(b.id,[second.id,event.id],'basket-failure-key'),e=>e.code==='SOLD_OUT');
  assert.equal(s.listEvents().find(e=>e.id===second.id).available,2);s.close();
});
test('partial cancellation recalculates pending order total and event cancellation notifies members',()=>{
 const {s,a,event}=setup();const staff=s.createMember({name:'Staff',email:'staff@example.test',passwordHash:'x',role:'staff'});
 const other=s.createEvent({title:'Drugi',type:'karabin',startsAt:new Date(Date.now()+172800000).toISOString(),capacity:2,price:20000,location:'Test'});
 const order=s.checkout(a.id,[event.id,other.id],'multi-event-order-key');
 const first=s.memberOverview(a.id).bookings.find(b=>b.event_id===event.id);s.cancelBooking(a.id,first.id);
 assert.equal(s.getOrder(a.id,order.id).total,20000);
 assert.throws(()=>s.updateEvent(other.id,{capacity:0},staff.id),e=>e.status===400);
 s.cancelEvent(other.id,staff.id);
 assert.equal(s.listEvents().some(e=>e.id===other.id),false);
 assert.equal(s.getOrder(a.id,order.id).status,'cancelled');
 assert.equal(s.getOrder(a.id,order.id).total,0);
 assert.match(s.memberOverview(a.id).messages.at(-1).body,/odwołane/);s.close();
});

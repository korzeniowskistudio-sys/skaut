import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';
import { clientAddress } from '../server/security.mjs';

test('real HTTP registration, CSRF, member isolation and authoritative checkout',async()=>{
 const store=createStore(':memory:');const server=createApp({store,demoMode:false});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 let cookie='',csrf='';
 async function request(path,method='GET',body,extra={}) {
  const r=await fetch(origin+path,{method,headers:{'content-type':'application/json',origin,cookie,'x-csrf-token':csrf,...extra},body:body?JSON.stringify(body):undefined});
  const cookies=r.headers.getSetCookie();if(cookies.length){const all=new Map(cookie.split('; ').filter(Boolean).map(x=>x.split('=')));for(const c of cookies){const [k,v]=c.split(';')[0].split('=');all.set(k,v);}cookie=[...all].map(([k,v])=>k+'='+v).join('; ');}
  const data=await r.json();if(data.csrf)csrf=data.csrf;return {status:r.status,data};
 }
 try {
  await request('/api/session');
  assert.equal((await request('/api/register','POST',{name:'Anna',email:'anna@example.test',password:'long-password-123'},{'x-csrf-token':'wrong'})).status,403);
  assert.equal((await request('/api/register','POST',{name:'Anna',email:'anna@example.test',password:'long-password-123'})).status,201);
  const member=(await request('/api/session')).data.member;assert.equal(member.role,'member');
  assert.equal((await request('/api/admin/events','POST',{})).status,403);
  assert.equal((await request('/api/checkout','POST',{events:[],key:'invalid-events-key'},{origin:'https://attacker.test'})).status,403);
  const event=store.createEvent({title:'Przykład',type:'pistolet',startsAt:new Date(Date.now()+86400000).toISOString(),capacity:1,price:10000,location:'Test'});
  const order=await request('/api/checkout','POST',{events:[event.id],key:'valid-order-key-1234',total:1});
  assert.equal(order.status,201);assert.equal(order.data.total,10000);
  const me=await request('/api/me');assert.equal(me.data.bookings.length,1);
  await request('/api/messages','POST',{body:'Pytanie testowe'});assert.equal((await request('/api/me')).data.messages.length,1);
  await request('/api/logout','POST',{});await request('/api/session');
  await request('/api/register','POST',{name:'Jan',email:'jan@example.test',password:'long-password-456'});
  assert.equal((await request('/api/me')).data.bookings.length,0);
  assert.equal((await request('/api/me')).data.messages.length,0);
  assert.equal((await request('/api/bookings/'+me.data.bookings[0].id,'DELETE',{})).status,404);
  assert.equal((await request('/api/demo','POST',{})).status,404);
  assert.equal((await request('/api/login','POST',{email:'anna@example.test',password:'wrong-password'})).status,401);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
});

test('passwords are salted and verified without exposing plaintext',async()=>{
 const {verifyPassword}=await import('../server/security.mjs');
 const hash=await hashPassword('correct-password');assert.notEqual(hash,'correct-password');
 assert.equal(await verifyPassword('correct-password',hash),true);assert.equal(await verifyPassword('wrong',hash),false);
 assert.notEqual(hash,await hashPassword('correct-password'));
});
test('staff can read and answer messages, publish saved drafts and correct events',async()=>{
 const store=createStore(':memory:');const password='staff-long-password-123';
 const staff=store.createMember({name:'Staff',email:'staff@example.test',passwordHash:await hashPassword(password),role:'staff'});
 const member=store.createMember({name:'Anna',email:'anna@example.test',passwordHash:'unused'});
 store.db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run('message-1',member.id,member.id,'Pytanie członka',new Date().toISOString());
 const app=createApp({store});await new Promise(r=>app.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.address().port}`;let cookies='',csrf='';
 async function req(path,method='GET',body){const r=await fetch(origin+'/api'+path,{method,headers:{origin,cookie:cookies,'content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const c=r.headers.getSetCookie();if(c.length)cookies=c.map(x=>x.split(';')[0]).join('; ');const data=await r.json();if(data.csrf)csrf=data.csrf;return{status:r.status,data};}
 try{
  await req('/session');await req('/login','POST',{email:'staff@example.test',password});
  assert.equal((await req('/admin/overview')).data.messages[0].body,'Pytanie członka');
  assert.equal((await req('/admin/message','POST',{memberId:member.id,body:'Odpowiedź klubu'})).status,201);
  const draft=await req('/admin/news','POST',{slug:'szkic-testowy',title:'Szkic',summary:'Opis',body:'Treść',category:'Klub',published:false});
  assert.equal((await req('/news')).data.length,0);
  assert.equal((await req('/admin/news/'+draft.data.id,'PATCH',{published:true,title:'Opublikowany artykuł'})).status,200);
  assert.equal((await req('/news')).data[0].title,'Opublikowany artykuł');
  assert.equal((await req('/admin/news/'+draft.data.id,'PATCH',{published:false})).status,200);
  assert.equal((await req('/news')).data.length,0);
  const event=store.createEvent({title:'Pierwotny tytuł',type:'pistolet',startsAt:new Date(Date.now()+86400000).toISOString(),capacity:2,price:10000,location:'Test'});
  assert.equal((await req('/admin/events/'+event.id,'PATCH',{title:'Poprawiony termin'})).status,200);
  assert.equal((await req('/events')).data[0].title,'Poprawiony termin');
  assert.equal((await req('/admin/events/'+event.id,'DELETE',{})).status,200);
  assert.equal((await req('/events')).data.length,0);
 }finally{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();}
});
test('only explicitly trusted proxies can supply client IP addresses',()=>{
 assert.equal(clientAddress('10.0.0.4','198.51.100.1',[]),'10.0.0.4');
 assert.equal(clientAddress('127.0.0.1','198.51.100.1',['127.0.0.1']),'198.51.100.1');
 assert.equal(clientAddress('127.0.0.1','203.0.113.8, 10.0.0.4',['127.0.0.1']),'10.0.0.4');
 assert.equal(clientAddress('127.0.0.1','not-an-ip',['127.0.0.1']),'127.0.0.1');
});

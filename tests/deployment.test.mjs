import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { importNews, provisionFirstStaff } from '../server/content.mjs';
import { hashPassword, verifyPassword } from '../server/security.mjs';

test('first staff provisioning consumes a hash without resetting an existing staff account',async()=>{
 const store=createStore(':memory:');
 const setup={name:'Właściciel',email:'owner@example.test',passwordHash:await hashPassword('private-setup-password')};
 try{
  assert.equal(provisionFirstStaff(store,setup),true);
  const owner=store.db.prepare('SELECT * FROM members WHERE email=?').get(setup.email);
  assert.equal(owner.role,'staff');
  assert.equal(await verifyPassword('private-setup-password',owner.password_hash),true);
  assert.equal(provisionFirstStaff(store,{...setup,passwordHash:'not-valid'}),false);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM members').get().n,1);
  assert.equal(store.db.prepare('SELECT password_hash FROM members WHERE id=?').get(owner.id).password_hash,setup.passwordHash);
 }finally{store.close();}
});

test('source import survives repeat startup without replacing staff edits or creating demo events',()=>{
 const store=createStore(':memory:');
 const row={id:'wp-101',slug:'oryginalny-wpis',title:'Wiadomość klubu',summary:'Opis',body:'Treść',category:'Klub',image:'/assets/range-side.webp',published_at:'2026-11-01T12:00:00Z',pinned:0};
 try{
  importNews(store,[row]);
  assert.equal(store.listNews().length,1);
  assert.equal(store.article('oryginalny-wpis').body,'Treść');
  store.db.prepare('UPDATE news SET title=? WHERE id=?').run('Poprawione przez klub','wp-101');
  importNews(store,[row]);
  assert.equal(store.listNews().length,1);
  assert.equal(store.article('oryginalny-wpis').title,'Poprawione przez klub');
  assert.equal(store.listEvents().length,0);
 }finally{store.close();}
});

test('staff can unpublish and edit migrated articles without losing long text or legacy slugs',()=>{
 const store=createStore(':memory:');
 try{
  importNews(store,[{id:'wp-legacy',slug:'wpis-z-%c5%82',title:'Archiwalny wpis',summary:'',body:'A'.repeat(34179),category:'Klub',image:'/assets/range-side.webp',published_at:'2025-01-01T12:00:00Z',pinned:0}]);
  store.updateNews('wp-legacy',{published:false});
  assert.equal(store.listNews().length,0);
  store.updateNews('wp-legacy',{title:'Poprawiony tytuł',published:true});
  const article=store.article('wpis-z-%c5%82');
  assert.equal(article.title,'Poprawiony tytuł');
  assert.equal(article.body.length,34179);
  assert.equal(article.summary,'');
  assert.throws(()=>store.updateNews('wp-legacy',{slug:'invalid slug'}),e=>e.status===400);
 }finally{store.close();}
});

test('legacy links redirect to local content and migrated PDF files keep their media type',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'skaut-archive-'));
 writeFileSync(join(dir,'index.html'),'SKAUT');
 writeFileSync(join(dir,'statut.pdf'),'%PDF-1.7\narchival document');
 const store=createStore(':memory:');
 const server=createApp({store,publicDir:dir,redirects:{'/zarzad/':'/archiwum/zarzad.html','/?page_id=50':'/archiwum/zarzad.html','/stary-plik.pdf':'/dokumenty/oświadczenie.pdf'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const path of ['/zarzad/','/zarzad','/?page_id=50']){
   const r=await fetch(origin+path,{redirect:'manual'});
   assert.equal(r.status,301,path);
   assert.equal(r.headers.get('location'),'/archiwum/zarzad.html');
  }
  const unicode=await fetch(origin+'/stary-plik.pdf',{redirect:'manual'});
  assert.equal(unicode.status,301);
  assert.equal(unicode.headers.get('location'),'/dokumenty/o%C5%9Bwiadczenie.pdf');
  const pdf=await fetch(origin+'/statut.pdf');
  assert.equal(pdf.status,200);
  assert.equal(pdf.headers.get('content-type'),'application/pdf');
  assert.equal(await pdf.text(),'%PDF-1.7\narchival document');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true});}
});

test('editing a migrated news slug keeps its immutable archive and document link',async()=>{
 const store=createStore(':memory:');
 importNews(store,[{id:'wp-1',slug:'stary-adres',title:'Artykuł',summary:'Opis',body:'Treść',category:'Klub',image:'/assets/range-side.webp',published_at:'2025-01-01T00:00:00Z'}]);
 store.updateNews('wp-1',{slug:'nowy-adres'});
 const server=createApp({store,archivePaths:{'wp-1':'/archiwum/stary-adres.html'}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/news/nowy-adres`);
  assert.equal(response.status,200);
  assert.equal((await response.json()).archive,'/archiwum/stary-adres.html');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
});

test('JSON requests preserve Polish characters split between incoming UTF-8 chunks',async()=>{
 const store=createStore(':memory:'),server=createApp({store});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  const session=await fetch(origin+'/api/session');
  const {csrf}=await session.json();
  const cookie=session.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  const payload=Buffer.from(JSON.stringify({name:'Żółć',email:'utf8@example.test',password:'test-password-1234'}));
  const split=payload.indexOf(Buffer.from('ł'))+1;
  const result=await new Promise((resolve,reject)=>{
   const req=httpRequest(origin+'/api/register',{method:'POST',headers:{origin,cookie,'x-csrf-token':csrf,'content-type':'application/json','content-length':payload.length}},res=>{
    const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
   });
   req.on('error',reject);req.write(payload.subarray(0,split));setTimeout(()=>req.end(payload.subarray(split)),20);
  });
  assert.equal(result.status,201);
  assert.equal(result.data.member.name,'Żółć');
  assert.equal(store.db.prepare('SELECT name FROM members WHERE email=?').get('utf8@example.test').name,'Żółć');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}
});

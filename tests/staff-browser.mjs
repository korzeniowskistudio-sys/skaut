import { spawn } from 'node:child_process';
import { randomBytes,randomUUID } from 'node:crypto';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { hashPassword } from '../server/security.mjs';
const store=createStore(':memory:'),password=randomBytes(24).toString('hex');
const staff=store.createMember({name:'Staff test',email:'staff@browser.example',passwordHash:await hashPassword(password),role:'staff'});
const member=store.createMember({name:'Member test',email:'member@browser.example',passwordHash:'unused'});
store.db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),member.id,member.id,'Pytanie od członka testowego',new Date().toISOString());
const server=createApp({store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const child=spawn('python3',['tests/staff_browser.py'],{stdio:'inherit',env:{...process.env,SKAUT_TEST_ORIGIN:`http://127.0.0.1:${server.address().port}`,SKAUT_TEST_EMAIL:'staff@browser.example',SKAUT_TEST_PASSWORD:password}});const code=await new Promise(r=>child.on('exit',r));if(code)process.exitCode=code;}finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();}

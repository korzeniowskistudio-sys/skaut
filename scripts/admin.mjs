import { mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { createStore } from '../server/store.mjs';
import { hashPassword } from '../server/security.mjs';
const {SKAUT_ADMIN_EMAIL:email,SKAUT_ADMIN_NAME:name,SKAUT_ADMIN_PASSWORD:password}=process.env;
if(!email||!name||!password){console.error('Set SKAUT_ADMIN_EMAIL, SKAUT_ADMIN_NAME and SKAUT_ADMIN_PASSWORD securely in the process environment.');process.exit(1);}
const path=resolve(process.env.DATABASE_PATH||'data/skaut.sqlite');mkdirSync(dirname(path),{recursive:true});const s=createStore(path);
try{s.createMember({email,name,passwordHash:await hashPassword(password),role:'staff'});console.log('Staff account created.');}catch(e){console.error(e.status?e.message:'Could not create staff account.');process.exitCode=1;}finally{s.close();}

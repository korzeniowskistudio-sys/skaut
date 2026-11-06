import { DatabaseSync,backup } from 'node:sqlite';
import { mkdirSync,chmodSync } from 'node:fs';
import { resolve } from 'node:path';
const input=resolve(process.env.DATABASE_PATH||'data/skaut.sqlite');
mkdirSync('backups',{recursive:true,mode:0o700});const output=resolve('backups',`skaut-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const db=new DatabaseSync(input,{readOnly:true});try{await backup(db,output);chmodSync(output,0o600);console.log('Consistent SQL backup created in backups/.');}finally{db.close();}

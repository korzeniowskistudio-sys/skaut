import { mkdirSync,readFileSync,existsSync,unlinkSync,writeFileSync } from 'node:fs';
import { resolve,dirname,join } from 'node:path';
import { backup } from 'node:sqlite';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { seedDemo } from './seed.mjs';
import { importNews,provisionFirstStaff } from './content.mjs';
const demoMode=process.env.DEMO_MODE==='1';
if(demoMode&&process.env.NODE_ENV==='production')throw new Error('Demo mode is forbidden in production.');
const dbPath=resolve(process.env.DATABASE_PATH||(demoMode?'data/demo.sqlite':'data/skaut.sqlite'));mkdirSync(dirname(dbPath),{recursive:true});
const store=createStore(dbPath);if(demoMode)await seedDemo(store);
const prod=process.env.NODE_ENV==='production';if(prod&&!process.env.APP_ORIGIN?.startsWith('https://'))throw new Error('Production requires an HTTPS APP_ORIGIN.');
const sourceNews=new URL('../content/news.json',import.meta.url),sourceRedirects=new URL('../content/redirects.json',import.meta.url);
const importedNews=existsSync(sourceNews)?JSON.parse(readFileSync(sourceNews,'utf8')):[];
if(!demoMode)importNews(store,importedNews);
const archivePaths=Object.fromEntries(importedNews.map(n=>[n.id,n.archive]));
const redirects=existsSync(sourceRedirects)?JSON.parse(readFileSync(sourceRedirects,'utf8')):{};
if(prod){
 const privateDir=dirname(dbPath),setupFile=join(privateDir,'first-admin.json');
 if(existsSync(setupFile)){
  provisionFirstStaff(store,JSON.parse(readFileSync(setupFile,'utf8')));
  unlinkSync(setupFile);
 }
 const backupDir=join(privateDir,'backups');mkdirSync(backupDir,{recursive:true,mode:0o700});
 const snapshot=join(backupDir,'startup-'+new Date().toISOString().slice(0,10)+'.sqlite');
 if(!existsSync(snapshot))await backup(store.db,snapshot);
 const counts=Object.fromEntries(['members','events','orders','bookings','messages','achievements','news'].map(t=>[t,store.db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n]));
 writeFileSync(join(privateDir,'startup-report.json'),JSON.stringify({startedAt:new Date().toISOString(),pid:process.pid,integrity:store.db.prepare('PRAGMA integrity_check').get(),counts,snapshot},null,2),{mode:0o600});
}
const args=process.argv.slice(2);const flag=n=>args[args.indexOf(n)+1];
const port=Number(process.env.PORT||(args.includes('--port')?flag('--port'):4173));
const host=process.env.HOST||(args.includes('--host')?flag('--host'):'127.0.0.1');
const server=createApp({store,demoMode,redirects,archivePaths,publicDir:process.env.PUBLIC_DIR||undefined,appOrigin:process.env.APP_ORIGIN||'',secureCookies:prod,trustedProxies:(process.env.TRUSTED_PROXY_IPS||'').split(',').map(x=>x.trim()).filter(Boolean)});
server.listen(port,host,()=>console.log(`SKAUT running on ${host}:${port} (${demoMode?'demonstration':'live data mode'})`));
const shutdown=()=>server.close(()=>{store.close();process.exit(0);});process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

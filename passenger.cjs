// CommonJS entry point for IQHost's Passenger loader; the application remains ESM.
// Keep SQLite, its WAL/SHM files and backups readable only by the hosting user.
process.umask(0o077);
const fs=require('node:fs'),path=require('node:path');
const publicDir=path.resolve(__dirname,'../domains/skaut.korzeniowski.net/public_html');
const passengerPublic=path.join(__dirname,'public');
// CloudLinux also serves static files directly from AppRoot/public. Keep that
// path and the domain document root identical, preserving the initial directory
// for rollback. Only this isolated SKAUT app is affected.
let publicStat;
try{publicStat=fs.lstatSync(passengerPublic);}catch(error){if(error.code!=='ENOENT')throw error;}
if(publicStat?.isSymbolicLink()) {
  if(fs.realpathSync(passengerPublic)!==fs.realpathSync(publicDir))throw new Error('Unexpected SKAUT public symlink.');
}else{
  if(!fs.statSync(publicDir).isDirectory())throw new Error('SKAUT domain document root is missing.');
  if(publicStat)fs.renameSync(passengerPublic,path.join(__dirname,'public-before-domain-link-'+Date.now()));
  fs.symlinkSync(publicDir,passengerPublic,'dir');
}
process.env.PUBLIC_DIR ||= publicDir;
import('./server/start.mjs').catch(error => {
  console.error('SKAUT startup failed:', error.message);
  process.exit(1);
});

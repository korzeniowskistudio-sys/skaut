import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { isIP } from 'node:net';
import { problem } from './store.mjs';
const derive=promisify(scrypt);
export async function hashPassword(password) {
 if(typeof password!=='string'||password.length<12||password.length>200)throw problem(400,'Hasło musi mieć od 12 do 200 znaków.');
 const salt=randomBytes(16).toString('hex'),key=await derive(password,salt,64);
 return salt+':'+key.toString('hex');
}
export async function verifyPassword(password,hash) {
 if(typeof password!=='string'||password.length>200)return false;
 const [salt,key]=hash.split(':'),derived=await derive(password,salt,64),expected=Buffer.from(key,'hex');
 return expected.length===derived.length&&timingSafeEqual(expected,derived);
}
export const token=()=>randomBytes(32).toString('hex');
export const digest=t=>createHash('sha256').update(t).digest('hex');
export function clientAddress(remoteAddress,forwardedFor,trustedProxies=[]) {
 const normalize=x=>String(x||'').replace(/^::ffff:/,'');
 const trusted=new Set(trustedProxies.map(normalize));let client=normalize(remoteAddress);
 if(!trusted.has(client)||typeof forwardedFor!=='string')return client;
 const chain=forwardedFor.split(',').map(x=>normalize(x.trim()));
 if(chain.length>20||chain.some(x=>!isIP(x)))return client;
 for(let i=chain.length-1;i>=0&&trusted.has(client);i--)client=chain[i];
 return client;
}

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { problem,text,now } from './store.mjs';
import { hashPassword,verifyPassword,token,digest,clientAddress } from './security.mjs';

export function createApp({store:s,demoMode=false,publicDir=fileURLToPath(new URL('../public/',import.meta.url)),appOrigin='',secureCookies=false,trustedProxies=[]}) {
 const attempts=new Map();
 const cookie=(name,value,maxAge=86400)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies?'; Secure':''}`;
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; font-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
   const url=new URL(req.url,'http://local'),path=url.pathname;
   const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split('=')).filter(p=>p.length===2));
   const session=cookies.skaut_session?s.db.prepare('SELECT s.*,m.name,m.email,m.role FROM sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(cookies.skaut_session),now()):null;
   const member=session?{id:session.member_id,name:session.name,email:session.email,role:session.role}:null;
   const auth=()=>{if(!member)throw problem(401,'Zaloguj się, aby kontynuować.');return member;};
   const staff=()=>{auth();if(member.role!=='staff')throw problem(403,'Ta funkcja jest dostępna dla obsługi klubu.');};
   const issue=m=>{
    const raw=token(),csrf=token();s.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());
    if(cookies.skaut_session)s.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(cookies.skaut_session));
    s.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw),m.id,csrf,new Date(Date.now()+86400000).toISOString());
    res.setHeader('Set-Cookie',[cookie('skaut_session',raw),cookie('skaut_csrf',csrf)]);return csrf;
   };
   if(path.startsWith('/api/')) {
    if(req.method==='GET'&&path==='/api/session') {
     const csrf=session?.csrf||cookies.skaut_csrf||token();if(!session&&!cookies.skaut_csrf)res.setHeader('Set-Cookie',cookie('skaut_csrf',csrf));
     return json(200,{member,csrf,demoMode,paymentMode:'manual'});
    }
    let body={};
    if(!['GET','HEAD'].includes(req.method)) {
     const expectedOrigin=appOrigin||`http://${req.headers.host}`;
     if(req.headers.origin!==expectedOrigin||!cookies.skaut_csrf||req.headers['x-csrf-token']!==(session?.csrf||cookies.skaut_csrf))throw problem(403,'Odśwież stronę i spróbuj ponownie.');
     if(!(req.headers['content-type']||'').startsWith('application/json'))throw problem(415,'Wymagany format JSON.');
     let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>40000)throw problem(413,'Wiadomość jest zbyt długa.');}
     try{body=raw?JSON.parse(raw):{};}catch{throw problem(400,'Niepoprawne dane.');}
     if(body===null||Array.isArray(body)||typeof body!=='object')throw problem(400,'Niepoprawne dane.');
     const rateKey=clientAddress(req.socket.remoteAddress,req.headers['x-forwarded-for'],trustedProxies)+':'+(path.startsWith('/api/login')||path.startsWith('/api/register')?'auth':'write');
     const t=Date.now(),prior=attempts.get(rateKey),rate=prior&&prior.until>t?prior:{count:0,until:t+900000};rate.count++;attempts.set(rateKey,rate);
     if(attempts.size>10000)for(const[k,v]of attempts)if(v.until<t)attempts.delete(k);
     if(rate.count>(rateKey.endsWith(':auth')?20:200))throw problem(429,'Zbyt wiele prób. Spróbuj później.');
    }
    if(req.method==='POST'&&path==='/api/register') {
     const hash=await hashPassword(body.password),m=s.createMember({name:body.name,email:body.email,passwordHash:hash});return json(201,{member:m,csrf:issue(m)});
    }
    if(req.method==='POST'&&path==='/api/login') {
     const email=text(body.email,254).toLowerCase(),m=s.db.prepare('SELECT * FROM members WHERE email=?').get(email);
     // A missing account takes the same expensive hash path as a bad password.
     const valid=await verifyPassword(body.password,m?.password_hash||await hashPassword('dummy-password-for-timing'));
     if(!m||!valid)throw problem(401,'Nieprawidłowy e-mail lub hasło.');
     return json(200,{member:{id:m.id,name:m.name,email:m.email,role:m.role},csrf:issue(m)});
    }
    if(req.method==='POST'&&path==='/api/logout') {
     if(cookies.skaut_session)s.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(cookies.skaut_session));
     res.setHeader('Set-Cookie',[cookie('skaut_session','',0),cookie('skaut_csrf','',0)]);return json(200,{ok:true});
    }
    if(req.method==='POST'&&path==='/api/demo'&&demoMode) {
     const m=s.db.prepare("SELECT id,name,email,role FROM members WHERE email='demo@skaut.example'").get();if(!m)throw problem(503,'Konto demonstracyjne nie jest przygotowane.');
     return json(200,{member:m,csrf:issue(m)});
    }
    if(req.method==='GET'&&path==='/api/events')return json(200,s.listEvents().filter(e=>(!url.searchParams.get('type')||e.type===url.searchParams.get('type'))&&(!url.searchParams.get('date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw'}).format(new Date(e.startsAt))===url.searchParams.get('date'))));
    if(req.method==='GET'&&path==='/api/news')return json(200,s.listNews());
    if(req.method==='GET'&&path.startsWith('/api/news/')){const article=s.article(decodeURIComponent(path.slice(10)));if(!article)throw problem(404,'Nie znaleziono artykułu.');return json(200,article);}
    if(req.method==='GET'&&path==='/api/me'){auth();return json(200,{member,...s.memberOverview(member.id)});}
    if(req.method==='POST'&&path==='/api/checkout'){auth();return json(201,s.checkout(member.id,body.events,body.key));}
    if(req.method==='DELETE'&&path.startsWith('/api/bookings/')){auth();s.cancelBooking(member.id,path.slice(14));return json(200,{ok:true});}
    if(req.method==='POST'&&path==='/api/messages') {
     auth();const id=randomUUID();s.db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(id,member.id,member.id,text(body.body,4000),now());return json(201,{id});
    }
    if(path.startsWith('/api/admin/')) {
     staff();
     if(req.method==='GET'&&path==='/api/admin/overview')return json(200,{members:s.db.prepare('SELECT id,name,email,role FROM members ORDER BY name').all(),news:s.db.prepare('SELECT * FROM news ORDER BY published_at DESC').all(),events:s.db.prepare('SELECT * FROM events ORDER BY starts_at DESC').all(),messages:s.db.prepare('SELECT m.*,u.name AS member_name,m.sender_id=m.member_id AS fromMember FROM messages m JOIN members u ON u.id=m.member_id ORDER BY m.created_at').all(),bookings:s.db.prepare('SELECT b.*,m.name,e.title,e.starts_at AS startsAt FROM bookings b JOIN members m ON m.id=b.member_id JOIN events e ON e.id=b.event_id ORDER BY e.starts_at').all()});
     if(req.method==='POST'&&path==='/api/admin/events')return json(201,s.createEvent(body));
     if(req.method==='POST'&&path==='/api/admin/news')return json(201,s.createNews(body));
     if(req.method==='PATCH'&&path.startsWith('/api/admin/news/'))return json(200,s.updateNews(path.slice(16),body));
     if(req.method==='PATCH'&&path.startsWith('/api/admin/events/'))return json(200,s.updateEvent(path.slice(18),body,member.id));
     if(req.method==='DELETE'&&path.startsWith('/api/admin/events/'))return json(200,s.cancelEvent(path.slice(18),member.id));
     if(req.method==='POST'&&path==='/api/admin/confirm') {
      s.expire();const order=s.db.prepare('SELECT * FROM orders WHERE id=?').get(body.orderId);if(!order||order.status!=='awaiting_confirmation')throw problem(409,'Zamówienie nie oczekuje na potwierdzenie.');
      s.db.exec('BEGIN IMMEDIATE');try{s.db.prepare("UPDATE orders SET status='confirmed' WHERE id=?").run(order.id);s.db.prepare("UPDATE bookings SET status='confirmed' WHERE order_id=? AND status='pending'").run(order.id);s.db.exec('COMMIT');}catch(e){s.db.exec('ROLLBACK');throw e;}return json(200,{ok:true});
     }
     if(req.method==='POST'&&path==='/api/admin/achievement') {
      const target=s.db.prepare('SELECT id FROM members WHERE id=?').get(body.memberId);if(!target)throw problem(404,'Nie znaleziono konta.');
      if(!Number.isInteger(body.progress)||body.progress<0||body.progress>100)throw problem(400,'Postęp musi wynosić od 0 do 100.');
      const title=text(body.title,160),current=s.db.prepare('SELECT id FROM achievements WHERE member_id=? AND title=?').get(target.id,title);
      if(current)s.db.prepare('UPDATE achievements SET progress=?,description=?,verified_by=?,updated_at=? WHERE id=?').run(body.progress,typeof body.description==='string'?body.description.slice(0,1000):'',member.id,now(),current.id);
      else s.db.prepare('INSERT INTO achievements VALUES(?,?,?,?,?,?,?)').run(randomUUID(),target.id,title,typeof body.description==='string'?body.description.slice(0,1000):'',body.progress,member.id,now());return json(201,{ok:true});
     }
     if(req.method==='POST'&&path==='/api/admin/message') {
      if(!s.db.prepare('SELECT id FROM members WHERE id=?').get(body.memberId))throw problem(404,'Nie znaleziono konta.');
      s.db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),body.memberId,member.id,text(body.body,4000),now());return json(201,{ok:true});
     }
    }
    throw problem(404,'Nie znaleziono tej funkcji.');
   }
   if(!['GET','HEAD'].includes(req.method))throw problem(405,'Niedozwolona metoda.');
   const decoded=decodeURIComponent(path);if(decoded.split('/').some(p=>p.startsWith('.')))throw problem(404,'Nie znaleziono strony.');
   const isFile=Boolean(extname(decoded)),file=resolve(publicDir,isFile?'.'+decoded:'index.html');
   if(!file.startsWith(resolve(publicDir)+sep))throw problem(404,'Nie znaleziono strony.');
   const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
   if(!types[extname(file)])throw problem(404,'Nie znaleziono pliku.');
   let data;try{data=await readFile(file);}catch{throw problem(404,'Nie znaleziono pliku.');}
   res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':isFile?'public, max-age=3600':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(!res.headersSent)json(e.status||500,{error:e.status?e.message:'Wystąpił błąd serwera. Spróbuj ponownie.',code:e.code||'SERVER_ERROR'});else res.end();if(!e.status)console.error('Request failed:',e.message);}
 });
}

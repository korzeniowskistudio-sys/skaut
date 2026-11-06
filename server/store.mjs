import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export function problem(status,message,code='INVALID') { return Object.assign(new Error(message),{status,code}); }
export const now=()=>new Date().toISOString();
export function text(value,max=200) { if(typeof value!=='string'||!value.trim()||value.length>max) throw problem(400,'Uzupełnij poprawnie wszystkie wymagane pola.');return value.trim(); }
export function createStore(path) {
 const db=new DatabaseSync(path);db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const s={db,close:()=>db.close()};
 s.createMember=({name,email,passwordHash,role='member'})=>{
  name=text(name,100);email=text(email,254).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw problem(400,'Podaj poprawny adres e-mail.');
  const id=randomUUID();
  try{db.prepare('INSERT INTO members(id,name,email,password_hash,role) VALUES(?,?,?,?,?)').run(id,name,email,passwordHash,role);}catch(e){if(String(e).includes('UNIQUE'))throw problem(409,'Nie można utworzyć konta z tym adresem.');throw e;}
  return {id,name,email,role};
 };
 s.createEvent=(e)=>{
  const id=randomUUID(),title=text(e.title,160),type=text(e.type,40),location=text(e.location,200),date=new Date(e.startsAt);
  if(!Number.isFinite(date.getTime())||!Number.isInteger(e.capacity)||e.capacity<1||e.capacity>1000||!Number.isSafeInteger(e.price)||e.price<0||e.price>10000000)throw problem(400,'Sprawdź termin, liczbę miejsc i cenę.');
  db.prepare('INSERT INTO events(id,title,type,starts_at,capacity,price,location,description) VALUES(?,?,?,?,?,?,?,?)').run(id,title,type,date.toISOString(),e.capacity,e.price,location,typeof e.description==='string'?e.description.slice(0,10000):'');
  return {id,title,type,startsAt:date.toISOString(),capacity:e.capacity,price:e.price,location};
 };
 s.expire=()=>{
  db.prepare("UPDATE bookings SET status='expired' WHERE status='pending' AND hold_until < ?").run(now());
  db.exec("UPDATE orders SET status='expired' WHERE status='awaiting_confirmation' AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.order_id=orders.id AND b.status IN ('pending','confirmed'))");
  db.exec("UPDATE orders SET total=COALESCE((SELECT sum(b.price) FROM bookings b WHERE b.order_id=orders.id AND b.status IN ('pending','confirmed')),0) WHERE status IN ('awaiting_confirmation','expired')");
 };
 s.listEvents=()=>{s.expire();return db.prepare("SELECT e.*, e.starts_at AS startsAt, e.capacity-(SELECT count(*) FROM bookings b WHERE b.event_id=e.id AND b.status IN ('pending','confirmed')) AS available FROM events e WHERE e.published=1 AND e.starts_at > ? ORDER BY e.starts_at").all(now());};
 s.checkout=(memberId,eventIds,key)=>{
  if(!Array.isArray(eventIds)||eventIds.length<1||eventIds.length>10||eventIds.some(x=>typeof x!=='string')||new Set(eventIds).size!==eventIds.length)throw problem(400,'Koszyk musi zawierać od 1 do 10 różnych wydarzeń.');
  text(key,100);if(key.length<12)throw problem(400,'Nieprawidłowy identyfikator zamówienia.');
  const fingerprint=[...eventIds].sort().join('|');s.expire();db.exec('BEGIN IMMEDIATE');
  try{
   const previous=db.prepare('SELECT * FROM orders WHERE member_id=? AND idempotency_key=?').get(memberId,key);
   if(previous){if(previous.fingerprint!==fingerprint)throw problem(409,'Zmieniono koszyk. Spróbuj ponownie.');db.exec('COMMIT');return previous;}
   const events=eventIds.map(id=>{
    const e=db.prepare('SELECT * FROM events WHERE id=? AND published=1').get(id);if(!e)throw problem(404,'Wydarzenie nie jest dostępne.');
    if(e.starts_at<=now())throw problem(409,'Zapisy na to wydarzenie zostały zamknięte.');
    const active=db.prepare("SELECT member_id FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')").all(id);
    if(active.some(b=>b.member_id===memberId))throw problem(409,'Masz już rezerwację na to wydarzenie.','ALREADY_BOOKED');
    if(active.length>=e.capacity)throw problem(409,'Ostatnie miejsce zostało już zarezerwowane.','SOLD_OUT');return e;
   });
   const order={id:randomUUID(),member_id:memberId,total:events.reduce((v,e)=>v+e.price,0),status:'awaiting_confirmation',created_at:now()};
   db.prepare('INSERT INTO orders(id,member_id,total,status,idempotency_key,fingerprint,created_at) VALUES(?,?,?,?,?,?,?)').run(order.id,memberId,order.total,order.status,key,fingerprint,order.created_at);
   const until=new Date(Date.now()+48*3600000).toISOString();
   for(const e of events)db.prepare("INSERT INTO bookings(id,order_id,member_id,event_id,price,status,hold_until) VALUES(?,?,?,?,?,'pending',?)").run(randomUUID(),order.id,memberId,e.id,e.price,until);
   db.exec('COMMIT');return order;
  }catch(e){db.exec('ROLLBACK');throw e;}
 };
 s.getOrder=(memberId,id)=>db.prepare('SELECT * FROM orders WHERE id=? AND member_id=?').get(id,memberId);
 s.memberOverview=(memberId)=>{
  s.expire();return {
   bookings:db.prepare('SELECT b.*,e.title,e.starts_at AS startsAt,e.location,e.type FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.member_id=? ORDER BY e.starts_at DESC').all(memberId),
   achievements:db.prepare('SELECT id,title,description,progress,updated_at,verified_by IS NOT NULL AS verified FROM achievements WHERE member_id=? ORDER BY updated_at DESC').all(memberId),
   messages:db.prepare('SELECT m.id,m.body,m.created_at,m.sender_id, m.sender_id=m.member_id AS fromMember FROM messages m WHERE m.member_id=? ORDER BY m.created_at').all(memberId),
   orders:db.prepare('SELECT id,total,status,created_at FROM orders WHERE member_id=? ORDER BY created_at DESC').all(memberId)
  };
 };
 s.cancelBooking=(memberId,id)=>{
  db.exec('BEGIN IMMEDIATE');try{
  const b=db.prepare('SELECT b.*,e.starts_at FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=? AND b.member_id=?').get(id,memberId);
  if(!b)throw problem(404,'Nie znaleziono rezerwacji.');
  if(b.status==='confirmed')throw problem(409,'Aby anulować potwierdzoną rezerwację, napisz do klubu.');
  if(b.starts_at<=now())throw problem(409,'Wydarzenie już się rozpoczęło.');
  db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='pending'").run(id);
  db.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND NOT EXISTS(SELECT 1 FROM bookings WHERE order_id=? AND status IN ('pending','confirmed'))").run(b.order_id,b.order_id);
  db.prepare("UPDATE orders SET total=COALESCE((SELECT sum(price) FROM bookings WHERE order_id=? AND status IN ('pending','confirmed')),0) WHERE id=?").run(b.order_id,b.order_id);
  db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 };
 s.updateEvent=(id,changes,staffId)=>{
  db.exec('BEGIN IMMEDIATE');try{
   const old=db.prepare('SELECT * FROM events WHERE id=?').get(id);if(!old)throw problem(404,'Nie znaleziono wydarzenia.');if(!old.published)throw problem(409,'Odwołanego wydarzenia nie można edytować.');
   const e={title:old.title,type:old.type,startsAt:old.starts_at,capacity:old.capacity,price:old.price,location:old.location,description:old.description,...changes};
   const title=text(e.title,160),type=text(e.type,40),location=text(e.location,200),date=new Date(e.startsAt);
   if(!Number.isFinite(date.getTime())||!Number.isInteger(e.capacity)||e.capacity<1||e.capacity>1000||!Number.isSafeInteger(e.price)||e.price<0||e.price>10000000)throw problem(400,'Sprawdź termin, liczbę miejsc i cenę.');
   const members=db.prepare("SELECT member_id FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')").all(id);if(e.capacity<members.length)throw problem(409,'Liczba miejsc jest mniejsza niż liczba aktywnych rezerwacji.');
   db.prepare('UPDATE events SET title=?,type=?,starts_at=?,capacity=?,price=?,location=?,description=? WHERE id=?').run(title,type,date.toISOString(),e.capacity,e.price,location,typeof e.description==='string'?e.description.slice(0,10000):'',id);
   if(title!==old.title||date.toISOString()!==old.starts_at||location!==old.location)for(const m of members)db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),m.member_id,staffId,`Zmieniono szczegóły wydarzenia „${title}”. Sprawdź aktualny termin i miejsce w harmonogramie. Cena Twojej dotychczasowej rezerwacji pozostaje bez zmian.`,now());
   db.exec('COMMIT');return {id};
  }catch(e){db.exec('ROLLBACK');throw e;}
 };
 s.cancelEvent=(id,staffId)=>{
  db.exec('BEGIN IMMEDIATE');try{
   const event=db.prepare('SELECT * FROM events WHERE id=?').get(id);if(!event)throw problem(404,'Nie znaleziono wydarzenia.');
   const bookings=db.prepare("SELECT * FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')").all(id);
   db.prepare('UPDATE events SET published=0 WHERE id=?').run(id);db.prepare("UPDATE bookings SET status='cancelled' WHERE event_id=? AND status IN ('pending','confirmed')").run(id);
   for(const b of bookings){db.prepare("UPDATE orders SET total=COALESCE((SELECT sum(price) FROM bookings WHERE order_id=? AND status IN ('pending','confirmed')),0),status=CASE WHEN EXISTS(SELECT 1 FROM bookings WHERE order_id=? AND status IN ('pending','confirmed')) THEN status ELSE 'cancelled' END WHERE id=?").run(b.order_id,b.order_id,b.order_id);db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),b.member_id,staffId,`Wydarzenie „${event.title}” zostało odwołane. Rezerwację anulowano. Jeżeli płatność została dokonana poza serwisem, skontaktuj się z klubem w sprawie rozliczenia. System nie realizuje automatycznego zwrotu.`,now());}
   db.exec('COMMIT');return {id};
  }catch(e){db.exec('ROLLBACK');throw e;}
 };
 s.listNews=()=>db.prepare('SELECT id,slug,title,summary,category,image,published_at,pinned FROM news WHERE published=1 AND published_at<=? ORDER BY pinned DESC,published_at DESC').all(now());
 s.article=slug=>db.prepare('SELECT * FROM news WHERE slug=? AND published=1 AND published_at<=?').get(slug,now());
 s.createNews=n=>{
  const id=randomUUID(),slug=text(n.slug,160);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw problem(400,'Adres artykułu może zawierać małe litery, cyfry i myślniki.');
  const date=new Date(n.publishedAt||Date.now());if(!Number.isFinite(date.getTime()))throw problem(400,'Nieprawidłowa data.');
  try{db.prepare('INSERT INTO news(id,slug,title,summary,body,category,image,published_at,published,pinned) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,slug,text(n.title,160),text(n.summary,400),text(n.body,30000),text(n.category,80),'/assets/range-side.webp',date.toISOString(),n.published?1:0,n.pinned?1:0);}catch(e){if(String(e).includes('UNIQUE'))throw problem(409,'Ten adres artykułu już istnieje.');throw e;}return {id,slug};
 };
 s.updateNews=(id,changes)=>{
  const old=db.prepare('SELECT * FROM news WHERE id=?').get(id);if(!old)throw problem(404,'Nie znaleziono artykułu.');
  const n={...old,publishedAt:old.published_at,...changes},slug=text(n.slug,160),date=new Date(n.publishedAt);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!Number.isFinite(date.getTime()))throw problem(400,'Sprawdź adres i datę publikacji.');
  try{db.prepare('UPDATE news SET slug=?,title=?,summary=?,body=?,category=?,published_at=?,published=?,pinned=? WHERE id=?').run(slug,text(n.title,160),text(n.summary,400),text(n.body,30000),text(n.category,80),date.toISOString(),n.published?1:0,n.pinned?1:0,id);}catch(e){if(String(e).includes('UNIQUE'))throw problem(409,'Ten adres artykułu już istnieje.');throw e;}return {id,slug};
 };
 return s;
}

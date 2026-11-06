import { randomUUID } from 'node:crypto';
import { hashPassword,token } from './security.mjs';
import { now } from './store.mjs';
export async function seedDemo(s) {
 if(s.db.prepare("SELECT id FROM members WHERE email='demo@skaut.example'").get())return;
 const m=s.createMember({name:'Aleksandra — konto demo',email:'demo@skaut.example',passwordHash:await hashPassword(token())});
 const staff=s.createMember({name:'Instruktor — demo',email:'staff@skaut.example',passwordHash:await hashPassword(token()),role:'staff'});
 const days=[2,4,7,9];const kinds=['pistolet','karabin','pierwszy-raz','zawody'];
 const titles=['Pistolet — trening techniczny','Karabin — celność i skupienie','Pierwszy raz na strzelnicy','Zawody klubowe — przykład'];
 const events=days.map((d,i)=>s.createEvent({title:titles[i],type:kinds[i],startsAt:new Date(Date.now()+d*86400000).toISOString(),capacity:i===0?8:12,price:[12000,16000,18000,8000][i],location:'Przykładowa strzelnica — dane demo',description:'Przykładowe wydarzenie do sprawdzenia rezerwacji. Termin, cena i miejsce nie są ofertą klubu.'}));
 const order=s.checkout(m.id,[events[1].id],'demo-initial-order');s.db.prepare("UPDATE orders SET status='confirmed' WHERE id=?").run(order.id);s.db.prepare("UPDATE bookings SET status='confirmed' WHERE order_id=?").run(order.id);
 for(const [title,p]of [['Podstawy bezpieczeństwa',100],['Regularność treningów',60],['Precyzja i skupienie',35]])s.db.prepare('INSERT INTO achievements VALUES(?,?,?,?,?,?,?)').run(randomUUID(),m.id,title,'Przykładowy etap rozwoju — nie jest oficjalną kwalifikacją.',p,staff.id,now());
 s.db.prepare('INSERT INTO messages(id,member_id,sender_id,body,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),m.id,staff.id,'Witaj w demonstracyjnym panelu Mój SKAUT. Możesz sprawdzić postępy, terminy i rezerwację. Wszystkie dane w tej wersji są przykładowe.',now());
 for(const [slug,title,category,summary]of [['z-zycia-klubu','Skupienie zaczyna się tutaj','Życie klubu','Poznaj sposób prezentacji aktualności i informacji klubowych.'],['trening-to-proces','Każdy trening to kolejny krok','Treningi','Miejsce na relacje z treningów i materiały dla członków.'],['na-linii-startu','Na linii startu','Zawody i wyniki','Wyniki, relacje i zapowiedzi w jednym miejscu.']])s.createNews({slug,title,category,summary,body:'To artykuł demonstracyjny, przygotowany wyłącznie do prezentacji projektu.\n\nW tym miejscu znajdą się zweryfikowane treści przeniesione z ksskaut.pl. Obecny materiał nie opisuje rzeczywistych wydarzeń ani oferty klubu.',published:true});
}

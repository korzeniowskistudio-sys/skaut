export function importNews(store,rows) {
 const insert=store.db.prepare('INSERT INTO news(id,slug,title,summary,body,category,image,published_at,published,pinned) VALUES(?,?,?,?,?,?,?,?,1,?) ON CONFLICT DO NOTHING');
 store.db.exec('BEGIN IMMEDIATE');
 try{
  for(const n of rows)insert.run(n.id,n.slug,n.title,n.summary,n.body,n.category,n.image,n.published_at,n.pinned?1:0);
  store.db.exec('COMMIT');
 }catch(error){store.db.exec('ROLLBACK');throw error;}
}

// Accept only a precomputed password hash from the owner's private setup file.
// Repeated starts must never reset passwords or promote existing member accounts.
export function provisionFirstStaff(store,setup) {
 store.db.exec('BEGIN IMMEDIATE');
 try{
  if(store.db.prepare("SELECT count(*) AS n FROM members WHERE role='staff'").get().n){store.db.exec('COMMIT');return false;}
  if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(setup.passwordHash))throw new Error('Invalid first-staff password hash.');
  store.createMember({...setup,role:'staff'});
  store.db.exec('COMMIT');return true;
 }catch(error){store.db.exec('ROLLBACK');throw error;}
}

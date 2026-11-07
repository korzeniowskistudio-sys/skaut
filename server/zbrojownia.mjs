// Read the public event grid only. Zbrojownia owns inventory, checkout and accounts.
export const BOOKING_ORIGIN = 'https://www.zbrojownia.ksskaut.pl';
const MAX_BYTES = 750_000;
const FRESH_MS = 5 * 60_000;
const STALE_MS = 30 * 60_000;
const RETRY_MS = 30_000;
const warsaw = new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/Warsaw', year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});
const parts = ms => Object.fromEntries(warsaw.formatToParts(ms).map(p=>[p.type,p.value]));
const dayOf = ms => {const {year,month,day}=parts(ms);return year+'-'+month+'-'+day;};
const textEntities = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ndash:'–',mdash:'—',hellip:'…',laquo:'«',raquo:'»'};

function plain(html,limit=240) {
  return html.replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(_,entity)=>{
    if(entity[0]!=='#')return Object.hasOwn(textEntities,entity)?textEntities[entity]:' ';
    const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
    return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):' ';
  }).replace(/[\s\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]+/g,' ').trim().slice(0,limit);
}

function attribute(tag,name) {
  return tag.match(new RegExp('\\s'+name+'\\s*=\\s*(?:"([^"]*)"|\\x27([^\\x27]*)\\x27)','i'))?.slice(1).find(value=>value!==undefined)||'';
}

function tagBlock(html,tag,className) {
  return html.match(new RegExp('<'+tag+'\\b[^>]*\\bclass\\s*=\\s*(["\\x27])[^"\\x27]*\\b'+className+'\\b[^"\\x27]*\\1[^>]*>([\\s\\S]*?)</'+tag+'>','i'))?.[2]||'';
}

function typeFor(title,category) {
  const categories=category.split(/(?:^|-) /).map(value=>value.trim().toLowerCase());
  if(/^zawody\b/i.test(title)||categories.includes('zawody')&&!/\btrening\b/i.test(title))return 'zawody';
  if(/pierwszy raz|dla początkujących/i.test(title))return 'pierwszy-raz';
  if(/szkoleni|kurs/i.test(title)||categories.includes('szkolenia'))return 'szkolenia';
  if(/karabin|rifle|\bpcc\b|long range/i.test(title))return 'karabin';
  if(/strzelb|shotgun|\btrap\b|popper/i.test(title))return 'strzelba';
  if(/pistolet|\bpsp\b/i.test(title))return 'pistolet';
  if(/\bipsc\b/i.test(title)||categories.includes('ipsc'))return 'ipsc';
  return 'inne';
}

function startsAt(day,hours) {
  if(!hours)return day+'T12:00:00.000Z'; // Date-only events never display a made-up time.
  const guess=Date.parse(day+'T'+hours+':00.000Z');
  const local=parts(guess);
  const seen=Date.parse(local.year+'-'+local.month+'-'+local.day+'T'+local.hour+':'+local.minute+':00.000Z');
  return new Date(guess+(guess-seen)).toISOString();
}

export function parseSchedule(html,now=Date.now()) {
  const source=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  const cards=[...source.matchAll(/<div\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)].filter(match=>
    attribute(match[0],'class').split(/\s+/).includes('mep-event-list-loop'));
  if(!cards.length)throw new Error('Public event grid unavailable');
  const today=dayOf(now);
  const events=new Map();
  for(let i=0;i<cards.length;i++){
    const {0:tag,index}=cards[i];
    const day=attribute(tag,'data-date');
    const validDay=/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
    if(!validDay||day<today)continue;
    const category=plain(attribute(tag,'data-category'));
    const title=plain(attribute(tag,'data-title'));
    if(!title||/zabezpieczone:|chronione:|protected:|dopłaty dodatkowe/i.test(title)||/zawody\s*-\s*obsługa/i.test(category))continue;
    const details=source.slice(index+tag.length,cards[i+1]?.index||source.length).split(/<div\b[^>]*\bmep_list_event_details\b[^>]*>/i)[1]||'';
    const anchor=details.match(/<a\b[^>]*>/i)?.[0]||'';
    const bookingUrl=attribute(anchor,'href');
    if(!bookingUrl.startsWith(BOOKING_ORIGIN+'/events/'))continue;
    const slug=bookingUrl.slice((BOOKING_ORIGIN+'/events/').length).match(/^([a-z0-9][a-z0-9-]{0,220})\/?$/)?.[1];
    if(!slug||/^(?:cegielki|doplata|doplaty|obsluga)(?:-|$)/.test(slug)||events.has(slug))continue;
    const locationBlock=tagBlock(details,'li','mep_list_location_name');
    const location=plain(locationBlock.match(/<h6\b[^>]*>([\s\S]*?)<\/h6>/i)?.[1]||attribute(tag,'data-city-name'));
    const timeBlock=tagBlock(details,'li','mep_list_event_date');
    const startTime=plain(timeBlock).match(/(?<![\d:])((?:[01]\d|2[0-3]):[0-5]\d)(?![\d:])/)?.[1]||null;
    events.set(slug,{id:'zbrojownia:'+slug,title,type:typeFor(title,category),location,day,startTime,
      startsAt:startsAt(day,startTime),bookingUrl:BOOKING_ORIGIN+'/events/'+slug+'/'});
  }
  return [...events.values()].sort((a,b)=>a.day.localeCompare(b.day)||(a.startTime||'99').localeCompare(b.startTime||'99'));
}

async function readSchedule(fetcher,clock){
  const response=await fetcher(BOOKING_ORIGIN+'/',{
    redirect:'error',signal:AbortSignal.timeout(8000),
    headers:{Accept:'text/html','User-Agent':'SKAUT schedule integration (+https://skaut.korzeniowski.net/)'},
  });
  if(!response.ok||!response.body||!response.headers.get('content-type')?.startsWith('text/html')||
     Number(response.headers.get('content-length'))>MAX_BYTES){
    await response.body?.cancel();
    throw new Error('Public schedule response unavailable');
  }
  const reader=response.body.getReader();
  const chunks=[];
  let length=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.length;
      if(length>MAX_BYTES)throw new Error('Public schedule response too large');
      chunks.push(value);
    }
  }finally{await reader.cancel().catch(()=>{});}
  return parseSchedule(Buffer.concat(chunks).toString('utf8'),clock());
}

export function createScheduleFeed({fetcher=fetch,clock=Date.now}={}){
  let cached=null, pending=null, retryAt=0;
  return async function schedule(){
    const at=clock();
    if((!cached||at-cached.at>=FRESH_MS)&&at>=retryAt){
      pending??=readSchedule(fetcher,clock)
        .then(events=>{cached={events,at:clock()};})
        .catch(()=>{retryAt=clock()+RETRY_MS;})
        .finally(()=>{pending=null;});
      await pending;
    }
    const now=clock(),age=cached?now-cached.at:Infinity;
    if(age>=STALE_MS)return {state:'unavailable',events:[]};
    const today=dayOf(now);
    return {state:age<FRESH_MS?'current':'stale',events:cached.events.filter(event=>event.day>=today)};
  };
}

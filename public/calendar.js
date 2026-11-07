import {esc, intro, kinds, time} from './ui.js';

const ZONE='Europe/Warsaw';
const icons={'pistolet':'target','karabin':'crosshair','pierwszy-raz':'graduation-cap','zawody':'medal'};
const weekdays=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
const dayFormat=new Intl.DateTimeFormat('pl-PL',{timeZone:ZONE,weekday:'long',day:'numeric',month:'long',year:'numeric'});
const monthFormat=new Intl.DateTimeFormat('pl-PL',{timeZone:'UTC',month:'long',year:'numeric'});
const keyFormat=new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
const localParts=new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const icon=name=>`<i class="ph ph-${name}" aria-hidden="true"></i>`;
const utcDate=key=>new Date(`${key}T12:00:00Z`);
const shiftDay=(key,amount)=>{const value=utcDate(key);value.setUTCDate(value.getUTCDate()+amount);return value.toISOString().slice(0,10);};
const validKey=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(utcDate(value).getTime())&&utcDate(value).toISOString().slice(0,10)===value;

/** Shared calendar/training day keys always follow the club's Warsaw time zone. */
export function eventDateKey(value){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 const parts=Object.fromEntries(keyFormat.formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}

function warsawTime(day,clock){
 const requested=new Date(`${day}T${clock}:00Z`);
 const p=Object.fromEntries(localParts.formatToParts(requested).map(part=>[part.type,part.value]));
 const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
 return new Date(requested.getTime()-(shown-requested.getTime())).toISOString();
}

/** Illustrations only: no prices, places, capacity or reservation identifiers. */
export function sampleCalendarEvents(now=new Date()){
 const today=eventDateKey(now);
 const plan=[
  [1,'pierwszy-raz','Pierwsze kroki na strzelnicy','10:00'],[2,'pistolet','Trening pistoletowy','18:00'],
  [4,'karabin','Trening karabinowy','17:00'],[6,'zawody','Zawody klubowe','09:00'],
  [8,'pistolet','Pistolet: skupienie i technika','18:00'],[11,'pierwszy-raz','Poznaj strzelectwo sportowe','10:00'],
  [15,'karabin','Karabin: trening celności','17:00'],[19,'zawody','Spotkanie na linii startu','09:00'],
  [23,'pistolet','Trening pistoletowy','18:00'],[27,'karabin','Trening karabinowy','17:00']
 ];
 return plan.map(([offset,type,title,clock],index)=>({id:`sample-${today}-${index+1}`,sample:true,type,title,startsAt:warsawTime(shiftDay(today,offset),clock)}));
}

/** Render a local-only calendar, returning a cleanup function for route changes. */
export function renderCalendar({main,events=[],isCurrent=()=>true}={}){
 if(!main||!isCurrent())return ()=>{};
 const sample=events.length===0;
 const source=(sample?sampleCalendarEvents():events).filter(event=>eventDateKey(event.startsAt)).slice().sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
 const today=eventDateKey(new Date()),params=new URLSearchParams(location.search);
 const requestedDay=validKey(params.get('date'))?params.get('date'):'';
 let filter=Object.hasOwn(kinds,params.get('type'))?params.get('type'):'';
 let selected=requestedDay||today;
 if(!requestedDay){const matching=source.filter(event=>!filter||event.type===filter);if(!matching.some(event=>eventDateKey(event.startsAt)===today)){const next=matching.find(event=>eventDateKey(event.startsAt)>today);if(next)selected=eventDateKey(next.startsAt);}}
 let month=selected.slice(0,7);
 let disposed=false;
 const controller=new AbortController();
 main.innerHTML=intro('Kalendarz.','Wybierz dzień i trening.')+'<section class="calendar-page" aria-label="Kalendarz treningów i wydarzeń"></section>';
 const root=main.querySelector('.calendar-page');
 const matches=()=>source.filter(event=>!filter||event.type===filter);
 const fullDay=key=>dayFormat.format(utcDate(key));
 const typeName=event=>kinds[event.type]||'Wydarzenie';

 function eventCard(event,agenda=false){
  const key=eventDateKey(event.startsAt),type=Object.hasOwn(kinds,event.type)?event.type:'';
  const link='/treningi?'+new URLSearchParams({date:key,...(type?{type}:{})});
  return `<article class="calendar-event" ${sample?'data-sample-event':''}>${icon(icons[type]||'calendar-blank')}<div><span class="calendar-event-type">${esc(typeName(event))}</span><h3>${agenda?esc(event.title):`<button type="button" class="calendar-event-title" data-calendar-pick="${key}">${esc(event.title)}</button>`}</h3><p>${agenda?'':`${esc(fullDay(key))} · `}<time datetime="${esc(event.startsAt)}">${esc(time(event.startsAt))}</time>${event.location?`<br>${esc(event.location)}`:''}</p>${sample?'<span class="calendar-sample-tag">Wydarzenie przykładowe</span>':agenda?`<a class="text-link" href="${esc(link)}">Sprawdź termin ${icon('arrow-up-right')}</a>`:''}</div></article>`;
 }

 function draw(focus){
  if(disposed||!isCurrent())return;
  const filtered=matches(),[year,number]=month.split('-').map(Number);
  const days=new Date(Date.UTC(year,number,0)).getUTCDate(),first=(new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;
  const monthEvents=filtered.filter(event=>eventDateKey(event.startsAt).startsWith(month));
  const agenda=filtered.filter(event=>eventDateKey(event.startsAt)===selected);
  const upcoming=filtered.filter(event=>eventDateKey(event.startsAt)>=today).slice(0,10);
  const cells=Array.from({length:first},()=>'<span class="calendar-pad" aria-hidden="true"></span>');
  for(let day=1;day<=days;day++){
   const key=`${month}-${String(day).padStart(2,'0')}`,items=monthEvents.filter(event=>eventDateKey(event.startsAt)===key);
   const weekday=(new Date(Date.UTC(year,number-1,day)).getUTCDay()+6)%7;
   const label=`${fullDay(key)}${key===today?', dzisiaj':''}. Liczba wydarzeń: ${items.length}`;
   cells.push(`<button type="button" class="calendar-day" data-calendar-day="${key}" aria-label="${esc(label)}" aria-pressed="${key===selected}" aria-controls="calendar-agenda" ${key===today?'aria-current="date"':''} tabindex="${key===selected?0:-1}"><span class="calendar-day-weekday">${key===today?'Dziś':weekdays[weekday]}</span><span class="calendar-day-number">${day}</span>${key===today?'<span class="calendar-day-today" aria-hidden="true">Dziś</span>':''}${items.length?`<span class="calendar-day-events">${icon(icons[items[0].type]||'calendar-blank')}<span>${items.length}</span></span>`:'<span class="calendar-day-quiet" aria-hidden="true"></span>'}</button>`);
  }
  root.innerHTML=`${sample?'<div class="calendar-sample" data-motion><strong>Przykładowy kalendarz</strong><p>Terminy ilustracyjne · bez zapisów.</p></div>':''}<div class="calendar-filters" role="group" aria-label="Rodzaj wydarzenia"><button type="button" data-calendar-filter="" aria-pressed="${!filter}">${icon('calendar-dots')}Wszystkie</button>${Object.entries(kinds).map(([key,label])=>`<button type="button" data-calendar-filter="${key}" aria-pressed="${filter===key}">${icon(icons[key])}${esc(label)}</button>`).join('')}</div><div class="calendar-layout"><div class="calendar-month" data-motion><div class="calendar-toolbar"><h2 id="calendar-month-title" aria-live="polite">${esc(monthFormat.format(new Date(Date.UTC(year,number-1,1))))}</h2><div class="calendar-month-actions"><button type="button" class="calendar-nav" data-calendar-action="prev" aria-label="Poprzedni miesiąc">${icon('arrow-left')}</button><button type="button" class="calendar-today" data-calendar-action="today">Dzisiaj</button><button type="button" class="calendar-nav" data-calendar-action="next" aria-label="Następny miesiąc">${icon('arrow-right')}</button></div></div><p class="calendar-month-count">Liczba wydarzeń w tym miesiącu: ${monthEvents.length}</p><p class="calendar-mobile-hint">Przesuń dni w bok, aby wybrać termin.</p><div class="calendar-weekdays" aria-hidden="true">${weekdays.map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-days" role="group" aria-label="Dni miesiąca">${cells.join('')}</div></div><section class="calendar-agenda" id="calendar-agenda" aria-labelledby="calendar-agenda-title"><h2 id="calendar-agenda-title" tabindex="-1">${esc(fullDay(selected))}</h2><div aria-live="polite">${agenda.length?agenda.map(event=>eventCard(event,true)).join(''):`<p class="calendar-empty">W tym dniu nie ma ${sample?'przykładowych ':''}wydarzeń${filter?' z kategorii „'+esc(kinds[filter])+'”':''}.</p>${upcoming.length?`<button type="button" class="text-button" data-calendar-pick="${eventDateKey(upcoming[0].startsAt)}">Pokaż najbliższy termin ${icon('arrow-right')}</button>`:''}`}</div></section></div><section class="calendar-upcoming" aria-labelledby="calendar-upcoming-title"><h2 id="calendar-upcoming-title">Najbliższe wydarzenia</h2><p>${sample?'Przykładowe wpisy na najbliższe 30 dni.':'Opublikowane terminy klubu.'}</p>${upcoming.length?upcoming.map(event=>eventCard(event)).join(''):'<p class="calendar-empty">Brak nadchodzących wydarzeń dla tego wyboru.</p>'}</section>`;
  if(focus)root.querySelector(focus)?.focus({preventScroll:true});
  const chosen=root.querySelector(`[data-calendar-day="${selected}"]`);
  if(chosen&&window.matchMedia('(max-width: 780px)').matches){const strip=chosen.parentElement;strip.scrollLeft+=chosen.getBoundingClientRect().left-strip.getBoundingClientRect().left-(strip.clientWidth-chosen.clientWidth)/2;}
 }

 function pick(key,focus=true){selected=key;month=key.slice(0,7);draw(focus?`[data-calendar-day="${key}"]`:null);}
 root.addEventListener('click',event=>{
  const day=event.target.closest('[data-calendar-day],[data-calendar-pick]');
  if(day){pick(day.dataset.calendarDay||day.dataset.calendarPick,!day.dataset.calendarPick);if(day.dataset.calendarPick){root.querySelector('#calendar-agenda').scrollIntoView({block:'start',behavior:'instant'});root.querySelector('#calendar-agenda-title')?.focus({preventScroll:true});}return;}
  const category=event.target.closest('[data-calendar-filter]');
  if(category){filter=category.dataset.calendarFilter;const next=matches().find(item=>eventDateKey(item.startsAt)>=today);if(next){selected=eventDateKey(next.startsAt);month=selected.slice(0,7);}draw(`[data-calendar-filter="${filter}"]`);return;}
  const action=event.target.closest('[data-calendar-action]')?.dataset.calendarAction;
  if(action==='today'){pick(today,false);root.querySelector('[data-calendar-action="today"]')?.focus({preventScroll:true});}
  else if(action){const [year,number]=month.split('-').map(Number);const value=new Date(Date.UTC(year,number-1+(action==='next'?1:-1),1));month=value.toISOString().slice(0,7);selected=`${month}-01`;draw(`[data-calendar-action="${action}"]`);}
 },{signal:controller.signal});
 root.addEventListener('keydown',event=>{
  const day=event.target.closest('[data-calendar-day]'),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];
  if(day&&offset){event.preventDefault();pick(shiftDay(day.dataset.calendarDay,offset));}
 },{signal:controller.signal});
 draw();
 return ()=>{disposed=true;controller.abort();};
}

import {t, english, locale, sitePath} from './i18n.js?v=20261108-calendar-product';
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clubCalendar = {
  id:'skaut-kalendarz-2027',
  path:'/sklep/kalendarz-skaut-2027',
  preview:'/assets/calendar-2027/kalendarz-skaut-2027-preview.webp',
  newsCrop:'/assets/calendar-2027/kalendarz-skaut-2027-news.webp',
  artwork:'/assets/calendar-2027/kalendarz-skaut-2027.webp',
};

export function clubCalendarArtwork() {
  const title=esc(t('Kalendarz trójdzielny SKAUT 2027'));
  return `<a class="club-calendar-artwork" href="${clubCalendar.artwork}" target="_blank" rel="noopener">
    <img src="${clubCalendar.artwork}" alt="${title}" width="1156" height="3015" decoding="async">
    <span class="text-link">${t('Otwórz podgląd w pełnym rozmiarze')}</span>
  </a>`;
}
const campaignImages=new Set(['/assets/hero.webp','/assets/range-front.webp','/assets/range-side.webp']);
export function campaignImageAttrs(src,sizes){let stem;if(campaignImages.has(src))stem='/assets/optimized/'+src.slice('/assets/'.length,-'.webp'.length);else{const match=typeof src==='string'&&src.match(/^(\/assets\/campaign\/(?:photo-(?:0[1-9]|1[0-9])|licencja-klubowa-badge))-(?:360|720|1100)\.webp$/);if(!match)return '';stem=match[1];}return `srcset="${[360,720,1100].map(width=>`${stem}-${width}.webp ${width}w`).join(', ')}" sizes="${esc(sizes)}"`;}
// Fixed source-post IDs preserve the image assignment during filtering and search.
const newsCampaignImages=new Map([['wp-9200','02'],['wp-9141','03'],['wp-9068','04'],['wp-9040','05'],['wp-8922','07'],['wp-8951','08'],['wp-8930','11'],['wp-8913','12'],['wp-8874','13'],['wp-8775','14'],['wp-8770','15'],['wp-8772','16'],['wp-8774','17'],['wp-8782','18'],['wp-8768','19']]);
export function campaignNewsImage(news){if(news.id===clubCalendar.id)return clubCalendar.newsCrop;const source=typeof news.image==='string'?news.image:'';const path=source.split(/[?#]/)[0];const legacy=campaignImages.has(path)||/^\/assets\/optimized\/(?:hero|range-front|range-side)-(?:360|720|1100)\.webp$/.test(path);if(source&&!legacy)return source;const assigned=newsCampaignImages.get(String(news.id));return assigned?`/assets/campaign/photo-${assigned}-1100.webp`:'';}
export const money=v=>new Intl.NumberFormat(locale,{style:'currency',currency:'PLN'}).format(v/100);
export const date=v=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Warsaw'}).format(new Date(v));
export const time=v=>new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Warsaw'}).format(new Date(v));
export const kinds={'pistolet':t('Pistolet'),'karabin':t('Karabin'),'pierwszy-raz':t('Pierwszy raz'),'zawody':t('Zawody')};
const externalKinds={strzelba:t('Strzelba'),ipsc:'IPSC',szkolenia:t('Szkolenia'),inne:t('Inne treningi')};
export const scheduleKinds=(events=[],selected='')=>({
 ...kinds,...Object.fromEntries(Object.entries(externalKinds).filter(([type])=>type===selected||events.some(event=>event.type===type))),
});
export function importedEventLink(event, classes='btn') {
 return `<a class="${classes}" href="${esc(sitePath(event.path))}">${t('Szczegóły wydarzenia')} <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>`;
}
export function scheduleNotice(state) {
 if(!state||state==='demo')return '';
 return `<aside class="booking-source" aria-label="${t('Wydarzenia klubu')}">
  <div><strong>${t('Wydarzenia klubu')}</strong><p>${t(state==='unavailable'?'Nie udało się wczytać harmonogramu.':'Sprawdź opisy, miejsca i opublikowane ceny.')}</p></div>
  <a class="btn secondary" href="${esc(sitePath('/wydarzenia?period=all'))}">${t('Wszystkie wydarzenia')} <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>
 </aside>`;
}
export function importedEventRow(event) {
 const kind=scheduleKinds([event])[event.type]||t('Trening');
 const start=new Date(event.startsAt);
 return `<article class="event-row imported-event-row" data-imported-event>
  <div class="event-date"><strong>${start.toLocaleDateString(locale,{day:'numeric',timeZone:'Europe/Warsaw'})}</strong>${start.toLocaleDateString(locale,{month:'short',timeZone:'Europe/Warsaw'})}</div>
  <div><p class="event-kind">${trainingTypeIcon(event.type)} ${esc(kind)}</p>
  <h3 lang="pl">${esc(event.title)}</h3>
  <p><time datetime="${esc(event.startTime?event.startsAt:event.day)}">${event.startTime?esc(time(event.startsAt)):esc(date(event.startsAt))}</time>${event.location?' · '+esc(event.location):''}${Number.isInteger(event.price)?' · '+(event.priceFrom?t('od')+' ':'')+esc(money(event.price)):''}</p></div>
  ${importedEventLink(event)}
 </article>`;
}
const disciplineOutlines={
 'pistolet':'M3 6.5h17.5v5H9.8L7.2 19H3l2.7-7.5H3z M9.8 11.5v2.7h3a2.2 2.2 0 0 0 2.2-2.2v-.5 M5 6.5V5m12.5 1.5V5',
 'karabin':'M1.5 9.5h4.4l2.7-1.4H17v2h5.5v2.6H13l-1.2 3.5H9l.7-3.5H7.6l-2.3 2.6H1.5z',
};
export function trainingTypeIcon(type){
 if(Object.hasOwn(disciplineOutlines,type))return `<svg class="training-type-icon" data-training-icon="${type}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${disciplineOutlines[type]}"/></svg>`;
 return `<i class="ph ph-${type==='pierwszy-raz'?'graduation-cap':type==='zawody'?'medal':type==='ipsc'?'timer':type==='szkolenia'?'graduation-cap':type==='strzelba'?'crosshair':'calendar-blank'}" aria-hidden="true"></i>`;
}
export const statuses={pending:t('Oczekuje na potwierdzenie'),confirmed:t('Potwierdzona'),cancelled:t('Anulowana'),expired:t('Wygasła'),awaiting_confirmation:t('Oczekuje na potwierdzenie')};
export function field(name,label,type='text',extra='') {return `<label class="field">${esc(label)}<input name="${name}" type="${type}" ${extra}></label>`;}
export const empty=(title,body)=>`<div class="empty"><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
export const intro=(title,subtitle='')=>`<div class="page-intro"><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>`;
export function finder(type='',selectedDate='',options=kinds) {return `<form id="finder"><label class="field">${t("Rodzaj treningu")}<select name="type"><option value="">${t("Wybierz trening")}</option>${Object.entries(options).map(([k,v])=>`<option value="${k}" ${k===type?'selected':''}>${v}</option>`).join('')}</select></label>${field('date',t('Termin'),'date',`value="${esc(selectedDate)}"`)}<button class="btn" type="submit">${t("Sprawdź terminy")}<i class="ph ph-arrow-right" aria-hidden="true"></i></button></form>`;}
export function eventRow(e,basket) {return `<article class="event-row"><div class="event-date"><strong>${new Date(e.startsAt).toLocaleDateString(locale,{day:'numeric',timeZone:'Europe/Warsaw'})}</strong>${new Date(e.startsAt).toLocaleDateString(locale,{month:'short',timeZone:'Europe/Warsaw'})}</div><div><p class="event-kind">${trainingTypeIcon(e.type)} ${esc(kinds[e.type]||t('Trening'))}</p><h3>${esc(t(e.title))}</h3><p>${esc(date(e.startsAt))} · ${esc(time(e.startsAt))}</p><p>${esc(t(e.location))}</p></div><div class="price">${money(e.price)}<span class="availability">${e.available>0?`Wolne miejsca: ${e.available}`:t('Brak wolnych miejsc')}</span></div><button class="btn ${basket.includes(e.id)?'secondary':''}" data-add="${e.id}" ${e.available<1?'disabled':''}>${basket.includes(e.id)?t('W koszyku'):e.available<1?t('Brak miejsc'):t('Dodaj do koszyka')}</button></article>`;}
export function sampleEventRow(e,dayKey){const link='/kalendarz?'+new URLSearchParams({date:dayKey,type:e.type});return `<article class="event-row sample-event-row" data-sample-training><div class="event-date"><strong>${new Date(e.startsAt).toLocaleDateString(locale,{day:'numeric',timeZone:'Europe/Warsaw'})}</strong>${new Date(e.startsAt).toLocaleDateString(locale,{month:'short',timeZone:'Europe/Warsaw'})}</div><div><p class="event-kind">${trainingTypeIcon(e.type)} ${esc(kinds[e.type]||t('Trening'))}</p><h3>${esc(t(e.title))}</h3><p>${esc(date(e.startsAt))} · ${esc(time(e.startsAt))}</p></div><span class="sample-training-tag">${t("Przykład")}</span><a class="btn secondary" href="${esc(link)}">${t("Zobacz w kalendarzu")} <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a></article>`;}
export function newsItem(n) {const image=campaignNewsImage(n);const responsive=campaignImageAttrs(image,'(max-width: 780px) calc(100vw - 48px), 31vw');return `<article class="news-item"><a href="${esc(sitePath('/aktualnosci/'+n.slug))}">${image?`<img ${responsive} src="${esc(image)}" alt="${responsive?t('Fotografia kampanijna SKAUT'):''}" loading="lazy" decoding="async" width="640" height="400">`:''}<div class="meta"><span>${esc(t(n.category))}</span>${english&&n.lang==='pl'?'<span>'+t('Wersja polska')+'</span>':''}<time datetime="${esc(n.published_at)}">${date(n.published_at)}</time></div><h2 lang="${n.lang||'pl'}">${esc(n.title)}</h2><p lang="${n.lang||'pl'}">${esc(n.summary)}</p><span class="text-link">${t("Czytaj dalej")} <i class="ph ph-arrow-up-right" aria-hidden="true"></i></span></a></article>`;}
export function achievements(items) {return items.length?items.map(a=>`<div class="achievement"><div class="achievement-title"><span>${esc(a.title)}</span><span>${a.progress}%</span></div><progress value="${a.progress}" max="100" aria-label="${esc(a.title)}"></progress><p>${esc(a.description)}${a.verified?t(' · Zweryfikowano przez instruktora'):''}</p></div>`).join(''):empty(t('Twój rozwój zaczyna się tutaj'),t('Po treningu instruktor może uzupełnić Twoje postępy.'));}
export function booking(b) {return `<article class="booking"><div><span class="status ${b.status}">${statuses[b.status]}</span><h3>${esc(t(b.title))}</h3><div class="meta">${date(b.startsAt)} · ${time(b.startsAt)}</div><p>${esc(t(b.location))}</p>${b.status==='pending'?`<small>${t("Rezerwacja wstępna do")} ${date(b.hold_until)}, ${time(b.hold_until)}.</small>`:''}</div>${b.status==='pending'?`<button class="btn secondary" data-cancel="${b.id}">${t("Anuluj")}</button>`:''}</article>`;}

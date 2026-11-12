import {t, english, locale, sitePath} from './i18n.js?v=20261108-calendar-product';
import {date, esc, money, empty, intro, scheduleKinds, clubCalendar, clubCalendarArtwork} from './ui.js?v=20261108-calendar-product';

const root = '/zbrojownia/';
const version = '20261107-import';
const requests = new Map();
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw'}).format(new Date());
const icon = name => '<i class="ph ph-'+name+'" aria-hidden="true"></i>';
const label = name => esc(t(name));
const calendarProduct = {
  path:clubCalendar.path,
  title:t('Kalendarz trójdzielny SKAUT 2027'),
  image:clubCalendar.preview,
  lang:english?'en':'pl',
  body:'<p>'+label('Klubowy kalendarz ścienny z ilustracją SKAUT i trzema bloczkami. Podgląd pokazuje grudzień 2026, styczeń i luty 2027.')+'</p>',
};

function read(name) {
  if (!requests.has(name)) {
    const request = fetch(root+name+'.json?v='+(name==='catalogue'?'20261113-performance':version)).then(response => {
      if (!response.ok) throw new Error('Imported content unavailable');
      return response.json();
    }).catch(error => {
      requests.delete(name);
      throw error;
    });
    requests.set(name,request);
  }
  return requests.get(name);
}

export async function getImportedSchedule() {
  try {
    const entries=await read('schedule');
    return {state:'current',events:entries.filter(event=>event.day>=today())};
  } catch {
    return {state:'unavailable',events:[]};
  }
}

function localLink(path,text,classes='text-link') {
  return '<a class="'+classes+'" href="'+esc(sitePath(path))+'">'+label(text)+' '+icon('arrow-up-right')+'</a>';
}

function languageNote() {
  return english ? '<p class="imported-language">'+label('Oryginalne opisy są w języku polskim.')+'</p>' : '';
}

function productCard(product, heading) {
  const cover = product.thumbnail || product.image;
  return '<article class="news-item imported-product"><a href="'+esc(sitePath(product.path))+'">'+
    (cover?'<img src="'+esc(cover)+'" alt="" loading="lazy" decoding="async" width="600" height="400">':'')+
    '<'+heading+' lang="'+esc(product.lang||'pl')+'">'+esc(product.title)+'</'+heading+'>'+
    (Number.isInteger(product.price)?'<p>'+esc(money(product.price))+'</p>':'')+
    '<span class="text-link">'+label('Zobacz produkt')+' '+icon('arrow-up-right')+'</span></a></article>';
}

function productGrid(products, heading = 'h2') {
  return '<div class="news-grid imported-products">'+
    products.map(product=>productCard(product,heading)).join('')+'</div>';
}

export async function importedGadgetsGrid() {
  const products=await read('catalogue').catch(async()=> (await read('index')).products);
  return productGrid([calendarProduct,...products],'h3');
}

function eventListEntry(event) {
  return '<li><a href="'+esc(sitePath(event.path))+'"><time datetime="'+esc(event.day)+'">'+esc(date(event.startsAt))+'</time>'+
    '<strong lang="pl">'+esc(event.title)+'</strong><span>'+esc(scheduleKinds([event])[event.type]||t('Wydarzenie'))+'</span>'+
    icon('arrow-up-right')+'</a></li>';
}

function eventsPage(events) {
  const years=[...new Set(events.map(event=>event.day.slice(0,4)).filter(Boolean))].sort().reverse();
  const options=Object.entries(scheduleKinds(events)).map(([type,name])=>'<option value="'+esc(type)+'">'+esc(name)+'</option>').join('');
  const yearOptions=years.map(year=>'<option value="'+esc(year)+'">'+esc(year)+'</option>').join('');
  return {
    title:t('Wydarzenia klubu'),
    html:intro(t('Wydarzenia klubu'),t('Treningi, szkolenia i zawody SKAUT.'))+
      '<section class="content imported-content">'+languageNote()+
      '<div class="imported-filters">'+
      '<label class="field">'+label('Szukaj wydarzenia')+'<input type="search" id="event-search"></label>'+
      '<label class="field">'+label('Termin')+'<select id="event-period"><option value="upcoming">'+label('Nadchodzące')+'</option><option value="all">'+label('Wszystkie terminy')+'</option>'+yearOptions+'</select></label>'+
      '<label class="field">'+label('Rodzaj wydarzenia')+'<select id="event-kind"><option value="">'+label('Wszystkie')+'</option>'+options+'</select></label></div>'+
      '<p id="imported-count" role="status"></p><ul id="imported-events" class="imported-events"></ul>'+
      '<p id="imported-empty" hidden>'+label('Brak wydarzeń dla tego wyboru.')+'</p>'+
      '<button type="button" class="btn secondary" id="imported-more">'+label('Pokaż kolejne')+'</button></section>',
    wire(main) {
      const search=main.querySelector('#event-search');
      const period=main.querySelector('#event-period');
      const kind=main.querySelector('#event-kind');
      const list=main.querySelector('#imported-events');
      const count=main.querySelector('#imported-count');
      const more=main.querySelector('#imported-more');
      const noResults=main.querySelector('#imported-empty');
      const pageSize=30;
      let shown=pageSize;
      const query=new URLSearchParams(location.search);
      if ([...period.options].some(option=>option.value===query.get('period'))) period.value=query.get('period');
      else if (!events.some(event=>event.listed&&event.day>=today())) period.value='all';
      const draw=()=>{
        const term=search.value.trim().toLocaleLowerCase(locale);
        const upcoming=period.value==='upcoming';
        const firstDay=today();
        const filtered=events.filter(event=>
          (!kind.value||event.type===kind.value)&&
          (upcoming?(event.listed&&event.day>=firstDay):period.value==='all'||event.day.startsWith(period.value))&&
          (event.title+' '+event.location).toLocaleLowerCase(locale).includes(term));
        if(upcoming)filtered.reverse();
        count.textContent=new Intl.NumberFormat(locale).format(filtered.length)+' '+t('wyników');
        list.innerHTML=filtered.slice(0,shown).map(eventListEntry).join('');
        noResults.hidden=filtered.length!==0;
        more.hidden=shown>=filtered.length;
      };
      const filter=()=>{shown=pageSize;draw();};
      search.addEventListener('input',filter);
      period.addEventListener('change',filter);
      kind.addEventListener('change',filter);
      more.addEventListener('click',()=>{shown+=pageSize;draw();});
      draw();
    },
  };
}

function shopPage(products,pages) {
  return {
    title:t('Sklep klubowy'),
    html:intro(t('Sklep klubowy'),t('Oryginalna odzież i gadżety SKAUT.'))+
      '<section class="content imported-content">'+languageNote()+
      productGrid([calendarProduct,...products])+
      '<div class="imported-documents"><h2>'+label('Informacje o sklepie')+'</h2><ul>'+
      pages.map(page=>'<li><a lang="pl" href="'+esc(sitePath(page.path))+'">'+esc(page.title)+'</a></li>').join('')+'</ul></div></section>',
  };
}

function publishedOptions(items,heading) {
  if(!items?.length)return '';
  return '<section class="imported-options"><h2>'+label(heading)+'</h2><ul>'+
    items.map(item=>'<li><div><strong lang="pl">'+esc(item.name)+'</strong>'+
      (item.description?'<p lang="pl">'+esc(item.description)+'</p>':'')+'</div>'+
      (Number.isInteger(item.price)?'<b>'+esc(money(item.price))+'</b>':'')+'</li>').join('')+'</ul></section>';
}

function detailPage(item,section) {
  const isEvent=section==='events';
  const isProduct=section==='products';
  const isCalendar=item===calendarProduct;
  const lang=item.lang||'pl';
  const past=isEvent&&item.day<today();
  const back=isEvent?localLink('/wydarzenia','Wszystkie wydarzenia'):localLink('/sklep','Sklep klubowy');
  const metadata=isEvent?[
    item.startsAt?'<time datetime="'+esc(item.startTime?item.startsAt:item.day)+'">'+esc(date(item.startsAt))+(item.startTime?' · '+esc(item.startTime):'')+'</time>':'',
    item.location?'<span lang="pl">'+esc(item.location)+'</span>':'',
    item.organizer?'<span lang="pl">'+esc(item.organizer)+'</span>':'',
    Number.isInteger(item.price)?'<span>'+(item.priceFrom?label('od')+' ':'')+esc(money(item.price))+'</span>':'',
  ].filter(Boolean).join('<span aria-hidden="true">·</span>'):'';
  const images=isCalendar?clubCalendarArtwork():item.images?.length?'<div class="imported-pictures">'+item.images.map((url,i)=>
    '<img src="'+esc(url)+'" alt="" '+(i?'loading="lazy" ':'')+'decoding="async">').join('')+'</div>':'';
  const contact=!past&&(isEvent||isProduct)?'<div class="booking-source"><p>'+label(isEvent?'W sprawie zapisów skontaktuj się z klubem.':'W sprawie zamówień skontaktuj się z klubem.')+
    '</p><a class="btn secondary" href="mailto:zbrojownia@ksskaut.pl?subject='+encodeURIComponent(item.title)+'">'+label('Napisz do klubu')+'</a></div>':'';
  return {
    title:item.title,
    html:'<article class="article imported-content">'+back+
      (past?'<p class="imported-tag">'+label('Wydarzenie archiwalne')+'</p>':'')+
      '<h1 lang="'+lang+'">'+esc(item.title)+'</h1>'+
      (metadata?'<div class="meta">'+metadata+'</div>':'')+(isCalendar?'':languageNote())+images+
      (Number.isInteger(item.price)&&isProduct?'<p class="lead">'+esc(money(item.price))+'</p>':'')+
      contact+(item.body?'<div class="prose imported-body" lang="'+lang+'">'+item.body+'</div>':'')+
      publishedOptions(item.tickets,'Opublikowane opcje udziału')+
      publishedOptions(item.extras,'Opcje dodatkowe')+publishedOptions(item.variants,'Warianty produktu')+'</article>',
  };
}

export async function importedPage(path) {
  if(path===calendarProduct.path)return detailPage(calendarProduct,'products');
  const index=await read('index');
  if(path==='/wydarzenia')return eventsPage(index.events);
  if(path==='/sklep'||path==='/sklep/informacje/ubrania-i-gadzety')return shopPage(index.products,index.pages);
  const section=path.startsWith('/wydarzenia/')?'events':path.startsWith('/sklep/informacje/')?'pages':'products';
  const resolvedPath=section==='events'?(index.aliases?.[path.split('/').at(-1)]||path):path;
  const item=index[section].find(record=>record.path===resolvedPath);
  if(!item)return {
    title:t('Nie znaleziono strony'),
    html:'<section class="content">'+empty(t('Nie znaleziono strony'),t('Sprawdź adres albo wróć na stronę główną.'))+
      (section==='events'?localLink('/wydarzenia','Wszystkie wydarzenia','btn'):localLink('/sklep','Sklep klubowy','btn'))+'</section>',
  };
  const bundle=section==='events'?item.day.slice(0,4)||'undated':section;
  const details=await read(bundle);
  return detailPage(details[item.slug],section);
}

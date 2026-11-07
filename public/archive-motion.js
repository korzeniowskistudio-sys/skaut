import {initNavigation} from './navigation.js?v=20261107-albums-calendar';
import {createPageMotion} from './motion.js?v=20261107responsive';
import {initMobileNavigation} from './mobile.js?v=20261107responsive';
const topNavigation=initNavigation();
const pageMotion=createPageMotion({main:document.querySelector('main')});
const mobileNavigation=initMobileNavigation();
mobileNavigation.update(location.pathname);
let navigationIntent=0;
// Resolve old public booking references inside the preserved SKAUT archive.
const oldBookingLinks = [...document.querySelectorAll('a[href]')].flatMap(link => {
 const url = new URL(link.href);
 if (!['www.zbrojownia.ksskaut.pl','zbrojownia.ksskaut.pl'].includes(url.hostname)) return [];
 const path = url.pathname.replace(/\/$/,'');
 const event = path.match(/^\/events\/([^/]+)$/)?.[1] || url.searchParams.get('mep_events');
 const product = path.match(/^\/produkt\/([^/]+)$/)?.[1];
 const information = ['/regulamin','/o-sklepie','/polityka-cookies','/about','/blog'].includes(path);
 link.href = path==='/moje-konto'?'/moj-skaut':path==='/koszyk'||path==='/zamowienie'?'/koszyk':
   information?'/sklep/informacje'+path:product||path==='/ubrania-i-gadzety'?'/sklep':'/wydarzenia?period=all';
 return event||product?[{link,event,product}]:[];
});
if (oldBookingLinks.length) {
 void fetch('/zbrojownia/index.json?v=20261107-import').then(response=>{
  if (!response.ok) return;
  return response.json().then(index=>{
   const events=new Map(index.events.map(item=>[item.slug,item.path]));
   const products=new Map(index.products.map(item=>[item.slug,item.path]));
   for(const {link,event,product} of oldBookingLinks){
    const path=event?events.get(event)||index.aliases?.[event]:products.get(product);
    if(path)link.href=path;
   }
  });
 }).catch(()=>{});
}
pageMotion.enter();
document.addEventListener('click',async event=>{
 const a=event.target.closest('a');
 if(!a||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||a.target||a.hasAttribute('download'))return;
 const url=new URL(a.href);
 const archivedPage=/^\/archiwum\/.+\.html$/i.test(url.pathname);
 if(url.origin!==location.origin||url.hash||(/\.[^/]+$/.test(url.pathname)&&!archivedPage))return;
 event.preventDefault();
 const intent=++navigationIntent;
 await pageMotion.leave();
 if(intent===navigationIntent)location.assign(url.href);
});
const toggle=document.querySelector('#menu-toggle'),nav=document.querySelector('#navigation');
toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const wasOpen=nav.classList.contains('open');nav.classList.remove('open');topNavigation.update();toggle.setAttribute('aria-expanded','false');if(wasOpen)toggle.focus();}});

import {rangeGameMarkup} from './range-game.js?v=20261107-three-stages';

// Positions follow the 3 × 2 studio contact sheets.
const gadgets = [
  {
    id: 'torba-na-szpej', name: 'Torba na szpej', spec: '30 l · haft', price: 219,
    description: 'Torba na trening z przestawnymi przegrodami, osobną kieszenią na mokrą odzież i dużymi uchwytami zamków. Na froncie logo klubu i haft „torba na szpej”.',
    source: ['4F · torba 30 l z organizerem', 'https://4f.com.pl/torba-sportowa-30-l-czarna-4fraw26atbaf130-20s.html'],
  },
  {
    id: 'bluza-klubowa', name: 'Bluza klubowa', spec: 'Kaptur · haft', price: 189,
    description: 'Gruba grafitowa bluza z haftowanym logiem klubu na piersi. W kieszonce wewnątrz kangurki jest miejsce na legitymację.',
    source: ['Polonia Warszawa · bluza z haftowaną tarczą', 'https://sklep.poloniawarszawa.com/pl/p/Czarna-bluza-z-charakterem/130'],
  },
  {
    id: 'etui-na-okulary', name: 'Etui na okulary', spec: 'Twarda skorupa', price: 59,
    description: 'Sztywne etui z logiem klubu, miękką wyściółką i kieszonką na ściereczkę. Pętla pozwala przypiąć je w torbie.',
    source: ['Arena · twarde etui na okulary', 'https://www.decathlon.pl/p/mp/etui-na-okulary-plywackie-twarde-uniwersalne-unisex-arena-case/d5fbeaf8-63e0-4b1a-9f10-6be9776f1a43/c1c249'],
  },
  {
    id: 'zestaw-naszywek', name: 'Zestaw naszywek', spec: '3 szt. · rzep', price: 49,
    description: 'Logo klubu i dwie naszywki z piktogramami. Przypnij je do panelu torby, aby oznaczyć kieszenie i szybciej znaleźć wyposażenie.',
    source: ['Fabryka Haftu · naszywki na rzep', 'https://sklep.fabryka-haftu.pl/pol_m_WOJSKOWE-101.html'],
  },
  {
    id: 'notes-treningowy', name: 'Notes treningowy', spec: 'A6 · papier odporny na wilgoć', price: 45,
    description: 'Kieszonkowy notes z logiem klubu. Każda karta ma miejsce na datę, wyniki serii i jedną rzecz do przećwiczenia następnym razem.',
    source: ['Rite in the Rain · notes terenowy', 'https://www.naostrzu.pl/26320%2Crite-in-the-rain---notes-wodoodporny---3-1-2x5-----954---oliwkowy-26320'],
  },
  {
    id: 'brelok-nfc', name: 'Brelok do kalendarza', spec: 'NFC · logo klubu', price: 29,
    description: 'Przyłóż telefon z NFC do breloka, aby otworzyć publiczny kalendarz SKAUT. Brelok zawiera tylko link do strony klubu.',
    source: ['CrePrint · znakowany brelok NFC', 'https://creprint.pl/'],
  },
  {
    id: 'organizer-kieszonkowy', name: 'Organizer kieszonkowy', spec: 'Zamek · elastyczne pętle', price: 69,
    description: 'Mały organizer rozkładany na płasko. Pętle trzymają ołówek, ściereczkę i zapasowe zatyczki w osobnych miejscach.',
    source: ['Helikon-Tex · organizer EDC Insert', 'https://militaria.pl/p/organizer-helikon-tex-edc-insert-medium-black-133151'],
  },
  {
    id: 'mata-serwisowa', name: 'Mata serwisowa', spec: 'Silikon · przegródki', price: 99,
    description: 'Antypoślizgowa mata z logiem klubu i przegródkami na drobiazgi. Chroni blat, a rant zapobiega staczaniu się małych części.',
    source: ['Megadron · mata z organizerem', 'https://megadron.pl/pl/products/mata-silikonowa-do-lutowania-serwisowa-z-organizerami-i-magnesami-450x300x16mm-niebieska-30667.html'],
  },
  {
    id: 'termos-klubowy', name: 'Termos klubowy', spec: '500 ml · grawer', price: 79,
    description: 'Stalowy termos z grawerowanym logiem klubu i nakrętką, która służy jako kubek. Gumowa stopka tłumi stuk przy odstawianiu.',
    source: ['Quechua · termos MH900 0,5 l', 'https://www.decathlon.pl/p/termos-turystyczny-quechua-mh900-nierdzewny-0-5-l/_/R-p-301267'],
  },
  {
    id: 'suchy-worek', name: 'Suchy worek', spec: '5 l · rolowane zamknięcie', price: 59,
    description: 'Lekki worek z logiem klubu na suche ubranie i drobiazgi. Po treningu oddziela wilgotne rzeczy od reszty wyposażenia.',
    source: ['Decathlon · worek żeglarski 5 l', 'https://www.decathlon.pl/p/worek-zeglarski-decathlon-ipx6-5-l-szczelny/349390/c241c382m8826343'],
  },
  {
    id: 'podkladka-na-wyniki', name: 'Podkładka na wyniki', spec: 'A5 · klips i ołówek', price: 39,
    description: 'Sztywna podkładka z logiem klubu, mocnym klipsem i pętlą na ołówek. W zestawie bloczek klubowych kart wyników.',
    source: ['Techrebal · podkładka A5 z grawerem', 'https://techrebal.pl/pl/p/CLIPBOARD-DREWNIANY-A5-Z-KLIPSEM-GRAWER-LOGO-KLIP/2868'],
  },
  {
    id: 'recznik-klubowy', name: 'Ręcznik klubowy', spec: '60 × 80 cm · mikrofibra', price: 39,
    description: 'Mały ręcznik szybkoschnący z wszywką SKAUT. Pętla pozwala rozwiesić go po treningu bez rozkładania całej torby.',
    source: ['Decathlon · ręcznik z mikrofibry 60 × 80 cm', 'https://www.decathlon.pl/p/recznik-z-mikrofibry-m-x-cm/_/R-p-158324?c=Czarny_Pomara%C5%84czowy+fluorescencyjny'],
  },
  {
    id: 'uchwyt-airtag', name: 'Uchwyt na AirTag', spec: 'Silikon · klips', price: 49,
    description: 'Silikonowy uchwyt z klubową wszywką i krótkim paskiem do przypięcia wewnątrz torby. Cena dotyczy uchwytu bez lokalizatora. Zawsze wiesz, gdzie zostawiłeś zabawki.',
    source: ['Belkin · uchwyt na AirTag z paskiem', 'https://www.mediaexpert.pl/smartfony-i-zegarki/akcesoria-do-telefonow/etui-na-lokalizatory/brelok-belkin-secure-holder-z-paskiem-do-apple-airtag-bialy'],
  },
  {
    id: 'karta-do-zdjec-tarcz', name: 'Karta do zdjęć tarcz', spec: 'Skala 10 cm · wielorazowa', price: 29,
    description: 'Połóż matową kartę obok tarczy przed zrobieniem zdjęcia. Podziałka daje punkt odniesienia, a zmywalne pola mieszczą datę i numer serii.',
    source: ['Grawer-Znak · tabliczka z laminatu PVC', 'https://grawer-znak.pl/pl/p/Tabliczka-z-napisami-grawerowana-30-x-10-CM-/65'],
  },
  {
    id: 'licznik-serii', name: 'Licznik serii', spec: 'Mechaniczny · bez baterii', price: 39,
    description: 'Ręczny klikacz z logiem klubu, pętlą na palec i pokrętłem zerowania. Jedno kliknięcie po każdej ukończonej serii ułatwia prowadzenie zapisków.',
    source: ['MoxTech · ręczny licznik mechaniczny', 'https://moxtech.pl/product-pol-660-Licznik-mechaniczny-klikacz-reczny-PEDOMETR.html'],
  },
];

function card(index, basket, featured = false) {
  const item = gadgets[index];
  const added = basket.includes(item.id);
  const cell = index % 6;
  const sheet = ['studio-a', 'studio-b', 'studio-c'][Math.floor(index / 6)];
  return `<article class="gadgets-card">
    <div class="gadgets-photo gadgets-photo--col-${cell % 3} gadgets-photo--row-${Math.floor(cell / 3)}">
      <img src="/assets/gadgets/${sheet}.webp" alt="" width="1536" height="1024"
           loading="${featured ? 'eager' : 'lazy'}" decoding="async">
    </div>
    <div class="gadgets-card-copy">
      <p class="gadgets-spec">${item.spec}</p>
      <h3 id="gadget-${item.id}">${item.name}</h3>
      <p>${item.description}</p>
      <p class="gadgets-price">${item.price} zł</p>
      <button type="button" class="btn gadget-add${added ? ' secondary' : ''}" data-gadget-add="${item.id}"
              aria-describedby="gadget-${item.id}">${added ? 'W koszyku' : 'Do koszyka'}</button>
    </div>
  </article>`;
}

export function gadgetsMarkup(basket = []) {
  return `<div class="gadgets-page">
    ${rangeGameMarkup()}
    <section class="gadgets-catalogue" aria-labelledby="gadgets-title">
      <header class="gadgets-intro">
        <div><p class="gadgets-kicker">Kolekcja klubowa</p><h1 id="gadgets-title">Gadżety SKAUT.</h1></div>
        <p>${gadgets.length} pomysłów na klubowe wyposażenie. Ceny są orientacyjne. Dodaj gadżety do koszyka, by zapisać swój wybór.</p>
      </header>
      <section class="gadgets-group" aria-labelledby="gadgets-featured">
        <h2 id="gadgets-featured">Torba i bluza</h2>
        <div class="gadgets-items gadgets-items--featured">${[0, 1].map(i => card(i, basket, true)).join('')}</div>
      </section>
      <section class="gadgets-group" aria-labelledby="gadgets-training">
        <h2 id="gadgets-training">Na trening</h2>
        <div class="gadgets-items">${[2, 3, 4, 6, 7, 10].map(i => card(i, basket)).join('')}</div>
      </section>
      <section class="gadgets-group" aria-labelledby="gadgets-travel">
        <h2 id="gadgets-travel">W drogę</h2>
        <div class="gadgets-items gadgets-items--travel">${[5, 8, 9, 11].map(i => card(i, basket)).join('')}</div>
      </section>
      <section class="gadgets-group" aria-labelledby="gadgets-small">
        <h2 id="gadgets-small">Małe usprawnienia</h2>
        <div class="gadgets-items">${[12, 13, 14].map(i => card(i, basket)).join('')}</div>
      </section>
      <details class="gadgets-research">
        <summary>Inspiracje i porównanie cen</summary>
        <p>Szacunki opierają się na cenach podobnych produktów w polskich sklepach oraz na zakładanym koszcie znakowania. Ostateczna wycena zależy od materiałów i wielkości zamówienia.</p>
        <ul>${gadgets.map(item => `<li><strong>${item.name}</strong> <a href="${item.source[1]}">${item.source[0]}</a></li>`).join('')}</ul>
      </details>
    </section>
  </div>`;
}

export function gadgetsInBasket(ids) {
  return ids.map(id => gadgets.find(item => item.id === id)).filter(Boolean);
}

export function gadgetBasketMarkup(items) {
  if (!items.length) return '';
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return `<section class="gadget-basket" aria-labelledby="gadget-basket-title">
    <div class="basket-layout">
      <div>
        <h2 id="gadget-basket-title" tabindex="-1">Gadżety klubowe</h2>
        ${items.map(item => `<article class="basket-item">
          <div>
            <h3>${item.name}</h3>
            <button type="button" class="text-button remove-item" data-gadget-remove="${item.id}"
                    aria-label="Usuń z koszyka: ${item.name}">Usuń z koszyka</button>
          </div>
          <strong>${item.price} zł</strong>
        </article>`).join('')}
      </div>
      <aside class="summary">
        <h2>Podsumowanie gadżetów</h2>
        <div class="total"><span>Suma orientacyjna</span><span>${total} zł</span></div>
        <p>Gadżety są zapisane w tej przeglądarce. Sprzedaż online jest niedostępna.</p>
        <a class="btn secondary" href="/gadzety">Wróć do gadżetów</a>
      </aside>
    </div>
  </section>`;
}

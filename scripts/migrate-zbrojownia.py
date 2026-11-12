#!/usr/bin/env python3
"""Snapshot the public event and shop pages. Run with beautifulsoup4, lxml and Pillow.

Only public event, catalogue and information paths are fetched. WordPress
attendee, account, checkout and booking data are outside the content inventory.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, time, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import html
import io
import json
from pathlib import Path
import re
import time as delay
from urllib.error import HTTPError
from urllib.parse import parse_qs, quote, unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup, Comment
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.zbrojownia.ksskaut.pl'
SOURCE_HOSTS = {'zbrojownia.ksskaut.pl', 'www.zbrojownia.ksskaut.pl'}
WORK = ROOT / '.local/zbrojownia'
RAW = WORK / 'raw'
DATA = ROOT / 'public/zbrojownia'
ASSETS = ROOT / 'public/assets/zbrojownia'
WARSAW = ZoneInfo('Europe/Warsaw')
MONTHS = 'stycznia lutego marca kwietnia maja czerwca lipca sierpnia września października listopada grudnia'.split()
INFO = {'about','blog','regulamin','o-sklepie','polityka-cookies','ubrania-i-gadzety'}
ALLOWED = set('p h2 h3 h4 h5 h6 ul ol li a table thead tbody tfoot tr td th strong b em i br blockquote hr sup sub figure figcaption pre code img'.split())
BLOCKED = 'script,style,form,object,iframe,noscript,svg,template,button,select,textarea,input'
MEDIA = re.compile(r'\.(?:avif|gif|jpe?g|png|webp|pdf)$', re.I)


def key(url):
    return hashlib.sha256(url.encode()).hexdigest()


def fetch(url, limit=2_500_000):
    cache = RAW / (key(url) + '.source')
    if cache.exists():
        return cache.read_bytes()
    for attempt in range(3):
        try:
            request = Request(url, headers={'User-Agent':'SKAUT content migration (+https://skaut.korzeniowski.net/)'})
            with urlopen(request, timeout=20) as response:
                final = urlsplit(response.url)
                if final.hostname not in SOURCE_HOSTS or '/events/' in url and final.path.rstrip('/') != urlsplit(url).path.rstrip('/'):
                    raise ValueError('Unexpected final URL '+final.path)
                data = response.read(limit + 1)
                if len(data) > limit:
                    raise ValueError('Response exceeds download limit')
                cache.write_bytes(data)
                return data
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except OSError:
            if attempt == 2:
                raise
        delay.sleep(2 + attempt * 3)


def urls_in(url):
    return [item.find('{*}loc').text for item in ET.fromstring(fetch(url))]


def inventory():
    lists = {'events': [], 'pages': [], 'products': []}
    for sitemap in urls_in(ORIGIN+'/wp-sitemap.xml'):
        match = re.fullmatch(r'/wp-sitemap-posts-(mep_events|page|product)-\d+\.xml', urlsplit(sitemap).path)
        if not match or urlsplit(sitemap).hostname not in SOURCE_HOSTS:
            continue
        for url in urls_in(sitemap):
            parts = urlsplit(url)
            slug = parts.path.strip('/').rsplit('/',1)[-1]
            if parts.hostname not in SOURCE_HOSTS or parts.scheme != 'https' or parts.query:
                continue
            if match[1] == 'mep_events' and re.fullmatch(r'/events/[\w%-]+/',parts.path):
                lists['events'].append(url)
            if match[1] == 'page' and slug in INFO:
                lists['pages'].append(url)
            if match[1] == 'product' and re.fullmatch(r'/produkt/[a-z0-9-]+/',parts.path) and not re.fullmatch(r'[0-9a-f]{8,}',slug):
                lists['products'].append(url)
    return lists


def readable(element):
    return ' '.join(element.stripped_strings).strip() if element else ''


def pick(soup, selector):
    return readable(soup.select_one(selector))


def slug_of(url):
    return quote(unquote(urlsplit(url).path.strip('/').rsplit('/',1)[-1]), safe='-_%')


def money_cents(value):
    try:
        amount = Decimal(value.strip().replace(' ', '').replace('\u00a0','').replace(',','.'))
        return int(amount * 100) if amount.is_finite() and 0 <= amount <= 100_000 else None
    except (AttributeError, InvalidOperation):
        return None


def price_text(value):
    match = re.search(r'(\d[\d\s]*(?:,\d{2}))\s*zł', value)
    return money_cents(match[1]) if match else None


def event_day(value):
    if match := re.search(r'\b(\d{1,2})\s+('+ '|'.join(MONTHS) + r'),?\s+(20\d{2})\b', value.lower()):
        try:
            return date(int(match[3]), MONTHS.index(match[2])+1, int(match[1])).isoformat()
        except ValueError:
            return ''
    if match := re.search(r'\b(20\d{2})[-.](\d{2})[-.](\d{2})\b', value):
        try:
            return date(*map(int, match.groups())).isoformat()
        except ValueError:
            return ''
    if match := re.search(r'\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b', value):
        try:
            return date(int(match[3]),int(match[2]),int(match[1])).isoformat()
        except ValueError:
            return ''
    return ''


def event_type(title):
    for regex, name in [
        (r'(^zawody|\bmemoriał\b|\bmistrzostwa\b|\bpuchar\b)', 'zawody'),
        (r'pierwszy raz|dla początkujących', 'pierwszy-raz'), (r'szkoleni|kurs', 'szkolenia'),
        (r'karabin|rifle|\bpcc\b|long range', 'karabin'),
        (r'strzelb|shotgun|\btrap\b|popper', 'strzelba'),
        (r'pistolet|\bpsp\b', 'pistolet'), (r'\bipsc\b', 'ipsc'),
    ]:
        if re.search(regex,title,re.I):
            return name
    return 'inne'


def clean_url(value, source):
    if not value or not value.strip():
        return ''
    target=urlsplit(urljoin(source,html.unescape(value).strip()))
    if target.scheme in ('https','http','mailto','tel') and not target.username and not target.password:
        return urlunsplit(target)
    return ''


def media_url(value, source):
    target=urlsplit(clean_url(value, source))
    if target.hostname in SOURCE_HOSTS and target.path.startswith('/wp-content/uploads/') and MEDIA.search(target.path):
        return urlunsplit(('https','www.zbrojownia.ksskaut.pl',target.path,'',''))
    return ''


def collect(url, kind):
    source_file = RAW / (key(url)+'.source')
    if not source_file.exists():
        return None, 'missing'
    soup = BeautifulSoup(source_file.read_bytes(), 'lxml', from_encoding='utf-8')
    slug = slug_of(url)
    if soup.select_one('.post-password-form') or re.match(r'(zabezpieczone|chronione|protected):',readable(soup.title),re.I):
        return None, 'protected'
    record={'slug':slug,'url':url}
    if kind=='events':
        title = pick(soup,'.mep-default-title h2, .mep-default-title h1, .mep-event-title, h1.entry-title, .mep-events-wrapper h1')
        body = soup.select_one('.mpwem_details_content, .mep-default-feature-content, .mep-event-details, .mep_event_content')
        if not title and soup.select_one('body.single-mep_events'):
            title = readable(soup.title).split(' – Zbrojownia')[0].strip()
        if not title or not body:
            return None, 'unparsed'
        date_input = soup.select_one('[name="mep_event_start_date[]"], #mpwem_date_time')
        date_value = str(date_input.get('value','')) if date_input else ''
        day = event_day(date_value) or event_day(pick(soup,'.mep_date_scdl_start_datetime, .mep-default-feature-date p')) or event_day(title)
        clock_text = date_value or pick(soup,'.mep-default-feature-time p, .mep-more-date p:nth-child(2)')
        clock = re.search(r'\b(?:[01]\d|2[0-3]):[0-5]\d\b',clock_text)
        start_time = clock[0] if clock else None
        starts = datetime.combine(date.fromisoformat(day),time.fromisoformat(start_time),WARSAW).astimezone(timezone.utc).isoformat().replace('+00:00','Z') if day and start_time else day+'T12:00:00Z' if day else None
        tickets=[]
        extras=[]
        for ticket in soup.select('.mep_ticket_item'):
            name=pick(ticket,'.ticket-name')
            price=ticket.select_one('[data-price]')
            amount=money_cents(price.get('data-price','')) if price else price_text(pick(ticket,'.ticket-price'))
            if name and amount is not None:
                group=extras if ticket.find_parent(class_='mpwem_ex_service') else tickets
                group.append({'name':name,'price':amount,'description':pick(ticket,'.ticket-description')})
        loc_input=soup.select_one('[name=mep_event_location_cart]')
        location=pick(soup,'.location-widgets p, .mep-default-feature-location p') or (loc_input.get('value','') if loc_input else '')
        record.update(title=title, day=day, startTime=start_time, startsAt=starts, type=event_type(title), location=location,
            organizer=pick(soup,'.mep-org-details .org-name strong'), tickets=tickets, extras=extras,
            price=min((ticket['price'] for ticket in tickets),default=None),
            priceFrom=len({ticket['price'] for ticket in tickets})>1,
            listed=not re.search(r'^dopłaty|^cegiełki|^obsługa\b',title,re.I))
        cover=soup.select_one('meta[property="og:image"]')
        images=[node.get('src') for node in soup.select('.mpwem_slider_area img') if node.get('src')]
        if cover and cover.get('content') and not images:
            images=[cover['content']]
        record['pictures']=images
    elif kind=='products':
        title=pick(soup,'.product_title, h1.entry-title')
        if not title or not soup.select_one('body.single-product'):
            return None,'unparsed'
        body=soup.select_one('.woocommerce-Tabs-panel--description')
        summary=soup.select_one('.woocommerce-product-details__short-description')
        if summary and body:
            body.insert(0,summary)
        elif summary:
            body=summary
        price=price_text(pick(soup,'.summary p.price, .summary .price'))
        images=[node.get('data-large_image') or node.get('src') for node in soup.select('.woocommerce-product-gallery img')]
        record.update(title=title,price=price,pictures=[x for x in images if x],category=pick(soup,'.posted_in a'))
        variations=soup.select_one('[data-product_variations]')
        if variations:
            try:
                data=json.loads(variations['data-product_variations'])
                record['variants']=[{'name':', '.join(str(v) for v in entry['attributes'].values() if v),'price':money_cents(str(entry['display_price']))} for entry in data if isinstance(entry,dict)]
            except (ValueError,TypeError,KeyError):
                pass
    else:
        title=pick(soup,'h1.page-title, h1.entry-title, .title-bar h1, .page-title') or readable(soup.title).split(' – Zbrojownia')[0]
        body=soup.select_one('.real-content')
        if not title or not body:
            return None,'unparsed'
        record.update(title=title,pictures=[])
    record['body']=body
    return record,None


def media_file(url):
    path = urlsplit(url).path
    stem = key(url)[:24]
    ext = '.pdf' if path.lower().endswith('.pdf') else '.webp'
    output = ASSETS / (stem+ext)
    if not output.exists():
        data = fetch(url, 18_000_000)
        if ext=='.pdf':
            if not data.startswith(b'%PDF-'):
                raise ValueError('Invalid PDF')
            output.write_bytes(data)
        else:
            with Image.open(io.BytesIO(data)) as img:
                image=ImageOps.exif_transpose(img)
                image.thumbnail((1440,1440),Image.Resampling.LANCZOS)
                image.convert('RGBA' if 'A' in image.getbands() else 'RGB').save(output,'WEBP',quality=81,method=4)
    return '/assets/zbrojownia/'+output.name


def scrub(body, source, links, media):
    if not body:
        return ''
    for node in body.select(BLOCKED):
        node.decompose()
    for comment in body.find_all(string=lambda s:isinstance(s,Comment)):
        comment.extract()
    for node in list(body.find_all(True)):
        if node.name not in ALLOWED:
            if node.name=='h1':
                node.name='h2'
            else:
                node.unwrap()
                continue
        attrs=dict(node.attrs)
        node.attrs={}
        if node.name=='img':
            image=media.get(media_url(attrs.get('src') or attrs.get('data-src'),source))
            if not image:
                node.replace_with(attrs.get('alt') or '')
                continue
            node.attrs={'src':image,'alt':attrs.get('alt') or '','loading':'lazy','decoding':'async'}
        if node.name=='a':
            url=clean_url(attrs.get('href'),source)
            if not url and re.fullmatch(r'[A-Z0-9._%+-]+@ksskaut\.pl',readable(node),re.I):
                url='mailto:'+readable(node)
            u=urlsplit(url)
            if u.hostname in SOURCE_HOSTS:
                old_event=parse_qs(u.query).get('mep_events',[''])[0]
                old_path='/events/'+old_event if old_event else u.path.rstrip('/') or '/'
                dest=media.get(media_url(url,source)) or links.get(old_path)
                if not dest and u.path.startswith(('/mep_cat/','/mep_org/')):
                    dest='/wydarzenia'
                if not dest and u.path.startswith(('/kategoria-produktu/','/tag-produktu/')):
                    dest='/sklep'
                url=dest or ''
            if not url:
                node.unwrap()
                continue
            node['href']=url
            if url.startswith(('http:','https:')):
                node['rel']='noreferrer'
        if node.name in ('td','th'):
            for name in ('colspan','rowspan'):
                value=str(attrs.get(name,''))
                if value.isdigit() and 0<int(value)<100:
                    node[name]=value
    return body.decode_contents()


def save(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')


def save_catalogue(products):
    catalogue = []
    for product in products:
        card = {key: product[key] for key in ('path', 'title', 'price', 'image') if key in product}
        cover = card.get('image')
        if cover and cover.endswith('.webp'):
            original = ASSETS / Path(cover).name
            with Image.open(original) as image:
                if image.width > 640:
                    preview = original.with_name(original.stem + '-640.webp')
                    image.thumbnail((640, image.height), Image.Resampling.LANCZOS)
                    image.save(preview, 'WEBP', quality=78, method=6)
                    card['thumbnail'] = '/assets/zbrojownia/' + preview.name
        catalogue.append(card)
    save(DATA / 'catalogue.json', catalogue)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build-only',action='store_true',help='Use the saved sitemap and HTML')
    parser.add_argument('--skip-media',action='store_true',help='Build a local preview without downloading media')
    args=parser.parse_args()
    for path in (WORK,RAW,DATA,ASSETS):
        path.mkdir(parents=True,exist_ok=True)
    manifest=WORK/'inventory.json'
    lists=json.loads(manifest.read_text()) if args.build_only else inventory()
    if not args.build_only:
        save(manifest,lists)
        with ThreadPoolExecutor(max_workers=8) as pool:
            requests={pool.submit(fetch,url):url for urls in lists.values() for url in urls}
            for result in as_completed(requests):
                try:result.result()
                except Exception as error:print('Source unavailable',requests[result],error,flush=True)
    records={}; excluded={}
    for kind, urls in lists.items():
        records[kind]=[]
        for url in urls:
            record, reason=collect(url,kind)
            if reason:
                excluded[url]=reason
            else:
                records[kind].append(record)
    links={'/':'/wydarzenia','/moje-konto':'/moj-skaut','/koszyk':'/koszyk','/zamowienie':'/koszyk','/sklep':'/sklep'}
    for kind, entries in records.items():
        for record in entries:
            route={'events':'/wydarzenia/','products':'/sklep/','pages':'/sklep/informacje/'}[kind]
            record['path']=route+record['slug']
            links[urlsplit(record['url']).path.rstrip('/')]=record['path']
    aliases={}
    old_checks=WORK/'older-failures.json'
    if old_checks.exists():
        for url, status in json.loads(old_checks.read_text()).items():
            if status.startswith('Unexpected final URL /events/'):
                target=links.get(status.removeprefix('Unexpected final URL ').rstrip('/'))
                if target:
                    slug=slug_of(url)
                    aliases[slug]=target
                    links['/events/'+slug]=target
    listing=WORK/'home.html'
    if not args.build_only:
        listing.write_bytes(fetch(ORIGIN+'/'))
    if listing.exists():
        home=BeautifulSoup(listing.read_bytes(),'lxml',from_encoding='utf-8')
        current_prices={}
        for card in home.select('.mep-event-list-loop'):
            anchor=card.select_one('.mep_list_event_details a[href]')
            price=pick(card,'.mep_list_date')
            if anchor and (amount:=price_text(price)) is not None:
                current_prices[slug_of(anchor['href'])]=(amount,'cena od' in price.lower())
        for event in records['events']:
            if event['slug'] in current_prices:
                event['price'],event['priceFrom']=current_prices[event['slug']]
    media_sources=set()
    for entries in records.values():
        for record in entries:
            body=record['body']
            candidates=list(record['pictures'])
            if body:
                candidates += [node.get('src') or node.get('data-src') for node in body.select('img')]
                candidates += [node.get('href') for node in body.select('a[href]')]
            media_sources.update(url for item in candidates if item and (url:=media_url(item,record['url'])))
    print('Records', {kind:len(items) for kind,items in records.items()},'media',len(media_sources),'excluded',len(excluded),flush=True)
    media={}; bad_media={}
    if not args.skip_media:
        with ThreadPoolExecutor(max_workers=8) as pool:
            requests={pool.submit(media_file,url):url for url in media_sources}
            for result in as_completed(requests):
                url=requests[result]
                try:media[url]=result.result()
                except Exception as error:bad_media[url]=str(error)
    index={kind:[] for kind in records}
    detail={}
    for kind, entries in records.items():
        for item in entries:
            urls=item.pop('pictures')
            source=item.pop('url')
            photos=list(dict.fromkeys(media[url] for candidate in urls if (url:=media_url(candidate,source)) in media))
            body=scrub(item.pop('body'),source,links,media)
            item['image']=photos[0] if photos else ''
            summary={k:v for k,v in item.items() if k not in ('tickets','extras','variants','organizer')}
            index[kind].append(summary)
            bundle=item['day'][:4] or 'undated' if kind=='events' else kind
            detail.setdefault(bundle,{})[item['slug']]={**item,'body':body,'images':photos}
    index['events'].sort(key=lambda row:row['startsAt'] or '',reverse=True)
    save(DATA/'index.json',{**index,'aliases':aliases})
    save_catalogue(index['products'])
    today = datetime.now(WARSAW).date().isoformat()
    schedule = [item for item in reversed(index['events']) if item['listed'] and item['day'] >= today]
    save(DATA/'schedule.json',schedule)
    for bundle,items in detail.items():
        save(DATA/(bundle+'.json'),items)
    save(WORK/'report.json',{'excluded':excluded,'mediaUnavailable':bad_media,'counts':{k:len(v) for k,v in index.items()},'media':len(media)})
    print('Built archive with',len(media),'local assets.',flush=True)


if __name__=='__main__':
    main()

#!/usr/bin/env python3
"""Migrate the authorised public WordPress archive, without copying its theme/scripts.

Input snapshots live in ignored .local/source. Re-run only after reviewing source
changes. Existing generated documents are cached; failures retain the source URL.
"""
import concurrent.futures
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.local/source'
PUBLIC = ROOT / 'public'
CONTENT = ROOT / 'content'
ORIGIN = 'https://ksskaut.pl'
DOC = re.compile(r'\.(pdf|docx?|xlsx?|od[ts]|csv|zip)(?:[?#]|$)', re.I)


def canonical(url):
    u = urllib.parse.urlsplit(html.unescape(urllib.parse.urljoin(ORIGIN, url)))
    return urllib.parse.urlunsplit(('https' if u.hostname in ('ksskaut.pl', 'www.ksskaut.pl') else u.scheme,
                                   'ksskaut.pl' if u.hostname == 'www.ksskaut.pl' else u.netloc,
                                   urllib.parse.quote(urllib.parse.unquote(u.path), safe='/@:+'), u.query, ''))


class CleanHTML(HTMLParser):
    allowed = set('p h2 h3 h4 h5 h6 ul ol li a table thead tbody tfoot tr td th strong b em i br blockquote hr sup sub figure figcaption pre code'.split())
    void = {'br', 'hr'}
    blocked = {'script', 'style', 'form', 'object', 'iframe', 'noscript', 'svg'}

    def __init__(self, links):
        super().__init__(convert_charrefs=True)
        self.links = links
        self.output = []
        self.depth = 0
        self.stack = []

    def href(self, value):
        if not value:
            return None
        value = html.unescape(value).strip()
        if value.startswith('#'):
            return None
        if urllib.parse.urlsplit(value).scheme.lower() in ('mailto', 'tel'):
            return value
        url = canonical(value)
        if urllib.parse.urlsplit(url).scheme not in ('http', 'https'):
            return None
        return self.links.get(url, url)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in self.blocked:
            if not self.depth and tag == 'iframe' and (href := self.href(attrs.get('src'))):
                self.output.append(f'<p><a href="{html.escape(href, quote=True)}">Otwórz materiał źródłowy</a></p>')
            self.depth += 1
            return
        if self.depth:
            return
        if tag == 'img':
            if href := self.href(attrs.get('src')):
                label = attrs.get('alt') or 'Fotografia lub materiał z archiwum'
                self.output.append(f'<span> <a href="{html.escape(href, quote=True)}">{html.escape(label)}</a> </span>')
            return
        if tag not in self.allowed:
            return
        safe = ''
        if tag == 'a':
            if href := self.href(attrs.get('href')):
                safe = f' href="{html.escape(href, quote=True)}"'
        if tag in ('td', 'th'):
            for attr in ('colspan', 'rowspan'):
                if attrs.get(attr, '').isdigit() and 0 < int(attrs[attr]) < 100:
                    safe += f' {attr}="{attrs[attr]}"'
        self.output.append('<' + tag + safe + '>')
        if tag not in self.void:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.blocked:
            self.depth = max(0, self.depth - 1)
            return
        if self.depth or tag not in self.stack:
            return
        while self.stack:
            current = self.stack.pop()
            self.output.append('</' + current + '>')
            if current == tag:
                break

    def handle_data(self, value):
        if not self.depth:
            self.output.append(html.escape(value))

    def result(self):
        return ''.join(self.output) + ''.join('</' + t + '>' for t in reversed(self.stack))


def clean(value, links):
    parser = CleanHTML(links)
    parser.feed(value)
    return parser.result()


class Plain(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_endtag(self, tag):
        if tag in ('p', 'h2', 'h3', 'h4', 'li', 'tr', 'div'):
            self.parts.append('\n\n')


def plain(value):
    p = Plain()
    p.feed(value)
    return re.sub(r'\n\s*\n(?:\s*\n)+', '\n\n', ''.join(p.parts)).strip()


def get_document(url):
    parsed = urllib.parse.urlsplit(url)
    relative = Path('dokumenty') / urllib.parse.unquote(parsed.path).lstrip('/')
    if '..' in relative.parts:
        return {'source': url, 'status': 'unsafe-path'}
    target = PUBLIC / relative
    try:
        if not target.exists():
            request = urllib.request.Request(url, headers={'User-Agent': 'SKAUT-authorised-migration/1.0'})
            with urllib.request.urlopen(request, timeout=40) as response:
                data = response.read(40 * 1024 * 1024 + 1)
                if len(data) > 40 * 1024 * 1024 or 'text/html' in response.headers.get('Content-Type', ''):
                    raise ValueError('Not a downloadable document')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        data = target.read_bytes()
        return {'source': url, 'path': '/' + relative.as_posix(), 'status': 'saved',
                'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    except Exception as exc:
        return {'source': url, 'status': 'source-unavailable', 'error': str(exc)}


def main():
    pages = json.loads((SOURCE / 'pages.json').read_text())
    posts = json.loads((SOURCE / 'posts.json').read_text())
    categories = json.loads((SOURCE / 'categories.json').read_text())
    tags = json.loads((SOURCE / 'tags.json').read_text())
    source_events = json.loads((SOURCE / 'events.json').read_text()).get('events', []) if (SOURCE / 'events.json').exists() else []
    events = [{'id': e['id'], 'slug': 'wydarzenie-' + e['slug'], 'link': e['url'], 'type': 'event',
               'title': {'rendered': e['title']}, 'date': e['start_date'],
               'content': {'rendered': '<p>Termin archiwalny: ' + html.escape(e['start_date']) + ' (' + html.escape(e['timezone']) + ').</p>' + e['description']}}
              for e in source_events]
    links = {}
    redirects = {'/events': '/kalendarz', '/events/': '/kalendarz'}
    for item in pages + posts + events:
        target = '/archiwum/' + item['slug'] + '.html'
        links[canonical(item['link'])] = target
        parsed = urllib.parse.urlsplit(item['link'])
        redirects[parsed.path] = target
        redirects['/?' + ('page_id=' if item['type'] == 'page' else 'p=') + str(item['id'])] = target
    documents = set()
    for item in pages + posts + events:
        for url in re.findall(r'(?:href|src)=[\"\']([^\"\']+)', item['content']['rendered']):
            url = canonical(url)
            if DOC.search(url) and urllib.parse.urlsplit(url).hostname == 'ksskaut.pl':
                documents.add(url)
    print('Fetching', len(documents), 'referenced club documents', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        document_rows = list(pool.map(get_document, sorted(documents)))
    for row in document_rows:
        if row['status'] == 'saved':
            links[row['source']] = row['path']
            redirects[urllib.parse.unquote(urllib.parse.urlsplit(row['source']).path)] = row['path']
    for taxonomy, rows in [('category', categories), ('tag', tags)]:
        for row in rows:
            target = '/archiwum/' + taxonomy + '-' + row['slug'] + '.html'
            links[canonical(row['link'])] = target
            redirects[urllib.parse.urlsplit(row['link']).path] = target
    for page in range(2, 34):
        redirects[f'/page/{page}/'] = '/archiwum/index.html'
    links[ORIGIN + '/'] = '/archiwum/index.html'
    for key, target in redirects.items():
        links[canonical(key)] = target
    shell = (PUBLIC / 'index.html').read_text().replace('<script type="module" src="/app.js"></script>', '<script src="/archive.js" defer></script>\n <link rel="stylesheet" href="/archive.css">')
    shell = shell.replace('<a href="/informacje">Informacje o projekcie</a>', '<a href="/klub">Dokumenty i informacje klubu</a>')
    (PUBLIC / 'archiwum').mkdir(exist_ok=True)
    CONTENT.mkdir(exist_ok=True)

    def write_page(path, title, body, source=ORIGIN):
        provenance = f'<p class="notice">Archiwum treści klubu · kopia z 7 listopada 2026. Zachowano daty i informacje historyczne. <a href="{html.escape(source, quote=True)}">Oryginalna publikacja</a>.</p>'
        article = f'<article class="article archive"><a class="text-link" href="/archiwum/index.html">Wszystkie treści klubu</a><h1>{html.escape(title)}</h1>{provenance}<div class="archive-content">{body}</div></article>'
        output = shell.replace('<main id="main" tabindex="-1"></main>', '<main id="main" tabindex="-1">' + article + '</main>')
        output = re.sub(r'<title>.*?</title>', lambda _: '<title>' + html.escape(title) + ' — SKAUT</title>', output)
        output = re.sub(r'<meta name="description"[^>]*>', '', output)
        (PUBLIC / path.lstrip('/')).write_text('\n'.join(line.rstrip() for line in output.splitlines()) + '\n')

    news = []
    category_names = {row['id']: plain(row['name']) for row in categories}
    for item in pages + posts + events:
        target = links[canonical(item['link'])]
        body = clean(item['content']['rendered'], links)
        title = plain(item['title']['rendered'])
        if item['slug'] == 'kontakt':
            body += '<p>W sprawach klubowych: <a href="mailto:zarzad@ksskaut.pl">zarzad@ksskaut.pl</a>. Formularz ze starego serwisu nie jest tu aktywny.</p>'
        write_page(target, title, body, item['link'])
        if item['type'] == 'post':
            summary = re.sub(r'\s+', ' ', plain(item['excerpt']['rendered'])).removesuffix('[…]').strip()[:390]
            news.append({'id': 'wp-' + str(item['id']), 'slug': item['slug'], 'title': title,
                         'summary': summary, 'body': plain(body),
                         'category': category_names.get(next(iter(item.get('categories', [])), 0), 'Klub'),
                         'image': '/assets/range-side.webp', 'published_at': item['date_gmt'] + 'Z',
                         'pinned': int(bool(item.get('sticky'))), 'source': item['link'], 'archive': target})

    def listing(items):
        return '<ul>' + ''.join('<li><a href="' + html.escape(links[canonical(i['link'])], quote=True) + '">' + html.escape(plain(i['title']['rendered'])) + '</a>' + (' · ' + i['date'][:10] if i['type'] == 'post' else '') + '</li>' for i in items) + '</ul>'

    write_page('/archiwum/index.html', 'Archiwum klubu', '<h2>Informacje i dokumenty</h2>' + listing(pages) + '<h2>Aktualności — pełne archiwum</h2>' + listing(posts) + '<h2>Historyczny kalendarz wydarzeń</h2>' + listing(events))
    for taxonomy, rows, field in [('category', categories, 'categories'), ('tag', tags, 'tags')]:
        for row in rows:
            write_page('/archiwum/' + taxonomy + '-' + row['slug'] + '.html', plain(row['name']), listing([p for p in posts if row['id'] in p[field]]), row['link'])
    (CONTENT / 'news.json').write_text(json.dumps(news, ensure_ascii=False, indent=2) + '\n')
    (CONTENT / 'redirects.json').write_text(json.dumps(redirects, ensure_ascii=False, indent=2) + '\n')
    manifest = {'source': ORIGIN, 'retrieved': '2026-11-07', 'pages': len(pages), 'posts': len(posts),
                'categories': len(categories), 'tags': len(tags), 'historicalEvents': len(events), 'documents': document_rows,
                'sourcePages': [{'id': p['id'], 'url': p['link'], 'path': links[canonical(p['link'])], 'title': plain(p['title']['rendered'])} for p in pages + posts + events],
                'limitations': ['Current source calendar returned zero upcoming events; historical events are archived, not bookable. No capacity or prices were invented.',
                                'External documents and unavailable source files retain original links.',
                                'Decorative images were replaced; historical gallery photos remain linked to the source.',
                                'The original ksskaut.pl server is unchanged; redirects apply on the new domain.']}
    (CONTENT / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('Generated', len(news), 'news articles,', len(pages), 'pages;', sum(r['status'] == 'saved' for r in document_rows), '/', len(document_rows), 'documents saved', flush=True)
    for row in document_rows:
        if row['status'] != 'saved':
            print('Unavailable:', row['source'], row.get('error', ''))


if __name__ == '__main__':
    main()

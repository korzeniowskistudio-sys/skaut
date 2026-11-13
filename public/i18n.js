const polishToEnglish = new Map([
  ['/klub','/club'], ['/treningi','/training'], ['/kalendarz','/calendar'],
  ['/aktualnosci','/news'], ['/galeria','/gallery'], ['/gadzety','/gadgets'],
  ['/moj-skaut','/my-skaut'], ['/koszyk','/basket'], ['/informacje','/about'],
  ['/admin','/admin'], ['/wydarzenia','/events'], ['/sklep','/shop'],
]);
const englishToPolish = new Map([...polishToEnglish].map(([pl,en]) => [en,pl]));
const englishPrefix = /^\/en(?:\/|$)/;

export const english = englishPrefix.test(globalThis.location?.pathname || '');
export const locale = english ? 'en-GB' : 'pl-PL';
const {englishText, englishNews} = english ? await import('./english.js?v=20261113-ui-sound') : {};

export function t(source) {
  return english && Object.hasOwn(englishText,source) ? englishText[source] : source;
}

export function tr(parts,...values) {
  const key = parts.map((part,i) => part + (i < values.length ? '{'+i+'}' : '')).join('');
  return t(key).replace(/\{(\d+)\}/g, (_,i) => String(values[i]));
}

/** Return the original router path; keep article slugs and language-neutral IDs. */
export function localPath(pathname) {
  const path = (englishPrefix.test(pathname) ? pathname.slice(3) : pathname).replace(/\/+$/, '');
  const [,first,...rest] = path.split('/');
  const base = '/'+(first || '');
  return (englishToPolish.get(base) || base) + (rest.length ? '/'+rest.join('/') : '');
}

/** Translate site paths only. Media, APIs, downloads and archived documents stay put. */
export function sitePath(url, useEnglish = english) {
  if (!/^\/(?!\/)/.test(url)) return url;
  const [,pathname,suffix] = url.match(/^([^?#]*)(.*)$/);
  const path = localPath(pathname);
  if (path === '/') return (useEnglish ? '/en' : '/') + suffix;
  const [,first,...rest] = path.split('/');
  const base = '/'+first;
  if (!polishToEnglish.has(base)) return url;
  return (useEnglish ? '/en'+polishToEnglish.get(base) : base) +
    (rest.length ? '/'+rest.join('/') : '') + suffix;
}

export function localizeLinks(root) {
  if (!english) return;
  for (const link of root.querySelectorAll('a[href]:not([data-language-switch])')) {
    const href = link.getAttribute('href');
    const localized = sitePath(href);
    if (localized !== href) link.setAttribute('href', localized);
  }
}

export function initLanguage() {
  document.documentElement.lang = english ? 'en' : 'pl';
  if (english) {
    const roots = document.querySelectorAll('header.header, .footer, .skip-link, #demo-notice');
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, value = node.data.trim();
        if (value) node.data = node.data.replace(value, t(value));
      }
      for (const element of [root,...root.querySelectorAll('[aria-label],[alt]')]) {
        for (const attr of ['aria-label','alt']) {
          if (element.hasAttribute(attr)) element.setAttribute(attr,t(element.getAttribute(attr)));
        }
      }
    }
    document.querySelector('meta[name="description"]').content = 'SKAUT Shooting Club: training, events and your My SKAUT account. Find your next session and build your skills.';
    document.title = 'SKAUT — Your next target';
    localizeLinks(document);
  }
  updateLanguageSwitch();
}

export function updateLanguageSwitch() {
  const link = document.querySelector('[data-language-switch]');
  if (!link) return;
  const current = location.pathname + location.search + location.hash;
  const target = sitePath(current,!english);
  link.href = target === current ? (english ? '/' : '/en') : target;
  link.textContent = english ? 'PL' : 'EN';
  link.lang = link.hreflang = english ? 'pl' : 'en';
  link.setAttribute('aria-label', english ? 'Polski' : 'English');

  // Give search engines the matching page in each language, without user filters.
  for (const language of ['pl','en']) {
    const href = sitePath(location.pathname,language === 'en');
    const selector = 'link[rel="alternate"][hreflang="'+language+'"]';
    let alternate = document.head.querySelector(selector);
    if (sitePath(location.pathname,true) === sitePath(location.pathname,false)) {
      alternate?.remove();
      continue;
    }
    if (!alternate) {
      alternate = document.createElement('link');
      alternate.rel = 'alternate';
      alternate.hreflang = language;
      document.head.append(alternate);
    }
    alternate.href = href;
  }
}

/** Only show an English summary while it still matches the source announcement. */
export function localizedPost(post) {
  if (!english) return post;
  const translation = Object.hasOwn(englishNews,post.id) ? englishNews[post.id] : undefined;
  const match = translation && post.title === translation.sourceTitle && post.summary === translation.sourceSummary;
  const title = match ? translation.title : t(post.title);
  const summary = match ? translation.summary : t(post.summary);
  const body = match ? translation.body : t(post.body);
  return {...post,title,summary,body,
    sourceTitle:post.title, sourceSummary:post.summary,
    lang:match || title !== post.title ? 'en' : 'pl',
  };
}

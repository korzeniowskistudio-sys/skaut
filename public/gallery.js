import {t, tr, locale, sitePath} from './i18n.js?v=20261107-english';
import {esc} from './ui.js?v=20261107-english';

const BATCH = 36;
const localMedia = value => typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\u0000-\u001f\\]/.test(value);
const icon = name => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
const number = value => new Intl.NumberFormat(locale).format(value);
// Keep the official photo order; these three covers show participants more
// clearly than their first frame (obscured podium, distant mesh, empty hall).
const albumCoverIds = {'source-post-6746': '6853', 'source-post-6483': '6522', 'source-post-7304': '7382'};
const validVariants = variants => {
  if (!Array.isArray(variants)) return [];
  const widths = new Set();
  return variants.filter(variant => {
    if (!variant || !localMedia(variant.src) || /[\s,]/.test(variant.src) || !Number.isInteger(variant.width) || variant.width < 1 || variant.width > 8192 || widths.has(variant.width)) return false;
    widths.add(variant.width);
    return true;
  }).sort((a, b) => a.width - b.width);
};
const sourceSet = variants => variants.map(variant => `${variant.src} ${variant.width}w`).join(', ');
const VIEWER_SIZES = '(max-width: 660px) calc(100vw - 16px), (min-width: 1840px) 1652px, calc(100vw - 188px)';

// Match the wall's column spans, gutters and breakpoints without loading large originals.
function wallSizes(index, collection) {
  const ordinal = index + 1;
  let columns = collection === 'all' ? 3 : 4;
  if (collection === 'all') {
    if ([6, 7].includes(ordinal % 12)) columns = 6;
    if ([10, 11, 0].includes(ordinal % 12)) columns = 4;
  } else {
    if ([5, 6].includes(ordinal % 10)) columns = 6;
    if (ordinal % 10 === 7) columns = 8;
  }
  if (ordinal === 1) columns = 8;
  const mobile = ordinal === 1 || (ordinal >= 6 && (ordinal - 6) % 7 === 0) ? 'calc(100vw - 44px)' : 'calc(50vw - 28px)';
  const span = gap => `calc((min(100vw, 1920px) - clamp(44px, 6.4vw, 128px) - ${gap * 11}px) / 12 * ${columns} + ${gap * (columns - 1)}px)`;
  return `(max-width: 660px) ${mobile}, (max-width: 1000px) ${span(14)}, (min-width: 1700px) ${span(26)}, ${span(20)}`;
}

/** Mount the original-image archive within the existing site shell. */
export async function renderGallery({main, isCurrent = () => true, manifestUrl = '/gallery-manifest.json?v=20261107-responsive'}) {
  const request = new AbortController();
  const events = new AbortController();
  let disposed = false;
  let viewer;
  let oldOverflow;
  let returnTarget;
  let activeIndex = 0;
  let collection = 'album';
  let year = '';
  let shown = BATCH;
  let filtered = [];
  let albumScrollFrame;
  const current = () => !disposed && isCurrent();
  const unlock = () => {
    if (oldOverflow !== undefined) {
      document.body.style.overflow = oldOverflow;
      oldOverflow = undefined;
    }
  };
  const cleanup = () => {
    disposed = true;
    request.abort();
    events.abort();
    cancelAnimationFrame(albumScrollFrame);
    if (viewer?.open) viewer.close();
    unlock();
    viewer?.remove();
  };
  if (!current()) return cleanup;
  main.innerHTML = `<div class="gallery-page gallery-loading"><h1>${t("Galeria.")}</h1><p role="status">${t("Wczytujemy zdjęcia z archiwum SKAUT…")}</p></div>`;
  let manifest;
  try {
    const response = await fetch(manifestUrl, {signal: request.signal});
    if (!response.ok) throw new Error('Archive unavailable');
    manifest = await response.json();
    if (!Array.isArray(manifest.photos) || !Array.isArray(manifest.album?.photoIds)) throw new Error('Invalid archive');
  } catch (error) {
    if (current() && error.name !== 'AbortError') {
      main.innerHTML = `<div class="gallery-page gallery-loading"><h1>${t("Galeria.")}</h1><p role="alert">${t("Nie udało się wczytać galerii. Odśwież stronę, aby spróbować ponownie.")}</p><a class="btn" href="${sitePath('/galeria')}">${t("Spróbuj ponownie")}</a></div>`;
    }
    return cleanup;
  }
  if (!current()) return cleanup;
  const photos = manifest.photos.filter(photo => photo && typeof photo.id === 'string' && localMedia(photo.preview) && localMedia(photo.original));
  const byId = new Map(photos.map(photo => [photo.id, photo]));
  const albums = Array.isArray(manifest.albums) && manifest.albums.length ? manifest.albums.filter(album => Array.isArray(album.photoIds)) : [manifest.album];
  const requestedAlbum = new URL(window.location.href).searchParams.get('album');
  let activeAlbum = albums.find(album => album.id === requestedAlbum) || albums.find(album => album.id === manifest.album.id) || albums[0];
  let albumPhotos = activeAlbum.photoIds.map(id => byId.get(id)).filter(Boolean);
  let albumTitle = String(t(activeAlbum.title || 'Album SKAUT'));
  const years = [...new Set(photos.map(photo => String(photo.year || '')).filter(Boolean))].sort((a, b) => b.localeCompare(a, 'pl', {numeric: true}));
  const description = photo => String(photo.alt || photo.caption || photo.title || (photo.inAlbum ? albumTitle : t('Obraz z archiwum SKAUT')));
  function albumCover(album, index) {
    const override = albumCoverIds[album.id];
    const photo = byId.get(override && album.photoIds.includes(override) ? override : album.photoIds[0]);
    const safeSmall = src => localMedia(src) && src !== photo?.original && !new URL(src, window.location.origin).pathname.startsWith('/assets/gallery/originals/');
    const variant = photo && validVariants(photo.variants).filter(item => item.width <= 360 && safeSmall(item.src)).at(-1);
    const source = variant?.src || (photo && safeSmall(photo.thumbnail) ? photo.thumbnail : '');
    const title = String(t(album.title || 'Album SKAUT'));
    const count = album.photoIds.filter(id => byId.has(id)).length;
    return `<button type="button" class="gallery-album" data-gallery-album="${esc(album.id)}" aria-pressed="${album === activeAlbum}" aria-controls="gallery-grid" aria-label="${esc(title)} ${album.year ? esc(album.year) + '. ' : ''}${number(count)} ${t("zdjęć")}"><span class="gallery-album-cover">${source ? `<img src="${esc(source)}" alt="" width="${variant?.width || 180}" height="${variant?.height || 180}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">` : ''}<span class="gallery-album-fallback" ${source ? 'hidden' : ''}>${icon('images')}</span></span><span class="gallery-album-title">${esc(title)}</span><span class="gallery-album-meta">${album.year ? esc(album.year) + ' · ' : ''}${number(count)} ${t("zdjęć")}</span></button>`;
  }
  main.innerHTML = `<div class="gallery-page">
    <header class="gallery-intro"><h1>${t("Galeria.")}</h1><p>${t("Emocje na strzelnicy. Ludzie, którzy tworzą SKAUT.")}<br>${t("Nasze zdjęcia, zachowane z dawnej strony klubu.")}</p></header>
    <section class="gallery-album-browser" aria-label="${t("Wybierz album")}" aria-describedby="gallery-album-help"><div id="gallery-albums" class="gallery-albums">${albums.map(albumCover).join('')}</div><p id="gallery-album-help">${t("Wybierz album. Przewiń w bok, aby zobaczyć pozostałe.")}</p></section>
    <div class="gallery-controls" aria-label="${t("Wybór kolekcji")}">
      <div class="gallery-collections"><button type="button" data-gallery-collection="album" aria-pressed="true" aria-controls="gallery-grid">${t("Albumy")} <span>${number(albumPhotos.length)}</span></button><button type="button" data-gallery-collection="all" aria-pressed="false" aria-controls="gallery-grid">${t("Całe archiwum")} <span>${number(photos.length)}</span></button></div>
      <label class="gallery-year-control" hidden>${t("Rok publikacji")}<select id="gallery-year"><option value="">${t("Wszystkie lata")}</option>${years.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}${photos.some(photo => !photo.year) ? `<option value="unknown">${t("Bez daty")}</option>` : ''}</select></label>
    </div>
    <section aria-labelledby="gallery-collection-title"><div class="gallery-grid" id="gallery-grid"></div>
      <div class="gallery-pagination"><p id="gallery-count" role="status" aria-live="polite" aria-atomic="true"></p><button type="button" class="btn" id="gallery-more">${t("Pokaż kolejne")} ${BATCH} ${icon('arrow-down')}</button></div>
    </section>
    <p class="gallery-provenance">${t("Oryginalne zdjęcia i materiały z dawnej strony SKAUT. W archiwum rok oznacza rok publikacji materiału.")}</p>
  </div>`;
  const page = main.querySelector('.gallery-page');
  const grid = page.querySelector('#gallery-grid');
  const yearControl = page.querySelector('.gallery-year-control');
  const yearSelect = page.querySelector('#gallery-year');
  const albumRail = page.querySelector('#gallery-albums');
  const albumButtons = [...albumRail.querySelectorAll('[data-gallery-album]')];
  const count = page.querySelector('#gallery-count');
  const more = page.querySelector('#gallery-more');
  const collections = [...page.querySelectorAll('[data-gallery-collection]')];
  const on = (element, type, handler, options = {}) => element.addEventListener(type, handler, {...options, signal: events.signal});

  viewer = document.createElement('dialog');
  viewer.id = 'gallery-viewer';
  viewer.className = 'gallery-viewer';
  viewer.setAttribute('aria-labelledby', 'gallery-viewer-title');
  viewer.innerHTML = `<div class="gallery-viewer-header"><h2 id="gallery-viewer-title">${t("Podgląd obrazu")}</h2><p id="gallery-position" role="status" aria-live="polite" aria-atomic="true"></p><button type="button" id="gallery-close" class="gallery-viewer-button" autofocus aria-label="${t("Zamknij podgląd")}">${icon('x')}</button></div>
    <div class="gallery-viewer-stage"><button type="button" id="gallery-prev" class="gallery-viewer-button gallery-prev" aria-label="${t("Poprzedni obraz")}">${icon('arrow-left')}</button><p id="gallery-image-error" hidden role="status">${t("Nie udało się wczytać obrazu. Możesz otworzyć oryginał poniżej.")}</p><button type="button" id="gallery-next" class="gallery-viewer-button gallery-next" aria-label="${t("Następny obraz")}">${icon('arrow-right')}</button></div>
    <div class="gallery-viewer-footer"><p id="gallery-caption" lang="pl"></p><a id="gallery-original" target="_blank" rel="noopener">${t("Otwórz oryginał")} ${icon('arrow-up-right')}</a></div>
    <div class="gallery-thumbnails" aria-label="${t("Sąsiednie obrazy")}"></div>`;
  document.body.append(viewer);
  const fullImage = document.createElement('img');
  fullImage.id = 'gallery-full-image';
  fullImage.alt = '';
  fullImage.hidden = true;
  viewer.querySelector('.gallery-viewer-stage').prepend(fullImage);
  const imageError = viewer.querySelector('#gallery-image-error');
  const position = viewer.querySelector('#gallery-position');
  const caption = viewer.querySelector('#gallery-caption');
  const previous = viewer.querySelector('#gallery-prev');
  const next = viewer.querySelector('#gallery-next');
  const close = viewer.querySelector('#gallery-close');
  const thumbnails = viewer.querySelector('.gallery-thumbnails');
  const stage = viewer.querySelector('.gallery-viewer-stage');

  function updateViewer(index) {
    if (!current() || !filtered.length) return;
    const focusedControl = document.activeElement;
    const thumbnailHadFocus = thumbnails.contains(focusedControl);
    activeIndex = Math.max(0, Math.min(index, filtered.length - 1));
    const photo = filtered[activeIndex];
    fullImage.hidden = false;
    imageError.hidden = true;
    fullImage.alt = description(photo);
    const originalPath = new URL(photo.original, window.location.origin).pathname;
    const optimizedDisplay = src => {
      if (!localMedia(src)) return false;
      const path = new URL(src, window.location.origin).pathname;
      return path !== originalPath && !path.startsWith('/assets/gallery/originals/');
    };
    const displayVariants = validVariants(photo.displayVariants).filter(variant => optimizedDisplay(variant.src));
    if (displayVariants.length) {
      fullImage.sizes = VIEWER_SIZES;
      fullImage.srcset = sourceSet(displayVariants);
    } else {
      fullImage.removeAttribute('srcset');
      fullImage.removeAttribute('sizes');
    }
    fullImage.src = optimizedDisplay(photo.full) ? photo.full : displayVariants.at(-1)?.src || photo.preview;
    position.textContent = `${number(activeIndex + 1)} / ${number(filtered.length)}`;
    caption.textContent = String(photo.caption || '');
    caption.hidden = !caption.textContent.trim();
    viewer.querySelector('#gallery-original').href = photo.original;
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === filtered.length - 1;
    // Keep seven nearby previews, including when navigating beyond the loaded wall.
    const start = Math.max(0, Math.min(activeIndex - 3, filtered.length - 7));
    thumbnails.innerHTML = filtered.slice(start, start + 7).map((item, offset) => `<button type="button" data-gallery-thumbnail="${start + offset}" aria-label="${t("Obraz")} ${number(start + offset + 1)}" ${start + offset === activeIndex ? 'aria-current="true"' : ''}><img src="${esc(localMedia(item.thumbnail) ? item.thumbnail : item.preview)}" alt="" width="90" height="65" loading="lazy"></button>`).join('');
    if (thumbnailHadFocus) thumbnails.querySelector('[aria-current="true"]')?.focus({preventScroll: true});
    else if (focusedControl === previous && previous.disabled) (next.disabled ? close : next).focus({preventScroll: true});
    else if (focusedControl === next && next.disabled) (previous.disabled ? close : previous).focus({preventScroll: true});
  }
  function openViewer(id, trigger) {
    const index = filtered.findIndex(photo => photo.id === id);
    if (index === -1 || !current()) return;
    returnTarget = trigger;
    updateViewer(index);
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    viewer.showModal();
    close.focus({preventScroll: true});
  }
  function restoreFocus() {
    unlock();
    fullImage.removeAttribute('srcset');
    fullImage.removeAttribute('sizes');
    fullImage.removeAttribute('src');
    if (!current()) return;
    const target = returnTarget?.isConnected ? returnTarget : collections.find(button => button.getAttribute('aria-pressed') === 'true');
    target?.focus({preventScroll: true});
  }
  function contextMarkup() {
    return `<div class="gallery-context"><h2 id="gallery-collection-title">${collection === 'album' ? esc(albumTitle) : t('Całe archiwum.')}</h2><p>${collection === 'album' ? t('Ludzie, spotkania, wspólne emocje. Zobacz pełny album z klubowego archiwum.') : t('Zdjęcia i materiały z dawnej strony: spotkania, zawody, plakaty i klubowa historia.')}</p><span>${number(filtered.length)} ${collection === 'album' ? t('zdjęć w albumie') : t('obrazów w archiwum')}</span></div>`;
  }
  function photoMarkup(photo, index) {
    const width = Math.max(1, Number(photo.width) || 1200);
    const height = Math.max(1, Number(photo.height) || 800);
    const label = collection === 'album' ? tr`${albumTitle} – zdjęcie ${index + 1}` : description(photo);
    const variants = validVariants(photo.variants);
    const responsive = variants.length ? `srcset="${esc(sourceSet(variants))}" sizes="${esc(wallSizes(index, collection))}" ` : '';
    return `<figure class="gallery-photo ${height > width ? 'gallery-portrait' : ''}"><button type="button" data-gallery-photo="${esc(photo.id)}" aria-label="${t("Otwórz:")} ${esc(label)}"><span class="gallery-frame"><img ${responsive}src="${esc(photo.preview)}" alt="${esc(description(photo))}" width="${width}" height="${height}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async" ${index === 0 ? 'fetchpriority="high"' : ''}><span class="gallery-image-fallback" hidden>${icon('image')}<span>${t("Podgląd niedostępny")}</span></span><span class="gallery-photo-open" aria-hidden="true">${icon('arrows-out')}</span></span><span class="gallery-photo-meta"><span>${String(index + 1).padStart(3, '0')}</span>${photo.caption ? `<span lang="pl">${esc(photo.caption)}</span>` : ''}</span></button></figure>`;
  }
  function markFailedPreview(event) {
    if (!(event.target instanceof HTMLImageElement)) return;
    const frame = event.target.closest('.gallery-frame');
    if (!frame) return;
    event.target.hidden = true;
    frame.querySelector('.gallery-image-fallback').hidden = false;
  }
  function updateCount() {
    const visible = Math.min(shown, filtered.length);
    count.textContent = filtered.length ? tr`${collection === 'album' ? albumTitle : t('Całe archiwum.')} Pokazano ${number(visible)} z ${number(filtered.length)} ${collection === 'album' ? t('zdjęć') : t('obrazów')}` : t('Brak obrazów dla wybranego roku.');
    more.hidden = shown >= filtered.length;
    const remaining = Math.min(BATCH, filtered.length - shown);
    if (remaining > 0) more.innerHTML = tr`Pokaż kolejne ${remaining} ${icon('arrow-down')}`;
  }
  function renderCollection() {
    if (!current()) return;
    if (viewer.open) viewer.close();
    filtered = collection === 'album' ? albumPhotos : photos.filter(photo => !year || (year === 'unknown' ? !photo.year : String(photo.year) === year));
    shown = BATCH;
    grid.classList.toggle('gallery-grid-archive', collection === 'all');
    yearControl.hidden = collection !== 'all';
    albumButtons.forEach(button => button.setAttribute('aria-pressed', String(collection === 'album' && button.dataset.galleryAlbum === activeAlbum.id)));
    collections[0].firstChild.textContent = t('Albumy ');
    collections[0].querySelector('span').textContent = number(albumPhotos.length);
    collections.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryCollection === collection)));
    grid.innerHTML = contextMarkup() + filtered.slice(0, shown).map(photoMarkup).join('');
    updateCount();
    cancelAnimationFrame(albumScrollFrame);
    albumScrollFrame = requestAnimationFrame(() => {
      if (!current()) return;
      const selected = albumButtons.find(button => button.getAttribute('aria-pressed') === 'true');
      if (!selected) return;
      const railBounds = albumRail.getBoundingClientRect();
      const bounds = selected.getBoundingClientRect();
      // Reveal the selected cover horizontally; keep the page's scroll position.
      if (bounds.left < railBounds.left) albumRail.scrollLeft -= railBounds.left - bounds.left + 4;
      else if (bounds.right > railBounds.right) albumRail.scrollLeft += bounds.right - railBounds.right + 4;
    });
  }

  on(grid, 'click', event => {
    const trigger = event.target.closest('[data-gallery-photo]');
    if (trigger) openViewer(trigger.dataset.galleryPhoto, trigger);
  });
  on(grid, 'error', markFailedPreview, {capture: true});
  collections.forEach(button => on(button, 'click', () => {
    if (collection === button.dataset.galleryCollection) return;
    collection = button.dataset.galleryCollection;
    renderCollection();
  }));
  on(yearSelect, 'change', () => {year = yearSelect.value; renderCollection();});
  on(albumRail, 'click', event => {
    if (!current()) return;
    const button = event.target.closest('[data-gallery-album]');
    const album = button && albums.find(item => item.id === button.dataset.galleryAlbum);
    if (!album || (collection === 'album' && album === activeAlbum)) return;
    activeAlbum = album;
    albumPhotos = activeAlbum.photoIds.map(id => byId.get(id)).filter(Boolean);
    albumTitle = String(t(activeAlbum.title || 'Album SKAUT'));
    collection = 'album';
    year = '';
    yearSelect.value = '';
    const url = new URL(window.location.href);
    url.searchParams.set('album', activeAlbum.id);
    if (url.href !== window.location.href) window.history.pushState(window.history.state, '', url);
    renderCollection();
  });
  on(albumRail, 'error', event => {
    if (!(event.target instanceof HTMLImageElement)) return;
    event.target.hidden = true;
    event.target.parentElement.querySelector('.gallery-album-fallback').hidden = false;
  }, {capture: true});
  on(more, 'click', () => {
    if (!current()) return;
    const from = shown;
    shown = Math.min(shown + BATCH, filtered.length);
    grid.insertAdjacentHTML('beforeend', filtered.slice(from, shown).map((photo, index) => photoMarkup(photo, from + index)).join(''));
    updateCount();
    // The first new image is the next natural step, even when the button disappears.
    grid.querySelectorAll('[data-gallery-photo]')[from]?.focus({preventScroll: true});
  });
  on(close, 'click', () => viewer.close());
  on(viewer, 'close', restoreFocus);
  on(previous, 'click', () => updateViewer(activeIndex - 1));
  on(next, 'click', () => updateViewer(activeIndex + 1));
  on(thumbnails, 'click', event => {
    const trigger = event.target.closest('[data-gallery-thumbnail]');
    if (trigger) {
      updateViewer(Number(trigger.dataset.galleryThumbnail));
      thumbnails.querySelector('[aria-current="true"]')?.focus({preventScroll: true});
    }
  });
  on(viewer, 'keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    updateViewer(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });
  on(viewer, 'click', event => {
    if (event.target !== viewer && event.target !== stage) return;
    if (event.target === stage) {viewer.close(); return;}
    const bounds = viewer.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
  });
  on(fullImage, 'error', () => {fullImage.hidden = true; imageError.hidden = false;});
  let touchStart;
  on(stage, 'touchstart', event => {
    touchStart = event.touches.length === 1 ? {x: event.touches[0].clientX, y: event.touches[0].clientY} : undefined;
  }, {passive: true});
  on(stage, 'touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = undefined;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) updateViewer(activeIndex + (dx < 0 ? 1 : -1));
  }, {passive: true});
  on(stage, 'touchcancel', () => {touchStart = undefined;}, {passive: true});
  renderCollection();
  return cleanup;
}

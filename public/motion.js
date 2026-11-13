import {t} from './i18n.js?v=20261113-ui-sound';
const ARRIVE = 'cubic-bezier(.16,1,.3,1)';
const DEPART = 'cubic-bezier(.55,0,1,.45)';
const SOUND_KEY = 'skaut-transition-sound';
const FOLEY_URL = '/assets/ui-sound/foley.mp3';
// Start and duration in seconds for each edit in the audio file.
const FOLEY_CUES = [
  [0, .58],       // Reload
  [.68, .31],    // Muffled report
  [1.09, .63],   // Brass casing
  [1.82, .47],   // Cartridge loading
  [2.39, .42],   // Magazine seating
  [2.91, .53],   // Action cycle
];


/** A bounded navigation sequence. Content stays visible without JavaScript/CSS. */
export function createPageMotion({ main }) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  const sound = createMechanicalSound(main.ownerDocument);
  let observer, generation = 0, disposed = false, leaving = null;

  function cancel() {
    generation++;
    leaving = null;
    observer?.disconnect();
    observer = null;
    for (const animation of animations) animation.cancel();
    animations.clear();
  }

  function animate(element, frames, options, hold = false) {
    if (!element?.isConnected || !element.animate || element.closest('dialog,[inert]')) return;
    // Backwards fill applies stagger starting positions without leaving end styles behind.
    const animation = element.animate(frames, { fill: 'backwards', ...options });
    animations.add(animation);
    animation.finished.then(() => { if (!hold) animations.delete(animation); }, () => animations.delete(animation));
    return animation;
  }

  function eligible(element) {
    if (element.closest('dialog,[inert]') || element.hidden) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function candidates() {
    // Explicit composition layers first; large grids are never animated as one surface.
    const selectors = [
      '.hero-photo h1', '.finder > h2', '.finder > p', '.finder > form', '.finder > a',
      '.page-intro > *', '.gallery-intro > *', '.gallery-controls', '.gallery-context',
      '.account-photo > img', '.account-photo h1', '.account-form > h2', '.account-form > p', '.account-form > form',
      '.article > h1', '.article > .lead', '.article > img', '.image-story > :is(img,.home-photo-frame)', '.image-story > .copy',
      '.section-heading', '.filters', '.filter-tabs', '.panel-heading', '.panel-tabs', '.summary', '.error-page > *',
      '.news-item', '.event-row', '.gallery-photo', '[data-motion]'
    ];
    const elements = Array.from(main.querySelectorAll(selectors.join(',')));
    const chosen = [];
    for (const element of elements) {
      if (!eligible(element) || chosen.some(parent => parent.contains(element))) continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight * 1.05) chosen.push(element);
      if (chosen.length === 12) break;
    }
    // Ordinary prose pages still get a single heading-led arrival.
    if (!chosen.length) {
      const heading = main.querySelector('h1');
      if (heading && eligible(heading)) chosen.push(heading);
    }
    return chosen;
  }

  function enterLayer(element, index, reveal = false) {
    const photo = element.matches('img,.gallery-photo,.home-photo-frame');
    const distance = photo ? 44 : 30;
    const frames = photo ? [
      { transform: `translate3d(${distance}px,0,0)`, opacity: .55, clipPath: 'inset(0 0 0 7%)' },
      { transform: 'translate3d(0,0,0)', opacity: 1, clipPath: 'inset(0)' }
    ] : [
      { transform: `translate3d(${distance}px,0,0)`, opacity: .2 },
      { transform: 'translate3d(0,0,0)', opacity: 1 }
    ];
    animate(element, frames, { duration: reveal ? 420 : photo ? 600 : 480, delay: reveal ? 0 : Math.min(index * 28, 112), easing: ARRIVE });
  }

  function observeSections(entered) {
    if (!('IntersectionObserver' in window)) return;
    const token = generation;
    observer = new IntersectionObserver(entries => {
      if (token !== generation || disposed || main.ownerDocument.querySelector('dialog[open]')) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        // An observer never pre-hides content; a delayed callback is harmless.
        enterLayer(entry.target, 0, true);
      }
    }, { threshold: .08, rootMargin: '0px 0px -36px 0px' });
    const sections = main.querySelectorAll('.section-heading,.image-story > :is(img,.home-photo-frame),.image-story > .copy,.news-preview,.gallery-photo');
    let count = 0;
    for (const element of sections) {
      if (entered.some(item => item === element || item.contains(element)) || !eligible(element)) continue;
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      observer.observe(element);
      if (++count === 14) break;
    }
  }

  function enter() {
    if (disposed) return;
    cancel();
    if (reduced.matches || main.ownerDocument.querySelector('dialog[open]')) return;
    const elements = candidates();
    elements.forEach((element, index) => enterLayer(element, index));
    observeSections(elements);
  }

  function leave() {
    if (disposed) return Promise.resolve();
    // Rapid requests share one departure instead of queuing 160ms waits.
    if (leaving) return leaving;
    cancel();
    if (reduced.matches || main.ownerDocument.querySelector('dialog[open]')) return Promise.resolve();
    const token = generation;
    const outgoing = candidates().map(element => animate(element, [
      { transform: 'translate3d(0,0,0)', opacity: 1 },
      { transform: 'translate3d(-24px,0,0)', opacity: .12 }
    ], { duration: 155, easing: DEPART, fill: 'forwards' }, true)).filter(Boolean);
    let timer;
    leaving = Promise.race([
      Promise.allSettled(outgoing.map(animation => animation.finished)),
      new Promise(resolve => { timer = setTimeout(resolve, 175); })
    ]).then(() => {
      clearTimeout(timer);
      if (token !== generation) return;
      // Keep this small, finished set in its departure pose while the route fetches.
      // A throttled animation also reaches its endpoint by the bounded wait above.
      // enter/cancel/dispose releases every pose, including detached old DOM nodes.
      for (const animation of outgoing) {
        if (animation.playState !== 'idle') animation.finish();
      }
    });
    return leaving;
  }

  const preferenceChanged = () => { if (reduced.matches) cancel(); };
  const pageRestored = event => { if (event.persisted) enter(); };
  reduced.addEventListener('change', preferenceChanged);
  window.addEventListener('pageshow', pageRestored);
  return {
    leave, enter,
    dispose() {
      disposed = true;
      cancel();
      reduced.removeEventListener('change', preferenceChanged);
      window.removeEventListener('pageshow', pageRestored);
      sound.dispose();
    }
  };
}

function createMechanicalSound(doc) {
  const supported = Boolean(window.AudioContext || window.webkitAudioContext);
  const listeners = new AbortController();
  const mobile = window.matchMedia('(max-width: 780px), (pointer: coarse) and (max-width: 1100px) and (max-height: 600px)');
  let enabled = false, disposed = false;
  let context, audioRequest, activeCue;
  let lastPlayed = -Infinity, lastCue = -1, gesture = 0;
  try { enabled = supported && localStorage.getItem(SOUND_KEY) === 'on'; } catch {}
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'icon-button sound-toggle';
  button.innerHTML = '<i class="ph ph-speaker-simple-slash" aria-hidden="true"></i>';
  button.disabled = !supported;
  function update() {
    const label = !supported ? t('Dźwięk interfejsu jest niedostępny') : enabled ? t('Wyłącz dźwięk interfejsu') : t('Włącz dźwięk interfejsu');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(enabled));
    button.firstElementChild.className = `ph ph-speaker-simple-${enabled ? 'high' : 'slash'}`;
  }
  function place() {
    const header = doc.querySelector('.header');
    const nav = doc.querySelector('#navigation');
    // On small screens the control lives in the menu, preserving its 44px target.
    if (mobile.matches && nav) nav.append(button);
    else if (header) header.insertBefore(button, header.querySelector('.basket-link'));
  }
  place(); update();
  mobile.addEventListener('change', place);

  function stopCue() {
    if (!activeCue) return;
    const {source, gain} = activeCue;
    const now = context.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + .018);
    source.stop(now + .018);
    activeCue = null;
  }

  function loadAudio() {
    audioRequest ??= fetch(FOLEY_URL).then(response => {
      if (!response.ok) throw new Error('Foley audio unavailable');
      return response.arrayBuffer();
    }).then(data => context.decodeAudioData(data)).catch(error => {
      audioRequest = null;
      throw error;
    });
    return audioRequest;
  }

  function play(audio) {
    const now = context.currentTime;
    if (now - lastPlayed < .085) return;
    lastPlayed = now;
    stopCue();
    let choice = Math.floor(Math.random() * (lastCue < 0 ? FOLEY_CUES.length : FOLEY_CUES.length - 1));
    if (lastCue >= 0 && choice >= lastCue) choice++;
    lastCue = choice;
    const [start, duration] = FOLEY_CUES[choice];
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = .28;
    source.buffer = audio;
    source.connect(gain).connect(context.destination);
    activeCue = {source, gain};
    source.onended = () => {
      if (activeCue?.source === source) activeCue = null;
      source.disconnect();
      gain.disconnect();
    };
    source.start(now, start, duration);
  }

  function playFromGesture(event) {
    if (!enabled || !event.isTrusted || disposed || !supported) return;
    const click = ++gesture;
    try {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      const resumed = context.state === 'running' ? Promise.resolve() : context.resume();
      Promise.all([resumed, loadAudio()]).then(([,audio]) => {
        if (enabled && !disposed && !doc.hidden && gesture === click) play(audio);
      }).catch(() => {});
    } catch { /* Audio failure never blocks the control. */ }
  }

  doc.addEventListener('click', event => {
    if (!enabled) return;
    const control = event.target.closest?.('button, a[href], input[type=button], input[type=submit], input[type=reset], summary, [role=button]');
    if (!control || control.matches(':disabled') || control.closest('[aria-disabled=true], [inert], .sound-toggle, [data-range-game]')) return;
    playFromGesture(event);
  }, { capture: true, signal: listeners.signal });

  button.addEventListener('click', event => {
    enabled = !enabled;
    try { localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch {}
    update();
    if (!enabled) {
      gesture++;
      stopCue();
      return;
    }
    playFromGesture(event);
  }, { signal: listeners.signal });
  return {
    dispose() {
      disposed = true;
      listeners.abort();
      mobile.removeEventListener('change', place);
      button.remove();
      stopCue();
      context?.close().catch(() => {});
    }
  };
}

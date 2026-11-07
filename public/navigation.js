const instances = new WeakMap();

/** Enhance native header links; the existing router owns navigation and menu state. */
export function initNavigation() {
  const navigation = document.getElementById('navigation');
  if (!navigation) return {update() {}, dispose() {}};
  if (instances.has(navigation)) return instances.get(navigation);

  for (const link of navigation.querySelectorAll('a')) {
    if (link.querySelector('.navigation-label')) continue;
    const label = document.createElement('span');
    label.className = 'navigation-label';
    label.textContent = link.textContent.trim();
    const arrow = document.createElement('i');
    arrow.className = 'ph ph-arrow-up-right navigation-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    link.replaceChildren(label, arrow);
  }
  navigation.classList.add('navigation-enhanced');

  const toggle = document.getElementById('menu-toggle');
  const events = new AbortController();
  const panelLayout = window.matchMedia('(max-width: 1000px), (pointer: coarse) and (max-width: 1100px) and (max-height: 600px)');
  const covered = new Map();
  function restoreCoveredContent() {
    for (const [element, wasInert] of covered) element.inert = wasInert;
    covered.clear();
  }
  function update() {
    const open = navigation.classList.contains('open');
    // The panel covers page content, while header controls and bottom tabs remain native.
    if (open && panelLayout.matches) {
      for (const element of document.querySelectorAll('main,.footer,.demo-notice')) {
        if (!covered.has(element)) covered.set(element, element.inert);
        element.inert = true;
      }
    } else restoreCoveredContent();
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    const icon = toggle.querySelector('i');
    if (icon) icon.className = open ? 'ph ph-x' : 'ph ph-list';
  }
  const observer = new MutationObserver(update);
  observer.observe(navigation, {attributes: true, attributeFilter: ['class']});
  panelLayout.addEventListener('change', update);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !panelLayout.matches || !navigation.classList.contains('open')) return;
    queueMicrotask(() => {
      if (!navigation.classList.contains('open')) toggle?.focus({preventScroll: true});
    });
  }, {signal: events.signal});
  const controller = {
    update,
    dispose() {
      observer.disconnect();
      events.abort();
      panelLayout.removeEventListener('change', update);
      restoreCoveredContent();
      instances.delete(navigation);
    },
  };
  instances.set(navigation, controller);
  update();
  return controller;
}

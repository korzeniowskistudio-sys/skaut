const tabs = [
  {path: '/', label: 'Start', icon: 'house'},
  {path: '/treningi', label: 'Treningi', icon: 'target'},
  {path: '/kalendarz', label: 'Kalendarz', icon: 'calendar-blank'},
  {path: '/galeria', label: 'Galeria', icon: 'images'},
  {path: '/moj-skaut', label: 'Konto', icon: 'user-circle'},
];

/** Keep native links so the site's router and ordinary archive navigation work. */
export function initMobileNavigation() {
  let navigation = document.getElementById('mobile-navigation');
  if (!navigation) {
    navigation = document.createElement('nav');
    navigation.id = 'mobile-navigation';
    navigation.className = 'mobile-navigation';
    navigation.setAttribute('aria-label', 'Główna nawigacja mobilna');
    for (const tab of tabs) {
      const link = document.createElement('a');
      link.href = tab.path;
      link.dataset.mobilePath = tab.path;
      const icon = document.createElement('i');
      icon.className = `ph ph-${tab.icon}`;
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = tab.label;
      link.append(icon, label);
      navigation.append(link);
    }
    document.body.append(navigation);
  }
  document.body.classList.add('has-mobile-navigation');
  update(window.location.pathname);
  return {update};
}

/** Query strings do not change the selected section; unrelated archives have none. */
export function update(path = window.location.pathname) {
  const pathname = new URL(path, window.location.origin).pathname.replace(/\/+$/, '') || '/';
  for (const link of document.querySelectorAll('#mobile-navigation [data-mobile-path]')) {
    if (link.dataset.mobilePath === pathname) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

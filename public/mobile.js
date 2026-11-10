import {t, localPath, sitePath} from './i18n.js?v=20261107-english';
const tabs = [
  {path: '/', label: t('Start'), icon: 'house'},
  {path: '/treningi', label: t('Treningi'), icon: 'target'},
  {path: '/kalendarz', label: t('Kalendarz'), icon: 'calendar-blank'},
  {path: '/galeria', label: t('Galeria'), icon: 'images'},
  {path: '/gadzety', label: t('Gadżety'), icon: 'shopping-bag'},
  {path: '/moj-skaut', label: t('Konto'), icon: 'user-circle'},
];

/** Keep native links so the site's router and ordinary archive navigation work. */
export function initMobileNavigation() {
  let navigation = document.getElementById('mobile-navigation');
  if (!navigation) {
    navigation = document.createElement('nav');
    navigation.id = 'mobile-navigation';
    navigation.className = 'mobile-navigation';
    navigation.setAttribute('aria-label', t('Główna nawigacja mobilna'));
    for (const tab of tabs) {
      const link = document.createElement('a');
      link.href = sitePath(tab.path);
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
  // Match the bottom bar breakpoint in mobile.css, including phone landscape.
  const media = window.matchMedia('(max-width:780px), (pointer:coarse) and (max-width:1100px) and (max-height:600px)');
  return {update,media};
}

/** Query strings do not change the selected section; unrelated archives have none. */
export function update(path = window.location.pathname) {
  const pathname = localPath(new URL(path, window.location.origin).pathname);
  for (const link of document.querySelectorAll('#mobile-navigation [data-mobile-path]')) {
    if (link.dataset.mobilePath === pathname) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

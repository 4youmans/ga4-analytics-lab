'use strict';

const sendEvent = (name, parameters = {}) => {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, {
    ...parameters,
    transport_type: 'beacon',
    ...(new URLSearchParams(window.location.search).get('debug_mode') === 'true' ? { debug_mode: true } : {})
  });
};

// Сохраняем режим проверки при переходах между страницами сайта.
if (new URLSearchParams(location.search).get('debug_mode') === 'true') {
  document.querySelectorAll('a[href]').forEach(link => {
    const target = new URL(link.href, location.href);
    if (target.origin === location.origin && target.pathname.endsWith('.html')) {
      target.searchParams.set('debug_mode', 'true');
      link.href = target.href;
    }
  });
}

document.querySelectorAll('nav a').forEach((link) => {
  link.addEventListener('click', () => {
    sendEvent('nav_click', {
      link_text: link.textContent.trim(),
      from_page: document.title,
      link_url: link.getAttribute('href')
    });
  });
});

document.querySelectorAll('[data-download-name]').forEach((link) => {
  link.addEventListener('click', () => {
    sendEvent('file_download_lab', {
      file_name: link.dataset.downloadName,
      file_extension: 'pdf'
    });
  });
});

document.querySelectorAll('[data-external-name]').forEach((link) => {
  link.addEventListener('click', () => {
    sendEvent('external_resource_click', {
      resource_name: link.dataset.externalName,
      link_domain: new URL(link.href).hostname
    });
  });
});

const campaign = new URLSearchParams(window.location.search);
if (campaign.has('utm_source')) {
  sendEvent('utm_visit', {
    utm_source: campaign.get('utm_source') || 'not_set',
    utm_medium: campaign.get('utm_medium') || 'not_set',
    utm_campaign: campaign.get('utm_campaign') || 'not_set',
    landing_page: window.location.pathname
  });
}

// Считаем только время, пока вкладка видима.
let readingTime = 0;
let visibleSince = document.hidden ? null : Date.now();
let readingTimer;
let readSent = false;
const scheduleReading = () => {
  window.clearTimeout(readingTimer);
  if (document.hidden || readSent) return;
  visibleSince = Date.now();
  readingTimer = window.setTimeout(() => {
    readSent = true;
    sendEvent('read_30s', { page_path: window.location.pathname });
  }, Math.max(0, 30000 - readingTime));
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && visibleSince !== null) {
    readingTime += Date.now() - visibleSince;
    visibleSince = null;
  }
  scheduleReading();
});
scheduleReading();

let scrollSent = false;
window.addEventListener('scroll', () => {
  if (scrollSent) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 0 && window.scrollY / maxScroll >= 0.75) {
    scrollSent = true;
    sendEvent('scroll_75', { page_path: window.location.pathname });
  }
}, { passive: true });

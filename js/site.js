'use strict';
function applySite() {
  const site = window.SITE;
  const set = (selector, value) => document.querySelectorAll(selector).forEach(node => { node.textContent = value; });
  set('.name', site.name);
  set('[data-greeting]', 'hey, i’m ' + site.firstName + '.');
  document.querySelectorAll('[data-tagline]').forEach(node => node.remove());
  const introSection = document.querySelector('.intro');
  if (introSection && site.tagline) {
    const tagline = document.createElement('p');
    tagline.className = 'eyebrow';
    tagline.dataset.tagline = '';
    tagline.textContent = site.tagline;
    introSection.prepend(tagline);
  }
  const intro = document.querySelector('[data-intro]');
  if (intro) intro.replaceChildren(...site.introLines.map(line => {
    const p = document.createElement('p');
    p.textContent = line;
    return p;
  }));
  set('[data-footer-name]', '© ' + new Date().getFullYear() + ' ' + site.footerName);
  const links = document.querySelector('[data-footer-links]');
  links.replaceChildren();
  for (const key of ['email', 'linkedin', 'github']) {
    if (!site[key]) continue;
    if (links.childNodes.length) {
      const separator = document.createElement('span');
      separator.textContent = '·';
      separator.setAttribute('aria-hidden', 'true');
      links.append(separator);
    }
    const link = document.createElement('a');
    link.textContent = key;
    link.href = key === 'email' ? 'mailto:' + site[key] : site[key];
    links.append(link);
  }
  document.querySelector('meta[name="description"]').content = site.metaDescription;
  document.querySelector('meta[name="author"]').content = site.author;
  document.querySelector('meta[property="og:description"]').content = site.metaDescription;
  const page = document.body.dataset.page;
  const labels = { projects: 'projects', blog: 'blogs', post: 'post' };
  document.title = page === 'home' ? site.pageTitle : labels[page] + ' · ' + site.pageTitle;
  document.title = document.title.toLowerCase();
  document.querySelector('meta[property="og:title"]').content = document.title;
  const current = page === 'post' ? new URLSearchParams(location.search).get('type') : page;
  document.querySelectorAll('.nav-links a').forEach(link => {
    const active = (current === 'projects' && link.getAttribute('href') === 'projects.html') ||
      (current === 'blog' && link.getAttribute('href') === 'blog.html');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}
applySite();

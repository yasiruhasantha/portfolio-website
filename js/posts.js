'use strict';
const types = ['projects', 'blog'];
const validSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function parsePost(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('Missing front matter');
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^(\w+):\s*(.*?)\s*$/);
    if (field) meta[field[1]] = field[2].replace(/^(['"])([\s\S]*)\1$/, '$2');
  }
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '') || Number.isNaN(Date.parse(meta.date))) throw new Error('Invalid post');
  const body = source.slice(match[0].length);
  const supplied = parseInt(meta.readingTime, 10);
  const tags = [...new Set((meta.tags || '').replace(/^\[|\]$/g, '').split(',').map(tag => tag.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim()).filter(Boolean))];
  return { ...meta, tags, body, readingTime: supplied > 0 ? supplied : Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 200)) };
}
async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Could not load post');
  return response.text();
}
async function loadManifest() {
  const manifest = JSON.parse(await fetchText('posts/index.json'));
  for (const type of types) {
    if (!Array.isArray(manifest[type]) || !manifest[type].every(validSlug)) throw new Error('Invalid manifest');
  }
  return manifest;
}
async function loadPost(type, slug) {
  return { ...parsePost(await fetchText('posts/' + type + '/' + slug + '.md')), type, slug };
}
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function displayDate(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(date)).toLowerCase();
}
function tagLinks(post) {
  const tags = element('div', 'tags');
  for (const tag of post.tags) {
    const link = element('a', 'tag', tag);
    link.href = post.type + '.html?tag=' + encodeURIComponent(tag);
    tags.append(link);
  }
  return tags;
}
function row(post) {
  const blog = post.type === 'blog';
  const container = element('div', 'post-row' + (blog ? ' blog-row' : ''));
  const anchor = element('a', 'post-title', post.title + ' →');
  anchor.href = 'post.html?type=' + post.type + '&slug=' + encodeURIComponent(post.slug);
  const left = element('div', 'post-left');
  if (blog) left.append(element('time', 'post-meta', displayDate(post.date)));
  if (blog) left.firstChild.dateTime = post.date;
  left.append(anchor);
  if (!blog) left.append(element('span', 'post-description', post.description || ''));
  if (post.tags.length) left.append(tagLinks(post));
  container.append(left, element('span', 'post-meta', blog ? post.readingTime + ' min read' : post.year || post.date.slice(0, 4)));
  return container;
}
function renderArchive(list, posts, incomplete) {
  const filter = document.querySelector('[data-tag-filter]');
  const tags = [...new Set(posts.flatMap(post => post.tags))].sort((a, b) => a.localeCompare(b));
  function draw() {
    const selected = new URLSearchParams(location.search).get('tag') || '';
    const shown = selected ? posts.filter(post => post.tags.includes(selected)) : posts;
    list.replaceChildren(...shown.map(row));
    if (!shown.length) list.append(element('p', 'status', selected && posts.length ? 'No posts with this tag just yet.' : 'nothing here yet.'));
    filter.hidden = !posts.length;
    if (incomplete) list.append(element('p', 'status', 'Some posts couldn’t be loaded. Please try again later.'));
    const options = ['', ...tags];
    if (selected && !tags.includes(selected)) options.push(selected);
    filter.replaceChildren(...options.map(tag => {
      const button = element('button', 'tag', tag || 'all');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(tag === selected));
      button.addEventListener('click', () => {
        const url = new URL(location.href);
        if (tag) url.searchParams.set('tag', tag);
        else url.searchParams.delete('tag');
        history.pushState(null, '', url.pathname + url.search + url.hash);
        draw();
      });
      return button;
    }));
  }
  draw();
  window.addEventListener('popstate', draw);
}
async function renderLists() {
  const lists = document.querySelectorAll('[data-post-list]');
  if (!lists.length) return;
  try {
    const manifest = await loadManifest();
    await Promise.all([...lists].map(async list => {
      const type = list.dataset.postList;
      const results = await Promise.allSettled(manifest[type].map(slug => loadPost(type, slug)));
      const posts = results.filter(result => result.status === 'fulfilled').map(result => result.value).sort((a, b) => b.date.localeCompare(a.date));
      const seeAll = list.parentElement.querySelector('.see-all');
      if (seeAll) seeAll.hidden = !posts.length;
      if (document.querySelector('[data-tag-filter]')) {
        renderArchive(list, posts, results.some(result => result.status === 'rejected'));
        return;
      }
      list.replaceChildren(...posts.slice(0, Number(list.dataset.limit) || posts.length).map(row));
      if (!posts.length) list.append(element('p', 'status', results.length ? 'These posts are taking a little break. Please try again later.' : 'nothing here yet.'));
      else if (results.some(result => result.status === 'rejected')) list.append(element('p', 'status', 'A few posts couldn’t be loaded. Please try again later.'));
    }));
  } catch {
    lists.forEach(list => list.replaceChildren(element('p', 'status', 'The posts couldn’t be loaded. Please try again later.')));
  }
}
async function renderPost() {
  const article = document.getElementById('post');
  if (!article) return;
  try {
    const query = new URLSearchParams(location.search);
    const type = query.get('type'), slug = query.get('slug');
    if (types.includes(type)) {
      const back = article.querySelector('.back-link');
      back.href = type + '.html';
      back.textContent = type === 'projects' ? '← projects' : '← blogs';
    }
    if (!types.includes(type) || !validSlug(slug)) throw new Error('Not found');
    const manifest = await loadManifest();
    if (!manifest[type].includes(slug)) throw new Error('Not found');
    const post = await loadPost(type, slug);
    if (!window.marked || !window.DOMPurify) throw new Error('Renderer unavailable');
    const meta = element('p', 'article-meta', displayDate(post.date) + ' · ' + (type === 'blog' ? post.readingTime + ' min read' : post.year || post.date.slice(0, 4)));
    const body = element('div', 'prose');
    body.innerHTML = DOMPurify.sanitize(marked.parse(post.body));
    body.querySelectorAll('a').forEach(link => {
      if (/^(https?:\/\/|mailto:)/i.test(link.textContent.trim())) link.dataset.preserveCase = '';
    });
    article.querySelector('.status').remove();
    article.append(meta);
    if (post.tags.length) article.append(tagLinks(post));
    article.append(element('h1', 'article-title', post.title), body);
    document.title = (post.title + ' · ' + window.SITE.pageTitle).toLowerCase();
    document.querySelector('meta[property="og:title"]').content = document.title;
  } catch {
    document.title = ('post unavailable · ' + window.SITE.pageTitle).toLowerCase();
    document.querySelector('meta[property="og:title"]').content = document.title;
    article.querySelector('.status').textContent = 'This little page couldn’t be found or loaded. Try another from the list.';
  }
}
renderLists();
renderPost();

const API = '/api/v1/reelshort';

const state = {
  mode: 'search',
  lang: 'fr',
  searchPage: 1,
  searchKeyword: 'love',
  hasMoreSearch: false,
  shelves: [],
  books: [],
  selectedBook: null,
  episodes: [],
  hls: null
};

const els = {
  form: document.querySelector('#searchForm'),
  input: document.querySelector('#searchInput'),
  lang: document.querySelector('#langSelect'),
  toolbar: document.querySelector('.toolbar'),
  pills: [...document.querySelectorAll('.pill')],
  status: document.querySelector('#status'),
  listTitle: document.querySelector('#listTitle'),
  count: document.querySelector('#countBadge'),
  grid: document.querySelector('#bookGrid'),
  episodes: document.querySelector('#episodes'),
  player: document.querySelector('#player'),
  empty: document.querySelector('#emptyPlayer'),
  title: document.querySelector('#selectedTitle'),
  meta: document.querySelector('#selectedMeta'),
  rawLink: document.querySelector('#rawLink'),
  videoUrlBox: document.querySelector('#videoUrlBox'),
  videoUrlInput: document.querySelector('#videoUrlInput'),
  copyUrl: document.querySelector('#copyUrl'),
  subtitleStatus: document.querySelector('#subtitleStatus'),
  loadMore: document.querySelector('#loadMore')
};

function setStatus(message) {
  els.status.textContent = message || '';
}

function setActive(mode) {
  state.mode = mode;
  els.pills = [...document.querySelectorAll('.pill')];
  els.pills.forEach((pill) => {
    pill.classList.toggle('is-active', pill.dataset.shelf === mode);
  });
}

function normalizeBook(book) {
  return {
    book_id: book.book_id,
    book_title: book.book_title,
    filtered_title: book.filtered_title || slugify(book.book_title || ''),
    book_pic: book.book_pic,
    chapter_count: book.chapter_count || 0,
    chapter_base: book.chapter_base || []
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

async function loadSearch(keyword = els.input.value.trim() || 'love', page = 1, append = false) {
  setActive('search');
  state.searchKeyword = keyword;
  state.searchPage = page;
  els.listTitle.textContent = `Recherche: ${keyword}`;
  setStatus(page > 1 ? `Chargement page ${page}...` : 'Recherche en cours...');
  const data = await getJson(`${API}/search?keywords=${encodeURIComponent(keyword)}&lang=${encodeURIComponent(state.lang)}&page=${page}`);
  const books = (data.results || []).map(normalizeBook);
  state.hasMoreSearch = books.length >= 11;
  renderBooks(books, append);
  els.loadMore.hidden = !state.hasMoreSearch;
}

async function loadShelf(name) {
  setActive(name);
  const shelf = state.shelves.find((item) => item.id === name);
  els.listTitle.textContent = shelf?.bookshelf_name || name;
  setStatus(shelf ? '' : 'Rayon introuvable.');
  renderBooks((shelf?.books || []).map(normalizeBook));
  els.loadMore.hidden = true;
}

async function loadShelves() {
  setStatus('Chargement des rayons...');
  const data = await getJson(`${API}/bookshelves?lang=${encodeURIComponent(state.lang)}`);
  state.shelves = (data.bookshelves || []).map((shelf, index) => ({
    ...shelf,
    id: `shelf-${index}`
  }));
  renderShelfButtons();
}

function renderShelfButtons() {
  els.toolbar.innerHTML = '<button class="pill is-active" data-shelf="search">Recherche</button>';

  for (const shelf of state.shelves) {
    const button = document.createElement('button');
    button.className = 'pill';
    button.type = 'button';
    button.dataset.shelf = shelf.id;
    button.textContent = shelf.bookshelf_name;
    els.toolbar.appendChild(button);
  }

  bindShelfButtons();
  setActive(state.mode === 'search' ? 'search' : 'search');
}

function renderBooks(books, append = false) {
  state.books = append ? [...state.books, ...books] : books;
  state.selectedBook = null;
  state.episodes = [];
  els.count.textContent = String(state.books.length);
  if (!append) {
    els.grid.innerHTML = '';
  }
  els.episodes.innerHTML = '';
  els.title.textContent = state.books.length ? 'Selectionne un drama' : 'Aucun resultat';
  els.meta.textContent = 'Aucun drama selectionne';
  clearVideoUrl();
  clearSubtitleStatus();
  els.empty.classList.remove('is-hidden');
  setStatus(state.books.length ? '' : 'Rien a afficher pour cette requete.');

  for (const book of books) {
    const card = document.createElement('button');
    card.className = 'book-card';
    card.type = 'button';
    card.innerHTML = `
      <img class="poster" src="${book.book_pic || ''}" alt="">
      <span class="book-copy">
        <strong>${escapeHtml(book.book_title || 'Sans titre')}</strong>
        <span>${book.chapter_count || '?'} episodes</span>
      </span>
    `;
    card.addEventListener('click', () => selectBook(book, card));
    els.grid.appendChild(card);
  }
}

async function selectBook(book, card) {
  state.selectedBook = book;
  [...document.querySelectorAll('.book-card')].forEach((node) => node.classList.remove('is-selected'));
  card.classList.add('is-selected');
  els.title.textContent = book.book_title || 'Drama';
  els.meta.textContent = `${book.chapter_count || '?'} episodes`;
  els.player.poster = book.book_pic || '';
  clearVideoUrl();
  clearSubtitleStatus();
  setStatus('Chargement des episodes...');

  const data = await getJson(`${API}/episodes/${encodeURIComponent(book.book_id)}?filtered_title=${encodeURIComponent(book.filtered_title)}&lang=${encodeURIComponent(state.lang)}`);
  state.episodes = data.episodes || [];
  renderEpisodes();
  setStatus(state.episodes.length ? '' : 'Aucun episode recu.');
}

function renderEpisodes() {
  els.episodes.innerHTML = '';
  for (const ep of state.episodes) {
    const button = document.createElement('button');
    button.className = 'episode';
    button.type = 'button';
    button.textContent = `EP ${ep.episode}`;
    button.addEventListener('click', () => playEpisode(ep, button));
    els.episodes.appendChild(button);
  }
}

async function playEpisode(ep, button) {
  if (!state.selectedBook) return;
  setStatus(`Chargement episode ${ep.episode}...`);
  const book = state.selectedBook;
  const data = await getJson(`${API}/video/${encodeURIComponent(book.book_id)}/${ep.episode}?filtered_title=${encodeURIComponent(book.filtered_title)}&chapter_id=${encodeURIComponent(ep.chapter_id)}&lang=${encodeURIComponent(state.lang)}`);

  [...document.querySelectorAll('.episode')].forEach((node) => node.classList.remove('is-playing'));
  button.classList.add('is-playing');
  els.meta.textContent = `Episode ${data.episode || ep.episode} - ${formatDuration(data.duration)}`;
  showVideoUrl(data.video_url || '');
  els.empty.classList.add('is-hidden');
  if (data.video_url) {
    loadVideo(data.video_url);
  }
  setStatus(data.video_url ? 'Flux video recu.' : 'Pas de flux video.');
}

function showVideoUrl(url) {
  els.videoUrlInput.value = url;
  els.rawLink.href = url || '#';
  els.videoUrlBox.hidden = !url;
}

function clearVideoUrl() {
  els.videoUrlInput.value = '';
  els.rawLink.href = '#';
  els.videoUrlBox.hidden = true;
}

function loadVideo(url) {
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }
  clearSubtitleStatus();

  if (window.Hls && Hls.isSupported()) {
    state.hls = new Hls({
      enableWebVTT: true,
      subtitleDisplay: true
    });
    state.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => selectSubtitleTrack(state.hls));
    state.hls.on(Hls.Events.MANIFEST_PARSED, () => selectSubtitleTrack(state.hls));
    state.hls.loadSource(url);
    state.hls.attachMedia(els.player);
  } else {
    els.player.src = url;
    setTimeout(selectNativeSubtitleTrack, 800);
  }
}

function selectSubtitleTrack(hls) {
  const tracks = hls.subtitleTracks || [];
  if (!tracks.length) {
    setSubtitleStatus(`Aucun sous-titre detecte`, 'missing');
    return;
  }

  const desired = state.lang.toLowerCase();
  const index = tracks.findIndex((track) => {
    const values = [track.lang, track.name, track.label]
      .filter(Boolean)
      .map((value) => value.toLowerCase());
    return values.includes(desired) || values.some((value) => value.startsWith(`${desired}-`));
  });

  if (index >= 0) {
    hls.subtitleTrack = index;
    setSubtitleStatus(`Sous-titres ${state.lang.toUpperCase()} actifs`, 'on');
  } else {
    hls.subtitleTrack = -1;
    const available = tracks.map((track) => track.lang || track.name).filter(Boolean).join(', ');
    setSubtitleStatus(`Sous-titres ${state.lang.toUpperCase()} indisponibles (${available || 'aucune piste'})`, 'missing');
  }
}

function selectNativeSubtitleTrack() {
  const tracks = [...els.player.textTracks];
  if (!tracks.length) {
    setSubtitleStatus(`Aucun sous-titre detecte`, 'missing');
    return;
  }

  const desired = state.lang.toLowerCase();
  let found = false;
  tracks.forEach((track) => {
    const lang = (track.language || track.label || '').toLowerCase();
    const match = lang === desired || lang.startsWith(`${desired}-`);
    track.mode = match ? 'showing' : 'disabled';
    found = found || match;
  });

  setSubtitleStatus(
    found ? `Sous-titres ${state.lang.toUpperCase()} actifs` : `Sous-titres ${state.lang.toUpperCase()} indisponibles`,
    found ? 'on' : 'missing'
  );
}

function setSubtitleStatus(message, mode) {
  els.subtitleStatus.textContent = message;
  els.subtitleStatus.hidden = false;
  els.subtitleStatus.classList.toggle('is-on', mode === 'on');
  els.subtitleStatus.classList.toggle('is-missing', mode === 'missing');
}

function clearSubtitleStatus() {
  els.subtitleStatus.textContent = '';
  els.subtitleStatus.hidden = true;
  els.subtitleStatus.classList.remove('is-on', 'is-missing');
}

function formatDuration(seconds) {
  if (!seconds) return 'duree inconnue';
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

els.form.addEventListener('submit', (event) => {
  event.preventDefault();
  loadSearch().catch((error) => setStatus(error.message));
});

els.lang.addEventListener('change', async () => {
  state.lang = els.lang.value;
  state.mode = 'search';
  try {
    await loadShelves();
    await loadSearch();
  } catch (error) {
    setStatus(error.message);
  }
});

els.loadMore.addEventListener('click', () => {
  if (state.mode !== 'search' || !state.hasMoreSearch) return;
  loadSearch(state.searchKeyword, state.searchPage + 1, true).catch((error) => setStatus(error.message));
});

els.copyUrl.addEventListener('click', async () => {
  const url = els.videoUrlInput.value;
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    setStatus('URL video copiee.');
  } catch (error) {
    els.videoUrlInput.select();
    document.execCommand('copy');
    setStatus('URL video copiee.');
  }
});

function bindShelfButtons() {
  els.pills = [...document.querySelectorAll('.pill')];
  els.pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const name = pill.dataset.shelf;
      const action = name === 'search' ? loadSearch() : loadShelf(name);
      action.catch((error) => setStatus(error.message));
    });
  });
}

async function init() {
  await loadShelves();
  await loadSearch();
}

init().catch((error) => setStatus(error.message));

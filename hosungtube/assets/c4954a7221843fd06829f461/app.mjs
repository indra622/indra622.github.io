import { rotation, validateRelease, localDay, koreanTime } from './core.mjs';
const release = new URL(import.meta.url).pathname.split('/').at(-2);
// 호성튜브 화면 코드. 프레임워크 없이 작성했다.
// 모든 주소는 상대 경로라서 프록시 하위 경로에서도 동작한다.
'use strict';

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const STORE_KEY = 'hosungtube:public:restored:v1';
const BACKUP_SCHEMA = 'hosungtube.backup/v1';
const HISTORY_MAX = 300;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const thumbUrl = (id, q = 'mqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;
const ytUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

// ───────── 저장소 (이 브라우저에만) ─────────
const storage = (() => {
  let ok = true;
  try { const k = '__ht_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch { ok = false; }
  return {
    ok,
    read() {
      if (!ok) return null;
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
    },
    write(v) {
      if (!ok) return false;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); return true; } catch { return false; }
    },
  };
})();

// saved: 사용자가 나중에·즐겨찾기·기록에 넣은 "서버에서만 온 영상"(시작 목록·직접 추가가 아닌 영상)의 최소 재생 정보.
// 추천이 내려가도 사용자의 저장 목록에서 영상이 사라지지 않게 한다. 추천 이유·글·근거는 담지 않는다.
function emptyStore() { return { added: [], later: [], favorites: [], history: [], saved: {} }; }
const SAVED_MAX = 800;
const SAVED_FIELDS = ['id', 'title', 'channel', 'channelId', 'category', 'durationSeconds', 'publishDate', 'viewCount', 'viewCountAt'];
/** 영상 정보에서 재생에 필요한 칸만 남긴다(주소·추천 내용 같은 다른 칸은 버린다). */
function savedSnapshot(v) {
  const c = sanitizeVideo(v);
  if (!c) return null;
  const o = Object.fromEntries(SAVED_FIELDS.map((k) => [k, c[k]]));
  o.savedAt = typeof v.savedAt === 'string' && !Number.isNaN(Date.parse(v.savedAt)) ? v.savedAt.slice(0, 40) : new Date().toISOString();
  return o;
}
function sanitizeSaved(raw, keepIds) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, SAVED_MAX * 2)) {
    if (!ID_RE.test(k) || !v || v.id !== k || !keepIds.has(k)) continue;
    const c = savedSnapshot(v);
    if (c) out[k] = c;
  }
  return out;
}
const listedIds = (st) => new Set([...st.later, ...st.favorites, ...st.history.map((h) => h.id)]);

function sanitizeVideo(v, sourceFallback = 'manual') {
  if (!v || typeof v !== 'object' || !ID_RE.test(v.id || '') || typeof v.title !== 'string' || !v.title.trim()) return null;
  const num = (x) => (Number.isFinite(Number(x)) && x !== null && x !== '' ? Number(x) : null);
  const date = (x) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) ? x.slice(0, 10) : null);
  return {
    id: v.id,
    title: v.title.trim().slice(0, 300),
    channel: typeof v.channel === 'string' ? v.channel.slice(0, 120) : '알 수 없는 채널',
    channelId: typeof v.channelId === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(v.channelId) ? v.channelId : null,
    category: ['ai', 'dev', 'science', 'etc'].includes(v.category) ? v.category : 'etc',
    durationSeconds: num(v.durationSeconds),
    publishDate: date(v.publishDate),
    viewCount: num(v.viewCount),
    viewCountAt: date(v.viewCountAt),
    addedAt: typeof v.addedAt === 'string' ? v.addedAt : new Date().toISOString(),
    source: typeof v.source === 'string' ? v.source.slice(0, 40) : sourceFallback,
  };
}

function sanitizeStore(raw) {
  const s = emptyStore();
  if (!raw || typeof raw !== 'object') return s;
  const seen = new Set();
  for (const v of Array.isArray(raw.added) ? raw.added : []) {
    const c = sanitizeVideo(v);
    if (c && !seen.has(c.id)) { seen.add(c.id); s.added.push(c); }
  }
  const ids = (a) => [...new Set((Array.isArray(a) ? a : []).filter((x) => typeof x === 'string' && ID_RE.test(x)))];
  s.later = ids(raw.later);
  s.favorites = ids(raw.favorites);
  s.history = (Array.isArray(raw.history) ? raw.history : [])
    .filter((h) => h && ID_RE.test(h.id || '') && typeof h.at === 'string' && !Number.isNaN(Date.parse(h.at)))
    .map((h) => ({ id: h.id, at: h.at }))
    .slice(0, HISTORY_MAX);
  s.saved = sanitizeSaved(raw.saved, listedIds(s)); // v1 이전 저장값에는 saved가 없다 → 빈 값
  return s;
}

let store = sanitizeStore(storage.read());
if (!storage.read()) {
  try {
    const old = sanitizeStore(JSON.parse(localStorage.getItem('hosungtube:v1') || '{}'));
    const published = sanitizeStore(JSON.parse(localStorage.getItem('hosungtube:public:v1') || '{}'));
    store = old;
    store.favorites = [...new Set([...old.favorites, ...published.favorites])];
    const history = new Map();
    for (const h of [...old.history, ...published.history]) if (!history.has(h.id) || history.get(h.id).at < h.at) history.set(h.id, h);
    store.history = [...history.values()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,HISTORY_MAX);
  } catch { /* Existing storage keys are never rewritten. */ }
}
function save() {
  if (!storage.write(store)) showStorageNotice();
}
function showStorageNotice() {
  const n = $('#storageNotice');
  n.textContent = '이 브라우저에서 저장 공간(localStorage)을 쓸 수 없습니다. 나중에 볼 목록과 기록은 이 창을 닫으면 사라집니다.';
  n.hidden = false;
}

// ───────── 상태 ─────────
const DEFAULTS = { q: '', cat: 'all', channel: 'all', sort: 'default', shelf: 'recommended' };
const state = { ...DEFAULTS, seed: [], recs: [], catalog: null, catalogError: null, categories: [], meta: null, loadError: null, loaded: false, watchId: null };
const CAT_LABEL = { ai: 'AI·LLM', dev: '개발', science: '과학', etc: '기타' };

// 영상 목록 = 시작 목록(예시) + AI교양 추천(서버 카탈로그) + 이 브라우저에서 직접 추가한 영상
function allVideos() {
  const map = new Map();
  for (const v of state.seed) map.set(v.id, { ...v, origin: 'seed' });
  for (const r of state.recs) {
    const ex = map.get(r.video.id);
    if (ex) ex.rec = r;
    else { const v = sanitizeVideo({ ...r.video, source: 'wiki' }); if (v) map.set(v.id, { ...v, origin: 'wiki', rec: r }); }
  }
  for (const v of store.added) if (!map.has(v.id)) map.set(v.id, { ...v, origin: 'added' });
  // 저장 목록에만 남은 영상: 추천 표시 없이 재생만 할 수 있게 둔다.
  for (const v of Object.values(store.saved)) if (!map.has(v.id)) map.set(v.id, { ...v, origin: 'saved' });
  return [...map.values()];
}
const recText = (r) => (r ? ` ${r.headline} ${r.articles.map((a) => `${a.title} ${a.episode != null ? a.episode + '편' : ''}`).join(' ')}` : '');
const byId = (id) => allVideos().find((v) => v.id === id) || null;

function normalize(s) { return String(s || '').toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim(); }

function filtered() {
  const all = allVideos();
  let list;
  const pick = (ids) => ids.map((id) => all.find((v) => v.id === id)).filter(Boolean);
  switch (state.shelf) {
    case 'later': list = pick(store.later); break;
    case 'favorites': list = pick(store.favorites); break;
    case 'history': list = pick([...new Set(store.history.map((h) => h.id))]); break;
    case 'added': list = all.filter((v) => v.origin === 'added').reverse(); break;
    case 'recommended': list = rotation(state.recs,localDay()).map((r) => all.find((v) => v.id === r.video.id)).filter(Boolean); break;
    case 'starter': list = all.filter((v) => v.origin === 'seed'); break;
    default: list = all;
  }
  if (state.cat !== 'all') list = list.filter((v) => v.category === state.cat);
  if (state.channel !== 'all') list = list.filter((v) => v.channel === state.channel);
  const terms = normalize(state.q).split(' ').filter(Boolean);
  if (terms.length) list = list.filter((v) => { const hay = normalize(v.title + ' ' + v.channel + recText(v.rec)); return terms.every((t) => hay.includes(t)); });
  const cmpNull = (a, b, f) => (a == null) - (b == null) || f();
  const sorters = {
    newest: (a, b) => cmpNull(a.publishDate, b.publishDate, () => (b.publishDate || '').localeCompare(a.publishDate || '')),
    oldest: (a, b) => cmpNull(a.publishDate, b.publishDate, () => (a.publishDate || '').localeCompare(b.publishDate || '')),
    views: (a, b) => cmpNull(a.viewCount, b.viewCount, () => b.viewCount - a.viewCount),
    short: (a, b) => cmpNull(a.durationSeconds, b.durationSeconds, () => a.durationSeconds - b.durationSeconds),
    long: (a, b) => cmpNull(a.durationSeconds, b.durationSeconds, () => b.durationSeconds - a.durationSeconds),
    title: (a, b) => a.title.localeCompare(b.title, 'ko'),
  };
  if (sorters[state.sort]) list = [...list].sort(sorters[state.sort]);
  return list;
}

// ───────── 형식 ─────────
function fmtDur(s) {
  if (s == null) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
function fmtDurLong(s) {
  if (s == null) return '';
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${Math.max(1, m)}분`;
}
function fmtViews(n) {
  if (n == null) return '';
  if (n >= 1e8) return `조회수 ${(n / 1e8).toFixed(1).replace(/\.0$/, '')}억회`;
  if (n >= 1e4) return `조회수 ${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '')}만회`;
  if (n >= 1e3) return `조회수 ${(n / 1e3).toFixed(1).replace(/\.0$/, '')}천회`;
  return `조회수 ${n}회`;
}
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return `${y}년 ${m}월 ${day}일`;
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function relDate(d) {
  if (!d) return '';
  const days = Math.floor((Date.now() - Date.parse(d + 'T00:00:00Z')) / 864e5);
  if (days < 1) return '오늘';
  if (days < 7) return `${days}일 전`;
  if (days < 31) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}
const viewedIds = () => new Set(store.history.map((h) => h.id));

// ───────── 아이콘 ─────────
const ICON = {
  later: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 3v4.6l3.4 2-1 1.7L11 12.7V7h2Z"/></svg>',
  fav: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Zm0 4.5-1.5 3.1-3.4.5 2.5 2.4-.6 3.4 3-1.6 3 1.6-.6-3.4 2.5-2.4-3.4-.5L12 7.5Z"/></svg>',
  favOn: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
  del: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z"/></svg>',
  ext: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>',
  tv: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v9h16V7H4Zm6 1.5 5 3-5 3v-6Z"/></svg>',
  play: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7L8 5Z"/></svg>',
  pause: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z"/></svg>',
};

function thumbHTML(v, q) {
  return `<div class="thumb"><img src="${thumbUrl(v.id, q)}" alt="" loading="lazy" decoding="async" data-thumb>${v.durationSeconds != null ? `<span class="dur">${fmtDur(v.durationSeconds)}</span>` : ''}</div>`;
}
// 썸네일을 못 불러오면 대체 그림 대신 "썸네일 없음"이라고 적는다.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img instanceof HTMLImageElement && img.hasAttribute('data-thumb')) {
    const box = document.createElement('span');
    box.className = 'noimg';
    box.textContent = '썸네일을 불러오지 못했습니다';
    img.replaceWith(box);
  }
}, true);

const imageObserver = new MutationObserver(records=>{
  for(const record of records) for(const added of record.addedNodes) {
    if(!(added instanceof Element)) continue;
    const imgs = added.matches('img[data-thumb]') ? [added] : [...added.querySelectorAll('img[data-thumb]')];
    for(const img of imgs) setTimeout(()=>{
      if(!img.isConnected || img.complete && img.naturalWidth) return;
      const box=img.closest('.thumb');
      if(box && !box.querySelector('.noimg')) { const fallback=document.createElement('span'); fallback.className='noimg thumb-delay'; fallback.textContent='썸네일 응답이 늦습니다. 제목으로 영상을 열 수 있습니다.'; box.append(fallback); }
    },8000);
  }
});
imageObserver.observe(document.body,{childList:true,subtree:true});
document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement && e.target.hasAttribute('data-thumb')) e.target.closest('.thumb')?.querySelector('.thumb-delay')?.remove();},true);

// ───────── 목록 그리기 ─────────
function renderShelves() {
  const all = allVideos();
  const items = [
    ['recommended', 'AI교양 추천', state.recs.length],
    ['all', '전체', all.length],
    ['later', '나중에 볼 영상', store.later.length],
    ['favorites', '즐겨찾기', store.favorites.length],
    ['history', '열어 본 기록', new Set(store.history.map((h) => h.id)).size],
    ['added', '직접 추가', store.added.length],
  ];
  $('#shelves').innerHTML = items.map(([k, label, n]) =>
    `<button type="button" class="shelf" data-shelf="${k}" aria-pressed="${state.shelf === k}">${label}<span class="n">${n}</span></button>`).join('');
}

function renderCats() {
  const cats = [{ key: 'all', label: '전체 분야' }, ...state.categories];
  if (store.added.some((v) => v.category === 'etc') && !cats.some((c) => c.key === 'etc')) cats.push({ key: 'etc', label: '기타' });
  $('#cats').innerHTML = cats.map((c) => `<button type="button" class="chip" data-cat="${esc(c.key)}" aria-pressed="${state.cat === c.key}">${esc(c.label)}</button>`).join('');
}

function renderChannelSelect() {
  const sel = $('#channelSel');
  const names = [...new Set(allVideos().map((v) => v.channel))].sort((a, b) => a.localeCompare(b, 'ko'));
  if (state.channel !== 'all' && !names.includes(state.channel)) state.channel = 'all';
  sel.innerHTML = `<option value="all">모든 채널</option>` + names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value = state.channel;
}

function isDefaultFilters() {
  return state.q === DEFAULTS.q && state.cat === DEFAULTS.cat && state.channel === DEFAULTS.channel && state.sort === DEFAULTS.sort;
}

function cardHTML(v, viewed) {
  const later = store.later.includes(v.id), fav = store.favorites.includes(v.id);
  const meta = [v.publishDate ? `<span title="${fmtDate(v.publishDate)}">${relDate(v.publishDate)}</span>` : '', v.viewCount != null ? `<span>${fmtViews(v.viewCount)}</span>` : '']
    .filter(Boolean).join(' · ');
  return `<article class="card${viewed ? ' seen' : ''}" data-id="${v.id}">
    <a href="#/watch/${v.id}" aria-label="${esc(v.title)} 재생 (${esc(v.channel)}${v.durationSeconds != null ? ', ' + fmtDurLong(v.durationSeconds) : ''})">
      ${thumbHTML(v, 'mqdefault')}
      <span class="badges">${v.rec ? '<span class="badge rec">AI교양 추천</span>' : ''}${viewed ? '<span class="badge">열어 봄</span>' : ''}${v.origin === 'added' ? '<span class="badge acc">직접 추가</span>' : ''}</span>
      <h3>${esc(v.title)}</h3>
    </a>
    <p class="meta"><span class="ch">${esc(v.channel)}</span> · ${esc(CAT_LABEL[v.category] || '기타')}${meta ? '<br>' + meta : ''}</p>
    ${v.rec ? `<p class="why-line"><span class="why-k">왜?</span> ${esc(v.rec.headline)}</p><p class="why-arts">${v.rec.articles.map((a) => `<span>AI교양 ${a.episode != null ? esc(a.episode) + '편' : esc(a.title)}</span>`).join('')}</p>` : ''}
    <div class="card-acts">
      <button type="button" class="ibtn" data-act="later" aria-pressed="${later}" aria-label="나중에 볼 영상${later ? '에서 빼기' : '에 넣기'}: ${esc(v.title)}">${ICON.later}<span>${later ? '나중에 볼 목록에 있음' : '나중에'}</span></button>
      <button type="button" class="ibtn" data-act="fav" aria-pressed="${fav}" aria-label="즐겨찾기${fav ? ' 해제' : ''}: ${esc(v.title)}">${fav ? ICON.favOn : ICON.fav}<span>${fav ? '즐겨찾기됨' : '즐겨찾기'}</span></button>
      ${v.origin === 'added' ? `<button type="button" class="ibtn del" data-act="remove" aria-label="직접 추가한 영상 삭제: ${esc(v.title)}">${ICON.del}<span>삭제</span></button>` : ''}
    </div>
  </article>`;
}

function renderGrid() {
  const grid = $('#grid');
  grid.setAttribute('aria-busy', String(!state.loaded));
  $('#resetBtn').disabled = isDefaultFilters();
  if (!state.loaded) return;
  if (state.loadError && (state.shelf === 'starter' || state.shelf === 'all' || !allVideos().length) && state.shelf !== 'recommended') {
    grid.innerHTML = `<div class="error-box" role="alert"><h2>시작 목록을 불러오지 못했습니다</h2><p>${esc(state.loadError)}</p><button type="button" class="btn" id="retryLoad">다시 시도</button></div>`;
    $('#count').textContent = '';
    return;
  }
  const list = filtered();
  const total = allVideos().length;
  const shelfName = { recommended: 'AI교양 추천', starter: '시작 목록(예시)', all: '전체', later: '나중에 볼 영상', favorites: '즐겨찾기', history: '열어 본 기록', added: '직접 추가' }[state.shelf];
  if (state.shelf === 'recommended' && state.catalogError) {
    grid.innerHTML = `<div class="error-box" role="alert"><h2>AI교양 추천 목록을 불러오지 못했습니다</h2><p>${esc(state.catalogError)}</p><p class="row center"><button type="button" class="btn" id="retryLoad">다시 시도</button></p></div>`;
    $('#count').textContent = '';
    return;
  }
  $('#count').textContent = `${shelfName} · ${list.length}개 영상${state.shelf === 'all' && list.length !== total ? ` (전체 ${total}개 중)` : ''}`;
  if (!list.length) {
    const shelfEmpty = state.shelf !== 'all' && isDefaultFilters();
    const msg = shelfEmpty ? {
      later: ['나중에 볼 영상이 없습니다', '카드 아래의 "나중에" 버튼을 누르면 여기에 모입니다.'],
      favorites: ['즐겨찾기한 영상이 없습니다', '카드 아래의 "즐겨찾기" 버튼을 누르면 여기에 모입니다.'],
      history: ['열어 본 영상이 없습니다', '영상을 열면 이 브라우저에 기록이 남습니다.'],
      added: ['직접 추가한 영상이 없습니다', '"추가·관리"에서 YouTube 주소를 넣어 보세요.'],
      recommended: ['아직 공개된 AI교양 추천이 없습니다', '새 공개 데이터가 준비되면 추천을 볼 수 있습니다.'],
      starter: ['시작 목록이 비어 있습니다', 'data/videos.json을 확인하세요.'],
    }[state.shelf] : ['조건에 맞는 영상이 없습니다', '검색어를 바꾸거나 필터를 초기화해 보세요.'];
    grid.innerHTML = `<div class="empty"><h2>${msg[0]}</h2><p>${msg[1]}</p>${shelfEmpty ? '' : '<button type="button" class="btn" data-reset>필터 초기화</button>'}</div>`;
    return;
  }
  const viewed = viewedIds();
  grid.innerHTML = list.map((v) => cardHTML(v, viewed.has(v.id))).join('');
}

function renderEvidenceStatus() {
  const el = $('#evidenceStatus');
  el.textContent = state.catalogError || (state.catalog ? `근거 전체 확인: ${koreanTime(state.catalog.sourcesCheckedAt)} · 데이터 생성: ${koreanTime(state.catalog.generatedAt)}` : '추천 데이터를 확인하는 중입니다.');
}
function renderProvenance() {
  $('#provenance').textContent = `AI교양 추천 ${state.recs.length}개 · 편집 검토(자동 보조), 사용자 승인이 아닙니다. 배포본 ${release}. 영상 본편 재생과 현재 자료의 일치 여부는 별도 확인이 필요합니다.`;
}

function render() {
  renderEvidenceStatus();
  renderShelves();
  renderCats();
  renderChannelSelect();
  $('#sortSel').value = state.sort;
  if ($('#q').value !== state.q) $('#q').value = state.q;
  renderGrid();
  if (state.watchId) renderWatchSide();
}

// ───────── 데이터 불러오기 ─────────
async function loadCatalog() {
  state.catalogError = null;
  try {
    const res = await fetch(new URL('./catalog.json',import.meta.url),{cache:'no-cache'});
    if (!res.ok) throw Error('추천 데이터를 불러오지 못했습니다.');
    const bytes = await res.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    if (digest !== '9bd1c09948a07bb100e426653866718d06b6e2395adba444a039c0496d38a06e') throw Error('배포 데이터 검증에 실패했습니다. 새로고침해 주세요.');
    state.catalog = validateRelease(JSON.parse(new TextDecoder().decode(bytes)),release);
    state.recs = state.catalog.recommendations.map(r=>({...r,articles:r.articles.map(a=>({...a,episode:Number(/^aig-(\d+)$/.exec(a.articleKey)?.[1]) || null}))}));
  } catch(e) { state.catalog = null; state.recs = []; state.catalogError = e.message; }
}
async function loadSeed() {
  await loadCatalog();
  state.categories = Object.entries(CAT_LABEL).map(([key,label])=>({key,label}));
  state.loaded = true;
  renderProvenance(); render(); refreshDay(); route();
}

// ───────── 목록·시청 기록 조작 ─────────
/** 서버에서만 온 영상(추천)을 저장 목록에 넣을 때 최소 재생 정보를 이 브라우저에 남긴다. */
function rememberVideo(id) {
  const v = byId(id);
  if (!v || (v.origin !== 'wiki' && v.origin !== 'saved')) return;
  const snap = savedSnapshot({ ...v, savedAt: store.saved[id]?.savedAt });
  if (snap) store.saved[id] = snap;
}
/** 어느 목록에도 없는 영상의 저장 정보는 지운다(사용자가 저장한 것만 남긴다). */
function pruneSaved() {
  const keep = listedIds(store);
  for (const k of Object.keys(store.saved)) if (!keep.has(k)) delete store.saved[k];
}
function toggleIn(listName, id) {
  const a = store[listName];
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else { a.unshift(id); rememberVideo(id); }
  pruneSaved();
  save();
  return i < 0;
}
function recordView(id) {
  rememberVideo(id);
  store.history = [{ id, at: new Date().toISOString() }, ...store.history.filter((h) => h.id !== id)].slice(0, HISTORY_MAX);
  pruneSaved();
  save();
}

let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">되돌리기</button>' : ''}`;
  t.hidden = false;
  if (undo) $('button', t).onclick = () => { undo(); t.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 6000 : 2600);
}

function removeAdded(id) {
  const i = store.added.findIndex((v) => v.id === id);
  if (i < 0) return;
  const [removed] = store.added.splice(i, 1);
  save();
  render();
  toast('직접 추가한 영상을 삭제했습니다', () => { store.added.splice(i, 0, removed); save(); render(); });
}

// ───────── 플레이어 ─────────
// YouTube IFrame API를 쓰면 다음 영상 자동 재생·오류 감지가 된다. API를 못 불러오면 기본 iframe으로 보여 준다.
let ytPromise = null;
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 8000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { clearTimeout(timer); reject(new Error('load error')); };
    document.head.append(s);
  }).catch((e) => { ytPromise = null; throw e; });
  return ytPromise;
}

const YT_ERRORS = {
  2: '영상 ID가 올바르지 않습니다.',
  5: '이 브라우저에서 영상을 재생하지 못했습니다.',
  100: '영상을 찾을 수 없습니다. 삭제되었거나 비공개일 수 있습니다.',
  101: '영상 게시자가 다른 사이트에서의 재생을 막았습니다.',
  150: '영상 게시자가 다른 사이트에서의 재생을 막았습니다.',
  153: 'YouTube가 이 페이지의 재생 요청을 받아들이지 않았습니다.',
};

/**
 * host 안에 플레이어를 만든다. 반환값: { kind: 'api'|'iframe', player?, destroy() }
 * opts: { autoplay, onEnded, onError(code,msg), onState(state), onAutoplayBlocked() }
 */
async function mountPlayer(host, id, opts = {}) {
  host.innerHTML = '';
  const slot = document.createElement('div');
  host.append(slot);
  let destroyed = false;
  try {
    const YT = await loadYT();
    if (!slot.isConnected) return null; // 기다리는 사이 다른 영상으로 바뀜
    let started = false;
    const player = new YT.Player(slot, {
      host: 'https://www.youtube-nocookie.com',
      videoId: id,
      playerVars: { autoplay: opts.autoplay ? 1 : 0, rel: 0, playsinline: 1, modestbranding: 1, origin: location.origin, ...(opts.start ? { start: opts.start } : {}) },
      events: {
        onReady: (e) => {
          const f = e.target.getIframe?.();
          if (f) f.title = 'YouTube 영상 플레이어';
          if (opts.autoplay) {
            try { e.target.playVideo(); } catch { /* 무시 */ }
            setTimeout(() => {
              if (destroyed || started) return;
              const st = e.target.getPlayerState?.();
              if (st === -1 || st === 5 || st === undefined) opts.onAutoplayBlocked?.();
            }, 3500);
          }
        },
        onStateChange: (e) => {
          if (e.data === 1 || e.data === 3) started = true;
          opts.onState?.(e.data);
          if (e.data === 0) opts.onEnded?.();
        },
        onError: (e) => opts.onError?.(e.data, YT_ERRORS[e.data] || `재생 오류가 났습니다 (코드 ${e.data}).`),
      },
    });
    return { kind: 'api', player, destroy() { destroyed = true; try { player.destroy(); } catch { /* 무시 */ } } };
  } catch {
    if (!slot.isConnected) return null;
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1${opts.autoplay ? '&autoplay=1' : ''}${opts.start ? `&start=${Math.floor(opts.start)}` : ''}`;
    f.title = 'YouTube 영상 플레이어';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    slot.replaceWith(f);
    opts.onFallback?.();
    return { kind: 'iframe', destroy() { f.remove(); } };
  }
}

// ───────── 추천 이유(재생 화면) ─────────
const REL_ICON = { 'same-topic': '같은 소식', background: '배경 지식', 'related-case': '다른 사례', counterpoint: '다른 관점' };
function whyHTML(r) {
  const at = state.catalog?.sourcesCheckedAt;
  const arts = r.articles.map((a) => `
    <li class="art">
      <div class="art-head">
        <span class="art-kicker">${esc(REL_ICON[a.relation] || a.relationLabel || '관련 글')}</span>
        <h4>${esc(a.title)}</h4>
        <p class="art-ver">AI교양${a.episode != null ? ` ${esc(a.episode)}편` : ''} · 공개용 요약 · <span class="local">로컬 볼트의 정리노트 · 공개 주소 없음(읽기 전용)</span></p>
      </div>
      <p class="art-sum"><strong>글 요약</strong> ${esc(a.summary)}</p>
      <p class="art-rel"><strong>영상과의 관계</strong> ${esc(a.relationNote)}</p>
      ${a.chapter ? `<p><button type="button" class="btn btn-sm" data-seek="${Number(a.chapter.start) || 0}">▶ 관련 구간부터 보기 · ${esc(a.chapter.label || fmtDur(a.chapter.start))}</button></p>` : ''}
      ${a.refs?.length ? `<p class="refs"><strong>글이 참고한 공개 자료</strong>${a.refs.map((x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a>`).join('')}</p>` : ''}
    </li>`).join('');
  return `<section class="why" aria-labelledby="whyTitle">
    <p class="why-kicker">AI교양 추천</p>
    <h3 id="whyTitle">왜 이 영상을 골랐나</h3>
    <p class="why-head">${esc(r.headline)}</p>
    <p class="why-reason">${esc(r.reason)}</p>
    <h3 class="why-sub">관련 AI교양 글</h3>
    <ul class="arts">${arts}</ul>
    <details class="evidence">
      <summary>무엇을 확인했고, 무엇을 확인하지 못했나</summary>
      ${r.evidence.inspected.length ? `<p><strong>확인한 것</strong></p><ul>${r.evidence.inspected.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${r.evidence.limits.length ? `<p><strong>한계</strong></p><ul>${r.evidence.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </details>
    <p class="why-foot">${r.review ? `검토: ${esc(r.review.label)} (${esc(fmtDateTime(r.review.at))})` : '검토 기록 없음'}${at ? ` · 마지막 전체 확인 성공: ${esc(fmtDateTime(at))}` : ''}</p>
  </section>`;
}

function seekWatch(sec) {
  const p = watchPlayer;
  if (p?.kind === 'api' && typeof p.player?.seekTo === 'function') {
    try { p.player.seekTo(sec, true); p.player.playVideo?.(); toast(`${fmtDur(sec)}부터 재생합니다`); return; } catch { /* 아래로 */ }
  }
  // 기본 플레이어거나 아직 준비 전이면 시작 위치를 넣어 다시 만든다.
  const host = $('#wPlayer');
  if (!host || !state.watchId) return;
  if (watchPlayer) { watchPlayer.destroy(); watchPlayer = null; }
  const id = state.watchId;
  mountPlayer(host, id, { autoplay: true, start: sec }).then((np) => { if (state.watchId === id) watchPlayer = np; else np?.destroy(); });
  toast(`${fmtDur(sec)}부터 재생합니다`);
}

// ───────── 재생 화면 ─────────
let watchPlayer = null;
function upNextList(id) {
  const list = filtered();
  const i = list.findIndex((v) => v.id === id);
  const rest = i >= 0 ? [...list.slice(i + 1), ...list.slice(0, i)] : list.filter((v) => v.id !== id);
  return rest.slice(0, 8);
}

function renderWatchSide() {
  const side = $('#upnext');
  if (!side) return;
  const v = byId(state.watchId);
  const next = upNextList(state.watchId);
  side.innerHTML = `<h2>이어서 볼 영상</h2>${next.length ? `<ol>${next.map((n) => `<li><a class="mini" href="#/watch/${n.id}">${thumbHTML(n, 'mqdefault')}<div><h3>${esc(n.title)}</h3><p>${esc(n.channel)}</p></div></a></li>`).join('')}</ol>` : '<p class="help">지금 필터에 맞는 다른 영상이 없습니다.</p>'}`;
  if (v) {
    const later = store.later.includes(v.id), fav = store.favorites.includes(v.id);
    const lb = $('#wLater'), fb = $('#wFav');
    if (lb) { lb.setAttribute('aria-pressed', later); lb.lastChild.textContent = later ? '나중에 볼 목록에 있음' : '나중에 볼 영상'; }
    if (fb) { fb.setAttribute('aria-pressed', fav); fb.lastChild.textContent = fav ? '즐겨찾기됨' : '즐겨찾기'; }
  }
}

function openWatch(id) {
  const sec = $('#watch');
  const v = byId(id);
  if (watchPlayer) { watchPlayer.destroy(); watchPlayer = null; }
  state.watchId = id;
  if (!v) {
    sec.hidden = false;
    sec.innerHTML = `<div class="error-box" role="alert"><h2>목록에 없는 영상입니다</h2><p>주소가 잘못되었거나 직접 추가한 영상을 삭제했을 수 있습니다.</p><p><a class="btn" href="${ytUrl(esc(ID_RE.test(id) ? id : ''))}" target="_blank" rel="noopener noreferrer">YouTube에서 찾아보기</a> <a class="btn btn-ghost" href="#/">목록으로</a></p></div>`;
    return;
  }
  recordView(id);
  pickDaily();
  const meta = [
    `<a href="https://www.youtube.com/${v.channelId ? 'channel/' + v.channelId : 'results?search_query=' + encodeURIComponent(v.channel)}" target="_blank" rel="noopener noreferrer">${esc(v.channel)}</a>`,
    v.publishDate ? `${fmtDate(v.publishDate)} 게시` : '',
    v.durationSeconds != null ? fmtDurLong(v.durationSeconds) : '',
    v.viewCount != null ? `${fmtViews(v.viewCount)}${v.viewCountAt ? ` (${fmtDate(v.viewCountAt)} 기준)` : ''}` : '',
  ].filter(Boolean).join(' · ');
  sec.hidden = false;
  sec.innerHTML = `
    <div class="w-main">
      <div class="player-wrap" id="wPlayer" aria-label="영상 플레이어"></div>
      <h2 class="w-title" id="wTitle" tabindex="-1">${esc(v.title)}</h2>
      <p class="w-meta">${meta}</p>
      <div class="w-actions">
        <button type="button" class="btn" id="wPrev" aria-label="이전 영상">← 이전</button>
        <button type="button" class="btn" id="wNext" aria-label="다음 영상">다음 →</button>
        <button type="button" class="btn" id="wLater" aria-pressed="false">${ICON.later}<span></span></button>
        <button type="button" class="btn" id="wFav" aria-pressed="false">${ICON.favOn}<span></span></button>
        <button type="button" class="btn" id="wTv">${ICON.tv}<span>TV 모드로 보기</span></button>
        <a class="btn btn-ghost" href="${ytUrl(v.id)}" target="_blank" rel="noopener noreferrer">${ICON.ext}<span>YouTube에서 열기</span></a>
      </div>
      ${v.rec ? whyHTML(v.rec) : ''}
    </div>
    <aside class="upnext" id="upnext" aria-label="이어서 볼 영상"></aside>`;
  renderWatchSide();
  const host = $('#wPlayer');
  const showMsg = (html, isError) => {
    $('.player-msg', host.parentElement)?.remove();
    const m = document.createElement('div');
    m.className = 'player-msg' + (isError ? ' error' : '');
    m.setAttribute('role', isError ? 'alert' : 'status');
    m.innerHTML = html;
    host.append(m);
  };
  mountPlayer(host, id, {
    autoplay: true,
    onAutoplayBlocked: () => showMsg('브라우저가 자동 재생을 막았을 수 있습니다. 플레이어의 재생 버튼을 눌러 주세요.'),
    onState: (s) => { if (s === 1) $('.player-msg:not(.error)', host)?.remove(); },
    onError: (_c, msg) => showMsg(`<strong>${esc(msg)}</strong><span>YouTube 사이트에서는 볼 수 있을 수도 있습니다.</span><a class="btn btn-accent" href="${ytUrl(v.id)}" target="_blank" rel="noopener noreferrer">YouTube에서 열기</a>`, true),
    onFallback: () => showMsg('플레이어 조작 기능(YouTube IFrame API)을 불러오지 못해 기본 플레이어로 보여 줍니다. 재생이 안 되면 "YouTube에서 열기"를 누르세요.'),
  }).then((p) => { if (state.watchId === id) watchPlayer = p; else p?.destroy(); });
  renderShelves();
}

function closeWatch() {
  if (watchPlayer) { watchPlayer.destroy(); watchPlayer = null; }
  state.watchId = null;
  const sec = $('#watch');
  sec.hidden = true;
  sec.innerHTML = '';
}

function stepWatch(dir) {
  const list = filtered();
  if (!list.length) return;
  const i = list.findIndex((v) => v.id === state.watchId);
  const n = list[(i < 0 ? 0 : i + dir + list.length) % list.length];
  location.hash = `#/watch/${n.id}`;
}

// ───────── TV 모드 ─────────
const tv = { open: false, queue: [], trail: [], pos: -1, shuffle: false, player: null, playing: false, lastFocus: null, errTimer: null };

function tvOpen(startId) {
  const list = filtered();
  tv.queue = (list.length ? list : allVideos()).map((v) => v.id);
  if (!tv.queue.length) { toast('재생할 영상이 없습니다'); return; }
  const first = startId && tv.queue.includes(startId) ? startId : (tv.shuffle ? tv.queue[Math.floor(Math.random() * tv.queue.length)] : tv.queue[0]);
  tv.trail = [first];
  tv.pos = 0;
  tv.open = true;
  tv.lastFocus = document.activeElement;
  if (watchPlayer) { try { watchPlayer.player?.pauseVideo?.(); } catch { /* 무시 */ } }
  $('#tv').hidden = false;
  document.body.classList.add('tv-open');
  $('#tvShuffle').setAttribute('aria-pressed', String(tv.shuffle));
  tvLoad();
  $('#tvClose').focus();
}

function tvClose() {
  if (!tv.open) return;
  tv.open = false;
  clearTimeout(tv.errTimer);
  tv.player?.destroy();
  tv.player = null;
  $('#tvPlayer').innerHTML = '';
  $('#tv').hidden = true;
  document.body.classList.remove('tv-open');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  render();
  if (tv.lastFocus && tv.lastFocus !== document.body && document.contains(tv.lastFocus)) tv.lastFocus.focus(); else $('#tvBtn').focus();
}

function tvCurrent() { return tv.trail[tv.pos]; }

function tvMsg(html) {
  const m = $('#tvMsg');
  if (!html) { m.hidden = true; m.innerHTML = ''; return; }
  m.innerHTML = html;
  m.hidden = false;
}

function tvSetPlaying(p) {
  tv.playing = p;
  const b = $('#tvPlay');
  b.innerHTML = p ? ICON.pause : ICON.play;
  b.setAttribute('aria-label', p ? '일시정지 (K)' : '재생 (K)');
}

function tvLoad() {
  const id = tvCurrent();
  const v = byId(id);
  clearTimeout(tv.errTimer);
  tvMsg('');
  tvSetPlaying(false);
  $('#tvTitle').textContent = v ? v.title : id;
  $('#tvMeta').textContent = v ? [v.channel, v.durationSeconds != null ? fmtDurLong(v.durationSeconds) : '', v.publishDate ? fmtDate(v.publishDate) : ''].filter(Boolean).join(' · ') : '';
  const qi = tv.queue.indexOf(id);
  $('#tvPos').textContent = `${tv.shuffle ? '섞어서 보기' : '순서대로 보기'} · ${qi + 1} / ${tv.queue.length}`;
  $('#tvOpen').href = ytUrl(id);
  $('#tv').dataset.videoId = id;
  recordView(id);
  pickDaily();
  tv.player?.destroy();
  tv.player = null;
  $('#tvCatch').hidden = true;
  mountPlayer($('#tvPlayer'), id, {
    autoplay: true,
    onState: (s) => { if (s === 1) { tvSetPlaying(true); tvMsg(''); } else if (s === 2 || s === 0) tvSetPlaying(false); },
    onEnded: () => tvNext(),
    onAutoplayBlocked: () => tvMsg('브라우저가 자동 재생을 막았습니다. <strong>K</strong> 키나 재생 버튼을 눌러 주세요.<div class="row"><button type="button" class="btn btn-accent" data-tv-play>재생</button></div>'),
    onError: (_c, msg) => {
      tvMsg(`<strong>${esc(msg)}</strong><br>5초 뒤 다음 영상으로 넘어갑니다.<div class="row"><a class="btn" href="${ytUrl(id)}" target="_blank" rel="noopener noreferrer">YouTube에서 열기</a><button type="button" class="btn btn-accent" data-tv-next>지금 넘기기</button></div>`);
      tv.errTimer = setTimeout(() => { if (tv.open && tvCurrent() === id) tvNext(); }, 5000);
    },
    onFallback: () => tvMsg('플레이어 조작 기능을 불러오지 못했습니다. 영상 안의 재생 버튼을 쓰고, 다음 영상은 → 키로 넘기세요.'),
  }).then((p) => {
    if (!tv.open || tvCurrent() !== id) { p?.destroy(); return; }
    tv.player = p;
    // API 플레이어일 때만 덮개를 둔다: 키보드 포커스가 iframe으로 넘어가지 않게 하고, 누르면 재생/일시정지.
    $('#tvCatch').hidden = !p || p.kind !== 'api';
  });
}

function tvNext() {
  if (tv.pos < tv.trail.length - 1) tv.pos++;
  else {
    const cur = tvCurrent();
    let nextId;
    if (tv.shuffle && tv.queue.length > 1) {
      const recent = new Set(tv.trail.slice(-Math.min(tv.queue.length - 1, 20)));
      const pool = tv.queue.filter((x) => !recent.has(x));
      const from = pool.length ? pool : tv.queue.filter((x) => x !== cur);
      nextId = from[Math.floor(Math.random() * from.length)];
    } else {
      nextId = tv.queue[(tv.queue.indexOf(cur) + 1) % tv.queue.length];
    }
    tv.trail.push(nextId);
    tv.pos = tv.trail.length - 1;
  }
  tvLoad();
}

function tvPrev() {
  if (tv.pos > 0) tv.pos--;
  else {
    const i = tv.queue.indexOf(tvCurrent());
    tv.trail.unshift(tv.queue[(i - 1 + tv.queue.length) % tv.queue.length]);
    tv.pos = 0;
  }
  tvLoad();
}

function tvToggleShuffle() {
  tv.shuffle = !tv.shuffle;
  tv.trail = tv.trail.slice(0, tv.pos + 1); // 앞으로 갈 길은 새로 고른다
  $('#tvShuffle').setAttribute('aria-pressed', String(tv.shuffle));
  const qi = tv.queue.indexOf(tvCurrent());
  $('#tvPos').textContent = `${tv.shuffle ? '섞어서 보기' : '순서대로 보기'} · ${qi + 1} / ${tv.queue.length}`;
  toast(tv.shuffle ? '섞어서 보기를 켰습니다' : '순서대로 보기로 바꿨습니다');
}

function tvTogglePlay() {
  if (!tv.player) { toast('플레이어를 준비하는 중입니다'); return; }
  const p = tv.player.player;
  if (tv.player.kind !== 'api' || !p || typeof p.getPlayerState !== 'function') { toast('기본 플레이어에서는 영상 안의 버튼을 눌러 주세요'); return; }
  try {
    if (p.getPlayerState() === 1) p.pauseVideo(); else { p.playVideo(); tvMsg(''); }
  } catch { /* 플레이어 준비 전 */ }
}

function tvKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (k === 'Escape') { e.preventDefault(); tvClose(); return; }
  if (k === 'Tab') { // 포커스를 TV 창 안에 가둔다
    const f = [...$('#tv').querySelectorAll('button:not([hidden]), a[href]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    return;
  }
  const onButton = document.activeElement?.closest?.('#tv button, #tv a');
  if (k === 'ArrowRight' || k === 'n' || k === 'N') { e.preventDefault(); tvNext(); }
  else if (k === 'ArrowLeft' || k === 'p' || k === 'P') { e.preventDefault(); tvPrev(); }
  else if (k === 's' || k === 'S') { e.preventDefault(); tvToggleShuffle(); }
  else if (k === 'k' || k === 'K' || (k === ' ' && !onButton)) { e.preventDefault(); tvTogglePlay(); }
  else if (k === 'f' || k === 'F') {
    e.preventDefault();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else $('#tv').requestFullscreen?.().catch(() => toast('이 브라우저에서는 전체 화면을 쓸 수 없습니다'));
  }
}

// ───────── 추가·관리 창 ─────────
const manage = $('#manage');
function openManage() {
  if (!manage.open) manage.showModal();
  setTimeout(()=>$('#exportBtn').focus(),0);
}
function alertHTML(kind,msg) { return `<div class="alert ${kind}" role="${kind==='err'?'alert':'status'}">${msg}</div>`; }

function exportData() {
  const data = { schema: BACKUP_SCHEMA, exportedAt: new Date().toISOString(), ...store };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hosungtube-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('JSON 파일을 내보냈습니다');
}

async function importData(file) {
  const out = $('#importResult');
  if (!file) return;
  if (file.size > 2_000_000) { out.innerHTML = alertHTML('err', '파일이 너무 큽니다 (2MB 이하만 받습니다).'); return; }
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { out.innerHTML = alertHTML('err', 'JSON 파일이 아니거나 내용이 깨져 있습니다.'); return; }
  if (raw?.schema === 'hosungtube.public-backup/v1') raw = {schema:BACKUP_SCHEMA,...raw.data};
  if (!raw || raw.schema !== BACKUP_SCHEMA) { out.innerHTML = alertHTML('err', `호성튜브 백업 파일이 아닙니다 (schema가 "${BACKUP_SCHEMA}"이어야 합니다).`); return; }
  const clean = sanitizeStore(raw);
  const countIn = (a) => (Array.isArray(a) ? a.length : 0);
  const skipped = countIn(raw.added) - clean.added.length + countIn(raw.later) - clean.later.length + countIn(raw.favorites) - clean.favorites.length + countIn(raw.history) - clean.history.length
    + (raw.saved && typeof raw.saved === 'object' && !Array.isArray(raw.saved) ? Object.keys(raw.saved).length : 0) - Object.keys(clean.saved).length;
  let addN = 0;
  for (const v of clean.added) if (!byId(v.id)) { store.added.push(v); addN++; }
  const merge = (a, b) => [...new Set([...a, ...b])];
  const laterBefore = store.later.length, favBefore = store.favorites.length, histBefore = store.history.length;
  store.later = merge(store.later, clean.later);
  store.favorites = merge(store.favorites, clean.favorites);
  const hist = new Map();
  for (const h of [...store.history, ...clean.history]) if (!hist.has(h.id) || hist.get(h.id).at < h.at) hist.set(h.id, h);
  store.history = [...hist.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, HISTORY_MAX);
  // 백업의 저장 영상 정보: 목록에 있는 영상만, 이미 이 브라우저에 있는 정보는 그대로 둔다.
  for (const [k, v] of Object.entries(clean.saved)) if (!store.saved[k]) store.saved[k] = v;
  pruneSaved();
  save();
  render();
  out.innerHTML = alertHTML(skipped ? 'err' : 'ok',
    `가져왔습니다: 새 영상 ${addN}개, 나중에 볼 영상 ${store.later.length - laterBefore}개, 즐겨찾기 ${store.favorites.length - favBefore}개, 기록 ${store.history.length - histBefore}개.${skipped ? `<br>형식이 맞지 않아 건너뛴 항목 ${skipped}개가 있습니다.` : ''}`);
}

// ───────── 주소(해시) 경로 ─────────
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const m = h.match(/^watch\/([A-Za-z0-9_-]{11})$/);
  if (m) {
    if (!state.loaded) return;
    if (state.watchId !== m[1] || $('#watch').hidden) {
      openWatch(m[1]);
      window.scrollTo({ top: 0, behavior: 'instant' });
      $('#wTitle')?.focus({ preventScroll: true });
    }
  } else if (state.watchId) {
    closeWatch();
  }
}

// ───────── 이벤트 연결 ─────────
function resetFilters() {
  Object.assign(state, { q: '', cat: 'all', channel: 'all', sort: 'default' });
  render();
}

let searchTimer;
$('#q').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = e.target.value; renderGrid(); if (state.watchId) renderWatchSide(); }, 120);
});
$('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); state.q = $('#q').value; renderGrid(); $('#grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('#channelSel').addEventListener('change', (e) => { state.channel = e.target.value; renderGrid(); renderWatchSide(); });
$('#sortSel').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); renderWatchSide(); });
$('#resetBtn').addEventListener('click', resetFilters);
$('#shelves').addEventListener('click', (e) => {
  const b = e.target.closest('[data-shelf]'); if (!b) return;
  state.shelf = b.dataset.shelf; render();
});
$('#cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  state.cat = b.dataset.cat; render();
});
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-reset]')) { resetFilters(); return; }
  if (t.closest('#retryLoad')) { loadSeed(); return; }
  const go = t.closest('[data-shelf-go]');
  if (go) { state.shelf = go.dataset.shelfGo; render(); return; }
  const seek = t.closest('[data-seek]');
  if (seek) { seekWatch(Number(seek.dataset.seek) || 0); return; }
  if (t.closest('[data-close-manage]')) { manage.close(); return; }
  const act = t.closest('.card [data-act]');
  if (act) {
    const id = act.closest('.card').dataset.id;
    if (act.dataset.act === 'later') toast(toggleIn('later', id) ? '나중에 볼 영상에 넣었습니다' : '나중에 볼 영상에서 뺐습니다');
    else if (act.dataset.act === 'fav') toast(toggleIn('favorites', id) ? '즐겨찾기에 넣었습니다' : '즐겨찾기에서 뺐습니다');
    else if (act.dataset.act === 'remove') { if (state.watchId === id) location.hash = '#/'; removeAdded(id); return; }
    const keep = document.activeElement === act ? `[data-id="${id}"] [data-act="${act.dataset.act}"]` : null;
    render();
    if (keep) $(keep)?.focus();
    return;
  }
  if (t.closest('#wLater')) { toast(toggleIn('later', state.watchId) ? '나중에 볼 영상에 넣었습니다' : '나중에 볼 영상에서 뺐습니다'); render(); return; }
  if (t.closest('#wFav')) { toast(toggleIn('favorites', state.watchId) ? '즐겨찾기에 넣었습니다' : '즐겨찾기에서 뺐습니다'); render(); return; }
  if (t.closest('#wTv')) { tvOpen(state.watchId); return; }
  if (t.closest('#wPrev')) { stepWatch(-1); return; }
  if (t.closest('#wNext')) { stepWatch(1); return; }
  if (t.closest('[data-tv-next]')) { tvNext(); return; }
  if (t.closest('[data-tv-play]')) { tvTogglePlay(); return; }

});

$('#tvBtn').addEventListener('click', () => tvOpen(state.watchId));
$('#tvClose').addEventListener('click', tvClose);
$('#tvNext').addEventListener('click', tvNext);
$('#tvPrev').addEventListener('click', tvPrev);
$('#tvShuffle').addEventListener('click', tvToggleShuffle);
$('#tvPlay').addEventListener('click', tvTogglePlay);
$('#tvCatch').addEventListener('click', tvTogglePlay);

$('#manageBtn').addEventListener('click', () => openManage('video'));
$('#manageClose').addEventListener('click', () => manage.close());
manage.addEventListener('click', (e) => { if (e.target === manage) manage.close(); });
$('#exportBtn').addEventListener('click', exportData);
$('#importFile').addEventListener('change', (e) => { importData(e.target.files[0]); e.target.value = ''; });
$('#clearHistory').addEventListener('click', () => {
  if (!confirm('열어 본 기록을 모두 지울까요?')) return;
  store.history = []; pruneSaved(); save(); render(); toast('열어 본 기록을 지웠습니다');
});
$('#clearAll').addEventListener('click', () => {
  if (!confirm('이 브라우저에 저장된 호성튜브 데이터(직접 추가한 영상, 나중에 볼 영상, 즐겨찾기, 기록)를 모두 지울까요?')) return;
  store = emptyStore(); save(); render(); toast('저장된 데이터를 모두 지웠습니다');
});

document.addEventListener('keydown', (e) => {
  if (tv.open) { tvKey(e); return; }
  if (manage.open) return;
  const typing = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if (e.key === 'Escape' && e.target.id === 'q' && state.q) { state.q = ''; e.target.value = ''; renderGrid(); return; }
  if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === '/') { e.preventDefault(); $('#q').focus(); }
  else if (e.key === 't' || e.key === 'T') { e.preventDefault(); tvOpen(state.watchId); }
  else if (e.key === 'Escape' && state.watchId) { location.hash = '#/'; }
});

window.addEventListener('hashchange', route);
window.addEventListener('storage', (e) => { if (e.key === STORE_KEY) { store = sanitizeStore(storage.read()); render(); } });
if (!storage.ok) showStorageNotice();

// 테스트에서 상태를 들여다볼 수 있게 읽기 전용으로 노출한다.
window.__hosungtube = { get state() { return { ...state, seed: state.seed.length, recs: state.recs.length, catalog: !!state.catalog }; }, get store() { return JSON.parse(JSON.stringify(store)); }, get tv() { return { open: tv.open, current: tvCurrent(), shuffle: tv.shuffle, queue: tv.queue.length, pos: tv.pos, trail: [...tv.trail] }; } };


let currentDay, daily, usedDaily = new Set();
function refreshDay() {
  if (!state.loaded) return;
  const day = localDay();
  if (day !== currentDay) { currentDay = day; usedDaily.clear(); daily = null; pickDaily(); if(state.loaded) renderGrid(); }
}
function pickDaily(advance=false) {
  const pool = rotation(state.recs,localDay()).filter(r=>!$('#exclude').checked || !store.history.some(h=>h.id===r.video.id));
  if (!daily || advance || !pool.some(r=>r.video.id===daily.video.id)) {
    if(pool.length && pool.every(r=>usedDaily.has(r.video.id))) usedDaily = new Set(daily?[daily.video.id]:[]);
    daily = pool.find(r=>!usedDaily.has(r.video.id)) || pool[0];
    if(daily) usedDaily.add(daily.video.id);
  }
  const link=$('#dailyLink'); link.hidden=!daily;
  if(daily){link.textContent=daily.video.title;link.href=`#/watch/${daily.video.id}`;}
  $('#dailyTitle').textContent=daily?'오늘의 추천':state.recs.length?'새 추천을 모두 확인했어요':'아직 공개된 추천이 없습니다';
  $('#another').disabled=pool.length<2; $('#showOpened').hidden=!!pool.length || !state.recs.length;
}
$('#another').onclick=()=>pickDaily(true);
$('#exclude').onchange=()=>{daily=null;usedDaily.clear();pickDaily();};
$('#showOpened').onclick=()=>{$('#exclude').checked=false;pickDaily();};
setInterval(refreshDay,30000);
window.addEventListener('pageshow',refreshDay);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});

loadSeed();


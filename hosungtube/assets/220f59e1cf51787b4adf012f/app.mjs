import { rotation, sanitize, validateRelease, localDay, koreanTime } from './core.mjs';
const release = new URL(import.meta.url).pathname.split('/').at(-2);
const $ = s => document.querySelector(s);
const node = (tag, text, parent) => { const n = document.createElement(tag); if (text != null) n.textContent = text; parent?.append(n); return n; };
const notice = text => { $('#notice').textContent = text; };
const key = 'hosungtube:public:v1';
let saved = sanitize({}), persistent = true, data, order = [], used = new Set(), daily, currentDay;
try { saved = sanitize(JSON.parse(localStorage.getItem(key) || localStorage.getItem('hosungtube:v1') || '{}')); localStorage.setItem(key, JSON.stringify(saved)); } catch { persistent = false; notice('저장 공간을 쓸 수 없어 기록은 이 창에서만 유지됩니다.'); }
function persist() { if (persistent) try { localStorage.setItem(key, JSON.stringify(saved)); } catch { persistent = false; notice('저장하지 못했습니다. 기록은 이 창에서만 유지됩니다.'); } }
function card(r, parent) {
  const box = node('article', null, parent); box.className = 'card';
  const media = node('div',null,box); media.className = 'thumbnail'; media.dataset.imageState = 'loading';
  const fallback = node('p','썸네일을 불러오는 중입니다.',media); fallback.className = 'image-fallback';
  const img = node('img',null,media); img.alt = ''; img.loading = 'lazy';
  const timer = setTimeout(() => { if (media.dataset.imageState === 'loading') { media.dataset.imageState = 'timeout'; fallback.textContent = '썸네일 응답이 늦어지고 있습니다. 제목을 눌러 영상을 열 수 있습니다.'; } },8000);
  img.onload = () => { clearTimeout(timer); media.dataset.imageState = 'loaded'; img.hidden = false; fallback.hidden = true; };
  img.onerror = () => { clearTimeout(timer); media.dataset.imageState = 'error'; img.hidden = true; fallback.hidden = false; fallback.textContent = '썸네일을 불러오지 못했습니다. 제목을 눌러 영상을 열 수 있습니다.'; };
  img.src = `https://i.ytimg.com/vi/${r.video.id}/mqdefault.jpg`;
  const b = node('button', r.video.title, node('h3', null, box)); b.onclick = () => { location.hash = `watch=${r.video.id}`; };
  node('p', r.video.channel, box); node('p', r.headline, box);
  return box;
}
function refreshDay() {
  if (!data) return;
  const day = localDay();
  if (day === currentDay) return;
  currentDay = day; order = rotation(data.recommendations,day); used.clear(); daily = null; pick();
}
function pick(advance = false) {
  const pool = order.filter(r => !$('#exclude').checked || !saved.history.some(h => h.id === r.video.id));
  if (!advance && daily && pool.includes(daily)) return drawDaily(pool);
  if (pool.length && pool.every(r => used.has(r.video.id))) used = new Set(daily ? [daily.video.id] : []);
  daily = pool.find(r => !used.has(r.video.id)) || pool[0]; if (daily) used.add(daily.video.id);
  drawDaily(pool);
}
function drawDaily(pool) {
  $('#daily').replaceChildren();
  if (daily) card(daily, $('#daily')); else node('p', data.recommendations.length ? '새 추천을 모두 확인했어요. 열어 본 추천을 다시 볼 수 있습니다.' : '아직 공개된 추천이 없습니다.', $('#daily'));
  $('#another').disabled = pool.length < 2; $('#showOpened').hidden = !!pool.length || !data.recommendations.length;
}
function render() {
  const q = $('#search').value.toLocaleLowerCase(), shelf = $('#shelf').value;
  const recs = data.recommendations.filter(r => (!$('#category').value || r.video.category === $('#category').value) && (!$('#channel').value || r.video.channel === $('#channel').value) && (shelf === 'all' || (shelf === 'favorites' ? saved.favorites.includes(r.video.id) : saved.history.some(h => h.id === r.video.id))) && JSON.stringify(r).toLocaleLowerCase().includes(q));
  $('#count').textContent = `${recs.length}개`; $('#grid').replaceChildren(); recs.forEach(r => card(r, $('#grid')));
  if (!recs.length) node('p', '조건에 맞는 추천이 없습니다.', $('#grid'));
}
function watch() {
  const match = /^#watch=([A-Za-z0-9_-]{11})$/.exec(location.hash);
  const r = match && data.recommendations.find(r => r.video.id === match[1]);
  const box = $('#watch'); box.replaceChildren(); box.hidden = !r; if (!r) return;
  saved.history = [{ id: r.video.id, at: new Date().toISOString() }, ...saved.history.filter(h => h.id !== r.video.id)].slice(0,300); persist();
  node('h2', r.video.title, box);
  const frame = node('iframe', null, box); frame.title = r.video.title; frame.src = `https://www.youtube-nocookie.com/embed/${r.video.id}`; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'encrypted-media; picture-in-picture; fullscreen'; frame.allowFullscreen = true;
  const a = node('a', 'YouTube에서 열기 (재생이 막힌 경우)', box); a.href = `https://www.youtube.com/watch?v=${r.video.id}`; a.target = '_blank'; a.rel = 'noopener noreferrer';
  const b = node('button', saved.favorites.includes(r.video.id) ? '즐겨찾기 해제' : '즐겨찾기', box); b.onclick = () => { saved.favorites = saved.favorites.includes(r.video.id) ? saved.favorites.filter(id => id !== r.video.id) : [...saved.favorites,r.video.id]; persist(); b.textContent = saved.favorites.includes(r.video.id) ? '즐겨찾기 해제' : '즐겨찾기'; render(); };
  node('h3', '왜 이 영상을 골랐나', box); node('p', r.reason, box);
  for (const article of r.articles) { node('h3', article.title, box); node('p', article.summary, box); node('p', article.relationNote, box); }
  node('h3', '확인한 것과 한계', box); [...r.evidence.inspected,...r.evidence.limits].forEach(t => node('p',t,box));
  node('p', r.review?.label || '편집 검토',box);
  pick(); render(); box.scrollIntoView();
}
$('#another').onclick = () => pick(true); $('#exclude').onchange = () => { daily = null; used.clear(); pick(); }; $('#showOpened').onclick = () => { $('#exclude').checked = false; pick(); };
for (const s of ['#search','#category','#channel','#shelf']) $(s).addEventListener('input', () => data && render());
$('#export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify({ schema:'hosungtube.public-backup/v1', data:saved })],{type:'application/json'})); const a = node('a'); a.href = url; a.download = 'hosungtube-public-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); };
$('#import').onchange = async e => { try { const f = e.target.files[0]; if (!f || f.size > 2000000) throw Error('2MB 이하의 백업 파일을 골라 주세요.'); const raw = JSON.parse(await f.text()); if (!['hosungtube.public-backup/v1','hosungtube.backup/v1'].includes(raw.schema)) throw Error('호성튜브 백업 파일이 아닙니다.'); const incoming = sanitize(raw.schema === 'hosungtube.backup/v1' ? raw : raw.data); saved = sanitize({ favorites:[...saved.favorites,...incoming.favorites], history:[...saved.history,...incoming.history] }); persist(); notice('즐겨찾기와 열어 본 기록을 합쳤습니다.'); render(); pick(); } catch(err) { notice(err.message); } finally { e.target.value = ''; } };
try {
  const res = await fetch(new URL('./catalog.json', import.meta.url), {cache:'no-cache'}); if (!res.ok) throw Error('추천 데이터를 불러오지 못했습니다.');
  const bytes = await res.arrayBuffer(); const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if (digest !== '52260fe98143106564cd2b72d60cd21a2abda75de5d8097824387c898fda7732') throw Error('배포 데이터 검증에 실패했습니다. 새로고침해 주세요.');
  data = validateRelease(JSON.parse(new TextDecoder().decode(bytes)),release);
  $('#dates').textContent = `데이터 생성: ${koreanTime(data.generatedAt)} / 근거 전체 확인: ${koreanTime(data.sourcesCheckedAt)}`;
  $('#release').textContent = `배포본 ${release} / 배포 시각은 호스팅 배포 기록에서 확인합니다.`;
  for (const channel of [...new Set(data.recommendations.map(r => r.video.channel))].sort()) { const o = node('option',channel,$('#channel')); o.value=channel; }
  render(); refreshDay(); watch(); window.addEventListener('hashchange',watch);
  setInterval(refreshDay,30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDay(); });
  window.addEventListener('pageshow',refreshDay);
} catch(err) { notice(err.message); $('#another').disabled=true; }

export const SCHEMA = 'hosungtube.static/v1';
export const ID = /^[A-Za-z0-9_-]{11}$/;
export function rotation(recs, day) {
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  return [...recs].sort((a, b) => hash(`${day}:${a.video.id}`) - hash(`${day}:${b.video.id}`) || a.video.id.localeCompare(b.video.id));
}
export function sanitize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('백업 형식이 올바르지 않습니다.');
  const ids = a => [...new Set((Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && ID.test(x)))].slice(0, 800);
  return { favorites: ids(raw.favorites), history: (Array.isArray(raw.history) ? raw.history : []).filter(h => h && typeof h.id === 'string' && ID.test(h.id) && typeof h.at === 'string' && Number.isFinite(Date.parse(h.at))).slice(0, 300).map(h => ({ id: h.id, at: h.at })) };
}
export function validDuration(value) {
  return value == null || (Number.isInteger(value) && value > 0 && value <= 604800);
}
export function validateRelease(data, release) {
  if (data?.schema !== SCHEMA || data.releaseId !== release || !Array.isArray(data.recommendations)) throw Error('배포 데이터가 맞지 않습니다. 페이지를 새로고침해 주세요.');
  const seen = new Set();
  for (const r of data.recommendations) {
    if (!r?.video || typeof r.video.id !== 'string' || !ID.test(r.video.id) || seen.has(r.video.id) || typeof r.video.title !== 'string' || !Array.isArray(r.articles)) throw Error('추천 데이터 형식 오류');
    if (!validDuration(r.video.durationSeconds)) throw Error('영상 길이 형식 오류');
    seen.add(r.video.id);
  }
  return data;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function koreanTime(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '확인 기록 없음';
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'long',timeStyle:'short'}).format(new Date(value)) + ' (한국 시간)';
}

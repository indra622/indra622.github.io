'use strict';
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const displayTime=value=>typeof value==='string' && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'long',timeStyle:'short'}).format(new Date(value))+' (한국 시간)' : '기록 없음';
  const episode = key => Number(/^aig-(\d+)$/.exec(key)?.[1]) || 0;
  function articles(recs, query = '') {
    const map = new Map();
    for (const r of recs) for (const a of r.articles) {
      if (!episode(a.articleKey)) continue;
      if (!map.has(a.articleKey)) map.set(a.articleKey, {key:a.articleKey, title:a.title, summary:a.summary, videos:[]});
      const item = map.get(a.articleKey);
      if (!item.videos.includes(r.video.id)) item.videos.push(r.video.id);
    }
    const terms = query.toLowerCase().normalize('NFC').trim().split(/\s+/);
    return [...map.values()].filter(a => terms.every(t => `${episode(a.key)}편 ${a.title} ${a.summary}`.toLowerCase().normalize('NFC').includes(t))).sort((a,b) => episode(a.key)-episode(b.key));
  }
  const courses = [
    {key:'llm', title:'LLM의 구조를 따라가기', steps:[
      {id:'aircAruvnKk',why:'뉴런과 층을 그림으로 살펴보는 설명부터 시작합니다.'},
      {id:'PaCmpygFfXo',why:'다음으로 작은 문자 모델의 학습·샘플링을 살펴봅니다.'},
      {id:'kCc8FmEb1nY',why:'작은 모델에서 GPT 구현 사례로 확장합니다. 이 경로만으로 강의의 모든 준비가 끝나지는 않습니다.'}]},
    {key:'agents',title:'에이전트의 구성과 실행',steps:[
      {id:'F8NKVhkZZWI',why:'모델과 외부 도구가 이루는 복합 시스템의 구성을 먼저 구분합니다.'},
      {id:'sal78ACtGTc',why:'작업 흐름을 강조하는 관점을 비교합니다. 구조의 우열을 입증하는 실험은 아닙니다.'},
      {id:'JsNbFnT0QCw',why:'장기 실행 패턴을 다룬 Google ADK 튜토리얼을 사례로 살펴봅니다.'}]},
    {key:'literacy',title:'AI와 협업하고 판단하기',steps:[
      {id:'W4Ua6XFfX9w',why:'위임·설명·분별·주의라는 판단의 틀을 먼저 살펴봅니다.'},
      {id:'cfqtFvWOfg0',why:'판단할 문제를 구체화해 환각의 유형과 완화 방법을 살펴봅니다.'},
      {id:'hJP5GqnTrNo',why:'교육용 AI의 기대와 데모를 사례로 읽습니다. 장기 학습 효과의 입증은 아닙니다.'}]}];
  const durations={"00a3AwY7YHE": 268, "1DcZGAAF1CA": 1926, "4ZwVP0-ylZU": 153, "4uzGDAoNOZc": 1356, "5WFbSPFbTPA": 3252, "5Wdgjw6IGDM": 1837, "5rPcEqnNU9g": 1355, "6JrEoWUVmc4": 1586, "6j2jvfPny1Q": 1884, "8ib4Qnh2HFE": 8926, "96jN2OCOfLs": 1789, "9WiBJRO84yY": 1087, "9dYcwOkpCE8": 1054, "A58cV17avpM": 846, "AFHQehD8y9w": 714, "A_6UOxQSvvY": 838, "BZaWD9QPCME": 66, "D4XTefP3Lsc": 293, "F1_0Lkp16Rc": 106, "Fb-68zqcSVs": 99, "FdW4qld9E4M": 340, "HIJVMVBM4KM": 870, "JQqXaCjW6Rw": 191, "JsNbFnT0QCw": 332, "K9KrW-J2Fx0": 3130, "Kaaq7_9vzYs": 1156, "MC6s4TLwX0A": 137, "TC-Q2ulTPhw": 1684, "UZyH0nx5zgI": 2665, "UsMDkEsR-ok": 2456, "W4Ua6XFfX9w": 320, "WIs3IRCJhEo": 105, "X7mrqbwZ7iA": 53, "XT7soOM_YuM": 955, "YqLgJTdH8NE": 1939, "ZP-Oyd42z5I": 140, "ZR5vCxJxmdQ": 121, "ZYpz_nRNLoU": 765, "Zk3ipzTMe1g": 1891, "aDukCWkPbeQ": 600, "b1Kw-e9cspI": 121, "eW3oTyfeWZ0": 210, "ftkic7Tdpcg": 128, "fv_MPosiINw": 456, "gPj_cQL_wvg": 69, "hm2IJSKcYvo": 2544, "hwq_1rRSNPM": 300, "jgFduVaa07M": 1343, "jt77tNu1OAo": 813, "lQsvTrRTBRs": 216, "lr3hNhA0IfQ": 3140, "nuQ5Qt3D1gU": 58, "o-rE93-nLpY": 4745, "p8h-28NR4Yk": 756, "px7XlbYgk7I": 3181, "s_o0myJzh30": 1043, "shRR1e2HXMk": 1254, "tbt3QOWgvSE": 601, "uWjOLafnMbo": 253, "veA3bpAWJQA": 1047, "wcAcJlYeWQw": 1237, "yQEKMsCtsmE": 592, "yUmDRxV0krg": 4117, "yoD6LUiTuH8": 108};
  function applyMetadata(recs){for(const r of recs){const value=durations[r.video.id];if(r.video.durationSeconds==null && Number.isInteger(value) && value>0 && value<=604800)r.video.durationSeconds=value;}return recs;}
  const topics=[{key:'llm',label:'LLM 원리',ids:['aircAruvnKk','PaCmpygFfXo','kCc8FmEb1nY','IHZwWFHWa-w','Ilg3gGewQ5U','GT6lxw70K28']},
    {key:'agents',label:'에이전트 만들기',ids:['F8NKVhkZZWI','sal78ACtGTc','JsNbFnT0QCw','aDukCWkPbeQ','9dYcwOkpCE8','HIJVMVBM4KM']},
    {key:'literacy',label:'AI 활용과 판단',ids:['W4Ua6XFfX9w','cfqtFvWOfg0','hJP5GqnTrNo','EWvNQjAaOHw','WRkig3VeRLY','nVImVgKpoOY']}];
  const interestKey='hosungtube:interests:v1';
  const cleanInterests=raw=>Array.isArray(raw)?topics.map(t=>t.key).filter(k=>raw.includes(k)):[];
  let interests=[], interestSessionOnly=false;
  try{interests=cleanInterests(JSON.parse(localStorage.getItem(interestKey)||'[]'));}catch{}
  function rank(recs, chosen, opened, day) {
    const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
    const active=topics.filter(t=>chosen.includes(t.key));
    const score=r=>active.filter(t=>t.ids.includes(r.video.id)).length;
    return [...recs].sort((a,b)=>(active.length?(Number(opened.has(a.video.id))-Number(opened.has(b.video.id)) || score(b)-score(a)):0) || hash(`${day}:${a.video.id}`)-hash(`${day}:${b.video.id}`) || a.video.id.localeCompare(b.video.id));
  }
  const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  let courseKey='llm', step=0;
  function coursePanel() {
    const c=courses.find(c=>c.key===courseKey), available=c.steps.filter(s=>api.recs().some(r=>r.video.id===s.id));
    step=Math.min(step,Math.max(0,available.length-1));
    const current=available[step];
    return `<h2 tabindex="-1">편집 제안 학습 경로</h2><p>공개 추천을 바탕으로 편집한 제안입니다. 저자의 공식 교육과정은 아닙니다.</p><details><summary>편집 근거와 한계</summary><p>Codex가 공개된 추천 설명과 글·영상의 관계로 순서를 구성했습니다. 영상 전체 시청 검증이나 수료 기록이 아닙니다.</p></details><p></p><nav class="row">${courses.map(c=>`<button class="btn" data-course="${c.key}" aria-pressed="${c.key===courseKey}">${esc(c.title)}</button>`).join('')}</nav><h3>${esc(c.title)}</h3><ol>${available.map((s,i)=>`<li><button class="btn btn-ghost" data-step="${i}" aria-current="${i===step?'step':'false'}">${esc(api.recs().find(r=>r.video.id===s.id).video.title)}</button><p>${esc(s.why)}</p></li>`).join('')}</ol>${current?`<p>${step+1} / ${available.length} 단계 · 열기와 시청 완료는 다릅니다.</p><div class="grid">${api.card(current.id)}</div><nav class="row"><button class="btn" data-step="${step-1}" ${step===0?'disabled':''}>이전 단계</button><button class="btn" data-step="${step+1}" ${step===available.length-1?'disabled':''}>다음 단계</button></nav>`:'<p>현재 공개 목록에 연결된 단계가 없습니다.</p>'}`;
  }
  let mode = 'videos', selected = null, query = '', api;
  function render() {
    if (!api) return;
    let host = document.querySelector('#learning');
    if (!host) {
      host = document.createElement('section'); host.id = 'learning'; host.className = 'learning';
      document.querySelector('#grid').before(host);
      host.addEventListener('click', e => {
        const b=e.target.closest('[data-learn-mode]');
        if(b){mode=b.dataset.learnMode;selected=null;render();return;}
        if(e.target.closest('[data-interest-clear]')){interests=[];try{localStorage.removeItem(interestKey);interestSessionOnly=false;}catch{interestSessionOnly=true;}api.refresh();return;}
        const c=e.target.closest('[data-course]');if(c){courseKey=c.dataset.course;step=0;renderPanel();return;}
        const st=e.target.closest('[data-step]');if(st){step=Number(st.dataset.step);renderPanel();return;}
        const a=e.target.closest('[data-article]');
        if(a){selected=a.dataset.article || null;render();host.querySelector('h2')?.focus();}
      });
      host.addEventListener('change',e=>{if(e.target.matches('[data-interest]')){
        const chosen=[...host.querySelectorAll('[data-interest]:checked')].map(x=>x.dataset.interest);
        interests=cleanInterests(chosen);try{localStorage.setItem(interestKey,JSON.stringify(interests));interestSessionOnly=false;}catch{interestSessionOnly=true;}
        api.refresh();
      }});
      host.addEventListener('input', e => {if(e.target.id==='articleQuery'){query=e.target.value;renderPanel();}});
    }
    const expanded=host.querySelector('details')?.open;
    const focused=document.activeElement?.dataset.interest;
    host.innerHTML = `<nav class="row" aria-label="탐색 방법"><button class="btn btn-ghost" data-learn-mode="videos" aria-pressed="${mode==='videos'}">영상 전체 검색</button><button class="btn btn-ghost" data-learn-mode="articles" aria-pressed="${mode==='articles'}">영상이 연결된 AI교양</button><button class="btn btn-ghost" data-learn-mode="new" aria-pressed="${mode==='new'}">새로 추가된 영상</button><button class="btn btn-ghost" data-learn-mode="courses" aria-pressed="${mode==='courses'}">학습 경로</button></nav><p class="meta">데이터 업데이트: ${esc(displayTime(api.catalog()?.generatedAt))} · 글 근거 확인: ${esc(displayTime(api.catalog()?.sourcesCheckedAt))}</p><details><summary>관심사 선택 · ${interests.length?'관심사 순서':'오늘의 순서'}</summary><p>직접 고른 주제를 연결해 둔 일부 영상부터 우선 정렬합니다. 관심사가 있으면 열어 본 영상은 뒤로 보냅니다. 이 브라우저에만 저장하며 AI 성향 분석은 하지 않습니다.</p><div class="row">${topics.map(t=>`<label><input type="checkbox" data-interest="${t.key}" ${interests.includes(t.key)?'checked':''}> ${esc(t.label)}</label>`).join('')}<button class="btn btn-ghost" data-interest-clear>선택 지우기</button></div><p id="interestNotice" role="status">${interestSessionOnly?'관심사 변경은 이 창에서만 유지됩니다.':''}</p></details><div id="learningPanel"></div>`;
    host.querySelector('details').open=!!expanded;
    if(focused)host.querySelector(`[data-interest="${focused}"]`)?.focus();
    document.querySelector('#grid').hidden = mode !== 'videos';
    renderPanel();
    globalThis.Connections?.update(api,interests);
  }
  function renderPanel() {
    const panel=document.querySelector('#learningPanel');
    if(mode==='videos'){panel.innerHTML='';return;}
    if(mode==='new'){
      const d=globalThis.Discovery;const ids=d?.ids.filter(id=>api.recs().some(r=>r.video.id===id))||[];
      panel.innerHTML=`<h2>새로 추가된 영상 · ${ids.length}개</h2><p>최근 추천 추가 배치 · ${ids.length}개 / 영상 업로드일과 다릅니다.</p><details><summary>추가 기준/검증 정보</summary><p>${esc(d?.batchLabel)}의 공개 목록 차이입니다. 최초 배포 시각: 기록 없음. 화면 변경으로 추가 기준을 바꾸지 않습니다.</p><p>비교한 공개 스냅샷: ${esc(d?.beforeRelease)} / ${esc(d?.afterRelease)}</p></details><div class="grid">${ids.map(id=>api.card(id)).join('')}</div>${ids.length?'':'<p>현재 공개 목록에 해당 배치 영상이 없습니다.</p>'}`;return;
    }
    if(mode==='courses'){panel.innerHTML=coursePanel();return;}
    const all=articles(api.recs());
    const item=all.find(a=>a.key===selected);
    if(item){panel.innerHTML=`<button class="btn" data-article="">글 목록으로 돌아가기</button><h2 tabindex="-1">${esc(item.title)}</h2><p>${esc(item.summary)}</p><p>공개된 제목·요약과 연결 영상만 표시합니다.</p><div class="grid">${item.videos.map(id=>api.card(id)).join('')}</div>`;return;}
    const list=articles(api.recs(),query);
    // Keep the input node while filtering so keyboard focus and the caret survive.
    if(!panel.querySelector('#articleQuery')) panel.innerHTML=`<h2 tabindex="-1">영상이 연결된 AI교양 · ${all.length}편</h2><p>전체 연재 목록이 아닌, 공개 추천 영상이 연결된 글입니다.</p><label>편 번호·제목·요약 검색 <input id="articleQuery" type="search" value="${esc(query)}"></label><div id="articleResults"></div>`;
    panel.querySelector('#articleResults').innerHTML=list.length?list.map(a=>`<p><button class="btn btn-ghost" data-article="${esc(a.key)}">${episode(a.key)}편 · ${esc(a.title)} (${a.videos.length}개 영상)</button></p>`).join(''):'<p>조건에 맞는 글이 없습니다.</p>';
  }
  globalThis.Learning = {displayTime,applyMetadata,articles,esc,courses,topics,rank,cleanInterests, ordered(recs,opened){return rank(recs,interests,opened,day());}, update(value){api=value;render();}};
})();

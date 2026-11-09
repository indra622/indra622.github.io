'use strict';
(() => {
  const KEY='hosungtube:connections:v1', SCHEMA='hosungtube.connection-events/v1';
  const MAX=200, AGE=90*86400000;
  const exact=(o,keys)=>o && Object.keys(o).sort().join(',')===[...keys].sort().join(',');
  const text=s=>typeof s==='string' && s.length>0 && s.length<=500 && !/[\u0000-\u001f<>]/.test(s);
  function validate(m) {
    if(!exact(m,['schema','items']) || m.schema!=='hosungtube.connections/v1' || !Array.isArray(m.items))throw Error('Invalid connection manifest');
    const seen=new Set();
    for(const p of m.items){
      if(!exact(p,['id','version','videoIds','rationale','question','tags','provenance','reviewDate','evidence']) || !/^[a-z][a-z0-9-]{0,63}$/.test(p.id) || !Number.isSafeInteger(p.version) || p.version<1 || seen.has(`${p.id}@${p.version}`))throw Error('Invalid connection identity');
      seen.add(`${p.id}@${p.version}`);
      if(!Array.isArray(p.videoIds)||p.videoIds.length!==2||new Set(p.videoIds).size!==2||!p.videoIds.every(id=>/^[A-Za-z0-9_-]{11}$/.test(id)))throw Error('Invalid connection videos');
      if(![p.question,p.rationale,p.provenance].every(text)||!/^\d{4}-\d{2}-\d{2}$/.test(p.reviewDate)||!Number.isFinite(Date.parse(p.reviewDate))||!Array.isArray(p.tags)||!p.tags.length||new Set(p.tags).size!==p.tags.length||!p.tags.every(t=>['llm','agents','literacy'].includes(t)))throw Error('Invalid connection prose');
      if(!Array.isArray(p.evidence)||p.evidence.length!==2||!p.evidence.every((e,i)=>exact(e,['videoId','articleKeys','fields'])&&e.videoId===p.videoIds[i]&&Array.isArray(e.articleKeys)&&e.articleKeys.length>0&&e.articleKeys.every(k=>/^aig-[1-9]\d*$/.test(k))&&Array.isArray(e.fields)&&e.fields.join(',')==='reason,relationNote'))throw Error('Invalid connection evidence');
    }
    return m;
  }
  const manifest=validate(globalThis.ConnectionManifest);
  const freeze=o=>{Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);};
  freeze(manifest);
  const identity=p=>`${p.id}@${p.version}`;
  function clean(raw, now=Date.now(), items=manifest.items) {
    if(!exact(raw,['schema','events'])||raw.schema!==SCHEMA||!Array.isArray(raw.events))return [];
    return raw.events.filter(e=>{
      const p=items.find(p=>p.id===e?.id&&p.version===e.version);
      return p && exact(e,e.event==='click'?['id','version','event','time','videoId']:['id','version','event','time']) && ['shown','click'].includes(e.event) && typeof e.time==='string' && Number.isFinite(Date.parse(e.time)) && Date.parse(e.time)<=now && Date.parse(e.time)>=now-AGE && (e.event!=='click'||p.videoIds.includes(e.videoId));
    }).slice(-MAX).map(e=>({...e}));
  }
  function choose(items,recs,interests,events,current=null) {
    const ids=new Set(recs.map(r=>r.video.id));
    const eligible=items.filter(p=>!items.some(q=>q.id===p.id&&q.version>p.version)&&p.videoIds.every(id=>ids.has(id)));
    const pool=eligible.length>1?eligible.filter(p=>identity(p)!==current):eligible;
    const last=p=>events.reduce((v,e,i)=>e.event==='shown'&&identity(e)===identity(p)?i:v,-1);
    return [...pool].sort((a,b)=>last(a)-last(b)||Number(b.tags.some(t=>interests.includes(t)))-Number(a.tags.some(t=>interests.includes(t)))||a.id.localeCompare(b.id))[0]||null;
  }
  function createLog(storage,now=()=>Date.now()) {
    let events=[],sessionOnly=false;
    let raw=null;
    try{raw=storage().getItem(KEY);events=clean(JSON.parse(raw||'null'),now());}catch{sessionOnly=true;}
    const save=()=>{try{storage().setItem(KEY,JSON.stringify({schema:SCHEMA,events}));sessionOnly=false;}catch{sessionOnly=true;}};
    if(raw!==null && raw!==JSON.stringify({schema:SCHEMA,events}))save();
    return {get events(){const pruned=clean({schema:SCHEMA,events},now());if(JSON.stringify(pruned)!==JSON.stringify(events)){events=pruned;save();}return events;},get sessionOnly(){return sessionOnly;},
      add(p,event,videoId){const entry={id:p.id,version:p.version,event,time:new Date(now()).toISOString(),...(event==='click'?{videoId}:{})};events=clean({schema:SCHEMA,events:[...events,entry]},now());save();},
      clear(){events=[];try{storage().removeItem(KEY);sessionOnly=false;}catch{sessionOnly=true;}}};
  }
  const log=createLog(()=>localStorage);
  let host,api,interests=[],current=null,revealed=false;
  const esc=s=>Learning.esc(s);
  function history() {
    const node=host.querySelector('[data-connection-history]');
    node.innerHTML=log.events.length?`<ol>${[...log.events].reverse().map(e=>`<li>${esc(e.id)} · v${e.version} · ${e.event==='shown'?'표시 요청':'영상 링크 클릭'}${e.videoId?' · '+esc(e.videoId):''} · ${esc(Learning.displayTime(e.time))}</li>`).join('')}</ol>`:'<p>기록이 없습니다.</p>';
    host.querySelector('[data-connection-notice]').textContent=log.sessionOnly?'저장소를 사용할 수 없어 변경은 이 창에서만 유지됩니다.':'';
  }
  function render() {
    const historyOpen=host.querySelector(':scope > details')?.open || false;
    host.innerHTML=`<h2>생각의 연결</h2><p>미리 편집한 영상 두 편과 질문입니다.</p><div data-connection-body></div><details><summary>이 브라우저의 제안 기록</summary><p>직접 펼친 연결과 영상 링크 클릭만 최대 200건, 90일 동안 이 브라우저에 보관합니다. 표시 요청은 읽음·이해·시청 완료를 뜻하지 않습니다. 서버 전송과 AI 분석은 없으며 백업 파일에는 포함되지 않습니다.</p><div data-connection-history></div><button type="button" class="btn" data-connection-clear>제안 기록 지우기</button></details><p role="status" data-connection-notice></p>`;
    const body=host.querySelector('[data-connection-body]');
    body.innerHTML=!current?'<p>현재 공개 영상으로 구성할 수 있는 연결이 없습니다.</p>':!revealed?`<p class="connection-teaser">${esc(current.question)}</p><p>두 영상의 관점을 함께 살펴보세요.</p><button type="button" class="btn btn-accent" data-connection-reveal>연결 펼쳐 보기</button>`:`<h3>${esc(current.question)}</h3><p>${esc(current.rationale)}</p><div class="connection-pair" aria-label="함께 살펴볼 두 영상">${current.videoIds.map(id=>{const r=api.recs().find(r=>r.video.id===id);return `<article class="connection-video"><a href="#/watch/${id}" data-connection-video="${id}"><span class="connection-thumb"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="eager"><span class="connection-fallback">영상 열기</span></span><h4>${esc(r.video.title)}</h4></a><p>${esc(r.video.channel)}</p></article>`;}).join('')}</div><p><button type="button" class="btn" data-connection-next>다른 연결 보기</button></p><details><summary>편집 근거</summary><p>${esc(current.provenance)}</p><p>${esc(current.id)} · v${current.version} · 검토일 ${esc(current.reviewDate)}</p><p>${current.evidence.map(e=>`${esc(e.videoId)}: ${e.articleKeys.map(esc).join(', ')} · 공개 추천 이유·연결 근거`).join('<br>')}</p></details>`;
    host.querySelector(':scope > details').open=historyOpen;
    host.querySelectorAll('.connection-thumb img').forEach(img=>{img.addEventListener('error',()=>{img.hidden=true;});img.addEventListener('load',()=>{if(img.naturalWidth<=120)img.hidden=true;else img.nextElementSibling.hidden=true;});});
    history();
  }
  function update(value,chosen) {
    api=value;const changed=interests.join(',')!==chosen.join(',');interests=[...chosen];
    if(!host){host=document.createElement('section');host.id='connections';host.className='learning';document.querySelector('#learning').after(host);
      host.addEventListener('click',e=>{
        const video=e.target.closest('[data-connection-video]');
        if(video && current && current.videoIds.includes(video.dataset.connectionVideo)){log.add(current,'click',video.dataset.connectionVideo);history();return;}
        if(e.target.closest('[data-connection-clear]')){log.clear();current=choose(manifest.items,api.recs(),interests,[]);revealed=false;render();host.querySelector('[data-connection-clear]').focus();return;}
        if(!e.target.closest('[data-connection-reveal],[data-connection-next]')||document.visibilityState!=='visible'||!host.isConnected)return;
        const next=choose(manifest.items,api.recs(),interests,log.events,revealed&&current?identity(current):null);
        if(!next)return;
        const different=!revealed||!current||identity(next)!==identity(current);
        current=next;revealed=true;render();
        if(different){log.add(current,'shown');history();}
        host.querySelector('h3')?.setAttribute('tabindex','-1');host.querySelector('h3')?.focus();
      });
    }
    const available=current&&current.videoIds.every(id=>api.recs().some(r=>r.video.id===id));
    if(!available||changed){current=choose(manifest.items,api.recs(),interests,log.events);revealed=false;render();}
    else if(!host.children.length)render();
  }
  globalThis.Connections={validate,choose,clean,createLog,identity,manifest,KEY,SCHEMA,update};
})();

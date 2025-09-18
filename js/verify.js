(function(){
  'use strict';
  const root = ()=> document.getElementById('verify-root');
  const esc = s => String(s||'').replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));

  async function fetchPlayers(){
    if(window.dbGet){
      try{
        const snap = await window.dbGet('players');
        if(snap && snap.exists()){
          const val = snap.val();
          return Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []);
        }
      }catch{}
    }
    return [];
  }

  function getQuery(name){
    const url = new URL(location.href);
    return url.searchParams.get(name) || '';
  }

  function buildDisplayId(player){
    const clubFirst = (String((player && player.club) || '').trim().charAt(0).toUpperCase()) || 'X';
    const nameFirst = (String((player && player.name) || '').trim().charAt(0).toUpperCase()) || 'X';
    const digits = String(player && player.id || '').replace(/\D/g,'').padStart(4,'0');
    return clubFirst + nameFirst + digits;
  }

  function renderNotFound(){
    const el = root(); if(!el) return;
    el.innerHTML = `
      <div class="err">لم يتم العثور على اللاعب المطلوب. تحقق من الرابط أو رقم الرخصة.</div>`;
  }

  function renderPlayer(p){
    const el = root(); if(!el) return;
    const idDisp = buildDisplayId(p);
    const avatar = p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : '👤';
    el.innerHTML = `
      <div class="verify-card">
        <div class="row">
          <div class="avatar">${avatar}</div>
          <div class="meta">
            <div><strong>${esc(p.name||'')}</strong></div>
            <div class="muted">${esc(p.club||'')} • ${esc(p.category||'')} • ${esc(p.position||'')}</div>
          </div>
        </div>
        <div class="kv">
          <div>رقم الرخصة</div><div>${esc(idDisp)}</div>
          <div>النادي</div><div>${esc(p.club||'')}</div>
          <div>الفئة</div><div>${esc(p.category||'')}</div>
          <div>تاريخ الميلاد</div><div>${esc(p.birth||'')}</div>
        </div>
      </div>`;
  }

  async function init(){
    const id = getQuery('id').trim();
    if(!id){ renderNotFound(); return; }
    const list = await fetchPlayers();
    // ابحث بالـ id الأصلي وليس المعروض
    const player = (list||[]).find(p => String(p && p.id) === id);
    if(!player){ renderNotFound(); return; }
    renderPlayer(player);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
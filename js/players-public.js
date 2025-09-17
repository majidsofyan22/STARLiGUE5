(function(){
  'use strict';
  const qs = (s, r=document)=> r.querySelector(s);


  function escapeHtml(str){
    return String(str||'').replace(/[&<>"]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[s]));
  }

  async function load(){
    if(window.dbGet){
      try{ const snap = await window.dbGet('players'); return snap.exists()? (snap.val()||[]) : []; }
      catch{ /* ignore */ }
    }
    return [];
  }

  async function render(){
    const grid = qs('#players-grid');
    if(!grid) return;
    const list = await load();
    grid.innerHTML = '';
    (list||[]).forEach(p=>{
      const div = document.createElement('div');
      div.className = 'player-card';
      const avatar = p.photo ? `<img src="${p.photo}" alt="${escapeHtml(p.name)}">` : '👤';
      const pwd = p.password ? `<span class="pwd">${escapeHtml(p.password)}</span>` : '<span class="muted">غير متاحة</span>';
      div.innerHTML = `
        <div class="head">
          <div class="avatar">${avatar}</div>
          <div class="meta">
            <div class="name">${escapeHtml(p.name)}</div>
            <div class="sub">${escapeHtml(p.club)} • ${escapeHtml(p.category)} • ${escapeHtml(p.position)}</div>
          </div>
        </div>
        <div class="foot" style="display:block;">
          <div class="pwd-row">
            <span class="muted">كلمة السر</span>
            <span class="pwd-badge">${pwd}</span>
          </div>
        </div>`;
      grid.appendChild(div);
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{ render(); });
})();
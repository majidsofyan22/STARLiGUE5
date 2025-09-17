(function(){
  'use strict';
  const qs = (s, r=document)=> r.querySelector(s);
  const hasFirebase = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  // ---- DB state (Firebase-only) ----
  const db = {
    teams: [],
    matches: [],
    site: { nameAr:'بطولة ستارليغ', nameFr:'CHAMPIONNAT STARLiGUE', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' }
  };

  async function loadData(){
    if(!hasFirebase){ return; }
    try{
      const [teamsSnap, matchesSnap, siteSnap] = await Promise.all([
        window.dbGet('teams'),
        window.dbGet('matches'),
        window.dbGet('site')
      ]);
      // Normalize teams snapshot to an array (handles array or object in RTDB)
      let teamsArr = [];
      if(teamsSnap.exists()){
        const raw = teamsSnap.val();
        if(Array.isArray(raw)){
          teamsArr = raw;
        } else {
          try {
            teamsSnap.forEach(child => {
              const d = child.val() || {};
              teamsArr.push({ id: d.id || child.key, name: d.name||'', city: d.city||'', logo: d.logo||'', pass: d.pass||'', group: d.group||d.grp||'' });
            });
          } catch {
            teamsArr = Object.values(raw || {});
          }
        }
      }
      db.teams = teamsArr;
      db.matches = matchesSnap.exists() ? matchesSnap.val() : [];
      db.site = siteSnap.exists() ? siteSnap.val() : db.site;

      // Live updates
      if(window.dbOnValue){
        window.dbOnValue('teams', (snap)=>{ if(snap.exists()){ 
          // normalize live updates as well
          let teamsArr = [];
          const raw = snap.val();
          if(Array.isArray(raw)) teamsArr = raw; 
          else {
            try{ snap.forEach(child=>{ const d=child.val()||{}; teamsArr.push({ id: d.id || child.key, name: d.name||'', city: d.city||'', logo: d.logo||'', pass: d.pass||'', group: d.group||d.grp||'' }); }); }
            catch{ teamsArr = Object.values(raw||{}); }
          }
          db.teams = teamsArr; renderResults(); 
        } });
        window.dbOnValue('matches', (snap)=>{ if(snap.exists()){ db.matches = snap.val(); renderResults(); } });
        window.dbOnValue('site', (snap)=>{ if(snap.exists()){ db.site = snap.val(); applySiteBrand(); } });
      }
    }catch(err){
      console.warn('Firebase load failed', err);
    }
  }

  function isPlayed(m){ return Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals); }

  function renderResults(){
    const tbody = qs('#results-body'); if(!tbody) return; tbody.innerHTML = '';
    const teamById = Object.fromEntries(db.teams.map(t=> [String(t.id), t]));
    const played = db.matches.filter(isPlayed);
    const sorted = [...played].sort((a,b)=> (a.date||'').localeCompare(b.date) || (a.time||'').localeCompare(b.time));
    sorted.forEach(m => {
      const tr = document.createElement('tr');
      const res = `${m.homeGoals} - ${m.awayGoals}`;
      tr.innerHTML = `
        <td>${m.date||''}</td>
        <td>${m.time||''}</td>
        <td>${teamById[String(m.homeId)]?.name || '—'}</td>
        <td>${teamById[String(m.awayId)]?.name || '—'}</td>
        <td>${res}</td>
        <td>${m.venue||''}</td>`;
      tbody.appendChild(tr);
    });
  }

  function applySiteBrand(){
    const site = db.site;
    const logoImg = qs('.brand-logo');
    const nameAr = qs('.brand-title .ar');
    const nameFr = qs('.brand-title .fr');
    if(logoImg && site.logo){ logoImg.src = site.logo; }
    if(nameAr && site.nameAr){ nameAr.textContent = site.nameAr; }
    if(nameFr && site.nameFr){ nameFr.textContent = site.nameFr; }
  }

  async function init(){
    await loadData();
    renderResults();
    applySiteBrand();
    const y=qs('#year'); if(y) y.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
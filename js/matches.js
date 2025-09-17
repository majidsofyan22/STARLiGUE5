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
          db.teams = teamsArr; renderFixtures(); 
        } });
        window.dbOnValue('matches', (snap)=>{ if(snap.exists()){ db.matches = snap.val(); renderFixtures(); } });
        window.dbOnValue('site', (snap)=>{ if(snap.exists()){ db.site = snap.val(); applySiteBrand(); } });
      }
    }catch(err){
      console.warn('Firebase load failed', err);
    }
  }

  function isPlayed(m){ return Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals); }

  function formatDateAr(d){
    if(!d) return '';
    try{
      const dt = new Date(`${d}T00:00:00`);
      return new Intl.DateTimeFormat('ar-MA',{weekday:'long', day:'2-digit', month:'long', year:'numeric'}).format(dt);
    }catch{return d}
  }

  function teamFlag(team){
    // expects optional team.flag or team.logo; fallback initials
    if(team?.flag){ return `<img src="${team.flag}" alt="${team.name||''}" loading="lazy" referrerpolicy="no-referrer">`; }
    if(team?.logo){ return `<img src="${team.logo}" alt="${team.name||''}" loading="lazy" referrerpolicy="no-referrer">`; }
    const name = team?.name||''; const ph = name? name.trim()[0]||'?' : '?';
    return `<span class="ph">${ph}</span>`;
  }

  function renderFixtures(){
    const grid = qs('#fixtures-grid'); if(!grid) return; grid.innerHTML = '';
    const teamById = Object.fromEntries(db.teams.map(t=> [String(t.id), t]));
    const matches = db.matches;

    // UI: active category from cards
    const activeCatBtn = document.querySelector('.cat-card.active');
    const filterCat = (activeCatBtn?.getAttribute('data-cat') || '').toUpperCase();

    // UI: active group from chips (data-grp="") means all
    const grpWrapEl = document.getElementById('grp-cards');
    const activeGrpBtn = grpWrapEl?.querySelector('.grp-card.active');
    const selectedGroup = activeGrpBtn ? activeGrpBtn.getAttribute('data-grp') : '';

    // UI: active round from left selector (data-round="") means all
    const roundWrapEl = document.getElementById('round-cards');
    const activeRoundBtn = roundWrapEl?.querySelector('.round-card.active');
    const selectedRoundRaw = activeRoundBtn ? activeRoundBtn.getAttribute('data-round') : '';
    const selectedRound = selectedRoundRaw !== '' ? Number(selectedRoundRaw) : null;

    // Category order + normalizer
    const catOrder = { U09: 1, U11: 2, U13: 3, U15: 4 };
    const normCat = (m)=>{
      const c = String(m.category || m.cat || '').toUpperCase();
      return (catOrder[c] ? c : '');
    };

    // Round number normalizer (expects m.round or m.r)
    const roundNum = (m)=>{
      const r = Number(m.round ?? m.r);
      return Number.isFinite(r) ? r : 0;
    };

    // Team group helper: expect team.group or team.grp (e.g., "A","B","C")
    const teamGroup = (t)=> String(t?.group ?? t?.grp ?? '').toUpperCase();

    // Step 1: filter by category
    let list = matches.filter(m => !filterCat || normCat(m) === filterCat);

    // Step 2: build dynamic group chips from teams involved in 'list'
    if(grpWrapEl){
      const groupsSet = new Set();
      list.forEach(m => { groupsSet.add(teamGroup(teamById[String(m.homeId)])); groupsSet.add(teamGroup(teamById[String(m.awayId)])); });
      groupsSet.delete('');
      const groups = Array.from(groupsSet).sort();
      const prevSel = selectedGroup || '';
      let html = `<button class="grp-card${prevSel===''? ' active':''}" data-grp="">كل المجموعات</button>`;
      html += groups.map(g=> `<button class="grp-card${prevSel===g? ' active':''}" data-grp="${g}">المجموعة ${g}</button>`).join('');
      grpWrapEl.innerHTML = html;
      // Re-read selected after rebuild
      const newActiveG = grpWrapEl.querySelector('.grp-card.active');
      const newGrp = newActiveG ? newActiveG.getAttribute('data-grp') : '';
      // Apply group filter
      if(newGrp){
        list = list.filter(m => {
          const gh = teamGroup(teamById[String(m.homeId)]);
          const ga = teamGroup(teamById[String(m.awayId)]);
          return gh===newGrp || ga===newGrp;
        });
      }
    }

    // Step 3: build round buttons based on available rounds for current filters
    if(roundWrapEl){
      const roundsSet = new Set(list.map(roundNum));
      const rounds = Array.from(roundsSet).sort((a,b)=> a-b);
      // Rebuild buttons
      const prevSel = Number.isFinite(selectedRound) ? selectedRound : null;
      let html = `<button class=\"round-card${prevSel===null? ' active':''}\" data-round=\"\">الكل</button>`;
      html += rounds.map(r=> `
        <button class=\"round-card${prevSel===r? ' active':''}\" data-round=\"${r}\">الجولة ${r}</button>
      `).join('');
      roundWrapEl.innerHTML = html;
      // If previous selection is no longer available, ensure 'all' is active
      if(prevSel!==null && !rounds.includes(prevSel)){
        const first = roundWrapEl.querySelector('.round-card[data-round=""]');
        if(first){
          Array.from(roundWrapEl.querySelectorAll('.round-card')).forEach(b=> b.classList.remove('active'));
          first.classList.add('active');
        }
      }
      // Refresh selectedRound after rebuild
      const newActive = roundWrapEl.querySelector('.round-card.active');
      const newVal = newActive ? newActive.getAttribute('data-round') : '';
      // Apply round filter
      if(newVal!==''){
        const sr = Number(newVal);
        if(Number.isFinite(sr)) list = list.filter(m=> roundNum(m)===sr);
      }
    }

    // Group by round and render
    const byRound = list.reduce((acc,m)=>{
      const r = roundNum(m);
      (acc[r] ||= []).push(m);
      return acc;
    },{});

    const roundsToRender = Object.keys(byRound).map(n=> Number(n)).sort((a,b)=> a-b);

    roundsToRender.forEach(r=>{
      // Round title
      const title = document.createElement('div');
      title.className = 'round-title';
      title.textContent = r ? `الجولة ${r}` : 'بدون جولة';
      grid.appendChild(title);

      const roundWrap = document.createElement('div');
      roundWrap.className = 'fixtures-grid';

      const ms = byRound[r].sort((a,b)=> (a.date||'').localeCompare(b.date) || (a.time||'').localeCompare(b.time));
      ms.forEach(m => {
        const home = teamById[String(m.homeId)] || {name:'—'};
        const away = teamById[String(m.awayId)] || {name:'—'};
        const cat = normCat(m);
        const card = document.createElement('div');
        // add category-based class for colors
        card.className = `fixture-card ${cat? 'cat-' + cat : ''}`;
        card.innerHTML = `
          <div class="head">
            <div class="date-pill">${formatDateAr(m.date)}</div>
            ${cat ? `<div class=\"cat-badge\">${cat}</div>` : ''}
          </div>
          <div class="teams">
            <div class="team">
              <span class="flag">${teamFlag(home)}</span>
              <div class="meta-name">
                <span class="name">${home.name}</span>
                ${home.shortName? `<span class='sub' style='color:#64748b;font-weight:700;font-size:12px'>${home.shortName}</span>`: ''}
              </div>
            </div>
            <div class="vs">VS</div>
            <div class="team">
              <div class="meta-name" style="text-align:right">
                <span class="name">${away.name}</span>
                ${away.shortName? `<span class='sub' style='color:#64748b;font-weight:700;font-size:12px'>${away.shortName}</span>`: ''}
              </div>
              <span class="flag">${teamFlag(away)}</span>
            </div>
          </div>
          <div class="meta">
            <div class="venue">🏟️ <span>${m.venue||''}</span></div>
            <div class="time-pill">${m.time||''}</div>
          </div>`;
        roundWrap.appendChild(card);
      });

      grid.appendChild(roundWrap);
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
    // Bind category cards
    const catWrap = document.getElementById('cat-cards');
    if(catWrap){
      catWrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('.cat-card');
        if(!btn) return;
        // toggle active
        Array.from(catWrap.querySelectorAll('.cat-card')).forEach(b=> b.classList.remove('active'));
        btn.classList.add('active');
        renderFixtures();
      });
    }

    // Bind group chips
    const grpWrap = document.getElementById('grp-cards');
    if(grpWrap){
      grpWrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('.grp-card');
        if(!btn) return;
        Array.from(grpWrap.querySelectorAll('.grp-card')).forEach(b=> b.classList.remove('active'));
        btn.classList.add('active');
        renderFixtures();
      });
    }

    // Bind round selector (left sidebar)
    const roundWrap = document.getElementById('round-cards');
    if(roundWrap){
      roundWrap.addEventListener('click', (e)=>{
        const btn = e.target.closest('.round-card');
        if(!btn) return;
        Array.from(roundWrap.querySelectorAll('.round-card')).forEach(b=> b.classList.remove('active'));
        btn.classList.add('active');
        renderFixtures();
      });
    }

    renderFixtures();
    applySiteBrand();
    const y=qs('#year'); if(y) y.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
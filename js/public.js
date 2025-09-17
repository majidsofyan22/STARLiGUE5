// FRMF-like public site: bilingual (AR/FR), hero slider, news, fixtures, standings, media, partners.
(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));

  const hasFirebase = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  // ---- DB state (Firebase-only) ----
  const db = {
    site: { nameAr:'بطولة ستارليغ', nameFr:'CHAMPIONNAT STARLiGUE', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' },
    teams: [],
    matches: [],
    slides: [],
    sliderSettings: { autoplay:true, interval:6 },
    news: [],
    videos: [],
    partners: []
  };

  function normalizeMatchesFromRemote(list){
    return (list||[]).map(m => ({
      ...m,
      homeGoals: m?.homeGoals === null || m?.homeGoals === undefined ? NaN : Number(m.homeGoals),
      awayGoals: m?.awayGoals === null || m?.awayGoals === undefined ? NaN : Number(m.awayGoals)
    }));
  }

  async function loadPublic(){
    if(!hasFirebase){ return; }
    try{
      const [teamsSnap, matchesSnap, slidesSnap, newsSnap, videosSnap, partnersSnap, siteSnap, sliderSettingsSnap] = await Promise.all([
        window.dbGet('teams'),
        window.dbGet('matches'),
        window.dbGet('slides'),
        window.dbGet('news'),
        window.dbGet('videos'),
        window.dbGet('partners'),
        window.dbGet('site'),
        window.dbGet('slider_settings')
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
              teamsArr.push({ id: d.id || child.key, name: d.name||'', city: d.city||'', logo: d.logo||'', pass: d.pass||'' });
            });
          } catch {
            teamsArr = Object.values(raw || {});
          }
        }
      }
      db.teams = teamsArr;
      db.matches = matchesSnap.exists() ? normalizeMatchesFromRemote(matchesSnap.val()) : [];
      db.slides = slidesSnap.exists() ? slidesSnap.val() : [];
      db.news = newsSnap.exists() ? newsSnap.val() : [];
      db.videos = videosSnap.exists() ? videosSnap.val() : [];
      db.partners = partnersSnap.exists() ? partnersSnap.val() : [];
      db.site = siteSnap.exists() ? siteSnap.val() : db.site;
      db.sliderSettings = sliderSettingsSnap.exists() ? (sliderSettingsSnap.val() || db.sliderSettings) : db.sliderSettings;

      // Live updates
      if(window.dbOnValue){
        window.dbOnValue('teams', (snap)=>{ if(snap.exists()){ 
            // normalize live updates as well
            let teamsArr = [];
            const raw = snap.val();
            if(Array.isArray(raw)) teamsArr = raw; 
            else {
              try{ snap.forEach(child=>{ const d=child.val()||{}; teamsArr.push({ id: d.id || child.key, name: d.name||'', city: d.city||'', logo: d.logo||'', pass: d.pass||'' }); }); }
              catch{ teamsArr = Object.values(raw||{}); }
            }
            db.teams = teamsArr; 
            renderPublicTeams(); renderFixtures(); renderStandings(); 
          } else { db.teams = []; renderPublicTeams(); renderFixtures(); renderStandings(); } });
        window.dbOnValue('matches', (snap)=>{ if(snap.exists()){ db.matches = normalizeMatchesFromRemote(snap.val()); renderFixtures(); renderStandings(); } });
        window.dbOnValue('slides', (snap)=>{ if(snap.exists()){ db.slides = snap.val(); renderSlider(); renderMedia(); } });
        window.dbOnValue('videos', (snap)=>{ if(snap.exists()){ db.videos = snap.val(); renderVideos(); } });
        window.dbOnValue('news', (snap)=>{ if(snap.exists()){ db.news = snap.val(); renderNews(); } });
        window.dbOnValue('partners', (snap)=>{ if(snap.exists()){ db.partners = snap.val(); renderPartners(); } });
        window.dbOnValue('site', (snap)=>{ if(snap.exists()){ db.site = snap.val(); applySiteBrand(); } });
        window.dbOnValue('slider_settings', (snap)=>{ if(snap.exists()){ db.sliderSettings = snap.val() || db.sliderSettings; renderSlider(); } });
      }
    }catch(err){
      console.warn('Firebase load (public) failed', err);
    }
  }

  // ---- Site settings (name/logo) ----
  function applySiteBrand(){
    const site = db.site || { nameAr:'بطولة ستارليغ', nameFr:'CHAMPIONNAT STARLiGUE', logo:'https://upload.wikimedia.org/wikipedia/fr/4/49/F%C3%A9d%C3%A9ration_royale_marocaine_de_football_%28logo%29.svg' };
    const logoImg = qs('.brand-logo');
    const nameAr = qs('.brand-title .ar');
    const nameFr = qs('.brand-title .fr');
    if(logoImg && site.logo){ logoImg.src = site.logo; }
    if(nameAr && site.nameAr){ nameAr.textContent = site.nameAr; }
    if(nameFr && site.nameFr){ nameFr.textContent = site.nameFr; }
  }

  // ---- i18n ----
  const dict = {
    ar: {
      'top.news':'الأخبار','top.matches':'المباريات','top.standings':'الترتيب','top.media':'الوسائط',
      'nav.home':'الرئيسية','nav.news':'الأخبار','nav.fixtures':'المباريات','nav.standings':'الترتيب','nav.national_teams':'المنتخبات','nav.media':'الوسائط','nav.contact':'تواصل',
      'sections.latest_news':'آخر الأخبار','actions.see_all':'عرض الكل','sections.fixtures':'المباريات والنتائج',
      'fixtures.date':'التاريخ','fixtures.time':'الساعة','fixtures.home':'الفريق (أ)','fixtures.away':'الفريق (ب)','fixtures.score':'النتيجة','fixtures.venue':'الملعب',
      'sections.standings':'جدول الترتيب','standings.team':'الفريق','standings.p':'لعب','standings.w':'ف','standings.d':'ت','standings.l':'خ','standings.gf':'له','standings.ga':'عليه','standings.gd':'الفرق','standings.pts':'النقاط',
      'sections.media':'الوسائط','sections.partners':'شركاؤنا',
      'footer.org':'الجامعة الملكية المغربية لكرة القدم','footer.desc':'الموقع الرسمي لأخبار وبرامج كرة القدم المغربية.','footer.contact':'تواصل','footer.follow':'تابعنا','footer.rights':'جميع الحقوق محفوظة.',
      'hero.title':'FRMF Gestion', 'hero.sub':'شريكك الرياضي', 'hero.desc':'اكتشف منصتنا المبتكرة التي تُبَسِّط إدارة ناديك أو جمعيتك الرياضية بأدوات حديثة وسهلة الاستخدام.', 'hero.cta':'سجّل فريقك الآن'
    },
    fr: {
      'top.news':'Actualités','top.matches':'Matches','top.standings':'Classement','top.media':'Médiathèque',
      'nav.home':'Accueil','nav.news':'Actualités','nav.fixtures':'Matches','nav.standings':'Classement','nav.national_teams':'Sélections','nav.media':'Médiathèque','nav.contact':'Contact',
      'sections.latest_news':'Dernières Actualités','actions.see_all':'Tout voir','sections.fixtures':'Matches et Résultats',
      'fixtures.date':'Date','fixtures.time':'Heure','fixtures.home':'Équipe (A)','fixtures.away':'Équipe (B)','fixtures.score':'Score','fixtures.venue':'Stade',
      'sections.standings':'Classement','standings.team':'Équipe','standings.p':'J','standings.w':'G','standings.d':'N','standings.l':'P','standings.gf':'BP','standings.ga':'BC','standings.gd':'Diff','standings.pts':'Pts',
      'sections.media':'Médiathèque','sections.partners':'Partenaires',
      'footer.org':'Fédération Royale Marocaine de Football','footer.desc':'Site officiel du football marocain.','footer.contact':'Contact','footer.follow':'Suivez-nous','footer.rights':'Tous droits réservés.',
      'hero.title':'FRMF Gestion', 'hero.sub':'Votre Partenaire Sport', 'hero.desc':'Découvrez notre plateforme innovante qui simplifie la gestion de votre club ou association sportive avec des outils modernes et intuitifs.', 'hero.cta':'Commencer maintenant'
    }
  };

  function applyI18n(lang){
    qsa('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const txt = dict[lang]?.[key];
      if(typeof txt === 'string') el.textContent = txt;
    });
  }

  function setLang(lang){
    const html = document.documentElement;
    html.lang = (lang==='fr' ? 'fr' : 'ar');
    html.dir = (lang==='fr' ? 'ltr' : 'rtl');
    applyI18n(html.lang);
    qs('#lang-ar')?.classList.toggle('active', html.lang==='ar');
    qs('#lang-fr')?.classList.toggle('active', html.lang==='fr');
  }

  // ---- Hero ----
  function renderSlider(){
    const cont = qs('#hero-slides');
    if(!cont) return;
    cont.innerHTML = '';
    const slides = db.slides.length ? db.slides : [
      { url:'https://www.frmfgestion.com/_next/image?url=%2Flanding%2Fimg1.jpeg&w=1920&q=75' },
      { url:'https://www.frmfgestion.com/_next/image?url=%2Flanding%2Fhero-bg-n1.png&w=1920&q=75' },
      { url:'https://www.frmfgestion.com/_next/image?url=%2Flanding%2Fhero-bg-n2.jpg&w=1920&q=75' },
      { url:'https://www.frmfgestion.com/_next/image?url=%2Flanding%2Fhero-bg-3.webp&w=1920&q=75' }
    ];
    const interval = Math.max(2, Math.min(30, Number(db.sliderSettings?.interval)||6));
    const autoplay = (db.sliderSettings?.autoplay !== false);

    const nodes = slides.map((s)=>{
      const div = document.createElement('div');
      div.className = 'slide';
      div.style.backgroundImage = s.url ? `url('${s.url}')` : '';
      cont.appendChild(div);
      return div;
    });

    // Crossfade without black frames
    let idx = 0;
    function show(i){ nodes.forEach((n,j)=> n.classList.toggle('active', j===i)); }
    if(!autoplay){ show(0); return; }
    show(0);
    if(window.__sliderTimer) clearInterval(window.__sliderTimer);
    window.__sliderTimer = setInterval(()=>{ idx = (idx+1) % nodes.length; show(idx); }, interval*1000);
  }

  // ---- News ----
  function renderNews(){
    const grid = qs('#news-grid'); if(!grid) return;
    grid.innerHTML = db.news.map(n => `
      <article class="card">
        <span class="thumb">${n.image? `<img src="${n.image}" alt="">`: ''}</span>
        <div class="content">
          <h3 class="title">${n.title}</h3>
          <div class="meta">${n.date||''}</div>
        </div>
      </article>
    `).join('');
  }

  // ---- Teams/Matches/Standings ----
  function isPlayed(m){ return Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals); }

  function renderResultsBar(){
    const bar = qs('#results-bar'); if(!bar) return;
    const teamById = Object.fromEntries(db.teams.map(t=> [String(t.id), t]));
    const played = (db.matches||[]).filter(isPlayed);
    // أحدث 8 نتائج
    const last = [...played].sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.time||'').localeCompare(a.time||'')).slice(0,8);
    bar.innerHTML = last.map(m => {
      const home = teamById[String(m.homeId)]?.name || '—';
      const away = teamById[String(m.awayId)]?.name || '—';
      const score = `${m.homeGoals}-${m.awayGoals}`;
      const meta = [m.date||'', m.time||''].filter(Boolean).join(' • ');
      return `<span class="result-pill"><span class="teams">${home} <span class="score">${score}</span> ${away}</span>${meta? `<span class="meta">${meta}</span>`: ''}</span>`;
    }).join('');
  }

  function renderFixtures(){
    const tbody = qs('#fixtures-body'); if(!tbody) return; tbody.innerHTML = '';
    const teamById = Object.fromEntries(db.teams.map(t=> [String(t.id), t]));
    const sorted = [...db.matches].sort((a,b)=> (a.date||'').localeCompare(b.date) || (a.time||'').localeCompare(b.time));
    sorted.forEach(m => {
      const tr = document.createElement('tr');
      const res = isPlayed(m) ? `${m.homeGoals} - ${m.awayGoals}` : '—';
      tr.innerHTML = `
        <td>${m.date||''}</td>
        <td>${m.time||''}</td>
        <td>${teamById[m.homeId]?.name || '—'}</td>
        <td>${teamById[m.awayId]?.name || '—'}</td>
        <td>${res}</td>
        <td>${m.venue||''}</td>`;
      tbody.appendChild(tr);
    });
    renderStandings();
  }

  function renderStandings(){
    renderResultsBar();
    const table = new Map();
    db.teams.forEach(t => table.set(String(t.id), { team:t, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 }));
    db.matches.forEach(m => {
      if(!isPlayed(m)) return;
      const home = table.get(String(m.homeId)); const away = table.get(String(m.awayId)); if(!home||!away) return;
      home.p++; away.p++;
      home.gf += m.homeGoals; home.ga += m.awayGoals; home.gd = home.gf - home.ga;
      away.gf += m.awayGoals; away.ga += m.homeGoals; away.gd = away.gf - away.ga;
      if(m.homeGoals > m.awayGoals){ home.w++; home.pts += 3; away.l++; }
      else if(m.homeGoals < m.awayGoals){ away.w++; away.pts += 3; home.l++; }
      else { home.d++; away.d++; home.pts++; away.pts++; }
    });
    const rows = Array.from(table.values()).sort((a,b)=> b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
    const tbody = qs('#standings-body'); if(!tbody) return; tbody.innerHTML = '';
    rows.forEach((r,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${r.team.name}</td>
        <td>${r.p}</td>
        <td>${r.w}</td>
        <td>${r.d}</td>
        <td>${r.l}</td>
        <td>${r.gf}</td>
        <td>${r.ga}</td>
        <td>${r.gd}</td>
        <td>${r.pts}</td>`;
      tbody.appendChild(tr);
    });
  }

  async function getPlayersByTeam(teamId){
    try{
      const snap = await window.dbGet('players');
      const list = snap.exists()? (Array.isArray(snap.val())? snap.val(): []) : [];
      return list.filter(p => String(p.teamId||'') === String(teamId));
    }catch{ return []; }
  }

  async function renderPlayersForTeam(team){
    const list = await getPlayersByTeam(team.id);
    const cont = qs('#players-list'); if(!cont) return;
    cont.innerHTML = (list||[]).map(p=> `
      <div class="card" style="display:flex; gap:8px; align-items:center;">
        <div style="width:48px; height:48px; border-radius:50%; overflow:hidden; background:#111; display:flex; align-items:center; justify-content:center;">${p.photo? `<img src="${p.photo}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover">`: '👤'}</div>
        <div style="flex:1">
          <div style="font-weight:700">${p.name||''}</div>
          <div class="muted">${p.club||''} • ${p.category||''} • ${p.position||''}</div>
        </div>
      </div>
    `).join('');
  }

  function ensurePlayersModal(){
    if(qs('#players-modal')) return qs('#players-modal');
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'players-modal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML = `
      <div class="modal-backdrop" data-close></div>
      <div class="modal-dialog">
        <button class="modal-close" data-close aria-label="إغلاق">×</button>
        <h3 style="margin:0 0 10px">لاعبو الفريق</h3>
        <div id="players-list" style="display:grid; gap:8px; max-height:60vh; overflow:auto"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if(e.target.matches('[data-close]')) closePlayersModal(); });
    return modal;
  }
  function openPlayersModal(){ ensurePlayersModal().setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
  function closePlayersModal(){ const m=qs('#players-modal'); if(m){ m.setAttribute('aria-hidden','true'); document.body.style.overflow=''; } }

  function renderPublicTeams(){
    const grid = qs('#teams-grid'); if(!grid) return; grid.innerHTML = '';
    db.teams.forEach(t =>{
      const card = document.createElement('div');
      card.className = 'team-card';
      const teamId = encodeURIComponent(String(t.id));
      card.innerHTML = `
        <div class="logo">${t.logo? `<img src="${t.logo}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.closest('.logo').textContent='🛡️'">` : '🛡️'}</div>
        <div class="meta">
          <div class="name">${t.name}${t.city? ` - <span class="city-inline">${t.city}</span>`:''}</div>
        </div>
        <div class="team-actions" style="display:flex; gap:8px; justify-content:center; margin-top:8px;">
          <a class="btn btn-qualify" href="./qualify.html?team=${teamId}">تأهيل لاعبين</a>
          <button class="btn" data-players="${t.id}">عرض اللاعبين</button>
        </div>`;
      grid.appendChild(card);
    });
    qsa('[data-players]').forEach(b=> b.onclick = async ()=>{ openPlayersModal(); const t = db.teams.find(x=> String(x.id)===String(b.getAttribute('data-players'))); if(t) await renderPlayersForTeam(t); });
  }

  function renderMedia(){
    const cont = qs('#media-grid'); if(!cont) return; cont.innerHTML = '';
    const images = db.slides || [];
    images.forEach(s=>{
      const it = document.createElement('article');
      it.className = 'card';
      it.innerHTML = s.url ? `<span class="thumb"><img src="${s.url}" alt=""></span>` : `<span class="thumb"></span>`;
      cont.appendChild(it);
    });
  }

  function renderVideos(){
    const cont = qs('#videos-grid'); if(!cont) return; cont.innerHTML = '';
    (db.videos||[]).forEach(v=>{
      const it = document.createElement('div');
      it.className = 'video-item';
      it.innerHTML = v.embed || '';
      cont.appendChild(it);
    });
  }

  function renderPartners(){
    const cont = qs('#partners-grid'); if(!cont) return; cont.innerHTML = '';
    (db.partners||[]).forEach(p=>{
      const it = document.createElement('div');
      it.className = 'partner-item';
      it.innerHTML = p.logo? `<img src="${p.logo}" alt="${p.name||''}">` : `<div class="muted">${p.name||''}</div>`;
      cont.appendChild(it);
    });
  }

  async function init(){
    await loadPublic();
    applySiteBrand();
    setLang('ar');
    renderSlider();
    renderNews();
    renderPublicTeams();
    renderFixtures();
    renderVideos();
    renderPartners();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
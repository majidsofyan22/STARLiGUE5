// StarLeague front-end logic (no backend). Data persisted in localStorage.
(function(){
  'use strict';

  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => Array.from(root.querySelectorAll(s));

  // --- Persistence helpers (Firebase primary, localStorage fallback) ---
  const storage = {
    get(key, fallback){
      try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{ return fallback; }
    },
    set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  };

  const hasFirebase = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;

  const db = {
    teams: [],
    matches: [],
    admin: { username: 'admin', password: '123456' }
  };

  // Convert NaN goals to null for Firebase JSON compatibility
  function serializeMatchesForRemote(list){
    return (list||[]).map(m => ({
      ...m,
      homeGoals: Number.isFinite(m.homeGoals) ? m.homeGoals : null,
      awayGoals: Number.isFinite(m.awayGoals) ? m.awayGoals : null
    }));
  }

  // Convert null goals back to NaN for in-app logic
  function normalizeMatchesFromRemote(list){
    return (list||[]).map(m => ({
      ...m,
      homeGoals: m.homeGoals === null || m.homeGoals === undefined ? NaN : Number(m.homeGoals),
      awayGoals: m.awayGoals === null || m.awayGoals === undefined ? NaN : Number(m.awayGoals)
    }));
  }

  async function load(){
    if(hasFirebase){
      try{
        const [teamsSnap, matchesSnap, adminSnap] = await Promise.all([
          window.dbGet('teams'),
          window.dbGet('matches'),
          window.dbGet('admin')
        ]);
        db.teams = teamsSnap.exists() ? teamsSnap.val() : [];
        db.matches = matchesSnap.exists() ? normalizeMatchesFromRemote(matchesSnap.val()) : [];
        db.admin = adminSnap.exists() ? adminSnap.val() : db.admin;
      }catch(err){
        console.warn('Firebase load failed, using localStorage fallback', err);
        db.teams = storage.get('sl_teams', []);
        db.matches = storage.get('sl_matches', []);
        db.admin = storage.get('sl_admin', db.admin);
      }
    } else {
      db.teams = storage.get('sl_teams', []);
      db.matches = storage.get('sl_matches', []);
      db.admin = storage.get('sl_admin', db.admin);
    }
  }

  function save(){
    if(hasFirebase){
      // Fire-and-forget; UI will reflect in-memory state immediately
      try{ window.dbSet('teams', db.teams); }catch{}
      try{ window.dbSet('matches', serializeMatchesForRemote(db.matches)); }catch{}
      try{ window.dbSet('admin', db.admin); }catch{}
    }
    // Always keep local cache in sync (optional)
    storage.set('sl_teams', db.teams);
    storage.set('sl_matches', db.matches);
    storage.set('sl_admin', db.admin);
  }

  // --- UI: Navigation ---
  function setupNav(){
    const links = qsa('.nav .nav-link');
    links.forEach(btn => btn.addEventListener('click', () => {
      links.forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      qsa('.view').forEach(v => v.classList.remove('active'));
      qs('#' + btn.dataset.target).classList.add('active');
    }));
  }

  // --- Teams ---
  function renderTeams(){
    const tbody = qs('#teams-table tbody');
    tbody.innerHTML = '';
    db.teams.forEach((t, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td><span class="avatar">${t.logo ? `<img src="${t.logo}" alt="">` : ''}</span></td>
        <td>${t.name}</td>
        <td>${t.city||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit="${t.id}">تعديل</button>
          <button class="btn danger" data-del="${t.id}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind actions
    qsa('[data-edit]').forEach(b => b.onclick = () => openTeamModal(b.getAttribute('data-edit')));
    qsa('[data-del]').forEach(b => b.onclick = () => deleteTeam(b.getAttribute('data-del')));

    // Update stats
    qs('#stat-teams').textContent = String(db.teams.length);

    // Update selects in match form
    const home = qs('#match-home');
    const away = qs('#match-away');
    [home, away].forEach(sel => {
      sel.innerHTML = db.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    });
  }

  function openTeamModal(id){
    const dlg = qs('#team-modal');
    const form = qs('#team-form');
    const title = qs('#team-modal-title');
    const name = qs('#team-name');
    const city = qs('#team-city');
    const logo = qs('#team-logo');

    if(id){
      const t = db.teams.find(x => String(x.id) === String(id));
      if(!t) return;
      title.textContent = 'تعديل فريق';
      name.value = t.name; city.value = t.city||''; logo.value = t.logo||'';
      form.onsubmit = (e) => {
        e.preventDefault();
        t.name = name.value.trim();
        t.city = city.value.trim();
        t.logo = logo.value.trim();
        save();
        renderTeams();
        dlg.close();
      };
    } else {
      title.textContent = 'إضافة فريق';
      name.value = ''; city.value = ''; logo.value = '';
      form.onsubmit = (e) => {
        e.preventDefault();
        const newTeam = {
          id: Date.now(),
          name: name.value.trim(),
          city: city.value.trim(),
          logo: logo.value.trim()
        };
        db.teams.push(newTeam);
        save();
        renderTeams();
        dlg.close();
      };
    }

    qs('#team-form [data-close]')?.addEventListener('click', () => dlg.close(), { once:true });
    dlg.showModal();
  }

  function deleteTeam(id){
    // Prevent deleting team if present in any match
    const used = db.matches.some(m => String(m.homeId)===String(id) || String(m.awayId)===String(id));
    if(used){
      alert('لا يمكن حذف الفريق لارتباطه بمباريات مسجلة.');
      return;
    }
    db.teams = db.teams.filter(t => String(t.id) !== String(id));
    save();
    renderTeams();
  }

  // --- Matches ---
  function renderMatches(){
    const tbody = qs('#matches-table tbody');
    const recentTbody = qs('#recent-matches tbody');
    tbody.innerHTML = '';
    recentTbody.innerHTML = '';

    // Sort by date/time ascending
    const sorted = [...db.matches].sort((a,b) => (a.date||'').localeCompare(b.date)|| (a.time||'').localeCompare(b.time));

    const teamById = Object.fromEntries(db.teams.map(t => [String(t.id), t]));

    sorted.forEach((m, i) => {
      const result = isNaN(m.homeGoals) || isNaN(m.awayGoals) ? '—' : `${m.homeGoals} - ${m.awayGoals}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${m.date||''}</td>
        <td>${m.time||''}</td>
        <td>${teamById[m.homeId]?.name || '—'}</td>
        <td>${teamById[m.awayId]?.name || '—'}</td>
        <td>${result}</td>
        <td>${m.venue||''}</td>
        <td class="actions-cell">
          <button class="btn" data-edit-match="${m.id}">تعديل</button>
          <button class="btn danger" data-del-match="${m.id}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Recent = last 5 by date/time desc
    const recent = [...sorted].sort((a,b)=> (b.date||'').localeCompare(a.date)|| (b.time||'').localeCompare(a.time)).slice(0,5);
    recent.forEach(m => {
      const result = isNaN(m.homeGoals) || isNaN(m.awayGoals) ? '—' : `${m.homeGoals} - ${m.awayGoals}`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${m.date||''}</td>
        <td>${teamById[m.homeId]?.name || '—'}</td>
        <td>${teamById[m.awayId]?.name || '—'}</td>
        <td>${result}</td>
        <td>${m.venue||''}</td>
      `;
      recentTbody.appendChild(tr);
    });

    // Bind actions
    qsa('[data-edit-match]').forEach(b => b.onclick = () => openMatchModal(b.getAttribute('data-edit-match')));
    qsa('[data-del-match]').forEach(b => b.onclick = () => deleteMatch(b.getAttribute('data-del-match')));

    // Update stats
    qs('#stat-matches').textContent = String(db.matches.length);

    // Next match
    const upcoming = sorted.find(m => !isPlayed(m));
    if(upcoming){
      const h = teamById[upcoming.homeId]?.name || '—';
      const a = teamById[upcoming.awayId]?.name || '—';
      qs('#stat-next-match').textContent = `${h} × ${a} | ${upcoming.date||''} ${upcoming.time||''}`;
    } else {
      qs('#stat-next-match').textContent = '—';
    }

    // Standings
    renderStandings();
  }

  function isPlayed(m){
    return Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals);
  }

  function openMatchModal(id){
    const dlg = qs('#match-modal');
    const form = qs('#match-form');
    const title = qs('#match-modal-title');

    const homeSel = qs('#match-home');
    const awaySel = qs('#match-away');
    const date = qs('#match-date');
    const time = qs('#match-time');
    const venue = qs('#match-venue');
    const hg = qs('#match-home-goals');
    const ag = qs('#match-away-goals');

    const resetForm = () => { homeSel.value=''; awaySel.value=''; date.value=''; time.value=''; venue.value=''; hg.value=''; ag.value=''; };

    if(id){
      const m = db.matches.find(x => String(x.id) === String(id));
      if(!m) return;
      title.textContent = 'تعديل مباراة';
      homeSel.value = String(m.homeId);
      awaySel.value = String(m.awayId);
      date.value = m.date||'';
      time.value = m.time||'';
      venue.value = m.venue||'';
      hg.value = Number.isFinite(m.homeGoals)? m.homeGoals: '';
      ag.value = Number.isFinite(m.awayGoals)? m.awayGoals: '';

      form.onsubmit = (e) => {
        e.preventDefault();
        m.homeId = homeSel.value; m.awayId = awaySel.value;
        m.date = date.value; m.time = time.value; m.venue = venue.value;
        m.homeGoals = hg.value === '' ? NaN : Number(hg.value);
        m.awayGoals = ag.value === '' ? NaN : Number(ag.value);
        save();
        renderMatches();
        dlg.close();
      };
    } else {
      title.textContent = 'إضافة مباراة';
      resetForm();
      form.onsubmit = (e) => {
        e.preventDefault();
        const newMatch = {
          id: Date.now(),
          homeId: homeSel.value,
          awayId: awaySel.value,
          date: date.value,
          time: time.value,
          venue: venue.value,
          homeGoals: hg.value === '' ? NaN : Number(hg.value),
          awayGoals: ag.value === '' ? NaN : Number(ag.value)
        };
        db.matches.push(newMatch);
        save();
        renderMatches();
        dlg.close();
      };
    }

    qs('#match-form [data-close]')?.addEventListener('click', () => dlg.close(), { once:true });
    dlg.showModal();
  }

  function deleteMatch(id){
    db.matches = db.matches.filter(m => String(m.id) !== String(id));
    save();
    renderMatches();
  }

  // --- Standings ---
  function renderStandings(){
    // Compute table using 3 pts win, 1 draw, 0 loss
    const table = new Map();
    db.teams.forEach(t => table.set(String(t.id), { team:t, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0 }));
    db.matches.forEach(m => {
      if(!isPlayed(m)) return; // only finished matches
      const home = table.get(String(m.homeId));
      const away = table.get(String(m.awayId));
      if(!home || !away) return;
      home.p++; away.p++;
      home.gf += m.homeGoals; home.ga += m.awayGoals; home.gd = home.gf - home.ga;
      away.gf += m.awayGoals; away.ga += m.homeGoals; away.gd = away.gf - away.ga;
      if(m.homeGoals > m.awayGoals){ home.w++; home.pts += 3; away.l++; }
      else if(m.homeGoals < m.awayGoals){ away.w++; away.pts += 3; home.l++; }
      else { home.d++; away.d++; home.pts++; away.pts++; }
    });

    const rows = Array.from(table.values()).sort((a,b)=> b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.name.localeCompare(b.team.name));
    const tbody = qs('#standings-table tbody');
    tbody.innerHTML = '';
    rows.forEach((r, i) => {
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
        <td>${r.pts}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- Admin Login (demo only) ---
  function setupAdmin(){
    const form = qs('#login-form');
    const status = qs('#login-status');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = qs('#admin-username').value.trim();
      const p = qs('#admin-password').value.trim();
      const ok = (u === db.admin.username && p === db.admin.password);
      status.textContent = ok ? 'تم تسجيل الدخول بنجاح (تجريبي).' : 'بيانات غير صحيحة.';
      status.style.color = ok ? '#00d4a6' : '#ff5d73';
    });
  }

  // --- Search in matches ---
  function setupMatchSearch(){
    const input = qs('#search-matches');
    input.addEventListener('input', () => {
      const term = input.value.trim();
      const rows = qsa('#matches-table tbody tr');
      rows.forEach(r => {
        r.style.display = r.textContent.includes(term) ? '' : 'none';
      });
    });
  }

  // --- Buttons ---
  function setupButtons(){
    qs('#btn-add-team').addEventListener('click', ()=> openTeamModal());
    qs('#btn-add-match').addEventListener('click', ()=> openMatchModal());
    qs('#btn-add-match-2').addEventListener('click', ()=> openMatchModal());
  }

  // --- Initialize ---
  async function init(){
    await load(); // ensure Firebase -> db is populated first

    setupNav();
    setupButtons();
    setupAdmin();
    setupMatchSearch();

    // Seed example data if Firebase/local is empty
    let seeded = false;
    if(db.teams.length === 0){
      db.teams = [
        { id: 't1', name: 'ستارز', city: 'الرباط', logo: '' },
        { id: 't2', name: 'فينيكس', city: 'الدار البيضاء', logo: '' },
        { id: 't3', name: 'المجرة', city: 'فاس', logo: '' }
      ];
      seeded = true;
    }
    if(db.matches.length === 0){
      db.matches = [
        { id:'m1', homeId:'t1', awayId:'t2', date:'2025-09-10', time:'18:00', venue:'ستاد النجوم', homeGoals:2, awayGoals:1 },
        { id:'m2', homeId:'t3', awayId:'t1', date:'2025-09-15', time:'20:00', venue:'ملعب المجرة', homeGoals:NaN, awayGoals:NaN }
      ];
      seeded = true;
    }
    if(seeded){ save(); }

    renderTeams();
    renderMatches();

    // Footer year
    qs('#year').textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', ()=>{ init(); });
})();
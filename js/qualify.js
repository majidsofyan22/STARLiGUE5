(function(){
  'use strict';
  const qs = (s, r=document) => r.querySelector(s);
  const storage = { get(k,f){ try{return JSON.parse(localStorage.getItem(k)) ?? f;}catch{return f;} }, set(k,v){ localStorage.setItem(k, JSON.stringify(v)); } };
  const LOCAL_KEY = 'sl_players';
  const hasFirebase = typeof window !== 'undefined' && !!window.dbGet && !!window.dbSet;
  let submitting = false;
  let currentTeam = null;

  // Limits to avoid localStorage quota errors (~5MB per origin)
  const MAX_TOTAL_BYTES = Math.floor(4.5 * 1024 * 1024); // 4.5MB safety margin
  const MAX_PER_FILE_BYTES = 600 * 1024; // 600KB per attachment/photo after compression

  function parseQuery(){
    const p = new URLSearchParams(location.search);
    return { team: p.get('team') };
  }

  async function getTeamById(id){
    if(hasFirebase){
      try{ const snap = await window.dbGet('teams'); const teams = snap.exists()? (snap.val()||[]) : []; return teams.find(t => String(t.id) === String(id)); }
      catch{ /* ignore */ }
    }
    const teams = storage.get('sl_teams', []);
    return teams.find(t => String(t.id) === String(id));
  }

  function readAsDataURL(file){
    return new Promise((resolve, reject)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  // Estimate base64 dataURL size in bytes
  function estimateDataUrlBytes(dataUrl){
    if(!dataUrl || typeof dataUrl !== 'string') return 0;
    const base64 = dataUrl.split(',')[1] || '';
    const padding = (base64.match(/=+$/) || [''])[0].length;
    return Math.floor(base64.length * 3 / 4 - padding);
  }

  // Promise timeout helper to avoid hangs
  function withTimeout(promise, ms, label='operation'){
    let timer;
    const timeout = new Promise((_resolve, reject)=>{
      timer = setTimeout(()=> reject(new Error(label + ' timeout after ' + ms + 'ms')), ms);
    });
    return Promise.race([promise.finally(()=> clearTimeout(timer)), timeout]).catch(err=>{ throw err; });
  }

  // Compress image to JPEG within max dimension and quality
  async function imageFileToCompressedDataUrl(file, maxDim=720, quality=0.7){
    return new Promise((resolve)=>{
      const fr = new FileReader();
      fr.onload = ()=>{
        const img = new Image();
        img.onload = ()=>{
          try{
            const {width, height} = img;
            const scale = Math.min(1, maxDim / Math.max(width, height));
            const w = Math.max(1, Math.round(width * scale));
            const h = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            // Convert to JPEG to reduce size
            const out = canvas.toDataURL('image/jpeg', quality);
            resolve(out || fr.result);
          }catch{ resolve(fr.result); }
        };
        img.onerror = ()=> resolve(null);
        img.src = fr.result;
      };
      fr.onerror = ()=> resolve(null);
      fr.readAsDataURL(file);
    });
  }

  async function fileToDataUrl(inputSel, opts={}){
    const el = qs(inputSel);
    const f = el?.files?.[0];
    if(!f) return null;
    if(f.type && f.type.startsWith('image/')){
      // Compress images
      const data = await imageFileToCompressedDataUrl(f, opts.maxDim || 1000, opts.quality || 0.7);
      if(data && estimateDataUrlBytes(data) > MAX_PER_FILE_BYTES) return null; // too big even after compression
      return data;
    } else if (f.type === 'application/pdf'){
      const data = await readAsDataURL(f);
      if(data && estimateDataUrlBytes(data) > MAX_PER_FILE_BYTES) return null;
      return data;
    } else {
      // Unsupported type: ignore
      return null;
    }
  }

  async function collectFormWithFiles(){
    const photoFile = qs('#q-photo')?.files?.[0] || null;
    let photoData = null;
    if(photoFile){
      try{
        if(photoFile.type && photoFile.type.startsWith('image/')){
          // Slightly stronger compression for faster upload
          photoData = await imageFileToCompressedDataUrl(photoFile, 680, 0.66);
        }
        if(photoData && estimateDataUrlBytes(photoData) > MAX_PER_FILE_BYTES){
          photoData = null; // drop if still too large
        }
      }catch{ /* ignore */ }
    }

    const attachDoc = await fileToDataUrl('#q-attach-document', { maxDim: 1000, quality: 0.66 });

    return {
      id: Math.random().toString(36).slice(2,9),
      teamId: qs('#team-id')?.value || '',
      club: currentTeam?.name || '',
      name: qs('#q-name').value.trim(),
      category: qs('#q-category').value,
      birth: qs('#q-birth').value,

      photo: photoData || null,
      attachments: {
        document: attachDoc
      }
    };
  }

  async function savePlayerRemoteSafe(list){ if(hasFirebase){ try{ await window.dbSet('players', list); }catch{} } }

  async function savePlayer(p){
    // Upload media to Firebase Storage (if available), then persist to DB
    if(hasFirebase && window.uploadDataURL){
      try{
        const basePath = `players/${p.teamId || 'unknown'}/${p.id}`;
        const tasks = [];
        // Photo (upload in parallel)
        if(p.photo && typeof p.photo === 'string' && p.photo.startsWith('data:')){
          tasks.push(
            withTimeout(window.uploadDataURL(`${basePath}/photo.jpg`, p.photo), 12000, 'upload photo')
              .then(url=>{ p.photo = url; })
              .catch(()=>{})
          );
        }
        // Attachments (upload in parallel)
        if(p.attachments && p.attachments.document && String(p.attachments.document).startsWith('data:')){
          tasks.push(
            withTimeout(window.uploadDataURL(`${basePath}/document.pdf`, p.attachments.document), 12000, 'upload document')
              .then(url=>{ p.attachments.document = url; })
              .catch(()=>{})
          );
        }
        if(tasks.length){ await Promise.all(tasks); }
      }catch{ /* ignore upload errors to avoid blocking form */ }
    }

    if(hasFirebase){
      // 1) Try push (works even if reads are disallowed)
      try{
        await withTimeout(window.dbPush('players', p), 8000, 'push player');
        return;
      }catch{ /* ignore and try array-mode */ }
      // 2) Fallback to array mode (read+set)
      try{
        const snap = await withTimeout(window.dbGet('players'), 8000, 'load players');
        const existing = snap.exists()? (snap.val()||[]) : [];
        existing.push(p);
        await withTimeout(savePlayerRemoteSafe(existing), 8000, 'save players');
        return; // Firebase-only preferred
      }catch{ /* fall through to local cache as last resort */ }
    }

    // Fallback local cache (only if Firebase failed)
    const listLocal = storage.get(LOCAL_KEY, []);
    listLocal.push(p);
    storage.set(LOCAL_KEY, listLocal);
  }

  function bindPhotoPreview(){
    const input = qs('#q-photo');
    const preview = qs('#q-photo-preview');
    if(!input || !preview) return;
    input.addEventListener('change', async ()=>{
      const file = input.files && input.files[0];
      if(!file){ preview.innerHTML = '📷'; return; }
      try {
        let data = null;
        if(file.type && file.type.startsWith('image/')){
          data = await imageFileToCompressedDataUrl(file, 720, 0.72);
        } else {
          data = await readAsDataURL(file);
        }
        if(!data || estimateDataUrlBytes(data) > MAX_PER_FILE_BYTES){
          preview.innerHTML = '📷';
          alert('الصورة كبيرة جدًا. يرجى اختيار صورة أصغر (≤ 600KB تقريبًا).');
          return;
        }
        preview.innerHTML = `<img src="${data}" alt="preview">`;
      } catch {
        preview.innerHTML = '📷';
      }
    });
  }

  function disableForm(form, disabled){
    const btn = form?.querySelector('button[type="submit"]');
    if(btn){ btn.disabled = !!disabled; btn.textContent = disabled ? 'جارٍ الإرسال…' : 'إرسال'; }
  }

  async function init(){
    const { team } = parseQuery();
    const t = team ? await getTeamById(team) : null;
    if(t){
      currentTeam = t; // keep team in memory to attach club automatically
      qs('#team-id').value = t.id;
      qs('#team-name').textContent = `الفريق: ${t.name}`;
    }

    bindPhotoPreview();

    const form = qs('#qualify-form');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(submitting) return; // prevent double submit
      submitting = true;
      disableForm(form, true);
      try{
        const p = await collectFormWithFiles();
        if(!p.name){ alert('يرجى إدخال الاسم الكامل'); return; }

        // Pre-check approximate payload size against localStorage quota as fallback
        const existing = storage.get(LOCAL_KEY, []);
        const payloadStr = JSON.stringify([...existing, p]);
        if(payloadStr.length > MAX_TOTAL_BYTES){
          alert('حجم البيانات كبير بسبب الصور/الملفات. يرجى اختيار صور أصغر أو تقليل المرفقات ثم أعد المحاولة.');
          return;
        }

        // Optimistic UI: submit in background for faster experience
        try { savePlayer(p); } catch {}

        form.reset();
        const preview = qs('#q-photo-preview'); if(preview) preview.innerHTML = '📷';
        alert('تم إرسال البيانات بنجاح');
      } finally {
        disableForm(form, false);
        submitting = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
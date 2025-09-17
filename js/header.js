(function(){
  'use strict';
  function initMobileHeader(){
    const headerRow = document.querySelector('.site-header .mainbar .container');
    const nav = document.querySelector('.main-nav');
    if(!headerRow || !nav) return;

    // Ensure nav has an id for aria-controls
    if(!nav.id) nav.id = 'site-nav';

    // Create menu toggle button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-btn';
    btn.setAttribute('aria-controls', nav.id);
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'القائمة');
    btn.innerHTML = '☰';

    // Insert the button near the nav (at start of its flex wrapper if exists)
    const navWrap = nav.parentElement;
    if(navWrap && navWrap.classList.contains('flex')){
      navWrap.insertBefore(btn, navWrap.firstChild);
    }else{
      headerRow.insertBefore(btn, headerRow.firstChild);
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);

    function openNav(){
      document.body.classList.add('nav-open');
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function closeNav(){
      document.body.classList.remove('nav-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', ()=>{
      const opened = document.body.classList.contains('nav-open');
      opened ? closeNav() : openNav();
    });
    overlay.addEventListener('click', closeNav);
    nav.addEventListener('click', (e)=>{ if(e.target.closest('a')) closeNav(); });
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeNav(); });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMobileHeader);
  }else{
    initMobileHeader();
  }
})();
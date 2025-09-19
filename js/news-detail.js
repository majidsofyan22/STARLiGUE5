(function(){
  'use strict';

  const hasFirebase = typeof window !== 'undefined' && !!window.dbGet;
  let news = [];

  // Get URL parameter
  function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  async function loadNews() {
    if (!hasFirebase) return;
    try {
      const snap = await window.dbGet('news');
      news = snap.exists() ? snap.val() : [];
    } catch (error) {
      console.error('Error loading news:', error);
      news = [];
    }
  }

  function renderNewsDetail() {
    const newsId = getUrlParam('id');
    const container = document.getElementById('news-detail');

    if (!container) return;

    if (!newsId) {
      container.innerHTML = `
        <div class="error-message">
          <h2>خطأ في تحميل الخبر</h2>
          <p>لم يتم العثور على معرف الخبر</p>
          <a href="./index.html#news" class="btn">العودة للأخبار</a>
        </div>
      `;
      return;
    }

    const newsItem = news.find(n => String(n.id) === String(newsId));

    if (!newsItem) {
      container.innerHTML = `
        <div class="error-message">
          <h2>الخبر غير موجود</h2>
          <p>الخبر الذي تبحث عنه غير موجود أو تم حذفه</p>
          <a href="./index.html#news" class="btn">العودة للأخبار</a>
        </div>
      `;
      return;
    }

    const imageHtml = newsItem.image ? `<img src="${newsItem.image}" alt="${newsItem.title}" class="news-detail-image" />` : '';

    container.innerHTML = `
      <header class="news-header">
        ${imageHtml}
        <div class="news-meta">
          <h1 class="news-title">${newsItem.title}</h1>
          <div class="news-date">${newsItem.date || ''}</div>
        </div>
      </header>

      <div class="news-content">
        <div class="news-details">
          ${newsItem.details ? newsItem.details.replace(/\n/g, '<br>') : '<p>لا توجد تفاصيل إضافية لهذا الخبر.</p>'}
        </div>
      </div>

      <div class="news-actions">
        <a href="./index.html#news" class="btn">العودة للأخبار</a>
        <button onclick="window.history.back()" class="btn">السابق</button>
      </div>
    `;
  }

  // Set current year in footer
  function setCurrentYear() {
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  async function init() {
    setCurrentYear();
    await loadNews();
    renderNewsDetail();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
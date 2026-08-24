(function () {
  // TODO: replace with your real PayPal business email before going live.
  const PAYPAL_BUSINESS_EMAIL = 'placeholder@hurstcollectibles.com';

  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('search');
  const publisherSelect = document.getElementById('filter-publisher');
  const keySelect = document.getElementById('filter-key');
  const sortSelect = document.getElementById('sort');
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const loadMoreBtn = document.getElementById('load-more');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modal = document.getElementById('modal');

  const PAGE_SIZE = 40;
  let visibleCount = PAGE_SIZE;

  const KEY_CATEGORY_WORDS = ['1st appearance', 'first appearance', 'origin', 'death', '1st full', '1st team', '1st cover'];

  function isKeyIssue(item) {
    const s = item.story_arc + ' ' + item.story_title;
    return KEY_CATEGORY_WORDS.some(w => s.toLowerCase().includes(w));
  }

  function populatePublishers() {
    const pubs = Array.from(new Set(INVENTORY.map(i => i.publisher).filter(Boolean))).sort();
    publisherSelect.innerHTML = '<option value="">All publishers</option>' +
      pubs.map(p => `<option value="${p}">${p}</option>`).join('');
  }

  function matchesSearch(item, q) {
    if (!q) return true;
    const hay = `${item.title} ${item.series} ${item.story_arc} ${item.story_title}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function getFiltered() {
    const q = searchInput.value.trim();
    const pub = publisherSelect.value;
    const keyOnly = keySelect.value === 'key';
    let items = INVENTORY.filter(i =>
      matchesSearch(i, q) &&
      (!pub || i.publisher === pub) &&
      (!keyOnly || isKeyIssue(i))
    );
    const sort = sortSelect.value;
    if (sort === 'series-asc') items.sort((a, b) => a.series.localeCompare(b.series) || naturalIssue(a) - naturalIssue(b));
    if (sort === 'series-desc') items.sort((a, b) => b.series.localeCompare(a.series));
    if (sort === 'publisher') items.sort((a, b) => a.publisher.localeCompare(b.publisher) || a.series.localeCompare(b.series));
    return items;
  }

  function naturalIssue(item) {
    const n = parseInt(item.issue, 10);
    return isNaN(n) ? 0 : n;
  }

  function cardHTML(item) {
    const badge = isKeyIssue(item) ? '<span class="card-badge">KEY ISSUE</span>' : '';
    const priceRow = item.price
      ? buyNowFormHTML(item)
      : '<p class="card-price card-price-tbd">Price on request</p>';
    return `
      <article class="card" data-id="${item.id}">
        <div class="card-frame">
          <img src="${item.photo_url}" alt="${escapeHTML(item.title)}" loading="lazy">
          ${badge}
          <span class="card-corner cc-tl"></span>
          <span class="card-corner cc-tr"></span>
          <span class="card-corner cc-bl"></span>
          <span class="card-corner cc-br"></span>
        </div>
        <div class="card-body">
          <p class="card-file">FILE NO. ${item.sku}</p>
          <p class="card-title"><span class="card-issue">#${item.issue}</span> ${escapeHTML(item.series)}</p>
          <p class="card-meta">${escapeHTML(item.publisher)} · ${escapeHTML(item.grade || 'Ungraded')}</p>
          ${priceRow}
        </div>
      </article>`;
  }

  function buyNowFormHTML(item, size) {
    if (!item.price) return '';
    const btnClass = size === 'large' ? 'buy-now-btn buy-now-btn-lg' : 'buy-now-btn';
    return `
      <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank" class="buy-now-form" onclick="event.stopPropagation()">
        <input type="hidden" name="cmd" value="_xclick">
        <input type="hidden" name="business" value="${PAYPAL_BUSINESS_EMAIL}">
        <input type="hidden" name="item_name" value="${escapeHTML('#' + item.issue + ' ' + item.series)}">
        <input type="hidden" name="item_number" value="${escapeHTML(item.sku)}">
        <input type="hidden" name="amount" value="${escapeHTML(item.price)}">
        <input type="hidden" name="currency_code" value="USD">
        <input type="hidden" name="no_shipping" value="0">
        <input type="hidden" name="quantity" value="1">
        <button type="submit" class="${btnClass}">Buy now — $${escapeHTML(item.price)}</button>
      </form>`;
  }

  function escapeHTML(s) {
    return (s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function render() {
    const filtered = getFiltered();
    resultCount.textContent = filtered.length;
    emptyState.hidden = filtered.length > 0;
    const slice = filtered.slice(0, visibleCount);
    grid.innerHTML = slice.map(cardHTML).join('');
    loadMoreBtn.hidden = filtered.length <= visibleCount;
  }

  function openModal(item) {
    const priceBlock = item.price
      ? buyNowFormHTML(item, 'large')
      : '<p class="modal-price modal-price-tbd">Price on request — contact to purchase</p>';
    modal.innerHTML = `
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-grid">
        <img src="${item.photo_url}" alt="${escapeHTML(item.title)}">
        <div>
          <p class="modal-file">FILE NO. ${item.sku}</p>
          <h3 class="modal-title">#${item.issue} ${escapeHTML(item.series)}</h3>
          ${item.story_title ? `<p class="modal-story">${escapeHTML(item.story_title)}</p>` : ''}
          <table class="modal-specs">
            <tr><td>Publisher</td><td>${escapeHTML(item.publisher || '—')}</td></tr>
            <tr><td>Cover date</td><td>${escapeHTML(item.cover_date || '—')}</td></tr>
            <tr><td>Edition</td><td>${escapeHTML(item.edition || '—')}</td></tr>
            <tr><td>Story arc</td><td>${escapeHTML(item.story_arc || '—')}</td></tr>
            <tr><td>Grade</td><td>${escapeHTML(item.grade || '—')}</td></tr>
            <tr><td>Genre</td><td>${escapeHTML(item.genre || '—')}</td></tr>
            <tr><td>Format</td><td>${escapeHTML(item.format || '—')}</td></tr>
            <tr><td>UPC</td><td>${escapeHTML(item.upc || '—')}</td></tr>
          </table>
          ${item.synopsis ? `<p class="modal-synopsis">${escapeHTML(item.synopsis)}</p>` : ''}
          ${priceBlock}
        </div>
      </div>`;
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modalBackdrop.classList.add('open');
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    const item = INVENTORY.find(i => i.id === card.dataset.id);
    if (item) openModal(item);
  });

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  searchInput.addEventListener('input', () => { visibleCount = PAGE_SIZE; render(); });
  publisherSelect.addEventListener('change', () => { visibleCount = PAGE_SIZE; render(); });
  keySelect.addEventListener('change', () => { visibleCount = PAGE_SIZE; render(); });
  sortSelect.addEventListener('change', () => { visibleCount = PAGE_SIZE; render(); });
  loadMoreBtn.addEventListener('click', () => { visibleCount += PAGE_SIZE; render(); });

  function initStats() {
    document.getElementById('stock-count').textContent = INVENTORY.length;
    document.getElementById('stat-total').textContent = INVENTORY.length;
    document.getElementById('stat-pub').textContent = new Set(INVENTORY.map(i => i.publisher).filter(Boolean)).size;
    document.getElementById('stat-key').textContent = INVENTORY.filter(isKeyIssue).length;
  }

  populatePublishers();
  initStats();
  render();
})();

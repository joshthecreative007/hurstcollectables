(function () {
  const PAYPAL_BUSINESS_EMAIL = 'hurstdigital@gmail.com';

  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('search');
  const publisherSelect = document.getElementById('filter-publisher');
  const keySelect = document.getElementById('filter-key');
  const typeSelect = document.getElementById('filter-type');
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
    const typeFilter = typeSelect.value;
    let items = INVENTORY.filter(i =>
      matchesSearch(i, q) &&
      (!pub || i.publisher === pub) &&
      (!keyOnly || isKeyIssue(i)) &&
      (!typeFilter || (i.listing_type || 'raw') === typeFilter)
    );
    const sort = sortSelect.value;
    if (sort === 'series-asc') items.sort((a, b) => a.series.localeCompare(b.series) || naturalIssue(a) - naturalIssue(b));
    if (sort === 'series-desc') items.sort((a, b) => b.series.localeCompare(a.series));
    if (sort === 'publisher') items.sort((a, b) => a.publisher.localeCompare(b.publisher) || a.series.localeCompare(b.series));
    // books with a cover photo first; "cover pending" books go to the bottom (stable, keeps sort order)
    const withCover = items.filter(hasCover), noCover = items.filter(i => !hasCover(i));
    return withCover.concat(noCover);
  }

  function hasCover(item) {
    return !!item.photo_url && !item.photo_url.includes('cover-placeholder') && !brokenCovers.has(item.id);
  }
  // covers that fail to load are remembered so they sort to the bottom next time the list renders
  const brokenCovers = new Set();
  window.hcCoverFailed = function (img, id) {
    img.onerror = null; img.src = 'assets/cover-placeholder.svg';
    if (id) brokenCovers.add(id);
  };

  function naturalIssue(item) {
    const n = parseInt(item.issue, 10);
    return isNaN(n) ? 0 : n;
  }

  function cardHTML(item) {
    const isSlab = item.listing_type === 'slab';
    const badges = [];
    if (isSlab) badges.push('<span class="card-badge card-badge-slab">GRADED</span>');
    if (isKeyIssue(item)) badges.push(`<span class="card-badge${isSlab ? ' card-badge-key-2' : ''}">KEY ISSUE</span>`);
    const priceRow = item.price
      ? `<button class="buy-now-btn" data-add-to-cart="${item.id}">Add to cart — $${escapeHTML(item.price)}</button>`
      : '<p class="card-price card-price-tbd">Price on request</p>';
    const metaLine = isSlab
      ? `${escapeHTML(item.grading_company || 'Graded')} · ${escapeHTML(item.grade || '—')}`
      : `${escapeHTML(item.publisher)} · ${escapeHTML(item.grade || 'Ungraded')}`;
    return `
      <article class="card" data-id="${item.id}">
        <div class="card-frame">
          <img src="${item.photo_url}" referrerpolicy="no-referrer" onerror="hcCoverFailed(this,'${escapeHTML(item.id)}')" alt="${escapeHTML(item.title)}" loading="lazy">
          ${badges.join('')}
          <span class="card-corner cc-tl"></span>
          <span class="card-corner cc-tr"></span>
          <span class="card-corner cc-bl"></span>
          <span class="card-corner cc-br"></span>
        </div>
        <div class="card-body">
          <p class="card-file">FILE NO. ${item.sku}</p>
          <p class="card-title"><span class="card-issue">#${item.issue}</span> ${escapeHTML(item.series)}</p>
          <p class="card-meta">${metaLine}</p>
          ${priceRow}
        </div>
      </article>`;
  }

  // ---------- shopping cart ----------
  const CART_KEY = 'hurstcollectables_cart';
  const SHIPPING_TIERS = [
    { max: 3, cost: 5 },
    { max: 8, cost: 9 },
    { max: Infinity, cost: 15 },
  ];

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }
  // copies in stock for a listing (most books are one-of-a-kind)
  function stockOf(id) {
    const item = INVENTORY.find(i => i.id === id);
    return item ? Math.max(1, parseInt(item.quantity, 10) || 1) : 1;
  }
  let cart = loadCart()
    .filter(c => INVENTORY.some(i => i.id === c.id))
    .map(c => ({ ...c, qty: Math.min(Math.max(1, parseInt(c.qty, 10) || 1), stockOf(c.id)) }));
  const cartCount = () => cart.reduce((n, c) => n + c.qty, 0);
  const qtyInCart = id => (cart.find(c => c.id === id) || { qty: 0 }).qty;

  function addToCart(item, qty = 1) {
    const max = stockOf(item.id);
    const line = cart.find(c => c.id === item.id);
    if (line) {
      line.qty = Math.min(max, line.qty + qty);
    } else {
      cart.push({ id: item.id, sku: item.sku, title: `#${item.issue} ${item.series}`, price: item.price, photo_url: item.photo_url, qty: Math.min(max, Math.max(1, qty)) });
    }
    saveCart(cart);
    renderCart();
  }
  function setQty(id, qty) {
    const line = cart.find(c => c.id === id);
    if (!line) return;
    if (qty < 1) return removeFromCart(id);
    line.qty = Math.min(stockOf(id), qty);
    saveCart(cart);
    renderCart();
  }
  function removeFromCart(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart(cart);
    renderCart();
  }
  function isInCart(id) {
    return qtyInCart(id) >= stockOf(id); // every copy is already in the cart
  }
  // Holiday bundle deal — comics $9.99 and under.
  // 5+ eligible: 5% off paid eligible books, plus 11+: 1 free, 17+: 2 free, 23+: 3 free
  // (buy 10/15/20, get 1/2/3 free). Free books = lowest-priced eligible books.
  const BUNDLE_MAX_PRICE = 9.99;
  function bundleDeal(items) {
    const elig = items.filter(c => Number(c.price) > 0 && Number(c.price) <= BUNDLE_MAX_PRICE)
                      .flatMap(c => Array(c.qty || 1).fill(Number(c.price))).sort((a, b) => a - b);
    const n = elig.length;
    const free = n >= 23 ? 3 : n >= 17 ? 2 : n >= 11 ? 1 : 0;
    let discount = 0, label = '', nudge = '';
    if (n >= 5) {
      // free books first (cheapest), then 5% off the books still being paid for
      const freeValue = elig.slice(0, free).reduce((s, p) => s + p, 0);
      const paid = elig.slice(free).reduce((s, p) => s + p, 0);
      discount = freeValue + paid * 0.05;
      label = free ? `Bundle deal: ${free} free + 5% off` : 'Bundle deal: 5% off';
    }
    const next = [[5, 'and get 5% off'], [11, 'and get 1 FREE'], [17, 'and get 2 FREE'], [23, 'and get 3 FREE']].find(([t]) => n < t);
    if (next && n > 0) {
      const need = next[0] - n;
      nudge = (need === 1 && next[0] > 5)
        ? 'Add 1 more comic ($9.99 & under) — it\'s FREE'
        : `Add ${need} more comic${need > 1 ? 's' : ''} ($9.99 & under) ${next[1]}`;
    }
    return { discount: Math.round(discount * 100) / 100, label, nudge, eligible: n };
  }

  function shippingCost(count) {
    if (count === 0) return 0;
    const tier = SHIPPING_TIERS.find(t => count <= t.max);
    return tier.cost;
  }

  function cartRowHTML(c) {
    return `
      <div class="cart-row" data-id="${c.id}">
        <img src="${c.photo_url}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/cover-placeholder.svg'" alt="${escapeHTML(c.title)}">
        <div class="cart-row-info">
          <p class="cart-row-title">${escapeHTML(c.title)}</p>
          <p class="cart-row-price">$${Number(c.price).toFixed(2)}${c.qty > 1 ? ` × ${c.qty}` : ''}</p>
          ${stockOf(c.id) > 1 ? `<div class="cart-qty">
            <button data-qty-dec="${c.id}" aria-label="One fewer">−</button>
            <span>${c.qty}</span>
            <button data-qty-inc="${c.id}" aria-label="One more" ${c.qty >= stockOf(c.id) ? 'disabled' : ''}>+</button>
            <small>of ${stockOf(c.id)}</small>
          </div>` : ''}
          <button class="cart-row-remove" data-remove="${c.id}">Remove</button>
        </div>
      </div>`;
  }

  function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartEmptyEl = document.getElementById('cart-empty');
    const cartFooterEl = document.getElementById('cart-footer');
    const cartCountEl = document.getElementById('cart-count');
    const subtotal = cart.reduce((sum, c) => sum + Number(c.price || 0) * c.qty, 0);
    const shipping = shippingCost(cartCount());
    const deal = bundleDeal(cart);
    const total = subtotal - deal.discount + shipping;

    cartCountEl.textContent = cartCount();
    cartItemsEl.innerHTML = cart.map(cartRowHTML).join('');
    cartEmptyEl.style.display = cart.length === 0 ? 'block' : 'none';
    cartFooterEl.style.display = cart.length === 0 ? 'none' : 'block';
    document.getElementById('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    const dealLine = document.getElementById('cart-deal-line');
    dealLine.hidden = !deal.discount;
    document.getElementById('cart-deal-label').textContent = deal.label;
    document.getElementById('cart-deal').textContent = `−$${deal.discount.toFixed(2)}`;
    const nudgeEl = document.getElementById('cart-nudge');
    nudgeEl.textContent = deal.nudge;
    nudgeEl.hidden = !deal.nudge;
    document.getElementById('cart-shipping').textContent = `$${shipping.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

    // refresh any visible add-to-cart buttons so state (in cart / not) stays correct
    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      const id = btn.dataset.addToCart;
      const inCart = qtyInCart(id), stock = stockOf(id);
      if (inCart >= stock) {
        btn.textContent = 'In cart ✓';
        btn.disabled = true;
      } else if (inCart > 0) {
        const item = INVENTORY.find(i => i.id === id);
        btn.textContent = `Add another — $${item ? item.price : ''} (${inCart} of ${stock} in cart)`;
        btn.disabled = false;
      }
    });
  }

  function buildPaypalCartForm() {
    const form = document.getElementById('cart-checkout-form');
    form.innerHTML = '';
    const fields = {
      cmd: '_cart',
      upload: '1',
      business: PAYPAL_BUSINESS_EMAIL,
      currency_code: 'USD',
    };
    cart.forEach((c, i) => {
      const n = i + 1;
      fields[`item_name_${n}`] = c.title;
      fields[`item_number_${n}`] = c.sku;
      fields[`amount_${n}`] = c.price;
      fields[`quantity_${n}`] = String(c.qty);
    });
    // represent shipping as its own cart line item — the most reliable
    // cross-browser way to add a flat shipping charge to a PayPal cart upload
    const shipCost = shippingCost(cartCount());
    if (shipCost > 0) {
      const n = cart.length + 1;
      fields[`item_name_${n}`] = 'Shipping';
      fields[`item_number_${n}`] = 'SHIPPING';
      fields[`amount_${n}`] = shipCost.toFixed(2);
      fields[`quantity_${n}`] = '1';
    }
    const deal = bundleDeal(cart);
    if (deal.discount > 0) fields.discount_amount_cart = deal.discount.toFixed(2);
    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
  }

  function openCart() {
    renderCart();
    document.getElementById('cart-backdrop').classList.add('open');
  }
  function closeCart() {
    document.getElementById('cart-backdrop').classList.remove('open');
  }

  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('cart-close').addEventListener('click', closeCart);
  document.getElementById('cart-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'cart-backdrop') closeCart();
  });
  document.getElementById('cart-items').addEventListener('click', (e) => {
    const id = e.target.dataset.remove;
    if (id) return removeFromCart(id);
    const inc = e.target.dataset.qtyInc, dec = e.target.dataset.qtyDec;
    if (inc) setQty(inc, qtyInCart(inc) + 1);
    if (dec) setQty(dec, qtyInCart(dec) - 1);
  });
  document.getElementById('cart-checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) return;
    buildPaypalCartForm();
    document.getElementById('cart-checkout-form').submit();
  });

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
      ? `<button class="buy-now-btn buy-now-btn-lg" data-add-to-cart="${item.id}">Add to cart — $${escapeHTML(item.price)}</button>`
      : '<p class="modal-price modal-price-tbd">Price on request — contact to purchase</p>';
    modal.innerHTML = `
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-grid">
        <img src="${item.photo_url}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/cover-placeholder.svg'" alt="${escapeHTML(item.title)}">
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
            ${item.listing_type === 'slab' ? `
            <tr><td>Grading co.</td><td>${escapeHTML(item.grading_company || '—')}</td></tr>
            <tr><td>Cert number</td><td>${escapeHTML(item.cert_number || 'Available on request')}</td></tr>
            ` : ''}
            <tr><td>Genre</td><td>${escapeHTML(item.genre || '—')}</td></tr>
            <tr><td>Format</td><td>${escapeHTML(item.format || '—')}</td></tr>
            <tr><td>UPC</td><td>${escapeHTML(item.upc || '—')}</td></tr>
          </table>
          ${item.synopsis ? `<p class="modal-synopsis">${escapeHTML(item.synopsis)}</p>` : ''}
          ${stockOf(item.id) > 1 ? `<p class="modal-stock">${stockOf(item.id)} copies available</p>` : ''}
          ${priceBlock}
        </div>
      </div>`;
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    const modalAddBtn = modal.querySelector('[data-add-to-cart]');
    if (modalAddBtn) {
      modalAddBtn.addEventListener('click', () => {
        addToCart(item);
      });
    }
    modalBackdrop.classList.add('open');
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
  }

  grid.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.stopPropagation();
      const item = INVENTORY.find(i => i.id === addBtn.dataset.addToCart);
      if (item) addToCart(item);
      return;
    }
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
  typeSelect.addEventListener('change', () => { visibleCount = PAGE_SIZE; render(); });
  sortSelect.addEventListener('change', () => { visibleCount = PAGE_SIZE; render(); });
  loadMoreBtn.addEventListener('click', () => { visibleCount += PAGE_SIZE; render(); });

  function initStats() {
    document.getElementById('stock-count').textContent = INVENTORY.length;
    document.getElementById('stat-total').textContent = INVENTORY.length;
    document.getElementById('stat-pub').textContent = new Set(INVENTORY.map(i => i.publisher).filter(Boolean)).size;
    document.getElementById('stat-key').textContent = INVENTORY.filter(isKeyIssue).length;
    document.getElementById('stat-slabs').textContent = INVENTORY.filter(i => i.listing_type === 'slab').length;
  }

  populatePublishers();
  initStats();
  render();
  renderCart();

  // Deep links from Facebook / feeds: hurstcollectables.com/?book=<id> opens that book
  function openFromLink() {
    const params = new URLSearchParams(location.search);
    const id = params.get('book') || (location.hash.startsWith('#book-') ? decodeURIComponent(location.hash.slice(6)) : '');
    if (!id) return;
    const item = INVENTORY.find(i => i.id === id);
    if (item) {
      document.getElementById('catalog').scrollIntoView();
      openModal(item);
    }
  }
  openFromLink();
  window.addEventListener('hashchange', openFromLink);

  // Facebook/Instagram Shop checkout: /checkout?products=<id>:<qty>,<id>:<qty>
  // Adds those books to the cart and opens it so the shopper can pay with PayPal.
  function checkoutFromLink() {
    const raw = new URLSearchParams(location.search).get('products');
    if (!raw) return;
    cart = []; saveCart(cart); // the Facebook cart replaces whatever was here
    let added = 0;
    raw.split(',').forEach(part => {
      const entry = decodeURIComponent(part.trim());
      const cut = entry.lastIndexOf(':');
      const id = cut > 0 ? entry.slice(0, cut) : entry;
      const qty = cut > 0 ? parseInt(entry.slice(cut + 1), 10) || 1 : 1;
      const item = INVENTORY.find(i => i.id === id);
      if (item) { addToCart(item, qty); added++; }
    });
    history.replaceState(null, '', '/');
    if (added) openCart();
  }
  checkoutFromLink();
})();

(function () {
  const PAYPAL_BUSINESS_EMAIL = 'hurstdigital@gmail.com';

  // ---------- inventory: four departments ----------
  // data.js → INVENTORY (comics), toys.js → TOYS, cards.js → CARDS, games.js → GAMES
  const COMICS = INVENTORY;
  const TOY_LIST = (typeof TOYS !== 'undefined' && Array.isArray(TOYS)) ? TOYS : [];
  const CARD_LIST = (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) ? CARDS : [];
  const GAME_LIST = (typeof GAMES !== 'undefined' && Array.isArray(GAMES)) ? GAMES : [];
  COMICS.forEach(i => { i.dept = 'comics'; });
  TOY_LIST.forEach(i => { i.dept = 'toys'; i.id = i.id || `TOY-${i.sku}`; });
  CARD_LIST.forEach(i => { i.dept = 'cards'; i.id = i.id || `CARD-${i.sku}`; });
  GAME_LIST.forEach(i => { i.dept = 'games'; i.id = i.id || `GAME-${i.sku}`; });
  const ALL = COMICS.concat(TOY_LIST, CARD_LIST, GAME_LIST);
  const BY_ID = new Map(ALL.map(i => [i.id, i]));
  const byId = id => BY_ID.get(id);
  const LISTS = { comics: COMICS, toys: TOY_LIST, cards: CARD_LIST, games: GAME_LIST };

  const DEPTS = {
    comics: {
      title: 'Field catalog',
      sub: 'Filter the archive. Every listing below is a real book in hand — not a stock photo.',
    },
    toys: {
      title: 'Toy vault',
      sub: 'Action figures and collectibles, sealed and loose. Every piece photographed in hand.',
      incomingTitle: 'Toys are being cataloged now',
      incomingCopy: 'Figures and collectibles from the same 20-year archive are being photographed and priced. Follow Hurst Collectables to see the first drop the day it lands.',
    },
    cards: {
      title: 'Card room',
      sub: 'Trading cards, raw and graded. Front and back photographed for every card.',
      incomingTitle: 'Cards are being cataloged now',
      incomingCopy: 'Raw and graded trading cards are being sorted, scanned and priced. Follow Hurst Collectables to see the first drop the day it lands.',
    },
    games: {
      title: 'Game vault',
      sub: 'Graded video games: WATA-slabbed PS2, PS3 and PS4 titles, sealed and authenticated.',
      incomingTitle: 'Games are being cataloged now',
      incomingCopy: 'Graded video games are being photographed and priced. Follow Hurst Collectables to see the first drop the day it lands.',
    },
  };

  const grid = document.getElementById('grid');
  const searchInput = document.getElementById('search');
  const publisherSelect = document.getElementById('filter-publisher');
  const keySelect = document.getElementById('filter-key');
  const typeSelect = document.getElementById('filter-type');
  const sortSelect = document.getElementById('sort');
  const resultCount = document.getElementById('result-count');
  const resultLine = resultCount.parentElement;
  const emptyState = document.getElementById('empty-state');
  const incoming = document.getElementById('dept-incoming');
  const loadMoreBtn = document.getElementById('load-more');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modal = document.getElementById('modal');
  const $ = id => document.getElementById(id);

  const PAGE_SIZE = 40;
  let visibleCount = PAGE_SIZE;
  let dept = 'comics';

  const KEY_CATEGORY_WORDS = ['1st appearance', 'first appearance', 'origin', 'death', '1st full', '1st team', '1st cover'];

  function isKeyIssue(item) {
    if (item.dept !== 'comics') return false;
    const s = item.story_arc + ' ' + item.story_title;
    return KEY_CATEGORY_WORDS.some(w => s.toLowerCase().includes(w));
  }

  const yes = v => /^(y|yes|true|1)$/i.test(String(v || '').trim());
  const priceNum = i => Number(i.price) || 0;
  const uniqueSorted = (list, key) => Array.from(new Set(list.map(i => i[key]).filter(Boolean))).sort();

  function fillSelect(select, allLabel, values) {
    select.innerHTML = `<option value="">${allLabel}</option>` +
      values.map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('');
  }

  function populateFilters() {
    fillSelect(publisherSelect, 'All publishers', uniqueSorted(COMICS, 'publisher'));
    fillSelect($('toy-brand'), 'All brands', uniqueSorted(TOY_LIST, 'brand'));
    fillSelect($('toy-franchise'), 'All franchises', uniqueSorted(TOY_LIST, 'franchise'));
    fillSelect($('card-category'), 'All categories', uniqueSorted(CARD_LIST, 'category'));
    fillSelect($('game-platform'), 'All platforms', uniqueSorted(GAME_LIST, 'platform'));
  }

  function matches(item, q, fields) {
    if (!q) return true;
    return fields.map(f => item[f] || '').join(' ').toLowerCase().includes(q.toLowerCase());
  }

  // priced items before "price on request"; with-photo items before photo-pending
  function priceSort(items, dir) {
    const priced = items.filter(priceNum), unpriced = items.filter(i => !priceNum(i));
    priced.sort((a, b) => dir * (priceNum(a) - priceNum(b)));
    return priced.concat(unpriced);
  }

  function photosFirst(items) {
    const withCover = items.filter(hasCover), noCover = items.filter(i => !hasCover(i));
    return withCover.concat(noCover);
  }

  function getComics() {
    const q = searchInput.value.trim();
    const pub = publisherSelect.value;
    const keyOnly = keySelect.value === 'key';
    const typeFilter = typeSelect.value;
    let items = COMICS.filter(i =>
      matches(i, q, ['title', 'series', 'story_arc', 'story_title']) &&
      (!pub || i.publisher === pub) &&
      (!keyOnly || isKeyIssue(i)) &&
      (!typeFilter || (i.listing_type || 'raw') === typeFilter)
    );
    const sort = sortSelect.value;
    if (sort === 'series-asc') items.sort((a, b) => a.series.localeCompare(b.series) || naturalIssue(a) - naturalIssue(b));
    if (sort === 'series-desc') items.sort((a, b) => b.series.localeCompare(a.series));
    if (sort === 'publisher') items.sort((a, b) => a.publisher.localeCompare(b.publisher) || a.series.localeCompare(b.series));
    return photosFirst(items);
  }

  function getToys() {
    const q = $('toy-search').value.trim();
    const brand = $('toy-brand').value, fr = $('toy-franchise').value, pack = $('toy-pack').value;
    let items = TOY_LIST.filter(i =>
      matches(i, q, ['name', 'brand', 'line', 'franchise', 'character', 'year']) &&
      (!brand || i.brand === brand) &&
      (!fr || i.franchise === fr) &&
      (!pack || (i.packaging || '').toLowerCase().startsWith(pack.toLowerCase()))
    );
    const sort = $('toy-sort').value;
    if (sort === 'price-asc') items = priceSort(items, 1);
    if (sort === 'price-desc') items = priceSort(items, -1);
    if (sort === 'name') items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sort === 'year-desc') items.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
    return photosFirst(items);
  }

  function getCards() {
    const q = $('card-search').value.trim();
    const cat = $('card-category').value, type = $('card-type').value, flag = $('card-flag').value;
    let items = CARD_LIST.filter(i =>
      matches(i, q, ['name', 'set', 'year', 'team', 'parallel', 'card_number', 'category']) &&
      (!cat || i.category === cat) &&
      (!type || (type === 'graded') === isGradedCard(i)) &&
      (!flag || (flag === 'rookie' && yes(i.rookie)) || (flag === 'auto' && yes(i.auto)) || (flag === 'numbered' && !!i.serial))
    );
    const sort = $('card-sort').value;
    if (sort === 'price-asc') items = priceSort(items, 1);
    if (sort === 'price-desc') items = priceSort(items, -1);
    if (sort === 'year-desc') items.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
    if (sort === 'year-asc') items.sort((a, b) => (parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));
    return photosFirst(items);
  }

  const isGradedCard = i => !!(i.grading_company || '').trim();

  function getGames() {
    const q = $('game-search').value.trim();
    const plat = $('game-platform').value, type = $('game-type').value;
    let items = GAME_LIST.filter(i =>
      matches(i, q, ['title', 'platform', 'edition', 'year', 'grading_company']) &&
      (!plat || i.platform === plat) &&
      (!type || (type === 'graded') === isGradedCard(i))
    );
    const sort = $('game-sort').value;
    if (sort === 'price-asc') items = priceSort(items, 1);
    if (sort === 'price-desc') items = priceSort(items, -1);
    if (sort === 'name') items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return photosFirst(items);
  }

  function getFiltered() {
    return dept === 'toys' ? getToys() : dept === 'cards' ? getCards() : dept === 'games' ? getGames() : getComics();
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

  // ---------- display helpers shared by grid, modal and cart ----------
  function displayTitle(item) {
    if (item.dept === 'toys') return item.name || 'Untitled figure';
    if (item.dept === 'games') return [item.title, item.platform].filter(Boolean).join(' · ');
    if (item.dept === 'cards') {
      return [item.year, item.set, item.card_number ? `#${item.card_number}` : '', item.name].filter(Boolean).join(' ');
    }
    return item.issue ? `#${item.issue} ${item.series}` : item.series;
  }

  function photosOf(item) {
    const extra = (item.photo_urls || '').split('|').map(s => s.trim()).filter(Boolean);
    const back = item.back_photo_url ? [item.back_photo_url] : [];
    return [item.photo_url].filter(Boolean).concat(back, extra);
  }

  function priceButton(item, large) {
    return item.price
      ? `<button class="buy-now-btn${large ? ' buy-now-btn-lg' : ''}" data-add-to-cart="${item.id}">Add to cart — $${escapeHTML(item.price)}</button>`
      : (large
        ? '<p class="modal-price modal-price-tbd">Price on request — contact to purchase</p>'
        : '<p class="card-price card-price-tbd">Price on request</p>');
  }

  function frameHTML(item, badges) {
    const src = item.photo_url || 'assets/cover-placeholder.svg';
    return `
        <div class="card-frame card-frame-${item.dept}">
          <img src="${escapeHTML(src)}" referrerpolicy="no-referrer" onerror="hcCoverFailed(this,'${escapeHTML(item.id)}')" alt="${escapeHTML(displayTitle(item))}" loading="lazy">
          <div class="card-badges">${badges.join('')}</div>
          <span class="card-corner cc-tl"></span>
          <span class="card-corner cc-tr"></span>
          <span class="card-corner cc-bl"></span>
          <span class="card-corner cc-br"></span>
        </div>`;
  }

  function comicCardHTML(item) {
    const isSlab = item.listing_type === 'slab';
    const badges = [];
    if (isSlab) badges.push('<span class="card-badge card-badge-slab">GRADED</span>');
    if (isKeyIssue(item)) badges.push('<span class="card-badge">KEY ISSUE</span>');
    const metaLine = isSlab
      ? `${escapeHTML(item.grading_company || 'Graded')} · ${escapeHTML(item.grade || '—')}`
      : `${escapeHTML(item.publisher)} · ${escapeHTML(item.grade || 'Ungraded')}`;
    return `
      <article class="card" data-id="${item.id}">
        ${frameHTML(item, badges)}
        <div class="card-body">
          <p class="card-file">FILE NO. ${escapeHTML(item.sku)}</p>
          <p class="card-title">${item.issue ? `<span class="card-issue">#${escapeHTML(item.issue)}</span> ` : ''}${escapeHTML(item.series)}</p>
          <p class="card-meta">${metaLine}</p>
          ${priceButton(item)}
        </div>
      </article>`;
  }

  function toyCardHTML(item) {
    const sealed = /^sealed/i.test(item.packaging || '');
    const badges = [];
    if (item.packaging) badges.push(`<span class="card-badge${sealed ? ' card-badge-slab' : ''}">${sealed ? 'SEALED' : 'LOOSE'}</span>`);
    if (!sealed && /complete/i.test(item.completeness || '')) badges.push('<span class="card-badge">COMPLETE</span>');
    const meta = [item.brand, item.line].filter(Boolean).map(escapeHTML).join(' · ');
    return `
      <article class="card card-toy" data-id="${item.id}">
        ${frameHTML(item, badges)}
        <div class="card-body">
          <p class="card-file">${escapeHTML([item.franchise, item.year].filter(Boolean).join(' · ').toUpperCase() || 'TOY FILE ' + item.sku)}</p>
          <p class="card-title">${escapeHTML(item.name)}</p>
          <p class="card-meta">${meta || '&nbsp;'}</p>
          ${priceButton(item)}
        </div>
      </article>`;
  }

  function tradingCardHTML(item) {
    const graded = isGradedCard(item);
    const badges = [];
    if (graded) badges.push(`<span class="card-badge card-badge-slab">${escapeHTML(item.grading_company)} ${escapeHTML(item.grade || '')}</span>`);
    if (yes(item.rookie)) badges.push('<span class="card-badge">RC</span>');
    if (yes(item.auto)) badges.push('<span class="card-badge card-badge-auto">AUTO</span>');
    if (item.serial) badges.push(`<span class="card-badge">#/${escapeHTML(String(item.serial).split('/').pop())}</span>`);
    const meta = [item.parallel || item.team, graded ? '' : (item.condition || 'Raw')].filter(Boolean).map(escapeHTML).join(' · ');
    return `
      <article class="card card-tc" data-id="${item.id}">
        ${frameHTML(item, badges)}
        <div class="card-body">
          <p class="card-file">${escapeHTML([item.year, item.set].filter(Boolean).join(' ').toUpperCase())}${item.card_number ? ` · #${escapeHTML(item.card_number)}` : ''}</p>
          <p class="card-title">${escapeHTML(item.name)}</p>
          <p class="card-meta">${meta || '&nbsp;'}</p>
          ${priceButton(item)}
        </div>
      </article>`;
  }

  function gameCardHTML(item) {
    const graded = isGradedCard(item);
    const badges = [];
    if (graded) badges.push(`<span class="card-badge card-badge-slab">${escapeHTML(item.grading_company)} ${escapeHTML(item.grade || '')}${item.seal_rating ? ' ' + escapeHTML(item.seal_rating) : ''}</span>`);
    if (/black label/i.test(item.edition || '')) badges.push('<span class="card-badge">BLACK LABEL</span>');
    const meta = [item.edition, graded ? '' : (item.condition || '')].filter(Boolean).map(escapeHTML).join(' · ');
    return `
      <article class="card card-game" data-id="${item.id}">
        ${frameHTML(item, badges)}
        <div class="card-body">
          <p class="card-file">${escapeHTML([item.platform, item.year].filter(Boolean).join(' · ').toUpperCase() || 'GAME FILE ' + item.sku)}</p>
          <p class="card-title">${escapeHTML(item.title)}</p>
          <p class="card-meta">${meta || '&nbsp;'}</p>
          ${priceButton(item)}
        </div>
      </article>`;
  }

  function cardHTML(item) {
    return item.dept === 'toys' ? toyCardHTML(item) : item.dept === 'cards' ? tradingCardHTML(item)
      : item.dept === 'games' ? gameCardHTML(item) : comicCardHTML(item);
  }

  // ---------- shopping cart ----------
  const CART_KEY = 'hurstcollectables_cart';
  // comics and cards (flat mailers) share these tiers; toys and games ship boxed with their own per-item rate
  const SHIPPING_TIERS = [
    { max: 3, cost: 5 },
    { max: 8, cost: 9 },
    { max: Infinity, cost: 15 },
  ];
  const DEFAULT_TOY_SHIPPING = 10;

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveCart(cart) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* private mode */ }
  }
  // copies in stock for a listing (most items are one-of-a-kind)
  // listings with hide_stock = Y never show how many are in stock (checkout still allows more than one)
  const stockHidden = id => { const item = byId(id); return !!item && yes(item.hide_stock); };

  function stockOf(id) {
    const item = byId(id);
    return item ? Math.max(1, parseInt(item.quantity, 10) || 1) : 1;
  }
  let cart = loadCart()
    .filter(c => BY_ID.has(c.id))
    .map(c => ({ ...c, dept: byId(c.id).dept, qty: Math.min(Math.max(1, parseInt(c.qty, 10) || 1), stockOf(c.id)) }));
  const cartCount = () => cart.reduce((n, c) => n + c.qty, 0);
  const qtyInCart = id => (cart.find(c => c.id === id) || { qty: 0 }).qty;

  function addToCart(item, qty = 1) {
    $('cart-paid').hidden = true;
    const max = stockOf(item.id);
    const line = cart.find(c => c.id === item.id);
    if (line) {
      line.qty = Math.min(max, line.qty + qty);
    } else {
      cart.push({ id: item.id, sku: item.sku, dept: item.dept, title: displayTitle(item), price: item.price, photo_url: item.photo_url, qty: Math.min(max, Math.max(1, qty)) });
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

  // Holiday bundle deal — comics $9.99 and under (toys and cards are not included).
  // 5+ eligible: 5% off paid eligible books, plus 11+: 1 free, 17+: 2 free, 23+: 3 free
  // (buy 10/15/20, get 1/2/3 free). Free books = lowest-priced eligible books.
  const BUNDLE_MAX_PRICE = 9.99;
  function bundleDeal(items) {
    const elig = items.filter(c => (c.dept || 'comics') === 'comics' && Number(c.price) > 0 && Number(c.price) <= BUNDLE_MAX_PRICE)
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

  function shippingCost(items) {
    const boxed = c => c.dept === 'toys' || c.dept === 'games';
    const flatCount = items.filter(c => !boxed(c)).reduce((n, c) => n + c.qty, 0);
    const flat = flatCount === 0 ? 0 : SHIPPING_TIERS.find(t => flatCount <= t.max).cost;
    // toys and games ship boxed: each carries its own rate (the CSV "shipping" column), default $10
    const toys = items.filter(boxed).reduce((sum, c) => {
      const item = byId(c.id);
      const rate = item && item.shipping !== undefined && item.shipping !== '' ? Number(item.shipping) : DEFAULT_TOY_SHIPPING;
      return sum + (isNaN(rate) ? DEFAULT_TOY_SHIPPING : rate) * c.qty;
    }, 0);
    return flat + toys;
  }

  function cartRowHTML(c) {
    return `
      <div class="cart-row cart-row-${c.dept || 'comics'}" data-id="${c.id}">
        <img src="${escapeHTML(c.photo_url || 'assets/cover-placeholder.svg')}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/cover-placeholder.svg'" alt="${escapeHTML(c.title)}">
        <div class="cart-row-info">
          <p class="cart-row-title">${escapeHTML(c.title)}</p>
          <p class="cart-row-price">$${Number(c.price).toFixed(2)}${c.qty > 1 ? ` × ${c.qty}` : ''}</p>
          ${stockOf(c.id) > 1 ? `<div class="cart-qty">
            <button data-qty-dec="${c.id}" aria-label="One fewer">−</button>
            <span>${c.qty}</span>
            <button data-qty-inc="${c.id}" aria-label="One more" ${c.qty >= stockOf(c.id) ? 'disabled' : ''}>+</button>
            ${stockHidden(c.id) ? '' : `<small>of ${stockOf(c.id)}</small>`}
          </div>` : ''}
          <button class="cart-row-remove" data-remove="${c.id}">Remove</button>
        </div>
      </div>`;
  }

  function renderCart() {
    const subtotal = cart.reduce((sum, c) => sum + Number(c.price || 0) * c.qty, 0);
    const shipping = shippingCost(cart);
    const deal = bundleDeal(cart);
    const total = subtotal - deal.discount + shipping;

    $('cart-count').textContent = cartCount();
    $('cart-items').innerHTML = cart.map(cartRowHTML).join('');
    $('cart-empty').style.display = cart.length === 0 ? 'block' : 'none';
    $('cart-footer').style.display = cart.length === 0 ? 'none' : 'block';
    $('cart-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    $('cart-deal-line').hidden = !deal.discount;
    $('cart-deal-label').textContent = deal.label;
    $('cart-deal').textContent = `−$${deal.discount.toFixed(2)}`;
    $('cart-nudge').textContent = deal.nudge;
    $('cart-nudge').hidden = !deal.nudge;
    $('cart-shipping').textContent = `$${shipping.toFixed(2)}`;
    $('cart-total').textContent = `$${total.toFixed(2)}`;
    $('paypal-buttons').style.display = cart.length === 0 ? 'none' : '';

    // refresh any visible add-to-cart buttons so state (in cart / not) stays correct
    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      const id = btn.dataset.addToCart;
      const inCart = qtyInCart(id), stock = stockOf(id);
      if (inCart >= stock) {
        btn.textContent = 'In cart ✓';
        btn.disabled = true;
      } else if (inCart > 0) {
        const item = byId(id);
        btn.textContent = `Add another — $${item ? item.price : ''} (${stockHidden(id) ? inCart : `${inCart} of ${stock}`} in cart)`;
        btn.disabled = false;
      }
    });
  }

  function buildPaypalCartForm() {
    const form = $('cart-checkout-form');
    form.innerHTML = '';
    const fields = {
      cmd: '_cart',
      upload: '1',
      business: PAYPAL_BUSINESS_EMAIL,
      currency_code: 'USD',
      // open PayPal on the guest card form instead of the PayPal login
      landing_page: 'billing',
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
    const shipCost = shippingCost(cart);
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
    $('cart-backdrop').classList.add('open');
  }
  function closeCart() {
    $('cart-backdrop').classList.remove('open');
  }

  $('cart-btn').addEventListener('click', openCart);
  $('cart-close').addEventListener('click', closeCart);
  $('cart-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'cart-backdrop') closeCart();
  });
  $('cart-items').addEventListener('click', (e) => {
    const id = e.target.dataset.remove;
    if (id) return removeFromCart(id);
    const inc = e.target.dataset.qtyInc, dec = e.target.dataset.qtyDec;
    if (inc) setQty(inc, qtyInCart(inc) + 1);
    if (dec) setQty(dec, qtyInCart(dec) - 1);
  });
  $('cart-checkout-btn').addEventListener('click', () => {
    if (cart.length === 0) return;
    buildPaypalCartForm();
    $('cart-checkout-form').submit();
  });

  // ---------- PayPal Smart Buttons (PayPal, Venmo, Pay Later, debit/credit card) ----------
  // Client ID is public by design. If the SDK fails to load, the classic
  // "Secure checkout" button above keeps working as a fallback.
  const PAYPAL_CLIENT_ID = 'BAAWQbjEIgk7NqgaYaN5I4U82ZjwH8f4NmLV0a9p78jEW5WPdX5M2USuL-cKwxFcPTPWPLawJPiSFf6HJo';
  const money = n => (Math.round(n * 100) / 100).toFixed(2);

  function paypalOrder() {
    const items = cart.map(c => ({
      name: String(c.title).slice(0, 127),
      sku: String(c.sku || c.id).slice(0, 127),
      unit_amount: { currency_code: 'USD', value: money(Number(c.price)) },
      quantity: String(c.qty),
      category: 'PHYSICAL_GOODS',
    }));
    const itemTotal = cart.reduce((s, c) => s + Number(money(Number(c.price))) * c.qty, 0);
    const shipping = shippingCost(cart);
    const discount = bundleDeal(cart).discount;
    const total = itemTotal + shipping - discount;
    return {
      intent: 'CAPTURE',
      purchase_units: [{
        description: 'Hurst Collectables order',
        amount: {
          currency_code: 'USD',
          value: money(total),
          breakdown: {
            item_total: { currency_code: 'USD', value: money(itemTotal) },
            shipping: { currency_code: 'USD', value: money(shipping) },
            discount: { currency_code: 'USD', value: money(discount) },
          },
        },
        items,
      }],
    };
  }

  function showPaid(msg, withFollow) {
    const el = $('cart-paid');
    el.textContent = msg;
    if (withFollow) {
      const a = document.createElement('a');
      a.href = 'https://www.ebay.com/usr/wolfgangart';
      a.target = '_blank'; a.rel = 'noopener';
      a.textContent = 'Follow us on eBay';
      el.append(document.createElement('br'), document.createElement('br'), 'Want first dibs on new books? ', a, '.');
    }
    el.hidden = false;
  }

  function initPaypalButtons() {
    if (!window.paypal || !window.paypal.Buttons) return;
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
      createOrder: (data, actions) => actions.order.create(paypalOrder()),
      onApprove: (data, actions) => actions.order.capture().then(details => {
        const name = (details && details.payer && details.payer.name && details.payer.name.given_name) || '';
        cart = [];
        saveCart(cart);
        renderCart();
        $('cart-footer').style.display = 'block';
        showPaid(`Thank you${name ? ', ' + name : ''}! Your payment went through and a receipt is on its way to your email. We ship within 2 business days.`, true);
      }),
      onError: () => showPaid('Something went wrong with checkout. Please try again, or message us on Facebook and we will sort it out.'),
    }).render('#paypal-buttons').then(() => {
      $('cart-checkout-btn').style.display = 'none';
      $('cart-pay-options').innerHTML = 'Pay with <strong>PayPal, Venmo, Pay Later</strong> or <strong>debit/credit card</strong> (no PayPal account needed).';
    }).catch(() => { /* keep the classic checkout button */ });
  }

  (function loadPaypalSdk() {
    const s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(PAYPAL_CLIENT_ID) +
            '&currency=USD&intent=capture&components=buttons&enable-funding=venmo,paylater,card';
    s.async = true;
    s.onload = initPaypalButtons;
    document.head.appendChild(s);
  })();

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---------- departments ----------
  function setDept(next, opts = {}) {
    if (!LISTS[next]) next = 'comics';
    const changed = next !== dept;
    dept = next;
    visibleCount = PAGE_SIZE;
    document.querySelectorAll('.dept-tab').forEach(t => {
      const on = t.dataset.dept === dept;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-dept-link]').forEach(a => a.classList.toggle('active', a.dataset.deptLink === dept));
    document.querySelectorAll('[data-controls]').forEach(c => { c.hidden = c.dataset.controls !== dept; });
    $('dept-title').textContent = DEPTS[dept].title;
    $('dept-sub').textContent = DEPTS[dept].sub;
    grid.className = `grid grid-${dept}`;
    render();
    if (opts.scroll) document.getElementById('catalog').scrollIntoView({ behavior: changed ? 'smooth' : 'auto' });
  }

  function render() {
    const total = LISTS[dept].length;
    const isIncoming = total === 0;
    incoming.hidden = !isIncoming;
    if (isIncoming) {
      $('incoming-title').textContent = DEPTS[dept].incomingTitle;
      $('incoming-copy').textContent = DEPTS[dept].incomingCopy;
    }
    document.querySelectorAll('[data-controls]').forEach(c => { c.hidden = c.dataset.controls !== dept || isIncoming; });
    resultLine.hidden = isIncoming;
    const filtered = isIncoming ? [] : getFiltered();
    resultCount.textContent = filtered.length;
    emptyState.hidden = isIncoming || filtered.length > 0;
    grid.innerHTML = filtered.slice(0, visibleCount).map(cardHTML).join('');
    loadMoreBtn.hidden = filtered.length <= visibleCount;
    renderCart();
  }

  // ---------- detail modal ----------
  const row = (label, value) => value ? `<tr><td>${label}</td><td>${escapeHTML(value)}</td></tr>` : '';

  function specsFor(item) {
    if (item.dept === 'toys') {
      return [
        row('Brand', item.brand), row('Line', item.line), row('Franchise', item.franchise),
        row('Character', item.character), row('Year', item.year), row('Scale', item.scale),
        row('Packaging', item.packaging), row('Completeness', item.completeness), row('Condition', item.condition),
      ].join('');
    }
    if (item.dept === 'games') {
      const graded = isGradedCard(item);
      return [
        row('Title', item.title), row('Platform', item.platform), row('Edition', item.edition), row('Year', item.year),
        graded ? row('Grading co.', item.grading_company) : row('Condition', item.condition),
        graded ? row('Grade', item.grade) : '', graded ? row('Seal rating', item.seal_rating) : '',
        graded ? row('Cert number', item.cert_number || 'Available on request') : '',
      ].join('');
    }
    if (item.dept === 'cards') {
      const graded = isGradedCard(item);
      return [
        row('Year', item.year), row('Set', item.set), row('Card no.', item.card_number),
        row('Name', item.name), row('Team', item.team), row('Category', item.category),
        row('Parallel', item.parallel), row('Serial no.', item.serial),
        row('Rookie card', yes(item.rookie) ? 'Yes' : ''), row('Autograph', yes(item.auto) ? 'Yes' : ''),
        graded ? row('Grading co.', item.grading_company) : row('Condition', item.condition || 'Raw'),
        graded ? row('Grade', item.grade) : '',
        graded ? row('Cert number', item.cert_number || 'Available on request') : '',
      ].join('');
    }
    return `
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
      <tr><td>UPC</td><td>${escapeHTML(item.upc || '—')}</td></tr>`;
  }

  function openModal(item) {
    const photos = photosOf(item);
    const main = photos[0] || 'assets/cover-placeholder.svg';
    const thumbLabels = item.dept === 'cards' && item.back_photo_url ? ['Front', 'Back'] : [];
    const thumbs = photos.length > 1
      ? `<div class="modal-thumbs">${photos.map((p, i) => `<button class="modal-thumb${i === 0 ? ' active' : ''}" data-src="${escapeHTML(p)}" aria-label="View photo ${i + 1}"><img src="${escapeHTML(p)}" referrerpolicy="no-referrer" alt="">${thumbLabels[i] ? `<span>${thumbLabels[i]}</span>` : ''}</button>`).join('')}</div>`
      : '';
    const fileLine = item.dept === 'comics' ? `FILE NO. ${escapeHTML(item.sku)}`
      : item.dept === 'toys' ? `TOY FILE ${escapeHTML(item.sku)}` : item.dept === 'games' ? `GAME FILE ${escapeHTML(item.sku)}` : `CARD FILE ${escapeHTML(item.sku)}`;
    const subLine = item.dept === 'comics' ? item.story_title
      : item.dept === 'toys' ? [item.brand, item.line].filter(Boolean).join(' · ')
      : item.dept === 'games' ? [item.platform, item.edition].filter(Boolean).join(' · ')
      : [item.year, item.set].filter(Boolean).join(' ');
    const notes = item.dept === 'comics' ? item.synopsis : item.description;
    modal.innerHTML = `
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-grid modal-grid-${item.dept}">
        <div class="modal-media">
          <div class="modal-photo modal-photo-${item.dept}"><img id="modal-main" src="${escapeHTML(main)}" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/cover-placeholder.svg'" alt="${escapeHTML(displayTitle(item))}"></div>
          ${thumbs}
        </div>
        <div>
          <p class="modal-file">${fileLine}</p>
          <h3 class="modal-title">${escapeHTML(item.dept === 'comics' ? displayTitle(item) : item.dept === 'games' ? item.title : item.name)}</h3>
          ${subLine ? `<p class="modal-story">${escapeHTML(subLine)}</p>` : ''}
          <table class="modal-specs">${specsFor(item)}</table>
          ${notes ? `<p class="modal-synopsis">${escapeHTML(notes)}</p>` : ''}
          ${stockOf(item.id) > 1 && !stockHidden(item.id) ? `<p class="modal-stock">${stockOf(item.id)} available</p>` : ''}
          ${priceButton(item, true)}
        </div>
      </div>`;
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelectorAll('.modal-thumb').forEach(btn => btn.addEventListener('click', () => {
      modal.querySelectorAll('.modal-thumb').forEach(b => b.classList.toggle('active', b === btn));
      $('modal-main').src = btn.dataset.src;
    }));
    const modalAddBtn = modal.querySelector('[data-add-to-cart]');
    if (modalAddBtn) modalAddBtn.addEventListener('click', () => addToCart(item));
    renderCart();
    modalBackdrop.classList.add('open');
  }

  function closeModal() {
    modalBackdrop.classList.remove('open');
  }

  grid.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-add-to-cart]');
    if (addBtn) {
      e.stopPropagation();
      const item = byId(addBtn.dataset.addToCart);
      if (item) addToCart(item);
      return;
    }
    const card = e.target.closest('.card');
    if (!card) return;
    const item = byId(card.dataset.id);
    if (item) openModal(item);
  });

  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  const reset = () => { visibleCount = PAGE_SIZE; render(); };
  [searchInput, $('toy-search'), $('card-search'), $('game-search')].forEach(el => el.addEventListener('input', reset));
  [publisherSelect, keySelect, typeSelect, sortSelect,
   $('toy-brand'), $('toy-franchise'), $('toy-pack'), $('toy-sort'),
   $('card-category'), $('card-type'), $('card-flag'), $('card-sort'),
   $('game-platform'), $('game-type'), $('game-sort')].forEach(el => el.addEventListener('change', reset));
  loadMoreBtn.addEventListener('click', () => { visibleCount += PAGE_SIZE; render(); });

  // department tabs, nav links and "shop comics now" buttons
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.dept-tab, [data-dept-link], .incoming [data-dept]');
    if (!el) return;
    e.preventDefault();
    const next = el.dataset.dept || el.dataset.deptLink;
    history.replaceState(null, '', next === 'comics' ? '#catalog' : `#${next}`);
    setDept(next, { scroll: !el.classList.contains('dept-tab') });
  });

  function initStats() {
    $('stock-count').textContent = ALL.length;
    Object.entries(LISTS).forEach(([d, list]) => {
      const el = document.querySelector(`[data-dept-count="${d}"]`);
      if (el) el.textContent = list.length ? list.length.toLocaleString() : 'Coming soon';
    });
  }

  populateFilters();
  initStats();
  const startDept = ({ '#toys': 'toys', '#cards': 'cards', '#games': 'games', '#comics': 'comics' })[location.hash] || 'comics';
  setDept(startDept, { scroll: startDept !== 'comics' });

  // Deep links from Facebook / feeds: hurstcollectables.com/?book=<id> (or ?item=<id>) opens that item
  function openFromLink() {
    const params = new URLSearchParams(location.search);
    const id = params.get('book') || params.get('item') ||
      (location.hash.startsWith('#book-') ? decodeURIComponent(location.hash.slice(6)) : '');
    if (!id) {
      const d = ({ '#toys': 'toys', '#cards': 'cards', '#games': 'games', '#comics': 'comics' })[location.hash];
      if (d && d !== dept) setDept(d, { scroll: true });
      return;
    }
    const item = byId(id);
    if (item) {
      if (item.dept !== dept) setDept(item.dept);
      $('catalog').scrollIntoView();
      openModal(item);
    }
  }
  openFromLink();
  window.addEventListener('hashchange', openFromLink);

  // Facebook/Instagram Shop checkout: /checkout?products=<id>:<qty>,<id>:<qty>
  // Adds those items to the cart and opens it so the shopper can pay with PayPal.
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
      const item = byId(id);
      if (item) { addToCart(item, qty); added++; }
    });
    history.replaceState(null, '', '/');
    if (added) openCart();
  }
  checkoutFromLink();
})();

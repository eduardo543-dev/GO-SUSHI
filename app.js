'use strict';

const app = $('#app');

const state = {
  query: '', category: 'Todos', sort: 'Mais vendidos', maxPrice: 150, promoOnly: false,
  profileTab: 'Dados pessoais', payment: 'Pix', checkoutAddr: null,
  modal: null, modalQty: 1, lastFocus: null,
  orderFilter: { q: '', status: 'Todos', period: '90' },
};

const Theme = {
  pref() { return DB.read('theme', 'system'); },
  isDark() {
    const p = this.pref();
    return p === 'dark' || (p === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  },
  apply() {
    const dark = this.isDark();
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#121110' : '#fffdfa');
  },
  set(p) { DB.write('theme', p); this.apply(); },
  toggle() { this.set(this.isDark() ? 'light' : 'dark'); },
};

function themeBtn(extra) {
  const dark = Theme.isDark();
  const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
  return '<button type="button" class="icon-btn ' + (extra || '') + '" data-action="theme" aria-label="' + label + '" title="' + label + '">' + icon(dark ? 'sun' : 'moon') + '</button>';
}
function refreshThemeButtons() {
  const dark = Theme.isDark();
  const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
  $$('[data-action="theme"]').forEach((b) => { b.innerHTML = icon(dark ? 'sun' : 'moon'); b.setAttribute('aria-label', label); b.title = label; });
}

function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 3600);
}

const Cart = {
  raw() { return DB.read('cart', []); },
  save(l) { DB.write('cart', l); },
  lines() {
    return this.raw().map((l) => {
      const p = PRODUCTS.find((x) => x.id === l.id);
      if (!p) return null;
      const extra = (l.addons || []).reduce((s, a) => s + a.price, 0);
      return Object.assign({}, l, { product: p, unit: round2(p.price + extra) });
    }).filter(Boolean);
  },
  count() { return this.raw().reduce((s, l) => s + l.qty, 0); },
  add(id, qty, addons, notes) {
    addons = addons || []; notes = notes || '';
    const key = [id, addons.map((a) => a.name).sort().join('+'), notes].join('|');
    const list = this.raw();
    const found = list.find((x) => x.key === key);
    if (found) found.qty = Math.min(99, found.qty + (qty || 1));
    else list.push({ key, id, qty: qty || 1, addons, notes });
    this.save(list);
  },
  change(key, d) {
    const list = this.raw();
    const l = list.find((x) => x.key === key);
    if (l) l.qty = Math.max(1, Math.min(99, l.qty + d));
    this.save(list);
  },
  remove(key) { this.save(this.raw().filter((x) => x.key !== key)); },
  clear() { this.save([]); },
};

function totals() {
  const lines = Cart.lines();
  const subtotal = round2(lines.reduce((s, l) => s + l.unit * l.qty, 0));
  const coupon = DB.read('coupon', null);
  const discount = coupon && COUPONS[coupon] && subtotal ? round2(subtotal * COUPONS[coupon].pct) : 0;
  const delivery = subtotal ? DELIVERY_FEE : 0;
  return { lines, subtotal, coupon: discount ? coupon : null, discount, delivery, total: round2(subtotal - discount + delivery) };
}

function refreshCart() {
  const n = Cart.count();
  $$('[data-cart-count]').forEach((e) => { e.textContent = n; });
  $$('[data-cart-link]').forEach((e) => e.setAttribute('aria-label', 'Carrinho com ' + n + (n === 1 ? ' item' : ' itens')));
}

const lineDesc = (l) => {
  const parts = [];
  if (l.product.pieces) parts.push(l.product.pieces + ' peças');
  if (l.addons && l.addons.length) parts.push('+ ' + l.addons.map((a) => a.name).join(', '));
  if (l.notes) parts.push('Obs.: ' + l.notes);
  return parts.length ? parts.join(' • ') : l.product.description;
};

const TITLES = { home: 'Delivery de comida japonesa', menu: 'Cardápio', cart: 'Carrinho', checkout: 'Finalizar pedido', orders: 'Meus pedidos', profile: 'Meu perfil', register: 'Criar conta', confirmacao: 'Pedido confirmado' };

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  return { name: parts[0] || 'home', param: parts[1] || '' };
}
function navigate(name) {
  if (parseRoute().name === name) render();
  else location.hash = '#/' + name;
}

function logo() {
  return '<a class="logo" href="#/home" aria-label="GoSushi - início"><span class="logo-mark"><span></span></span><strong>Go<span>Sushi</span></strong></a>';
}

function field(o) {
  const a = ['id="' + o.id + '"', 'name="' + (o.name || o.id) + '"', 'type="' + (o.type || 'text') + '"'];
  if (o.mask) a.push('data-mask="' + o.mask + '"');
  if (o.validate) a.push('data-validate="' + o.validate + '"');
  if (o.maxlength) a.push('maxlength="' + o.maxlength + '"');
  if (o.inputmode) a.push('inputmode="' + o.inputmode + '"');
  if (o.autocomplete) a.push('autocomplete="' + o.autocomplete + '"');
  if (o.placeholder) a.push('placeholder="' + esc(o.placeholder) + '"');
  if (o.required !== false) a.push('required');
  if (o.readonly) a.push('readonly');
  if (o.attrs) a.push(o.attrs);
  const val = o.mask ? maskValue(o.mask, o.value) : (o.value || '');
  a.push('value="' + esc(val) + '"');
  return '<label class="field"><span class="lbl">' + o.label + (o.required === false ? ' <em>(opcional)</em>' : '') + '</span><input ' + a.join(' ') + '><small class="err" role="alert"></small></label>';
}

function passField(o) {
  const validate = o.validate === undefined ? 'password' : o.validate;
  return '<label class="field"><span class="lbl">' + o.label + '</span><span class="password">' +
    '<input id="' + o.id + '" name="' + o.name + '" type="password" data-pass maxlength="32" required autocomplete="' + (o.autocomplete || 'off') + '" placeholder="' + esc(o.placeholder || '') + '"' +
    (validate ? ' data-validate="' + validate + '"' : '') + (o.match ? ' data-match="' + o.match + '"' : '') + (o.strength ? ' data-strength' : '') + '>' +
    '<button type="button" data-action="toggle-pass" aria-label="Mostrar senha">' + icon('eye') + '</button></span>' +
    (o.strength ? '<span class="strength" aria-hidden="true"><i data-s="0"></i></span>' : '') +
    '<small class="err" role="alert"></small></label>';
}

function addressFields(p, v) {
  v = v || {};
  const labels = ['Casa', 'Trabalho', 'Outro'].map((l) => '<option' + (v.label === l ? ' selected' : '') + '>' + l + '</option>').join('');
  return '<div class="form-row">' +
    '<label class="field"><span class="lbl">Identificação</span><select id="' + p + '-label" name="label" required>' + labels + '</select><small class="err" role="alert"></small></label>' +
    field({ id: p + '-cep', name: 'cep', label: 'CEP', mask: 'cep', maxlength: 9, inputmode: 'numeric', validate: 'cep', placeholder: '00000-000', autocomplete: 'postal-code', attrs: 'data-cep-lookup', value: v.cep }) +
    '</div>' +
    field({ id: p + '-street', name: 'street', label: 'Rua / Avenida', mask: 'street', maxlength: 80, validate: 'text', autocomplete: 'address-line1', value: v.street }) +
    '<div class="form-row">' +
    field({ id: p + '-number', name: 'number', label: 'Número', mask: 'digits', maxlength: 6, inputmode: 'numeric', validate: 'number', placeholder: 'Ex.: 128', value: v.number }) +
    field({ id: p + '-comp', name: 'complement', label: 'Complemento', mask: 'street', maxlength: 30, required: false, placeholder: 'Apto, bloco...', value: v.complement }) +
    '</div><div class="form-row">' +
    field({ id: p + '-district', name: 'district', label: 'Bairro', mask: 'street', maxlength: 50, validate: 'text', value: v.district }) +
    field({ id: p + '-city', name: 'city', label: 'Cidade', mask: 'name', maxlength: 50, validate: 'text', value: v.city }) +
    '</div>' +
    field({ id: p + '-uf', name: 'uf', label: 'UF', mask: 'uf', maxlength: 2, validate: 'uf', placeholder: 'SP', value: v.uf });
}

const addressText = (a) => esc(a.street) + ', ' + esc(a.number) + (a.complement ? ' — ' + esc(a.complement) : '') + ' — ' + esc(a.district) + '<br>' + esc(a.city) + ', ' + esc(a.uf) + ' • ' + maskValue('cep', a.cep);

function addrFrom(d) {
  return { label: d.label, cep: onlyDigits(d.cep), street: d.street.trim(), number: d.number, complement: (d.complement || '').trim(), district: d.district.trim(), city: d.city.trim(), uf: d.uf };
}

function searchBox(large) {
  return '<form class="search-box ' + (large ? 'search-large' : '') + (state.query ? ' has-value' : '') + '" data-form="search" role="search" novalidate>' + icon('search') +
    '<input data-search type="search" maxlength="60" autocomplete="off" enterkeyhint="search" value="' + esc(state.query) + '" placeholder="Busque seu sushi favorito..." aria-label="Buscar no cardápio">' +
    '<button type="button" class="clear" data-action="clear-search" aria-label="Limpar pesquisa">' + icon('close', 17) + '</button>' +
    '<button type="submit" class="btn btn-primary">Buscar</button></form>';
}

function productCard(p) {
  return '<article class="product-card">' +
    '<button type="button" class="product-image" data-action="details" data-id="' + p.id + '" aria-label="Ver ' + esc(p.name) + '"><img src="' + p.image + '" alt="' + esc(p.name) + '" loading="lazy">' +
    (p.badge ? '<span class="badge' + (p.badge === 'Promoção' ? ' sale' : '') + '">' + esc(p.badge) + '</span>' : '') + '</button>' +
    '<div class="product-body"><div class="rating">' + icon('star', 14, true) + ' ' + p.rating.toFixed(1).replace('.', ',') + '</div>' +
    '<button type="button" class="product-name" data-action="details" data-id="' + p.id + '">' + esc(p.name) + '</button>' +
    '<p>' + esc(p.description) + '</p>' + (p.pieces ? '<small>' + p.pieces + ' peças</small>' : '') +
    '<div class="product-foot"><div>' + (p.oldPrice ? '<del>' + currency(p.oldPrice) + '</del>' : '') + '<strong>' + currency(p.price) + '</strong></div>' +
    '<button type="button" class="add-button" data-action="add" data-id="' + p.id + '" aria-label="Adicionar ' + esc(p.name) + ' ao carrinho">' + icon('plus', 19) + '</button></div></div></article>';
}

function sectionTitle(eyebrow, title, action, href) {
  return '<div class="section-heading"><div>' + (eyebrow ? '<span class="eyebrow">' + eyebrow + '</span>' : '') + '<h2>' + title + '</h2></div>' +
    (action ? '<a class="link-btn" href="' + href + '">' + action + ' ' + icon('arrow', 18) + '</a>' : '') + '</div>';
}

function gate(title, msg) {
  return '<main id="main" class="page-main"><div class="container gate"><div class="empty-visual"><span>寿司</span></div><h1>' + title + '</h1><p>' + msg + '</p>' +
    '<div class="row-actions"><button type="button" class="btn btn-primary" data-action="login-open">Entrar</button><a class="btn btn-outline" href="#/register">Criar conta</a></div></div></main>';
}

function header(active) {
  const user = Auth.current();
  const nav = [['home', 'Início'], ['menu', 'Cardápio'], ['orders', 'Meus pedidos'], ['profile', 'Meu perfil']];
  const links = nav.map((n) => '<a href="#/' + n[0] + '" class="' + (active === n[0] ? 'active' : '') + '"' + (active === n[0] ? ' aria-current="page"' : '') + '>' + n[1] + '</a>').join('');
  const extra = user
    ? '<button type="button" class="btn btn-outline" data-action="logout">' + icon('logout', 18) + ' Sair da conta</button>'
    : '<button type="button" class="btn btn-outline" data-action="login-open">Entrar</button><a class="btn btn-primary" href="#/register">Cadastrar-se</a>';
  const n = Cart.count();
  const desk = user
    ? '<a class="user-chip desk-only" href="#/profile"><span class="avatar-sm">' + esc(initials(user.name)) + '</span><b>' + esc(user.name.split(' ')[0]) + '</b></a><button type="button" class="btn btn-ghost desk-only" data-action="logout">Sair</button>'
    : '<button type="button" class="btn btn-ghost desk-only" data-action="login-open">Entrar</button><a class="btn btn-primary signup desk-only" href="#/register">Cadastrar-se</a>';
  return '<header class="header"><div class="header-inner">' + logo() +
    '<div class="location">' + icon('pin', 18) + '<span><small>Entregar em</small><b>São Paulo, SP</b></span></div>' +
    '<nav class="nav" id="nav" aria-label="Principal">' + links + '<div class="nav-extra">' + extra + '</div></nav>' +
    '<div class="header-actions">' + themeBtn() + desk +
    '<a class="cart-button" href="#/cart" data-cart-link aria-label="Carrinho com ' + n + (n === 1 ? ' item' : ' itens') + '">' + icon('cart') + '<span data-cart-count>' + n + '</span></a>' +
    '<button type="button" class="icon-btn mobile-menu" data-action="nav-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="nav">' + icon('menu') + '</button></div></div></header>';
}

function footer() {
  return '<footer><div class="container footer-grid"><div>' + logo() + '<p>Sushi feito com cuidado, ingredientes frescos e a praticidade que combina com você.</p>' +
    '<div class="socials"><button type="button" data-action="soon" aria-label="Instagram">ig</button><button type="button" data-action="soon" aria-label="Facebook">f</button><button type="button" data-action="soon" aria-label="X">x</button></div></div>' +
    '<div><h4>GoSushi</h4><a href="#/home">Início</a><a href="#/menu">Cardápio</a><button type="button" data-action="soon">Sobre nós</button><button type="button" data-action="soon">Trabalhe conosco</button></div>' +
    '<div><h4>Ajuda</h4><button type="button" data-action="soon">Central de ajuda</button><button type="button" data-action="soon">Fale conosco</button><button type="button" data-action="soon">Termos de uso</button><button type="button" data-action="soon">Privacidade</button></div>' +
    '<div><h4>Atendimento</h4><p>Segunda a domingo<br><b>11h às 23h</b></p><p>(11) 4002-8922<br>oi@gosushi.com.br</p></div></div>' +
    '<div class="container footer-bottom"><span>© ' + new Date().getFullYear() + ' GoSushi. Todos os direitos reservados.</span><span>Feito com respeito à culinária japonesa.</span></div></footer>';
}

function bottomNav(active) {
  const n = Cart.count();
  const item = (name, href, ic, label, extra) => '<a href="' + href + '" class="' + (active === name ? 'active' : '') + '">' + icon(ic, 22) + (extra || '') + label + '</a>';
  return '<nav class="mobile-bottom" aria-label="Navegação rápida">' + item('home', '#/home', 'home', 'Início') + item('menu', '#/menu', 'search', 'Cardápio') +
    item('cart', '#/cart', 'cart', 'Carrinho', '<i data-cart-count>' + n + '</i>') + item('profile', '#/profile', 'user', 'Perfil') + '</nav>';
}

function viewHome() {
  const cats = CATEGORIES.map((c) => '<button type="button" class="category-card" data-action="category" data-cat="' + c[0] + '"><span>' + c[1] + '</span><b>' + c[0] + '</b></button>').join('');
  return '<main id="main">' +
    '<section class="hero"><div class="hero-wrap"><img src="' + IMAGES.hero + '" alt="Combinado de niguiris e sashimis GoSushi" fetchpriority="high"><div class="hero-shade"></div></div>' +
    '<div class="hero-content container"><span class="hero-tag">Sushi fresco • entrega rápida</span><h1>Seu sushi favorito,<br><em>no conforto da sua casa.</em></h1>' +
    '<p>Uma experiência japonesa feita com ingredientes selecionados e entregue com todo cuidado.</p>' +
    '<div class="hero-actions"><a class="btn btn-primary" href="#/menu">Pedir agora ' + icon('arrow') + '</a><span>' + icon('clock') + ' Entrega em 35–50 min</span></div></div>' +
    '<div class="hero-search container">' + searchBox(true) + '</div></section>' +
    '<section class="section container categories-section">' + sectionTitle('Explore sabores', 'O que você quer pedir hoje?', 'Ver cardápio completo', '#/menu') + '<div class="category-row">' + cats + '</div></section>' +
    '<section class="section soft-section"><div class="container">' + sectionTitle('Seleção da casa', 'Os favoritos do GoSushi', 'Ver todos', '#/menu') +
    '<div class="product-grid">' + PRODUCTS.slice(0, 6).map(productCard).join('') + '</div></div></section>' +
    '<section class="promo-section container"><div class="promo-main"><img src="' + IMAGES.salmon + '" alt="Combo da semana GoSushi" loading="lazy"><div class="promo-overlay"></div>' +
    '<div><span>COMBO DA SEMANA</span><h2>40 peças para compartilhar</h2><p>Uma seleção especial do chef por apenas</p><strong>' + currency(99.9) + '</strong>' +
    '<button type="button" class="btn btn-primary" data-action="add" data-id="10">Quero esse combo</button></div></div>' +
    '<div class="promo-side"><span class="eyebrow">Só no GoSushi</span><h2>Ganhe 15% OFF no primeiro pedido</h2><p>Use o cupom <b>OI15</b> no carrinho e descubra seu novo japonês favorito.</p>' +
    '<a href="#/menu">Escolher meu sushi ' + icon('arrow') + '</a><span class="promo-kanji" aria-hidden="true">寿司</span></div></section>' +
    '<section class="section container">' + sectionTitle('Sempre uma boa escolha', 'Por que pedir no GoSushi?') +
    '<div class="benefits"><article><span>01</span><h3>Frescor em primeiro lugar</h3><p>Ingredientes selecionados diariamente e preparo somente após o seu pedido.</p></article>' +
    '<article><span>02</span><h3>Do nosso sushibar à sua mesa</h3><p>Embalagens especiais preservam sabor, textura e apresentação.</p></article>' +
    '<article><span>03</span><h3>Pedir ficou mais simples</h3><p>Escolha, personalize e acompanhe cada etapa da entrega em tempo real.</p></article></div></section>' +
    '<section class="testimonials"><div class="container testimonial-inner"><div><span class="eyebrow light">Quem pede, recomenda</span><h2>Experiências que deixam saudade</h2>' +
    '<div class="stars">★★★★★ <small>4,9 de 5 • avaliações demonstrativas</small></div></div>' +
    '<div class="quote"><p>“O combinado chegou impecável, fresco e muito bem apresentado. Já virou nosso pedido de sexta-feira.”</p><span><b>Marina R.</b> • Cliente GoSushi</span></div>' +
    '<div class="quote"><p>“A navegação é simples, a entrega foi pontual e o hot roll ainda chegou crocante.”</p><span><b>Rafael M.</b> • Cliente GoSushi</span></div></div></section></main>';
}

function filteredProducts() {
  const q = norm(state.query);
  const list = PRODUCTS.filter((p) =>
    (state.category === 'Todos' || p.category === state.category) &&
    norm(p.name + ' ' + p.description + ' ' + p.category).includes(q) &&
    (state.maxPrice >= 150 || p.price <= state.maxPrice) &&
    (!state.promoOnly || p.oldPrice));
  if (state.sort === 'Menor preço') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'Maior preço') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'Melhor avaliados') list.sort((a, b) => b.rating - a.rating);
  return list;
}

function menuGrid(list) {
  if (list.length) return '<div class="product-grid">' + list.map(productCard).join('') + '</div>';
  return '<div class="empty-state"><div class="empty-mark">寿</div><h2>Nenhum sushi encontrado</h2><p>Tente buscar por “salmão”, “hot roll” ou explore nossos combinados.</p><button type="button" class="btn btn-primary" data-action="clear-filters">Limpar pesquisa e filtros</button></div>';
}

function updateMenu() {
  const wrap = $('#grid-wrap');
  if (!wrap) return;
  const list = filteredProducts();
  $('#res-count').textContent = list.length + (list.length === 1 ? ' produto' : ' produtos');
  $('#res-query').textContent = state.query ? ' para “' + state.query + '”' : '';
  wrap.innerHTML = menuGrid(list);
}

function viewMenu() {
  const cats = ['Todos'].concat(CATEGORIES.map((c) => c[0]));
  const radios = cats.map((c) => '<label><input type="radio" name="cat" value="' + c + '"' + (state.category === c ? ' checked' : '') + '> <span>' + c + '</span></label>').join('');
  const sorts = ['Mais vendidos', 'Menor preço', 'Maior preço', 'Melhor avaliados'].map((s) => '<option' + (state.sort === s ? ' selected' : '') + '>' + s + '</option>').join('');
  const list = filteredProducts();
  return '<main id="main" class="page-main"><section class="page-hero"><div class="container"><span class="eyebrow light">Cardápio GoSushi</span><h1>Feito na hora. Do jeito que você gosta.</h1><p>Explore nossas criações e encontre seu próximo favorito.</p>' + searchBox(true) + '</div></section>' +
    '<div class="container menu-layout"><aside class="filters" id="filters" aria-label="Filtros"><div class="filter-title"><h3>Filtros</h3>' + icon('filter') + '</div>' +
    '<span class="group-title">Categoria</span>' + radios +
    '<span class="group-title">Faixa de preço</span><input class="range" id="price-range" type="range" min="20" max="150" step="5" value="' + state.maxPrice + '" aria-label="Preço máximo">' +
    '<div class="range-labels"><small>R$ 20</small><small id="price-label">' + (state.maxPrice >= 150 ? 'R$ 150+' : 'até ' + currency(state.maxPrice)) + '</small></div>' +
    '<label class="switch-label" style="margin-top:22px"><input type="checkbox" id="promo-only"' + (state.promoOnly ? ' checked' : '') + '><i></i> Somente promoções</label></aside>' +
    '<section class="results"><div class="result-head"><div><b id="res-count">' + list.length + (list.length === 1 ? ' produto' : ' produtos') + '</b><span id="res-query">' + (state.query ? ' para “' + esc(state.query) + '”' : '') + '</span></div>' +
    '<div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn btn-outline filter-toggle" data-action="filters-toggle">' + icon('filter', 18) + ' Filtros</button>' +
    '<select id="sort" aria-label="Ordenar produtos">' + sorts + '</select></div></div><div id="grid-wrap">' + menuGrid(list) + '</div></section></div></main>';
}

function viewCart() {
  const t = totals();
  if (!t.lines.length) {
    return '<main id="main" class="page-main"><div class="container empty-cart"><div class="empty-visual"><span>寿司</span></div><h1>Seu carrinho está esperando por um sushi</h1><p>Explore o cardápio GoSushi e monte uma combinação do seu jeito.</p><a class="btn btn-primary" href="#/menu">Explorar cardápio ' + icon('arrow') + '</a></div></main>';
  }
  const items = t.lines.map((l) =>
    '<article class="cart-item"><img src="' + l.product.image + '" alt="' + esc(l.product.name) + '"><div><h3>' + esc(l.product.name) + '</h3><p>' + esc(lineDesc(l)) + '</p>' +
    '<button type="button" class="remove-btn" data-action="remove-line" data-key="' + esc(l.key) + '">' + icon('trash', 16) + ' Remover</button></div>' +
    '<div class="qty"><button type="button" data-action="qty" data-key="' + esc(l.key) + '" data-d="-1" aria-label="Diminuir quantidade">' + icon('minus', 16) + '</button><b>' + l.qty + '</b><button type="button" data-action="qty" data-key="' + esc(l.key) + '" data-d="1" aria-label="Aumentar quantidade">' + icon('plus', 16) + '</button></div>' +
    '<strong>' + currency(l.unit * l.qty) + '</strong></article>').join('');
  const couponBox = t.coupon
    ? '<div class="coupon-applied"><span>Cupom <b>' + t.coupon + '</b> aplicado (' + Math.round(COUPONS[t.coupon].pct * 100) + '% OFF)</span><button type="button" data-action="remove-coupon">Remover</button></div>'
    : '<form class="coupon" data-form="coupon" novalidate><input id="coupon-input" name="code" data-mask="coupon" maxlength="12" placeholder="Digite seu cupom" aria-label="Cupom de desconto" autocomplete="off"><button type="submit" class="btn btn-dark">Aplicar</button></form>';
  const n = Cart.count();
  return '<main id="main" class="page-main container cart-page"><div class="breadcrumbs"><a href="#/home">Início</a> / <b>Carrinho</b></div><h1>Seu carrinho <span>' + n + (n === 1 ? ' item' : ' itens') + '</span></h1>' +
    '<div class="cart-layout"><section class="cart-list"><div class="cart-list-head"><b>Produtos</b><span>Quantidade</span><span>Total</span></div>' + items + '<a class="continue" href="#/menu">← Continuar comprando</a></section>' +
    '<aside class="summary"><h2>Resumo do pedido</h2><span class="small-label">Cupom de desconto</span>' + couponBox +
    '<div class="delivery-note">' + icon('pin') + '<span><b>Entrega em 35–50 min</b><small>Escolha o endereço na próxima etapa</small></span></div>' +
    '<dl><div><dt>Subtotal</dt><dd>' + currency(t.subtotal) + '</dd></div><div><dt>Desconto</dt><dd class="green">− ' + currency(t.discount) + '</dd></div><div><dt>Taxa de entrega</dt><dd>' + currency(t.delivery) + '</dd></div><div class="total"><dt>Total</dt><dd>' + currency(t.total) + '</dd></div></dl>' +
    '<a class="btn btn-primary full" href="#/checkout">Continuar para entrega ' + icon('arrow') + '</a><small class="secure">Compra segura • seus dados estão protegidos</small></aside></div></main>';
}

function viewCheckout() {
  const user = Auth.current();
  if (!user) return gate('Entre para finalizar seu pedido', 'Acesse sua conta ou crie uma nova para escolher o endereço e concluir a compra.');
  const t = totals();
  if (!t.lines.length) return viewCart();
  const addrs = user.addresses;
  if (!state.checkoutAddr || !addrs.some((a) => a.id === state.checkoutAddr)) {
    const m = addrs.find((a) => a.main) || addrs[0];
    state.checkoutAddr = m ? m.id : null;
  }
  const addrList = addrs.map((a) =>
    '<label class="address-card ' + (a.id === state.checkoutAddr ? 'selected' : '') + '"><input type="radio" name="address" value="' + a.id + '"' + (a.id === state.checkoutAddr ? ' checked' : '') + '>' + icon('pin') + '<span><b>' + esc(a.label) + '</b><p>' + addressText(a) + '</p></span></label>').join('');
  const pays = [['Pix', 'PIX', 'Aprovação imediata'], ['Cartão de crédito', '▰', 'Pagamento seguro'], ['Cartão de débito', '▰', 'Pagamento seguro'], ['Dinheiro', 'R$', 'Pague na entrega']];
  const payHtml = pays.map((p) => '<label class="' + (state.payment === p[0] ? 'selected' : '') + '"><input type="radio" name="payment" value="' + p[0] + '"' + (state.payment === p[0] ? ' checked' : '') + '><i>' + p[1] + '</i><span><b>' + p[0] + '</b><small>' + p[2] + '</small></span></label>').join('');
  const isCard = state.payment === 'Cartão de crédito' || state.payment === 'Cartão de débito';
  const mini = t.lines.map((l) => '<div class="mini-item"><img src="' + l.product.image + '" alt=""><span><b>' + l.qty + '× ' + esc(l.product.name) + '</b><small>' + esc(lineDesc(l)) + '</small></span><strong>' + currency(l.unit * l.qty) + '</strong></div>').join('');
  return '<main id="main" class="page-main container checkout"><div class="breadcrumbs"><a href="#/cart">Carrinho</a> / <b>Finalizar pedido</b></div><h1>Finalizar pedido</h1>' +
    '<form class="checkout-layout" data-form="checkout" novalidate><section>' +
    '<div class="checkout-card"><div class="step-title"><span>1</span><div><h2>Endereço de entrega</h2><p>Onde você quer receber seu pedido?</p></div></div>' + addrList +
    (addrs.length ? '<button type="button" class="add-address" data-action="toggle-new-address">' + icon('plus') + ' Adicionar novo endereço</button>' : '') +
    '<div class="inline-box" id="new-address-box" data-addr' + (addrs.length ? ' hidden' : '') + '>' + addressFields('ck') +
    '<div class="row-actions"><button type="button" class="btn btn-primary" data-action="save-checkout-address">Salvar endereço</button>' + (addrs.length ? '<button type="button" class="btn btn-ghost" data-action="toggle-new-address">Cancelar</button>' : '') + '</div></div></div>' +
    '<div class="checkout-card"><div class="step-title"><span>2</span><div><h2>Pagamento</h2><p>Escolha como deseja pagar</p></div></div><div class="payments">' + payHtml + '</div>' +
    '<div class="pay-extra" id="card-fields"' + (isCard ? '' : ' hidden') + '>' +
    field({ id: 'ck-card', name: 'cardNumber', label: 'Número do cartão', mask: 'card', maxlength: 19, inputmode: 'numeric', validate: 'card', placeholder: '0000 0000 0000 0000', autocomplete: 'cc-number' }) +
    field({ id: 'ck-cardname', name: 'cardName', label: 'Nome impresso no cartão', mask: 'cardname', maxlength: 26, validate: 'cardname', placeholder: 'COMO ESTÁ NO CARTÃO', autocomplete: 'cc-name' }) +
    '<div class="form-row">' + field({ id: 'ck-exp', name: 'cardExp', label: 'Validade', mask: 'expiry', maxlength: 5, inputmode: 'numeric', validate: 'expiry', placeholder: 'MM/AA', autocomplete: 'cc-exp' }) +
    field({ id: 'ck-cvv', name: 'cardCvv', label: 'CVV', mask: 'digits', maxlength: 4, inputmode: 'numeric', validate: 'cvv', placeholder: '000', autocomplete: 'cc-csc' }) + '</div></div>' +
    '<div class="pay-extra" id="cash-fields"' + (state.payment === 'Dinheiro' ? '' : ' hidden') + '>' +
    field({ id: 'ck-troco', name: 'troco', label: 'Troco para', mask: 'money', maxlength: 14, inputmode: 'numeric', validate: 'troco', required: false, placeholder: 'R$ 0,00', attrs: 'data-total="' + t.total + '"' }) + '</div>' +
    '<p class="pay-info pay-extra" id="pix-info"' + (state.payment === 'Pix' ? '' : ' hidden') + '>O código Pix para pagamento será exibido após a confirmação do pedido.</p></div>' +
    '<div class="checkout-card"><div class="step-title"><span>3</span><div><h2>Instruções de entrega</h2><p>Opcional</p></div></div>' +
    '<label class="field"><span class="lbl">Observações <em>(opcional)</em></span><textarea id="ck-notes" name="notes" maxlength="200" placeholder="Ex.: Interfone 42, deixar na portaria..."></textarea><small class="counter">0/200</small></label></div></section>' +
    '<aside class="summary sticky"><h2>Seu pedido</h2>' + mini +
    '<dl><div><dt>Subtotal</dt><dd>' + currency(t.subtotal) + '</dd></div>' + (t.discount ? '<div><dt>Desconto (' + t.coupon + ')</dt><dd class="green">− ' + currency(t.discount) + '</dd></div>' : '') +
    '<div><dt>Entrega</dt><dd>' + currency(t.delivery) + '</dd></div><div class="total"><dt>Total</dt><dd>' + currency(t.total) + '</dd></div></dl>' +
    '<button type="submit" class="btn btn-primary full">Confirmar pedido ' + icon('arrow') + '</button><small class="secure">Ao confirmar, você concorda com nossos termos</small></aside></form></main>';
}

/* ---- Pedidos ---- */
const STAGES = ['Pedido confirmado', 'Em preparação', 'Saiu para entrega', 'Pedido entregue'];
const OFFSETS = [0, 1, 3, 6]; /* minutos — simulação acelerada para demonstração */

function orderStage(o) {
  if (o.cancelled) return -1;
  const m = (Date.now() - o.createdAt) / 60000;
  let s = 0;
  OFFSETS.forEach((off, i) => { if (m >= off) s = i; });
  return s;
}
function statusInfo(o) {
  const s = orderStage(o);
  if (s === -1) return { label: 'Cancelado', cls: 'cancelled', active: false, stage: s };
  if (s === 3) return { label: 'Entregue', cls: 'delivered', active: false, stage: s };
  return { label: ['Confirmado', 'Em preparação', 'Saiu para entrega'][s], cls: 'preparing', active: true, stage: s };
}
const itemsSummary = (o) => o.items.map((i) => i.qty + '× ' + i.name).join(', ');

function orderCard(o) {
  const st = statusInfo(o);
  const first = o.items[0];
  const total = currency(o.total);
  if (st.active) {
    const tl = STAGES.map((x, i) => '<div class="' + (i <= st.stage ? 'done' : '') + '"><i>' + (i <= st.stage ? icon('check', 14) : i + 1) + '</i><span>' + x + '<small>' + (i <= st.stage ? fmtTime(o.createdAt + OFFSETS[i] * 60000) : '—') + '</small></span></div>').join('');
    return '<article class="order-card active-order"><div class="order-top"><div><span class="status ' + st.cls + '">' + st.label + '</span><h2>Pedido #' + o.id + '</h2><p>' + fmtDate(o.createdAt) + ', às ' + fmtTime(o.createdAt) + ' • ' + esc(o.payment) + '</p></div><strong>' + total + '</strong></div>' +
      '<div class="timeline">' + tl + '</div><div class="order-products"><img src="' + first.image + '" alt=""><span><b>' + esc(itemsSummary(o)) + '</b><small>Simulação acelerada de acompanhamento</small></span>' +
      '<button type="button" class="btn btn-outline" data-action="order-details" data-id="' + o.id + '">Ver detalhes</button>' +
      (st.stage <= 1 ? '<button type="button" class="btn btn-danger" data-action="cancel-order" data-id="' + o.id + '">Cancelar pedido</button>' : '') + '</div></article>';
  }
  return '<article class="history-order"><img src="' + first.image + '" alt=""><div><span class="status ' + st.cls + '">' + st.label + '</span><h3>Pedido #' + o.id + '</h3><p>' + fmtDate(o.createdAt) + ', ' + fmtTime(o.createdAt) + '</p><small>' + esc(itemsSummary(o)) + '</small></div><strong>' + total + '</strong>' +
    '<div><button type="button" class="btn btn-outline" data-action="order-details" data-id="' + o.id + '">Ver detalhes</button><button type="button" class="btn btn-ghost" data-action="reorder" data-id="' + o.id + '">Pedir novamente</button></div></article>';
}

function filteredOrders() {
  const user = Auth.current();
  const f = state.orderFilter;
  const q = norm(f.q);
  const now = Date.now();
  return Orders.byUser(user.id).filter((o) => {
    const st = statusInfo(o);
    if (f.status === 'Em andamento' && !st.active) return false;
    if ((f.status === 'Entregue' || f.status === 'Cancelado') && st.label !== f.status) return false;
    if (f.period !== 'all' && now - o.createdAt > Number(f.period) * 86400000) return false;
    if (q && !(norm(o.id).includes(q) || o.items.some((i) => norm(i.name).includes(q)))) return false;
    return true;
  });
}

function ordersBody() {
  const user = Auth.current();
  const total = Orders.byUser(user.id).length;
  const list = filteredOrders();
  if (!total) return '<div class="empty-state"><div class="empty-mark">寿</div><h2>Você ainda não fez pedidos</h2><p>Que tal começar pelo nosso cardápio?</p><a class="btn btn-primary" href="#/menu">Ver cardápio</a></div>';
  if (!list.length) return '<div class="empty-state"><div class="empty-mark">寿</div><h2>Nenhum pedido encontrado</h2><p>Ajuste os filtros para ver outros pedidos.</p></div>';
  const active = list.filter((o) => statusInfo(o).active);
  const past = list.filter((o) => !statusInfo(o).active);
  return active.map(orderCard).join('') + (past.length ? '<h2 class="history-title">Pedidos anteriores</h2>' + past.map(orderCard).join('') : '');
}
function updateOrders() { const el = $('#orders-list'); if (el) el.innerHTML = ordersBody(); }

function viewOrders() {
  const user = Auth.current();
  if (!user) return gate('Entre para ver seus pedidos', 'Acompanhe pedidos em andamento e consulte seu histórico.');
  const f = state.orderFilter;
  const opt = (arr, cur) => arr.map((a) => '<option value="' + a[0] + '"' + (String(cur) === String(a[0]) ? ' selected' : '') + '>' + a[1] + '</option>').join('');
  return '<main id="main" class="page-main soft-page"><div class="container orders-page"><div class="page-title-row"><div><span class="eyebrow">Sua conta</span><h1>Meus pedidos</h1><p>Acompanhe pedidos atuais e consulte seu histórico.</p></div><a class="btn btn-primary" href="#/menu">Fazer novo pedido</a></div>' +
    '<div class="order-filters"><label class="search-mini">' + icon('search') + '<input id="of-q" maxlength="40" placeholder="Buscar por número ou produto" aria-label="Buscar pedidos" value="' + esc(f.q) + '"></label>' +
    '<select id="of-status" aria-label="Status">' + opt([['Todos', 'Todos os status'], ['Em andamento', 'Em andamento'], ['Entregue', 'Entregue'], ['Cancelado', 'Cancelado']], f.status) + '</select>' +
    '<select id="of-period" aria-label="Período">' + opt([['30', 'Últimos 30 dias'], ['90', 'Últimos 3 meses'], ['365', 'Último ano'], ['all', 'Todo o período']], f.period) + '</select></div>' +
    '<div id="orders-list">' + ordersBody() + '</div></div></main>';
}

function viewConfirmation(r) {
  const user = Auth.current();
  const o = user ? Orders.get(r.param) : null;
  if (!user || !o || o.userId !== user.id) return gate('Pedido não encontrado', 'Entre na sua conta para ver os detalhes dos seus pedidos.');
  const st = statusInfo(o);
  const prog = STAGES.map((x, i) => '<div class="' + (i <= Math.max(st.stage, 0) ? 'current' : '') + '"><i>' + (i <= Math.max(st.stage, 0) ? icon('check', 15) : i + 1) + '</i><span>' + x + '</span></div>').join('');
  return '<main id="main" class="page-main"><div class="container confirmation"><div class="success-icon">' + icon('check', 38) + '</div><span class="eyebrow">Pedido confirmado</span><h1>Agora é só preparar os hashis.</h1>' +
    '<p>Recebemos seu pedido <b>#' + o.id + '</b> e nossa cozinha já foi avisada.</p>' +
    '<div class="eta">' + icon('clock', 28) + '<span><small>Previsão de entrega</small><b>Hoje, entre ' + fmtTime(o.createdAt + 35 * 60000) + ' e ' + fmtTime(o.createdAt + 50 * 60000) + '</b></span></div>' +
    '<div class="order-progress">' + prog + '</div><a class="btn btn-primary" href="#/orders">Acompanhar meu pedido</a><a class="btn btn-ghost" href="#/home">Voltar ao início</a></div></main>';
}

/* ---- Perfil ---- */
const PROFILE_TABS = ['Dados pessoais', 'Endereços', 'Segurança', 'Preferências'];

function tabPersonal(u) {
  return '<form data-form="profile" novalidate><div class="form-alert" role="alert"></div><div class="form-row">' +
    field({ id: 'pf-name', name: 'name', label: 'Nome completo', mask: 'name', maxlength: 60, validate: 'name', autocomplete: 'name', value: u.name }) +
    field({ id: 'pf-email', name: 'email', label: 'E-mail', type: 'email', mask: 'email', maxlength: 80, validate: 'email', autocomplete: 'email', value: u.email }) +
    '</div><div class="form-row">' +
    field({ id: 'pf-cpf', name: 'cpf', label: 'CPF', mask: 'cpf', maxlength: 14, readonly: true, value: u.cpf }) +
    field({ id: 'pf-phone', name: 'phone', label: 'Telefone', type: 'tel', mask: 'phone', maxlength: 15, inputmode: 'numeric', validate: 'phone', autocomplete: 'tel', placeholder: '(00) 00000-0000', value: u.phone }) +
    '</div><div class="form-row">' +
    field({ id: 'pf-birth', name: 'birth', label: 'Data de nascimento', mask: 'date', maxlength: 10, inputmode: 'numeric', validate: 'date', autocomplete: 'bday', placeholder: 'DD/MM/AAAA', value: u.birth }) +
    '</div><div class="preference-box"><div><h3>Novidades e ofertas</h3><p>Receba promoções e novidades do cardápio GoSushi.</p></div><label class="toggle"><input type="checkbox" name="newsletter"' + (u.newsletter ? ' checked' : '') + ' aria-label="Receber novidades e ofertas"><i></i></label></div>' +
    '<button type="submit" class="btn btn-primary">Salvar alterações</button></form>';
}

function tabAddresses(u) {
  const cards = u.addresses.map((a) =>
    '<div class="saved-address ' + (a.main ? 'main' : '') + '"><div class="top">' + icon('pin') + (a.main ? '<span class="tag">Principal</span>' : '') + '</div><h3>' + esc(a.label) + '</h3><p>' + addressText(a) + '</p>' +
    '<div class="actions">' + (a.main ? '' : '<button type="button" data-action="main-address" data-id="' + a.id + '">Tornar principal</button>') + '<button type="button" data-action="delete-address" data-id="' + a.id + '">Excluir</button></div></div>').join('');
  return (u.addresses.length ? '<div class="addresses">' + cards + '</div><button type="button" class="btn btn-outline" data-action="toggle-profile-address">' + icon('plus', 18) + ' Adicionar novo endereço</button>' : '<p class="hint" style="margin-bottom:18px">Você ainda não tem endereços salvos.</p>') +
    '<form class="inline-box" id="profile-address-form" data-form="address" data-addr novalidate' + (u.addresses.length ? ' hidden' : '') + '><div class="form-alert" role="alert"></div>' + addressFields('pa') +
    '<div class="row-actions"><button type="submit" class="btn btn-primary">Salvar endereço</button></div></form>';
}

function tabSecurity() {
  return '<form data-form="password" novalidate style="max-width:460px"><div class="form-alert" role="alert"></div>' +
    passField({ id: 'pw-cur', name: 'current', label: 'Senha atual', validate: '', autocomplete: 'current-password' }) +
    passField({ id: 'pw-new', name: 'newPassword', label: 'Nova senha', placeholder: 'Mínimo 8 caracteres', autocomplete: 'new-password', strength: true }) +
    passField({ id: 'pw-conf', name: 'confirmNew', label: 'Confirmar nova senha', validate: 'confirm', match: 'newPassword', autocomplete: 'new-password' }) +
    '<button type="submit" class="btn btn-primary">Alterar senha</button></form>';
}

function tabPrefs(u) {
  const pref = Theme.pref();
  const opts = [['light', 'Claro'], ['dark', 'Escuro'], ['system', 'Automático']].map((o) =>
    '<label class="' + (pref === o[0] ? 'selected' : '') + '"><input type="radio" name="theme" value="' + o[0] + '"' + (pref === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>').join('');
  return '<h3 style="font:700 16px Manrope,sans-serif;margin-bottom:12px">Aparência</h3><div class="theme-options">' + opts + '</div>' +
    '<div class="preference-box"><div><h3>Novidades e ofertas</h3><p>Receba promoções e novidades do cardápio GoSushi.</p></div><label class="toggle"><input type="checkbox" id="pref-news"' + (u.newsletter ? ' checked' : '') + ' aria-label="Receber novidades e ofertas"><i></i></label></div>';
}

function viewProfile() {
  const u = Auth.current();
  if (!u) return gate('Entre para acessar seu perfil', 'Gerencie seus dados, endereços e preferências.');
  const tab = PROFILE_TABS.includes(state.profileTab) ? state.profileTab : PROFILE_TABS[0];
  const tabs = PROFILE_TABS.map((t) => '<button type="button" class="' + (tab === t ? 'active' : '') + '" data-action="profile-tab" data-tab="' + t + '">' + t + '<span>›</span></button>').join('') + '<a href="#/orders">Histórico de pedidos<span>›</span></a>';
  const body = tab === 'Endereços' ? tabAddresses(u) : tab === 'Segurança' ? tabSecurity() : tab === 'Preferências' ? tabPrefs(u) : tabPersonal(u);
  return '<main id="main" class="page-main soft-page"><div class="container profile-page"><aside class="profile-nav"><div class="who"><div class="avatar">' + esc(initials(u.name)) + '</div><div><h3>' + esc(u.name) + '</h3><p>' + esc(u.email) + '</p></div></div>' +
    '<div class="tabs">' + tabs + '</div><button type="button" class="logout" data-action="logout">Sair da conta</button></aside>' +
    '<section class="profile-content"><div class="profile-heading"><div><span class="eyebrow">Minha conta</span><h1>' + tab + '</h1><p>Mantenha suas informações sempre atualizadas.</p></div>' +
    '<a class="quick-cart" href="#/cart">' + icon('cart', 18) + ' Acessar carrinho</a></div>' + body + '</section></div></main>';
}

/* ---- Cadastro ---- */
function viewRegister() {
  return '<main class="auth-page"><div class="auth-visual"><img src="' + IMAGES.sashimi + '" alt="Sashimis GoSushi"><div class="shade"></div>' + logo() +
    '<section><span aria-hidden="true">寿司</span><h1>Seu momento japonês começa aqui.</h1><p>Crie sua conta e receba o melhor da culinária japonesa onde estiver.</p></section></div>' +
    '<div class="auth-form-wrap">' + themeBtn('theme-fab') + '<form class="auth-form" data-form="register" novalidate><a class="back" href="#/home">← Voltar para o início</a>' +
    '<span class="eyebrow">Bem-vindo ao GoSushi</span><h1>Crie sua conta</h1><p>Leva menos de dois minutos.</p><div class="form-alert" role="alert"></div>' +
    field({ id: 'rg-name', name: 'name', label: 'Nome completo', mask: 'name', maxlength: 60, validate: 'name', autocomplete: 'name', placeholder: 'Como podemos chamar você?' }) +
    field({ id: 'rg-email', name: 'email', label: 'E-mail', type: 'email', mask: 'email', maxlength: 80, validate: 'email', autocomplete: 'email', placeholder: 'seu@email.com' }) +
    '<div class="form-row">' + field({ id: 'rg-cpf', name: 'cpf', label: 'CPF', mask: 'cpf', maxlength: 14, inputmode: 'numeric', validate: 'cpf', placeholder: '000.000.000-00' }) +
    field({ id: 'rg-phone', name: 'phone', label: 'Telefone', type: 'tel', mask: 'phone', maxlength: 15, inputmode: 'numeric', validate: 'phone', autocomplete: 'tel', placeholder: '(00) 00000-0000' }) + '</div>' +
    field({ id: 'rg-birth', name: 'birth', label: 'Data de nascimento', mask: 'date', maxlength: 10, inputmode: 'numeric', validate: 'date', autocomplete: 'bday', placeholder: 'DD/MM/AAAA' }) +
    '<div class="form-row">' + passField({ id: 'rg-pass', name: 'password', label: 'Senha', placeholder: 'Mínimo 8 caracteres', autocomplete: 'new-password', strength: true }) +
    passField({ id: 'rg-conf', name: 'confirm', label: 'Confirmar senha', placeholder: 'Repita sua senha', validate: 'confirm', autocomplete: 'new-password' }) + '</div>' +
    '<label class="field terms"><input type="checkbox" name="terms" required><span>Li e aceito os <b>Termos de Uso</b> e a <b>Política de Privacidade</b>.</span><small class="err" role="alert"></small></label>' +
    '<button type="submit" class="btn btn-primary full">Criar minha conta ' + icon('arrow') + '</button>' +
    '<p class="auth-switch">Já tem uma conta? <button type="button" data-action="login-open">Entrar</button></p></form></div></main>';
}

const VIEWS = { home: viewHome, menu: viewMenu, cart: viewCart, checkout: viewCheckout, orders: viewOrders, profile: viewProfile, register: viewRegister, confirmacao: viewConfirmation };

function render() {
  const r = parseRoute();
  const name = VIEWS[r.name] ? r.name : 'home';
  if (name === 'register' && Auth.current()) { location.hash = '#/home'; return; }
  document.title = 'GoSushi • ' + TITLES[name];
  if (name === 'register') app.innerHTML = viewRegister();
  else {
    const navName = name === 'confirmacao' ? 'orders' : name;
    app.innerHTML = header(navName) + VIEWS[name](r) + footer() + bottomNav(navName);
  }
  $$('textarea[maxlength]').forEach(updateCounter);
}

/* ------------------------------ Modais ------------------------------ */
function openModal(m) {
  state.modal = m;
  state.lastFocus = document.activeElement;
  renderModal();
  document.body.classList.add('no-scroll');
}
function closeModal() {
  if (!state.modal) return;
  state.modal = null;
  $('#modal-root').innerHTML = '';
  document.body.classList.remove('no-scroll');
  if (state.lastFocus && state.lastFocus.focus) { try { state.lastFocus.focus(); } catch (_) { /* noop */ } }
}

function renderModal() {
  const m = state.modal;
  const root = $('#modal-root');
  const closeBtn = '<button class="modal-close" type="button" data-action="close-modal" aria-label="Fechar">' + icon('close') + '</button>';
  let html = '';
  if (m.type === 'product') {
    const p = PRODUCTS.find((x) => x.id === m.id);
    state.modalQty = 1;
    const addons = ADDONS.map((a) => '<label class="addon"><input type="checkbox" data-price="' + a.price + '" data-name="' + esc(a.name) + '"><span>' + esc(a.name) + '</span><b>' + (a.price ? '+ ' + currency(a.price) : 'Grátis') + '</b></label>').join('');
    html = '<div class="modal-backdrop" data-backdrop><div class="product-modal" role="dialog" aria-modal="true" aria-labelledby="m-title">' + closeBtn +
      '<div class="modal-image"><img src="' + p.image + '" alt="' + esc(p.name) + '">' + (p.badge ? '<span class="badge' + (p.badge === 'Promoção' ? ' sale' : '') + '">' + esc(p.badge) + '</span>' : '') + '</div>' +
      '<div class="modal-content"><span class="eyebrow">' + esc(p.category) + '</span><h2 id="m-title">' + esc(p.name) + '</h2>' +
      '<div class="rating">' + icon('star', 15, true) + ' ' + p.rating.toFixed(1).replace('.', ',') + ' <span>• avaliações demonstrativas</span></div>' +
      '<p>' + esc(p.description) + ' Preparado na hora com ingredientes selecionados e arroz temperado artesanalmente.</p>' +
      (p.pieces ? '<div class="pieces"><b>' + p.pieces + '</b><span>peças<br>selecionadas</span></div>' : '') +
      '<h4>Adicione se quiser</h4>' + addons +
      '<label class="field" style="margin-top:18px"><span class="lbl">Observações <em>(opcional)</em></span><textarea id="m-notes" maxlength="140" placeholder="Ex.: sem cebolinha, capriche no gengibre..."></textarea><small class="counter">0/140</small></label>' +
      '<div class="modal-footer"><div class="qty"><button type="button" data-action="modal-qty" data-d="-1" aria-label="Diminuir">' + icon('minus', 16) + '</button><b id="m-qty">1</b><button type="button" data-action="modal-qty" data-d="1" aria-label="Aumentar">' + icon('plus', 16) + '</button></div>' +
      '<button type="button" class="btn btn-primary" id="m-add" data-action="modal-add">Adicionar • ' + currency(p.price) + '</button></div></div></div></div>';
  } else if (m.type === 'login') {
    html = '<div class="modal-backdrop" data-backdrop><form class="login-modal" role="dialog" aria-modal="true" aria-labelledby="lg-title" data-form="login" novalidate>' + closeBtn + logo() +
      '<span class="eyebrow">Que bom ter você de volta</span><h2 id="lg-title">Entre na sua conta</h2><p>Acesse seus pedidos e endereços salvos.</p><div class="form-alert" role="alert"></div>' +
      field({ id: 'lg-email', name: 'email', label: 'E-mail', type: 'email', mask: 'email', maxlength: 80, validate: 'email', autocomplete: 'email', placeholder: 'seu@email.com' }) +
      passField({ id: 'lg-pass', name: 'password', label: 'Senha', validate: '', autocomplete: 'current-password', placeholder: 'Sua senha' }) +
      '<div class="login-options"><label><input type="checkbox" name="remember" checked> Lembrar de mim</label><button type="button" data-action="forgot">Esqueci minha senha</button></div>' +
      '<button type="submit" class="btn btn-primary full">Entrar</button><p class="auth-switch">Ainda não tem conta? <button type="button" data-action="go-register">Cadastre-se</button></p></form></div>';
  } else if (m.type === 'order') {
    const o = Orders.get(m.id);
    const st = statusInfo(o);
    const items = o.items.map((i) => '<li><span>' + i.qty + '× ' + esc(i.name) + (i.addons && i.addons.length ? '<small>+ ' + esc(i.addons.map((a) => a.name).join(', ')) + '</small>' : '') + (i.notes ? '<small>Obs.: ' + esc(i.notes) + '</small>' : '') + '</span><b>' + currency(i.unit * i.qty) + '</b></li>').join('');
    html = '<div class="modal-backdrop" data-backdrop><div class="detail-modal" role="dialog" aria-modal="true" aria-labelledby="od-title">' + closeBtn +
      '<span class="status ' + st.cls + '">' + st.label + '</span><h2 id="od-title" style="margin-top:10px">Pedido #' + o.id + '</h2><p class="hint">' + fmtDate(o.createdAt) + ', às ' + fmtTime(o.createdAt) + '</p>' +
      '<ul class="detail-list">' + items + '<li><span>Subtotal</span><b>' + currency(o.subtotal) + '</b></li>' + (o.discount ? '<li><span>Desconto (' + esc(o.coupon) + ')</span><b>− ' + currency(o.discount) + '</b></li>' : '') +
      '<li><span>Entrega</span><b>' + currency(o.delivery) + '</b></li><li><span><b>Total</b></span><b>' + currency(o.total) + '</b></li></ul>' +
      '<div class="detail-meta"><b>Endereço:</b> ' + addressText(o.address) + '<br><b>Pagamento:</b> ' + esc(o.payment) + (o.notes ? '<br><b>Instruções:</b> ' + esc(o.notes) : '') + '</div></div></div>';
  }
  root.innerHTML = html;
  $$('textarea[maxlength]', root).forEach(updateCounter);
  const first = $('input:not([type=checkbox]), textarea, .modal-close', root);
  if (first) first.focus();
}

function modalUpdate() {
  if (!state.modal || state.modal.type !== 'product') return;
  const p = PRODUCTS.find((x) => x.id === state.modal.id);
  const extra = $$('.addon input:checked').reduce((s, i) => s + Number(i.dataset.price), 0);
  $('#m-qty').textContent = state.modalQty;
  $('#m-add').textContent = 'Adicionar • ' + currency((p.price + extra) * state.modalQty);
}

/* ------------------------------ Formulários ------------------------------ */
function setBusy(btn, on, txt) {
  if (!btn) return;
  if (on) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; if (txt) btn.textContent = txt; }
  else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
}
function showAlert(form, msg) {
  const a = $('.form-alert', form);
  if (a) a.textContent = msg || '';
}

const FORMS = {
  async login(f) {
    const d = collect(f);
    const btn = $('[type=submit]', f);
    showAlert(f, '');
    setBusy(btn, true, 'Entrando...');
    try {
      const u = await Auth.login(d.email.trim().toLowerCase(), d.password, d.remember);
      closeModal();
      render();
      toast('Bem-vindo(a) de volta, ' + u.name.split(' ')[0] + '!');
    } catch (err) { showAlert(f, err.message); setBusy(btn, false); }
  },

  async register(f) {
    const d = collect(f);
    const btn = $('[type=submit]', f);
    showAlert(f, '');
    setBusy(btn, true, 'Criando conta...');
    try {
      await Auth.register({ name: d.name.trim(), email: d.email.trim().toLowerCase(), cpf: onlyDigits(d.cpf), phone: onlyDigits(d.phone), birth: d.birth, password: d.password });
      toast('Conta criada com sucesso! Bem-vindo(a) ao GoSushi.');
      location.hash = '#/home';
    } catch (err) { showAlert(f, err.message); setBusy(btn, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  },

  profile(f) {
    const u = Auth.current();
    const d = collect(f);
    showAlert(f, '');
    try {
      Auth.update(u.id, { name: d.name.trim(), email: d.email.trim().toLowerCase(), phone: onlyDigits(d.phone), birth: d.birth, newsletter: !!d.newsletter });
      toast('Dados atualizados com sucesso.');
      render();
    } catch (err) { showAlert(f, err.message); }
  },

  address(f) {
    const u = Auth.current();
    Auth.addAddress(u.id, addrFrom(collect(f)));
    toast('Endereço salvo.');
    render();
  },

  async password(f) {
    const u = Auth.current();
    const d = collect(f);
    const btn = $('[type=submit]', f);
    showAlert(f, '');
    setBusy(btn, true, 'Salvando...');
    try {
      await Auth.changePassword(u.id, d.current, d.newPassword);
      toast('Senha alterada com sucesso.');
      render();
    } catch (err) { showAlert(f, err.message); setBusy(btn, false); }
  },

  search(f) {
    state.query = $('[data-search]', f).value.trim();
    if (parseRoute().name === 'menu') updateMenu();
    else location.hash = '#/menu';
  },

  coupon(f) {
    const code = collect(f).code.trim().toUpperCase();
    if (!code) { toast('Digite um cupom.', 'error'); return; }
    const c = COUPONS[code];
    if (!c) { toast('Cupom inválido.', 'error'); return; }
    const u = Auth.current();
    if (c.firstOrder && u && Orders.byUser(u.id).length) { toast('Este cupom vale apenas para o primeiro pedido.', 'error'); return; }
    DB.write('coupon', code);
    toast('Cupom aplicado: ' + c.label);
    render();
  },

  checkout(f) {
    const user = Auth.current();
    if (!user) { openModal({ type: 'login' }); return; }
    const box = $('#new-address-box');
    if (box && !box.hidden) { toast('Salve o novo endereço ou cancele antes de continuar.', 'error'); return; }
    if (!validateForm(f, { ignore: '#new-address-box' })) return;
    const d = collect(f);
    const addr = user.addresses.find((a) => a.id === d.address);
    if (!addr) { toast('Escolha um endereço de entrega.', 'error'); return; }
    const t = totals();
    if (!t.lines.length) { toast('Seu carrinho está vazio.', 'error'); return; }
    const saved = DB.read('coupon', null);
    if (saved && COUPONS[saved] && COUPONS[saved].firstOrder && Orders.byUser(user.id).length) {
      DB.remove('coupon');
      toast('O cupom ' + saved + ' vale apenas para o primeiro pedido e foi removido.', 'info');
      render();
      return;
    }
    let pay = d.payment;
    if (pay === 'Cartão de crédito' || pay === 'Cartão de débito') pay += ' •••• ' + onlyDigits(d.cardNumber).slice(-4);
    else if (pay === 'Dinheiro' && d.troco) pay += ' (troco para ' + currency(Number(onlyDigits(d.troco)) / 100) + ')';
    const order = Orders.create({
      userId: user.id,
      items: t.lines.map((l) => ({ id: l.id, name: l.product.name, qty: l.qty, unit: l.unit, image: l.product.image, pieces: l.product.pieces || null, addons: l.addons || [], notes: l.notes || '' })),
      subtotal: t.subtotal, discount: t.discount, delivery: t.delivery, total: t.total, coupon: t.coupon,
      payment: pay, address: addr, notes: (d.notes || '').trim(),
    });
    Cart.clear();
    DB.remove('coupon');
    location.hash = '#/confirmacao/' + order.id;
  },
};

document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const type = f.dataset.form;
  if (type !== 'checkout' && !validateForm(f)) return;
  if (FORMS[type]) await FORMS[type](f);
});

/* ------------------------------ Consulta de CEP (ViaCEP) ------------------------------ */
async function lookupCEP(el) {
  const cep = onlyDigits(el.value);
  const scope = el.closest('[data-addr]') || el.closest('form');
  if (!scope || el.dataset.lastCep === cep) return;
  el.dataset.lastCep = cep;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch('https://viacep.com.br/ws/' + cep + '/json/', { signal: ctl.signal });
    clearTimeout(timer);
    const d = await res.json();
    if (d.erro) { toast('CEP não encontrado. Preencha o endereço manualmente.', 'info'); return; }
    const set = (n, v) => { const f = $('[name="' + n + '"]', scope); if (f && v) { f.value = maskValue(f.dataset.mask, v); setError(f, ''); } };
    set('street', d.logradouro); set('district', d.bairro); set('city', d.localidade); set('uf', d.uf);
    const num = $('[name="number"]', scope);
    if (num) num.focus();
  } catch (_) { /* sem rede: o usuário preenche manualmente */ }
}

function updateCounter(el) {
  const box = el.closest('.field');
  const c = box && $('.counter', box);
  if (c) c.textContent = el.value.length + '/' + el.maxLength;
}

function updateStrength(el) {
  const bar = $('.strength i', el.closest('.field'));
  if (!bar) return;
  const s = el.value ? Math.max(1, passwordScore(el.value)) : 0;
  bar.dataset.s = s;
  bar.style.width = s * 25 + '%';
}

function syncPayment() {
  const p = state.payment;
  $$('.payments label').forEach((l) => l.classList.toggle('selected', $('input', l).checked));
  const card = p === 'Cartão de crédito' || p === 'Cartão de débito';
  $('#card-fields').hidden = !card;
  $('#cash-fields').hidden = p !== 'Dinheiro';
  $('#pix-info').hidden = p !== 'Pix';
}

/* ------------------------------ Ações (cliques) ------------------------------ */
const ACTIONS = {
  theme() { Theme.toggle(); refreshThemeButtons(); },
  'nav-toggle'(el) {
    const nav = $('#nav');
    const open = nav.classList.toggle('nav-open');
    el.setAttribute('aria-expanded', String(open));
    el.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    el.innerHTML = icon(open ? 'close' : 'menu');
  },
  'login-open'() { const n = $('#nav'); if (n) n.classList.remove('nav-open'); openModal({ type: 'login' }); },
  'go-register'() { closeModal(); location.hash = '#/register'; },
  forgot() { toast('Se houver uma conta com este e-mail, enviaremos as instruções de recuperação. (simulação)', 'info'); },
  logout() { Auth.logout(); toast('Você saiu da conta.'); if (['orders', 'profile', 'checkout', 'confirmacao'].includes(parseRoute().name)) navigate('home'); else render(); },
  details(el) { openModal({ type: 'product', id: Number(el.dataset.id) }); },
  add(el) { Cart.add(Number(el.dataset.id)); refreshCart(); toast('Adicionado ao carrinho.'); },
  'modal-qty'(el) { state.modalQty = Math.max(1, Math.min(99, state.modalQty + Number(el.dataset.d))); modalUpdate(); },
  'modal-add'() {
    const id = state.modal.id;
    const addons = $$('.addon input:checked').map((i) => ({ name: i.dataset.name, price: Number(i.dataset.price) }));
    Cart.add(id, state.modalQty, addons, ($('#m-notes').value || '').trim());
    closeModal();
    refreshCart();
    toast('Adicionado ao carrinho.');
  },
  'close-modal'() { closeModal(); },
  category(el) { state.category = el.dataset.cat; state.query = ''; navigate('menu'); },
  qty(el) { Cart.change(el.dataset.key, Number(el.dataset.d)); render(); },
  'remove-line'(el) { Cart.remove(el.dataset.key); render(); },
  'remove-coupon'() { DB.remove('coupon'); render(); },
  'clear-search'(el) {
    state.query = '';
    const form = el.closest('form');
    $('[data-search]', form).value = '';
    form.classList.remove('has-value');
    if (parseRoute().name === 'menu') updateMenu();
  },
  'clear-filters'() { Object.assign(state, { query: '', category: 'Todos', maxPrice: 150, promoOnly: false, sort: 'Mais vendidos' }); render(); },
  'filters-toggle'() { $('#filters').classList.toggle('open'); },
  'profile-tab'(el) { state.profileTab = el.dataset.tab; render(); },
  'toggle-pass'(el) {
    const scope = el.closest('form') || document;
    const inputs = $$('input[data-pass]', scope);
    const show = inputs.length && inputs[0].type === 'password';
    inputs.forEach((i) => { i.type = show ? 'text' : 'password'; });
    $$('[data-action="toggle-pass"]', scope).forEach((b) => { b.innerHTML = icon(show ? 'eyeoff' : 'eye'); b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha'); });
  },
  'toggle-new-address'() { const b = $('#new-address-box'); b.hidden = !b.hidden; if (!b.hidden) { const i = $('input', b); if (i) i.focus(); } },
  'toggle-profile-address'() { const b = $('#profile-address-form'); b.hidden = !b.hidden; },
  'save-checkout-address'() {
    const box = $('#new-address-box');
    if (!validateForm(box)) return;
    const a = Auth.addAddress(Auth.current().id, addrFrom(collect(box)));
    state.checkoutAddr = a.id;
    toast('Endereço salvo.');
    render();
  },
  'delete-address'(el) {
    if (!window.confirm('Excluir este endereço?')) return;
    Auth.removeAddress(Auth.current().id, el.dataset.id);
    render();
  },
  'main-address'(el) { Auth.setMainAddress(Auth.current().id, el.dataset.id); render(); },
  'order-details'(el) { openModal({ type: 'order', id: el.dataset.id }); },
  'cancel-order'(el) {
    if (!window.confirm('Deseja realmente cancelar este pedido?')) return;
    Orders.cancel(el.dataset.id);
    toast('Pedido cancelado.', 'info');
    render();
  },
  reorder(el) {
    const o = Orders.get(el.dataset.id);
    if (!o) return;
    o.items.forEach((i) => Cart.add(i.id, i.qty, i.addons, i.notes));
    refreshCart();
    toast('Itens adicionados ao carrinho.');
    location.hash = '#/cart';
  },
  soon() { toast('Em breve por aqui!', 'info'); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !ACTIONS[el.dataset.action]) return;
  ACTIONS[el.dataset.action](el, e);
});

document.addEventListener('mousedown', (e) => {
  if (e.target.hasAttribute && e.target.hasAttribute('data-backdrop')) closeModal();
});

/* ------------------------------ Entrada de dados ------------------------------ */
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset && el.dataset.mask) applyMask(el);
  if (el.dataset) el.dataset.touched = '1';
  if (el.matches('textarea[maxlength]')) updateCounter(el);
  if (el.classList.contains('invalid')) validateField(el);
  if (el.dataset && 'strength' in el.dataset) updateStrength(el);
  if (el.dataset && 'cepLookup' in el.dataset && onlyDigits(el.value).length === 8) lookupCEP(el);
  if (el.dataset && 'search' in el.dataset) {
    el.closest('form').classList.toggle('has-value', !!el.value);
    if (parseRoute().name === 'menu') { state.query = el.value.trim(); updateMenu(); }
  }
  if (el.id === 'price-range') {
    state.maxPrice = Number(el.value);
    $('#price-label').textContent = state.maxPrice >= 150 ? 'R$ 150+' : 'até ' + currency(state.maxPrice);
    updateMenu();
  }
  if (el.id === 'of-q') { state.orderFilter.q = el.value; updateOrders(); }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.name === 'cat' && el.closest('#filters')) { state.category = el.value; updateMenu(); }
  else if (el.id === 'promo-only') { state.promoOnly = el.checked; updateMenu(); }
  else if (el.id === 'sort') { state.sort = el.value; updateMenu(); }
  else if (el.id === 'of-status') { state.orderFilter.status = el.value; updateOrders(); }
  else if (el.id === 'of-period') { state.orderFilter.period = el.value; updateOrders(); }
  else if (el.name === 'payment') { state.payment = el.value; syncPayment(); }
  else if (el.name === 'address' && el.closest('.checkout')) {
    state.checkoutAddr = el.value;
    $$('.address-card').forEach((c) => c.classList.toggle('selected', $('input', c).checked));
  } else if (el.name === 'theme') {
    Theme.set(el.value);
    refreshThemeButtons();
    $$('.theme-options label').forEach((l) => l.classList.toggle('selected', $('input', l).checked));
  } else if (el.id === 'pref-news') {
    Auth.update(Auth.current().id, { newsletter: el.checked });
    toast(el.checked ? 'Você receberá novidades e ofertas.' : 'Você não receberá mais novidades.');
  } else if (el.closest('.addon')) modalUpdate();
});

document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (!el.matches || !el.matches('input,textarea,select')) return;
  if (!el.closest('form[data-form],[data-addr]') || !el.closest('.field')) return;
  if (el.value || el.dataset.touched) validateField(el);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.modal) closeModal();
    else { const n = $('#nav'); if (n && n.classList.contains('nav-open')) { n.classList.remove('nav-open'); } }
    return;
  }
  if (e.key === 'Tab' && state.modal) {
    const box = $('#modal-root [role="dialog"]');
    if (!box) return;
    const f = $$('a[href],button:not([disabled]),input:not([disabled]),select,textarea', box).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

/* Imagens que falharem ficam transparentes (mostram o fundo do cartão) */
document.addEventListener('error', (e) => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('img-fail'); }, true);

/* ------------------------------ Início ------------------------------ */
window.addEventListener('hashchange', () => { closeModal(); render(); window.scrollTo(0, 0); });
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onSys = () => { if (Theme.pref() === 'system') { Theme.apply(); refreshThemeButtons(); } };
  if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys);
}
Theme.apply();
render();

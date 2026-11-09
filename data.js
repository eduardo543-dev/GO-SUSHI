'use strict';

/* ===== Dados do cardápio (extraídos do projeto no Figma) ===== */
const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1791386809533-5c2e79e34665?auto=format&fit=crop&w=1800&q=80',
  platter: 'https://images.unsplash.com/photo-1727056354046-763e34286a8a?auto=format&fit=crop&w=1000&q=80',
  sashimi: 'https://images.unsplash.com/photo-1772285283419-b34f42b4a4df?auto=format&fit=crop&w=1000&q=80',
  nigiri: 'https://images.unsplash.com/photo-1791386797719-662a2fa77d54?auto=format&fit=crop&w=1000&q=80',
  salmon: 'https://images.unsplash.com/photo-1553621043-0af4b24ca670?auto=format&fit=crop&w=1000&q=80',
  rolls: 'https://images.unsplash.com/photo-1611810175440-aec1ef36d8c1?auto=format&fit=crop&w=1000&q=80',
  table: 'https://images.unsplash.com/photo-1727056354632-60a33376d44a?auto=format&fit=crop&w=1000&q=80',
};

const PRODUCTS = [
  { id: 1, name: 'Combinado Especial GoSushi', description: 'Salmão, atum, peixe branco, uramaki e hossomaki.', pieces: 40, price: 119.9, oldPrice: 139.9, image: IMAGES.platter, category: 'Combinados', badge: 'Mais vendido', rating: 4.9 },
  { id: 2, name: 'Combinado de Salmão', description: 'Seleção de sashimis, niguiris e uramakis de salmão.', pieces: 28, price: 89.9, image: IMAGES.salmon, category: 'Combinados', badge: 'Favorito', rating: 4.8 },
  { id: 3, name: 'Combo de Hot Rolls', description: 'Hot roll crocante com salmão e cream cheese.', pieces: 20, price: 54.9, oldPrice: 64.9, image: IMAGES.rolls, category: 'Hot rolls', badge: 'Promoção', rating: 4.7 },
  { id: 4, name: 'Combinado Tradicional', description: 'Clássicos japoneses para compartilhar em boa companhia.', pieces: 32, price: 94.9, image: IMAGES.table, category: 'Combinados', rating: 4.8 },
  { id: 5, name: 'Temaki de Salmão', description: 'Salmão fresco, cebolinha, arroz e cream cheese.', price: 32.9, image: IMAGES.nigiri, category: 'Temaki', badge: 'Favorito', rating: 4.9 },
  { id: 6, name: 'Sashimi de Salmão', description: 'Fatias nobres de salmão fresco selecionado.', pieces: 12, price: 46.9, image: IMAGES.sashimi, category: 'Sashimi', rating: 4.9 },
  { id: 7, name: 'Uramaki Filadélfia', description: 'Salmão, cream cheese, arroz e gergelim tostado.', pieces: 10, price: 36.9, image: IMAGES.rolls, category: 'Uramaki', rating: 4.7 },
  { id: 8, name: 'Nigiri Seleção do Chef', description: 'Salmão, atum e camarão sobre arroz temperado.', pieces: 8, price: 43.9, image: IMAGES.nigiri, category: 'Nigiri', badge: 'Novo', rating: 4.8 },
  { id: 9, name: 'Yakisoba Especial', description: 'Legumes, carne, frango e molho artesanal da casa.', price: 42.9, image: IMAGES.table, category: 'Yakisoba', rating: 4.6 },
  { id: 10, name: 'Combo da Semana', description: 'Seleção especial do chef com 40 peças para compartilhar.', pieces: 40, price: 99.9, oldPrice: 139.9, image: IMAGES.salmon, category: 'Combinados', badge: 'Promoção', rating: 4.9 },
  { id: 11, name: 'Hossomaki de Pepino', description: 'Rolinhos finos de pepino com gergelim, leves e crocantes.', pieces: 10, price: 24.9, image: IMAGES.rolls, category: 'Hossomaki', rating: 4.5 },
  { id: 12, name: 'Guioza de Carne', description: 'Pastelzinho japonês grelhado, servido com molho shoyu.', pieces: 6, price: 28.9, image: IMAGES.table, category: 'Entradas', rating: 4.6 },
  { id: 13, name: 'Chá Verde Gelado', description: 'Chá verde gelado 500 ml, levemente adocicado.', price: 9.9, image: IMAGES.table, category: 'Bebidas', rating: 4.4 },
];

const CATEGORIES = [
  ['Combinados', '盛'], ['Uramaki', '巻'], ['Hossomaki', '細'], ['Nigiri', '握'], ['Sashimi', '刺'],
  ['Temaki', '手'], ['Hot rolls', '揚'], ['Yakisoba', '麺'], ['Entradas', '前'], ['Bebidas', '茶'],
];

const ADDONS = [
  { name: 'Cream cheese extra', price: 3 },
  { name: 'Molho tarê', price: 3 },
  { name: 'Gengibre e wasabi', price: 0 },
];

const DELIVERY_FEE = 7.9;
const COUPONS = { OI15: { pct: 0.15, firstOrder: true, label: '15% OFF no primeiro pedido' } };

/* ===== Ícones SVG (traço) ===== */
const ICON_PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  cart: '<path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L20 8H7"/><circle cx="10" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6"/>',
  pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  arrow: '<path d="M5 12h14M14 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.7l6.2-.9L12 3Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A10 10 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
};

function icon(name, size = 20, fill = false) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (fill ? 'currentColor' : 'none') +
    '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    (ICON_PATHS[name] || '') + '</svg>';
}

'use strict';

/* ===== Utilitários gerais ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const currency = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const onlyDigits = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const fmtTime = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ms) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');

/* ===== Máscaras de formatação ===== */
/* Aplica um padrão onde "0" é um dígito. Não deixa literais sobrando no final. */
function pattern(value, pat) {
  const max = (pat.match(/0/g) || []).length;
  const d = onlyDigits(value).slice(0, max);
  let out = '';
  let i = 0;
  for (const ch of pat) {
    if (i >= d.length) break;
    out += ch === '0' ? d[i++] : ch;
  }
  return out;
}

const LETTERS = 'A-Za-zÀ-ÖØ-öø-ÿ';
const MASKS = {
  cpf: (v) => pattern(v, '000.000.000-00'),
  phone: (v) => {
    const d = onlyDigits(v).slice(0, 11);
    return pattern(d, d.length > 10 ? '(00) 00000-0000' : '(00) 0000-0000');
  },
  cep: (v) => pattern(v, '00000-000'),
  date: (v) => pattern(v, '00/00/0000'),
  card: (v) => pattern(v, '0000 0000 0000 0000'),
  expiry: (v) => pattern(v, '00/00'),
  digits: (v) => onlyDigits(v),
  money: (v) => {
    const d = onlyDigits(v).slice(0, 8).replace(/^0+/, '');
    if (!d) return '';
    return 'R$ ' + (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  name: (v) => String(v).replace(new RegExp("[^" + LETTERS + "'´ .-]", 'g'), '').replace(/\s{2,}/g, ' ').replace(/^\s+/, ''),
  cardname: (v) => MASKS.name(v).replace(/[.'´-]/g, '').toUpperCase(),
  uf: (v) => String(v).replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2),
  email: (v) => String(v).replace(/\s/g, '').toLowerCase(),
  coupon: (v) => String(v).replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
  street: (v) => String(v).replace(new RegExp("[^" + LETTERS + "0-9' .,/ºªº°-]", 'g'), '').replace(/\s{2,}/g, ' ').replace(/^\s+/, ''),
};

const maskValue = (type, v) => (MASKS[type] ? MASKS[type](v == null ? '' : v) : String(v == null ? '' : v));

function applyMask(el) {
  const fn = MASKS[el.dataset.mask];
  if (!fn) return;
  const raw = el.value;
  const pos = el.selectionStart;
  const atEnd = pos == null || pos === raw.length;
  const out = fn(raw);
  if (out === raw) return;
  el.value = out;
  try {
    if (el.dataset.mask === 'money' || atEnd) el.setSelectionRange(out.length, out.length);
    else {
      const np = fn(raw.slice(0, pos)).length;
      el.setSelectionRange(np, np);
    }
  } catch (_) { /* tipos sem seleção */ }
}

/* ===== Validadores ===== */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 80;

function isCPF(v) {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}

function isPhone(v) {
  const d = onlyDigits(v);
  if (d.length < 10 || d.length > 11) return false;
  if (Number(d.slice(0, 2)) < 11) return false;
  return d.length === 10 ? /[2-5]/.test(d[2]) : d[2] === '9';
}

function dateMsg(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return 'Use o formato DD/MM/AAAA.';
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (y < 1900 || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return 'Data inválida.';
  if (dt > new Date()) return 'A data não pode estar no futuro.';
  return '';
}

function luhn(d) {
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

function expiryMsg(v) {
  const m = /^(\d{2})\/(\d{2})$/.exec(v);
  if (!m) return 'Use o formato MM/AA.';
  const mo = Number(m[1]), y = 2000 + Number(m[2]);
  if (mo < 1 || mo > 12) return 'Mês inválido.';
  if (new Date(y, mo, 1) <= new Date()) return 'Cartão vencido.';
  return '';
}

const VALIDATORS = {
  name: (v) => (v.trim().length >= 5 && v.trim().split(/\s+/).length >= 2 ? '' : 'Informe nome e sobrenome.'),
  email: (v) => (isEmail(v) ? '' : 'Informe um e-mail válido.'),
  cpf: (v) => (isCPF(v) ? '' : 'CPF inválido.'),
  phone: (v) => (isPhone(v) ? '' : 'Informe um telefone válido com DDD.'),
  date: (v) => dateMsg(v),
  cep: (v) => (onlyDigits(v).length === 8 ? '' : 'O CEP deve ter 8 dígitos.'),
  password: (v) => (v.length < 8 ? 'A senha deve ter no mínimo 8 caracteres.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Use letras e números na senha.' : ''),
  confirm: (v, el) => {
    const scope = el.closest('form,[data-addr]') || document;
    const other = scope.querySelector('[name="' + (el.dataset.match || 'password') + '"]');
    return other && other.value === v ? '' : 'As senhas não coincidem.';
  },
  card: (v) => { const d = onlyDigits(v); return d.length >= 13 && luhn(d) ? '' : 'Número de cartão inválido.'; },
  cardname: (v) => (v.trim().length >= 3 ? '' : 'Informe o nome impresso no cartão.'),
  expiry: (v) => expiryMsg(v),
  cvv: (v) => (/^\d{3,4}$/.test(v) ? '' : 'CVV inválido (3 ou 4 dígitos).'),
  number: (v) => (/^\d{1,6}$/.test(v) ? '' : 'Informe apenas números.'),
  uf: (v) => (/^[A-Z]{2}$/.test(v) ? '' : 'Informe a UF com 2 letras.'),
  text: (v) => (v.trim().length >= 3 ? '' : 'Campo muito curto.'),
  troco: (v, el) => {
    const val = Number(onlyDigits(v)) / 100;
    const total = Number(el.dataset.total || 0);
    return val >= total ? '' : 'O valor deve ser maior ou igual ao total (' + currency(total) + ').';
  },
};

function setError(el, msg) {
  const box = el.closest('.field');
  if (!box) return;
  const err = $('.err', box);
  if (err) err.textContent = msg || '';
  box.classList.toggle('invalid', !!msg);
  el.classList.toggle('invalid', !!msg);
  if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
}

function validateField(el) {
  if (el.disabled || el.closest('[hidden]')) { setError(el, ''); return true; }
  let msg = '';
  if (el.type === 'checkbox' || el.type === 'radio') {
    if (el.required && !el.checked) msg = 'É necessário aceitar para continuar.';
  } else {
    const v = el.value.trim();
    if (el.required && !v) msg = 'Campo obrigatório.';
    else if (v && el.dataset.validate && VALIDATORS[el.dataset.validate]) msg = VALIDATORS[el.dataset.validate](v, el);
  }
  setError(el, msg);
  return !msg;
}

function validateForm(root, opts = {}) {
  let first = null;
  $$('input,textarea,select', root).forEach((el) => {
    if (opts.ignore && el.closest(opts.ignore)) return;
    if (el.type === 'radio' && !el.required) return;
    if (!validateField(el) && !first) first = el;
  });
  if (first) {
    try { first.focus({ preventScroll: false }); } catch (_) { /* noop */ }
  }
  return !first;
}

function collect(root) {
  const data = {};
  $$('[name]', root).forEach((el) => {
    if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else if (el.type === 'checkbox') data[el.name] = el.checked;
    else data[el.name] = el.value;
  });
  return data;
}

/* ===== Força da senha (0 a 4) ===== */
function passwordScore(v) {
  let s = 0;
  if (v.length >= 8) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v) || v.length >= 12) s++;
  return s;
}

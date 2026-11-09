'use strict';

/* ===================================================================
   "Backend" do GoSushi — camada de dados persistida no navegador.
   Usa apenas JavaScript (localStorage). Cada módulo (Auth, Orders)
   expõe funções assíncronas, como se fosse uma API.
   =================================================================== */
const _mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return _mem[k] == null ? null : _mem[k]; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { _mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch (_) { delete _mem[k]; } },
};

const DB = {
  read(k, d = null) { try { const v = store.get('gosushi:' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  write(k, v) { store.set('gosushi:' + k, JSON.stringify(v)); },
  remove(k) { store.del('gosushi:' + k); },
};

const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

/* ---- Hash de senha (SHA-256 com salt; fallback simples sem SubtleCrypto) ---- */
function fallbackHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

async function hashPw(password, salt, algo) {
  const useSubtle = algo ? algo === 's' : !!(window.crypto && crypto.subtle);
  if (useSubtle) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Ambiente sem suporte a criptografia.');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password));
    return 's:' + Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'f:' + fallbackHash(salt + password);
}

/* ---- Sessão: "lembrar de mim" usa localStorage, senão sessionStorage ---- */
const SESSION_KEY = 'gosushi:session';
const session = {
  get() {
    try { const s = sessionStorage.getItem(SESSION_KEY) || store.get(SESSION_KEY); return s ? JSON.parse(s) : null; } catch (_) { return null; }
  },
  set(id, remember) {
    this.clear();
    const v = JSON.stringify({ id });
    if (remember) store.set(SESSION_KEY, v);
    else { try { sessionStorage.setItem(SESSION_KEY, v); } catch (_) { store.set(SESSION_KEY, v); } }
  },
  clear() { store.del(SESSION_KEY); try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* noop */ } },
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const publicUser = (u) => { if (!u) return null; const c = Object.assign({}, u); delete c.hash; delete c.salt; return c; };

/* ---- Autenticação e dados do usuário ---- */
const Auth = {
  users() { return DB.read('users', []); },
  saveUsers(list) { DB.write('users', list); },

  current() {
    const s = session.get();
    if (!s) return null;
    return publicUser(this.users().find((u) => u.id === s.id));
  },

  async register({ name, email, cpf, phone, birth, password }) {
    await delay(350);
    const users = this.users();
    if (users.some((u) => u.email === email)) throw new Error('Este e-mail já está cadastrado.');
    if (users.some((u) => u.cpf === cpf)) throw new Error('Este CPF já está cadastrado.');
    const salt = uid();
    const user = { id: uid(), name, email, cpf, phone, birth, salt, hash: await hashPw(password, salt), newsletter: true, addresses: [], createdAt: Date.now() };
    users.push(user);
    this.saveUsers(users);
    session.set(user.id, true);
    return publicUser(user);
  },

  async login(email, password, remember) {
    await delay(350);
    const user = this.users().find((u) => u.email === email);
    const generic = new Error('E-mail ou senha incorretos.');
    if (!user) throw generic;
    const algo = user.hash.charAt(0);
    if ((await hashPw(password, user.salt, algo)) !== user.hash) throw generic;
    session.set(user.id, !!remember);
    return publicUser(user);
  },

  logout() { session.clear(); },

  update(id, patch) {
    const users = this.users();
    const u = users.find((x) => x.id === id);
    if (!u) throw new Error('Usuário não encontrado.');
    if (patch.email && users.some((x) => x.id !== id && x.email === patch.email)) throw new Error('Este e-mail já está em uso.');
    Object.assign(u, patch);
    this.saveUsers(users);
    return publicUser(u);
  },

  async changePassword(id, current, next) {
    await delay(300);
    const users = this.users();
    const u = users.find((x) => x.id === id);
    if (!u) throw new Error('Usuário não encontrado.');
    if ((await hashPw(current, u.salt, u.hash.charAt(0))) !== u.hash) throw new Error('Senha atual incorreta.');
    u.salt = uid();
    u.hash = await hashPw(next, u.salt);
    this.saveUsers(users);
  },

  addAddress(id, addr) {
    const users = this.users();
    const u = users.find((x) => x.id === id);
    if (!u) throw new Error('Usuário não encontrado.');
    const a = Object.assign({ id: uid(), main: u.addresses.length === 0 }, addr);
    u.addresses.push(a);
    this.saveUsers(users);
    return a;
  },

  removeAddress(id, addrId) {
    const users = this.users();
    const u = users.find((x) => x.id === id);
    if (!u) return;
    const wasMain = (u.addresses.find((a) => a.id === addrId) || {}).main;
    u.addresses = u.addresses.filter((a) => a.id !== addrId);
    if (wasMain && u.addresses[0]) u.addresses[0].main = true;
    this.saveUsers(users);
  },

  setMainAddress(id, addrId) {
    const users = this.users();
    const u = users.find((x) => x.id === id);
    if (!u) return;
    u.addresses.forEach((a) => { a.main = a.id === addrId; });
    this.saveUsers(users);
  },
};

/* ---- Pedidos ---- */
const Orders = {
  all() { return DB.read('orders', []); },
  byUser(userId) { return this.all().filter((o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt); },
  get(id) { return this.all().find((o) => o.id === id) || null; },
  create(order) {
    const list = this.all();
    let id;
    do { id = 'GS' + String(Math.floor(10000 + Math.random() * 90000)); } while (list.some((o) => o.id === id));
    const o = Object.assign({ id, createdAt: Date.now(), cancelled: false }, order);
    list.push(o);
    DB.write('orders', list);
    return o;
  },
  cancel(id) {
    const list = this.all();
    const o = list.find((x) => x.id === id);
    if (o) { o.cancelled = true; DB.write('orders', list); }
  },
};

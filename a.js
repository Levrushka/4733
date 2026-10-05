'use strict';
(() => {
const BASE = document.documentElement.dataset.base || '/';
const ITER = 60000, TOTAL = 33;
const BV = document.documentElement.dataset.v || '';
try { for (const k of Object.keys(localStorage)) if (k.startsWith('zb') && !k.startsWith('zb' + BV + '_')) localStorage.removeItem(k); } catch (e) {}
const WORDS = [4, 5, 2, 4, 6, 6, 6];
const TE = new TextEncoder(), TD = new TextDecoder();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const app = $('#app');
const INTRO = (() => { const t = document.getElementById('intro'); return t ? t.innerHTML : ''; })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const norm = s => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9:]/g, '');
function b64d(s) { const b = atob(s.trim()); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
async function sha(s) { const h = await crypto.subtle.digest('SHA-256', TE.encode(s)); return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join(''); }
const kid = async n => (await sha('zh|' + n)).slice(0, 20);

/* ---------- progress ---------- */
const prog = () => LS.get('zk', []);
const has = n => prog().some(p => p.n === n);
function addProg(n, id) { const p = prog(); if (!p.some(x => x.n === n)) { p.push({ n, id, t: Date.now() }); LS.set('zk', p); } }
const cache = {};
async function bundle(n) {
  const id = await kid(n);
  if (cache[id]) return { n, id, d: cache[id] };
  const st = LS.get('zb' + BV + '_' + id); if (st) { cache[id] = st; return { n, id, d: st }; }
  let r; try { r = await fetch(BASE + 'd/' + id + '.j', { cache: 'no-cache' }); } catch (e) { return { err: 1 }; }
  if (!r.ok) return null;
  const raw = b64d(await r.text());
  try {
    const base = await crypto.subtle.importKey('raw', TE.encode(n), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: TE.encode('zh-salt|' + id), iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
    const d = JSON.parse(TD.decode(pt)); cache[id] = d; LS.set('zb' + BV + '_' + id, d); return { n, id, d };
  } catch (e) { return null; }
}
async function allFound() { const out = []; for (const p of prog()) { const b = await bundle(p.n); if (b && b.d) out.push(b); } return out; }
const mcache = {};
async function murl(m) {
  if (mcache[m.s]) return mcache[m.s];
  const r = await fetch(BASE + m.s); const u = new Uint8Array(await r.arrayBuffer());
  const k = await crypto.subtle.importKey('raw', b64d(m.k), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, k, u.slice(12));
  return (mcache[m.s] = URL.createObjectURL(new Blob([pt], { type: m.t })));
}
async function frags() { const f = {}; for (const b of await allFound()) if (b.d.frag) f[b.d.frag[0]] = b.d.frag[1]; return f; }

/* ---------- audio bits ---------- */
let AC;
function beep(freq = 700, dur = 0.12, vol = 0.08, when = 0) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = freq; o.type = 'sine';
    g.gain.value = 0; o.connect(g); g.connect(AC.destination);
    const t = AC.currentTime + when; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setValueAtTime(vol, t + dur - 0.01); g.gain.linearRampToValueAtTime(0, t + dur); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}

/* ---------- hydration of content ---------- */
async function hydrate(root, media) {
  media = media || {};
  for (const el of $$('x-img', root)) {
    const m = media[el.dataset.m]; if (!m) continue;
    const fig = document.createElement('figure'); fig.className = 'xi ' + (el.className || '');
    const img = document.createElement('img'); img.alt = el.dataset.alt || ''; img.loading = 'lazy'; fig.appendChild(img);
    if (el.dataset.cap) { const c = document.createElement('figcaption'); c.innerHTML = el.dataset.cap; fig.appendChild(c); }
    if (el.hasAttribute('data-dl')) { const a = document.createElement('a'); a.className = 'dl'; a.textContent = el.dataset.dl || '⬇ скачать оригинал'; a.download = m.n; fig.appendChild(a); murl(m).then(u => a.href = u); }
    el.replaceWith(fig);
    const nz = !!fig.closest('.flip');
    murl(m).then(u => { img.src = u; if (!nz) img.onclick = () => zoom(u); }).catch(() => { img.alt = '[ошибка загрузки]'; });
  }
  for (const el of $$('x-aud', root)) {
    const m = media[el.dataset.m]; if (!m) continue;
    const w = document.createElement('div'); w.className = 'xa';
    const lab = document.createElement('div'); lab.className = 'xal'; lab.textContent = '▶ ' + (el.dataset.label || m.n); w.appendChild(lab);
    const au = document.createElement('audio'); au.controls = true; au.preload = 'none'; w.appendChild(au);
    const a = document.createElement('a'); a.className = 'dl'; a.textContent = '⬇ ' + m.n; a.download = m.n; w.appendChild(a);
    el.replaceWith(w);
    murl(m).then(u => { au.src = u; a.href = u; });
  }
  for (const el of $$('x-dl', root)) {
    const m = media[el.dataset.m]; if (!m) continue;
    const a = document.createElement('a'); a.className = 'dl big'; a.textContent = '⬇ ' + (el.textContent || m.n); a.download = m.n;
    el.replaceWith(a); murl(m).then(u => a.href = u);
  }
  for (const el of $$('[data-w]', root)) { const f = W[el.dataset.w]; if (f) try { f(el); } catch (e) { console.error(e); } }
}
function zoom(u) {
  const z = document.createElement('div'); z.className = 'zoom'; z.innerHTML = '<img>'; z.firstChild.src = u;
  z.onclick = () => z.remove(); document.body.appendChild(z);
}

/* ---------- unlock (universal) ---------- */
async function unlock(raw, opts = {}) {
  const n = norm(raw); if (!n) return { st: 'empty' };
  const b = await bundle(n);
  if (!b) return { st: 'no', n };
  if (b.err) return { st: 'net' };
  if (opts.accept && !opts.accept(b.d)) return { st: 'no', n };
  const fresh = !has(n); addProg(n, b.id);
  return { st: 'ok', n, b, fresh };
}
function fragLine(f, fresh, cnt) {
  if (!f) return '';
  return `<div class="frag${fresh ? ' new' : ''}">◈ ФРАГМЕНТ ОТВЕТА № ${f[0]} — «${esc(f[1])}» <span>(собрано ${cnt} из ${TOTAL} · команда «ответ»)</span></div>`;
}
const siteTitle = { nii: 'сайт ТФ НИИ ДРС', forum: 'форум «Шестёрка»', box: 'коробка Веры', final: 'передатчик' };
function siteHref(site, page) {
  const p = prog();
  return BASE + '#/s/' + site + (page ? '/' + page : '');
}

/* ---------- widgets ---------- */
const W = {};
W.lamp = el => {
  const code = el.dataset.code; const u = +(el.dataset.u || 130);
  const seq = []; for (const ch of code) { if (ch === '.') seq.push(1, -1); else if (ch === '-') seq.push(3, -1); else if (ch === ' ') seq.push(-2); else if (ch === '/') seq.push(-6); }
  seq.push(-12);
  el.innerHTML = '<span class="bulb"></span>';
  const b = el.firstChild; let i = 0;
  (function step() { if (!document.body.contains(el)) return; const v = seq[i++ % seq.length]; b.classList.toggle('on', v > 0); setTimeout(step, Math.abs(v) * u); })();
};
function keyForm(el, opts) {
  // generic: fields -> key, messages
  const f = document.createElement('form'); f.className = 'kf ' + (opts.cls || '');
  f.innerHTML = opts.html; el.appendChild(f);
  const msg = document.createElement('div'); msg.className = 'kfm'; f.appendChild(msg);
  f.onsubmit = async ev => {
    ev.preventDefault(); const key = opts.key(f); if (!norm(key)) return;
    msg.textContent = opts.wait || '…'; msg.className = 'kfm';
    const site = (document.body.className.match(/v-(\w+)/) || [])[1] || 'term';
    const r = await unlock(key, { accept: d => site === 'term' || d.site === site || (d.via || []).includes(site) });
    if (r.st === 'ok') { msg.textContent = opts.ok || 'Принято.'; msg.className = 'kfm ok'; await afterUnlock(r, opts); }
    else if (r.st === 'net') { msg.textContent = 'Нет соединения. Попробуйте ещё раз.'; msg.className = 'kfm err'; }
    else { msg.innerHTML = typeof opts.bad === 'function' ? opts.bad(f) : (opts.bad || 'Ничего не найдено.'); msg.className = 'kfm err'; }
  };
}
async function afterUnlock(r, opts = {}) {
  const d = r.b.d; const cnt = Object.keys(await frags()).length;
  if (d.frag && r.fresh) toast(fragLine(d.frag, true, cnt));
  if (d.go) { location.href = BASE + '#/s/' + d.go[0] + (d.go[1] ? '/' + d.go[1] : ''); if (opts.reroute !== false) setTimeout(route, 30); return; }
  if (d.kind === 'site' || d.kind === 'add') { location.hash = '#/s/' + d.site + (d.open ? '/' + d.open : ''); setTimeout(route, 30); return; }
  // records -> show in terminal
  if (document.body.className === 'v-term' && out && document.body.contains(out)) { await printBundle(r.b, r.fresh); return; }
  LS.set('zshow', r.n); location.href = BASE + '#/t'; setTimeout(route, 30);
}
function toast(html) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 5200); setTimeout(() => t.remove(), 6000);
}
W.search = el => keyForm(el, {
  cls: el.dataset.cls, html: `<input name="q" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(el.dataset.ph || 'введите…')}"><button>${esc(el.dataset.btn || 'Найти')}</button>`,
  key: f => f.q.value, bad: el.dataset.bad || 'Ничего не найдено.', ok: el.dataset.ok || 'Найдено.'
});
W.login = el => keyForm(el, {
  cls: 'login', html: `<label>${esc(el.dataset.l1 || 'Логин')}<input name="u" autocomplete="off" autocapitalize="off" spellcheck="false"></label><label>${esc(el.dataset.l2 || 'Пароль')}<input name="p" type="${el.dataset.pt || 'password'}" autocomplete="off" autocapitalize="off" spellcheck="false"></label><button>${esc(el.dataset.btn || 'Войти')}</button>`,
  key: f => norm(f.u.value) + ':' + norm(f.p.value),
  bad: f => /[а-яё]/i.test(f.p.value) && el.dataset.layout ? 'Неверный логин или пароль. <b>Проверьте раскладку клавиатуры.</b>' : (el.dataset.bad || 'Неверный логин или пароль.'),
  ok: 'Вход выполнен.'
});
W.dial = el => {
  el.innerHTML = '<div class="phone"><div class="pnum">_-__-__</div><div class="pkeys"></div><div class="pst">Наберите номер</div></div>';
  const keys = el.querySelector('.pkeys'), num = el.querySelector('.pnum'), st = el.querySelector('.pst');
  let s = '';
  const show = () => { const p = (s + '_____').slice(0, 5); num.textContent = p[0] + '-' + p.slice(1, 3) + '-' + p.slice(3, 5); };
  const dtmf = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '0': [941, 1336] };
  for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '☎']) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = k; keys.appendChild(b);
    b.onclick = async () => {
      if (k === '⌫') { s = s.slice(0, -1); show(); return; }
      if (k === '☎') {
        if (s.length < 5) { st.textContent = 'Номер короткий: пять цифр.'; return; }
        st.textContent = 'Соединение…'; for (let i = 0; i < 2; i++) { beep(425, 0.9, 0.06, i * 3.2); }
        await sleep(2600);
        const r = await unlock(s);
        if (r.st === 'ok') { st.textContent = 'Снята трубка.'; await afterUnlock(r); }
        else { st.textContent = 'Номер не обслуживается.'; for (let i = 0; i < 4; i++) beep(425, 0.35, 0.05, i * 0.7); s = ''; show(); }
        return;
      }
      if (s.length >= 5) return; s += k; show(); const f = dtmf[k]; beep(f[0], 0.12, 0.04); beep(f[1], 0.12, 0.04);
    };
  }
  show();
};
W.boxlock = el => keyForm(el, {
  cls: 'boxlock', html: `<label>Кто поджёг станцию?<input name="a" autocomplete="off" spellcheck="false"></label><label>Какую фамилию она носит теперь?<input name="b" autocomplete="off" spellcheck="false"></label><button>Открыть</button>`,
  key: f => norm(f.a.value) + ':' + norm(f.b.value), bad: 'Замок не поддаётся.', ok: 'Щёлк.'
});
W.ghost = el => {
  const tpl = el.querySelector('template'); const hid = document.createElement('div'); hid.className = 'ghosthid'; el.appendChild(hid);
  const tick = () => {
    if (!document.body.contains(el)) return;
    const on = new Date().getMinutes() === 33;
    if (on && !el.querySelector('.ghostin')) { const c = document.createElement('div'); c.className = 'ghostin'; c.appendChild(tpl.content.cloneNode(true)); el.insertBefore(c, hid); hydrate(c, el._media); hid.textContent = ''; }
    if (!on) { const g = el.querySelector('.ghostin'); if (g) g.remove(); hid.textContent = el.dataset.off || 'Сообщение скрыто автором.'; }
    setTimeout(tick, 5000);
  };
  tick();
};
W.flip = el => { el.addEventListener('click', () => el.classList.toggle('flipped')); };
W.board = async el => {
  const f = await frags(); let i = 1, h = '';
  for (const w of WORDS) { h += '<span class="bw">'; for (let j = 0; j < w; j++, i++) h += `<span class="bc${f[i] ? ' on' : ''}" title="${i}"><i>${i}</i>${f[i] ? esc(f[i]) : ''}</span>`; h += '</span>'; }
  el.innerHTML = h;
};
W.console = el => {
  const fin = LS.get('zmsg', null);
  el.innerHTML = `<div class="con">
   <div class="conrow"><span>ЧАСТОТА</span><b>4733 кГц</b></div>
   <div class="conrow"><span>ВРЕМЯ</span><b class="clk">--:--:--</b></div>
   <div class="conrow"><span>ОКНО</span><b class="win">—</b></div>
   <div class="conboard" data-w="board"></div>
   <form class="cmsg"><label>СООБЩЕНИЕ (${TOTAL} букв)<textarea name="m" rows="2" autocomplete="off" spellcheck="false"></textarea></label><button>ЗАПИСАТЬ</button><div class="kfm"></div></form>
   <form class="csend"><label>ПОДПИСЬ<input name="s" maxlength="40" autocomplete="off" placeholder="кто вы?"></label><button class="tx">В ЭФИР</button><div class="kfm"></div></form>
  </div>`;
  W.board(el.querySelector('.conboard'));
  const clk = el.querySelector('.clk'), win = el.querySelector('.win'), tx = el.querySelector('.tx');
  const inWin = () => { const d = new Date(); return d.getHours() === 3 && d.getMinutes() >= 30 && d.getMinutes() <= 39; };
  const tick = () => {
    if (!document.body.contains(el)) return; const d = new Date();
    clk.textContent = d.toTimeString().slice(0, 8); const ok = inWin();
    win.textContent = ok ? 'ОТКРЫТО' : 'ЗАКРЫТО · откроется в 03:30'; win.className = 'win' + (ok ? ' open' : '');
    setTimeout(tick, 1000);
  };
  tick();
  const fm = el.querySelector('.cmsg'), fs = el.querySelector('.csend');
  if (LS.get('zmsgok', null)) { fm.m.value = LS.get('zmsgok'); fm.querySelector('.kfm').textContent = 'Сообщение записано.'; }
  fm.onsubmit = async ev => {
    ev.preventDefault(); const m = fm.querySelector('.kfm');
    const n = norm(fm.m.value); if (n.length !== TOTAL) { m.textContent = `Нужно ровно ${TOTAL} букв. Сейчас: ${n.length}.`; m.className = 'kfm err'; return; }
    m.textContent = '…'; const r = await unlock(n);
    if (r.st === 'ok') { LS.set('zmsgok', fm.m.value.toUpperCase()); m.textContent = 'Сообщение записано. Ждите окна.'; m.className = 'kfm ok'; const cnt = Object.keys(await frags()).length; if (r.fresh && r.b.d.frag) toast(fragLine(r.b.d.frag, true, cnt)); W.board(el.querySelector('.conboard')); }
    else { m.textContent = 'Передатчик не принимает это сообщение.'; m.className = 'kfm err'; }
  };
  fs.onsubmit = async ev => {
    ev.preventDefault(); const m = fs.querySelector('.kfm');
    const msg = LS.get('zmsgok', null); if (!msg) { m.textContent = 'Сначала запишите сообщение.'; m.className = 'kfm err'; return; }
    if (!fs.s.value.trim()) { m.textContent = 'Нужна подпись.'; m.className = 'kfm err'; return; }
    if (!inWin()) { m.textContent = 'Окно закрыто. Эхо не ждёт удобного времени: 03:30–03:39.'; m.className = 'kfm err'; return; }
    const r = await unlock(msg); if (r.st !== 'ok') return;
    LS.set('zfin', { s: fs.s.value.trim(), t: Date.now() });
    transmit(msg, r.b);
  };
};
const RMORSE = { 'А': '.-', 'Б': '-...', 'В': '.--', 'Г': '--.', 'Д': '-..', 'Е': '.', 'Ё': '.', 'Ж': '...-', 'З': '--..', 'И': '..', 'Й': '.---', 'К': '-.-', 'Л': '.-..', 'М': '--', 'Н': '-.', 'О': '---', 'П': '.--.', 'Р': '.-.', 'С': '...', 'Т': '-', 'У': '..-', 'Ф': '..-.', 'Х': '....', 'Ц': '-.-.', 'Ч': '---.', 'Ш': '----', 'Щ': '--.-', 'Ъ': '--.--', 'Ы': '-.--', 'Ь': '-..-', 'Э': '..-..', 'Ю': '..--', 'Я': '.-.-' };
async function transmit(msg, b) {
  app.innerHTML = '<div class="tx-screen"><div class="txl">ПЕРЕДАЧА · 4733 кГц</div><div class="txm"></div><div class="txs"></div></div>';
  document.body.className = 'v-final';
  const m = $('.txm'), s = $('.txs'); const u = 0.07; let t = 0;
  const letters = norm(msg).toUpperCase().split('');
  for (const ch of letters) { const c = RMORSE[ch] || ''; for (const x of c) { beep(640, (x === '.' ? 1 : 3) * u, 0.07, t); t += (x === '.' ? 1 : 3) * u + u; } t += 2 * u; }
  for (const ch of letters) { m.textContent += ch; await sleep(t * 1000 / letters.length); }
  s.textContent = 'ПЕРЕДАЧА ЗАВЕРШЕНА'; await sleep(2500);
  s.textContent = 'ОЖИДАНИЕ ЭХА…'; await sleep(3500);
  s.textContent = 'ПОДТВЕРЖДЕНИЕ ПРИЁМА: 12.10.1993 03:33'; await sleep(3500);
  location.hash = '#/s/final/end'; route();
}

/* ---------- terminal ---------- */
const NOPE = ['СИГНАЛ НЕ РАСПОЗНАН.', 'ШУМ. ТОЛЬКО ШУМ.', 'КЛЮЧ НЕ ПОДХОДИТ.', 'ЭФИР МОЛЧИТ.', 'НЕТ СОВПАДЕНИЙ.'];
let out, busy = false;
function line(html, cls = '') { const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html; out.appendChild(d); scr(); return d; }
const scr = () => { window.scrollTo(0, document.body.scrollHeight); };
async function typeLine(text, cls = '', speed = 12) {
  const d = line('', cls); for (let i = 0; i < text.length; i++) { d.textContent += text[i]; if (i % 3 === 0) await sleep(speed); } scr(); return d;
}
async function printBundle(b, fresh) {
  const d = b.d; const cnt = Object.keys(await frags()).length;
  if (d.rec) {
    const r = d.rec; const box = document.createElement('div'); box.className = 'rec from-' + (r.from || 'sys');
    box.innerHTML = `<div class="rh"><b>${esc(r.title)}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ''}</div><div class="rb">${r.html}</div>`;
    out.appendChild(box); await hydrate(box, d.media);
  }
  if (d.kind === 'site' || d.kind === 'add') {
    line(`▸ ${esc(d.note || 'Новые материалы')}: <a href="${siteHref(d.site, d.open)}">${esc(siteTitle[d.site] || d.site)} →</a>`, 'sys');
  }
  if (d.frag) line(fragLine(d.frag, fresh, cnt));
  scr();
}
async function tryKey(v) {
  const n = norm(v); if (!n) return;
  line('&gt; ' + esc(v), 'me');
  const cmd = v.trim().toLowerCase().replace(/ё/g, 'е');
  if (await command(cmd, v.trim())) return;
  const wait = line('…приём…', 'dim');
  const r = await unlock(v); wait.remove();
  if (r.st === 'ok') { if (!r.fresh) line('(уже принято ранее)', 'dim'); await printBundle(r.b, r.fresh); }
  else if (r.st === 'net') line('НЕТ СВЯЗИ С ПРИЁМНИКОМ. Проверьте интернет.', 'err');
  else line(NOPE[Math.floor(Math.random() * NOPE.length)], 'err');
}
async function command(c, raw) {
  const [w, ...rest] = c.split(/\s+/);
  const rawRest = (raw || '').split(/\s+/).slice(1);
  if (['помощь', 'help', '?', 'команды'].includes(w)) {
    line(`<div class="help">ВВОДИТЕ КЛЮЧИ — любое найденное слово, число или фразу. Регистр, пробелы и «ё» не важны.
Некоторые ключи — не слова, а адреса: их дописывают к адресу страницы через «/».
<b>журнал</b> — всё принятое · <b>ответ</b> — собранные фрагменты
<b>сеанс</b> — код для переноса прогресса на другое устройство · <b>сеанс КОД</b> — загрузить
<b>очистить</b> — очистить экран · <b>сброс</b> — стереть прогресс на этом устройстве</div>`); return true;
  }
  if (['журнал', 'log'].includes(w)) {
    const all = await allFound(); if (!all.length) { line('Журнал пуст.', 'dim'); return true; }
    let h = '<div class="jr">'; let i = 0;
    for (const b of all) { i++; const d = b.d; const t = d.rec ? d.rec.title : (d.note || siteTitle[d.site] || '—'); const href = d.rec ? '#/t/r/' + b.n : siteHref(d.site, d.open); h += `<a href="${href}">${String(i).padStart(2, '0')} · ${esc(t)}</a>`; }
    line(h + '</div>'); return true;
  }
  if (['ответ', 'фрагменты'].includes(w)) {
    const d = line('<div class="board" data-w="board"></div><div class="dim">Пустые клетки — фрагменты, которые ещё не найдены.</div>'); await W.board($('.board', d)); return true;
  }
  if (w === 'сеанс') {
    if (!rest.length) { const code = btoa(unescape(encodeURIComponent(prog().map(p => p.n).join('|')))); line(`Код сеанса (скопируйте целиком и введите на другом устройстве: <b>сеанс КОД</b>):<div class="code">${esc(code)}</div>`); }
    else {
      try {
        const keys = decodeURIComponent(escape(atob(rawRest.join('')))).split('|'); let ok = 0;
        for (const k of keys) { const r = await unlock(k); if (r.st === 'ok') ok++; }
        line(`Загружено ключей: ${ok}.`, 'sys');
      } catch (e) { line('Код повреждён.', 'err'); }
    }
    return true;
  }
  if (['очистить', 'clear', 'cls'].includes(w)) { out.innerHTML = ''; return true; }
  if (w === 'сброс') {
    if (rest[0] === 'да') { for (const k of Object.keys(localStorage)) if (k.startsWith('z')) LS.del(k); line('Прогресс стёрт.', 'sys'); setTimeout(() => location.reload(), 800); }
    else line('Это сотрёт весь прогресс на этом устройстве. Если уверены: <b>сброс да</b>', 'err');
    return true;
  }
  if (['коробка', 'box'].includes(w)) {
    const all = await allFound(); if (all.some(b => b.d.site === 'box')) { location.hash = '#/s/box'; route(); }
    else if (all.some(b => b.d.boxhint)) { const d = line('<div data-w="boxlock"></div>'); await hydrate(d, {}); }
    else line('Какая коробка?', 'dim');
    return true;
  }
  return false;
}
const BOOT = `ЖАВОРОНОК-2 · ПРИЁМНЫЙ ТЕРМИНАЛ
НЕСУЩАЯ ........ 4733 кГц · ЕСТЬ
ЗАДЕРЖКА ЭХА ... 33 г. 00 мес.
ПОТОК .......... 1993 → 2026
ДЕКОДЕР ........ ЖДЁТ КЛЮЧ`;
async function renderTerminal(sub) {
  document.body.className = 'v-term';
  app.innerHTML = `<div class="term"><div class="scan"></div><canvas id="wf" width="300" height="48"></canvas><div id="out"></div>
   <form id="in" autocomplete="off"><span>&gt;</span><input id="q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="введите ответ или «помощь»"><button aria-label="ввод">⏎</button></form></div>`;
  out = $('#out'); waterfall($('#wf'));
  const fin = LS.get('zfin', null);
  const first = !LS.get('zboot', false); LS.set('zboot', true);
  for (const l of BOOT.split('\n')) first ? await typeLine(l, 'sys', 6) : line(esc(l), 'sys');
  if (fin) line('ЭХО ЗАМКНУТО. ЗАДЕРЖКА: 0. <a href="#/s/final/end">эпилог →</a>', 'sys');
  if (INTRO) line(INTRO, 'in');
  const show = LS.get('zshow', null); LS.del('zshow');
  const rk = sub && sub[0] === 'r' ? decodeURIComponent(sub[1] || '') : show;
  if (rk) { const b = await bundle(rk); if (b && b.d) await printBundle(b, false); }
  else if (prog().length) line('Принято ключей: ' + prog().length + '. Команда «журнал» покажет всё.', 'dim');
  $('#in').onsubmit = async ev => { ev.preventDefault(); if (busy) return; const q = $('#q'); const v = q.value; q.value = ''; busy = true; try { await tryKey(v); } finally { busy = false; } };
  if (!rk) setTimeout(() => { try { $('#q').focus({ preventScroll: true }); } catch (e) {} }, 300);
  scr();
}

function waterfall(c) {
  const x = c.getContext('2d'), W = c.width, H = c.height; let t = 0;
  (function f() {
    if (!document.body.contains(c)) return;
    if (t++ % 3 === 0) {
      x.drawImage(c, 0, 0, W, H - 1, 0, 1, W, H - 1);
      const row = x.createImageData(W, 1);
      for (let i = 0; i < W; i++) {
        let v = Math.random() * 60;
        const d = Math.abs(i - W * 0.5); if (d < 2) v += 150 + Math.random() * 60; else if (d < 6) v += 50;
        if (Math.random() < 0.004) v += 120;
        row.data[i * 4] = v * 0.35; row.data[i * 4 + 1] = v; row.data[i * 4 + 2] = v * 0.5; row.data[i * 4 + 3] = 255;
      }
      x.putImageData(row, 0, 0);
    }
    requestAnimationFrame(f);
  })();
}

/* ---------- sites ---------- */
async function siteModel(name) {
  const all = await allFound(); const m = { pages: {}, shell: null, media: {}, flags: {} };
  const fin = LS.get('zfin', null);
  for (const b of all) {
    const d = b.d;
    const parts = [d].concat(d.extra || []);
    for (const x of parts) {
      if (x.site !== name) continue;
      if (x.kind === 'site') m.shell = x;
      Object.assign(m.media, d.media || {}, x.media || {});
      for (const p of (x.pages || [])) {
        if (p.fin && !fin) continue;
        const o = m.pages[p.id]; if (!o || (p.v || 0) >= (o.v || 0)) m.pages[p.id] = p;
      }
    }
  }
  return m;
}
async function renderSite(name, page) {
  let m = await siteModel(name);
  if (!m.shell) {
    const par = (await allFound()).map(b => b.d).find(d => d.site === name && d.parent);
    if (par) { await unlock(par.parent); m = await siteModel(name); }
  }
  if (!m.shell) { render404(); return; }
  const sh = m.shell;
  document.body.className = 'v-' + name;
  const pages = Object.values(m.pages).sort((a, b) => (a.o || 0) - (b.o || 0));
  const cur = m.pages[page] || m.pages[sh.home] || pages[0];
  const fin = LS.get('zfin', null);
  let html = (cur.html || '');
  if (fin) html = html.replace(/\{\{SIG\}\}/g, esc(fin.s));
  const menu = pages.filter(p => p.menu).map(p => `<a href="#/s/${name}/${p.id}" class="${p === cur ? 'cur' : ''}${p.sec ? ' sec-' + p.sec : ''}${p.lk ? ' lk' : ''}">${p.menu === true ? esc(p.title) : p.menu}</a>`).join('');
  const lists = {};
  for (const p of pages) if (p.list) (lists[p.list] = lists[p.list] || []).push(p);
  html = html.replace(/<x-list data-l="([\w-]+)"><\/x-list>/g, (_, l) => (lists[l] || []).map(p => p.row || `<a href="#/s/${name}/${p.id}">${esc(p.title)}</a>`).join(''));
  app.innerHTML = sh.chrome.replace('{{MENU}}', menu).replace('{{TITLE}}', esc(cur.title || '')).replace('{{BODY}}', html);
  document.title = (cur.title ? cur.title + ' — ' : '') + (sh.ttl || '');
  for (const g of $$('[data-w="ghost"]')) g._media = m.media;
  await hydrate(app, m.media);
  window.scrollTo(0, 0);
}
function render404() {
  document.body.className = 'v-404';
  app.innerHTML = `<div class="nf"><canvas id="nz"></canvas><div class="nft"><b>НЕТ СИГНАЛА</b><span>По этому адресу ничего нет. Или пока нет.</span><a href="${BASE}">← к приёмнику</a></div></div>`;
  const c = $('#nz'), x = c.getContext('2d'); c.width = 160; c.height = 120;
  (function f() { if (!document.body.contains(c)) return; const im = x.createImageData(160, 120); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 90 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); requestAnimationFrame(f); })();
}

/* ---------- router ---------- */
let routing = false, again = false;
async function route() {
  if (routing) { again = true; return; } routing = true; again = false;
  for (const z of $$('.zoom')) z.remove();
  try {
    const path = decodeURIComponent(location.pathname);
    let rel = path.startsWith(BASE) ? path.slice(BASE.length) : path.replace(/^\//, '');
    rel = rel.replace(/index\.html$|404\.html$/, '');
    const h = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const seg = rel.split('/').filter(Boolean)[0];
    if (seg) {
      const r = await unlock(seg);
      if (r.st === 'ok' && h.length) { history.replaceState(null, '', BASE + location.hash); }
      else if (r.st === 'ok') {
        const d = r.b.d;
        if (d.frag && r.fresh) toast(fragLine(d.frag, true, Object.keys(await frags()).length));
        if (d.site) { history.replaceState(null, '', BASE + '#/s/' + d.site + (d.open ? '/' + d.open : '')); routing = false; return route(); }
        LS.set('zshow', r.n); history.replaceState(null, '', BASE + '#/t'); routing = false; return route();
      }
      else { render404(); return; }
    }
    if (h[0] === 's' && h[1]) return await renderSite(h[1], h[2]);
    if (h[0] === 't') return await renderTerminal(h.slice(1));
    return await renderTerminal([]);
  } finally { routing = false; if (again) { again = false; setTimeout(route, 0); } }
}
window.addEventListener('hashchange', route);
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  if (location.pathname.replace(/index\.html$/, '') !== BASE) { e.preventDefault(); location.href = BASE + a.getAttribute('href'); }
});
route();
})();

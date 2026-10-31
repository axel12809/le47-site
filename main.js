import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ================================================================
   RÉGLAGES RAPIDES — à compléter avec le restaurant
   ================================================================ */
const CONFIG = {
  // Liens exacts des fiches Uber Eats / Deliveroo du 47
  ubereats: 'https://www.ubereats.com/fr/store/le-47/Wgzlh7slUw2ZcWx2uCXz9w?utm_campaign=CM2508147-search-free-nonbrand-google-pas_e_all_acq_Global&utm_medium=search-free-nonbrand&utm_source=google-pas&rwg_token=ALcMQYYNL2hkwQMKaRTQOsxix6LfRFX7h7eSJoWykTuwg3ITBb8EdNPqvT_iAVAfECXIdHaaj6mxn1pM3EiaflerDQcIxq5PnQ%3D%3D',
  deliveroo: 'https://deliveroo.fr/fr/menu/toulouse/la-cepiere-croix-de-pierre/le-47-burgers?utm_medium=affiliate&utm_source=google_maps_link&fulfillment_type=DELIVERY&utm_campaign=delivery&rwg_token=ALcMQYYQSpM53FVbFybaZx_B1AIojopb3Ukcblpr0_p-nXJe6_M4CMSfD3cI7gi7N1gfftpxiO76w8sShs87tM1oN3KPGLOVIQ%3D%3D',
  // Horaires, ex. 'Tous les jours · 11h30–14h30 / 18h30–23h'. Vide = message de réouverture.
  hours: 'Tous les jours (7j/7) · 12h00 à 01h00',
  // Facultatif : un vrai modèle 3D scanné (.glb) remplace le modèle calculé par le code.
  // Ex. burger: 'models/burger.glb'. Laisser vide pour garder le modèle du code.
  models: { burger: '', menu: '', mega: '', pizza: '', tacos: '', sandwich: '', plate: '' }
};

/* Produits photographiés sous plusieurs angles (0° à 180°, tous les 30°).
   mirror : les vues 210° à 330° sont les vues 150° à 30° retournées (aliments symétriques).
   pingpong : le tour revient en arrière (évite d'afficher un logo à l'envers). */
const PHOTO = {
  burger:   { frames: 7, mode: 'mirror' },
  mega:     { frames: 7, mode: 'mirror', src: 'burger' }, // en attendant les photos du Mega 47
  menu:     { frames: 7, mode: 'pingpong' },
  tacos:    { frames: 7, mode: 'mirror' },
  sandwich: { frames: 7, mode: 'mirror' },
  plate:    { frames: 7, mode: 'mirror' }
};
const frameSrc = (name, i) => { const n = PHOTO[name]?.src || name; return window.__FRAMES?.[n]?.[i] || `img/${n}/${i}.webp`; };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, to, rate, dt) => lerp(cur, to, 1 - Math.exp(-rate * dt));
const TAU = Math.PI * 2;

const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 760;

/* ---------------------------------------------------------------- contenu */
if (CONFIG.ubereats) $$('[data-link="ubereats"]').forEach(a => a.href = CONFIG.ubereats);
if (CONFIG.deliveroo) $$('[data-link="deliveroo"]').forEach(a => a.href = CONFIG.deliveroo);
if (CONFIG.hours) $('#hours').textContent = CONFIG.hours;
$$('[data-until]').forEach(el => { if (Date.now() > Date.parse(el.dataset.until)) el.remove(); });

$$('.split').forEach(h => {
  const words = h.textContent.trim().split(/\s+/);
  const em = h.querySelector('em')?.textContent.trim().split(/\s+/) || [];
  h.setAttribute('aria-label', h.textContent.trim());
  const emStart = em.length ? words.length - em.length : 1e9;
  h.innerHTML = words.map((w, i) => {
    const safe = w.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const inner = i >= emStart ? `<em>${safe}</em>` : safe;
    return `<span class="w" aria-hidden="true"><span style="--i:${i}">${inner}</span></span>`;
  }).join(' ');
});
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }), { threshold: .12 });
$$('.chap').forEach(s => io.observe(s));

/* ---------------------------------------------------------------- bruit et textures
   Toutes les textures sont peintes ici, pixel par pixel. Aucune image téléchargée. */
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const R = mulberry32(47031);
const h2 = (x, y) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x2f47; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 4) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); n += a; f *= 2.03; a *= .5; } return s / n; }
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mixc = (a, b, t, o) => { t = clamp(t, 0, 1); o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerp(a[2], b[2], t); return o; };

/* fn(u, v, o) remplit o = [r, g, b, relief, rugosité], chaque valeur entre 0 et 1.
   On en tire trois textures : couleur, normales (relief fin) et rugosité (zones brillantes ou mates). */
const ridged = (x, y, o = 4) => { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); n += a; f *= 2.1; a *= .5; } return s / n; };
const warp = (x, y, k = 1.5) => fbm(x + k * fbm(x + 3.1, y + 7.7, 3), y + k * fbm(x + 9.2, y + 1.3, 3), 5);
const grain = (x, y) => (h2(x | 0, y | 0) - .5) * .05; // grain photo, pixel par pixel

function paintTex(size, fn, { post, w = size, h = size, strength = 3, wrapX = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const H = new Float32Array(w * h), rc = document.createElement('canvas'); rc.width = w; rc.height = h;
  const rctx = rc.getContext('2d'), rimg = rctx.createImageData(w, h), rd = rimg.data;
  const o = [0, 0, 0, .5, .6];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    o[3] = .5; o[4] = .6; fn(x / w, 1 - y / h, o);
    const k = (y * w + x), g = grain(x, y);
    d[k * 4] = clamp(o[0] + g, 0, 1) * 255; d[k * 4 + 1] = clamp(o[1] + g, 0, 1) * 255; d[k * 4 + 2] = clamp(o[2] + g, 0, 1) * 255; d[k * 4 + 3] = 255;
    H[k] = o[3];
    const r = clamp(o[4], .04, 1) * 255; rd[k * 4] = rd[k * 4 + 1] = rd[k * 4 + 2] = r; rd[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); rctx.putImageData(rimg, 0, 0);
  if (post) post(ctx, w, h, H, rctx);
  /* normales calculées à partir du relief (filtre de Sobel) */
  const nc = document.createElement('canvas'); nc.width = w; nc.height = h;
  const nctx = nc.getContext('2d'), nimg = nctx.createImageData(w, h), nd = nimg.data;
  const at = (x, y) => { x = wrapX ? (x + w) % w : clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); return H[y * w + x]; };
  const s = strength * w / 512;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const du = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) / 8;
    const dv = (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) - at(x - 1, y + 1) - 2 * at(x, y + 1) - at(x + 1, y + 1)) / 8;
    let nx = -du * s, ny = -dv * s, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * w + x) * 4; nd[k] = (nx * .5 + .5) * 255; nd[k + 1] = (ny * .5 + .5) * 255; nd[k + 2] = (nz * .5 + .5) * 255; nd[k + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; return t; };
  return { map: tex(cv, true), normal: tex(nc), rough: tex(rc) };
}

const envI = .75;
const mat = (p) => new THREE.MeshStandardMaterial({ envMapIntensity: envI, ...p });
const phys = (p) => new THREE.MeshPhysicalMaterial({ envMapIntensity: envI, ...p });
/* matière complète à partir d'une texture peinte */
const skin = (t, extra = {}, P = phys) => P({ map: t.map, normalMap: t.normal, roughnessMap: t.rough, roughness: 1, ...extra });
const shadowAll = g => g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

/* ---------------------------------------------------------------- palette (relevée sur de vrais aliments) */
const C = {
  crumb: hex('#ead2a0'), crumbD: hex('#c9a46c'),
  bunBase: hex('#e9b56c'), bunMid: hex('#c47a33'), bunTop: hex('#94491a'), bunBurn: hex('#5c2a0e'),
  beef: hex('#4a2b1d'), beefR: hex('#6b3a24'), beefD: hex('#21130c'), beefF: hex('#8a5a3c'),
  leaf: hex('#5f9e2e'), leafL: hex('#a9d36a'), leafW: hex('#e3f1c2'),
  skin: hex('#b5170e'), flesh: hex('#d42c18'), fleshL: hex('#ef6a3c'), jelly: hex('#f39a5f'), seed: hex('#f1dc9d'),
  meat: hex('#9a3324'), fat: hex('#efc7af'), crisp: hex('#4d1a0c'),
  sauce: hex('#7a1206'), sauceL: hex('#a3230c'), mozz: hex('#f3dca0'), mozzY: hex('#eab64f'), blister: hex('#9b5520'), char: hex('#2b170c'),
  dough: hex('#e2ad63'), doughT: hex('#b8702f'), flour: hex('#f2e6cd'),
  tort: hex('#ddb06a'), tortT: hex('#a9662c'), grill: hex('#55290f'),
  fry: hex('#efc35d'), fryD: hex('#c98a32')
};
const T = {}; // textures construites au démarrage
const TEXS = MOBILE ? 512 : 1024;

const BUILD = {
  bun() {
    T.bunTop = paintTex(TEXS, (u, v, o) => {
      if (v < .03) { const n = fbm(u * 60, v * 600, 4), p = vnoise(u * 400, v * 2000); mixc(C.crumb, C.crumbD, n * .7 + (p > .75 ? .3 : 0), o); o[3] = p > .75 ? .2 : .55; o[4] = .85; return; }
      const t = (v - .024) / .976, rr = (1 - t * .9) * 6;
      const X = Math.cos(u * TAU) * rr, Y = Math.sin(u * TAU) * rr;
      const n = warp(X * .7 + 3, Y * .7 + 7), sp = fbm(X * 6, Y * 6 + 2, 3), pore = vnoise(X * 60, Y * 60);
      mixc(C.bunBase, C.bunMid, smooth(.0, .25, t) + (n - .5) * .5, o);
      mixc(o, C.bunTop, smooth(.18, .75, t) * (.75 + (n - .5) * .7), o);
      if (sp > .66) mixc(o, C.bunBurn, (sp - .66) * 1.3, o);
      o[3] = .5 + (n - .5) * .25 - (pore > .8 ? .12 : 0);
      o[4] = lerp(.62, .32, smooth(.15, .6, t)) + (pore > .8 ? .2 : 0); // dessus doré et luisant (dorure à l'œuf)
    }, { strength: 2.5 });
    T.bunBot = paintTex(TEXS / 2, (u, v, o) => {
      if (v > .9) { // mie toastée
        const n = fbm(u * 80, v * 80, 4), p = vnoise(u * 220, v * 220), cell = ridged(u * 40, v * 40, 3);
        mixc(C.crumb, hex('#d39a55'), n * .8 + cell * .3, o); if (p > .78) mixc(o, C.crumbD, .6, o);
        o[3] = cell * .6 + (p > .78 ? -.3 : 0); o[4] = .9; return;
      }
      const X = Math.cos(u * TAU) * 6, Y = Math.sin(u * TAU) * 6 + v * 2, n = warp(X, Y);
      mixc(C.bunBase, C.bunMid, .3 + (n - .5) * .6 + (1 - v) * .4, o); o[3] = .5 + (n - .5) * .3; o[4] = .6;
    }, { strength: 2 });
  },
  patty() {
    T.patty = paintTex(TEXS, (u, v, o) => {
      const X = Math.cos(u * TAU) * 6 + v * .6, Y = Math.sin(u * TAU) * 6 + v * .4;
      const clump = ridged(X * 2.2, Y * 2.2, 4), fine = ridged(X * 9 + 4, Y * 9, 3), n = warp(X * .8, Y * .8), sear = fbm(X * .9 + 20, Y * .9, 4);
      mixc(C.beefR, C.beef, n * 1.2, o);
      mixc(o, C.beefD, (1 - clump) * .75 + sear * .35, o);
      if (fine > .82) mixc(o, C.beefF, (fine - .82) * 3, o);
      o[3] = clump * .7 + fine * .3;
      o[4] = clamp(.75 - clump * .45 + (1 - sear) * .1, .15, 1); // le gras brille sur les reliefs
    }, { strength: 6 });
    /* dessus et dessous du steak : coordonnées à plat */
    T.pattyCap = paintTex(TEXS, (u, v, o) => {
      const X = u * 13, Y = v * 13;
      const clump = ridged(X * 2.2, Y * 2.2, 4), fine = ridged(X * 9 + 4, Y * 9, 3), n = warp(X * .8, Y * .8), sear = fbm(X * .9 + 20, Y * .9, 4);
      mixc(C.beefR, C.beef, n * 1.2, o);
      mixc(o, C.beefD, (1 - clump) * .75 + sear * .35, o);
      if (fine > .82) mixc(o, C.beefF, (fine - .82) * 3, o);
      o[3] = clump * .7 + fine * .3;
      o[4] = clamp(.75 - clump * .45 + (1 - sear) * .1, .15, 1);
    }, { strength: 6, wrapX: false });
  },
  veg() {
    T.lettuce = paintTex(TEXS / 2, (u, v, o) => {
      const x = u - .5, y = v - .5, r = Math.hypot(x, y) * 2, a = Math.atan2(y, x), n = warp(u * 6, v * 6);
      mixc(C.leaf, C.leafL, r * .9 + (n - .5) * .5, o);
      const vein = Math.pow(Math.abs(Math.sin(a * 16 + n * 4)), 40) * r, mid = Math.pow(Math.abs(Math.sin(a * 16 * 4 + n * 9)), 80) * .4;
      mixc(o, C.leafW, vein * .8 + mid * .3, o);
      const crink = ridged(u * 30, v * 30, 3);
      o[3] = crink * .6 + vein * .3; o[4] = .38 + (1 - crink) * .15;
    }, { strength: 4, wrapX: false });
    T.tomato = paintTex(TEXS / 2, (u, v, o) => {
      const x = u - .5, y = v - .5, r = Math.hypot(x, y) * 2, a = Math.atan2(y, x), n = fbm(u * 20, v * 20, 4);
      if (r > .94) { mixc(C.skin, hex('#6d0b06'), (r - .94) * 10, o); o[3] = .6; o[4] = .2; return; }
      const lobeR = .74 + Math.cos(a * 4 + .3) * .05, inCh = r > .18 && r < lobeR && Math.abs(Math.sin(a * 2 + .3)) > .3;
      if (inCh) {
        mixc(C.jelly, C.fleshL, n, o);
        const sx = Math.cos(a) * r * 30, sy = Math.sin(a) * r * 30, s = vnoise(sx, sy * 2);
        if (s > .8 && r > .3) mixc(o, C.seed, .9, o);
        o[3] = .3 + (s > .8 ? .3 : 0); o[4] = .08;
      } else { mixc(C.flesh, C.fleshL, n * .6 + (r < .2 ? .4 : 0), o); o[3] = .55 + n * .1; o[4] = .16; }
    }, { strength: 3, wrapX: false });
    T.bacon = paintTex(TEXS / 2, (u, v, o) => {
      const band = Math.sin(v * Math.PI * 3.4 + (fbm(u * 3, 0, 3) - .5) * 5), n = fbm(u * 14, v * 4, 5);
      mixc(C.meat, C.fat, smooth(.1, .6, band), o);
      const cr = warp(u * 4 + 20, v * 4);
      mixc(o, C.crisp, smooth(.5, .8, cr) * .8 + (Math.abs(v - .5) > .44 ? .45 : 0), o);
      o[3] = .5 + band * .1 + (n - .5) * .4; o[4] = .25 + (1 - band) * .2;
    }, { strength: 4, wrapX: false });
  },
  pizza() {
    const S = MOBILE ? 1024 : 2048;
    T.pizza = paintTex(S, (u, v, o) => {
      const x = u - .5, y = v - .5, r = Math.hypot(x, y) * 2;
      const cn = warp(u * 7, v * 7, 2.2), b = fbm(u * 30 + 5, v * 30, 5), bl = ridged(u * 18, v * 18, 3), s = fbm(u * 50, v * 50, 3);
      if (cn > .43 + r * .06) {
        mixc(C.mozz, C.mozzY, (b - .35) * 1.3 + r * .2, o);
        if (bl > .78) mixc(o, C.blister, (bl - .78) * 3.2, o);
        if (bl > .9) mixc(o, C.char, (bl - .9) * 4, o);
        o[3] = .55 + (cn - .43) * 1.4 + bl * .15; o[4] = .3 + (1 - b) * .15;
      } else {
        mixc(C.sauce, C.sauceL, s, o);
        if (vnoise(u * 500, v * 500) > .9) mixc(o, hex('#41601f'), .6, o); // origan
        o[3] = .35 + s * .08; o[4] = .45;
      }
    }, { strength: 5, wrapX: false });
    T.crust = paintTex(TEXS, (u, v, o) => {
      const X = Math.cos(u * TAU) * 12, Y = Math.sin(u * TAU) * 12;
      const n = warp(X + v * 3, Y), top = Math.max(0, Math.sin(v * TAU)), leo = fbm(X * 2.5 + 50, Y * 2.5 + v * 8, 4);
      mixc(C.dough, C.doughT, top * .8 + (n - .5) * .7, o);
      if (leo > .66) mixc(o, C.char, (leo - .66) * 2.6 * top, o); // taches « léopard » du four
      if (vnoise(X * 14, Y * 14 + v * 40) > .84) mixc(o, C.flour, .45, o);
      o[3] = .5 + (n - .5) * .5 + ridged(X * 5, Y * 5 + v * 10, 3) * .2; o[4] = .7;
    }, { strength: 3 });
    T.pep = paintTex(TEXS / 4, (u, v, o) => {
      const r = Math.hypot(u - .5, v - .5) * 2, n = fbm(u * 10, v * 10, 4);
      mixc(hex('#a5261a'), hex('#5e120a'), smooth(.72, 1, r) * .9 + (n - .5) * .3, o);
      const f = vnoise(u * 28, v * 28); if (f > .74) mixc(o, hex('#e09272'), .75, o);
      o[3] = .5 + (1 - r) * .15 + (f > .74 ? .1 : 0); o[4] = .18;
    }, { strength: 3, wrapX: false });
  },
  tacos() {
    T.tort = paintTex(TEXS, (u, v, o) => {
      const n = warp(u * 6, v * 6), leo = fbm(u * 16 + 4, v * 16, 4), bub = ridged(u * 22, v * 22, 3);
      mixc(C.tort, C.tortT, (n - .3) * 1.2, o);
      if (leo > .63) mixc(o, hex('#7a3d16'), (leo - .63) * 2.5, o);
      const g = ((u + v * .6) * 4.5 + (fbm(u * 3, v * 3, 2) - .5) * .5) % 1;
      const gl = smooth(.84, .96, 1 - Math.abs(g - .5) * 2) * smooth(.3, .6, fbm(u * 6 + 2, v * 6, 3));
      mixc(o, C.grill, gl * .6, o);
      o[3] = .5 - gl * .25 + bub * .25 + (n - .5) * .2; o[4] = .55 - gl * .1;
    }, { strength: 3 });
    T.fill = paintTex(TEXS / 2, (u, v, o) => {
      const m = warp(u * 6, v * 6), q = fbm(u * 18 + 9, v * 18, 4);
      if (m > .56) { mixc(hex('#4f2614'), hex('#8a4422'), q, o); o[3] = .7 + q * .2; o[4] = .4; }
      else if (m < .42) { mixc(hex('#f2d47d'), hex('#fff0bd'), q, o); o[3] = .4; o[4] = .2; }
      else { mixc(hex('#e3ae55'), hex('#c98d3c'), q, o); o[3] = .55; o[4] = .5; }
    }, {
      wrapX: false,
      post(ctx, w, h) {
        for (let k = 0; k < 22; k++) {
          ctx.save(); ctx.translate(R() * w, R() * h); ctx.rotate((R() - .5) * 1.2);
          const fw = w * .05, fl = w * (.15 + R() * .2);
          const g = ctx.createLinearGradient(0, -fw / 2, 0, fw / 2); g.addColorStop(0, '#e9bf55'); g.addColorStop(.5, '#f7d77e'); g.addColorStop(1, '#c99038');
          ctx.fillStyle = g; ctx.fillRect(-fl / 2, -fw / 2, fl, fw); ctx.restore();
        }
      }
    });
  },
  sides() {
    T.fry = paintTex(TEXS / 4, (u, v, o) => {
      const n = fbm(u * 6, v * 30, 4), tip = smooth(.85, 1, v) + smooth(.15, 0, v);
      mixc(C.fry, C.fryD, (n - .3) * .8 + tip * .6, o); o[3] = .5 + (n - .5) * .4; o[4] = .5 - n * .2;
    }, { strength: 2 });
    T.carton = paintTex(TEXS / 2, (u, v, o) => {
      const n = fbm(u * 40, v * 40, 3);
      mixc(hex('#bf151b'), hex('#9c1015'), n * .6, o);
      if (v > .86) mixc(hex('#f2ebdf'), hex('#ded2c0'), n, o);
      o[3] = .5 + (n - .5) * .1; o[4] = .45;
    }, { strength: 1 });
    T.can = paintTex(TEXS / 2, (u, v, o) => {
      const n = fbm(u * 20, v * 20, 3);
      if (v < .19 || v > .75) { mixc(hex('#d2d5d8'), hex('#9ea3a8'), n, o); o[3] = .5; o[4] = .25; return; }
      mixc(hex('#b3121b'), hex('#7d0c12'), .2 + n * .4, o);
      const wave = .47 + Math.sin(u * TAU * 2) * .05;
      if (Math.abs(v - wave) < .018) mixc(o, hex('#ffffff'), .95, o);
      o[3] = .5; o[4] = .3;
    }, { strength: .5 });
    T.baguette = paintTex(TEXS, (u, v, o) => {
      const n = warp(u * 9, v * 4), score = Math.abs(((u * 5 + v * 1.6) % 1) - .5) < .07 && v > .55, crack = ridged(u * 40, v * 20, 3);
      mixc(hex('#dda15a'), hex('#94501e'), (v - .3) * .9 + (n - .5) * .6, o);
      if (score) mixc(o, hex('#efd29c'), .7, o);
      if (crack > .9) mixc(o, hex('#5d2c10'), .4, o);
      if (vnoise(u * 300, v * 150) > .9) mixc(o, C.flour, .4, o);
      o[3] = (score ? .25 : .55) + crack * .15; o[4] = .65;
    }, { strength: 3 });
    T.crumbTex = paintTex(TEXS / 2, (u, v, o) => {
      const n = fbm(u * 30, v * 30, 4), p = vnoise(u * 120, v * 120), cell = ridged(u * 50, v * 50, 3);
      mixc(C.crumb, hex('#f6e7c6'), n, o); if (p > .8) mixc(o, C.crumbD, .5, o); o[3] = cell * .7 - (p > .8 ? .3 : 0); o[4] = .9;
    }, { strength: 3, wrapX: false });
    T.kefta = paintTex(TEXS / 2, (u, v, o) => {
      const n = warp(u * 10, v * 10), ch = fbm(u * 6 + 9, v * 6, 3), cl = ridged(u * 30, v * 30, 3);
      mixc(hex('#5a2612'), hex('#8c4421'), n, o); if (ch > .58) mixc(o, C.char, (ch - .58) * 2.4, o);
      if (vnoise(u * 90, v * 90) > .86) mixc(o, hex('#3f6b1f'), .5, o);
      o[3] = cl * .7 + n * .2; o[4] = .5 - cl * .25;
    }, { strength: 5 });
    T.chicken = paintTex(TEXS / 2, (u, v, o) => {
      const n = warp(u * 8, v * 8), ch = fbm(u * 5 + 3, v * 5, 3), cl = ridged(u * 20, v * 20, 3);
      mixc(hex('#e0912f'), hex('#b8501a'), n, o); if (ch > .6) mixc(o, hex('#3b1a0a'), (ch - .6) * 2.2, o);
      o[3] = cl * .6 + n * .2; o[4] = .45 - cl * .2;
    }, { strength: 4 });
  }
};

/* ---------------------------------------------------------------- modèles */
const V2 = (x, y) => new THREE.Vector2(x, y);
/* petites irrégularités : aucun aliment réel n'est parfaitement rond */
function lumpy(geo, amp, freq = 1.4, seed = 0, keepBottom = true) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (keepBottom && v.y < .01) continue;
    const a = Math.atan2(v.z, v.x), k = 1 + amp * (fbm(Math.cos(a) * freq + seed, Math.sin(a) * freq + v.y * 1.5, 3) - .5) * 2;
    v.x *= k; v.z *= k; v.y *= 1 + amp * .8 * (fbm(v.x * 1.2 + seed + 5, v.z * 1.2, 3) - .5) * 2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function bunTop() {
  const pts = [V2(0, 0)], n = 2.5, Rb = 1.62, H = 1.12;
  for (let i = 0; i <= 48; i++) { const t = i / 48 * Math.PI / 2; pts.push(V2(Math.max(1e-4, Rb * Math.pow(Math.cos(t), 2 / n)), H * Math.pow(Math.sin(t), 2 / n))); }
  const geo = lumpy(new THREE.LatheGeometry(pts, 160), .035, 1.3, 2);
  const g = new THREE.Group();
  const bun = new THREE.Mesh(geo, skin(T.bunTop, { clearcoat: .3, clearcoatRoughness: .35, sheen: .15, sheenColor: new THREE.Color('#ffb066'), sheenRoughness: .6 }));
  g.add(bun);
  /* graines de sésame : posées sur la vraie surface par lancer de rayon */
  const SEEDS = 80, seedGeo = new THREE.SphereGeometry(.05, 10, 6); seedGeo.scale(.55, .3, 1.05);
  const seeds = new THREE.InstancedMesh(seedGeo, mat({ color: '#efdcae', roughness: .5 }), SEEDS);
  const ray = new THREE.Raycaster(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  bun.updateMatrixWorld();
  let k = 0, guard = 0;
  while (k < SEEDS && guard++ < 1000) {
    const t = Math.acos(1 - R() * .8), ph = R() * TAU, th = Math.PI / 2 - t * .9;
    const r = Rb * 1.3 * Math.cos(th), y = H * 1.5 * Math.sin(th) + .3;
    const from = new THREE.Vector3(Math.cos(ph) * r, y, Math.sin(ph) * r), dir = new THREE.Vector3(-from.x, -(y - .2), -from.z).normalize();
    ray.set(from, dir);
    const hit = ray.intersectObject(bun)[0];
    if (!hit) continue;
    const nrm = hit.face.normal.clone().normalize();
    q.setFromUnitVectors(up, nrm); q2.setFromAxisAngle(up, R() * TAU); q.multiply(q2);
    m4.compose(hit.point.addScaledVector(nrm, .008), q, new THREE.Vector3(1, 1, 1).multiplyScalar(.85 + R() * .3));
    seeds.setMatrixAt(k, m4); seeds.setColorAt(k, col.set(R() < .2 ? '#d9b97c' : '#f3e4bf')); k++;
  }
  seeds.count = k;
  g.add(seeds);
  return g;
}

function bunBottom() {
  const pts = [], n = 2.6, Rb = 1.6, H = .42;
  for (let i = 0; i <= 24; i++) { const t = -Math.PI / 2 + i / 24 * Math.PI / 2; pts.push(V2(Math.max(1e-4, Rb * Math.pow(Math.cos(t), 2 / n)), -H * Math.pow(Math.abs(Math.sin(t)), 2 / n) + H)); }
  pts.push(V2(1.5, H + .005), V2(1, H + .012), V2(.0001, H + .015));
  const geo = new THREE.LatheGeometry(pts, 160);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + .025 * (fbm(Math.cos(a) * 1.3 + 7, Math.sin(a) * 1.3, 3) - .5) * 2; p.setX(i, x * k); p.setZ(i, z * k); }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, skin(T.bunBot, { sheen: .15, sheenColor: new THREE.Color('#ffb066') }));
}

function patty(Rp = 1.7, h = .42) {
  const geo = new THREE.CylinderGeometry(Rp, Rp, h, 160, 10, false);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z), yy = v.y / (h / 2);
    if (Math.abs(r - Rp) < 1e-3) {
      let r2 = Rp * (1 + .05 * (fbm(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + v.y * 5, 4) - .5) * 2 + .015 * (ridged(Math.cos(a) * 20, Math.sin(a) * 20 + v.y * 20, 2) - .5));
      r2 *= 1 - .1 * Math.pow(Math.abs(yy), 3);
      v.x = Math.cos(a) * r2; v.z = Math.sin(a) * r2;
    } else {
      v.y += Math.sign(v.y) * ((fbm(v.x * 2 + 9, v.z * 2, 4) - .5) * .08 + (ridged(v.x * 6, v.z * 6, 2) - .5) * .03 - Math.pow(r / Rp, 6) * .05);
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const side = skin(T.patty, { clearcoat: .25, clearcoatRoughness: .5 }), cap = skin(T.pattyCap, { clearcoat: .25, clearcoatRoughness: .5 });
  return new THREE.Mesh(geo, [side, cap, cap]);
}

function cheese(size = 2.95) {
  const geo = new THREE.PlaneGeometry(size, size, 90, 90); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, a = size / 2 - .35, rc = .35;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    if (Math.abs(x) > a && Math.abs(z) > a) {
      const dx = Math.abs(x) - a, dz = Math.abs(z) - a, l = Math.hypot(dx, dz);
      if (l > rc) { x = Math.sign(x) * (a + dx / l * rc); z = Math.sign(z) * (a + dz / l * rc); }
    }
    const r = Math.hypot(x, z), d = Math.max(0, r - 1.62 - (fbm(x * 3, z * 3, 2) - .5) * .2);
    p.setXYZ(i, x, -d * d * .8 - d * .14 + (fbm(x * 2, z * 2, 3) - .5) * .025, z);
  }
  geo.rotateY(Math.PI / 4 + R() * .3); geo.computeVertexNormals();
  return new THREE.Mesh(geo, phys({ color: '#f2a020', roughness: .3, clearcoat: .5, clearcoatRoughness: .25, side: THREE.DoubleSide, sheen: .3, sheenColor: new THREE.Color('#ffcc66'), sheenRoughness: .4 }));
}

function lettuce() {
  const geo = new THREE.RingGeometry(.6, 1.98, 260, 14); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x), r = Math.hypot(x, z), w = (r - .6) / 1.38;
    const r2 = r * (1 + .07 * w * Math.sin(a * 13) + .05 * w * Math.sin(a * 5 + 2) + .03 * w * (fbm(a * 4, r * 3, 3) - .5));
    const y = w * w * (.22 * Math.sin(a * 9 + r * 2) + .12 * Math.sin(a * 23 + 1) + .06 * Math.sin(a * 41)) + (fbm(x * 3, z * 3, 3) - .5) * .06;
    p.setXYZ(i, Math.cos(a) * r2, y, Math.sin(a) * r2);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, skin(T.lettuce, { side: THREE.DoubleSide, clearcoat: .3, clearcoatRoughness: .3, sheen: .4, sheenColor: new THREE.Color('#e4ffc4'), sheenRoughness: .5 }));
}

function tomatoes() {
  const g = new THREE.Group(), side = phys({ color: '#b3160d', roughness: .18, clearcoat: .8 }), top = skin(T.tomato, { clearcoat: .9, clearcoatRoughness: .1 });
  for (const [x, z, r] of [[-.72, .25, .78], [.74, -.2, .76], [.05, -.85, .72]]) {
    const m = new THREE.Mesh(lumpy(new THREE.CylinderGeometry(r, r, .12, 64), .03, 1.2, x, false), [side, top, top]);
    m.position.set(x, .06, z); m.rotation.y = R() * TAU; m.rotation.z = (R() - .5) * .06; g.add(m);
  }
  return g;
}

function onions() {
  const g = new THREE.Group(), m = phys({ color: '#dcb3c6', roughness: .25, clearcoat: .8, clearcoatRoughness: .15, sheen: .5, sheenColor: new THREE.Color('#ffffff') });
  for (const [x, z, r] of [[-.5, -.35, .5], [.45, .45, .44], [.2, -.2, .3]]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, .045, 12, 64), m); t.rotation.x = Math.PI / 2; t.position.set(x, .045, z); g.add(t);
  }
  return g;
}

function bacon(n = 2) {
  const g = new THREE.Group(), m = skin(T.bacon, { side: THREE.DoubleSide, clearcoat: .3, clearcoatRoughness: .4 });
  for (let k = 0; k < n; k++) {
    const geo = new THREE.PlaneGeometry(3, .42, 120, 6), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, .09 * Math.sin(x * 5.2 + k) + .03 * Math.sin(x * 13) + (fbm(x * 3, y * 5 + k, 3) - .5) * .05); }
    geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
    const s = new THREE.Mesh(geo, m); s.rotation.y = k * 1.4 + .3; s.position.y = .05 + k * .06; g.add(s);
  }
  return g;
}

function egg() {
  const g = new THREE.Group(), geo = new THREE.CylinderGeometry(1.22, 1.22, .07, 128, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r > .01) { const a = Math.atan2(z, x), k = 1 + .16 * (fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6, 3) - .5) * 2; p.setX(i, x * k); p.setZ(i, z * k); }
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, phys({ color: '#f7f1e3', roughness: .22, clearcoat: .8, sheen: .3, sheenColor: new THREE.Color('#ffffff') })));
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(.44, 48, 24, 0, TAU, 0, Math.PI / 2), phys({ color: '#f29000', roughness: .1, clearcoat: 1, clearcoatRoughness: .04, sheen: .5, sheenColor: new THREE.Color('#ffd060') }));
  yolk.scale.set(1, .6, 1); yolk.position.set(.18, .03, -.12); g.add(yolk);
  return g;
}

function stack(layers) {
  const g = new THREE.Group(); let y = 0;
  for (const [o, h, dy = 0] of layers) { o.position.y += y + dy; g.add(o); y += h; }
  return g;
}

const MODELS = {
  burger() {
    return stack([[bunBottom(), .43], [patty(), .42, .21], [cheese(), .03, -.19], [lettuce(), .06, -.16], [tomatoes(), .12, -.14], [onions(), .06, -.1], [bunTop(), 0, -.06]]);
  },
  mega() {
    return stack([[bunBottom(), .43], [patty(), .42, .21], [cheese(), .02, -.19], [patty(1.66, .4), .4, .02], [cheese(), .03, -.18], [bacon(2), .1, -.16], [egg(), .06, -.08], [lettuce(), .06, -.1], [tomatoes(), .12, -.12], [bunTop(), 0, -.06]]);
  },
  pizza() {
    const g = new THREE.Group(), Rz = 2.3;
    const bread = skin(T.crust, {}, mat);
    const topGeo = new THREE.CylinderGeometry(Rz, Rz * .98, .1, 160, 1);
    const base = new THREE.Mesh(topGeo, [bread, skin(T.pizza, { clearcoat: .12, clearcoatRoughness: .4 }), bread]);
    base.position.y = .05; g.add(base);
    const crustGeo = new THREE.TorusGeometry(Rz - .08, .2, 32, 220); crustGeo.rotateX(Math.PI / 2); crustGeo.scale(1, .78, 1);
    const cp = crustGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i), a = Math.atan2(z, x), k = 1 + (fbm(Math.cos(a) * 6, Math.sin(a) * 6 + cp.getY(i) * 3, 3) - .5) * .06; cp.setX(i, x * k); cp.setZ(i, z * k); cp.setY(i, cp.getY(i) * (1 + (k - 1) * 5)); }
    crustGeo.computeVertexNormals();
    const crust = new THREE.Mesh(crustGeo, bread); crust.position.y = .12; g.add(crust);
    const pepM = skin(T.pep, { clearcoat: .25, clearcoatRoughness: .3 }), pepS = phys({ color: '#6c140c', roughness: .4 });
    const pos = [];
    while (pos.length < 12) { const a = R() * TAU, r = .35 + R() * 1.55, p = [Math.cos(a) * r, Math.sin(a) * r]; if (pos.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > .62)) pos.push(p); }
    for (const [x, z] of pos) {
      const pg = new THREE.CylinderGeometry(.28, .27, .035, 40, 1); const pp = pg.attributes.position;
      for (let i = 0; i < pp.count; i++) { const r = Math.hypot(pp.getX(i), pp.getZ(i)); pp.setY(i, pp.getY(i) + r * r * .25); } // bords relevés en coupelle
      pg.computeVertexNormals();
      const m = new THREE.Mesh(pg, [pepS, pepM, pepS]); m.position.set(x, .11, z); m.rotation.set((R() - .5) * .12, R() * TAU, (R() - .5) * .12); g.add(m);
    }
    const oliveM = phys({ color: '#1b1514', roughness: .15, clearcoat: 1 });
    for (let k = 0; k < 14; k++) { const a = R() * TAU, r = .3 + R() * 1.7, o = new THREE.Mesh(new THREE.TorusGeometry(.085, .038, 12, 24), oliveM); o.rotation.x = Math.PI / 2 + (R() - .5) * .3; o.position.set(Math.cos(a) * r, .12, Math.sin(a) * r); g.add(o); }
    const leaf = new THREE.Shape(); leaf.moveTo(0, -.22); leaf.quadraticCurveTo(.16, 0, 0, .22); leaf.quadraticCurveTo(-.16, 0, 0, -.22);
    const leafGeo = new THREE.ShapeGeometry(leaf, 16); leafGeo.rotateX(-Math.PI / 2);
    const lp = leafGeo.attributes.position; for (let i = 0; i < lp.count; i++) lp.setY(i, Math.abs(lp.getX(i)) * .25);
    leafGeo.computeVertexNormals();
    const basil = phys({ color: '#2c6e1e', roughness: .3, clearcoat: .6, side: THREE.DoubleSide, sheen: .5, sheenColor: new THREE.Color('#9be36e') });
    for (let k = 0; k < 6; k++) { const a = R() * TAU, r = .4 + R() * 1.4, l = new THREE.Mesh(leafGeo, basil); l.position.set(Math.cos(a) * r, .14, Math.sin(a) * r); l.rotation.y = R() * TAU; l.scale.setScalar(.9 + R() * .5); g.add(l); }
    return g;
  },
  tacos() {
    const g = new THREE.Group(), tort = skin(T.tort, { sheen: .2, sheenColor: new THREE.Color('#ffd79a') }), fill = skin(T.fill, {}, mat);
    for (const s of [-1, 1]) {
      const half = new THREE.Group();
      const geo = new RoundedBoxGeometry(1.45, .82, 1.9, 8, .34); lumpy(geo, .03, 2, s * 3, false);
      const box = new THREE.Mesh(geo, tort); box.position.x = s * .725; half.add(box);
      const cut = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .58), fill); cut.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2; cut.position.x = s > 0 ? -.002 : .002; half.add(cut);
      half.position.set(s * .62, .41, 0); half.rotation.y = s * .72;
      g.add(half);
    }
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.34, .28, .3, 48, 1, true), phys({ color: '#f4f1ea', roughness: .2, clearcoat: .8, side: THREE.DoubleSide }));
    cup.position.set(0, .15, -1.1); g.add(cup);
    const sauce = new THREE.Mesh(new THREE.CircleGeometry(.32, 48), phys({ color: '#ece2c8', roughness: .12, clearcoat: 1 })); sauce.rotation.x = -Math.PI / 2; sauce.position.set(0, .26, -1.1); g.add(sauce);
    return g;
  },
  menu() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(.78, .56, 1.45, 4, 1, true); geo.rotateY(Math.PI / 4);
    const carton = new THREE.Mesh(geo, skin(T.carton, { clearcoat: .3, side: THREE.DoubleSide }));
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(.79, .79), mat({ color: '#8e0f13' })); bottom.rotation.x = -Math.PI / 2; bottom.position.y = -.72;
    const cornet = new THREE.Group(); cornet.add(carton, bottom); cornet.position.set(-.75, .725, .15); cornet.rotation.y = .5;
    const FR = 46, fries = new THREE.InstancedMesh(new RoundedBoxGeometry(.11, 1, .11, 1, .025), skin(T.fry, {}, mat), FR);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    for (let k = 0; k < FR; k++) {
      const len = .9 + R() * .7, x = (R() - .5) * .78, z = (R() - .5) * .78;
      e.set((R() - .5) * .25 + z * .3, R() * TAU, (R() - .5) * .25 - x * .3); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, .25 + len * .45, z), q, new THREE.Vector3(1, len, 1));
      fries.setMatrixAt(k, m4); fries.setColorAt(k, col.setRGB(1, 1, 1).offsetHSL(0, 0, (R() - .5) * .12));
    }
    cornet.add(fries);
    g.add(cornet);
    const pts = [V2(1e-4, 0), V2(.36, 0), V2(.41, .05), V2(.43, .14)];
    for (let i = 1; i <= 10; i++) pts.push(V2(.43, .14 + i * .108));
    pts.push(V2(.41, 1.3), V2(.35, 1.39), V2(.32, 1.43), V2(.33, 1.45), V2(1e-4, 1.44));
    const can = new THREE.Mesh(new THREE.LatheGeometry(pts, 128), mat({ map: T.can.map, roughnessMap: T.can.rough, roughness: 1, metalness: .9 }));
    can.position.set(.95, 0, -.25); can.rotation.y = -.8;
    g.add(can);
    return g;
  },
  sandwich() {
    const g = new THREE.Group();
    const crust = skin(T.baguette, { sheen: .2, sheenColor: new THREE.Color('#ffd79a') });
    const crumb = skin(T.crumbTex, {}, mat);
    const half = (top) => {
      const geo = new THREE.SphereGeometry(1, 128, 32, 0, TAU, top ? 0 : Math.PI / 2, Math.PI / 2);
      geo.scale(2.25, top ? .5 : .32, .6);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * (1 - Math.pow(Math.abs(x) / 2.25, 6) * .5) * (1 + (fbm(x * 1.5, z * 3 + (top ? 0 : 9), 3) - .5) * .15)); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, crust);
      const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 64), crumb); cap.scale.set(2.25, .6, 1); cap.rotation.x = top ? Math.PI / 2 : -Math.PI / 2;
      const h = new THREE.Group(); h.add(m, cap); return h;
    };
    const bot = half(false); bot.position.y = .32; g.add(bot);
    const merg = skin(T.kefta, { clearcoat: .6, clearcoatRoughness: .25 });
    for (const z of [-.17, .17]) { const c = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(.15, 3.3, 8, 32), .04, 3, z * 10, false), merg); c.rotation.z = Math.PI / 2; c.position.set(0, .48, z); c.rotation.y = z * .3; g.add(c); }
    const let1 = new THREE.PlaneGeometry(4, .9, 160, 10); let1.rotateX(-Math.PI / 2);
    const lp = let1.attributes.position;
    for (let i = 0; i < lp.count; i++) { const x = lp.getX(i), z = lp.getZ(i); lp.setY(i, .08 * Math.sin(x * 7 + z * 3) + Math.pow(Math.abs(z) / .45, 2) * .12 + (fbm(x * 3, z * 3, 3) - .5) * .05); lp.setZ(i, z * (1 + .12 * Math.sin(x * 9))); }
    let1.computeVertexNormals();
    const lt = new THREE.Mesh(let1, skin(T.lettuce, { side: THREE.DoubleSide, clearcoat: .3 })); lt.position.y = .68; g.add(lt);
    const side = phys({ color: '#b3160d', roughness: .18, clearcoat: .8 }), top = skin(T.tomato, { clearcoat: .9, clearcoatRoughness: .1 });
    for (const x of [-1.3, -.45, .4, 1.25]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .08, 48), [side, top, top]); t.position.set(x, .76, (R() - .5) * .1); t.rotation.set(0, R() * TAU, (R() - .5) * .25); g.add(t); }
    const ch = new THREE.PlaneGeometry(3.8, .7, 100, 12); ch.rotateX(-Math.PI / 2);
    const cp = ch.attributes.position;
    for (let i = 0; i < cp.count; i++) { const z = cp.getZ(i), x = cp.getX(i); cp.setY(i, -Math.pow(Math.max(0, Math.abs(z) - .22 - (fbm(x * 3, 0, 2) - .5) * .15), 1.2) * .9 + .02 * Math.sin(x * 5)); }
    ch.computeVertexNormals();
    const cheddar = new THREE.Mesh(ch, phys({ color: '#f2a020', roughness: .3, clearcoat: .5, side: THREE.DoubleSide })); cheddar.position.y = .84; g.add(cheddar);
    const topH = half(true); topH.position.set(0, .9, -.32); topH.rotation.x = -.42; g.add(topH);
    return g;
  },
  plate() {
    const g = new THREE.Group();
    const pts = [V2(1e-4, 0), V2(1.4, 0), V2(1.55, .04), V2(1.6, .08), V2(2.3, .2), V2(2.42, .26), V2(2.44, .29), V2(2.36, .3), V2(1.62, .16), V2(1.5, .13), V2(1e-4, .13)];
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 160), phys({ color: '#f4f0e8', roughness: .1, clearcoat: 1, clearcoatRoughness: .05 })));
    const kef = skin(T.kefta, { clearcoat: .4, clearcoatRoughness: .3 }), chk = skin(T.chicken, { clearcoat: .4, clearcoatRoughness: .3 });
    const steel = mat({ color: '#d9dcdf', metalness: 1, roughness: .18 });
    const skewer = (meat, cube, z, ang) => {
      const s = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 3.6, 16), steel); rod.rotation.z = Math.PI / 2; s.add(rod);
      for (let k = 0; k < (cube ? 6 : 1); k++) {
        if (cube) { const c = new THREE.Mesh(lumpy(new RoundedBoxGeometry(.38, .34, .38, 4, .1), .08, 3, k, false), meat); c.position.x = -1.1 + k * .44; c.rotation.set(R() * .4, R() * .5, R() * .4); s.add(c); }
        else { const c = new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(.2, 2.3, 8, 32), .05, 3, 4, false), meat); c.rotation.z = Math.PI / 2; s.add(c); }
      }
      s.position.set(0, .36, z); s.rotation.y = ang; return s;
    };
    g.add(skewer(kef, false, -.35, .15), skewer(chk, true, .3, -.1));
    const FR = 34, fries = new THREE.InstancedMesh(new RoundedBoxGeometry(.1, .1, 1, 1, .022), skin(T.fry, {}, mat), FR);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    for (let k = 0; k < FR; k++) {
      const len = .6 + R() * .5; e.set((R() - .5) * .3, R() * TAU, (R() - .5) * .3); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(-.9 + (R() - .5) * .9, .2 + R() * .22, 1.05 + (R() - .5) * .6), q, new THREE.Vector3(1, 1, len));
      fries.setMatrixAt(k, m4); fries.setColorAt(k, col.setRGB(1, 1, 1).offsetHSL(0, 0, (R() - .5) * .12));
    }
    g.add(fries);
    const lettuceM = skin(T.lettuce, { side: THREE.DoubleSide, clearcoat: .3 });
    for (let k = 0; k < 5; k++) {
      const geo = new THREE.CircleGeometry(.42, 32); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, .08 * Math.sin(x * 9) + .06 * Math.cos(y * 7)); }
      geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
      const l = new THREE.Mesh(geo, lettuceM); l.position.set(.9 + (R() - .5) * .6, .2 + k * .03, .95 + (R() - .5) * .5); l.rotation.set((R() - .5) * .5, R() * TAU, (R() - .5) * .5); g.add(l);
    }
    const side = phys({ color: '#b3160d', roughness: .18, clearcoat: .8 }), top = skin(T.tomato, { clearcoat: .9, clearcoatRoughness: .1 });
    for (const [x, z] of [[1.25, .7], [.75, 1.3], [1.4, 1.2]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .07, 40), [side, top, top]); t.position.set(x, .3, z); t.rotation.set((R() - .5) * .3, R() * TAU, (R() - .5) * .3); g.add(t); }
    return g;
  }
};

/* ---------------------------------------------------------------- scène */
const canvas = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) { failGL(e); }
function failGL(err) {
  document.documentElement.classList.add('no-gl');
  $('.loader').classList.add('done');
  $$('.chap').forEach(s => s.classList.add('in'));
  console.warn('WebGL indisponible', err);
  throw err;
}
let PR = Math.min(devicePixelRatio || 1, MOBILE ? 1.75 : 1.75);
renderer.setPixelRatio(PR);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // rendu « appareil photo »
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

/* studio photo virtuel : grandes boîtes à lumière blanches sur fond noir.
   Ce sont elles qui dessinent les reflets réalistes sur le pain, le fromage, la sauce. */
function studioEnv() {
  const env = new THREE.Scene(); env.background = new THREE.Color(0x040404);
  const box = (w, h, x, y, z, I, warm = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(I, I * (1 - warm * .08), I * (1 - warm * .18)), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  box(7, 7, 0, 8, 1, 3.2);          // grande boîte au-dessus
  box(4, 7, -7, 2.5, 5, 4.5, 1);    // lumière principale, gauche avant
  box(1.4, 7, 7, 1.5, -3, 3);       // bande de contre-jour, droite arrière
  box(5, 2.5, 3, -1, 8, 1.2);       // débouchage léger, face
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(.05, .04, .035) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -4; env.add(floor);
  const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(env, .03).texture; pm.dispose();
  return tex;
}
scene.environment = studioEnv();

const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
camera.position.set(0, 0, 14);

const key = new THREE.DirectionalLight('#fff4e8', 1.8);
key.castShadow = true;
key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -3; key.shadow.camera.right = key.shadow.camera.top = 3;
key.shadow.camera.near = .5; key.shadow.camera.far = 25; key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 5;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#ffffff', .8); rim.position.set(6, 4, -6); scene.add(rim);

/* ombre de contact douce sous chaque produit */
const shadowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(.5, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
})();

/* cadrage : taille visée, inclinaison, position (ordinateur / mobile) */
const META = {
  burger: { w: 3.9, tilt: 0, off: [2.6, .45], offM: [0, 1.75] },
  menu:   { w: 3.9, tilt: 0, off: [3, -.1],   offM: [0, 1.75] },
  mega:   { w: 3.9, tilt: 0, off: [3, -.1],   offM: [0, 1.75] },
  pizza:  { w: 3.9, tilt: .7,  off: [3, 0],   offM: [0, 1.8] },
  tacos:  { w: 4.1, tilt: 0, off: [3, 0],     offM: [0, 1.75] },
  sandwich: { w: 4.1, tilt: 0, off: [3, 0],   offM: [0, 1.75] },
  plate:  { w: 4.1, tilt: 0,   off: [3, 0],   offM: [0, 1.75] }
};

function frameModel(obj, target) {
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const s = target / Math.max(size.x, size.z);
  const g = new THREE.Group(); obj.position.sub(new THREE.Vector3(c.x, box.min.y, c.z)); g.add(obj); g.scale.setScalar(s);
  return { group: g, height: size.y * s };
}

async function loadGLB(url) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}

const SECS = $$('[data-model]');
const ORDER = SECS.map(s => s.dataset.model);
const PRODUCTS = [];

function loadImg(src) { return new Promise((ok, ko) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = ko; im.src = src; }); }
const texFrom = (src) => { const t = new THREE.Texture(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.needsUpdate = true; return t; };

async function buildPhoto(name) {
  const cfg = PHOTO[name], imgs = await Promise.all([...Array(cfg.frames)].map((_, i) => loadImg(frameSrc(name, i))));
  const W = imgs[0].naturalWidth, H = imgs[0].naturalHeight;
  const base = imgs.map(im => texFrom(im));
  const flipped = imgs.map(im => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.translate(W, 0); x.scale(-1, 1); x.drawImage(im, 0, 0); return texFrom(c); });
  /* tour complet : 12 vues tous les 30° */
  const n = cfg.frames - 1, seq = [];
  for (let i = 0; i <= n; i++) seq.push(base[i]);
  for (let i = n - 1; i >= 1; i--) seq.push(cfg.mode === 'mirror' ? flipped[i] : base[i]);
  const M = META[name], w = M.w, h = w * H / W;
  const geo = new THREE.PlaneGeometry(w, h);
  const A = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: seq[0], transparent: true, toneMapped: false, depthWrite: false }));
  const B = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: seq[1], transparent: true, toneMapped: false, depthWrite: false, opacity: 0 }));
  B.renderOrder = 2; A.renderOrder = 1;
  /* ombre douce sous la planche */
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w * .95, w * .22), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: .9 }));
  sh.position.set(0, -h / 2 + w * .04, -.01);
  const spin = new THREE.Group(); spin.add(sh, A, B);
  const outer = new THREE.Group(); outer.add(spin); outer.visible = false;
  scene.add(outer);
  return { name, outer, spin, M, height: h * .8, photo: { seq, A, B } };
}

async function buildProduct(name) {
  if (PHOTO[name]) return buildPhoto(name);
  let obj = null;
  if (CONFIG.models[name]) { try { obj = await loadGLB(CONFIG.models[name]); } catch (e) { console.warn('Modèle introuvable, modèle du code utilisé :', CONFIG.models[name]); } }
  if (!obj) obj = MODELS[name]();
  shadowAll(obj);
  const M = META[name], { group, height } = frameModel(obj, M.w);
  const spin = new THREE.Group(); spin.add(group); group.position.y = -height / 2;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(M.w * 1.5, M.w * 1.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = -height / 2 - .01;
  const outer = new THREE.Group(); outer.add(sh, spin); outer.rotation.x = M.tilt; outer.visible = false;
  scene.add(outer);
  return { name, outer, spin, M, height };
}

/* ---------------------------------------------------------------- défilement ↔ rubriques */
let anchors = [], maxScroll = 1;
function measure() {
  maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  anchors = SECS.map((el, i) => i === 0 ? 0 : i === SECS.length - 1 ? maxScroll : clamp(el.offsetTop + el.offsetHeight / 2 - innerHeight / 2, 0, maxScroll));
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
}
function progressFor(y) {
  if (y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) if (y <= anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
  return anchors.length - 1;
}
function resize() {
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  measure();
}

const rail = $('#rail'), nowEl = $('#now');
SECS.forEach((s, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button"><span>${s.dataset.label}</span><i></i></button>`;
  li.firstChild.addEventListener('click', () => scrollTo({ top: anchors[i], behavior: REDUCE ? 'auto' : 'smooth' }));
  rail.appendChild(li);
});
const railBtns = $$('#rail button');
let active = -1;
function setActive(i) {
  if (i === active) return;
  active = i;
  railBtns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
  nowEl.textContent = SECS[i].dataset.label;
}

/* ---------------------------------------------------------------- pointeur */
const P = { x: 0, y: 0, tx: 0, ty: 0 };
const cursor = $('.cursor');
let cx = innerWidth / 2, cy = innerHeight / 2, ccx = cx, ccy = cy;
addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  P.tx = e.clientX / innerWidth * 2 - 1; P.ty = -(e.clientY / innerHeight * 2 - 1); cx = e.clientX; cy = e.clientY;
}, { passive: true });
document.addEventListener('pointerover', e => cursor.classList.toggle('big', !!e.target.closest('a, button, summary, [data-hover]')));

/* ---------------------------------------------------------------- image par image */
let smoothProg = 0, clock = 0, tPrev = performance.now(), intro = 0, introStart = 0;
const PERF = { acc: 0, n: 0 };
const tmp = new THREE.Vector3();

function frame(now) {
  const raw = (now - tPrev) / 1000 || 0, dt = Math.min(raw, .05);
  tPrev = now; clock += dt;

  if (clock > 3) {
    PERF.acc += raw; PERF.n++;
    if (PERF.n >= 45) {
      const avg = PERF.acc / PERF.n; PERF.acc = PERF.n = 0;
      if (avg > .026 && PR > .75) { PR = Math.max(.75, PR * .85); resize(); }
    }
  }

  const prog = progressFor(scrollY);
  smoothProg = REDUCE ? prog : damp(smoothProg, prog, 5, dt);
  setActive(Math.round(prog));
  intro = introStart ? clamp((now - introStart) / 1400, 0, 1) : 0;

  const aspect = innerWidth / innerHeight, narrow = aspect < .9;
  const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * aspect;
  P.x = damp(P.x, P.tx, 3, dt); P.y = damp(P.y, P.ty, 3, dt);

  let best = null, bestD = 9;
  PRODUCTS.forEach((p, k) => {
    const d = smoothProg - k, ad = Math.abs(d);
    const vis = ad < .9;
    p.outer.visible = vis;
    if (!vis) return;
    const off = narrow ? p.M.offM : p.M.off;
    const fitW = narrow ? (halfW * 1.42) / p.M.w : 1;
    const fitH = (halfH * (narrow ? .72 : 1.3)) / Math.max(p.height, 1.6);
    const s = Math.min(1, fitW, fitH) * (narrow ? 1 : clamp(halfW / 6, .82, 1.12));
    const out = Math.sign(d) * smooth(.16, .62, ad);
    const enter = k === 0 ? 1 - Math.pow(1 - intro, 3) : 1;
    p.outer.position.set(off[0] * (narrow ? 1 : clamp(halfW / 6, .8, 1.15)), off[1] - out * halfH * 2.6 - (1 - enter) * 1.2, 0);
    p.outer.scale.setScalar(s * (.85 + .15 * enter));
    p.spin.position.y = Math.sin(clock * 1.1 + k) * .04;
    if (p.photo) {
      /* un tour complet en photos : la vue suit le défilement */
      const N = p.photo.seq.length, f = ((d * N) % N + N) % N, i0 = Math.floor(f), t = smooth(.25, .75, f - i0);
      p.photo.A.material.map = p.photo.seq[i0]; p.photo.B.material.map = p.photo.seq[(i0 + 1) % N];
      p.photo.B.material.opacity = t;
      p.outer.rotation.set(0, 0, 0);
      p.spin.position.x = P.x * .08;
    } else {
      p.outer.rotation.x = p.M.tilt - P.y * .12;
      p.outer.rotation.z = P.x * -.05;
      /* un tour complet pendant qu'on traverse la rubrique */
      p.spin.rotation.y = d * TAU + (1 - enter) * -1.2 + Math.sin(clock * .6) * .06 + P.x * .25;
    }
    if (ad < bestD) { bestD = ad; best = p; }
  });

  if (best) {
    best.outer.getWorldPosition(tmp);
    key.target.position.copy(tmp);
    key.position.set(tmp.x - 4, tmp.y + 7, tmp.z + 6);
  }

  ccx = damp(ccx, cx, 14, dt); ccy = damp(ccy, cy, 14, dt);
  cursor.style.transform = `translate(${ccx}px, ${ccy}px)`;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------------------------------------------------------- démarrage */
async function boot() {
  const pct = $('#pct'), bar = $('#pctbar');
  try { await Promise.all([document.fonts.load('800 100px "Unbounded"'), document.fonts.load('600 40px "Manrope"')]); } catch (e) {}
  const NEEDS = { bun: ['burger', 'mega'], patty: ['burger', 'mega'], veg: ['burger', 'mega', 'sandwich', 'plate'], pizza: ['pizza'], tacos: ['tacos'], sides: ['menu', 'sandwich', 'plate'] };
  const in3D = ORDER.filter(n => !PHOTO[n]);
  const builds = Object.keys(BUILD).filter(k => NEEDS[k].some(n => in3D.includes(n)));
  const steps = [...builds.map(k => () => BUILD[k]()), ...ORDER.map(n => async () => PRODUCTS.push(await buildProduct(n)))];
  for (let k = 0; k < steps.length; k++) {
    await steps[k]();
    const p = (k + 1) / steps.length;
    pct.textContent = Math.round(p * 100); bar.style.transform = `scaleX(${p})`;
    await new Promise(r => setTimeout(r, 16));
  }
  resize();
  PRODUCTS.forEach(p => p.photo?.seq.forEach(t => renderer.initTexture(t)));
  renderer.compile(scene, camera);
  addEventListener('resize', resize, { passive: true });
  new ResizeObserver(measure).observe(document.body);
  $('.loader').classList.add('done');
  setTimeout(() => { introStart = performance.now(); }, 200);
  requestAnimationFrame(frame);
}
boot().catch(failGL);

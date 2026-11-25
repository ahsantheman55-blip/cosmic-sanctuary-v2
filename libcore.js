/* Cosmologist Library core: ordering by cosmic time, themes, shuffle without repeats, spoken titles, chunks, resume. Pure (browser and Node). */
(function (root) {
  'use strict';
  var cryptoObj = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : (typeof require === 'function' ? require('crypto').webcrypto : null);
  function randInt(n) { if (n <= 0) return 0; var buf = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n, x; do { cryptoObj.getRandomValues(buf); x = buf[0]; } while (x >= lim); return x % n; }
  function shuffle(arr, ri) { ri = ri || randInt; var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = ri(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var SEC_RANK = { chrono: 0, theories: 1, evidence: 2, physics: 3, controversies: 4, seeing: 5, future: 6, end: 7 };
  var KIND_RANK = { overview: 0, story: 1, primer: 2, controversy: 3, article: 4 };
  // the soundscape era (0-12 in Cosmic Sanctuary) that matches each cosmic epoch
  var ERA_OF = { before: 0, planck: 0, gut: 0, inflation: 1, electroweak: 2, quark: 2, hadron: 2, lepton: 3, photon: 3, bbn: 3, plasma: 4, recomb: 4, dark: 5, dawn: 6, reion: 7, galaxies: 8, later: 9, today: 11, future: 12, far: 12, deep: 12, last: 12 };
  function epochMap(index) { var m = {}; index.epochs.forEach(function (e, i) { m[e.id] = { lt: e.lt, when: e.when, i: i }; }); return m; }
  function lt(index, p) { return epochMap(index)[p.e].lt; }
  function filterBase(index, sel) {
    var secs = sel.sections ? new Set(sel.sections) : null, lv = sel.levels && sel.levels.length ? new Set(sel.levels.map(Number)) : null;
    return index.pieces.filter(function (p) { return (!secs || secs.has(p.s)) && (!lv || lv.has(p.lv)) && (!sel.originalOnly || p.src === 'orig'); });
  }
  // Chronological: by cosmic time (log seconds after the Big Bang); at the same moment, the story first, then theory, evidence, physics...
  function chronoCompare(EM) { return function (a, b) { return (a.id === 'o-welcome' ? -1 : 0) - (b.id === 'o-welcome' ? -1 : 0) || EM[a.e].lt - EM[b.e].lt || SEC_RANK[a.s] - SEC_RANK[b.s] || KIND_RANK[a.k] - KIND_RANK[b.k] || a.lv - b.lv || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0); }; }
  // The chronology section is the spine, in cosmic time. Pieces from other sections are companions: each joins the
  // spine after the story has reached its moment, at most perStop at a time, so the background is spread through the story.
  function chronological(index, sel) {
    var EM = epochMap(index), from = sel.startEpoch && EM[sel.startEpoch] ? EM[sel.startEpoch].lt : -Infinity, cmp = chronoCompare(EM);
    var all = filterBase(index, sel).filter(function (p) { return EM[p.e].lt >= from; }).sort(cmp);
    var spine = all.filter(function (p) { return p.s === 'chrono'; }), comp = all.filter(function (p) { return p.s !== 'chrono'; });
    if (!spine.length || !comp.length) return all;
    var per = sel.perStop || 2, out = [];
    spine.forEach(function (sp, i) {
      out.push(sp);
      var next = spine[i + 1], k = 0;
      while (comp.length && k < per && EM[comp[0].e].lt <= EM[sp.e].lt && !(next && next.k !== 'article' && EM[next.e].lt === EM[sp.e].lt && sp.k !== 'article')) { out.push(comp.shift()); k++; }
    });
    return out.concat(comp);
  }
  // Thematic: everything on one umbrella topic, gentlest first, then by cosmic time
  function thematic(index, sel) {
    var EM = epochMap(index);
    return filterBase(index, sel).filter(function (p) { return p.th.indexOf(sel.theme) >= 0; }).sort(function (a, b) { return (a.k === 'overview' ? 0 : 1) - (b.k === 'overview' ? 0 : 1) || a.lv - b.lv || EM[a.e].lt - EM[b.e].lt || KIND_RANK[a.k] - KIND_RANK[b.k] || (a.t < b.t ? -1 : 1); });
  }
  function oneSection(index, sel) { return filterBase(index, { levels: sel.levels }).filter(function (p) { return p.s === sel.section; }); } // build order: overview, then cosmic time
  function fill(list, minutes) { if (!minutes || minutes === Infinity) return list.slice(); var out = [], m = 0; for (var i = 0; i < list.length && m < minutes; i++) { out.push(list[i]); m += list[i].m; } return out; }
  // Shuffle: round and round the universe; nothing repeats until everything chosen has played
  function shufflePlaylist(index, sel, opts) {
    var o = Object.assign({ minutes: 480, played: [] }, opts), pool = filterBase(index, sel);
    if (sel.theme) pool = pool.filter(function (p) { return p.th.indexOf(sel.theme) >= 0; });
    if (!pool.length) return { ids: [], minutes: 0, cycleReset: false, poolSize: 0 };
    var heard = new Set(o.played), fresh = pool.filter(function (p) { return !heard.has(p.id); }), cycleReset = false;
    var order = shuffle(fresh);
    var target = o.minutes === Infinity || !o.minutes ? Infinity : o.minutes;
    var chosen = fill(order, target), m = chosen.reduce(function (n, p) { return n + p.m; }, 0);
    if (target !== Infinity && m < target && fresh.length < pool.length) { cycleReset = true; var used = new Set(chosen.map(function (p) { return p.id; })); chosen = chosen.concat(fill(shuffle(pool.filter(function (p) { return !used.has(p.id); })), target - m)); }
    if (target === Infinity && fresh.length < pool.length) { cycleReset = true; var u2 = new Set(chosen.map(function (p) { return p.id; })); chosen = chosen.concat(shuffle(pool.filter(function (p) { return !u2.has(p.id); }))); }
    return { ids: chosen.map(function (p) { return p.id; }), minutes: chosen.reduce(function (n, p) { return n + p.m; }, 0), cycleReset: cycleReset, poolSize: pool.length };
  }
  function markPlayed(played, id, pool) {
    var p = played.indexOf(id) >= 0 ? played.slice() : played.concat([id]), ids = new Set(pool.map(function (a) { return a.id; }));
    if (pool.length && pool.every(function (a) { return p.indexOf(a.id) >= 0; })) return p.filter(function (x) { return !ids.has(x); });
    return p;
  }
  function build(index, sel, opts) {
    opts = opts || {}; var mins = opts.minutes;
    if (sel.mode === 'shuffle') return shufflePlaylist(index, sel, opts);
    var list = sel.mode === 'thematic' ? thematic(index, sel) : sel.mode === 'section' ? oneSection(index, sel) : sel.mode === 'favourites' ? (sel.favourites || []).map(function (id) { return index.pieces.find(function (p) { return p.id === id; }); }).filter(Boolean) : chronological(index, sel);
    if (sel.startId) { var k = list.findIndex(function (p) { return p.id === sel.startId; }); if (k > 0) list = list.slice(k); }
    var chosen = fill(list, mins);
    return { ids: chosen.map(function (p) { return p.id; }), minutes: chosen.reduce(function (n, p) { return n + p.m; }, 0), poolSize: list.length };
  }
  function plainTitle(t) { return t.replace(/\s*\((?:cosmology|physics|astronomy|spacecraft|space telescope|galaxy|observatory)\)\s*$/i, ''); }
  function fmtMinutes(min) { min = Math.round(min); if (min < 60) return min + (min === 1 ? ' minute' : ' minutes'); var h = Math.floor(min / 60), r = min % 60, hs = h + (h === 1 ? ' hour' : ' hours'); return r ? hs + ' ' + r + (r === 1 ? ' minute' : ' minutes') : hs; }
  var LEVEL = { 1: 'introductory', 2: 'general', 3: 'detailed', 4: 'deep' };
  // the title spoken before each piece: its moment in cosmic time first, where it belongs to one
  function spokenTitle(index, p, opt) {
    opt = opt || {}; var EM = epochMap(index), when = !p.tl && EM[p.e] ? EM[p.e].when + ': ' : '';
    var t = when + plainTitle(p.t); if (!/[.?!]$/.test(t)) t += '.';
    if (opt.long) t += ' ' + (p.src === 'wp' ? 'From Wikipedia, adapted for listening.' : 'Written for this library.') + ' ' + LEVEL[p.lv].charAt(0).toUpperCase() + LEVEL[p.lv].slice(1) + ' level. About ' + fmtMinutes(p.m) + '.';
    return t;
  }
  function chunks(par, maxChars) {
    maxChars = maxChars || 200; var s = par.replace(/^## /, ''), sent = s.match(/[^.!?]+(?:[.!?]+["'\u201d\u2019)]*|$)\s*/g) || [s], out = [], cur = '';
    sent.forEach(function (t) {
      t = t.trim(); if (!t) return;
      while (t.length > maxChars * 1.6) { var cut = t.lastIndexOf(', ', maxChars); if (cut < maxChars / 3) cut = t.lastIndexOf('; ', maxChars); if (cut < maxChars / 3) cut = t.lastIndexOf(' ', maxChars); if (cut < 20) cut = maxChars; if (cur) { out.push(cur); cur = ''; } out.push(t.slice(0, cut + 1).trim()); t = t.slice(cut + 1).trim(); }
      if (cur && cur.length + t.length + 1 > maxChars) { out.push(cur); cur = t; } else cur = cur ? cur + ' ' + t : t;
    });
    if (cur) out.push(cur); return out;
  }
  function encodeResume(s) { return JSON.stringify({ v: 2, ids: s.ids, pos: s.pos | 0, para: s.para | 0, label: s.label || '', at: s.at || Date.now() }); }
  function decodeResume(str, index) {
    try {
      var d = JSON.parse(str); if (!d || d.v !== 2 || !Array.isArray(d.ids)) return null;
      var have = new Set(index.pieces.map(function (p) { return p.id; })), want = d.ids[d.pos], ids = d.ids.filter(function (id) { return have.has(id); });
      if (!ids.length) return null; var pos = ids.indexOf(want); var para = d.para | 0; if (pos < 0) { pos = Math.min(Math.max(0, d.pos | 0), ids.length - 1); para = 0; }
      return { ids: ids, pos: pos, para: Math.max(0, para), label: d.label || '', at: d.at || 0 };
    } catch (e) { return null; }
  }
  function eraFor(p) { return ERA_OF[p.e] != null ? ERA_OF[p.e] : 0; }
  var api = { randInt: randInt, shuffle: shuffle, chronological: chronological, thematic: thematic, oneSection: oneSection, fill: fill, shufflePlaylist: shufflePlaylist, markPlayed: markPlayed, build: build, spokenTitle: spokenTitle, plainTitle: plainTitle, fmtMinutes: fmtMinutes, chunks: chunks, encodeResume: encodeResume, decodeResume: decodeResume, eraFor: eraFor, epochMap: epochMap, ERA_OF: ERA_OF, SEC_RANK: SEC_RANK, LEVEL: LEVEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CS_LIB = api;
})(typeof window !== 'undefined' ? window : globalThis);

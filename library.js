/* Cosmic Sanctuary version 2: the Cosmologist Library, an audiobook of the early universe.
   Reading engine ported from Night Library v2: chunked British speech with a watchdog, playlists, shuffle without repeats,
   resume at the paragraph, sleep timer, shelves, browse and read, favourites. */
(function () {
  'use strict';
  var L = window.CS_LIB, $ = function (id) { return document.getElementById(id); };
  var K = 'cs2-lib.';
  function load(k, d) { try { var v = localStorage.getItem(K + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch (e) {} }
  var DEF = { mode: 'chrono', sections: ['chrono', 'evidence', 'theories', 'controversies', 'end'], shuffleSections: null, levels: [1, 2, 3, 4], startEpoch: 'before', theme: 'inflation', section: 'chrono', hours: 'all',
    voiceName: '', rate: 0.9, titles: true, longTitles: true, headings: true, gap: 2, under: false, underVol: 25, sleep: 'off', announce: false };
  var S = Object.assign({}, DEF, load('settings', {}));
  function saveS() { save('settings', S); }
  var IDX = null, BY = {}, packs = {}, SEC = {}, THEME = {};
  var st = { ids: [], pos: 0, para: 0, chunk: 0, playing: false, token: 0, utter: null, uStart: 0, uExpect: 0, uText: '', uDone: null, retries: 0, pre: [], paras: null, sleepAt: 0, stopAtEnd: false, wake: null, label: '' };
  var uid = 0;
  function el(tag, attrs, kids) { var e = document.createElement(tag); if (attrs) for (var k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'on') for (var ev in attrs.on) e.addEventListener(ev, attrs.on[ev]); else if (attrs[k] != null) e.setAttribute(k, attrs[k]); } (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  function button(label, fn, attrs) { var b = el('button', Object.assign({ type: 'button', text: label }, attrs || {})); b.addEventListener('click', fn); return b; }
  function announce(m) { var l = $('libStatus'); l.textContent = ''; setTimeout(function () { l.textContent = m; }, 60); }
  function setNow(m) { $('libNow').textContent = m; }
  var uiOpen = load('ui', {});
  function section(key, title, open, kids) { var body = el('div', { class: 'secbody', id: 'lb-' + key }, kids), isOpen = uiOpen[key] != null ? uiOpen[key] : open;
    var hb = el('button', { type: 'button', class: 'sechead', 'aria-expanded': String(isOpen), 'aria-controls': 'lb-' + key, text: title }); body.hidden = !isOpen;
    hb.addEventListener('click', function () { var o = hb.getAttribute('aria-expanded') !== 'true'; hb.setAttribute('aria-expanded', String(o)); body.hidden = !o; uiOpen[key] = o; save('ui', uiOpen); });
    return el('section', { class: 'sec' }, [el('h2', {}, [hb]), body]); }
  function radios(legend, name, opts, cur, onch) { var fs = el('fieldset', {}, [el('legend', { text: legend })]);
    opts.forEach(function (o) { var id = 'l' + (++uid), i = el('input', { type: 'radio', name: name, id: id, value: String(o[0]) }); i.checked = String(cur) === String(o[0]); i.addEventListener('change', function () { if (i.checked) onch(o[0]); }); fs.appendChild(el('div', { class: 'radio' }, [i, el('label', { for: id, text: o[1] })])); });
    return fs; }
  function checks(legend, opts, list, onch) { var fs = el('fieldset', {}, [el('legend', { text: legend })]);
    opts.forEach(function (o) { var id = 'l' + (++uid), i = el('input', { type: 'checkbox', id: id, value: String(o[0]) }); i.checked = list.indexOf(o[0]) >= 0; i.addEventListener('change', function () { onch(o[0], i.checked); }); fs.appendChild(el('div', { class: 'check' }, [i, el('label', { for: id, text: o[1] })])); });
    return fs; }
  function toggle(label, key, onch) { var id = 'l' + (++uid), i = el('input', { type: 'checkbox', id: id }); i.checked = !!S[key]; i.addEventListener('change', function () { S[key] = i.checked; saveS(); if (onch) onch(); }); return el('div', { class: 'check' }, [i, el('label', { for: id, text: label })]); }
  function slider(label, key, min, max, step, words, onch) { var id = 'l' + (++uid), i = el('input', { type: 'range', id: id, min: min, max: max, step: step }); i.value = S[key];
    var upd = function () { i.setAttribute('aria-valuetext', words(+i.value)); }; upd(); i.addEventListener('input', function () { S[key] = +i.value; saveS(); upd(); if (onch) onch(); });
    return el('div', { class: 'field' }, [el('label', { for: id, text: label }), i]); }
  function piece(id) { return BY[id]; }
  function hoursOf(list) { return L.fmtMinutes(list.reduce(function (n, p) { return n + p.m; }, 0)); }
  function pack(sec) {
    if (!packs[sec]) packs[sec] = fetch('library/' + sec + '.json').then(function (r) { if (!r.ok) throw new Error('pack ' + sec + ' ' + r.status); return r.json(); }).then(function (d) { return d.pieces; }).catch(function (e) { delete packs[sec]; throw e; });
    return packs[sec];
  }
  function textOf(id) { var p = piece(id); return pack(p.s).then(function (m) { return m[id] || []; }); }

  /* ---------- voice ---------- */
  function synth() { return window.speechSynthesis; }
  function voices() { try { return (synth() && synth().getVoices()) || []; } catch (e) { return []; } }
  function pickVoice() { var vs = voices(); if (S.voiceName) { var v = vs.filter(function (x) { return x.name === S.voiceName; })[0]; if (v) return v; }
    var gb = vs.filter(function (x) { return /en[-_]GB/i.test(x.lang); });
    return gb.filter(function (x) { return /premium|enhanced/i.test(x.name); })[0] || gb.filter(function (x) { return /daniel|serena|kate|arthur|martha|stephanie|oliver|jamie/i.test(x.name); })[0] || gb[0] || vs.filter(function (x) { return /^en/i.test(x.lang); })[0] || null; }
  function speak(text, done) {
    var sy = synth(), tok = ++st.token;
    if (!sy || !window.SpeechSynthesisUtterance) { setTimeout(function () { if (tok === st.token) done(); }, 50); return; }
    var u = new SpeechSynthesisUtterance(text), v = pickVoice(); if (v) { try { u.voice = v; } catch (e) {} } u.lang = (v && v.lang) || 'en-GB'; u.rate = S.rate; u.pitch = 1; u.volume = 1;
    var finished = false, fin = function () { if (finished || tok !== st.token) return; finished = true; st.utter = null; done(); };
    u.onend = fin; u.onerror = function (e) { if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; fin(); };
    st.utter = u; st.uText = text; st.uDone = done; st.uStart = Date.now(); st.uExpect = 3000 + text.length * 85 / Math.max(0.3, S.rate);
    try { sy.speak(u); } catch (e) { setTimeout(fin, 100); }
  }
  function primeSpeech() { try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth() && synth().speak(u); } catch (e) {} }
  function stopSpeech() { st.token++; st.utter = null; try { synth() && synth().cancel(); } catch (e) {} }
  function watchdog() {
    if (st.playing && st.utter) {
      var age = Date.now() - st.uStart, sy = synth(), stalled = age > st.uExpect * 2 + 4000 || (age > 4000 && sy && !sy.speaking && !sy.pending);
      if (stalled) { var t = st.uText, d = st.uDone; st.retries++; if (st.retries > 2) { st.retries = 0; stopSpeech(); d(); } else { stopSpeech(); try { sy.resume(); } catch (e) {} speak(t, d); } }
    }
    if (st.playing && st.sleepAt && Date.now() >= st.sleepAt) { st.sleepAt = 0; pause('The sleep timer has finished. Goodnight.'); }
  }
  setInterval(watchdog, 1500);

  /* ---------- player ---------- */
  function cur() { return piece(st.ids[st.pos]); }
  function persist() { save('resume', JSON.parse(L.encodeResume({ ids: st.ids, pos: st.pos, para: st.para, label: st.label }))); }
  function nowText(p) { return 'Now reading ' + (st.pos + 1) + ' of ' + st.ids.length + ': ' + L.spokenTitle(IDX, p) + ' ' + SEC[p.s] + '.'; }
  function updateUI() {
    $('libPlay').textContent = st.playing ? 'Pause reading' : 'Play';
    var p = cur(), favs = load('favs', []);
    $('libFav').textContent = p && favs.indexOf(p.id) >= 0 ? 'Remove this piece from favourites' : 'Add this piece to favourites';
    var ol = $('libNext'); ol.innerHTML = '';
    st.ids.slice(st.pos + 1, st.pos + 11).forEach(function (id) { var b = piece(id); if (b) ol.appendChild(el('li', { text: L.spokenTitle(IDX, b) + ' About ' + L.fmtMinutes(b.m) + '.' })); });
    if (!ol.children.length) ol.appendChild(el('li', { text: 'Nothing queued yet.' }));
    var r = L.decodeResume(JSON.stringify(load('resume', null)), IDX || { pieces: [] });
    var rb = $('libResume'); rb.hidden = st.playing || !r || st.ids.length > 0;
    if (r && !rb.hidden) rb.textContent = 'Resume where I stopped: ' + L.plainTitle(piece(r.ids[r.pos]).t);
  }
  function underlay(p) { if (!window.CS_APP || !window.CS_APP.underlay) return; try { window.CS_APP.underlay(S.under && st.playing ? { vol: S.underVol / 100, era: L.eraFor(p) } : null); } catch (e) {} }
  function startPiece(fromPara) {
    var p = cur(); if (!p) return endPlaylist();
    textOf(p.id).then(function (paras) {
      if (!st.playing || cur() !== p) return;
      st.paras = paras; st.para = Math.min(fromPara || 0, Math.max(0, paras.length - 1)); st.chunk = 0; st.pre = [];
      if (S.titles) st.pre.push(st.para ? 'Continuing: ' + L.plainTitle(p.t) + '.' : L.spokenTitle(IDX, p, { long: S.longTitles }));
      setNow(nowText(p)); if (S.announce) announce(nowText(p));
      media(p); persist(); updateUI(); underlay(p);
      var nx = piece(st.ids[st.pos + 1]); if (nx) pack(nx.s).catch(function () {});
      step();
    }).catch(function () { setNow('Could not load the library text. Check the internet connection and press Play again.'); announce('Could not load the library text.'); pause(); });
  }
  function step() {
    if (!st.playing) return;
    if (st.pre.length) { var t = st.pre.shift(); return speak(t, function () { st.retries = 0; step(); }); }
    var paras = st.paras || []; if (st.para >= paras.length) return pieceDone();
    var par = paras[st.para], head = par.indexOf('## ') === 0;
    if (head && !S.headings) { st.para++; st.chunk = 0; return step(); }
    var parts = head ? ['Section: ' + par.slice(3) + '.'] : L.chunks(par, 200);
    if (st.chunk >= parts.length) { st.para++; st.chunk = 0; persist(); return step(); }
    speak(parts[st.chunk], function () { st.retries = 0; st.chunk++; step(); });
  }
  function pieceDone() {
    var p = cur(); if (p) { var pool = IDX.pieces.filter(function (x) { return selPool(x); }); save('played', L.markPlayed(load('played', []), p.id, pool)); }
    if (st.stopAtEnd) { st.stopAtEnd = false; st.para = 0; st.pos++; persist(); pause('The sleep timer stopped at the end of the piece. Goodnight.'); return; }
    if (st.pos + 1 >= st.ids.length) return endPlaylist();
    st.pos++; st.para = 0; persist();
    var tok = st.token; setTimeout(function () { if (st.playing && tok === st.token) startPiece(0); }, S.gap * 1000);
  }
  function endPlaylist() { st.playing = false; stopSpeech(); save('resume', null); st.ids = []; st.pos = 0; underlay(null); updateUI(); releaseWake(); setNow('The playlist has finished. Build a new one, or press Play for a shuffle.'); announce('The playlist has finished.'); }
  function play(fromResume) {
    primeSpeech(); // iOS: speech must start inside the tap
    if (window.CS_APP && window.CS_APP.isPlaying && window.CS_APP.isPlaying() && !window.CS_APP.isUnder()) window.CS_APP.pause('The soundscape is paused while the library reads.');
    if (!st.ids.length) {
      var r = L.decodeResume(JSON.stringify(load('resume', null)), IDX);
      if (r) { st.ids = r.ids; st.pos = r.pos; st.para = r.para; st.label = r.label; }
      else if (!buildFromSettings(true)) return;
    }
    st.playing = true; st.stopAtEnd = false; setSleep(); wakeLock(); updateUI(); startPiece(st.para);
  }
  function pause(msg) { if (!st.playing) return; st.playing = false; stopSpeech(); st.chunk = 0; persist(); underlay(null); releaseWake(); updateUI(); setNow('Paused. ' + (cur() ? L.plainTitle(cur().t) + '.' : '')); announce(msg || 'Paused.'); try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {} }
  function toggle2() { if (st.playing) pause(); else play(); }
  function jumpPiece(d) { if (!st.ids.length) { announce('Nothing is playing yet.'); return; } var n = st.pos + d; if (n < 0 || n >= st.ids.length) { announce(d > 0 ? 'This is the last piece.' : 'This is the first piece.'); return; }
    stopSpeech(); st.pos = n; st.para = 0; persist(); if (st.playing) startPiece(0); else { updateUI(); setNow('Ready: ' + L.plainTitle(cur().t) + '. Press Play.'); announce(L.plainTitle(cur().t)); } }
  function jumpPara(d) { if (!st.playing || !st.paras) { announce('Press Play first.'); return; } stopSpeech(); st.pre = []; st.para = Math.max(0, Math.min(st.paras.length - 1, st.para + d)); st.chunk = 0; persist(); step(); }
  function whatsThis() { var p = cur(); if (!p) { announce('Nothing is playing. ' + IDX.pieces.length + ' pieces in the library.'); return; }
    var left = 0; if (st.paras) for (var i = st.para; i < st.paras.length; i++) left += st.paras[i].split(/\s+/).length;
    announce(L.spokenTitle(IDX, p, { long: true }) + ' ' + SEC[p.s] + '. Piece ' + (st.pos + 1) + ' of ' + st.ids.length + '. ' + (st.paras ? 'About ' + L.fmtMinutes(left / (150 * S.rate / 0.9)) + ' left in this piece.' : '')); }
  function toggleFav() { var p = cur() || (readingId && piece(readingId)); if (!p) { announce('Nothing to add yet.'); return; } var f = load('favs', []), i = f.indexOf(p.id);
    if (i >= 0) { f.splice(i, 1); announce('Removed from favourites.'); } else { f.push(p.id); announce('Added to favourites: ' + L.plainTitle(p.t) + '.'); } save('favs', f); updateUI(); renderFavs(); }

  /* ---------- playlists ---------- */
  function selection() { return { mode: S.mode, sections: S.mode === 'shuffle' ? (S.shuffleSections || IDX.sections.map(function (s) { return s.id; })) : S.sections, levels: S.levels, startEpoch: S.startEpoch, theme: S.mode === 'thematic' ? S.theme : null, section: S.section, favourites: load('favs', []) }; }
  function selPool(p) { var s = selection(); if (s.mode === 'section') return p.s === s.section; if (s.mode === 'thematic') return p.th.indexOf(s.theme) >= 0; return (s.sections || []).indexOf(p.s) >= 0; }
  var MODE_WORDS = { chrono: 'Chronological', thematic: 'Thematic', shuffle: 'Shuffle', section: 'One section', favourites: 'Favourites' };
  function buildFromSettings(quiet, override) {
    var sel = Object.assign(selection(), override || {}), mins = S.hours === 'all' ? Infinity : (+S.hours) * 60;
    var res = L.build(IDX, sel, { minutes: mins, played: load('played', []) });
    if (!res.ids.length) { announce('Nothing matches those choices. Tick at least one section and one level.'); return false; }
    stopSpeech(); st.ids = res.ids; st.pos = 0; st.para = 0; st.label = (override && override.label) || MODE_WORDS[sel.mode];
    persist(); updateUI();
    var msg = st.label + ' playlist: ' + res.ids.length + ' pieces, about ' + L.fmtMinutes(res.minutes) + '. First: ' + L.plainTitle(piece(res.ids[0]).t) + '.' + (res.cycleReset ? ' You have heard everything in this choice, so it starts round again.' : '');
    setNow(msg); if (!quiet) announce(msg); return true;
  }
  function shelf(label, override) { return button(label, function () { pause(); st.ids = []; var o = Object.assign({ label: label }, override); var hs = S.hours; if (o.hours) S.hours = o.hours; var ok = buildFromSettings(true, o); S.hours = hs; if (ok) { announce(label + '. ' + $('libNow').textContent); play(); } }); }

  /* ---------- browse and read ---------- */
  var readingId = null;
  function renderBrowse() {
    var box = $('libBrowse'); box.innerHTML = '';
    IDX.sections.forEach(function (s) {
      var ps = IDX.pieces.filter(function (p) { return p.s === s.id; });
      var hid = 'lbh-' + s.id, ul = el('ul', { class: 'plain' });
      ps.forEach(function (p) { ul.appendChild(el('li', {}, [button('Read: ' + L.spokenTitle(IDX, p) + ' ' + L.LEVEL[p.lv] + ', about ' + L.fmtMinutes(p.m), function () { openReader(p.id); })])); });
      var body = el('div', { hidden: '' }, [ul]);
      var hb = el('button', { type: 'button', class: 'sechead', 'aria-expanded': 'false', text: s.name + ': ' + ps.length + ' pieces, ' + hoursOf(ps) });
      hb.addEventListener('click', function () { var o = hb.getAttribute('aria-expanded') !== 'true'; hb.setAttribute('aria-expanded', String(o)); body.hidden = !o; });
      box.appendChild(el('div', {}, [el('h3', { id: hid }, [hb]), body]));
    });
  }
  function openReader(id) {
    readingId = id; var p = piece(id), r = $('libReader'); r.hidden = false; r.innerHTML = '';
    r.appendChild(el('h3', { tabindex: '-1', id: 'libReaderTitle', text: L.plainTitle(p.t) }));
    r.appendChild(el('p', { class: 'hint', text: (p.tl ? '' : IDX.epochs.find(function (e) { return e.id === p.e; }).when + '. ') + SEC[p.s] + '. ' + L.LEVEL[p.lv].charAt(0).toUpperCase() + L.LEVEL[p.lv].slice(1) + ' level. About ' + L.fmtMinutes(p.m) + '. ' + (p.src === 'wp' ? 'From Wikipedia, adapted for listening.' : 'Written for this library.') }));
    r.appendChild(el('div', { class: 'row' }, [button('Play this piece', function () { playOne(id); }), button('Play from here onwards in this section', function () { pause(); st.ids = []; var o = { mode: 'section', section: p.s, startId: id, label: SEC[p.s] }; var hs = S.hours; S.hours = 'all'; buildFromSettings(true, o); S.hours = hs; play(); }), button('Add or remove from favourites', function () { var f = load('favs', []), i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); save('favs', f); renderFavs(); announce(i >= 0 ? 'Removed from favourites.' : 'Added to favourites.'); }), button('Close the text', function () { r.hidden = true; readingId = null; var b = $('lbh-' + p.s); if (b) b.querySelector('button').focus(); })]));
    var body = el('div', { class: 'reader' }); r.appendChild(body); body.appendChild(el('p', { text: 'Loading the text.' }));
    textOf(id).then(function (paras) { body.innerHTML = ''; paras.forEach(function (x) { body.appendChild(x.indexOf('## ') === 0 ? el('h4', { text: x.slice(3) }) : el('p', { text: x })); });
      if (p.src === 'wp') body.appendChild(el('p', { class: 'hint' }, ['Source: ', el('a', { href: p.url, text: 'the Wikipedia article ' + p.t }), ', licensed under Creative Commons Attribution-ShareAlike 4.0. Adapted for listening: references, tables and most formulas removed.'])); }).catch(function () { body.textContent = 'Could not load the text. Check the internet connection.'; });
    setTimeout(function () { $('libReaderTitle').focus(); }, 50);
  }
  function playOne(id) { pause(); st.ids = [id]; st.pos = 0; st.para = 0; st.label = 'One piece'; persist(); play(); }
  function renderFavs() { var box = $('libFavs'); if (!box) return; box.innerHTML = ''; var f = load('favs', []).filter(function (id) { return BY[id]; });
    if (!f.length) { box.appendChild(el('p', { text: 'No favourites yet. While a piece is playing, press Add this piece to favourites.' })); return; }
    var ul = el('ul', { class: 'plain' }); f.forEach(function (id) { ul.appendChild(el('li', {}, [button('Read: ' + L.plainTitle(BY[id].t), function () { openReader(id); })])); }); box.appendChild(ul);
    box.appendChild(button('Play all favourites in cosmic order', function () { pause(); st.ids = []; var list = L.chronological({ pieces: f.map(function (id) { return BY[id]; }), epochs: IDX.epochs }, {}).map(function (p) { return p.id; }); st.ids = list; st.pos = 0; st.para = 0; st.label = 'Favourites'; persist(); play(); })); }

  /* ---------- sleep timer, wake lock, media session ---------- */
  function setSleep() { st.sleepAt = 0; st.stopAtEnd = false; if (!st.playing) return; if (S.sleep === 'end') st.stopAtEnd = true; else if (S.sleep !== 'off') st.sleepAt = Date.now() + (+S.sleep) * 60000; renderSleepLeft(); }
  function renderSleepLeft() { var e = $('libSleepLeft'); if (!e) return; e.textContent = S.sleep === 'off' ? 'The sleep timer is off.' : S.sleep === 'end' ? 'Reading will stop at the end of the current piece.' : st.sleepAt ? 'About ' + L.fmtMinutes((st.sleepAt - Date.now()) / 60000) + ' left.' : 'The timer starts when you press Play.'; }
  async function wakeLock() { try { if ('wakeLock' in navigator && !st.wake && st.playing) { st.wake = await navigator.wakeLock.request('screen'); st.wake.addEventListener('release', function () { st.wake = null; }); } } catch (e) {} }
  function releaseWake() { if (st.wake) { try { st.wake.release(); } catch (e) {} st.wake = null; } }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && st.playing) wakeLock(); });
  function media(p) { if (!('mediaSession' in navigator)) return; try { navigator.mediaSession.metadata = new MediaMetadata({ title: L.plainTitle(p.t), artist: 'Cosmologist Library', album: SEC[p.s] }); navigator.mediaSession.playbackState = 'playing';
    navigator.mediaSession.setActionHandler('play', function () { if (!st.playing) play(); }); navigator.mediaSession.setActionHandler('pause', function () { pause(); });
    navigator.mediaSession.setActionHandler('nexttrack', function () { jumpPiece(1); }); navigator.mediaSession.setActionHandler('previoustrack', function () { jumpPiece(-1); }); } catch (e) {} }

  /* ---------- page ---------- */
  function renderBuild() {
    var box = $('libBuild'); box.innerHTML = '';
    box.appendChild(radios('How to listen', 'lmode', [['chrono', 'Chronological: from the very beginning onwards, in cosmic time'], ['thematic', 'Thematic: everything on one big topic'], ['shuffle', 'Shuffle: round and round the universe, no repeats'], ['section', 'One section only, from start to finish']], S.mode, function (v) { S.mode = v; saveS(); renderBuild(); announce(MODE_WORDS[v] + ' chosen.'); }));
    var secOpts = IDX.sections.map(function (s) { var ps = IDX.pieces.filter(function (p) { return p.s === s.id; }); return [s.id, s.name + ' (' + ps.length + ' pieces, ' + hoursOf(ps) + ')']; });
    if (S.mode === 'chrono') {
      box.appendChild(checks('Sections to include', secOpts, S.sections, function (v, on) { S.sections = S.sections.filter(function (x) { return x !== v; }); if (on) S.sections.push(v); saveS(); }));
      box.appendChild(el('p', { class: 'hint', text: 'The chronology is the backbone. Pieces from the other ticked sections join it once the story has reached their moment in cosmic time.' }));
      var eo = [['before', 'From the very beginning']].concat(IDX.epochs.filter(function (e) { return e.id !== 'before'; }).map(function (e) { return [e.id, e.when]; }));
      box.appendChild(radios('Start at', 'lstart', eo, S.startEpoch, function (v) { S.startEpoch = v; saveS(); }));
    } else if (S.mode === 'shuffle') {
      var ss = S.shuffleSections || IDX.sections.map(function (s) { return s.id; });
      box.appendChild(checks('Sections to include', secOpts, ss, function (v, on) { var a = (S.shuffleSections || IDX.sections.map(function (s) { return s.id; })).filter(function (x) { return x !== v; }); if (on) a.push(v); S.shuffleSections = a; saveS(); }));
    } else if (S.mode === 'thematic') {
      box.appendChild(radios('Topic', 'ltheme', IDX.themes.map(function (t) { var ps = IDX.pieces.filter(function (p) { return p.th.indexOf(t.id) >= 0; }); return [t.id, t.name + ' (' + ps.length + ' pieces, ' + hoursOf(ps) + ')']; }), S.theme, function (v) { S.theme = v; saveS(); }));
    } else if (S.mode === 'section') {
      box.appendChild(radios('Section', 'lsec', secOpts, S.section, function (v) { S.section = v; saveS(); }));
    }
    box.appendChild(checks('Levels', [[1, 'Introductory'], [2, 'General'], [3, 'Detailed'], [4, 'Deep']], S.levels, function (v, on) { S.levels = S.levels.filter(function (x) { return x !== v; }); if (on) S.levels.push(v); saveS(); }));
    box.appendChild(radios('Playlist length', 'lhours', [['1', '1 hour'], ['2', '2 hours'], ['4', '4 hours'], ['8', '8 hours'], ['all', 'Everything in the choice']], S.hours, function (v) { S.hours = v; saveS(); }));
    box.appendChild(el('div', { class: 'row' }, [button('Build the playlist and play', function () { pause(); st.ids = []; if (buildFromSettings(true)) { announce($('libNow').textContent); play(); } }), button('Build the playlist only', function () { pause(); buildFromSettings(false); })]));
  }
  function renderVoice() {
    var box = $('libVoice'); box.innerHTML = '';
    var id = 'l' + (++uid), sel = el('select', { id: id });
    var fill = function () { var vs = voices().filter(function (v) { return /^en/i.test(v.lang); }); sel.innerHTML = ''; sel.appendChild(el('option', { value: '', text: 'Automatic: the best British English voice' }));
      vs.filter(function (v) { return /GB/i.test(v.lang); }).concat(vs.filter(function (v) { return !/GB/i.test(v.lang); })).forEach(function (v) { sel.appendChild(el('option', { value: v.name, text: v.name + ' (' + v.lang + ')' })); }); sel.value = S.voiceName; };
    fill(); try { if (synth()) synth().addEventListener('voiceschanged', fill); } catch (e) {}
    sel.addEventListener('change', function () { S.voiceName = sel.value; saveS(); });
    box.appendChild(el('div', { class: 'field' }, [el('label', { for: id, text: 'Reading voice' }), sel]));
    box.appendChild(slider('Reading speed', 'rate', 0.6, 1.4, 0.05, function (v) { return v.toFixed(2) + ' times normal speed'; }));
    box.appendChild(slider('Pause between pieces', 'gap', 0, 10, 1, function (v) { return v + (v === 1 ? ' second' : ' seconds'); }));
    box.appendChild(toggle('Speak the title before each piece', 'titles'));
    box.appendChild(toggle('Say the source, level and length after the title', 'longTitles'));
    box.appendChild(toggle('Speak section headings inside pieces', 'headings'));
    box.appendChild(toggle('Announce each new piece to VoiceOver as well', 'announce'));
    box.appendChild(button('Test the voice', function () { if (st.playing) pause(); primeSpeech(); speak('This is the Cosmologist Library voice. Ten to the minus thirty-six seconds: inflation.', function () {}); }));
  }
  function renderUnder() {
    var box = $('libUnder'); box.innerHTML = '';
    box.appendChild(el('p', { class: 'hint', text: 'Plays the Cosmic Sanctuary soundscape quietly underneath the reading, following the era of each piece. The Cosmologist voice of the soundscape stays silent while the library reads. Off unless you turn it on.' }));
    box.appendChild(toggle('Play the soundscape under the reading', 'under', function () { if (st.playing && cur()) underlay(cur()); announce(S.under ? 'The soundscape will play under the reading.' : 'The soundscape under the reading is off.'); }));
    box.appendChild(slider('Soundscape volume under the reading', 'underVol', 5, 80, 5, function (v) { return v + ' percent'; }, function () { if (st.playing && S.under && cur()) underlay(cur()); }));
  }
  function renderSleep() {
    var box = $('libSleep'); box.innerHTML = '';
    box.appendChild(radios('Stop reading after', 'lsleep', [['off', 'Off'], ['15', '15 minutes'], ['30', '30 minutes'], ['45', '45 minutes'], ['60', '1 hour'], ['90', '90 minutes'], ['120', '2 hours'], ['end', 'At the end of this piece']], S.sleep, function (v) { S.sleep = v; saveS(); setSleep(); renderSleepLeft(); announce(v === 'off' ? 'Sleep timer off.' : 'Sleep timer set.'); }));
    box.appendChild(el('p', { id: 'libSleepLeft' })); renderSleepLeft();
  }
  function renderShelves() {
    var box = $('libShelves'); box.innerHTML = '';
    var ul = el('ul', { class: 'plain' });
    [['The Story So Far: the early universe in plain words, in order', { mode: 'chrono', sections: ['chrono'], originalOnly: true, hours: 'all' }],
     ['The whole chronology, from the very beginning to the first billion years', { mode: 'section', section: 'chrono', hours: 'all' }],
     ['The great controversies, explained', { mode: 'section', section: 'controversies', hours: 'all' }],
     ['Introductions only, shuffled', { mode: 'shuffle', levels: [1], hours: 'all' }],
     ['The end of the universe', { mode: 'section', section: 'end', hours: 'all' }],
     ['Radio astronomy', { mode: 'thematic', theme: 'radio', hours: 'all' }],
     ['Inflation and the multiverse', { mode: 'thematic', theme: 'inflation', hours: 'all' }],
     ['Dark matter', { mode: 'thematic', theme: 'darkmatter', hours: 'all' }],
     ['Black holes', { mode: 'thematic', theme: 'blackholes', hours: 'all' }],
     ['The physics you need, from the beginning', { mode: 'section', section: 'physics', hours: 'all' }],
     ['Everything, shuffled for tonight: 8 hours', { mode: 'shuffle', sections: IDX.sections.map(function (s) { return s.id; }), levels: [1, 2, 3, 4], hours: '8' }]
    ].forEach(function (x) { ul.appendChild(el('li', {}, [shelf(x[0], x[1])])); });
    box.appendChild(ul);
  }
  function renderHelp() {
    var box = $('libHelp'); box.innerHTML = '';
    var tot = IDX.pieces.reduce(function (n, p) { return n + p.m; }, 0), orig = IDX.pieces.filter(function (p) { return p.src === 'orig'; });
    [ 'The Cosmologist Library is an audiobook of the early universe: ' + IDX.pieces.length + ' pieces, about ' + Math.round(tot / 60) + ' hours of listening, in eight sections.',
      'Press Play to start. The first time, it plays the chronology from the very beginning. Pause reading stops at once, and Play carries on from the same paragraph, even after the phone has restarted the page.',
      'Use Build a playlist to choose Chronological, Thematic, Shuffle or One section only, and which sections and levels to include. Shuffle never repeats a piece until you have heard everything in your choice.',
      'Previous piece and Next piece move through the playlist; Back a paragraph and Forward a paragraph move within a piece. The lock screen and headphone controls also skip pieces.',
      'Browse and read lists every piece by section, under headings, so you can move by heading with the VoiceOver rotor. Choose Read to show the text on the screen, or play it.',
      orig.length + ' pieces were written for this library: section overviews, The Story So Far series and the controversy explainers. The rest are Wikipedia articles adapted for listening, with references, tables and lists removed and formulas spoken in words or left out with a short note.',
      'Speech on iPhones can stop when the screen locks. Keep the screen on while listening, ideally plugged in; the app asks the phone to keep the screen awake while it reads.'
    ].forEach(function (t) { box.appendChild(el('p', { text: t })); });
    box.appendChild(el('p', {}, [el('a', { href: 'credits.html', text: 'Credits and licences for every article and sound' })]));
    box.appendChild(el('div', { class: 'row' }, [button('About this version', function () { var m = 'Cosmic Sanctuary version 2. New: the Cosmologist Library, ' + IDX.pieces.length + ' pieces and about ' + Math.round(tot / 60) + ' hours about the early universe. Everything from version 1 is still here in the Soundscape.'; announce(m); if (!st.playing) { primeSpeech(); speak(m, function () {}); } }),
      button('Let everything play again in shuffle', function () { save('played', []); announce('Done. Every piece can play again.'); }),
      button('Save the whole library for offline use', saveOffline)]));
    box.appendChild(el('p', { id: 'libOffline' }));
  }
  async function saveOffline() { announce('Saving the library. Please wait.'); try { await Promise.all(IDX.sections.map(function (s) { return pack(s.id); })); var m = navigator.serviceWorker && navigator.serviceWorker.controller ? 'The whole library is saved on this phone.' : 'The whole library is loaded for this session.'; $('libOffline').textContent = m; announce(m); } catch (e) { announce('Could not save everything. Check the internet connection.'); } }
  function buildPage() {
    var root = $('libApp'); root.innerHTML = '';
    root.appendChild(section('build', 'Build a playlist', true, [el('div', { id: 'libBuild' })]));
    root.appendChild(section('next', 'Up next', false, [el('ol', { id: 'libNext' })]));
    root.appendChild(section('shelves', 'Shelves: ready-made playlists', false, [el('div', { id: 'libShelves' })]));
    root.appendChild(section('browse', 'Browse and read', false, [el('div', { id: 'libBrowse' }), el('div', { id: 'libReader', class: 'box', hidden: '' })]));
    root.appendChild(section('favs', 'Favourites', false, [el('div', { id: 'libFavs' })]));
    root.appendChild(section('voice', 'Reading voice', false, [el('div', { id: 'libVoice' })]));
    root.appendChild(section('under', 'Soundscape under the reading', false, [el('div', { id: 'libUnder' })]));
    root.appendChild(section('sleep', 'Sleep timer for reading', false, [el('div', { id: 'libSleep' })]));
    root.appendChild(section('help', 'How to use the library, and credits', false, [el('div', { id: 'libHelp' })]));
    renderBuild(); renderShelves(); renderBrowse(); renderFavs(); renderVoice(); renderUnder(); renderSleep(); renderHelp(); updateUI();
  }
  async function init() {
    $('libPlay').addEventListener('click', toggle2); $('libPrev').addEventListener('click', function () { jumpPiece(-1); }); $('libNextBtn').addEventListener('click', function () { jumpPiece(1); });
    $('libPBack').addEventListener('click', function () { jumpPara(-1); }); $('libPFwd').addEventListener('click', function () { jumpPara(1); }); $('libWhat').addEventListener('click', whatsThis); $('libFav').addEventListener('click', toggleFav);
    $('libResume').addEventListener('click', function () { play(true); });
    try { var r = await fetch('library/index.json'); if (!r.ok) throw new Error(r.status); IDX = await r.json(); } catch (e) { setNow('Could not load the library. Check the internet connection and reload the page.'); return; }
    IDX.pieces.forEach(function (p) { BY[p.id] = p; }); IDX.sections.forEach(function (s) { SEC[s.id] = s.name; }); IDX.themes.forEach(function (t) { THEME[t.id] = t.name; });
    buildPage();
    var tot = IDX.pieces.reduce(function (n, p) { return n + p.m; }, 0);
    setNow($('libResume').hidden ? 'The Cosmologist Library is ready: ' + IDX.pieces.length + ' pieces, about ' + Math.round(tot / 60) + ' hours. Press Play to begin at the beginning.' : 'Welcome back. Press Resume to carry on where you stopped, or Play.');
    document.body.dataset.libReady = '1';
  }
  window.CS_LIBRARY = { st: st, S: function () { return S; }, idx: function () { return IDX; }, play: play, pause: pause, isPlaying: function () { return st.playing; }, build: buildFromSettings };
  init();
})();

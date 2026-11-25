/* Demo scene for store filming (2026-11-25, Boss for A/V Team). A classic script, loaded by index.html's head only when a
   demo is asked for, before any module runs. It makes every load identical: a frozen sky from a data file (data/demo/<scene>.json)
   in place of the live plane feed, the clock pinned to the scene's start (it then runs on normally, so planes move), the place
   and weather pinned, routes from the scene, and nothing sent anywhere: no usage notes, no plane feed, no weather server, no
   GitHub. js/main.js seeds the collection (js/test-load.js demoCatches) and refuses the demo in a browser with real catches.

   How it's asked for (index.html):
     ?demo=<scene>             on localhost / 127.0.0.1 only (a link to the real site can't turn it on)
     localStorage skyDemo=<scene>   anywhere but the native apps (a player can't set it by accident)
     ?film=0 or localStorage skyFilm='0'  keeps the testing tools, tips and footer (filming mode is on by default in a demo)
     ?qr=1 or localStorage skyFilmQr='1'  keeps the boarding pass's code scannable while filming
   Off: localStorage.removeItem('skyDemo') and reload, or load without ?demo. */
(function () {
  'use strict';
  var ls = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var q = new URLSearchParams(location.search);
  var up = null; try { up = window.parent !== window && window.parent.__skyDemo; } catch (e) {} /* the Collection frame (cards.html) follows the app's demo and clock */
  var name = String((up && up.name) || q.get('demo') || ls('skyDemo') || '').replace(/[^a-z0-9-]/gi, '');
  if (!name) return;
  var scene = null;
  try { var x = new XMLHttpRequest(); x.open('GET', 'data/demo/' + name + '.json', false); x.send(); if (x.status === 200) scene = JSON.parse(x.responseText); } catch (e) {}
  if (!scene) { console.warn('[demo] no scene "' + name + '"'); return; }
  var film = up ? up.film : (q.get('film') || ls('skyFilm') || '1') !== '0';
  var qr = up ? up.qr : (q.get('qr') || ls('skyFilmQr') || '0') === '1'; /* filming: the boarding pass's code can't be scanned unless ?qr=1 (js/flight-card.js) */
  var RealDate = Date, start = RealDate.parse(scene.start), off = up ? up.off : start - RealDate.now();

  // ---- the clock: starts at the scene's time on every load, then runs on ----
  function DemoDate() {
    var a = Array.prototype.slice.call(arguments);
    if (!(this instanceof DemoDate)) return new RealDate(RealDate.now() + off).toString();
    return a.length ? new (Function.prototype.bind.apply(RealDate, [null].concat(a)))() : new RealDate(RealDate.now() + off);
  }
  DemoDate.prototype = RealDate.prototype;
  DemoDate.now = function () { return RealDate.now() + off; };
  DemoDate.parse = RealDate.parse; DemoDate.UTC = RealDate.UTC;
  Object.setPrototypeOf(DemoDate, RealDate);
  globalThis.Date = DemoDate;

  // ---- the sky: each plane placed by bearing and ground distance at the start, flown on its track ----
  var RAD = Math.PI / 180, KM_DEG = 111.32, obs = scene.observer;
  function bearing(a, b) { var y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD), x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD); return (Math.atan2(y, x) / RAD + 360) % 360; }
  function move(lat, lon, deg, km) { return { lat: lat + km * Math.cos(deg * RAD) / KM_DEG, lon: lon + km * Math.sin(deg * RAD) / (KM_DEG * Math.cos(lat * RAD)) }; }
  var airports = null;
  function airportsSync() { if (airports) return airports; try { var x = new XMLHttpRequest(); x.open('GET', 'data/routes/airports.json', false); x.send(); airports = JSON.parse(x.responseText); } catch (e) { airports = {}; } return airports; }
  var planes = (scene.planes || []).map(function (p, i) {
    var at = p.lat != null ? { lat: p.lat, lon: p.lon } : move(obs.lat, obs.lon, p.az, p.km), track = p.track;
    if (track == null && p.toward) track = bearing(at, obs); /* coming over: straight at you */
    if (track == null && p.route) { var to = airportsSync()[p.route.split('-').pop()]; if (to) track = bearing(at, { lat: to[4], lon: to[5] }); }
    return { p: p, lat: at.lat, lon: at.lon, track: track == null ? 0 : track, hex: 'd3e0' + (i + 16).toString(16).padStart(2, '0') };
  });
  function feed() {
    var t = DemoDate.now(), s = (t - start) / 1000;
    return { now: t / 1000, demo: true, ac: planes.map(function (q) {
      var p = q.p, at = move(q.lat, q.lon, q.track, (p.kt || 0) * 0.000514444 * s), ft = Math.max(500, Math.min(41000, (p.ft || 0) + (p.climb || 0) * s / 60));
      return { hex: q.hex, flight: p.flight ? (p.flight + '        ').slice(0, 8) : '', r: '', t: p.t || '', desc: p.desc || '', category: p.category || '', lat: at.lat, lon: at.lon,
        alt_baro: Math.round(ft), alt_geom: Math.round(ft), gs: p.kt || 0, track: q.track, geom_rate: p.climb || 0, seen_pos: 0, seen: 0, dbFlags: 0 };
    }) };
  }

  // ---- routes from the scene: merged into the bundled per-airline files (data/routes/r/<AAA>.json) ----
  var routes = {};
  (scene.planes || []).concat(scene.regulars || []).forEach(function (p) { if (p.flight && p.route) { var a = p.flight.slice(0, 3); (routes[a] = routes[a] || {})[p.flight.slice(3)] = p.route; } });

  // ---- the weather: the scene's, every hour ----
  function wx() { var w = scene.weather || { cloud: 0, code: 0 }, h0 = Math.floor(DemoDate.now() / 3600e3) * 3600e3, hours = [];
    for (var i = -6; i < 48; i++) hours.push({ t: h0 + i * 3600e3, step: 1, cloud: w.cloud, code: w.code, temp: w.temp == null ? 2 : w.temp, wind: 3 });
    return { now: { cloud: w.cloud, code: w.code }, hours: hours }; }

  // ---- the network: answered here, never sent ----
  var realFetch = globalThis.fetch.bind(globalThis);
  var json = function (o, st) { return Promise.resolve(new Response(JSON.stringify(o), { status: st || 200, headers: { 'Content-Type': 'application/json' } })); };
  globalThis.fetch = function (input, init) {
    var url = String(input && input.url || input), u; try { u = new URL(url, location.href); } catch (e) { return realFetch(input, init); }
    if (u.origin === location.origin) {
      var m = /\/data\/routes\/r\/([A-Z0-9]{3})\.json$/.exec(u.pathname);
      if (m && routes[m[1]]) return realFetch(input, init).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { return json(Object.assign({}, j, routes[m[1]])); });
      return realFetch(input, init);
    }
    if (/\/planes\/?$/.test(u.pathname)) return json(feed());
    if (/\/wx$/.test(u.pathname)) return json(wx());
    return json({ demo: true }, 404); /* usage notes, packs, GitHub, the dial: nothing leaves the page */
  };
  try { navigator.sendBeacon = function () { return true; }; } catch (e) {}

  // ---- the place, and a returning player's first-run flags (seeded catches make it "not a first run") ----
  /* a browser the demo has already checked (js/main.js demoSeed marks it skyDemoClean: no real catches) starts each load
     from nothing, so one take's missions, notes and tallies don't carry into the next */
  if (!up && ls('skyDemoClean') === '1') try { var hold = {}; ['skyDemo', 'skyFilm', 'skyDemoBackup', 'skyDemoClean'].forEach(function (k) { hold[k] = localStorage.getItem(k); }); localStorage.clear(); sessionStorage.clear(); Object.keys(hold).forEach(function (k) { if (hold[k] != null) localStorage.setItem(k, hold[k]); }); } catch (e) {}
  if (!up) try {
    /* what's overwritten is kept, so js/main.js can put it back if this browser turns out to have real catches */
    if (localStorage.getItem('skyDemoBackup') == null) { var keep = {}; ['observer', 'started', 'tourDone', 'wcSeen', 'radarTip', 'shinyExplained', 'share', 'planeRelay', 'skyServer', 'skyRegulars', 'skyRegularTypes', 'skyNote'].forEach(function (k) { keep[k] = localStorage.getItem(k); }); localStorage.setItem('skyDemoBackup', JSON.stringify(keep)); }
    localStorage.setItem('observer', JSON.stringify({ lat: obs.lat, lon: obs.lon, manual: true, place: obs.place || '' }));
    ['started', 'tourDone', 'wcSeen', 'radarTip', 'shinyExplained'].forEach(function (k) { localStorage.setItem(k, '1'); });
    /* the regulars this phone has learned: each flight's first sighting on the given days ago, at its usual time */
    var regs = {}, regTypes = {};
    (scene.regulars || []).forEach(function (r) { var hm = String(r.usual || '12:00').split(':'), m = (+hm[0]) * 60 + (+hm[1]), d = {};
      (r.days || []).forEach(function (ago, i) { var t = new RealDate(start - ago * 86400e3); d[t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate()] = m + ((i * 7) % 9) - 4; });
      regs[r.flight] = d; if (r.t) regTypes[r.flight] = r.t; });
    localStorage.setItem('skyRegulars', JSON.stringify(regs)); localStorage.setItem('skyRegularTypes', JSON.stringify(regTypes));
    if (scene.noteMem) { var nm = {}; Object.keys(scene.noteMem).forEach(function (k) { if (k !== 'about') nm[k] = scene.noteMem[k]; }); localStorage.setItem('skyNote', JSON.stringify(nm)); } /* the note's memory at load (js/sky-note.js) */
    localStorage.setItem('share', '0'); /* usage notes off (js/field-notes.js) */
    localStorage.removeItem('planeRelay'); localStorage.removeItem('skyServer');
  } catch (e) {}

  globalThis.__skyDemo = { name: name, scene: scene, start: start, off: off, film: film, qr: qr, hero: scene.hero || '' };
  document.documentElement.classList.add('sky-demo');
  if (film) document.documentElement.classList.add('sky-film');
})();

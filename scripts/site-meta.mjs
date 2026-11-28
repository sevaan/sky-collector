// skycollector.app's machine-readable bits (2026-11-27, Content's brief content/site-schema-2026-11-27.md in the Space
// Collector folder, after Sevaan's "give the entire site the correct schema and stuff so ai answers might pick it up"):
// the home page's Organization + WebSite JSON-LD, the help page's FAQPage built from the page itself (so the two can't
// disagree), canonical and social tags for help and privacy, and llms.txt. Used by scripts/build-site.mjs.
// No app block (MobileApplication/VideoGame), no ratings, no prices: Sky isn't in a store yet, and nothing here may say
// it is. That block waits for release day.
export const SITE = 'https://skycollector.app';

// ── PRELAUNCH (2026-11-27, Boss/Content): until Sky is in a store, the website's help page says so; the app's own help
// (help.html, which the app build carries) never does, as store review and players must not read "isn't out yet".
// On launch day: set PRELAUNCH to false (and add the app block, home text and llms.txt changes Content writes then).
export const PRELAUNCH = true;
const PRE_LINE = '<p class="soon" id="prerelease">Sky Collector isn’t out yet. This page describes the app as it will be when it arrives.</p>';
const PRE_RELEASE = `<details id="release" data-find="release, launch, download, available, app store, google play, android, when"><summary><h3>When does Sky Collector come out?</h3></summary><div class="ans">
      <p>Soon. There’s no date yet, and it isn’t in any store today. skycollector.app will say when it is.</p>
    </div></details>`;
/** The website's help page: help.html plus the two pre-launch blocks (Content's v3 words), while PRELAUNCH. */
export function siteHelp(html, pre = PRELAUNCH) {
  if (!pre) return html;
  const a = html.replace(/(<p class="lede">[\s\S]*?<\/p>)/, `$1\n  <!-- PRELAUNCH (scripts/site-meta.mjs) -->${PRE_LINE}`);
  const b = a.replace(/(\n\s*)(<details id="free")/, `$1<!-- PRELAUNCH (scripts/site-meta.mjs) -->${PRE_RELEASE}$1$2`);
  if (a === html || b === a) throw new Error('siteHelp: help.html has no lede paragraph or #free answer to put the pre-launch blocks by');
  return b;
}

const ld = (o) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2).replaceAll('</', '<\\/')}\n</script>`;

export const homeJsonLd = () => ld({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Sky Collector', url: `${SITE}/`, logo: `${SITE}/icon-512.png`, email: 'hello@skycollector.app' },
    { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'Sky Collector', description: 'A collecting game for the planes that fly over you.', inLanguage: 'en', publisher: { '@id': `${SITE}/#org` } },
  ],
});

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', middot: '·', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m));
const plain = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** An answer's HTML as FAQ answer text: the words as shown, links kept as <a href> (made absolute), list items as
 *  numbered or dashed lines, every other tag dropped. */
export function answerText(html) {
  let s = html
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>/gi, (_, h) => `\u0001${h.startsWith('/') ? SITE + h : h.startsWith('#') ? `${SITE}/help${h}` /* a link to another answer (help is the only page with them) */ : h}\u0002`)
    .replace(/<\/a>/gi, '\u0003')
    .replace(/<(ol|ul)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, t, items) => { let n = 1; const ol = t.toLowerCase() === 'ol'; return `\n${items.replace(/<li\b[^>]*>/gi, () => `\n${ol ? `${n++}.` : '-'} `)}\n`; }) // each list numbered on its own
    .replace(/<\/(p|li|div)>|<br\s*\/?>/gi, '\n');
  s = decode(s.replace(/<[^>]+>/g, ''));
  s = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return s.replace(/\u0001([^\u0002]*)\u0002/g, (_, h) => `<a href="${h.replaceAll('"', '&quot;')}">`).replaceAll('\u0003', '</a>');
}

/** The help page's questions and answers, read from its HTML. A question is an <h3> (or a <details>' <summary>); its
 *  answer is everything after it up to the next heading, <details> or the end of <main>. <h2>s are section titles and
 *  are skipped. An id on the heading (or its <details>) becomes the question's anchor. Tolerant of new sections and
 *  anchors, which the help rewrite will bring. */
export function helpFaq(html) {
  const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [, html])[1];
  const out = [];
  // <details id?><summary>Q</summary>A</details>
  const det = /<details\b([^>]*)>\s*<summary\b[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let rest = main.replace(det, (_, attrs, q, a) => { out.push({ at: out.length, id: (attrs.match(/\bid="([^"]+)"/) || [])[1], q: plain(q), a: answerText(a) }); return `\u0004${out.length - 1}\u0004`; });
  // <h3 id?>Q</h3> A … (up to the next h1-h3, a placeholder or the end)
  const parts = rest.split(/(<h[1-3]\b[^>]*>[\s\S]*?<\/h[1-3]>|\u0004\d+\u0004)/i);
  const list = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i], ph = p.match(/^\u0004(\d+)\u0004$/);
    if (ph) { list.push(out[+ph[1]]); continue; }
    const h = p.match(/^<h3\b([^>]*)>([\s\S]*?)<\/h3>$/i);
    if (!h) continue;
    const a = answerText(parts[i + 1] ?? '');
    list.push({ id: (h[1].match(/\bid="([^"]+)"/) || [])[1], q: plain(h[2]), a });
  }
  return list.filter((x) => x.q && x.a);
}

export const helpJsonLd = (html, dateModified) => ld({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE}/help#faq`,
  url: `${SITE}/help`,
  name: 'Sky Collector Help',
  inLanguage: 'en',
  dateModified,
  isPartOf: { '@id': `${SITE}/#site` },
  publisher: { '@id': `${SITE}/#org` },
  mainEntity: helpFaq(html).map(({ id, q, a }) => ({ '@type': 'Question', ...(id ? { url: `${SITE}/help#${id}` } : {}), name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
/** Canonical and social tags for a page that has a <title> and a meta description (help, privacy). */
export function pageTags(html, path) {
  const title = plain((html.match(/<title>([\s\S]*?)<\/title>/i) || [, 'Sky Collector'])[1]);
  const desc = decode((html.match(/<meta name="description" content="([^"]*)"/i) || [, ''])[1]);
  const url = `${SITE}${path}`;
  return `<link rel="canonical" href="${url}">\n<meta property="og:type" content="website"><meta property="og:site_name" content="Sky Collector"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/icon-512.png"><meta name="twitter:card" content="summary">`;
}

/** Puts tags (and JSON-LD) at the end of <head>. */
export const intoHead = (html, extra) => html.replace(/<\/head>/i, `${extra}\n</head>`);

// llms.txt, Content's text word for word (true before release: "coming soon").
export const LLMS_TXT = `# Sky Collector

> Sky Collector is a collecting game for the planes that fly over you, coming soon to iPhone and Android. You point your phone at a plane, line it up in the circle, and collect it as a card.

Key facts:
- It is a collecting game, not a flight tracker. It can't follow a particular plane or person.
- Private, business, military, police and government aircraft show only the kind of aircraft.
- Free to play, with no ads. No account is needed.
- Plane positions come from volunteers with receivers. Coverage is best in North America and Europe.
- Contact: hello@skycollector.app

## Pages

- [Home](${SITE}/)
- [Help](${SITE}/help): how to play, fixing common problems, cards, alerts and your collection
- [Privacy](${SITE}/privacy): what the app does with your location and your collection
- [A sample pack](${SITE}/pack): real cards to open in a browser
`;

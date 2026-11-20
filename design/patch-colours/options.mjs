// Palette directions for Sky's patches. Every colour a patch uses, per option, day and night.
// Keys: ground (group -> twill colour), idGround (patch id -> colour, wins), thread (lettering + icon ink), label (bottom
// group line), accent (the OR accent in icons), rim (merrow duotone [shadow, highlight] or per group), map (other art colours).
export const TIER = { common: '#8a96a3', uncommon: '#3f9b57', rare: '#2f6fd0', epic: '#8b4fd6', legendary: '#d9a21b' };
const RAR = (m) => ({ legend: m.legendary, legends5: m.legendary, legends25: m.legendary, 'sky-shinyall': m.legendary, shiny: m.legendary, shiny5: m.legendary, epic: m.epic, spectrum: m.rare });

export const OPTIONS = {
  A: { title: 'A · As now', pitch: "Space Collector's night-sky twill, for reference.", asIs: true },

  B: {
    title: 'B · Uniform twill',
    pitch: 'Pale sky, cream and white twill with navy lettering and a navy merrowed edge, red details: the patch on a pilot\'s jacket. Groups are pastel tints.',
    ground: { collect: '#cfe3f6', fleet: '#c6e9e1', time: '#f6d6cf', nation: '#fbe2c2', week: '#d6eccb', history: '#eadbc0', sky: '#dce2fb', member: '#f4f7fb', album: '#fbefc6', secret: '#e4e7ec', rarity: '#e7ddf8' },
    idGround: RAR({ legendary: '#fbe8ae', epic: '#e7dafa', rare: '#d5e2fb' }),
    thread: '#0d2238', label: '#b42a20', accent: '#d7362b', rim: ['#081426', '#2e4a70'],
    shade: .14, drop: 'rgba(13,34,56,.28)', emboss: .28,
    map: { '#14284a': '#ffffff', '#0c1c33': '#e9eef4', '#8fd0ff': '#2b6a99', '#f2b632': '#c5850c', '#e8493c': '#d7362b', '#ff6b5e': '#d7362b', '#c9b98a': '#8f7f50', '#a8743a': '#a8743a', '#fff6cf': '#ffffff' },
    night: { rim: ['#2a4a74', '#a9c8ec'], dim: .9, drop: 'rgba(0,0,0,.5)' },
  },

  C: {
    title: 'C · Livery',
    pitch: 'Each group in a bright airline-livery colour (sky blue, runway red, sunrise orange, teal, gold) with cream thread: cheerful, loud, the most "collectible".',
    ground: { collect: '#296bae', fleet: '#127568', time: '#bc382c', nation: '#a35216', week: '#417529', history: '#7a4526', sky: '#a8306a', member: '#24508c', album: '#876110', secret: '#5b6573', rarity: '#6b5bb0' },
    idGround: RAR({ legendary: '#876110', epic: '#7a46c4', rare: '#2f62c0' }),
    thread: '#fff8e6', label: '#ffe7a3', accent: '#ffd25e', rim: ['#a9987a', '#fff9e8'],
    shade: .3, drop: 'rgba(13,34,56,.35)', emboss: .35,
    map: { '#e8493c': '#ffd25e', '#14284a': '#0d2238' },
    night: { drop: 'rgba(0,0,0,.55)' },
  },

  D: {
    title: 'D · Paper & piping',
    pitch: 'One cream twill for every patch, like Sky\'s card paper; each group gets its own coloured merrowed edge and icon accent, navy lettering. Calm wall, colour where it counts.',
    ground: { _all: '#faf3e1' }, groundNight: '#ece2c8',
    rimBy: { collect: '#2f7cc4', fleet: '#14857a', time: '#d7362b', nation: '#e2771c', week: '#3f8f45', history: '#9a6a32', sky: '#4d5fd6', member: '#1d3f73', album: '#c99a1e', secret: '#5d6875', rarity: '#8b4fd6' },
    idRim: RAR(TIER),
    thread: '#0d2238', label: 'rimDeep', accent: 'rim',
    shade: .12, drop: 'rgba(13,34,56,.26)', emboss: .25,
    map: { '#14284a': '#ffffff', '#0c1c33': '#eef1f5', '#8fd0ff': '#2b6a99', '#f2b632': '#c5850c', '#e8493c': '#d7362b', '#ff6b5e': '#d7362b', '#c9b98a': '#8f7f50', '#fff6cf': '#ffffff' },
    night: { drop: 'rgba(0,0,0,.5)' },
  },
};

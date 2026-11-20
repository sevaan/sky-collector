// What a plane card prints about its TYPE (2026-11-19, card spike "boarding pass × spec sheet", design/card-spike/
// combo-pass-spec.html): the maker, its country, what kind of aircraft it is and up to four spec cells. VERIFIED ONLY:
// every number was read on the English Wikipedia article named in the comment (raw wikitext, 2026-11-19); a value the
// page gives only for another variant, gives two ways, or doesn't give at all is left out, so some types have fewer than
// four cells. Imperial figures are the page's own converted to metric (1 nmi = 1.852 km, 1 ft = 0.3048 m). A type with
// no entry shows only what the feed and your catches say (js/flight-card.js). No DOM here.
//
// cells: [label, value, unit]. Engines: 'jets' = turbofans, 'turbine' = turboshaft (helicopters), as the design has it.

const E = (n, kind) => [n === 1 ? 'Engine' : 'Engines', String(n), n === 1 ? kind.replace(/s$/, '') : kind];
const S = {
  /* https://en.wikipedia.org/wiki/Airbus_A320_family: first flights 25 Aug 1995 / 22 Feb 1987 / 11 Mar 1993; "2-class,
     typical" 124 / 150 / 185; Engines (×2) CFM56-5B or V2500; Range 3,750 / 3,350 / 3,200 nmi. Country: "Multi-national" (left out) */
  A319: { maker: 'Airbus', desc: 'narrow-body jet airliner', cells: [['First flew', '1995'], ['Seats', '124'], E(2, 'jets'), ['Range', '6,945', 'km']] },
  A320: { maker: 'Airbus', desc: 'narrow-body jet airliner', cells: [['First flew', '1987'], ['Seats', '150'], E(2, 'jets'), ['Range', '6,204', 'km']] },
  A321: { maker: 'Airbus', desc: 'narrow-body jet airliner', cells: [['First flew', '1993'], ['Seats', '185'], E(2, 'jets'), ['Range', '5,926', 'km']] },
  /* https://en.wikipedia.org/wiki/Airbus_A320neo_family: first flights 31 Mar 2017 / 25 Sep 2014 / 9 Feb 2016; "2-class
     seats" 140 / 165 / 206; Engines (×2) LEAP-1A or PW1100G; "Typical range" 6,950 / 6,500 / 7,400 km */
  A19N: { maker: 'Airbus', desc: 'narrow-body jet airliner', cells: [['First flew', '2017'], ['Seats', '140'], E(2, 'jets'), ['Range', '6,950', 'km']] },
  A20N: { maker: 'Airbus', desc: 'narrow-body jet airliner', cells: [['First flew', '2014'], ['Seats', '165'], E(2, 'jets'), ['Range', '6,500', 'km']] },
  A21N: { maker: 'Airbus', desc: 'narrow-body jet airliner', cells: [['First flew', '2016'], ['Seats', '206'], E(2, 'jets'), ['Range', '7,400', 'km']] },
  /* https://en.wikipedia.org/wiki/Boeing_737_Next_Generation (737-800): first flew July 31, 1997; "160 passengers in two
     classes"; 2 × CFM56-7B26 turbofan; range 2,927 nmi */
  B738: { maker: 'Boeing', country: 'USA', desc: 'narrow-body jet airliner', cells: [['First flew', '1997'], ['Seats', '160'], E(2, 'jets'), ['Range', '5,421', 'km']] },
  /* https://en.wikipedia.org/wiki/Boeing_737_MAX: MAX 8 first flight January 29, 2016, 2 × LEAP-1B28, range 3,500 nmi,
     length 39.52 m; MAX 9 first flight April 13, 2017, wingspan 35.92 m, length 42.1 m. Seats left out (210 / 220 are
     maximums); MAX 9 range left out (the page's units disagree) */
  B38M: { maker: 'Boeing', country: 'USA', desc: 'narrow-body jet airliner', cells: [['First flew', '2016'], E(2, 'jets'), ['Range', '6,482', 'km'], ['Length', '39.5', 'm']] },
  B39M: { maker: 'Boeing', country: 'USA', desc: 'narrow-body jet airliner', cells: [['First flew', '2017'], E(2, 'jets'), ['Span', '35.9', 'm'], ['Length', '42.1', 'm']] },
  /* https://en.wikipedia.org/wiki/Boeing_777 (777-300ER): first flight February 24, 2003; "396 (two classes)"; 2 × GE90-115BL;
     range 14,685 km */
  B77W: { maker: 'Boeing', country: 'USA', desc: 'wide-body jet airliner', cells: [['First flew', '2003'], ['Seats', '396'], E(2, 'jets'), ['Range', '14,685', 'km']] },
  /* https://en.wikipedia.org/wiki/Boeing_787_Dreamliner: 787-8 maiden flight December 15, 2009, length 186 ft 1 in; 787-9
     maiden flight September 17, 2013, wingspan 60.12 m, length 62.81 m. Seats and range left out (the page gives two sets) */
  B788: { maker: 'Boeing', country: 'USA', desc: 'wide-body jet airliner', cells: [['First flew', '2009'], E(2, 'jets'), ['Length', '56.7', 'm']] },
  B789: { maker: 'Boeing', country: 'USA', desc: 'wide-body jet airliner', cells: [['First flew', '2013'], E(2, 'jets'), ['Span', '60.1', 'm'], ['Length', '62.8', 'm']] },
  /* https://en.wikipedia.org/wiki/Airbus_A330: A330-300 first flight 2 November 1992; Capacity 300; Engines (×2); range 11,750 km */
  A333: { maker: 'Airbus', desc: 'wide-body jet airliner', cells: [['First flew', '1992'], ['Seats', '300'], E(2, 'jets'), ['Range', '11,750', 'km']] },
  /* https://en.wikipedia.org/wiki/Airbus_A350 (A350-941): maiden flight 14 June 2013; 2 × Trent XWB-84; range 15,750 km;
     wingspan 64.75 m. Seats left out (325 in the text, 315 in the specifications) */
  A359: { maker: 'Airbus', desc: 'wide-body jet airliner', cells: [['First flew', '2013'], E(2, 'jets'), ['Range', '15,750', 'km'], ['Span', '64.8', 'm']] },
  /* https://en.wikipedia.org/wiki/Embraer_E-Jet_family: E175 first flight June 2003, typical 76, maximum 88, 2 × CF34-8E,
     2,200 nmi (4,074 km); E190 first flight 12 March 2004, typical 96, maximum 114, 2 × CF34-10E, 2,450 nmi (4,537 km).
     Wingspan left out for the E175 (26.01 m standard, 28.65 m long-range) */
  E75L: { maker: 'Embraer', country: 'Brazil', desc: 'twin-jet regional airliner', cells: [['First flew', '2003'], ['Seats', '76–88'], E(2, 'jets'), ['Range', '4,074', 'km']] },
  E190: { maker: 'Embraer', country: 'Brazil', desc: 'twin-jet regional airliner', cells: [['First flew', '2004'], ['Seats', '96–114'], E(2, 'jets'), ['Range', '4,537', 'km']] },
  /* https://en.wikipedia.org/wiki/Bombardier_CRJ700_series (CRJ900): maiden flight February 21, 2001; 90 passengers;
     2 × CF34-8C5; range 2,871 km */
  CRJ9: { maker: 'Bombardier', country: 'Canada', desc: 'regional jet', cells: [['First flew', '2001'], ['Seats', '90'], E(2, 'jets'), ['Range', '2,871', 'km']] },
  /* https://en.wikipedia.org/wiki/De_Havilland_Canada_Dash_8 (Q400): "passenger capacity of 68–90"; Engines (2×) PW150
     turboprop; range 1,100 nmi (2,040 km); wingspan 28.4 m. First flight left out (not on the page for the -400) */
  DH8D: { maker: 'De Havilland Canada', country: 'Canada', desc: 'turboprop regional airliner', cells: [['Seats', '68–90'], E(2, 'props'), ['Range', '2,040', 'km'], ['Span', '28.4', 'm']] },
  /* https://en.wikipedia.org/wiki/ATR_72: first flight 27 October 1988; "typical standard seating capacity of 72 passengers";
     2 turboprops (PW124B / PW127); wingspan 27.05 m (every variant). Range left out (differs by variant) */
  AT72: { maker: 'ATR', country: 'France / Italy', desc: 'turboprop regional airliner', cells: [['First flew', '1988'], ['Seats', '72'], E(2, 'props'), ['Span', '27.1', 'm']] },
  /* https://en.wikipedia.org/wiki/Boeing_767: -300 first flight January 30, 1986; wingspan 47.57 m; length 54.94 m;
     twin turbofans. Seats and range left out: B763 covers the passenger -300/-300ER and the -300F freighter */
  B763: { maker: 'Boeing', country: 'USA', desc: 'twin-aisle airliner and freighter', cells: [['First flew', '1986'], ['Span', '47.6', 'm'], ['Length', '54.9', 'm'], E(2, 'jets')] },
  /* https://en.wikipedia.org/wiki/Boeing_747-8: first flights 747-8F February 8, 2010 / 747-8I March 20, 2011; 4 × GEnx-2B67;
     wingspan 224 ft 5 in, length 250 ft 2 in. Seats and range left out: B748 is both the airliner and the freighter */
  B748: { maker: 'Boeing', country: 'USA', desc: 'four-engine wide-body airliner and freighter', cells: [['First flew', '2010'], E(4, 'jets'), ['Span', '68.4', 'm'], ['Length', '76.3', 'm']] },
  /* https://en.wikipedia.org/wiki/Airbus_A380: first flight 27 April 2005; typical seating 525; Engines (4×); range 14,800 km */
  A388: { maker: 'Airbus', desc: 'double-deck wide-body airliner', cells: [['First flew', '2005'], ['Seats', '525'], E(4, 'jets'), ['Range', '14,800', 'km']] },
  /* https://en.wikipedia.org/wiki/Cessna_172: first flight June 12, 1955; four-seat; 1 × Lycoming piston; 36 ft 1 in. Range
     left out (1,289 km is the 172R at 55% power) */
  C172: { maker: 'Cessna', country: 'USA', desc: 'four-seat light aircraft', cells: [['First flew', '1955'], ['Seats', '4'], E(1, 'piston'), ['Span', '11.0', 'm']] },
  /* https://en.wikipedia.org/wiki/Piper_PA-28_Cherokee: first flight January 14, 1960; "two-seat or four-seat light aircraft
     … single piston-engined". Country, span and range left out (not stated / one model only) */
  P28A: { maker: 'Piper', desc: 'light aircraft', cells: [['First flew', '1960'], ['Seats', '2–4'], E(1, 'piston')] },
  /* https://en.wikipedia.org/wiki/Beechcraft_Super_King_Air (Model B300, "King Air 350"): capacity 11; 2 × PT6A-60A; wingspan
     17.65 m; length 14.22 m. First flight and country left out (not on the page) */
  B350: { maker: 'Beechcraft', desc: 'twin-turboprop aircraft', cells: [['Seats', '11'], E(2, 'props'), ['Span', '17.7', 'm'], ['Length', '14.2', 'm']] },
  /* https://en.wikipedia.org/wiki/Pilatus_PC-12: first flight 31 May 1991; "6 to 9 passengers seats"; 1 × PT6A-67P turboprop */
  PC12: { maker: 'Pilatus', country: 'Switzerland', desc: 'single-engine turboprop', cells: [['First flew', '1991'], ['Passengers', '6–9'], E(1, 'prop')] },
  /* https://en.wikipedia.org/wiki/Cessna_CitationJet/M2: Model 525 first flight April 29, 1991; CJ3 (ICAO C25B) first flew
     April 17, 2003; two Williams FJ44 engines. Seats and range left out (the table has only the M2 and CJ3+ columns) */
  C525: { maker: 'Cessna', country: 'USA', desc: 'light business jet', cells: [['First flew', '1991'], E(2, 'jets')] },
  C25B: { maker: 'Cessna', country: 'USA', desc: 'light business jet', cells: [['First flew', '2003'], E(2, 'jets')] },
  /* https://en.wikipedia.org/wiki/Gulfstream_G650/G700/G800: G650 first flight November 25, 2009; Capacity 19; Turbofans (x2)
     BR725; range 7,000 nmi (13,000 km as the page shows it). Wingspan left out */
  GLF6: { maker: 'Gulfstream', country: 'USA', desc: 'long-range business jet', cells: [['First flew', '2009'], ['Passengers', '≤ 19'], E(2, 'jets'), ['Range', '13,000', 'km']] },
  /* https://en.wikipedia.org/wiki/Eurocopter_AS350_Écureuil (H125 = AS350 B3e): first flight 27 June 1974; 5 pax; 1 × Arriel
     2B turboshaft; main rotor 10.7 m. Range left out (662 km is the B3 only) */
  AS50: { maker: 'Airbus Helicopters', country: 'France', desc: 'light helicopter', cells: [['First flew', '1974'], ['Passengers', '5'], E(1, 'turbine'), ['Rotor', '10.7', 'm']] },
  /* https://en.wikipedia.org/wiki/Bell_407: first flight 29 June 1995; five passengers in the main cabin; 1 × Allison 250-C47B
     turboshaft; main rotor 35 ft. Country "United States/Canada" */
  B407: { maker: 'Bell', country: 'USA / Canada', desc: 'light utility helicopter', cells: [['First flew', '1995'], ['Passengers', '5'], E(1, 'turbine'), ['Rotor', '10.7', 'm']] },
  /* https://en.wikipedia.org/wiki/Eurocopter_EC135: first flight 15 February 1994; up to seven passengers; 2 × Arrius 2B2 or
     PW206B turboshaft; main rotor 10.2 m. Country "Multinational" (left out) */
  EC35: { maker: 'Airbus Helicopters', desc: 'twin-engine light helicopter', cells: [['First flew', '1994'], ['Passengers', '≤ 7'], E(2, 'turbines'), ['Rotor', '10.2', 'm']] },
};
/* Codes that are the same aircraft as one above (ICAO designators): the E175 with either wing, every ATR 72 variant */
const SAME = { E75S: 'E75L', AT75: 'AT72', AT76: 'AT72' };

export const TYPE_SPECS = S;
// The printed specs of an ICAO type code, or null when we have none verified.
export function typeSpecs(code) {
  const c = String(code ?? '').trim().toUpperCase();
  return S[c] ?? S[SAME[c]] ?? null;
}
// "Embraer · Brazil · twin-jet regional airliner" (parts we don't know are left out).
export const makerLine = (s) => (s ? [s.maker, s.country, s.desc].filter(Boolean).join(' · ') : '');

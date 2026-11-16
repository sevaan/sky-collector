#!/usr/bin/env python3
"""Find airline logos on Wikimedia Commons via Wikidata (2026-11-15). For each wanted ICAO airline code: SPARQL on P230,
require exactly ONE current item (no P576 dissolved date, or one in the future), take its P154 logo (preferred rank, else
newest non-ended), read the Commons licence (extmetadata LicenseShortName) and KEEP ONLY public domain / PD-textlogo / CC0.
Wanted = scripts/photos/airlines.json + codes seen >=3 times in data/research/samples-*.jsonl.gz + BIG below, all
restricted to codes in js/airlines.js. Writes scripts/logos/candidates.json (kept + skipped, with the reason for each skip).
Usage: python3 -I scripts/logos/find-airline-logos.py"""
import glob, gzip, json, os, re, sys, time, urllib.parse, urllib.request, collections, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..')
UA = 'SkyCollectorResearch/0.1 (https://github.com/sevaan/sky-collector)'
BIG = '''AAL UAL DAL SWA JBU ASA NKS FFT AAY HAL SKW RPA ENY EDV ACA WJA ROU TSC POE FLE AMX VOI VIV AVA CMP LAN LPE TAM GLO AZU ARG SKU
BAW VIR EZY EZS RYR RUK RYS RYR WZZ WMT AFR KLM TRA DLH EWG CFG SAS NAX FIN IBE VLG IBS AEA TAP TAR AZA ITY SWR EDW AUA BEL LOT CSA
THY PGT AEE OAL TVF NOZ BCS SXS ICE EIN LOG EXS JAF ELY MSR RAM SAA ETH KQA UAE ETD QTR QTR SVA GFA OMA KAC RJA MEA IAW IRA PIA AIC
IGO SEJ AXB VTI SIA SLK TGW MAS AXM THA VJC HVN GIA LNI CEB PAL APG QFA JST VOZ ANZ ANA JAL APJ SKY KAL AAR JJA TWB JNA ANG ACA
CCA CES CSN CHH CSZ CXA CQH CDG CBJ CHB CPA CRK HDA CAL EVA CIM AIQ PAK FJI ANK AWE LXJ RLK MAU AFL SDM UTA SBI AUI ASL CAI TRS
ABY LLM FAL TAI TOM EXY DLA ADH WIF SAS NSZ EWE LGL GWI OHY VKG DAT BMS GCR CJT FDX UPS GTI ABX ATN PAC CLX BOX MPH KAL SQC DHK
DHL TAY SWG MSX CKK CAO UAE ETH QAF NCA NPT NCR ICL ASL JAL JTA AMC AZW TLM LTU HAL DNM CMP SLM PVG CUA SKW
SKU ADO IJT BGA BRU PRY AEL SRR AZU SKX JAV MAH KMF TVJ JBT VIV KLM MSC RBA SEY LIA PWM CPZ ENY WEN SCX VXP BSK'''.split()
def sparql(q):
    url = 'https://query.wikidata.org/sparql?format=json&query=' + urllib.parse.quote(q)
    for t in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=90))['results']['bindings']
        except Exception as e: print('sparql retry', e); time.sleep(5)
    return []
def api(params):
    url = 'https://commons.wikimedia.org/w/api.php?format=json&' + urllib.parse.urlencode(params)
    for t in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60))
        except Exception as e: print('api retry', e); time.sleep(5)
    return {}
def wanted():
    names = set(re.findall(r'\b([A-Z0-9]{3}):"', open(os.path.join(ROOT, 'js', 'airlines.js')).read()))
    w = [k for k in json.load(open(os.path.join(ROOT, 'scripts', 'photos', 'airlines.json'))) if not k.startswith('_')]
    cnt = collections.Counter()
    for f in glob.glob(os.path.join(ROOT, 'data', 'research', 'samples-*.jsonl.gz')):
        for l in gzip.open(f, 'rt'):
            try: d = json.loads(l)
            except Exception: continue
            for r in d.get('ac', []):
                m = re.match(r'^([A-Z]{3})\d', (r[1] or '').strip() if len(r) > 1 else '')
                if m: cnt[m.group(1)] += 1
    w += [k for k, n in cnt.items() if n >= 3] + BIG
    out = []
    for k in w:
        if k in names and k not in out: out.append(k)
    return out
OK_LIC = re.compile(r'^(public domain|pd\b|pd-|cc0|cc-zero)', re.I)
def main():
    codes = wanted(); print(len(codes), 'wanted codes'); today = datetime.date.today().isoformat()
    items = collections.defaultdict(dict)  # code -> qid -> info
    for i in range(0, len(codes), 20):
        vals = ' '.join('"%s"' % c for c in codes[i:i + 20])
        q = '''SELECT ?code ?item ?itemLabel ?end ?logo ?rank ?lend ?lstart ?links WHERE { VALUES ?code { %s } ?item wdt:P230 ?code.
 OPTIONAL { ?item wdt:P576 ?end } OPTIONAL { ?item wikibase:sitelinks ?links }
 OPTIONAL { ?item p:P154 ?st. ?st ps:P154 ?logo; wikibase:rank ?rank. OPTIONAL { ?st pq:P582 ?lend } OPTIONAL { ?st pq:P580 ?lstart } }
 SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }''' % vals
        for b in sparql(q):
            c = b['code']['value']; qid = b['item']['value'].rsplit('/', 1)[1]
            it = items[c].setdefault(qid, {'qid': qid, 'label': b['itemLabel']['value'], 'end': b.get('end', {}).get('value', '')[:10], 'links': int(b.get('links', {}).get('value', 0)), 'logos': []})
            if 'logo' in b: it['logos'].append({'file': urllib.parse.unquote(b['logo']['value'].rsplit('/', 1)[1]), 'rank': b['rank']['value'].rsplit('#', 1)[1], 'lend': b.get('lend', {}).get('value', '')[:10], 'lstart': b.get('lstart', {}).get('value', '')[:10]})
        time.sleep(0.5)
    res = {}
    for c in codes:
        cur = [it for it in items.get(c, {}).values() if not it['end'] or it['end'] > today]
        if not cur: res[c] = {'status': 'no-item'}; continue
        tie = None
        if len(cur) > 1:
            cur.sort(key=lambda x: -x['links'])
            # Several current items share the code (cargo arm, sub-brand, regional): only the clear leader by Wikipedia
            # articles (>= 2x the runner-up) is taken, and it is flagged so the contact-sheet check looks hard at it.
            if cur[0]['links'] < 2 * max(1, cur[1]['links']): res[c] = {'status': 'ambiguous', 'items': [(x['qid'], x['label'], x['links']) for x in cur]}; continue
            tie = [(x['qid'], x['label'], x['links']) for x in cur]
        it = cur[0]; ls = [l for l in it['logos'] if l['rank'] != 'DeprecatedRank' and (not l['lend'] or l['lend'] > today)]
        if not ls: res[c] = {'status': 'no-logo', 'qid': it['qid'], 'label': it['label']}; continue
        ls.sort(key=lambda l: (l['rank'] == 'PreferredRank', l['lstart']), reverse=True)
        res[c] = {'status': 'logo', 'qid': it['qid'], 'label': it['label'], 'file': ls[0]['file'], 'n_logos': len(ls)}
        if tie: res[c]['tiebreak'] = tie
    files = sorted({r['file'] for r in res.values() if r['status'] == 'logo'})
    lic = {}
    for i in range(0, len(files), 40):
        d = api({'action': 'query', 'prop': 'imageinfo', 'iiprop': 'extmetadata|url|size', 'iiextmetadatafilter': 'LicenseShortName|License|Restrictions', 'titles': '|'.join('File:' + f for f in files[i:i + 40]), 'redirects': 1})
        redir = {r['to']: r['from'] for r in d.get('query', {}).get('redirects', [])}
        norm = {n['to']: n['from'] for n in d.get('query', {}).get('normalized', [])}
        for p in d.get('query', {}).get('pages', {}).values():
            t = p['title']; orig = redir.get(t, t); orig = norm.get(orig, orig)
            ii = (p.get('imageinfo') or [{}])[0]; em = ii.get('extmetadata', {})
            lic[orig[5:].replace('_', ' ')] = {'title': t[5:], 'licence': em.get('LicenseShortName', {}).get('value', ''), 'url': ii.get('descriptionurl', ''), 'w': ii.get('width'), 'h': ii.get('height')}
        time.sleep(0.5)
    for c, r in res.items():
        if r['status'] != 'logo': continue
        l = lic.get(r['file'].replace('_', ' ')) or {}
        r.update(licence=l.get('licence', ''), source=l.get('url') or 'https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(r['file'].replace(' ', '_')), title=l.get('title', r['file']), srcw=l.get('w'), srch=l.get('h'))
        if not OK_LIC.match(r['licence'] or ''): r['status'] = 'licence'
    json.dump(res, open(os.path.join(HERE, 'candidates.json'), 'w'), indent=1, ensure_ascii=False)
    print(collections.Counter(r['status'] for r in res.values()))
    print(collections.Counter(r.get('licence') for r in res.values() if r['status'] in ('logo', 'licence')))
main()

#!/usr/bin/env python3
"""Writes scripts/photos/gap-jobs.json for find-gap-photos.py (2026-11-17): house-photo gaps (types in sky-tiers.js with no
house photo) and airline-photo gaps/replacements. Usage: python3 -I scripts/photos/make-gap-jobs.py [house|airline]"""
import json, os, re, sys, ast
HERE = os.path.dirname(os.path.abspath(__file__))
# code: (search name, title/category regex, extra queries)
H = {
 'B738': ('Boeing 737-800', r'737-8(?![\s-]?MAX)|737-800|737NG|Boeing 737', ['Boeing 737-800 N1786B', 'Boeing 737-800 BBJ Boeing Business Jet', 'Boeing 737-800 Renton Boeing colours']),
 'A321': ('Airbus A321', r'A321(?![\s-]?neo)', ['Airbus A321 F-WW house colors', 'Airbus A321 D-AV Hamburg', 'Airbus A321 Toulouse test']),
 'A333': ('Airbus A330-300', r'A330-3|A330-300', ['Airbus A330-300 F-WW house colors', 'Airbus A330-300 Toulouse first flight', 'Airbus A330 Airbus Industries']),
 'B739': ('Boeing 737-900', r'737-9(?![\s-]?MAX)|737-900', ['Boeing 737-900ER Boeing Field', 'Boeing 737-900 first flight Renton']),
 'CRJ9': ('Bombardier CRJ900', r'CRJ-?900|CL-600-2D24', ['Bombardier CRJ900 NextGen demonstrator', 'CRJ900 C-FM Bombardier Mirabel', 'CRJ900 Bombardier colours']),
 'DH8D': ('Bombardier Dash 8 Q400', r'Q400|Dash 8|DHC-8-4', ['Bombardier Q400 demonstrator Bombardier colours', 'Q400 Downsview Bombardier', 'Dash 8 Q400 C-FS Bombardier']),
 'E190': ('Embraer 190', r'E-?190(?![\s-]?E2)|ERJ-?190|Embraer 190', ['Embraer 190 PR-ZJF Embraer house colors', 'Embraer 190 prototype', 'Embraer 190 Farnborough']),
 'E170': ('Embraer 170', r'E-?170|ERJ-?170|Embraer 170', ['Embraer 170 PP-XJE prototype', 'Embraer 170 house colors Embraer', 'Embraer 170 PR-ZJA']),
 'E145': ('Embraer ERJ-145', r'ERJ[\s-]?145|EMB[\s-]?145|E145|Embraer 145', ['Embraer ERJ 145 prototype', 'Embraer 145 PT-ZJA Embraer colours', 'EMB 145 Embraer house']),
 'CL35': ('Bombardier Challenger 350', r'Challenger 3[05]0|CL-?350|CL-?300|Challenger 300', ['Challenger 350 Bombardier demonstrator', 'Challenger 300 Bombardier demonstrator', 'Challenger 350 C-G Bombardier house colors']),
 'CL30': ('Bombardier Challenger 300', r'Challenger 3[05]0|CL-?350|CL-?300|Challenger 300', ['Challenger 300 Bombardier demonstrator', 'Challenger 300 first flight', 'Challenger 300 C-FBLT']),
 'CRJ7': ('Bombardier CRJ700', r'CRJ-?700|CL-600-2C10|CRJ-?[79]00', ['Bombardier CRJ700 C-FJLO Bombardier colours', 'CRJ700 Bombardier demonstrator', 'CRJ 700 Mirabel test flight']),
 'C56X': ('Cessna Citation Excel', r'Citation (Excel|XLS)|560XL|Citation 560|XLS\+', ['Cessna Citation XLS demonstrator', 'Citation Excel Textron Aviation Wichita', 'Citation XLS+ Cessna']),
 'C152': ('Cessna 152', r'\b152\b', ['Cessna 152 N White', 'Cessna 152 flying', 'Cessna 152 in flight']),
 'GLF4': ('Gulfstream IV', r'Gulfstream (G-?IV|G-?400|G-?450|IV)|G-?IV|G450|G400|GIV', ['Gulfstream G450 Savannah', 'Gulfstream IV N Savannah Gulfstream colors', 'Gulfstream G-IV flight']),
 'GLF5': ('Gulfstream V', r'Gulfstream (G-?V|G-?500|G-?550|V)\b|G550|G-V|GV\b', ['Gulfstream G550 Savannah', 'Gulfstream G550 N Gulfstream colors', 'Gulfstream V flight']),
 'F2TH': ('Dassault Falcon 2000', r'Falcon 2000', ['Dassault Falcon 2000 demonstrator F-W', 'Falcon 2000 Dassault Mérignac', 'Falcon 2000LX Dassault']),
 'GL7T': ('Bombardier Global 7500', r'Global (7500|7000|8000)', ['Global 7500 C-FZ Bombardier', 'Bombardier Global 7000 flight test', 'Global 7500 Bombardier demonstrator']),
 'C25B': ('Cessna Citation CJ3', r'CJ3', ['Cessna Citation CJ3 demonstrator', 'Citation CJ3 Textron Aviation', 'Citation CJ3+ flight']),
 'C25A': ('Cessna Citation CJ2', r'CJ2', ['Cessna Citation CJ2 demonstrator', 'Citation CJ2+ Cessna', 'Citation CJ2 flight']),
 'H25B': ('Hawker 800', r'Hawker (800|850|750|900|700|4000)|BAe[\s-]?125|HS[\s-]?125|Hawker Beechcraft', ['Hawker 800XP Hawker Beechcraft', 'BAe 125-800 flight', 'Hawker 900XP flying']),
 'B350': ('Beechcraft King Air 350', r'King Air 350|Super King Air 350|B300|350i|King Air', ['Beechcraft King Air 350i Hawker Beechcraft', 'King Air 350 Textron Aviation', 'Beechcraft Super King Air 350 flight']),
 'B190': ('Beechcraft 1900', r'1900|B1900', ['Beechcraft 1900D flight', 'Beech 1900 Raytheon colors', 'Beechcraft 1900D N']),
 'C750': ('Cessna Citation X', r'Citation X\b|Citation 750|C750', ['Cessna Citation X demonstrator', 'Citation X Cessna Wichita', 'Citation X flight']),
 'B741': ('Boeing 747-100', r'747-1|747-100|747SR|City of Everett|747-123|SCA', ['Boeing 747-100 City of Everett N7470', 'Boeing 747-100 Boeing house colors', 'NASA Shuttle Carrier Aircraft 747-123 N905NA', 'Boeing 747-100 Everett']),
 'B742': ('Boeing 747-200', r'747-2|747-200|E-4|VC-25|Air Force One|747-206', ['Boeing 747-200 Boeing colors', 'Boeing E-4B flight', 'Boeing 747-200F test', 'Boeing 747-200 unpainted']),
 'B743': ('Boeing 747-300', r'747-3|747-300', ['Boeing 747-300 Boeing', 'Boeing 747-300 flying', 'Boeing 747-300 Everett']),
 'B744': ('Boeing 747-400', r'747-4|747-400|N401PW|VC-25', ['Boeing 747-400 N401PW', 'Boeing 747-400 Boeing house colors', 'Boeing 747-400 prototype', 'Boeing 747-400 Everett first flight']),
 'B74S': ('Boeing 747SP', r'747SP|SOFIA|747-SP', ['NASA SOFIA 747SP', 'Boeing 747SP N747SP', 'Boeing 747SP flight']),
 'B74R': ('Boeing 747SR', r'747SR|747-SR|747-100SR|747-300SR', ['Boeing 747SR', 'Boeing 747-100SR', 'Boeing 747-400D']),
 'B74D': ('Boeing 747-400D', r'747-400D|747-400BCF|747-4', ['Boeing 747-400D', 'Boeing 747-400BCF Boeing', 'Boeing 747-400 domestic']),
 'A342': ('Airbus A340-200', r'A340-2|A340-200', ['Airbus A340-200 F-WW house colors', 'Airbus A340-200 Toulouse', 'Airbus A340 Airbus Industries']),
 'A343': ('Airbus A340-300', r'A340-3|A340-300', ['Airbus A340-300 F-WWAI house colors', 'Airbus A340-300 Toulouse', 'Airbus A340-300 Airbus Industries']),
 'A345': ('Airbus A340-500', r'A340-5|A340-500', ['Airbus A340-500 F-WWTE house colors', 'Airbus A340-500 Toulouse', 'Airbus A340-500 Airbus Industries']),
 'A346': ('Airbus A340-600', r'A340-6|A340-600', ['Airbus A340-600 F-WWCA house colors', 'Airbus A340-600 Toulouse', 'Airbus A340-600 Airbus Industries']),
 'MD11': ('McDonnell Douglas MD-11', r'MD-?11', ['McDonnell Douglas MD-11 N211MD house colors', 'MD-11 McDonnell Douglas prototype', 'MD-11 Long Beach flight']),
 'DC10': ('McDonnell Douglas DC-10', r'DC-?10|KC-10', ['McDonnell Douglas DC-10 N10MD house colors', 'DC-10 McDonnell Douglas prototype', 'DC-10 Long Beach']),
 'C5M': ('Lockheed C-5M Super Galaxy', r'C-5[A-Z]?\b|Galaxy', ['C-5M Super Galaxy flight', 'C-5 Galaxy Air Force in flight', 'C-5M Super Galaxy takeoff']),
 'K35R': ('Boeing KC-135R Stratotanker', r'KC-135', ['KC-135R Stratotanker in flight', 'KC-135 Stratotanker refueling', 'KC-135R takeoff']),
 'K35E': ('Boeing KC-135E Stratotanker', r'KC-135', ['KC-135E Stratotanker', 'KC-135 Stratotanker Air National Guard', 'KC-135 landing']),
 'KC10': ('McDonnell Douglas KC-10 Extender', r'KC-10', ['KC-10 Extender in flight', 'KC-10 Extender refueling', 'KC-10 takeoff']),
 'E3TF': ('Boeing E-3 Sentry AWACS', r'E-3\b|AWACS|Sentry', ['E-3 Sentry AWACS in flight', 'E-3 Sentry takeoff', 'E-3A AWACS NATO']),
 'E3CF': ('Boeing E-3 Sentry AWACS', r'E-3\b|AWACS|Sentry', ['E-3 Sentry AWACS in flight', 'E-3F Sentry French Air Force', 'E-3 Sentry landing']),
 'E6': ('Boeing E-6 Mercury', r'E-6\b|Mercury|E-6B', ['E-6B Mercury TACAMO', 'E-6B Mercury in flight', 'E-6B Mercury takeoff']),
 'B52': ('Boeing B-52 Stratofortress', r'B-52', ['B-52 Stratofortress in flight', 'B-52H Stratofortress takeoff', 'B-52 flying']),
 'B1': ('Rockwell B-1B Lancer', r'B-1B?\b|Lancer', ['B-1B Lancer in flight', 'B-1B Lancer takeoff', 'B-1B Lancer flying']),
 'B2': ('Northrop B-2 Spirit', r'B-2\b|Spirit', ['B-2 Spirit in flight', 'B-2 Spirit stealth bomber flying', 'B-2 Spirit takeoff']),
 'P8': ('Boeing P-8 Poseidon', r'P-8|Poseidon', ['P-8A Poseidon in flight', 'P-8 Poseidon takeoff', 'P-8A Poseidon flying']),
 'C2': ('Grumman C-2 Greyhound', r'C-2\b|Greyhound', ['C-2A Greyhound in flight', 'C-2A Greyhound carrier', 'C-2 Greyhound takeoff']),
 'AN12': ('Antonov An-12', r'An-?12|Antonov 12', ['Antonov An-12 in flight', 'Antonov An-12 takeoff', 'An-12 flying']),
 'IL76': ('Ilyushin Il-76', r'Il-?76|Ilyushin 76', ['Ilyushin Il-76 in flight', 'Il-76 takeoff', 'Il-76 flying']),
 'IL96': ('Ilyushin Il-96', r'Il-?96', ['Ilyushin Il-96 in flight', 'Il-96 takeoff', 'Il-96 flying']),
 'C295': ('Airbus C295', r'C-?295|CN-?235|C295', ['Airbus C295 in flight', 'C-295 Airbus Defence flight', 'CASA C-295 takeoff']),
 'V22': ('Bell Boeing V-22 Osprey', r'V-22|Osprey', ['V-22 Osprey in flight', 'MV-22B Osprey flying', 'CV-22 Osprey flight']),
 'U2': ('Lockheed U-2', r'U-2|Dragon Lady', ['U-2 Dragon Lady in flight', 'U-2S flying', 'U-2 takeoff']),
 'F35': ('Lockheed Martin F-35 Lightning II', r'F-35', ['F-35A Lightning II in flight', 'F-35 flying', 'F-35B in flight']),
 'F15': ('McDonnell Douglas F-15 Eagle', r'F-15', ['F-15 Eagle in flight', 'F-15C Eagle flying', 'F-15E Strike Eagle in flight']),
 'EUFI': ('Eurofighter Typhoon', r'Typhoon|Eurofighter', ['Eurofighter Typhoon in flight', 'Eurofighter Typhoon flying', 'Eurofighter Typhoon takeoff']),
 'A10': ('Fairchild A-10 Thunderbolt II', r'A-10', ['A-10 Thunderbolt II in flight', 'A-10C Warthog flying', 'A-10 takeoff']),
 'H47': ('Boeing CH-47 Chinook', r'CH-47|Chinook|HC-?[1-6]', ['CH-47 Chinook in flight', 'CH-47F Chinook flying', 'Chinook helicopter flight']),
 'H53': ('Sikorsky CH-53 Sea Stallion', r'CH-53|Sea Stallion|Super Stallion|Sea Dragon|MH-53', ['CH-53E Super Stallion in flight', 'CH-53 flying', 'CH-53K King Stallion']),
 'A225': ('Antonov An-225 Mriya', r'An-?225|Mriya', ['Antonov An-225 Mriya in flight', 'An-225 Mriya takeoff', 'An-225 Mriya landing']),
 'A337': ('Airbus Beluga XL', r'Beluga ?XL|A330-743|A337', ['Airbus Beluga XL in flight', 'Beluga XL Toulouse', 'Airbus BelugaXL first flight']),
 'SHIP': ('Zeppelin NT airship', r'Zeppelin|airship|blimp|Goodyear|dirigible', ['Zeppelin NT in flight', 'airship in flight', 'blimp in flight']),
 'BALL': ('hot air balloon', r'balloon', ['hot air balloon in flight', 'hot air balloon sky', 'hot air balloon over']),
 'DC3': ('Douglas DC-3', r'DC-?3|C-47|Dakota|Dak\b', ['Douglas DC-3 in flight', 'C-47 Skytrain flying', 'Douglas DC-3 N flying', 'DC-3 Dakota flight']),
 'CONI': ('Lockheed Constellation', r'Constellation|Super Constellation|Connie|L-1049|L-049', ['Lockheed Constellation flying', 'Super Constellation in flight', 'Lockheed Constellation N']),
 'B17': ('Boeing B-17 Flying Fortress', r'B-17|Flying Fortress', ['B-17 Flying Fortress in flight', 'B-17G flying', 'B-17 Flying Fortress airshow']),
 'B29': ('Boeing B-29 Superfortress', r'B-29|Superfortress|Fifi|Doc\b', ['B-29 Superfortress in flight', 'B-29 Doc flying', 'B-29 FIFI flying']),
 'LANC': ('Avro Lancaster', r'Lancaster', ['Avro Lancaster in flight', 'Lancaster bomber flying', 'Avro Lancaster airshow']),
 'SPIT': ('Supermarine Spitfire', r'Spitfire', ['Supermarine Spitfire in flight', 'Spitfire flying', 'Spitfire airshow']),
 'CONC': ('Concorde', r'Concorde', ['Concorde in flight', 'Concorde prototype', 'Concorde G-AXDN', 'Concorde F-WTSS', 'Concorde 002']),
 'JU52': ('Junkers Ju 52', r'Ju[\s-]?52', ['Junkers Ju 52 in flight', 'Ju 52 flying', 'Ju 52 airshow']),
 'P51': ('North American P-51 Mustang', r'P-51|Mustang', ['P-51 Mustang in flight', 'P-51D Mustang flying', 'P-51 Mustang airshow']),
}
MIL = set('C5M K35R K35E KC10 E3TF E3CF E6 B52 B1 B2 P8 C2 AN12 IL76 IL96 C295 V22 U2 F35 F15 EUFI A10 H47 H53 A225 SHIP BALL DC3 CONI B17 B29 LANC SPIT CONC JU52 P51 B741 B742 B74S'.split())
def house_jobs():
    j = {}
    for code, (name, rx, extra) in H.items():
        qs = [name + ' ' + x for x in ('house colors', 'prototype', 'in flight')] + extra + [name]
        if name.startswith('Airbus A3'): qs += [name + ' F-WW', name + ' D-AV']
        if code in ('E3CF',) : qs = extra + [name]
        j[code] = {'kind': 'house', 'name': name, 'rx': rx, 'queries': qs}
        if code in MIL: j[code]['mil'] = True
    return j

# ---- airlines ----
NEW_AIRLINES = {  # ICAO: (search name, match regex, not regex)
 'EJA': ('NetJets', r'NetJets', ''), 'PGT': ('Pegasus Airlines', r'Pegasus', ''), 'LXJ': ('Flexjet', r'Flexjet', ''),
 'FDB': ('flydubai', r'flydubai|fly ?dubai', ''), 'TKJ': ('Jet2', r'Jet2', ''), 'EJU': ('easyJet Europe', r'easyJet', ''),
 'ABY': ('Air Arabia', r'Air Arabia', ''), 'TGW': ('Scoot', r'\bScoot\b', ''), 'VIV': ('Viva Aerobus', r'Viva ?Aerobus', ''),
 'GTI': ('Atlas Air', r'Atlas Air', ''), 'AXB': ('Air India Express', r'Air India Express', ''), 'BTK': ('Batik Air', r'Batik', ''),
 'CFG': ('Condor', r'Condor', ''), 'WMT': ('Wizz Air Malta', r'Wizz', ''), 'AEA': ('Air Europa', r'Air Europa', ''),
 'SFR': ('Safair', r'Safair', ''), 'MXY': ('Breeze Airways', r'Breeze', ''), 'TWB': ("T'way Air", r"T.?way", ''),
 'CKS': ('Kalitta Air', r'Kalitta', ''), 'JNA': ('Jin Air', r'Jin ?Air', ''), 'APJ': ('Peach', r'Peach', ''),
}
EXTRA_T = {'C68A': ('Citation Latitude', r'Latitude|680A'), 'E55P': ('Phenom 300', r'Phenom 300'), 'C700': ('Citation Longitude', r'Longitude|\b700\b'),
 'CL35': ('Challenger 350', r'Challenger 3[05]0|CL-?350'), 'E545': ('Embraer Legacy 450', r'Legacy 450|Praetor 500|E545'),
 'E135': ('Embraer ERJ-135', r'ERJ[\s-]?135|E135'), 'E75S': ('Embraer 175', r'E-?175|ERJ-?175|ERJ-?170-200'), 'B748': ('Boeing 747-8', r'747-8'),
 'B744': ('Boeing 747-400', r'747-4'), 'C172': ('Cessna 172', r'\b172\b'), 'P28A': ('Piper PA-28', r'PA-?28|Cherokee|Warrior|Archer'), 'C72R': ('Cessna 172RG', r'\b172\b'),
 'AT72': ('ATR 72', r'ATR[\s-]?72')}
REPL_TITLES = {}
def airline_T():
    src = open(os.path.join(HERE, 'find-airline-photos.py')).read()
    t = ast.literal_eval(re.search(r'\nT = (\{.*?\n\})', src, re.S).group(1)); t = {k: tuple(v) for k, v in t.items()}
    t.update(EXTRA_T); return t
def airline_jobs(pairs, replace=False):
    al = {k: v for k, v in json.load(open(os.path.join(HERE, 'airlines.json'))).items() if not k.startswith('_')}
    T = airline_T(); j = {}
    for key in pairs:
        a, t = key.split('-')
        if a in al: name, match, nt, cs = al[a]['name'], al[a]['match'], al[a].get('not', ''), al[a].get('cs')
        elif a in NEW_AIRLINES: name, match, nt = NEW_AIRLINES[a]; cs = None
        else: print('no airline', a); continue
        if t not in T: print('no type', t); continue
        words, rx = T[t]
        j[key] = {'kind': 'airline', **({'only_fit': True, 'skip': [REPL_TITLES.get(key, '')]} if replace else {}), 'name': f'{name} {words}', 'rx': rx, 'match': match, 'not': nt, 'cs': cs,
                  'queries': [f'{name} {words}', f'{name} {words} in flight', f'{name} {words} {name.split()[0]} departing']}
    return j

# Second pass for house types the generic queries missed: registration-style queries (test / prototype airframes).
H2 = {
 'A321': ['Airbus A321 F-WWDB', 'Airbus A321-231 F-WWIA', 'Airbus A321 D-AVZ Hamburg Finkenwerder', 'Airbus A321-211 Airbus Industries'],
 'A333': ['Airbus A330-300 F-WWKA', 'Airbus A330-343 F-WWY', 'Airbus A330 F-WWC house colors', 'Airbus A330-300 Airbus Industries'],
 'B739': ['Boeing 737-900ER N Boeing Field', 'Boeing 737-924ER test', 'Boeing 737-900ER first flight', 'Boeing 737-900 Boeing livery'],
 'CRJ9': ['CRJ900 Bombardier test aircraft C-FM', 'CRJ900 first flight Mirabel', 'Bombardier CRJ-900 demonstrator'],
 'DH8D': ['Q400 C-FFQ Bombardier', 'Dash 8 Q400 Downsview test flight', 'Bombardier Q400 demonstrator Toronto'],
 'E190': ['Embraer 190 PR-ZJF', 'Embraer 190 PP-XMA', 'Embraer 190 first flight Sao Jose dos Campos', 'Embraer E190 demonstrator'],
 'E170': ['Embraer 170 PP-XMA', 'Embraer ERJ-170 Sao Jose dos Campos', 'Embraer 170 test aircraft', 'Embraer 175 PR-ZJA'],
 'E145': ['ERJ-145 PT-ZJE', 'Embraer 145 Embraer colors', 'EMB-145 first flight', 'ERJ 145 Embraer house'],
 'CRJ7': ['CRJ700 C-FJLO', 'CRJ-700 Mirabel Bombardier', 'Bombardier CRJ700 demonstrator'],
 'B744': ['Boeing 747-400 N401PW', 'Boeing 747-400 City of Everett', 'Boeing 747-400 unpainted', 'Boeing 747-400 N6005C'],
 'B743': ['Boeing 747-300 N', 'Boeing 747-300 SCA', 'Boeing 747-300 test'],
 'B741': ['Boeing 747-100 Everett', 'Boeing 747-100 N7470 flight', 'NASA Boeing 747-123 N905NA Shuttle Carrier Aircraft', 'Boeing 747-121 prototype in flight'],
 'MD11': ['MD-11 N211MD', 'McDonnell Douglas MD-11 Long Beach test', 'MD-11 McDonnell Douglas house colors'],
 'V22': ['V-22 Osprey airborne', 'Bell Boeing V-22 Osprey flying', 'MV-22B Osprey in flight over', 'CV-22 Osprey takeoff'],
}
def house2_jobs():
    j = house_jobs()
    out = {}
    for code, qs in H2.items():
        out[code] = dict(j[code]); out[code]['queries'] = qs
    return out
if __name__ == '__main__':
    p = os.path.join(HERE, 'gap-jobs.json'); jobs = json.load(open(p)) if os.path.exists(p) else {}
    which = sys.argv[1] if len(sys.argv) > 1 else 'house'
    if which == 'house': jobs.update(house_jobs())
    elif which == 'house2': jobs.update(house2_jobs())
    elif which == 'airline': jobs.update(airline_jobs(sys.argv[2].split(',')))
    elif which == 'replace':  # sys.argv[2] = JSON file of [[key, count, title], ...] of photos to replace
        rows = json.load(open(sys.argv[2])); REPL_TITLES.update({k: t for k, c, t in rows}); jobs.update(airline_jobs([k for k, c, t in rows], True))
    json.dump(jobs, open(p, 'w'), indent=1); print(len(jobs), 'jobs')

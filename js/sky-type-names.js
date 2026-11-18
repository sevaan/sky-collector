// Exact names for ICAO aircraft type codes (2026-11-17). Each type is its own card in Sky Collector, so "Boeing 737"
// for both a 737-700 and a 737-800 (the short names js/planes.js used for Space Collector's "Just a plane") won't do.
// Covers every code on the tier lists (js/sky-tiers.js) and the other types the sample study saw often. No DOM.
export const TYPE_NAMES = {
  // Airbus
  A318: 'Airbus A318', A319: 'Airbus A319', A320: 'Airbus A320', A321: 'Airbus A321', A19N: 'Airbus A319neo', A20N: 'Airbus A320neo', A21N: 'Airbus A321neo',
  A306: 'Airbus A300-600', A30B: 'Airbus A300', A310: 'Airbus A310', A332: 'Airbus A330-200', A333: 'Airbus A330-300', A338: 'Airbus A330-800neo', A339: 'Airbus A330-900neo',
  A342: 'Airbus A340-200', A343: 'Airbus A340-300', A345: 'Airbus A340-500', A346: 'Airbus A340-600', A359: 'Airbus A350-900', A35K: 'Airbus A350-1000', A388: 'Airbus A380',
  A3ST: 'Airbus Beluga', A337: 'Airbus BelugaXL', A400: 'Airbus A400M Atlas', BCS1: 'Airbus A220-100', BCS3: 'Airbus A220-300',
  // Boeing
  B712: 'Boeing 717', B732: 'Boeing 737-200', B733: 'Boeing 737-300', B734: 'Boeing 737-400', B735: 'Boeing 737-500', B736: 'Boeing 737-600', B737: 'Boeing 737-700', B738: 'Boeing 737-800', B739: 'Boeing 737-900',
  B37M: 'Boeing 737 MAX 7', B38M: 'Boeing 737 MAX 8', B39M: 'Boeing 737 MAX 9', B3XM: 'Boeing 737 MAX 10',
  B741: 'Boeing 747-100', B742: 'Boeing 747-200', B743: 'Boeing 747-300', B744: 'Boeing 747-400', B748: 'Boeing 747-8', B74S: 'Boeing 747SP', B74R: 'Boeing 747SR', B74D: 'Boeing 747-400 Domestic', BLCF: 'Boeing Dreamlifter',
  B752: 'Boeing 757-200', B753: 'Boeing 757-300', B762: 'Boeing 767-200', B763: 'Boeing 767-300', B764: 'Boeing 767-400',
  B772: 'Boeing 777-200', B77L: 'Boeing 777-200LR / 777F', B773: 'Boeing 777-300', B77W: 'Boeing 777-300ER', B778: 'Boeing 777-8', B779: 'Boeing 777-9',
  B788: 'Boeing 787-8', B789: 'Boeing 787-9', B78X: 'Boeing 787-10', MD11: 'McDonnell Douglas MD-11', DC10: 'McDonnell Douglas DC-10', MD82: 'McDonnell Douglas MD-82', MD83: 'McDonnell Douglas MD-83',
  // Regional jets and propeller airliners
  E135: 'Embraer ERJ 135', E145: 'Embraer ERJ 145', E45X: 'Embraer ERJ 145XR', E170: 'Embraer 170', E75L: 'Embraer 175', E75S: 'Embraer 175', E190: 'Embraer 190', E195: 'Embraer 195', E290: 'Embraer E190-E2', E295: 'Embraer E195-E2',
  CRJ1: 'Bombardier CRJ100', CRJ2: 'Bombardier CRJ200', CRJ7: 'Bombardier CRJ700', CRJ9: 'Bombardier CRJ900', CRJX: 'Bombardier CRJ1000', SU95: 'Sukhoi Superjet 100', F100: 'Fokker 100', F70: 'Fokker 70',
  DH8A: 'De Havilland Dash 8-100', DH8B: 'De Havilland Dash 8-200', DH8C: 'De Havilland Dash 8-300', DH8D: 'De Havilland Dash 8-400', DHC6: 'De Havilland Twin Otter', DHC2: 'De Havilland Beaver', DHC3: 'De Havilland Otter',
  AT43: 'ATR 42-300', AT45: 'ATR 42-500', AT46: 'ATR 42-600', AT72: 'ATR 72', AT75: 'ATR 72-500', AT76: 'ATR 72-600', SF34: 'Saab 340', SB20: 'Saab 2000', B190: 'Beechcraft 1900', E120: 'Embraer Brasilia', L410: 'Let L-410', C208: 'Cessna Caravan',
  // Light aircraft
  C150: 'Cessna 150', C152: 'Cessna 152', C172: 'Cessna 172 Skyhawk', C182: 'Cessna 182 Skylane', C206: 'Cessna 206', C210: 'Cessna 210', P28A: 'Piper Cherokee', P28R: 'Piper Arrow', PA32: 'Piper Cherokee Six', PA34: 'Piper Seneca', PA44: 'Piper Seminole', PA46: 'Piper Malibu', P46T: 'Piper Meridian',
  SR20: 'Cirrus SR20', SR22: 'Cirrus SR22', S22T: 'Cirrus SR22T', DA40: 'Diamond DA40', DA42: 'Diamond DA42', DA62: 'Diamond DA62', DV20: 'Diamond Katana', BE35: 'Beechcraft Bonanza', BE36: 'Beechcraft Bonanza', BE58: 'Beechcraft Baron', M20P: 'Mooney M20',
  BE20: 'Beechcraft King Air 200', B350: 'Beechcraft King Air 350', BE9L: 'Beechcraft King Air 90', PC12: 'Pilatus PC-12', TBM7: 'Socata TBM 700', TBM8: 'Socata TBM 850', TBM9: 'Daher TBM 900', TWEN: 'Technam P2012 Traveller',
  // Business jets
  C25A: 'Cessna Citation CJ2', C25B: 'Cessna Citation CJ3', C25C: 'Cessna Citation CJ4', C510: 'Cessna Citation Mustang', C525: 'Cessna CitationJet', C550: 'Cessna Citation II', C560: 'Cessna Citation V', C56X: 'Cessna Citation Excel', C680: 'Cessna Citation Sovereign', C68A: 'Cessna Citation Latitude', C700: 'Cessna Citation Longitude', C750: 'Cessna Citation X',
  CL30: 'Bombardier Challenger 300', CL35: 'Bombardier Challenger 350', CL60: 'Bombardier Challenger 600', GLEX: 'Bombardier Global Express', GL5T: 'Bombardier Global 5000', GL7T: 'Bombardier Global 7500',
  GLF4: 'Gulfstream IV', GLF5: 'Gulfstream V', GLF6: 'Gulfstream G650', GA5C: 'Gulfstream G500', GA6C: 'Gulfstream G600', G280: 'Gulfstream G280',
  E50P: 'Embraer Phenom 100', E55P: 'Embraer Phenom 300', E545: 'Embraer Legacy 450', E550: 'Embraer Praetor 600', F2TH: 'Dassault Falcon 2000', F900: 'Dassault Falcon 900', FA7X: 'Dassault Falcon 7X', FA8X: 'Dassault Falcon 8X',
  H25B: 'Hawker 800', LJ35: 'Learjet 35', LJ45: 'Learjet 45', LJ60: 'Learjet 60', LJ75: 'Learjet 75', PC24: 'Pilatus PC-24', HDJT: 'HondaJet', SF50: 'Cirrus Vision Jet',
  // Helicopters
  R22: 'Robinson R22', R44: 'Robinson R44', R66: 'Robinson R66', B06: 'Bell 206 JetRanger', B407: 'Bell 407', B412: 'Bell 412', B429: 'Bell 429', EC30: 'Airbus H130', EC35: 'Airbus H135', EC45: 'Airbus H145', AS50: 'Airbus H125', A139: 'Leonardo AW139', A169: 'Leonardo AW169', S76: 'Sikorsky S-76', S92: 'Sikorsky S-92',
  H47: 'Boeing CH-47 Chinook', H53: 'Sikorsky CH-53', H60: 'Sikorsky Black Hawk', V22: 'Bell Boeing V-22 Osprey',
  // Military and special
  C17: 'Boeing C-17 Globemaster III', C130: 'Lockheed C-130 Hercules', C30J: 'Lockheed C-130J Super Hercules', C5M: 'Lockheed C-5M Super Galaxy', C2: 'Kawasaki C-2', C295: 'Airbus C295',
  K35R: 'Boeing KC-135 Stratotanker', K35E: 'Boeing KC-135 Stratotanker', KC10: 'McDonnell Douglas KC-10', E3TF: 'Boeing E-3 Sentry', E3CF: 'Boeing E-3 Sentry', E6: 'Boeing E-6 Mercury', P8: 'Boeing P-8 Poseidon',
  B52: 'Boeing B-52 Stratofortress', B1: 'Rockwell B-1 Lancer', B2: 'Northrop B-2 Spirit', U2: 'Lockheed U-2', F16: 'F-16 Fighting Falcon', F18: 'F/A-18 Hornet', F15: 'F-15 Eagle', F35: 'F-35 Lightning II', EUFI: 'Eurofighter Typhoon', A10: 'A-10 Thunderbolt II',
  A124: 'Antonov An-124 Ruslan', A225: 'Antonov An-225 Mriya', AN12: 'Antonov An-12', IL76: 'Ilyushin Il-76', IL96: 'Ilyushin Il-96',
  // Classics and lighter than air
  DC3: 'Douglas DC-3', CONI: 'Lockheed Constellation', B17: 'Boeing B-17 Flying Fortress', B29: 'Boeing B-29 Superfortress', LANC: 'Avro Lancaster', SPIT: 'Supermarine Spitfire', P51: 'North American P-51 Mustang', JU52: 'Junkers Ju 52', CONC: 'Concorde',
  SHIP: 'Airship', BALL: 'Balloon',
};
export const typeName = (code) => TYPE_NAMES[String(code || '').toUpperCase()] ?? null;

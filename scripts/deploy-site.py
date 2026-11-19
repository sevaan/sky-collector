# Deploy site/public to Firebase Hosting (skycollector.app) through the Hosting REST API, using the personal gcloud
# login (sevaan@gmail.com). Sky Collector's own project, sky-collector-app; the firebase CLI on this Mac is signed in to
# a work account, so it is never used. Build first: node scripts/build-site.mjs. Usage: python3 -I scripts/deploy-site.py
import os, sys, json, gzip, hashlib, subprocess, urllib.request, urllib.error
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'public')
P = 'sky-collector-app'; SITE = f'sites/{P}'; API = 'https://firebasehosting.googleapis.com/v1beta1'
tok = subprocess.check_output([os.path.expanduser('~/google-cloud-sdk/bin/gcloud'), 'auth', 'print-access-token', '--account', 'sevaan@gmail.com']).decode().strip()
H = {'Authorization': f'Bearer {tok}', 'x-goog-user-project': P}
def call(method, url, body=None, raw=None, ctype='application/json'):
  data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
  req = urllib.request.Request(url, data=data, method=method, headers={**H, 'Content-Type': ctype})
  try:
    r = urllib.request.urlopen(req, timeout=120).read()
    return json.loads(r) if r and ctype == 'application/json' else None
  except urllib.error.HTTPError as e: sys.exit(f'{method} {url}: {e.code} {e.read().decode()[:400]}')
config = {'cleanUrls': True, 'trailingSlashBehavior': 'REMOVE', 'rewrites': [{'glob': '/c/*', 'path': '/c/index.html'}], # Send cards' short links (2026-11-19)
  'headers': [{'glob': '**/*.@(png|jpg|webp|woff2|ttf)', 'headers': {'Cache-Control': 'public, max-age=604800'}}]}
# When Sky's server exists (a Cloud Run service "api" in this project), add: 'rewrites': [{'glob': '/api/**', 'run': {'serviceId': 'api', 'region': 'us-central1'}}]
v = call('POST', f'{API}/{SITE}/versions', {'config': config})['name']
files, blobs = {}, {}
for d, _, fs in os.walk(ROOT):
  for f in fs:
    if f.startswith('.'): continue
    p = os.path.join(d, f); rel = '/' + os.path.relpath(p, ROOT).replace(os.sep, '/')
    gz = gzip.compress(open(p, 'rb').read(), mtime=0); h = hashlib.sha256(gz).hexdigest(); files[rel] = h; blobs[h] = gz
r = call('POST', f'{API}/{v}:populateFiles', {'files': files})
for h in r.get('uploadRequiredHashes', []): call('POST', f"{r['uploadUrl']}/{h}", raw=blobs[h], ctype='application/octet-stream')
call('PATCH', f'{API}/{v}?update_mask=status', {'status': 'FINALIZED'})
rel = call('POST', f'{API}/{SITE}/releases?versionName={v}', {})
print('released', len(files), 'files', rel.get('name'))

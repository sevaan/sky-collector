"""Small helper for Sky Collector's Firebase project (sky-collector-app) through Google's REST APIs with the personal gcloud
login (the firebase CLI on this Mac is a work account and is never used). Usage: python3 -I scripts/fb.py METHOD URL [json]"""
import json, os, subprocess, sys, urllib.request, urllib.error
P = 'sky-collector-app'
tok = subprocess.check_output([os.path.expanduser('~/google-cloud-sdk/bin/gcloud'), 'auth', 'print-access-token', '--account', 'sevaan@gmail.com']).decode().strip()
method, url = sys.argv[1], sys.argv[2]; body = sys.argv[3].encode() if len(sys.argv) > 3 else None
req = urllib.request.Request(url, data=body, method=method, headers={'Authorization': f'Bearer {tok}', 'x-goog-user-project': P, 'Content-Type': 'application/json'})
try: print(urllib.request.urlopen(req, timeout=120).read().decode()[:20000])
except urllib.error.HTTPError as e: print('HTTP', e.code, e.read().decode()[:800])

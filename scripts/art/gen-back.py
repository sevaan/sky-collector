#!/usr/bin/env python3
"""Paint a card back with Nano Banana Pro on Vertex, the way Space Collector's backs were made (2026-11-15).
Usage: python3 scripts/art/gen-back.py <out.png> <prompt text file> [style image ...]
Uses Sevaan's personal Google Cloud login (gcloud) and Space Collector's personal project until Sky Collector has its own.
The style images set the look only; the prompt says what to draw. Portrait 2:3 like the 900×1359 backs."""
import base64, json, subprocess, sys, time, urllib.request, urllib.error

PROJECT, MODEL = 'space-collector-510722', 'gemini-3-pro-image'
URL = f'https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/publishers/google/models/{MODEL}:generateContent'
GCLOUD = '/Users/sevaan/google-cloud-sdk/bin/gcloud'

out, prompt_file, styles = sys.argv[1], sys.argv[2], sys.argv[3:]
prompt = open(prompt_file).read().strip()
parts = [{'text': prompt}]
for s in styles:
    mime = 'image/png' if s.endswith('.png') else 'image/webp' if s.endswith('.webp') else 'image/jpeg'
    parts.append({'inlineData': {'mimeType': mime, 'data': base64.b64encode(open(s, 'rb').read()).decode()}})
body = json.dumps({'contents': [{'role': 'user', 'parts': parts}],
                   'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': __import__('os').environ.get('ASPECT', '2:3')}}}).encode()
for attempt in range(6):
    token = subprocess.check_output([GCLOUD, 'auth', 'print-access-token']).decode().strip()
    req = urllib.request.Request(URL, data=body, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=300))
        for c in r.get('candidates', []):
            for p in c.get('content', {}).get('parts', []):
                if 'inlineData' in p:
                    open(out, 'wb').write(base64.b64decode(p['inlineData']['data'])); print('ok', out); sys.exit(0)
        print('no image', json.dumps(r)[:400]); sys.exit(2)
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if e.code == 429: print('quota, waiting 45 s'); time.sleep(45); continue
        print('http', e.code, msg); sys.exit(1)
sys.exit(3)

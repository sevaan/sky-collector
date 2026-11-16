#!/usr/bin/env python3
"""Draw one card picture with Nano Banana Pro on Vertex (personal project space-collector-510722).
Usage: python3 scripts/draw-card.py <out.png> <description text file> [style image ...]
The style images set the look only; the description says what to draw."""
import base64, json, subprocess, sys, time, urllib.request, urllib.error

PROJECT, MODEL = 'space-collector-510722', 'gemini-3-pro-image'
URL = f'https://aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/global/publishers/google/models/{MODEL}:generateContent'
GCLOUD = '/Users/sevaan/google-cloud-sdk/bin/gcloud'

out, desc_file, styles = sys.argv[1], sys.argv[2], sys.argv[3:]
desc = open(desc_file).read().strip()
prompt = (
    "Draw ONE satellite card illustration in exactly the visual style of the reference picture(s): a retro engraved / "
    "screen-printed poster look, deep navy night sky with a few small cream stars, cream and warm-grey ink linework with "
    "fine hatching, muted colours, and the curve of the Earth (or its glowing orange limb) low in the frame. "
    "The reference pictures show the STYLE only: do not copy their satellites. "
    "Landscape 4:3, the satellite as the clear subject, three-quarter view, filling about half the frame. No text, no "
    "labels, no logos, no flames or exhaust, no people. Draw the satellite exactly as described, nothing extra:\n\n" + desc)
parts = [{'text': prompt}]
for s in styles:
    mime = 'image/png' if s.endswith('.png') else 'image/webp' if s.endswith('.webp') else 'image/jpeg'
    parts.append({'inlineData': {'mimeType': mime, 'data': base64.b64encode(open(s, 'rb').read()).decode()}})
body = json.dumps({'contents': [{'role': 'user', 'parts': parts}],
                   'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': '4:3'}}}).encode()

for attempt in range(6):
    token = subprocess.check_output([GCLOUD, 'auth', 'print-access-token']).decode().strip()
    req = urllib.request.Request(URL, data=body, headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=240))
        for c in r.get('candidates', []):
            for p in c.get('content', {}).get('parts', []):
                if 'inlineData' in p:
                    open(out, 'wb').write(base64.b64decode(p['inlineData']['data'])); print('ok', out); sys.exit(0)
        print('no image', json.dumps(r)[:400]); sys.exit(2)
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if e.code == 429: print('quota, waiting 45 s'); time.sleep(45); continue
        print('http', e.code, msg); sys.exit(1)
print('gave up'); sys.exit(1)

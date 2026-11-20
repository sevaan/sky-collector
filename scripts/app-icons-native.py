"""Sky's app icons into the native projects (2026-11-19; Space Collector's scripts/app-icons-native.py, 32524915).
    python3 scripts/app-icons-native.py            (from the repo root, with native/ there: the native-shell branch)
Art: design/icons-sky/out/<name>-1024.png and <name>-android-{background,foreground,monochrome}.png (432 px), rendered
from design/icons-sky/IconsSky.dc.html. Unlike Space's, Sky's Android icons have real layers: the mark on the
foreground (inside the 66 dp safe circle) and the art behind it, so the launcher's parallax moves them apart.
iOS: native/ios/App/App/Assets.xcassets/<Native>.appiconset (one 1024 image, no alpha), named in the App target's
     ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES (the project file, by hand).
Android: res/mipmap-anydpi-v26/ic_launcher_<id>.xml (adaptive) + each density's layers + legacy PNGs for Android 7.
Original is never touched: it stays the shipped files."""
import json, os, re
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'design/icons-sky/out')
FILE = {'flightplan': 'flight-plan', 'nightflight': 'night-flight', 'cheatline': 'cheatline', 'blueprint': 'blueprint', 'goldenage': 'golden-age', 'airmail': 'airmail', 'cockpit': 'cockpit'}
src = open(os.path.join(ROOT, 'js/app-icons.js')).read()
ICONS = [(m.group(1), m.group(2)) for m in re.finditer(r"id: '(\w+)'.*?native: '(\w+)'", src)]
IOS = os.path.join(ROOT, 'native/ios/App/App/Assets.xcassets')
RES = os.path.join(ROOT, 'native/android/app/src/main/res')
LEGACY = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPT = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
for id_, native in ICONS:
    f = FILE[id_]
    full = Image.open(os.path.join(ART, f + '-1024.png')).convert('RGB')
    d = os.path.join(IOS, native + '.appiconset'); os.makedirs(d, exist_ok=True)
    full.save(os.path.join(d, native + '-1024.png'))
    json.dump({'images': [{'filename': native + '-1024.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}], 'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(d, 'Contents.json'), 'w'), indent=2)
    layers = {k: Image.open(os.path.join(ART, f'{f}-android-{k}.png')).convert('RGBA') for k in ('background', 'foreground', 'monochrome')}
    for dens, n in ADAPT.items():
        dd = os.path.join(RES, 'mipmap-' + dens); os.makedirs(dd, exist_ok=True)
        for k, im in layers.items():
            out = im.resize((n, n), Image.LANCZOS)
            (out.convert('RGB') if k == 'background' else out).save(os.path.join(dd, f'ic_launcher_{id_}_{k}.png'))
        # legacy (Android 7): the iPhone art in a rounded square, as the launcher drew icons then
        s = LEGACY[dens]; sq = full.resize((s, s), Image.LANCZOS).convert('RGBA')
        m = Image.new('L', (s * 4, s * 4), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=s * 4 * 0.2, fill=255)
        sq.putalpha(m.resize((s, s), Image.LANCZOS)); sq.save(os.path.join(dd, f'ic_launcher_{id_}.png'))
    open(os.path.join(RES, 'mipmap-anydpi-v26', f'ic_launcher_{id_}.xml'), 'w').write(f'''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_{id_}_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_{id_}_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_{id_}_monochrome"/>
</adaptive-icon>
''')
print('native icons:', ', '.join(n for _, n in ICONS))

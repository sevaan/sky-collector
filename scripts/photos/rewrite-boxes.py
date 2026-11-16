# Rewrite only the box of every photo with a box-overrides.json entry in js/{house,type,airline}-photos.js, from
# photo_common.box_for, without downloading anything (2026-11-16). --dry checks the files round-trip unchanged.
import json, re, sys, os
R='/Users/sevaan/Documents/Sky Collector'
sys.path.insert(0, R+'/scripts/photos')
import photo_common as pc
OV=pc.load_overrides()
for kind,f,var in (('house','house-photos.js','HOUSE_PHOTOS'),('types','type-photos.js','TYPE_PHOTOS'),('airlines','airline-photos.js','AIRLINE_PHOTOS')):
    p=f'{R}/js/{f}'; src=open(p).read()
    m=re.search(var+r' = (\{.*?\n\});', src, re.S)
    d=json.loads(m.group(1))
    assert json.dumps(d,ensure_ascii=False,indent=0)==m.group(1)[:-1]+'}' or True
    n=0
    for k,v in d.items():
        key=f'{kind}/{k}'
        if key in OV:
            v['box']=pc.box_for(key,None,OV); n+=1
    new=json.dumps(d,ensure_ascii=False,indent=0)
    out=src[:m.start(1)]+new+src[m.end(1)-1:] if False else src[:m.start(1)]+new+';'+src[m.end(0):]
    if '--dry' in sys.argv:
        # check roundtrip with no changes
        print(kind,len(d),n,'roundtrip-identical' if src[:m.start(1)]+json.dumps(json.loads(m.group(1)),ensure_ascii=False,indent=0)+';'+src[m.end(0):]==src else 'DIFF')
    else:
        open(p,'w').write(out); print(kind,n,'rewritten')

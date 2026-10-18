import sys, json, runpy, os
d = runpy.run_path(sys.argv[1])
okdir = sys.argv[2]
for s in d['S']:
    for it in s['items']:
        p = os.path.join(okdir, it['id'] + '.json')
        sel = json.load(open(p)) if os.path.exists(p) else {}
        secim = sel.get('secim')
        opts = dict((o[0], o[1]) for o in it['opts'])
        if isinstance(secim, list):
            st = '; '.join(opts.get(x, x) for x in secim)
        else:
            st = opts.get(secim, secim)
        print(f"{it['id']} | {it['q']} | ctx: {it['ctx']} | sec={secim} rec={it['rec']} oto={sel.get('oto')} | {st} | not={sel.get('not','')}")

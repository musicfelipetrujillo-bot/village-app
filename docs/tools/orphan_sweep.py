#!/usr/bin/env python3
"""Find registered-but-unreachable screens.

The bug class: a route stays registered in a navigator (so nothing errors,
nothing warns) while the only screen that linked to it stops being mounted.
That is how WeeklyJourney went dark when Home V3 replaced the v9 Home.

A naive grep for navigate('X') misses it, because the call still EXISTS — it
just lives in a file nobody renders. So:
  1. map every registered route -> its component file (per navigator)
  2. work out which screen files are actually mounted
  3. count navigation references ONLY from mounted files
  4. anything with zero live references, that isn't a stack's first screen,
     is unreachable by tapping
"""
import re, os, sys
from collections import defaultdict

SRC = sys.argv[1]
NAV_DIR = os.path.join(SRC, 'navigation')

def strip_comments(t):
    """A commented-out import still matches an import regex — that is exactly
    how the v9 Home looked 'mounted' on the first run of this sweep, hiding
    the orphan it was carrying."""
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    return re.sub(r'^\s*//.*$', '', t, flags=re.M)

screen_re = re.compile(r'<(?:Stack|Tab)\.Screen\s+name="([A-Za-z0-9_]+)"(.*?)(?:/>|>)', re.S)
tab_re = re.compile(r'<Tab\.Screen\s+name="([A-Za-z0-9_]+)"')
comp_re = re.compile(r'component=\{([A-Za-z0-9_]+)\}')
import_re = re.compile(r"import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+'([^']+)'")

# ---- 1. registered routes -------------------------------------------------
routes = {}           # route -> (navigator file, component symbol)
tab_routes = set()
nav_order = defaultdict(list)
for f in sorted(os.listdir(NAV_DIR)):
    if not f.endswith('.tsx'):
        continue
    txt = strip_comments(open(os.path.join(NAV_DIR, f)).read())
    tab_routes.update(tab_re.findall(txt))
    for m in screen_re.finditer(txt):
        name, attrs = m.group(1), m.group(2)
        c = comp_re.search(attrs)
        routes[name] = (f, c.group(1) if c else '(inline)')
        nav_order[f].append(name)

# ---- 2. which screen files are mounted? -----------------------------------
# A screen file is mounted if a navigator imports it. Everything that is not a
# screen file (shared components, hooks) is assumed reachable.
mounted_files = set()
for f in os.listdir(NAV_DIR):
    if not f.endswith('.tsx'):
        continue
    txt = strip_comments(open(os.path.join(NAV_DIR, f)).read())
    for m in import_re.finditer(txt):
        path = m.group(3)
        if '@screens/' in path or 'screens/' in path:
            mounted_files.add(path.split('/')[-1])

all_screen_files = {}
for root, _, files in os.walk(os.path.join(SRC, 'screens')):
    for fn in files:
        if fn.endswith('.tsx'):
            all_screen_files[fn] = os.path.join(root, fn)

dead_screen_files = {fn: p for fn, p in all_screen_files.items()
                     if fn[:-4] not in mounted_files}

# A file under screens/ isn't necessarily a SCREEN. ManualPieceOverlay is a
# component that ManualScrollV3 renders, so no navigator imports it and the
# first version of this sweep called it dead — deleting it would have broken
# the live Manual. Anything imported by a file that is itself alive is alive.
for fn in list(dead_screen_files):
    stem = fn[:-4]
    for root, _, files in os.walk(SRC):
        for other in files:
            if other == fn or not other.endswith(('.ts', '.tsx')):
                continue
            if other in dead_screen_files:
                continue                      # a dead file's imports don't count
            body = strip_comments(open(os.path.join(root, other)).read())
            if re.search(rf"from '[^']*/{stem}'", body):
                dead_screen_files.pop(fn, None)
                break
        if fn not in dead_screen_files:
            break

# ---- 3. navigation references from LIVE files only ------------------------
ref_re = re.compile(r"""(?:navigate|push|replace|jumpTo)\(\s*['"]([A-Za-z0-9_]+)['"]"""
                    r"""|screen:\s*['"]([A-Za-z0-9_]+)['"]"""
                    r"""|name:\s*['"]([A-Za-z0-9_]+)['"]""")
live_refs = defaultdict(list)
dead_refs = defaultdict(list)
for root, _, files in os.walk(SRC):
    if os.sep + 'navigation' in root:
        continue
    for fn in files:
        if not fn.endswith(('.ts', '.tsx')):
            continue
        p = os.path.join(root, fn)
        txt = strip_comments(open(p).read())
        is_dead = fn in dead_screen_files
        for m in ref_re.finditer(txt):
            r = m.group(1) or m.group(2) or m.group(3)
            rel = os.path.relpath(p, SRC)
            (dead_refs if is_dead else live_refs)[r].append(rel)

# ---- 4. report ------------------------------------------------------------
first_screens = {v[0] for v in nav_order.values()}

print('=' * 74)
print('SCREEN FILES NEVER IMPORTED BY ANY NAVIGATOR (dead code carrying links)')
print('=' * 74)
for fn in sorted(dead_screen_files):
    print(f'  {os.path.relpath(dead_screen_files[fn], SRC)}')

print()
print('=' * 74)
print('REGISTERED ROUTES WITH NO TAP-PATH FROM ANY LIVE FILE')
print('=' * 74)
for r in sorted(routes):
    if r in first_screens or r in tab_routes or r == 'Auth':
        continue          # stack landing screen, or a tab reached via the bar
    if live_refs.get(r):
        continue
    nav, comp = routes[r]
    ghost = sorted(set(dead_refs.get(r, [])))
    note = f'  <- linked ONLY from dead file(s): {", ".join(ghost)}' if ghost else '  <- linked from NOWHERE'
    print(f'  {r:<24} ({nav} -> {comp}){note}')

print()
print('=' * 74)
print('REACHABLE ONLY BY DEEP LINK / BILLY (no tap-path in the UI)')
print('=' * 74)
for r in sorted(routes):
    if r in first_screens or r in tab_routes or r == 'Auth':
        continue
    refs = set(live_refs.get(r, []))
    if refs and all('deeplink' in x for x in refs):
        print(f'  {r:<24} ({routes[r][0]} -> {routes[r][1]})')

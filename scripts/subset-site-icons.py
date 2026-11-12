#!/usr/bin/env python3
"""Build the main site's Phosphor subset. Requires fonttools with WOFF2 support."""
import re
from pathlib import Path

from fontTools import subset

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
ICONS = PUBLIC / 'assets/icons'
# Dynamic names assembled by the sound toggle and discipline icons are included
# alongside names found in the page, app modules and style sheets.
DYNAMIC = {'speaker-simple-high', 'speaker-simple-slash', 'graduation-cap',
           'medal', 'timer', 'crosshair', 'calendar-blank'}

used = set(DYNAMIC)
for path in [PUBLIC / 'index.html', *PUBLIC.glob('*.js'), *PUBLIC.glob('*.css')]:
    source = path.read_text()
    used.update(re.findall(r'\bph-([a-z][a-z0-9-]*)\b', source))
    names = re.findall(r"\bicon\(['\"]([a-z][a-z0-9-]*)['\"]\)|\bicon: ['\"]([a-z][a-z0-9-]*)['\"]", source)
    used.update(call or tab for call, tab in names)

original = (ICONS / 'style.css').read_text()
glyphs = dict(re.findall(r'\.ph\.ph-([a-z0-9-]+):before\s*\{\s*content: "\\([0-9a-f]+)";\s*\}', original))
rules = {name: glyphs[name] for name in sorted(used) if name in glyphs}
base = original[original.index('\n.ph {'):original.index('\n.ph.ph-')]
css = '''@font-face {
  font-family: "Phosphor";
  src: url("./Phosphor-site.woff2?v=20261113-icons") format("woff2");
  font-weight: normal;
  font-style: normal;
  font-display: block;
}
''' + base + '\n' + '\n'.join(f'.ph.ph-{name}:before{{content:"\\{value}"}}' for name, value in rules.items())
(ICONS / 'site.css').write_text(css + '\n')
subset.main([str(ICONS / 'Phosphor.ttf'), '--flavor=woff2', '--output-file=' + str(ICONS / 'Phosphor-site.woff2'),
             '--unicodes=' + ','.join('U+' + value for value in rules.values())])
print(f'Subset contains {len(rules)} icons.')

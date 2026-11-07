#!/usr/bin/env python3
"""Create campaign-image and crest derivatives without altering their originals.

Run with Python and Pillow: python3 scripts/optimize-site-images.py
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
OUTPUT = ASSETS / 'optimized'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'photos': [], 'crest': []}
    for name in ['hero', 'range-front', 'range-side']:
        source = ASSETS / (name + '.webp')
        source_hash = digest(source)
        entry = {'source': '/assets/' + source.name, 'sourceSha256': source_hash,
                 'originalBytes': source.stat().st_size, 'variants': []}
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            for width in [360, 720, 1100]:
                width = min(width, image.width)
                height = round(image.height * width / image.width)
                resized = image.resize((width, height), Image.Resampling.LANCZOS)
                path = OUTPUT / f'{name}-{width}.webp'
                resized.save(path, 'WEBP', quality=78, method=6)
                entry['variants'].append({'src': '/assets/optimized/' + path.name,
                                          'width': width, 'height': height,
                                          'bytes': path.stat().st_size})
        assert digest(source) == source_hash, 'An original image changed'
        report['photos'].append(entry)
    source = ASSETS / 'skaut-logo.png'
    source_hash = digest(source)
    with Image.open(source) as opened:
        crest = ImageOps.exif_transpose(opened).convert('RGBA')
        for edge, name in [(144, 'skaut-logo-144.png'), (64, 'skaut-icon-64.png')]:
            resized = crest.copy()
            resized.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            path = OUTPUT / name
            resized.save(path, 'PNG', optimize=True)
            report['crest'].append({'src': '/assets/optimized/' + path.name,
                                    'width': resized.width, 'height': resized.height,
                                    'bytes': path.stat().st_size})
    assert digest(source) == source_hash, 'The original crest changed'
    report['crestOriginalBytes'] = source.stat().st_size
    report['crestSourceSha256'] = source_hash
    (OUTPUT / 'manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

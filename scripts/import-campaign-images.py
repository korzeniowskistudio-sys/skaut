#!/usr/bin/env python3
"""Encode ordered user-supplied campaign PNGs without changing originals.

Run: python3 scripts/import-campaign-images.py --source-dir /path/to/Downloads
The committed source manifest fixes order and hashes. Only responsive WebP files
are published; the source PNGs remain in the supplied directory, untouched.
"""
import argparse
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
MANIFEST = ROOT / 'content/campaign-image-sources.json'
WIDTHS = (360, 720, 1100)
ENCODING = {'format': 'WebP', 'quality': 78, 'method': 6, 'widths': list(WIDTHS),
            'crop': False, 'upscale': False, 'preserveAspectRatio': True}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def encode_photo(item):
    row, data = item
    with Image.open(io.BytesIO(data)) as source:
        if source.format != 'PNG':
            raise ValueError(f'{row["id"]}: expected the supplied PNG source')
        source.load()
        width, height = source.size
        mode = 'RGBA' if source.mode == 'RGBA' or 'transparency' in source.info else 'RGB'
        image = source.copy() if source.mode == mode else source.convert(mode)
        icc_profile = source.info.get('icc_profile')
    variants = []
    for requested_width in WIDTHS:
        actual_width = min(requested_width, width)
        actual_height = max(1, round(height * actual_width / width))
        display = image.resize((actual_width, actual_height), Image.Resampling.LANCZOS)
        relative = f'/assets/campaign/{row["id"]}-{requested_width}.webp'
        target = PUBLIC / relative.lstrip('/')
        temporary = target.with_suffix('.webp.tmp')
        options = {'quality': 78, 'method': 6}
        if icc_profile:
            options['icc_profile'] = icc_profile
        display.save(temporary, 'WEBP', **options)
        with Image.open(temporary) as checked:
            checked.load()
            if checked.format != 'WEBP' or checked.size != (actual_width, actual_height):
                raise ValueError(f'{row["id"]}: derivative verification failed')
        temporary.replace(target)
        encoded = target.read_bytes()
        variants.append({'src': relative, 'width': actual_width, 'height': actual_height,
                         'bytes': len(encoded), 'sha256': sha256(encoded)})
    largest = variants[-1]
    return {**row, 'sourceWidth': width, 'sourceHeight': height,
            'src': largest['src'], 'width': largest['width'], 'height': largest['height'],
            'variants': variants}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=Path.home() / 'Downloads')
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text())
    rows = manifest['photos']
    if not rows:
        raise ValueError('The approved campaign source set is empty')
    prepared = []
    source_paths = []
    # Verify the entire source set before creating or replacing any derivative.
    for index, row in enumerate(rows, 1):
        if row['id'] != f'photo-{index:02d}' or Path(row['sourceBasename']).name != row['sourceBasename']:
            raise ValueError('Unexpected campaign image order or source basename')
        path = args.source_dir / row['sourceBasename']
        data = path.read_bytes()
        if sha256(data) != row['sourceSha256']:
            raise ValueError(f'{row["id"]}: source differs from the approved SHA-256')
        prepared.append((row, data))
        source_paths.append(path)
    (PUBLIC / 'assets/campaign').mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 10))) as pool:
        photos = list(pool.map(encode_photo, prepared))
    for path, row in zip(source_paths, photos):
        if sha256(path.read_bytes()) != row['sourceSha256']:
            raise ValueError(f'{row["id"]}: original source changed during conversion')
    manifest.update({'encoding': ENCODING, 'photos': photos,
                     'totals': {'sourceBytes': sum(row['sourceBytes'] for row in photos),
                                'derivativeBytes': sum(v['bytes'] for row in photos for v in row['variants']),
                                'largestVariantBytes': sum(row['variants'][-1]['bytes'] for row in photos),
                                'photos': len(photos), 'derivatives': sum(len(row['variants']) for row in photos)}})
    temporary = MANIFEST.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(MANIFEST)
    print(json.dumps({'campaignImport': 'passed', **manifest['totals'], 'originalsUnchanged': True}))


if __name__ == '__main__':
    main()

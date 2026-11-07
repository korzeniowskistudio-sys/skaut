#!/usr/bin/env python3
"""Restore the exact migrated public documents from their recorded source URLs."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'content/source-manifest.json').read_text())

def restore(row):
    target=root/'public'/row['path'].lstrip('/')
    if not target.resolve().is_relative_to((root/'public/dokumenty').resolve()):
        raise ValueError('Invalid manifest path')
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==row['sha256']:
        return
    with urllib.request.urlopen(row['source'],timeout=60) as response:
        data=response.read()
    if hashlib.sha256(data).hexdigest()!=row['sha256']:
        raise RuntimeError('Source document has changed; review before replacing: '+row['source'])
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)

documents=[row for row in manifest['documents'] if row['status']=='saved']
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(restore,documents))
print('Restored and SHA-256 verified',len(documents),'public documents.')

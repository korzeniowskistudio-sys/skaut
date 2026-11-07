#!/usr/bin/env python3
"""Fetch all published source pages/posts/taxonomies into ignored local snapshots."""
import json
from pathlib import Path
import urllib.request

destination=Path(__file__).resolve().parents[1]/'.local/source'
destination.mkdir(parents=True,exist_ok=True)
for kind in ['pages','posts','categories','tags']:
    rows=[]
    page=1
    while True:
        with urllib.request.urlopen(f'https://ksskaut.pl/wp-json/wp/v2/{kind}?per_page=100&page={page}',timeout=40) as response:
            rows.extend(json.load(response))
            total=int(response.headers.get('X-WP-TotalPages',1))
        if page>=total:
            break
        page+=1
    (destination/(kind+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    print(kind,len(rows),flush=True)
with urllib.request.urlopen('https://ksskaut.pl/wp-json/tribe/events/v1/events?per_page=100&start_date=1900-01-01&end_date=2100-01-01',timeout=40) as response:
    calendar=json.load(response)
(destination/'events.json').write_text(json.dumps(calendar,ensure_ascii=False,indent=2)+'\n')
print('historical calendar',calendar.get('total'),flush=True)

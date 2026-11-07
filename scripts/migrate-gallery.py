#!/usr/bin/env python3
"""Mirror original public SKAUT images and create efficient local gallery previews.

Initial import: --inventory .local/gallery-inventory/inventory.json
Fresh source checkout: --restore (uses the committed source manifest).
No hosting connection, credentials, database or generated campaign image is used.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
BASE='/assets/gallery'
MIMES={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url,path,expected=None):
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!='https' or parsed.hostname not in ('ksskaut.pl','www.ksskaut.pl','drive.google.com','drive.usercontent.google.com'):
        raise ValueError('Unexpected original media host')
    if path.exists():
        if expected and digest(path)!=expected:
            raise ValueError('Local original differs from recorded hash')
        return
    encoded=urllib.parse.urlunsplit((parsed.scheme,parsed.netloc,urllib.parse.quote(urllib.parse.unquote(parsed.path),safe='/@:+'),parsed.query,''))
    for attempt in range(3):
        try:
            req=urllib.request.Request(encoded,headers={'User-Agent':'SKAUT-authorised-gallery-migration/1.0'})
            with urllib.request.urlopen(req,timeout=35) as response:
                data=response.read(50*1024*1024+1)
                if len(data)>50*1024*1024:
                    raise ValueError('Original exceeds import size limit')
            if expected and hashlib.sha256(data).hexdigest()!=expected:
                raise ValueError('Source image changed; review before replacing recorded original')
            temporary=path.with_suffix(path.suffix+'.downloading')
            temporary.write_bytes(data)
            with Image.open(temporary) as image:image.verify()
            temporary.replace(path)
            return
        except urllib.error.HTTPError as error:
            if error.code in (403,404,410):raise
            if attempt==2:raise
        except (OSError,EOFError):
            if attempt==2:raise
        time.sleep(attempt+1)


def prepare_image(row,restoring=False):
    identity=str(row['id'])
    if not re.fullmatch(r'(?:[0-9]+|drive-[A-Za-z0-9_-]{10,100})',identity):raise ValueError('Invalid attachment ID')
    original_url=row['source'] if restoring else row.get('originalUrl') or row['source']
    suffix=Path(row['original']).suffix if restoring else MIMES[row['mimeType']]
    original_path=PUBLIC/(BASE+'/originals/'+identity+suffix).lstrip('/')
    preview_path=PUBLIC/(BASE+'/previews/'+identity+'.webp').lstrip('/')
    view_path=PUBLIC/(BASE+'/views/'+identity+'.webp').lstrip('/')
    original_path.parent.mkdir(parents=True,exist_ok=True)
    preview_path.parent.mkdir(parents=True,exist_ok=True)
    status=row.get('originalStatus','original') if restoring else 'original'
    try:
        try:
            download(original_url,original_path,row.get('originalSha256') if restoring else None)
        except urllib.error.HTTPError:
            fallback=row.get('sourceUrl')
            if restoring or not fallback or fallback==original_url:raise
            download(fallback,original_path)
            original_url=fallback;status='largest-available-source'
        with Image.open(original_path) as source:
            image=ImageOps.exif_transpose(source)
            width,height=image.size
            needs_view=max(width,height)>1600 or original_path.stat().st_size>1200000
            if needs_view and (not view_path.exists() or row.get('displayEncodingVersion')!=2):
                display=image.copy();display.thumbnail((2400,2400),Image.Resampling.LANCZOS)
                if display.mode not in ('RGB','RGBA'):display=display.convert('RGBA' if 'transparency' in display.info else 'RGB')
                view_path.parent.mkdir(parents=True,exist_ok=True)
                display.save(view_path,'WEBP',quality=81,method=4)
            if not preview_path.exists() or row.get('displayEncodingVersion')!=2:
                image.thumbnail((1100,1100),Image.Resampling.LANCZOS)
                if image.mode not in ('RGB','RGBA'):image=image.convert('RGBA' if 'transparency' in image.info else 'RGB')
                image.save(preview_path,'WEBP',quality=77,method=4)
        # Browser candidates use real dimensions, without upscaling or cropping.
        # Existing 1100/2400px derivatives remain reusable; small responsive
        # files prevent phones and the thumbnail strip downloading those sizes.
        candidates=[]
        with Image.open(original_path) as source:
            image=ImageOps.exif_transpose(source)
            if image.mode not in ('RGB','RGBA'):image=image.convert('RGBA' if 'transparency' in image.info else 'RGB')
            for edge,quality in [(180,68),(360,73),(720,77),(1800,81)]:
                if edge==1800 and max(width,height)<=1100:continue
                path=PUBLIC/(BASE+'/responsive/'+str(edge)+'/'+identity+'.webp').lstrip('/')
                if not path.exists():
                    display=image.copy();display.thumbnail((edge,edge),Image.Resampling.LANCZOS)
                    path.parent.mkdir(parents=True,exist_ok=True)
                    display.save(path,'WEBP',quality=quality,method=4)
                with Image.open(path) as checked:actual_width,actual_height=checked.size
                candidates.append({'src':'/'+path.relative_to(PUBLIC).as_posix(),'width':actual_width,'height':actual_height,'bytes':path.stat().st_size})
        def candidate(path):
            with Image.open(path) as checked:w,h=checked.size
            return {'src':'/'+path.relative_to(PUBLIC).as_posix(),'width':w,'height':h,'bytes':path.stat().st_size}
        preview=candidate(preview_path)
        wall=sorted({item['width']:item for item in candidates[1:3]}.values(),key=lambda item:item['width'])
        wall=sorted({item['width']:item for item in wall+[preview]}.values(),key=lambda item:item['width'])
        displays=wall+([candidates[-1]] if max(width,height)>1100 else [])+([candidate(view_path)] if needs_view else [])
        displays=sorted({item['width']:item for item in displays}.values(),key=lambda item:item['width'])
        return {**row,'id':identity,'width':width,'height':height,
                'original':BASE+'/originals/'+identity+suffix,'preview':BASE+'/previews/'+identity+'.webp',
                'full':displays[-1]['src'],'thumbnail':candidates[0]['src'],'variants':wall,'displayVariants':displays,'displayEncodingVersion':2,
                'source':original_url,'originalStatus':status,'originalBytes':original_path.stat().st_size,
                'previewBytes':preview_path.stat().st_size,'originalSha256':digest(original_path),'previewSha256':digest(preview_path)}
    except Exception as error:
        return {**row,'id':identity,'importError':type(error).__name__+': '+str(error)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory',default='.local/gallery-inventory/inventory.json')
    parser.add_argument('--restore',action='store_true')
    parser.add_argument('--optimize',action='store_true',help='Add responsive derivatives to the recorded originals and update display metadata')
    args=parser.parse_args()
    if args.restore or args.optimize:
        stored=json.loads((ROOT/'content/gallery-source-manifest.json').read_text())
        rows=stored['photos'];album=stored['album'];albums=stored.get('albums',[album]);aliases=stored['sourceAliases']
    else:
        inventory=json.loads((ROOT/args.inventory).read_text())
        rows=inventory['images'];raw_album=inventory['albums'][0]
        album={'id':'final-ligi-2023','title':raw_album['title'],'year':raw_album['year'],
               'photoIds':[str(x) for x in raw_album['imageIds']],'source':raw_album['sourceUrl']}
        albums=[album]
        recommended=(ROOT/args.inventory).with_name('recommended-albums.json')
        if recommended.exists():
            for item in json.loads(recommended.read_text())[1:]:
                albums.append({'id':item['id'],'title':item['title'],'year':item['year'],
                               'photoIds':[str(x) for x in item['imageIds']],'source':item['sourceUrl']})
        drive_file=(ROOT/args.inventory).with_name('external-drive-album.json')
        if drive_file.exists():
            external=json.loads(drive_file.read_text())
            external_ids=[]
            for item in external['records']:
                identity='drive-'+item['id'];external_ids.append(identity)
                rows.append({'id':identity,'originalUrl':item.get('resolvedDownloadUrl') or item['downloadUrl'],
                             'sourceUrl':item['downloadUrl'],'mimeType':'image/jpeg','uploadYear':item.get('sourceYear','2019'),
                             'title':item['filename'],'caption':'','alt':external['sourcePostTitle']+' Zdjęcie '+str(item['position']),
                             'parentPostId':external['sourcePostId'],'parentPostTitle':external['sourcePostTitle'],'classification':'documentary-photo'})
            albums.append({'id':'miedzy-memorialem-a-walnym','title':external['sourcePostTitle'],'year':'2019',
                           'photoIds':external_ids,'source':external['sourcePostUrl'],'externalSource':external['sourceFolder']})
        media=json.loads((ROOT/args.inventory).with_name('media-all.json').read_text())
        aliases={}
        for item in media:
            aliases[item['source_url']]=str(item['id'])
            for size in item.get('media_details',{}).get('sizes',{}).values():
                if size.get('source_url'):aliases[size['source_url']]=str(item['id'])
    output=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for count,result in enumerate(pool.map(lambda row:prepare_image(row,args.restore or args.optimize),rows),1):
            output.append(result)
            if count%100==0:print('Originals and previews checked:',count,flush=True)
    failures=[x for x in output if x.get('importError')]
    saved=[x for x in output if not x.get('importError')]
    if failures:
        for failure in failures:print('Unavailable',failure['id'],failure['importError'],flush=True)
        print('Import incomplete; authoritative manifests were not changed.',flush=True)
        raise SystemExit(1)
    if args.restore and not args.optimize:
        print('Restored and checked',len(saved),'originals and their display assets; authoritative manifests preserved.',flush=True)
        return
    gallery_ids={identity for group in albums for identity in group['photoIds']}
    public_photos=[]
    for photo in saved:
        in_album=photo['id'] in gallery_ids
        matching_album=next((group for group in albums if photo['id'] in group['photoIds']),album)
        position=matching_album['photoIds'].index(photo['id'])+1 if in_album else None
        caption=photo.get('caption','')
        alt=photo.get('alt','') or caption or (matching_album['title']+' Zdjęcie '+str(position) if in_album else 'Materiał z archiwum SKAUT')
        public_photos.append({'id':photo['id'],'year':photo.get('uploadYear') or photo.get('year',''),
                             'caption':caption,'alt':alt,'title':photo.get('title',''),'width':photo['width'],'height':photo['height'],
                             'preview':photo['preview'],'full':photo['full'],'thumbnail':photo['thumbnail'],
                             'variants':photo['variants'],'displayVariants':photo['displayVariants'],
                             'original':photo['original'],'source':photo['source'],'inAlbum':in_album})
    public_manifest={'schemaVersion':1,'retrieved':'2026-11-07','album':album,'albums':albums,'photos':public_photos}
    source_rows=[]
    for photo in saved:
        keys=['id','source','originalUrl','sourceUrl','uploadYear','year','caption','alt','title','width','height','original','preview','full',
              'thumbnail','variants','displayVariants','displayEncodingVersion','originalStatus','originalSha256','previewSha256','originalBytes','previewBytes','parentPostId','parentPostTitle','classification']
        source_rows.append({key:photo[key] for key in keys if key in photo})
        for url in [photo.get('originalUrl'),photo.get('sourceUrl'),photo.get('source')]:
            if url:aliases[url]=photo['id']
    source_manifest={'schemaVersion':1,'source':'https://ksskaut.pl','retrieved':'2026-11-07','expectedOriginals':len(rows),
                     'album':album,'albums':albums,'photos':source_rows,'sourceAliases':aliases,
                     'failures':[{'id':x['id'],'source':x.get('originalUrl') or x.get('source'),'error':x['importError']} for x in failures]}
    (PUBLIC/'gallery-manifest.json').write_text(json.dumps(public_manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    (ROOT/'content/gallery-source-manifest.json').write_text(json.dumps(source_manifest,ensure_ascii=False,indent=2)+'\n')
    print('Saved originals:',len(saved),'/',len(rows),'; photos in named albums:',sum(p['inAlbum'] for p in public_photos),'; failures:',len(failures),flush=True)
    print('Original bytes:',sum(p['originalBytes'] for p in saved),'Preview bytes:',sum(p['previewBytes'] for p in saved),flush=True)


if __name__=='__main__':main()

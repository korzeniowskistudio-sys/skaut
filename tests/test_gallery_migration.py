import hashlib,importlib.util,json,shutil,subprocess,sys,tempfile,unittest
from pathlib import Path
from PIL import Image

class GalleryRestoreTests(unittest.TestCase):
    def test_responsive_assets_preserve_original_and_avoid_full_original(self):
        spec=importlib.util.spec_from_file_location('gallery_migration',Path(__file__).resolve().parents[1]/'scripts/migrate-gallery.py')
        migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
        with tempfile.TemporaryDirectory() as directory:
            migration.PUBLIC=Path(directory)/'public'
            original=migration.PUBLIC/'assets/gallery/originals/1.jpg';original.parent.mkdir(parents=True)
            Image.effect_noise((1000,800),80).convert('RGB').save(original,quality=98)
            before=original.read_bytes()
            result=migration.prepare_image({'id':'1','source':'https://ksskaut.pl/original.jpg','original':'/assets/gallery/originals/1.jpg','originalSha256':hashlib.sha256(before).hexdigest()},True)
            self.assertNotIn('importError',result)
            self.assertEqual(original.read_bytes(),before)
            self.assertNotEqual(result['full'],result['original'])
            self.assertEqual([x['width'] for x in result['variants']],[360,720,1000])
            self.assertTrue(all(x['width']<=1000 and x['height']<=800 for x in result['displayVariants']))
            self.assertLess(result['variants'][0]['bytes'],len(before)//4)
            with Image.open(migration.PUBLIC/result['thumbnail'].lstrip('/')) as thumbnail:
                self.assertEqual(thumbnail.size,(180,144))

    def test_failed_restore_preserves_authoritative_manifests(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/'scripts').mkdir();(root/'content').mkdir();(root/'public/assets/gallery/originals').mkdir(parents=True)
            shutil.copy(Path(__file__).resolve().parents[1]/'scripts/migrate-gallery.py',root/'scripts/migrate-gallery.py')
            row={'id':'1','source':'https://ksskaut.pl/original.jpg','original':'/assets/gallery/originals/1.jpg','preview':'/assets/gallery/previews/1.webp','originalSha256':hashlib.sha256(b'correct original').hexdigest()}
            source={'photos':[row],'album':{'id':'test','title':'Album','photoIds':['1']},'sourceAliases':{}}
            source_file=root/'content/gallery-source-manifest.json';source_file.write_text(json.dumps(source))
            public_file=root/'public/gallery-manifest.json';public_file.write_text('{"photos":[{"id":"1"}]}')
            (root/'public/assets/gallery/originals/1.jpg').write_bytes(b'corrupt original')
            before=(source_file.read_bytes(),public_file.read_bytes())
            result=subprocess.run([sys.executable,str(root/'scripts/migrate-gallery.py'),'--restore'],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Local original differs from recorded hash',result.stdout)
            self.assertEqual(source_file.read_bytes(),before[0])
            self.assertEqual(public_file.read_bytes(),before[1])

if __name__=='__main__':unittest.main()

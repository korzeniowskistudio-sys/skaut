"""Archive reading uses small local images; originals require an explicit click.

Run with: python3 -m unittest discover -s tests -p 'test_archive_images.py'
The WordPress fixture follows the source archive's lo-ve.png markup, including
its remote responsive sources. No network or generated image files are needed.
"""
import copy
import importlib.util
from html.parser import HTMLParser
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('migrate_content', ROOT / 'scripts/migrate-content.py')
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)

SOURCE = 'https://ksskaut.pl/wp-content/uploads/2025/04/lo-ve.png'
ORIGINAL = '/assets/gallery/originals/8040.png'
PREVIEW = '/assets/gallery/previews/8040.webp'
WORDPRESS = f'''<p><a href="{SOURCE}" rel="nofollow noopener" title="Pełny plakat">
<img loading="lazy" decoding="async" width="940" height="788" src="{SOURCE}" alt="" class="wp-image-8040"
srcset="{SOURCE} 940w, https://ksskaut.pl/wp-content/uploads/2025/04/lo-ve-300x251.png 300w"
sizes="auto, (max-width: 940px) 100vw, 940px" /></a></p>'''


class Elements(HTMLParser):
    def __init__(self, markup):
        super().__init__()
        self.tags = []
        self.feed(markup)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def first(self, name):
        return next(attrs for tag, attrs in self.tags if tag == name)


class ArchiveImageDelivery(unittest.TestCase):
    def setUp(self):
        self.photo = {
            'preview': PREVIEW, 'width': 940, 'height': 788,
            'variants': [
                {'src': '/assets/gallery/responsive/8040-940.webp', 'width': 940, 'height': 788, 'bytes': 31000},
                {'src': '/assets/gallery/responsive/8040-480.webp', 'width': 480, 'height': 402, 'bytes': 11000},
            ],
        }

    def render(self, markup=WORDPRESS, photo=None):
        key = MIGRATION.canonical(SOURCE)
        return MIGRATION.clean(markup, {key: ORIGINAL}, {key: self.photo if photo is None else photo})

    def test_reading_downloads_preview_while_original_stays_explicitly_linked(self):
        result = Elements(self.render())
        image = result.first('img')
        self.assertEqual(image['src'], PREVIEW)
        self.assertEqual(result.first('a')['href'], ORIGINAL)
        self.assertEqual(image['loading'], 'lazy')
        self.assertEqual(image['decoding'], 'async')
        self.assertNotIn('/originals/', image.get('srcset', ''))

    def test_responsive_download_candidates_come_only_from_local_metadata(self):
        photo = copy.deepcopy(self.photo)
        photo['variants'] += [
            {'src': 'https://tracking.example/huge.jpg', 'width': 2000},
            {'src': '/assets/gallery/../originals/huge.jpg', 'width': 3000},
            {'src': '/assets/gallery/ambiguous name.webp', 'width': 4000},
            {'src': '/assets/gallery/invalid.webp', 'width': -1},
        ]
        image = Elements(self.render(photo=photo)).first('img')
        candidates = [entry.strip().split() for entry in image['srcset'].split(',')]
        self.assertEqual({source for source, _ in candidates}, {
            '/assets/gallery/responsive/8040-480.webp', '/assets/gallery/responsive/8040-940.webp',
        })
        self.assertEqual({width for _, width in candidates}, {'480w', '940w'})
        self.assertEqual(image['sizes'], '(max-width: 850px) calc(100vw - 48px), 802px')

    def test_accessible_text_source_dimensions_and_link_relationships_survive(self):
        result = Elements(self.render())
        image, anchor = result.first('img'), result.first('a')
        self.assertEqual(image['alt'], '')
        self.assertEqual((image['width'], image['height']), ('940', '788'))
        self.assertEqual(anchor['title'], 'Pełny plakat')
        self.assertEqual(set(anchor['rel'].split()), {'nofollow', 'noopener'})
        captioned = Elements(self.render(f'<img src="{SOURCE}" alt="Żółć &amp; sport" title="Zdjęcie &quot;1&quot;" width="300" height="251">')).first('img')
        self.assertEqual(captioned['alt'], 'Żółć & sport')
        self.assertEqual(captioned['title'], 'Zdjęcie "1"')
        self.assertEqual((captioned['width'], captioned['height']), ('300', '251'))

    def test_missing_responsive_metadata_still_uses_the_preview(self):
        photo = {key: value for key, value in self.photo.items() if key != 'variants'}
        image = Elements(self.render(photo=photo)).first('img')
        self.assertEqual(image['src'], PREVIEW)
        self.assertNotIn('srcset', image)

    def test_unmapped_images_keep_existing_link_fallback_without_auto_download(self):
        markup = '<img src="/wp-content/uploads/unmapped.jpg" alt="Archiwalne zdjęcie">'
        result = Elements(MIGRATION.clean(markup, {}))
        self.assertFalse(any(tag == 'img' for tag, _ in result.tags))
        self.assertEqual(result.first('a')['href'], 'https://ksskaut.pl/wp-content/uploads/unmapped.jpg')

    def test_untrusted_source_cannot_restore_scripts_or_download_attributes(self):
        markup = f'<script>alert(1)</script><img src="{SOURCE}" onerror="alert(2)" style="display:none" srcset="https://tracking.example/huge.jpg 5000w"><img src="javascript:alert(3)">'
        result = Elements(self.render(markup))
        self.assertFalse(any(tag == 'script' for tag, _ in result.tags))
        images = [attrs for tag, attrs in result.tags if tag == 'img']
        self.assertEqual(len(images), 1)
        self.assertEqual(images[0]['src'], PREVIEW)
        self.assertNotIn('onerror', images[0])
        self.assertNotIn('style', images[0])
        self.assertNotIn('tracking.example', images[0]['srcset'])


if __name__ == '__main__':
    unittest.main()

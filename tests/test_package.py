import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('package_extension', ROOT / 'tools/package_extension.py')
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageTests(unittest.TestCase):
    def test_complete_deterministic_extension_only_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'
            shutil.copytree(ROOT / 'edge-signin-monitor', source)
            (source / 'private.json').write_text('private test fixture')
            output = package.build(source, Path(directory) / 'dist')
            first = output.read_bytes()
            self.assertEqual(package.build(source, output.parent).read_bytes(), first)
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(set(archive.namelist()), {'edge-signin-monitor/' + name for name in package.ASSETS})
                self.assertEqual(archive.read('edge-signin-monitor/manifest.json'), (source / 'manifest.json').read_bytes())

    def test_missing_icon_prevents_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'source'
            shutil.copytree(ROOT / 'edge-signin-monitor', source)
            (source / 'icon.png').unlink()
            with self.assertRaisesRegex(ValueError, 'icon.png'):
                package.build(source, Path(directory) / 'dist')
            self.assertFalse((Path(directory) / 'dist').exists())

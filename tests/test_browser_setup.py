import unittest, tempfile, sys, os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from browser_setup import create_driver
class BrowserSetupTest(unittest.TestCase):
    def test_installed_and_bundled_browser(self):
        service=Mock(); chrome=Mock(return_value='driver')
        modules={'selenium':SimpleNamespace(webdriver=SimpleNamespace(Chrome=chrome)), 'selenium.webdriver.chrome.service':SimpleNamespace(Service=service)}
        with tempfile.TemporaryDirectory() as tmp, patch.dict(sys.modules,modules), patch.dict(os.environ,{},clear=True):
            options=SimpleNamespace()
            self.assertEqual(create_driver(options,tmp),'driver');service.assert_called_with();self.assertFalse(hasattr(options,'binary_location'))
            binary=Path(tmp)/'browser/chrome-win64/chrome.exe';binary.parent.mkdir(parents=True);binary.touch()
            create_driver(options,tmp);self.assertEqual(options.binary_location,str(binary.resolve()))
            with patch.dict(os.environ,{'CHROME_BINARY':str(Path(tmp)/'missing.exe')}):
                with self.assertRaises(FileNotFoundError):create_driver(options,tmp)
if __name__=='__main__':unittest.main()

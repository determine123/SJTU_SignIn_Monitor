"""Use an optional bundled Chrome or let Selenium discover installed Chrome."""
from pathlib import Path
import os

def create_driver(options, root=None):
    from selenium import webdriver
    from selenium.webdriver.chrome.service import Service
    root = Path(root or Path(__file__).resolve().parent)
    explicit = os.environ.get('CHROME_BINARY')
    binary = Path(explicit) if explicit else root / 'browser/chrome-win64/chrome.exe'
    if explicit and not binary.is_file():
        raise FileNotFoundError('CHROME_BINARY does not point to a browser executable')
    if binary.is_file():
        options.binary_location = str(binary.resolve())
    driver = root / 'browser/chromedriver-win64/chromedriver.exe'
    service = Service(str(driver.resolve())) if driver.is_file() else Service()
    return webdriver.Chrome(service=service, options=options)

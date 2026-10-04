"""Build an extension-only ZIP after checking required assets."""
import json
from pathlib import Path
import re
import zipfile

ASSETS = ('manifest.json', 'background.js', 'parser.js', 'content.js', 'schedule.js',
          'popup.html', 'popup.js', 'style.css', 'offscreen.html',
          'offscreen.js', 'icon.png', 'alert.wav', 'README.md')


def build(source, destination):
    source = Path(source)
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    version = manifest['version']
    if not re.fullmatch(r'\d+(?:\.\d+){0,3}', version):
        raise ValueError('Invalid extension version')
    referenced = set(manifest.get('icons', {}).values())
    referenced.update([manifest['background']['service_worker'], manifest['action']['default_popup']])
    icon = manifest['action'].get('default_icon', {})
    referenced.update([icon] if isinstance(icon, str) else icon.values())
    for script in manifest.get('content_scripts', []):
        referenced.update(script.get('js', []) + script.get('css', []))
    for name in ASSETS:
        asset = source / name
        if asset.is_symlink() or not asset.is_file():
            raise ValueError(f'Missing or symlinked asset: {name}')
        if name.endswith('.html'):
            referenced.update(re.findall(r'(?:src|href)="([^"]+)"', asset.read_text(encoding='utf-8')))
    missing = referenced.difference(ASSETS)
    if missing:
        raise ValueError(f'Unpackaged referenced assets: {sorted(missing)}')
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    output = destination / f'sjtu-signin-monitor-{version}.zip'
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(ASSETS):
            info = zipfile.ZipInfo('edge-signin-monitor/' + name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (source / name).read_bytes())
    return output


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    print(build(root / 'edge-signin-monitor', root / 'dist'))

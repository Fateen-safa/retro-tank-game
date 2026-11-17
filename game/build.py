"""Builds a self-contained copy of the game for itch.io (M3-8).

    python game/build.py        (run from the `retro game` folder)

Creates:
  dist/retro-tank-shooter/        index.html at the root, src/, assets/, lib/phaser.min.js
  dist/retro-tank-shooter.zip     upload this to itch.io as an HTML5 game

Phaser 3.80.1 is downloaded once from cdnjs and kept in dist/cache so later builds work offline.
The pixel font still loads from Google Fonts (itch.io pages are online).
"""
import os
import shutil
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = os.path.join(ROOT, 'game')
ASSETS = os.path.join(ROOT, 'TankGame-Assets')
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(DIST, 'retro-tank-shooter')
PHASER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js'
PHASER_CACHE = os.path.join(DIST, 'cache', 'phaser-3.80.1.min.js')


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    # Game code and data
    shutil.copytree(os.path.join(GAME, 'src'), os.path.join(OUT, 'src'))
    # Art: everything except source files
    shutil.copytree(ASSETS, os.path.join(OUT, 'assets'), ignore=shutil.ignore_patterns('*.psd', '*.ase', '*.aseprite', '.DS_Store'))

    # Phaser, vendored
    if not os.path.exists(PHASER_CACHE):
        os.makedirs(os.path.dirname(PHASER_CACHE), exist_ok=True)
        print('Downloading', PHASER_URL)
        urllib.request.urlretrieve(PHASER_URL, PHASER_CACHE)
    os.makedirs(os.path.join(OUT, 'lib'))
    shutil.copy(PHASER_CACHE, os.path.join(OUT, 'lib', 'phaser.min.js'))

    # index.html: local Phaser, local asset folder
    html = open(os.path.join(GAME, 'index.html'), encoding='utf8').read()
    html = html.replace(f'<script src="{PHASER_URL}"></script>',
                        '<script>window.ASSET_BASE = "assets/";</script>\n  <script src="lib/phaser.min.js"></script>')
    assert 'lib/phaser.min.js' in html, 'index.html Phaser tag not found'
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf8').write(html)

    # Zip with index.html at the top level, as itch.io expects
    zpath = os.path.join(DIST, 'retro-tank-shooter.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for folder, _, files in os.walk(OUT):
            for f in files:
                full = os.path.join(folder, f)
                z.write(full, os.path.relpath(full, OUT))
    size = os.path.getsize(zpath) / 1e6
    print(f'Built {OUT}\nZip: {zpath} ({size:.1f} MB)')


if __name__ == '__main__':
    main()

import os, sys, shutil, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESKTOP_DIR = os.path.join(ROOT, 'apps', 'desktop')
DESKEOP_GAMES = os.path.join(DESKTOP_DIR, 'games')
HEKUGO_DESKTOP = os.path.join(ROOT, 'hekugo.online', 'unplug-desktop')
HEKUGO_GAMES = os.path.join(HEKUGO_DESKTOP, 'games')
SRC_GAMES = os.path.join(ROOT, 'apps', 'android', 'www', 'games')

os.makedirs(DESKTOP_GAMES, exist_ok=True)
os.makedirs(HEKUGO_GAMES, exist_ok=True)

for g in ['bounce.html', 'snake.html', 'memory.html', 'space_dodge.html']:
    src = os.path.join(SRC_GAMES, g)
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(DESKTOP_GAMES, g))
        shutil.copyfile(src, os.path.join(HEKUGO_GAMES, g))
print('Games synced.')

"""Download the official SDK command-line tools into the approved temporary area.

This does not accept SDK licenses or modify the user's installed Java/Android tools.
"""
from pathlib import Path
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

destination = Path(r'C:\Users\jai18\AppData\Local\Temp\opencode\android-sdk')
metadata = urllib.request.urlopen('https://dl.google.com/android/repository/repository2-1.xml', timeout=45).read()
root = ET.fromstring(metadata)
package = next(p for p in root if p.tag.endswith('remotePackage') and p.attrib.get('path') == 'cmdline-tools;latest')
archive = next(a for a in package.find('archives') if a.findtext('host-os') == 'windows')
complete = archive.find('complete')
name = complete.findtext('url')
expected = complete.findtext('checksum')
destination.mkdir(parents=True, exist_ok=True)
target = destination / name
if not target.exists():
    urllib.request.urlretrieve('https://dl.google.com/android/repository/' + name, target)
if hashlib.sha1(target.read_bytes()).hexdigest() != expected:
    raise SystemExit('Official SDK download checksum mismatch.')
with zipfile.ZipFile(target) as package:
    for member in package.infolist():
        relative = Path(member.filename)
        if relative.is_absolute() or '..' in relative.parts:
            raise SystemExit('Unexpected archive path.')
    package.extractall(destination / 'cmdline-tools' / 'latest')
print(destination / 'cmdline-tools' / 'latest' / 'cmdline-tools' / 'bin' / 'sdkmanager.bat')
print('SDK command-line tools downloaded and verified; package licenses still require acceptance.')

from pathlib import Path
import struct
import zlib

root = Path(__file__).resolve().parent.parent
def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
for size in (192, 512):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            u = ((.27*size < x < .38*size or .62*size < x < .73*size) and .25*size < y < .68*size) or (.27*size < x < .73*size and .62*size < y < .75*size)
            rows.extend((255,255,255) if u else (54,89,217))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB',size,size,8,2,0,0,0)) + chunk(b'IDAT',zlib.compress(bytes(rows))) + chunk(b'IEND',b'')
    (root / 'web' / f'icon-{size}.png').write_bytes(data)
print('Generated real 192px and 512px PNG icons.')

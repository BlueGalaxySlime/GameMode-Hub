#!/usr/bin/env python3
"""Generate a brand-neutral SteamHub app icon with Python stdlib only."""
import os
from pathlib import Path
import struct
import zlib

SIZE=256
def rgba(x,y):
    # navy background with a bright blue left navigation and three modules
    r,g,b=16,26,42
    if 22<=x<234 and 22<=y<234:
        r,g,b=31,47,67
    if 39<=x<93 and 43<=y<212:
        r,g,b=(18,111,170) if 82<=y<127 else (52,74,102)
    if 108<=x<217 and 50<=y<88:
        r,g,b=56,120,173
    if 108<=x<217 and 104<=y<141:
        r,g,b=57,74,104
    if 108<=x<217 and 158<=y<198:
        r,g,b=57,74,104
    return bytes((r,g,b,255))
def chunk(kind,data):
    return struct.pack("!I",len(data))+kind+data+struct.pack("!I",zlib.crc32(kind+data)&0xffffffff)
raw=b"".join(b"\0"+b"".join(rgba(x,y) for x in range(SIZE)) for y in range(SIZE))
png=b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack("!2I5B",SIZE,SIZE,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")
output=Path(__file__).resolve().parent.parent/"build"/"icon.png"
output.parent.mkdir(parents=True,exist_ok=True)
output.write_bytes(png)
print(output)

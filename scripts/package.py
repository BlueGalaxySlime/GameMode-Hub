#!/usr/bin/env python3
"""Package compiled Decky plugin as a versioned SteamHub release."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = ROOT / "release" / "SteamHub.zip"

if not DIST.is_dir() or not any(DIST.rglob("*.js")):
    raise SystemExit("Missing compiled frontend in dist/. Run npm run build first.")

files = [ROOT / "plugin.json", ROOT / "main.py", ROOT / "hub_settings.py", ROOT / "package.json", ROOT / "THIRD_PARTY_NOTICES.md", ROOT / "LICENSE"]
files += sorted(path for path in DIST.rglob("*") if path.is_file())
for path in files:
    if not path.is_file():
        raise SystemExit(f"Missing required file: {path}")

OUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUT, "w", ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, arcname=str(Path("SteamHub") / path.relative_to(ROOT)))
print(f"Created {OUT} ({len(files)} files)")

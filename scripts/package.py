#!/usr/bin/env python3
"""Package only the lightweight Quick Access adapter; not the desktop app."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import json

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PLUGIN = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))["name"]
assert PLUGIN == "GameMode Hub", "Plugin identity drift"
OUT = ROOT / "release" / "GameMode-Hub.zip"

if not DIST.is_dir() or not any(DIST.rglob("*.js")):
    raise SystemExit("Missing compiled frontend in dist/. Run npm run build first.")

files = [ROOT / name for name in (
    "plugin.json", "main.py", "hub_settings.py", "release_catalog.py", "file_manager.py", "desktop_apps.py", "trash_manager.py", "package.json",
    "THIRD_PARTY_NOTICES.md", "LICENSE"
)]
files += sorted(path for path in DIST.rglob("*") if path.is_file())
for file in files:
    if not file.is_file():
        raise SystemExit(f"Missing required file: {file}")

# The PTY implementation stays in source for later research, but is NOT
# included in the plugin while terminal startup remains disabled.
OUT.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(OUT, "w", ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, arcname=str(Path(PLUGIN) / file.relative_to(ROOT)))
print(f"Created {OUT} ({len(files)} files)")

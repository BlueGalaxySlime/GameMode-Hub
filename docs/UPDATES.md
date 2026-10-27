# Installing and updating SteamOS-Hub

## Current state (0.1.0 preview)

The plugin can **check** the latest published GitHub Release using a read-only HTTPS request. It does **not** download, execute, or install updates. Version comparisons in this preview are informational; they are not a semantic-version resolver.

The plugin must first be built (`npm install && npm run build`) and packaged as a Decky-compatible ZIP containing the plugin files and `dist/`. **The source checkout alone is not an installable release.** The plugin has not yet been tested on Legion Go S.

## Goal: install once, update later

Prefer Decky Loader's supported plugin update flow once SteamOS-Hub is eligible and published in its plugin catalog. Until then, installation and upgrades from manually published releases may require extra steps. Do not promise unattended updates.

## Security

- Never execute downloaded scripts from a release feed.
- Do not run the plugin as root by default.
- Before adding one-click updates, design signed or hash-verified release artifacts, atomic replacement, rollback, and explicit user confirmation.
- GitHub Releases are not an automatic trust boundary.

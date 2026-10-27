# SteamHub updates (experimental 0.2.0)

The Gaming Mode panel has two explicit actions: **Sprawdź aktualizacje** and **Aktualizuj**. It never updates in the background.

The check reads the latest *published* GitHub Release from BlueGalaxySlime/SteamOS-Hub. The update button is enabled only for a newer semantic-version tag with an asset named `SteamHub.zip` and a SHA-256 digest provided by the GitHub Releases API.

The update action calls Decky Loader's internal `utilities/install_plugin` endpoint with the release URL, plugin name `SteamHub`, version, hash and update operation (2). Decky Loader performs the privileged install; SteamHub's Python backend remains unprivileged. This internal endpoint is **not a stable public API**. If unavailable, the plugin reports a manual Decky URL-install fallback rather than attempting to modify the plugin directory.

## Publishing a version

1. Review and merge the feature branch to `main` after CI succeeds.
2. Create and push a `v0.2.0` tag pointing at the reviewed version.
3. The tagged GitHub Actions workflow builds and publishes a GitHub Release with `SteamHub.zip`.
4. Confirm the published release has a SHA-256 asset digest and verify installation on Lenovo Legion Go S.

**Do not tag or publish untested changes automatically.** GitHub Actions preview artifacts are not GitHub Releases and cannot be used by the in-plugin update check.

## Compatibility and migration

Earlier preview ZIPs installed the plugin as `SteamOS-Hub`, whereas version 0.2.0 uses `SteamHub` as its Decky identity and ZIP root folder. This is a **plugin identity migration**, not an in-place upgrade. The older preview may require one manual uninstall and a one-time installation of SteamHub before the update button can be used.

The update flow is implemented but **not yet validated on physical hardware**. Decky Loader's internal installer may change. No custom root updater, downloaded script execution, or unattended update is used.

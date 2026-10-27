# SteamHub

SteamHub is an experimental Decky Loader plugin for SteamOS Gaming Mode. Repository: SteamOS-Hub.

## Installation — important

**Do not use GitHub's green Code → Download ZIP button.** That downloads source code and cannot be installed as a Decky plugin.

The installable ZIP is named **SteamHub.zip** and must contain a top-level `SteamHub/` folder with `plugin.json`, `main.py`, and `dist/index.js`.

- **Preview builds:** open [Actions](../../actions/workflows/build.yml), choose a successful run on `main`, and download the `SteamHub-preview` artifact. GitHub wraps the actual `SteamHub.zip` in an artifact ZIP; extract the outer artifact and use the inner `SteamHub.zip`.
- **Published releases:** use [Releases](../../releases) when an actual versioned release is available. Do not assume a release exists yet.

On the device, open Decky Loader → Settings → General → Developer Mode, then Developer → Install Plugin from ZIP File and select the actual `SteamHub.zip`.

**Status:** experimental; the install/update flow has not been validated on Lenovo Legion Go S. The in-plugin update button uses an internal Decky API and may be incompatible with some Decky versions. No automatic background updates.

See [installation notes](docs/INSTALL.md) and [update limitations](docs/UPDATES.md).

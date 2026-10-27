# SteamOS-Hub preview — build and installation

## Status

This is a development preview, **not yet validated on Lenovo Legion Go S**. No production installer or automatic updater is included. The Decky UI currently only displays planned modules and checks GitHub Releases for updates.

## GitHub Actions build

On push, pull request, or manual dispatch, the `Build SteamOS-Hub preview` workflow runs a TypeScript typecheck, builds the frontend, checks Python syntax, and creates a ZIP artifact called `SteamOS-Hub-preview`.

The ZIP contains a top-level `SteamOS-Hub/` directory with `plugin.json`, `main.py` and compiled `dist/` assets. It does not contain node_modules, credentials or third-party modules.

## Installing on Decky Loader (after build verification)

Decky Loader must already be installed. Obtain the ZIP from the GitHub Actions artifact of a successful run. Decky Loader's developer/manual installation options vary by version; do not assume the preview ZIP is accepted by all versions. If manual ZIP installation is not available, use Decky's documented development installation flow. Test on a device before publishing a user-facing release.

## Updating

The plugin's **Check updates** button only queries GitHub Releases. It does not install updates. The long-term preferred upgrade route is Decky Loader's supported plugin updater once accepted into its store. For manual preview installs, updates may require manual replacement until a verified upgrade path is implemented.

Do not run arbitrary shell installers or execute ZIP contents with elevated privileges.

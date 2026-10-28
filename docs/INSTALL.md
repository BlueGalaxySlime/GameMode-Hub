# Instalacja SteamHub

## SteamOS — jeden pakiet, graficzna instalacja

1. Wejdź do **trybu pulpitu** SteamOS.
2. Pobierz `SteamHub-0.5.0-x86_64.flatpak` z [GitHub Releases](https://github.com/BlueGalaxySlime/SteamOS-Hub/releases/latest), z sekcji **Assets**.
3. Otwórz pobrany plik w **KDE Discover** i zatwierdź instalację. System może pobrać wymagane środowisko Flatpak.
4. Uruchom SteamHub z menu aplikacji KDE.

Instalacja nie wymaga Decky Loader, `sudo`, terminala ani rozpakowywania archiwów. Ze względów bezpieczeństwa system może wymagać zatwierdzenia pakietu.

**Gaming Mode:** na tym etapie SteamHub nie dodaje się sam do biblioteki Steam. W trybie pulpitu można dodać go do Steam jako grę spoza Steam, aby potem uruchamiać z Gaming Mode.

**Aktualizacje:** lokalny pakiet Flatpak nie jest jeszcze podłączony do Flathub ani do repozytorium Flatpak. Nowsze instalatory będą dostępne w GitHub Releases.

## AppImage

Pobierz `SteamHub-0.5.0-x86_64.AppImage`. Zaznacz wykonywanie pliku we właściwościach Dolphin, jeśli system tego wymaga, i uruchom. W SteamHub otwórz **Ustawienia → Zainstaluj SteamHub**. Aplikacja skopiuje plik do `~/.local/share/SteamHub/SteamHub.AppImage` i doda wpis w `~/.local/share/applications/` bez uprawnień administratora.

AppImage może wymagać FUSE, dlatego **na SteamOS polecamy Flatpak**.

## Opcjonalna wtyczka Decky

`SteamHub.zip` jest odrębną wtyczką i wymaga Decky Loader. Nie jest potrzebna do korzystania z samodzielnej aplikacji Linux.

## Stan funkcji

Menedżer plików jest tylko do odczytu; terminal jest celowo nieaktywny ze względu na wcześniej zaobserwowane restarty Gaming Mode. Samodzielny Hub nie zarządza jeszcze instalacją zewnętrznych dodatków.

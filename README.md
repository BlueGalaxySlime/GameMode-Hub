# SteamHub — niezależna aplikacja Linux

**SteamHub** działa bez Decky Loader i bez uruchomionego Steam. Starsza wtyczka Decky pozostaje opcjonalna.

## Instalacja na SteamOS

1. W trybie pulpitu pobierz `SteamHub-0.5.0-x86_64.flatpak` z [GitHub Releases](https://github.com/BlueGalaxySlime/SteamOS-Hub/releases/latest).
2. Otwórz pobrany plik w **KDE Discover** i potwierdź instalację.
3. Uruchom SteamHub z menu aplikacji KDE.

**Nie trzeba instalować Decky, rozpakowywać plików, używać terminala ani `sudo`.** Nie omijamy systemowego potwierdzenia instalacji.

Aby uruchamiać Hub z **Gaming Mode**, na razie dodaj aplikację do Steam jako program spoza Steam. Automatyczne tworzenie skrótu w bibliotece Steam nie jest jeszcze dostępne.

## AppImage — dla innych dystrybucji

Pobierz `SteamHub-0.5.0-x86_64.AppImage`. Jeżeli to konieczne, w Dolphin ustaw prawo do uruchamiania pliku i otwórz go. W aplikacji wybierz **Ustawienia → Zainstaluj SteamHub**. Program kopiuje się do katalogu użytkownika i tworzy skrót w menu, bez uprawnień administratora.

## Aktualny stan

- Samodzielny interfejs w stylu ustawień SteamOS, z obsługą kontrolera.
- Rozpoznawanie dystrybucji Linux i sposobu uruchomienia.
- Menedżer plików ograniczony do katalogu domowego — obecnie **tylko odczyt**.
- Sekcje konfiguracji, aktualizacji i podziękowań.
- Streaming, Biblioteki i Aplikacje są miejscami na przyszłe integracje.
- **Terminal pozostaje wyłączony**, ponieważ przyczyna wcześniejszych restartów Gaming Mode nie została jeszcze ustalona.

Nie deklarujemy jeszcze automatycznego aktualizowania Flatpaka ani automatycznej integracji z biblioteką Steam. Instalacja i obsługa na Legion Go S wymagają potwierdzenia na urządzeniu.

## Wtyczka Decky (opcjonalna)

Plik `SteamHub.zip` w tym samym wydaniu to **starsza wtyczka Decky**, a nie instalator samodzielnego Huba. Jej terminal pozostaje w trybie bezpiecznym.

[Instrukcje](docs/INSTALL.md) · [Architektura](docs/ARCHITECTURE.md) · [Podziękowania i licencje](THIRD_PARTY_NOTICES.md)

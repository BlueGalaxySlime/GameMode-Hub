# GameMode Hub

**GameMode Hub** to lekki panel rozszerzeń do **SteamOS Gaming Mode**, otwierany z menu **Quick Access (⋯)**. Nie jest osobnym launcherem ani zamiennikiem Steam w domyślnym trybie.

## Instalacja na SteamOS — GameMode Hub 0.5.2

1. Jeśli masz starą wtyczkę **SteamHub**, usuń ją w Decky. Nazwa identyfikatora wtyczki uległa zmianie.
2. Pobierz **[GameMode-Hub.zip](https://github.com/BlueGalaxySlime/GameMode-Hub/releases/latest)** z *Releases → Assets*. Nie rozpakowuj archiwum.
3. W Gaming Mode otwórz Decky Loader → ustawienia deweloperskie i zainstaluj wtyczkę z ZIP. Szczegóły: [instrukcja](docs/INSTALL.md).
4. Naciśnij przycisk **⋯**, otwórz **GameMode Hub**, wybierz **Otwórz GameMode Hub**. Zostaniesz w interfejsie SteamOS.

**Kanały aktualizacji:** Testowy (bieżące wydania i możliwość downgrade’u) oraz Stabilny (pusty, dopóki nie zweryfikujemy wydania na urządzeniu). Wersję wybierzesz w zakładce Aktualizacje.

**Wymagany jest Decky Loader tylko jako adapter do Quick Access.** Valve nie udostępnia stabilnego publicznego interfejsu wtyczek do Quick Access. Nie modyfikujemy plików Steam ani nie wstrzykujemy własnych procesów do klienta Steam poza adapterem Decky.

## Architektura

- `src/core/` — nazwa, manifest funkcji i podstawowe reguły **bez** importów ze Steam/Decky.
- `src/hub/` i `src/index.tsx` — obecny adapter SteamOS/Decky (nawigacja i obsługa kontrolera).
- `main.py` i `hub_settings.py` — proste usługi ustawień/aktualizacji; brak wymaganego uprawnienia root.
- `terminal_core/` — zachowany do dalszych badań niezależny silnik PTY, **nie jest dołączany do instalatora**.
- `desktop/` — wcześniejszy eksperyment z Electronem, **nie jest już budowany ani publikowany**. Opcjonalny niezależny launcher pozostaje osobnym przyszłym etapem.

**Terminal jest tymczasowo wyłączony** ze względu na wcześniejsze restarty interfejsu Steam na Legion Go S. Nie uruchamia procesów po otwarciu panelu. Nie ma jeszcze niezależnego zamiennika Quick Access bez Decky — to cel długoterminowy.

## Pobieranie

[Wydania GameMode Hub](https://github.com/BlueGalaxySlime/GameMode-Hub/releases) · [Plan rozwoju](docs/ROADMAP.md) · [Licencje i podziękowania](THIRD_PARTY_NOTICES.md)

# GameMode Hub

**GameMode Hub** to lekki panel rozszerzeń do **SteamOS Gaming Mode**, otwierany z menu **Quick Access (⋯)**. Nie jest osobnym launcherem ani zamiennikiem Steam w domyślnym trybie.

## Instalacja na SteamOS — GameMode Hub 0.5.6

1. Jeśli masz starą wtyczkę **SteamHub**, usuń ją w Decky. Nazwa identyfikatora wtyczki uległa zmianie.
2. Pobierz **[GameMode-Hub.zip](https://github.com/BlueGalaxySlime/GameMode-Hub/releases/download/v0.5.6/GameMode-Hub.zip)** z wydania 0.5.6. Nie rozpakowuj archiwum.
3. W Gaming Mode otwórz Decky Loader → ustawienia deweloperskie i zainstaluj wtyczkę z ZIP. Szczegóły: [instrukcja](docs/INSTALL.md).
4. Naciśnij przycisk **⋯**, otwórz **GameMode Hub**, wybierz **Otwórz GameMode Hub**. Zostaniesz w interfejsie SteamOS.

**Kanały aktualizacji:** Testowy (bieżące wydania i możliwość downgrade’u) oraz Stabilny (pusty, dopóki nie zweryfikujemy wydania na urządzeniu). Numery wydań nie mają dopisków o kanale — oznaczenie kanału jest metadanymi wydania GitHub. Wersję wybierzesz w zakładce Aktualizacje.

**Wymagany jest Decky Loader tylko jako adapter do Quick Access.** Valve nie udostępnia stabilnego publicznego interfejsu wtyczek do Quick Access. Nie modyfikujemy plików Steam ani nie wstrzykujemy własnych procesów do klienta Steam poza adapterem Decky.

## Pliki

W Quick Access → GameMode Hub → **Pliki** dostępne jest przeglądanie katalogu domowego i podłączonych nośników użytkownika. Możesz tworzyć foldery, zmieniać nazwy i kopiować/przenosić pliki; usuwanie pozostaje wyłączone, dopóki nie dodamy bezpiecznego kosza. Systemowe katalogi są niedostępne.

## Architektura

- `src/core/` — nazwa, manifest funkcji i podstawowe reguły **bez** importów ze Steam/Decky.
- `src/hub/` i `src/index.tsx` — obecny adapter SteamOS/Decky (nawigacja i obsługa kontrolera).
- `main.py` i `hub_settings.py` — proste usługi ustawień/aktualizacji; brak wymaganego uprawnienia root.
- `terminal_core/` — zachowany do dalszych badań niezależny silnik PTY, **nie jest dołączany do instalatora**.
- `desktop/` — wcześniejszy eksperyment z Electronem, **nie jest już budowany ani publikowany**. Opcjonalny niezależny launcher pozostaje osobnym przyszłym etapem.

**Terminal jest tymczasowo wyłączony** ze względu na wcześniejsze restarty interfejsu Steam na Legion Go S. Nie uruchamia procesów po otwarciu panelu. Nie ma jeszcze niezależnego zamiennika Quick Access bez Decky — to cel długoterminowy.

## Aktualizator nie widzi nowej wersji w 0.5.2?

W 0.5.2 była błędna metoda sprawdzania: GitHub `/releases/latest` pomija wydania testowe. Wymagana jest **jednorazowa ręczna aktualizacja**, bez usuwania Decky: [instrukcja](docs/UPDATES.md).

## Pobieranie

[Wydania GameMode Hub](https://github.com/BlueGalaxySlime/GameMode-Hub/releases) · [Plan rozwoju](docs/ROADMAP.md) · [Licencje i podziękowania](THIRD_PARTY_NOTICES.md)

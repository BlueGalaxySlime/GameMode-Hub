# GameMode Hub — kanały i wybór wersji

## Ważne: migracja z 0.5.2 (jednorazowa)

Wersja 0.5.2 pobiera `/releases/latest`, który **pomija GitHub prerelease**.
Dlatego pokazuje "aktualna" mimo że istnieją nowsze wersje testowe. Nie da się naprawić
już zainstalowanego kodu zdalnie bez wydania stabilnego, a kanał Stabilny celowo pozostaje pusty.

Aby naprawić aktualizator, **zainstaluj ręcznie z Decky → Developer → Install Plugin from URL**
bez odinstalowywania GameMode Hub:

`https://github.com/BlueGalaxySlime/GameMode-Hub/releases/download/v0.5.6/GameMode-Hub.zip`

Można również pobrać ZIP i użyć **Install Plugin from ZIP File**.
Po instalacji sprawdź w GameMode Hub → Aktualizacje, czy wersja to **0.5.6**.
Kolejne wydania testowe wykrywa już nowy mechanizm listy wydań.



## Testowy (domyślny)
- Wydania mają wyłącznie numer `vX.Y.Z`, bez nazw i dopisków takich jak `-test`. O kanale decyduje status **prerelease** w GitHub Releases.
- Starsze, już opublikowane tagi z dopiskiem `-test.N` pozostają w historii, aby zachować możliwość powrotu.
- Awaryjnie dostępna także archiwalna wersja `v0.5.2` (pierwsza z tożsamością GameMode Hub), aby można było się cofnąć.
- Zmiany są eksperymentalne, nawet gdy testy CI przejdą pomyślnie.

## Stabilny (na razie pusty)
- Dopiero przyszłe wydania `v0.6.0` lub nowsze, bez oznaczenia `prerelease`, które przeszły osobną weryfikację na urządzeniu.
- Poprzednie wydania `v0.5.0` i `v0.5.2` nigdy nie były zweryfikowane jako stabilne i nie są pokazywane w kanale Stabilnym.
- GitHub Actions publikuje aktualne numery wersji tylko z flagą `--prerelease`; **nigdy nie publikuje automatycznie wydania Stabilnego**.

## Działanie aktualizatora
1. Ustaw kanał. Wybór jest zapisywany w `~/.config/gamemodehub/update_channel.json`.
2. Kliknij **Sprawdź wersje**. Jedno zapytanie do GitHub `releases?per_page=50` (najnowsze 50); bez monitorowania w tle.
3. Wybierz jedną z dostępnych wersji; aktualizator rozpoznaje `Aktualizacja` lub `Downgrade` na podstawie porównania semver.
4. Dla downgrade'u wymagane jest dodatkowe potwierdzenie w panelu. Kliknięcie końcowe pokazuje też standardowe okno zatwierdzenia Decky Loader.
5. Kontrolujemy zgodność nazwy ZIP, ścisły adres repozytorium/tagu oraz sumę SHA-256 z API GitHub. Decky wykonuje instalację i weryfikuje sumę.
6. Operacja `UPDATE=2` lub `DOWNGRADE=3` korzysta z wewnętrznego interfejsu Decky `utilities/install_plugin`, który może się zmienić po aktualizacji Decky.

Jeśli interfejs Decky odmówi instalacji starszej wersji, pobierz ręcznie `GameMode-Hub.zip` z konkretnego wydania na GitHub i skorzystaj z instalacji deweloperskiej ZIP. Nigdy nie uruchamiamy własnych uprzywilejowanych skryptów instalacyjnych.

**Uwaga:** cofnięcie kodu nie cofa automatycznie danych ustawień ani konfiguracji modułów.

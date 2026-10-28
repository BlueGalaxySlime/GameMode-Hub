# SteamHub 0.3.1

## Poprawka Tab Managera

- **TabMaster zainstalowany, lecz wyłączony w Decky, nie blokuje Tab Managera.**
- Sprawdzanie konfliktu korzysta z listy aktualnie załadowanych wtyczek Decky, nie z folderu instalacyjnego.
- Gdy TabMaster jest uruchomiony, wstrzymujemy integrację jego zakładek, nie zmieniając żadnych ustawień ani plików drugiej wtyczki.
- Gdy stan Decky Loader nie jest dostępny, pokazujemy jasny komunikat i przycisk ponownego sprawdzenia.
- Testy sprawdzają przypadki: TabMaster aktywny, wyłączony, nieobecny oraz niedostępny loader.

Wersja 0.3.1 zachowuje numerację zgodną z mechanizmem aktualizacji SteamHub.

Tab Manager wciąż korzysta z nieoficjalnego interfejsu biblioteki SteamOS; integracja pozostaje do zweryfikowania na urządzeniu.

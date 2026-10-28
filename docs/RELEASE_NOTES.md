# SteamHub 0.3.2

## Sprawdzanie aktualizacji

- Naprawiono sytuację, w której przycisk **„Sprawdź aktualizacje”** pozostawał bez końca w stanie **„Czekaj…”**.
- Po przekroczeniu czasu oczekiwania SteamHub wyświetla komunikat i ponownie odblokowuje przycisk.
- Dodano limit czasu także po stronie backendu, aby brak odpowiedzi GitHub nie blokował modułu.
- Zachowano zwykłą numerację wydań i dotychczasowy mechanizm instalowania aktualizacji.
- Dodano testy prawidłowej odpowiedzi, błędu oraz braku odpowiedzi usługi.

Dotychczas zablokowana wersja może wymagać jednorazowej ręcznej instalacji
`SteamHub.zip` z tego wydania przez Decky Loader. Kolejne wersje można
sprawdzać z poziomu SteamHub.

Tab Manager pozostaje oddzielnym modułem. Ta aktualizacja nie zmienia jego
ustawień ani zakładek.

# GameMode Hub — sklepy i niezależne adaptery (od 0.5.65)

## Cel
Nie przełączamy launcherów (Steam / Heroic / Unifideck). GameMode Hub
docelowo pokazuje **sklepy**, a osobne adaptery podłączają ich konta, katalog,
bibliotekę, pobieranie, instalowanie i uruchamianie. Każda funkcja jest
deklarowana oddzielnie: brak obsługi nie może wyglądać jak działający przycisk.

| Sklep | Konto | Biblioteka | Sklep WWW | Instalacja |
| --- | --- | --- | --- | --- |
| GOG | jawne powiązanie istniejącej sesji Unifideck (test) | tylko odczyt na żądanie (test) | docelowo GOG.com w Gaming Mode | przyszłość |
| Epic | tylko tymczasowe logowanie przez zewnętrzny program | nie | docelowo Epic Games Store | przyszłość |
| Steam | istniejące konto SteamOS | Steam Gaming Mode (bez własnych tokenów Huba) | natywna strona Steam | Steam |

To nie są oficjalne integracje sklepów; nazwa sklepu oznacza pochodzenie
biblioteki, nie autoryzację przez jego właściciela. W przyszłości firmy
mogą publikować własne moduły w otwartym API, niezależne od Huba.

## GOG — powiązanie z Unifideck

Moduł **Konta i sklepy → GOG** sprawdza wyłącznie znany, lokalny plik
`~/.config/unifideck/gog_token.json`. Nie otwiera Unifideck, nie tworzy
nowej przeglądarki ani nie przechwytuje OAuth. Plik musi być zwykłym,
zaszyfrowanym plikiem `UFD1`, prywatnym dla tego samego użytkownika.
Nie obsługujemy starego tokenu w jawnym JSON, symlinków ani dowolnych
ścieżek dostarczanych przez UI.

**Importuj połączenie** oznacza tutaj wyraźne powiązanie z *istniejącą*
sesją w Unifideck. Po kliknięciu Hub odszyfrowuje ją w pamięci za pomocą
własnej biblioteki `cryptography` (AES-GCM i scrypt jak w Unifideck),
weryfikuje strukturę i zapisuje tylko lokalną zgodę
`{"gog":"unifideck-readonly"}` z uprawnieniami `0600`.
Nie kopiuje tokenu, hasła ani pliku sesji do konfiguracji Huba.

Przycisk **Wczytaj gry** odczytuje najnowszy access token z zaszyfrowanego
pliku i odpytuje po HTTPS `embed.gog.com/account/getFilteredProducts`
z ograniczeniem stron, rozmiaru i czasu. Nie zwraca tokenów do frontend,
nie aktualizuje sesji, nie usuwa ani nie instaluje gier. W przypadku
błędu HTTP 401/403 pokazuje potrzebę odświeżenia sesji w Unifideck;
nie pokazuje zera posiadanych gier jako sukcesu.

**Odłącz GOG** usuwa wyłącznie lokalną zgodę Huba i pozostawia konto,
pliki i sesje Unifideck bez zmian. Powiązanie będzie niedostępne po
usunięciu Unifideck lub jego pliku sesji. To jeszcze nie jest niezależny
magazyn poświadczeń i nie oznacza używania KWallet.

## Kolejny etap

Oddzielny, stabilny StoreAdapter z jasno określonymi uprawnieniami
i podpisanym manifestem sklepu: logowanie, katalog, własna biblioteka,
instalacja i aktualizacja w kolejce Pobierania oraz uruchamianie przez
Steam Input/Proton. Własne moduły sklepów powinny rozszerzać funkcje,
a nie zmuszać użytkownika do zmiany aplikacji uruchamiającej.

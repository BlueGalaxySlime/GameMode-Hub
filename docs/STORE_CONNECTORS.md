# GameMode Hub — sklepy i adaptery (0.5.66)

## Zasada
GameMode Hub docelowo pokazuje *sklepy*, a nie listę zewnętrznych launcherów.
Steam, GOG i Epic mogą mieć oddzielne moduły biblioteki, strony sklepu,
instalacji i uruchamiania bez zamiany całego programu uruchamiającego.
Obecne adaptery są społecznościowe, nie są oficjalnymi klientami tych sklepów.

## GOG — niezależne logowanie (wersja testowa)
1. W **Konta i sklepy → GOG** wybierz sposób przechowywania sesji: „Tymczasowa”
   (domyślne, RAM) albo „Sejf systemowy” (wymaga aktywnego i odblokowanego
   Secret Service / KWallet, bez prawa do obejścia blokady).
2. Kliknij **Zaloguj**. Hub przygotuje jednorazowy adres OAuth GOG Galaxy i
   spróbuje otworzyć oficjalną domenę `auth.gog.com`. Gdy SteamOS nie otworzy
   przeglądarki, wybierz **Kopiuj adres logowania** i otwórz go w przeglądarce.
3. Wprowadź hasło i ewentualny kod 2FA *wyłącznie w witrynie GOG*.
4. Po przekierowaniu skopiuj **pełny adres strony powrotu** zaczynający się od
   `https://embed.gog.com/on_login_success` albo
   `https://www.gog.com/on_login_success`, wklej w Hubie i wybierz **Połącz konto**.
5. Wybierz **Wczytaj gry**. Hub pobierze wyłącznie informacje o posiadanych
   tytułach; instalacja, aktualizacje i uruchamianie są następnym etapem.

Sam kod autoryzacyjny i tokeny nie są zapisywane w ustawieniach. Backend
sprawdza HTTPS i domenę przekierowania oraz odrzuca nieaktualne lub
powtórnie wykorzystane próby. Token trafia tylko do pamięci backendu albo
— na wyraźne życzenie i jeśli jest dostępny — do systemowego sejfu.
Zasada bezpieczeństwa: żadnego pliku z hasłami ani tokenami w jawnym JSON.

GOG Galaxy OAuth wykorzystuje powszechnie używane przez społecznościowe
klienty parametry. Nie jest to oficjalna integracja GOG dla GameMode Hub.
Nie implementowaliśmy automatycznego przechwytywania adresu przekierowania;
logowanie w Gaming Mode wymaga sprawdzenia z dostępną przeglądarką.

## Unifideck
Stary, wyłącznie odczytowy adapter z wersji 0.5.65 pozostaje w kodzie do
zgodności wstecznej, lecz **Konta i sklepy → GOG** nie używa go już w interfejsie.
Dezaktywowanie Unifideck nie blokuje rozpoczęcia nowej sesji GOG w Hubie.
Hub nie wylogowuje ani nie modyfikuje sesji Unifideck.

## Pozostałe sklepy
- **Epic Games:** na razie prowizoryczne otwieranie już zainstalowanego programu.
- **Steam:** natywne konto, biblioteka i sklep SteamOS, bez własnego tokenu Huba.
- **Przyszłe moduły:** osobne uprawnienia do logowania, biblioteki, instalowania,
  pobierania, zapisów w chmurze i ekranu sklepu. Sklepy powinny móc dodawać
  własne funkcje bez wymuszania przełączenia launchera.

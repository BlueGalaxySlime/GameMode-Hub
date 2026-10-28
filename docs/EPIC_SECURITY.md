# Epic Games — model bezpieczeństwa integracji Kont (0.5.41)

## Zakres pierwszego adaptera

W **Konta → Epic Games** GameMode Hub rozpoznaje wyłącznie znane skróty aplikacji .desktop:
`epicgameslauncher`, `epic-games-launcher`, `com.epicgames.launcher` oraz
Flatpak `com.heroicgameslauncher.hgl`. Wymaga też zgodnej nazwy (a dla Heroic
oznaczenia Flatpak). To **wskazówki do ręcznego uruchomienia**, a nie weryfikacja
podpisu pakietu ani autentyczności dostawcy. Dla innych ID użytkownik korzysta
ze zwykłej zakładki **Pulpit**, bez automatycznego zgadywania.

Po naciśnięciu **Otwórz**, Hub używa już istniejącego mechanizmu SteamOS:
tworzy tymczasowy skrót, zapisuje jego identyfikator w rejestrze sprzątania,
uruchamia aplikację za pośrednictwem klienta Steam i sprząta skrót po
zakończeniu. Gdy rejestracja skrótu zawiedzie, aplikacja nie jest uruchamiana.
Nie powstaje osobna usługa, proces logowania, sieciowy endpoint ani OAuth
callback w backendzie Huba.

## Zasady granicy zaufania

- Hub **nie przyjmuje** nazwy konta, hasła, kodu MFA ani tokenów Epic.
- Hub **nie czyta** ani nie kopiuje plików `auth.json`, profili przeglądarki,
  ciasteczek, konfiguracji Legendary, plików sesji Epic ani Unifideck.
- Hub nie wystawia RPC do odczytu/wymiany tokenów i nie prosi o uprawnienia
  roota, sudo, wyłączenie zabezpieczeń lub pusty sejf.
- Hub pokazuje **status: niezweryfikowany**. Sam fakt instalacji programu
  czy istnienia skrótu nie oznacza aktywnego konta.
- Logowanie, wylogowanie, pobieranie gier i aktualizacje pozostają wyłącznie
  w zewnętrznym launcherze. Żadnych fikcyjnych statusów lub postępów.
- Stare integracje gier z Unifideck (np. ich skróty i widok gry) pozostają
  nietknięte. Ekran Kont nie odpytuje jego RPC.

## Dlaczego nie obiecujemy automatycznie ochrony KWallet

Na SteamOS/KDE może działać KWallet/Secret Service, ale nie oznacza to, że
każdy launcher przechowuje tam swoje tokeny. Heroic korzysta z Legendary
i jego konfiguracji, a Epic Games Launcher działający przez Proton może
trzymać sesję we własnym prefiksie Wine. Hub nie uznaje tego automatycznie
za systemowy sejf ani za szyfrowanie odporne na przejęcie konta użytkownika.

Zasada **fail closed** dla przyszłego natywnego logowania: jeżeli kiedykolwiek
powstanie adapter, który operuje tokenami, nie może odczytać ani zapisać
tokena poza udokumentowanym i sprawdzonym magazynem systemowym.
Przy zablokowanym lub niedostępnym sejfie logowanie musi zakończyć się
czytelnym błędem, bez fallbacku do JSON, logu, localStorage czy pamięci Steam.
Należy przedtem przeprowadzić przegląd OAuth/PKCE, przekierowań, TLS,
uprawnień Flatpak/D-Bus, rotacji tokenów i bezpieczeństwa wylogowania.

## Testy i ograniczenia

Automatycznie testujemy rozpoznawanie ID, brak zgadywania tożsamości z nazwy,
jawne uruchamianie, sprzątanie skrótu i blokadę uruchomienia po błędzie zapisu
tymczasowego ID. Uruchomienie w prawdziwym SteamOS Gaming Mode, działanie
kontrolera i autoryzacja strony Epic wymagają testów na Lenovo.
To **nie** jest jeszcze natywna biblioteka Epic wewnątrz Huba.

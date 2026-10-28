# Tab Manager — SteamHub (wersja eksperymentalna)

Tab Manager jest niezależnym modułem SteamHub do zarządzania zakładkami na ekranie
**Biblioteka** SteamOS. Po włączeniu moduł próbuje dołączyć rzeczywistą zakładkę
**SteamHub** i zakładki skonfigurowane przez użytkownika do natywnego paska biblioteki.
Nie tworzy do tego celu kolekcji o nazwie SteamHub.

## Użycie

1. Decky → **SteamHub → Moduły → Tab Manager**.
2. Włącz moduł (domyślnie **OFF**).
3. Wejdź ponownie do ekranu **Biblioteka**, aby patch trasy został zastosowany.
4. Dodawaj i edytuj zakładki, zmieniaj kolejność, widoczność i proste filtry.
5. Zapisz układ jako profil albo wczytaj istniejący profil.

Dostępne filtry: wszystkie gry, zainstalowane, ulubione, aplikacje spoza
Steam oraz wskazana kolekcja Steam. Dostępne Quick Tabs: Zainstalowane i Ulubione.

## Zgodność z TabMaster

SteamHub używa listy **uruchomionych wtyczek** Decky Loader (`DeckyPluginLoader.hasPlugin("TabMaster")`), a nie samej obecności katalogu TabMaster na dysku.
**Zainstalowany, ale wyłączony TabMaster nie blokuje Tab Managera.**
Jeżeli TabMaster działa, SteamHub wstrzymuje patch biblioteki, bez zmian
w jego plikach czy ustawieniach. Po wyłączeniu TabMastera użyj przycisku
**Sprawdź ponownie stan TabMastera** albo ponownie otwórz panel SteamHub.
Gdy odczyt stanu loadera jest niedostępny, integracja nie uruchamia się,
a interfejs wyświetla odrębny komunikat diagnostyczny.

Ustawienie ON/OFF, definicje zakładek i profile są zapisywane w katalogu
`~/.config/steamhub/`, poza katalogiem samej wtyczki.

## Ograniczenia

To **eksperymentalna implementacja**, a nie jeszcze pełny odpowiednik TabMastera.
Zaawansowane filtry, integracje znajomych i tagów oraz część ustawień Steam
nie zostały przeniesione. Patch korzysta z niepublicznej struktury UI Steam,
która może zmieniać się po aktualizacjach. Automatyczna kompilacja i testy
backendu nie zastępują testów na rzeczywistym urządzeniu SteamOS.

## Licencja i autorzy

Technika patchowania biblioteki jest adaptacją
[TabMaster](https://github.com/Tormak9970/TabMaster), którego autorami
są Travis Lane (Tormak) i inni współtwórcy. Zapoznaj się z
[`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) i [`LICENSE`](../LICENSE).

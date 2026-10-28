# Karty i kolekcje — GameMode Hub

Moduły są dostępne w **Optymalizacja → Gaming Mode → Karty / Kolekcje**.

## Karty

Własny Tab Manager zapisuje definicje kart i profile niezależnie od kolekcji. Umożliwia dodanie karty, zmianę nazwy, widoczności, kolejności, filtru oraz powiązanie karty z kolekcją Steam lub kolekcją Huba.
Integracja z paskiem biblioteki SteamOS jest eksperymentalna i domyślnie **OFF**. Pochodzi z istniejącego, do tej pory niewłączonego prototypu Tab Managera; to nie jest osobna instalacja TabMastera.
Nie zmienia oryginalnych kart biblioteki Steam. Gdy włączony jest TabMaster lub status jest nieznany, interfejs Huba nie patchuje biblioteki.

## Kolekcje

Osobny moduł definiuje kolekcje zapisane w `~/.config/gamemodehub/collections.json`, bez modyfikowania danych kolekcji Steam. Są obsługiwane ręczne listy numerycznych Steam AppID (także skrótów spoza Steam) oraz filtry: Wszystkie, Zainstalowane, Ulubione, Spoza Steam. Identyfikatory kolekcji są stabilne przy zmianie nazwy.

Usunięcie karty nie usuwa kolekcji. Usunięcie kolekcji nie usuwa karty (karta będzie pusta do wybrania istniejącej kolekcji). Zarządzanie samymi kolekcjami Huba działa bez włączania eksperymentalnego patcha Steam.

## Ograniczenia i bezpieczeństwo

- Widok i reguły kolekcji Huba nie są jeszcze zapisywane jako natywne kolekcje Steam.
- Obsługa natywnego paska wymaga testów na fizycznym SteamOS. Po aktualizacjach Steam niepubliczna struktura biblioteki może się zmienić; patch można wyłączyć.
- Dane kolekcji i kart są niezależne od przeglądania plików, tokenów kont i plików gier.
- Starsze ustawienia kart i profile pozostają w `~/.config/steamhub/` dla kompatybilności. Nazwę katalogu ujednolicimy przez migrację w osobnej zmianie.
- Technika modyfikacji biblioteki pochodzi z adaptacji TabMastera. Zobacz `THIRD_PARTY_NOTICES.md`.


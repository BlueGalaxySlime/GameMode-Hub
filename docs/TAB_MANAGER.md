# Karty i kolekcje — GameMode Hub

## W bibliotece Steam

Karty dodaje się i edytuje bezpośrednio na ekranie biblioteki Gaming Mode: po włączeniu integracji w **Optymalizacja → Karty** na pasku kart pojawia się **+**. Umożliwia zmianę nazw, kolejności, widoczności, filtrów i przypisywanie kolekcji. To edytor w natywnej bibliotece, nie osobny launcher.

Natywna integracja jest eksperymentalna i domyślnie wyłączona; nie zmienia istniejących kart Steam. Konflikt z TabMasterem albo brak informacji o aktywnych wtyczkach bezpiecznie ją blokuje.

## Optymalizacja

Pojedynczy ekran, analogiczny do Opcji Huba: sekcje Gaming Mode, Karty (włącz/wyłącz), Kolekcje (ich niezależne definicje) i Kopia zapasowa. Nie ma dodatkowych poziomych przycisków Ogólne / Karty / Kolekcje ani pustych podstron.

## Kopia zapasowa

Ustawienia kart, kolekcji Huba i profile są zapisywane w kopiach JSON pod `~/.config/gamemodehub/backups/library/`. Maksymalnie 20 kopii. Można je skopiować przez Pliki. Przywrócenie tworzy wcześniej dodatkową kopię bezpieczeństwa. Dane logowania, gry, prefixy i oryginalne kolekcje Steam nie są kopiowane.

## Oddzielenie danych

Kolekcje Huba są w `~/.config/gamemodehub/collections.json`. Starsze ustawienia kart i profili nadal w `~/.config/steamhub/` dla zgodności. Usunięcie karty nie usuwa kolekcji; usunięcie kolekcji nie usuwa samej karty.

Technika integracji z niepubliczną strukturą biblioteki Steam pochodzi z adaptacji TabMastera, zgodnie z `THIRD_PARTY_NOTICES.md`. Test na urządzeniu SteamOS nadal obowiązkowy.

# Karty i kolekcje — GameMode Hub

## Biblioteka Gaming Mode
Zaznacz kartę Steam lub Huba i naciśnij **☰ (Menu)**. Otworzy się natywne menu na wierzchu, podobne do TabMastera (bez niestandardowej zieleni): dodawanie kart, szybkie karty, profile, kolejność oraz ukrywanie/pokazywanie.

**Steam:** oryginalne karty są zawsze zachowane; Hub może je tylko ukryć. „Utwórz własną wersję z nową nazwą” zapisuje **nową kartę Huba** z zawartością oryginału i dopiero wtedy ukrywa kartę systemową. Oryginał nie jest przemianowywany ani usuwany. Odtworzenie jest odwracalne.

**Hub:** karty stworzone przez użytkownika można zmieniać, ukrywać, przenosić, kopiować i usuwać. Kolekcje pozostają niezależne; usunięcie karty nie usuwa kolekcji ani gry.

## Optymalizacja
Sekcja **Karty i Kolekcje** ma jeden wspólny nagłówek oraz dwa
zwykłe, obramowane wiersze w stylu pozostałych ustawień:
**Karty** (przycisk Karty i osobny ON/OFF) oraz **Kolekcje**
(przycisk Kolekcje i osobny ON/OFF). Nie ma przycisków „Zarządzaj”.

Oba przyciski otwierają natywne menu kontekstowe SteamOS, ale każdy
zarządza tylko swoim zakresem. Menu Kart zawiera szybkie karty, profile,
kolejność i przywracanie ukrytych kart; działania dotyczące konkretnej karty
pozostają również w menu biblioteki Steam. Menu Kolekcji ma własne podmenu
oraz krótkie okna do zmiany nazwy i potwierdzenia usunięcia, zamiast
rozbudowanego formularza. ON/OFF nie usuwa żadnych zapisanych danych.
ON dla Kart aktywuje dodatkową obsługę kart w bibliotece Steam Gaming Mode;
OFF ją wyłącza. Istniejące kolekcje, karty i profile pozostają bez zmian.

## Bezpieczeństwo, konflikt i backup
TabMaster musi być wyłączony; gdy stan konfliktu jest nieznany, integracja pozostaje wstrzymana. Biblioteka Steam używa niepublicznej struktury, więc niezbędny jest test na Lenovo.

Kopia zapasowa w `~/.config/gamemodehub/backups/library/` zapisuje karty Huba, kolekcje, profile i listę ukrytych kart Steam. Nie zapisuje gier, tokenów ani własnych danych Steam. Przed przywróceniem zapisywana jest dodatkowa kopia bezpieczeństwa.

Technika patchowania biblioteki jest adaptacją TabMastera, zgodnie z `THIRD_PARTY_NOTICES.md`.

## Diagnostyka menu ☰ w Steam
Jeżeli na dolnej belce przy zaznaczonej karcie nie pojawia się **☰ KARTY**, sprawdź stan Kart w Optymalizacji → Karty i Kolekcje. Osobny aktywny TabMaster blokuje menu Huba, żeby nie nadpisywać cudzych zmian. Gdy nie można odczytać stanu Decky, integracja również jest celowo zatrzymana. Po wyłączeniu TabMastera wyłącz i ponownie włącz przełącznik obok „Karty”. Menu pojawia się w **bibliotece Steam Gaming Mode**, nie w bibliotece ani na ekranie opcji Huba.

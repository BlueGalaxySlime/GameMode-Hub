# Karty i kolekcje — GameMode Hub

## Biblioteka Gaming Mode
Zaznacz kartę Steam lub Huba i naciśnij **☰ (Menu)**. Otworzy się natywne menu na wierzchu, podobne do TabMastera (bez niestandardowej zieleni): dodawanie kart, szybkie karty, profile, kolejność oraz ukrywanie/pokazywanie.

**Steam:** oryginalne karty są zawsze zachowane; Hub może je tylko ukryć. „Utwórz własną wersję z nową nazwą” zapisuje **nową kartę Huba** z zawartością oryginału i dopiero wtedy ukrywa kartę systemową. Oryginał nie jest przemianowywany ani usuwany. Odtworzenie jest odwracalne.

**Hub:** karty stworzone przez użytkownika można zmieniać, ukrywać, przenosić, kopiować i usuwać. Kolekcje pozostają niezależne; usunięcie karty nie usuwa kolekcji ani gry.

## Optymalizacja
Jeden prosty ekran jak w Opcjach Huba. Sekcja **Karty** ma jeden wiersz: przełącznik **ON/OFF** obok zwykłego przycisku **Zarządzaj**. Po rozwinięciu pokazuje on to samo menu działań co w bibliotece Steam (szybkie karty, profile, kolejność, przywracanie ukrytych kart), z wyjątkiem akcji wymagających zaznaczenia konkretnej karty. ON aktywuje podpowiedź **☰ KARTY** na dolnej czarnej belce natywnej biblioteki Steam Gaming Mode, OFF wyłącza ten dodatek do UI bez usuwania danych. Wybrany stan zachowuje się po uruchomieniu SteamOS. Stan kart i profile są zapisywane poza UI, aby mogły służyć także przyszłemu launcherowi.

Sekcja **Kolekcje** ma identyczny, niewielki przycisk **Zarządzaj** i osobny
przełącznik ON/OFF. Oba przyciski „Zarządzaj” otwierają natywne menu kontekstowe
SteamOS. Kolekcje nie otwierają już osobnego, pełnego formularza z wieloma
przyciskami. Działania na istniejących kolekcjach (nazwy, kolejność, zawartość,
usuwanie) pozostają dostępne w podmenu, a edycja nazwy i potwierdzenie
usunięcia otwierają krótkie natywne okna. Nie zmieniamy danych istniejących
kolekcji ani ich powiązań z kartami.

## Bezpieczeństwo, konflikt i backup
TabMaster musi być wyłączony; gdy stan konfliktu jest nieznany, integracja pozostaje wstrzymana. Biblioteka Steam używa niepublicznej struktury, więc niezbędny jest test na Lenovo.

Kopia zapasowa w `~/.config/gamemodehub/backups/library/` zapisuje karty Huba, kolekcje, profile i listę ukrytych kart Steam. Nie zapisuje gier, tokenów ani własnych danych Steam. Przed przywróceniem zapisywana jest dodatkowa kopia bezpieczeństwa.

Technika patchowania biblioteki jest adaptacją TabMastera, zgodnie z `THIRD_PARTY_NOTICES.md`.

## Diagnostyka menu ☰ w Steam
Jeżeli na dolnej belce przy zaznaczonej karcie nie pojawia się **☰ KARTY**, sprawdź w Optymalizacji → Karty wynik „Sprawdź integrację”. Osobny aktywny TabMaster blokuje menu Huba, żeby nie nadpisywać cudzych zmian. Gdy nie można odczytać stanu Decky, integracja również jest celowo zatrzymana. Po wyłączeniu TabMastera wyłącz i ponownie włącz „Karty w bibliotece”. Menu pojawia się w **bibliotece Steam Gaming Mode**, nie w bibliotece ani na ekranie opcji Huba.

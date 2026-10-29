# Karty i kolekcje — GameMode Hub

## Biblioteka Gaming Mode
Zaznacz kartę Steam lub Huba i naciśnij **☰ (Menu)**. Otworzy się natywne menu na wierzchu, podobne do TabMastera (bez niestandardowej zieleni): dodawanie kart, szybkie karty, profile, kolejność oraz ukrywanie/pokazywanie.

**Steam:** oryginalne karty są zawsze zachowane; Hub może je tylko ukryć. „Utwórz własną wersję z nową nazwą” zapisuje **nową kartę Huba** z zawartością oryginału i dopiero wtedy ukrywa kartę systemową. Oryginał nie jest przemianowywany ani usuwany. Odtworzenie jest odwracalne.

**Hub:** karty stworzone przez użytkownika można zmieniać, ukrywać, przenosić, kopiować i usuwać. Kolekcje pozostają niezależne; usunięcie karty nie usuwa kolekcji ani gry.

## Optymalizacja
Jeden prosty ekran jak w Opcjach Huba. Sekcja **Karty** zawiera **Zarządzaj** (przejście do biblioteki launchera Steam) oraz **Wyświetlaj** (menu ukrywania/pokazywania). Integracja ładuje się automatycznie wraz z Hubem: nie trzeba najpierw uruchamiać ustawień, aby na dolnej czarnej belce biblioteki pojawiło się **☰ KARTY**. Nie ma przełącznika włącz/wyłącz ani dodatkowych zakładek. Stan kart i profile są zapisywane poza UI, aby mogły służyć także przyszłemu launcherowi.

## Bezpieczeństwo, konflikt i backup
TabMaster musi być wyłączony; gdy stan konfliktu jest nieznany, integracja pozostaje wstrzymana. Biblioteka Steam używa niepublicznej struktury, więc niezbędny jest test na Lenovo.

Kopia zapasowa w `~/.config/gamemodehub/backups/library/` zapisuje karty Huba, kolekcje, profile i listę ukrytych kart Steam. Nie zapisuje gier, tokenów ani własnych danych Steam. Przed przywróceniem zapisywana jest dodatkowa kopia bezpieczeństwa.

Technika patchowania biblioteki jest adaptacją TabMastera, zgodnie z `THIRD_PARTY_NOTICES.md`.

## Diagnostyka menu ☰ w Steam
Jeżeli na dolnej belce przy zaznaczonej karcie nie pojawia się **☰ KARTY**, sprawdź w Optymalizacji → Karty wynik „Sprawdź integrację”. Osobny aktywny TabMaster blokuje menu Huba, żeby nie nadpisywać cudzych zmian. Gdy nie można odczytać stanu Decky, integracja również jest celowo zatrzymana. Po wyłączeniu TabMastera można wybrać „Odśwież”. Menu pojawia się w **bibliotece Steam Gaming Mode**, nie w bibliotece ani na ekranie opcji Huba.

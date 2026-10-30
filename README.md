# GameMode Hub

**GameMode Hub** to lekki panel rozszerzeń do **SteamOS Gaming Mode**, otwierany z menu **Quick Access (⋯)**. Nie jest osobnym launcherem ani zamiennikiem Steam w domyślnym trybie.

## Instalacja na SteamOS

1. Jeśli masz starą wtyczkę **SteamHub**, usuń ją w Decky. Nazwa identyfikatora wtyczki uległa zmianie.
2. Pobierz **GameMode-Hub.zip** z [wydań testowych](https://github.com/BlueGalaxySlime/GameMode-Hub/releases). Nie rozpakowuj archiwum.
3. W Gaming Mode otwórz Decky Loader → ustawienia deweloperskie i zainstaluj wtyczkę z ZIP. Szczegóły: [instrukcja](docs/INSTALL.md).
4. Naciśnij przycisk **⋯**, otwórz **GameMode Hub**, wybierz **Otwórz GameMode Hub**. Zostaniesz w interfejsie SteamOS.

**Kanały aktualizacji:** Testowy (bieżące wydania i możliwość downgrade’u) oraz Stabilny (pusty, dopóki nie zweryfikujemy wydania na urządzeniu). Numery wydań nie mają dopisków o kanale — oznaczenie kanału jest metadanymi wydania GitHub. Wersję wybierzesz w zakładce Aktualizacje.

**Wymagany jest Decky Loader tylko jako adapter do Quick Access.** Valve nie udostępnia stabilnego publicznego interfejsu wtyczek do Quick Access. Nie modyfikujemy plików Steam ani nie wstrzykujemy własnych procesów do klienta Steam poza adapterem Decky.

## Opcje Huba i zapamiętywanie sesji

„Opcje Huba” zawierają dwa przełączniki: **Zachowuj stan kart** (domyślnie włączony) oraz **Podział drzewa plików** (domyślnie wyłączony). Stan kart jest przechowywany w pamięci wtyczki, więc można przełączać zakładki bez utraty ścieżki i bieżących ustawień. Same opcje są zapisywane na dysku. Podział w Plikach ogranicza się do przeglądarki katalogów: foldery po lewej, pliki po prawej, natomiast pasek adresu i cały Hub nie są dzielone.

## Konta i sklepy

W **Konta → GOG** można powiązać istniejącą, zaszyfrowaną sesję GOG z Unifideck i na żądanie pobrać listę posiadanych gier. Jest to wyłącznie lokalne, odczytowe powiązanie, nie nowy klient logowania i nie migracja samych tokenów. Hub nie przechowuje haseł, a odłączenie nie zmienia konta Unifideck. Funkcja jest testowa i nie instaluje jeszcze gier. Docelowa architektura [modułów sklepów](docs/STORE_CONNECTORS.md) pozwoli zastąpić programy uruchamiające wspólnym interfejsem sklepu.

## Optymalizacja

**Optymalizacja** jest prostą stroną ustawień: Gaming Mode, Karty, Kolekcje i Kopia zapasowa bez dodatkowych przełączanych ekranów. Dodawanie i edycja kart odbywają się **z poziomu biblioteki Gaming Mode** przez natywne menu **☰** zaznaczonej karty. W Optymalizacji jest jeden wiersz z **ON/OFF** oraz sąsiadującą listą **Zarządzaj ▾**, używającą tego samego menu co w bibliotece. Kolekcje Huba i karty są niezależne. Kopie zapasowe kart, kolekcji i profili można zapisać i przywrócić, bez plików gier i haseł. Nie trzeba instalować TabMastera; integracja z biblioteką respektuje zapisany przełącznik ON/OFF przy uruchomieniu Huba i jest eksperymentalna. **☰ KARTY** pokazuje się na dolnej belce biblioteki launchera Steam, nie wewnątrz opcji Huba. Osobny aktywny TabMaster musi być wyłączony; stan można odświeżyć w Optymalizacja → Karty. Szczegóły w [dokumentacji](docs/TAB_MANAGER.md).

## Okna i sterowanie programów Pulpitu

W **Pulpit → Y na aplikacji** są dwa profile **Dopasowania obrazu w Gaming Mode**: automatyczny (Steam, domyślny) i eksperymentalny Native, działający wyłącznie na ustawienie wyświetlania *skrótu danej aplikacji* w Steam. Nie zmienia to rozdzielczości całej konsoli. Dawny „Kompaktowy interfejs” został wyłączony — mógł pogorszyć poziome miniaturyzowanie okien w Gamescope. Obok pozostaje natywny konfigurator **Steam Input** z szablonami i układami z innych gier. Jeśli programu nie ma jeszcze w bibliotece Steam, wybranie Steam Input utworzy trwały skrót, dzięki któremu profil pada nie zniknie.

## Pliki

W Quick Access → GameMode Hub → **Pliki** lista zajmuje całą szerokość panelu. Na górze jest edytowalny adres folderu (Enter lub Przejdź), niżej klikalne segmenty ścieżki oraz zwarty pasek z ukrytymi plikami i sortowaniem według nazwy, rozmiaru lub daty. Możesz tworzyć foldery, zmieniać nazwy i kopiować/przenosić pliki; usuwanie pozostaje wyłączone, dopóki nie dodamy bezpiecznego kosza. Systemowe katalogi są niedostępne.

## Architektura i katalogi

- `src/core/` — nazwa, manifest funkcji i podstawowe reguły **bez** importów ze Steam/Decky.
- `src/hub/` i `src/index.tsx` — obecny adapter SteamOS/Decky (nawigacja i obsługa kontrolera).
- `main.py` — wymagany przez Decky punkt wejścia; pozostaje w katalogu głównym.
- `backend/core/` — ustawienia i stan działania.
- `backend/files/` — pliki, kosz i transfer lokalny.
- `backend/apps/` — programy pulpitu i Flatpak.
- `backend/downloads/` — kolejka i aktualizacje.
- `backend/library/` — biblioteka, karty, kolekcje i kopie danych.
- `src/modules/` — działające moduły interfejsu; `src/hub/` — strony Huba i Decky.
- Stary katalog `modules/` zawierał wyłącznie przykładowy manifest, dlatego został usunięty.
- `terminal_core/` — niezależny silnik Linux PTY dołączany do paczki; uruchamiany tylko na żądanie, bez roota.
- `desktop/` — wcześniejszy eksperyment z Electronem, **nie jest już budowany ani publikowany**. Opcjonalny niezależny launcher pozostaje osobnym przyszłym etapem.

**Terminal w kanale testowym 0.5.64:** ręczne uruchamianie powłoki Linux, bez procesów przy samym otwarciu zakładki. Ze względu na wcześniejsze restarty Gaming Mode konieczna jest weryfikacja na Lenovo przed uznaniem funkcji za stabilną. Nie ma jeszcze niezależnego zamiennika Quick Access bez Decky — to cel długoterminowy.

## Aktualizator nie widzi nowej wersji w 0.5.2?

W 0.5.2 była błędna metoda sprawdzania: GitHub `/releases/latest` pomija wydania testowe. Wymagana jest **jednorazowa ręczna aktualizacja**, bez usuwania Decky: [instrukcja](docs/UPDATES.md).

## Pobieranie

[Wydania GameMode Hub](https://github.com/BlueGalaxySlime/GameMode-Hub/releases) · [Plan rozwoju](docs/ROADMAP.md) · [Licencje i podziękowania](THIRD_PARTY_NOTICES.md)

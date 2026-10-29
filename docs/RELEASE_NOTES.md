# GameMode Hub 0.5.53 (testowy)

- **Korekta problemu poziomego pasa/miniaturyzacji w Gamescope.** Na przykładzie Discover w Gaming Mode stwierdzono, że aplikacja jest zbyt mocno pomniejszona, a nie ucięta. Wyłączono wcześniejszy profil „Kompaktowy interfejs” z 0.5.52 (GDK_DPI_SCALE=0.85, QT_SCALE_FACTOR=0.85, Electron 0.85); użycie tej opcji nie zmniejsza już GUI.
- **Pulpit → Y → Dopasowanie obrazu w Gaming Mode:** teraz **Automatyczne (Steam)** albo **Natywna rozdzielczość aplikacji (test)**, stosowane *wyłącznie do skrótu danej aplikacji* przez Steam. Nie zmieniamy trybu całego ekranu, nie uruchamiamy drugiego Gamescope, nie modyfikujemy systemowych ustawień wyświetlacza. Domyślnie pozostaje Auto.
- **Bezpieczny powrót:** wybór Automatyczne przywraca Steam „Default”, jeśli wcześniej użytkownik wybrał Native. Starsze ustawienie „compact” w danych jest automatycznie ignorowane; zapis ulubionych, uruchomień, Steam Input i pozostałych ustawień pozostaje.
- **Steam Input** — w dalszym ciągu jest dostępny z Pulpitu, a skróty zachowują własne konfiguracje pada.
- **Diagnoza:** podobny błąd Gamescope (zawartość pomniejszona i otoczona czarnymi pasami) został zgłoszony w SteamOS 3.7.20 i według zgłoszenia naprawiony w 3.7.21. To nie dowodzi, że każdy przypadek na Lenovo ma tę samą przyczynę. Opcja Native jest testowa i może nie pomóc — nie wybieramy jej automatycznie.
- **Menu kart Steam** — wcześniejszy problem braku podpowiedzi ☰ KARTY na dolnej belce nie jest objęty tą korektą. Test na Lenovo nadal niezbędny.

# GameMode Hub 0.5.52 (testowy)

- **Pulpit → menu Y aplikacji → Okno w Gaming Mode:** dodane dwie zachowywane osobno dla każdej aplikacji opcje: domyślny profil okna oraz kompaktowe skalowanie GUI (eksperymentalne). Nie zmieniamy rozdzielczości monitora, rozdzielczości Steam ani ustawień globalnych Gamescope.
- **GTK, Qt, Electron i Flatpak:** dla kompaktowego profilu dodajemy tylko lokalne zmienne skalowania GUI przy starcie aplikacji. Dla Flatpak używamy `flatpak run --env=…`, żeby ustawienia działały także wewnątrz sandboksa. Zmiana profilu działa od kolejnego uruchomienia aplikacji, bez przerywania bieżącej sesji.
- **Pulpit → menu Y → Sterowanie padem:** otwiera bezpośrednio systemowy konfigurator Steam Input dla danej aplikacji, umożliwiając wybór szablonów, własnych układów i układów z innych gier. Jeśli program nie ma stałego skrótu Steam, użytkownik wybiera świadomie akcję jego dodania; nie tworzymy układu dla skrótu tymczasowego, który zniknie po wyjściu.
- **Bez fałszywych obietnic:** kompaktowy profil może pomóc, gdy interfejs Firefoksa lub Heroica jest za duży, lecz nie naprawi każdego okna przyciętego przez Gamescope. Rozmiar samego okna i pełny ekran pozostają własnością aplikacji/SteamOS.
- Nie przenosimy ani nie kasujemy istniejących konfiguracji Steam Input; stare skróty zachowują swój Steam AppID.
- **Menu ☰ KARTY w głównej bibliotece** pozostaje integracją eksperymentalną. Jeżeli osobny TabMaster jest aktywny lub stan Decky jest nieznany, Hub nie nadpisuje paska kart. Nadal wymagany test na urządzeniu.

# GameMode Hub 0.5.51 (testowy)

- **Optymalizacja → Karty:** jeden wiersz „Karty w bibliotece” z przełącznikiem ON/OFF oraz sąsiadującą listą **Zarządzaj ▾**, w stylu systemowych rozwijanych menu SteamOS. Zamiast dwóch osobnych przycisków.
- **Zarządzaj ▾** pokazuje to samo natywne menu kart co ☰ KARTY na dolnej belce biblioteki launchera Steam: szybkie karty, profile, zmiana kolejności, ukryte karty. Opcje dotyczące *konkretnie zaznaczonej karty* pozostają tylko w menu jej zakładki w bibliotece.
- **ON/OFF:** zapisuje się w ustawieniach Huba; OFF wyłącza wyłącznie patch UI biblioteki bez usuwania kart i kolekcji, ON przywraca natywne menu w Steam Gaming Mode. Ustawienie jest odczytywane po uruchomieniu dodatku, bez konieczności wchodzenia do Optymalizacji.
- Nie usuwamy ani nie zmieniamy nazw kart systemowych Steam. Własne karty Huba i backup pozostają niezależne.
- Wymagany test na Lenovo: dolna czarna belka Steam oraz nawigacja padem. Integracja bazuje na niepublicznych strukturach SteamOS.

# GameMode Hub 0.5.50 (testowy)

- **Poprawka menu kart launchera Steam.** W 0.5.49 integracja była domyślnie nieaktywna po uruchomieniu dodatku: kod oczekiwał starszego przełącznika w ustawieniach. Teraz karta Steam otrzymuje natywny skrót **☰ KARTY** na dolnej czarnej belce, bez wcześniejszego wejścia do Opcji/Optymalizacji Huba.
- **Pewniejsze sprawdzanie konfliktów.** Obsługa wykrywania aktywnego TabMastera przez `DeckyPluginLoader.hasPlugin`, listę załadowanych dodatków oraz bezpieczne sprawdzenie `loader/get_plugins`. Nie zmienia ustawień ani nie wyłącza automatycznie innych wtyczek.
- **Optymalizacja → Karty:** „Zarządzaj” prowadzi do biblioteki prawdziwego launchera Steam, a pole stanu integracji pozwala ponownie sprawdzić konflikt. Nie ma przełącznika włącz/wyłącz ani drugiego ekranu biblioteki w Hubie.
- **Karty Steam** nadal można wyłącznie ukrywać. Własne karty Huba można tworzyć, edytować i usuwać; backup i kolekcje pozostają bez zmian.
- **Test na Lenovo nadal wymagany.** Integracja z paskiem biblioteki używa niepublicznej struktury UI SteamOS; jej faktyczne zachowanie należy potwierdzić na urządzeniu.

# GameMode Hub 0.5.49 (testowy)

- **Karty bezpośrednio z biblioteki.** Na zaznaczonej karcie w Gaming Mode przycisk ☰ otwiera natywne menu SteamOS: Dodaj kartę, Szybkie karty, Profile, Kolejność, Ukryj/Pokaż. Nie ma już dodatkowej karty „+” ani formularza edycji w Optymalizacji.
- **Karty Steam są chronione.** Hub nigdy nie usuwa i nie zmienia nazw kart dostarczonych przez Steam. Można je tymczasowo ukryć. Opcja zmiany nazwy systemowej tworzy zamiast tego własną kartę Huba z tą samą zawartością i ukrywa oryginał; ponowne pokazanie karty Steam pozostaje możliwe.
- **Tylko własne karty Huba można edytować i usuwać.** Usunięcie karty Huba nie usuwa żadnej kolekcji ani gry.
- **Optymalizacja → Karty:** zamiast przełącznika są przyciski Zarządzaj (przejście do biblioteki) i Wyświetlaj (ukrywanie/pokazywanie kart Steam i Huba). Menu jest natywne, używa kolorów aktualnego motywu SteamOS, bez wymuszonej zieleni.
- **Kopia zapasowa:** zapisuje teraz również listę ukrytych kart systemowych, aby po przywróceniu odtworzyć widoczność. Starsze kopie bez tego pola nadal można odczytać.
- **Eksperymentalna integracja Gaming Mode:** TabMaster musi być wyłączony; test na fizycznym Lenovo nadal wymagany.

# GameMode Hub 0.5.48 (testowy)

- **Optymalizacja bez pasków podzakładek.** Jeden widok jak w Opcjach Huba: Gaming Mode, Karty, Kolekcje i Kopia zapasowa jako zwykłe sekcje. Usunięto puste zakładki Obraz/Konsola i zbędne opisy.
- **Edycja kart przeniesiona do biblioteki Steam.** Po włączeniu własnych kart w Optymalizacji, w natywnym pasku kart biblioteki pojawia się **+**, który otwiera edytor bez drugiego launchera i bez dodawania formularzy do ustawień. W ustawieniach pozostaje tylko przełącznik i diagnostyka konfliktów.
- **Kopia zapasowa** obejmuje definicje kart, kolekcje Huba i profile kart; kopie przechowywane są poza instalacją Decky, w `~/.config/gamemodehub/backups/library/`. Przywrócenie wymaga potwierdzenia, a przed nadpisaniem ustawień powstaje dodatkowy automatyczny snapshot. Maksymalnie 20 kopii, bez plików gier i danych logowania.
- **Integracja biblioteki nadal eksperymentalna i domyślnie wyłączona.** Przed użyciem wymaga sprawdzenia przycisku + i nawigacji padem na Lenovo. Nie zastępuje oryginalnych kart Steam.

# GameMode Hub 0.5.47 (testowy)

- **UI → Optymalizacja**. Dotychczasowa trasa strony i ustawienia pozostają zachowane.
- **Gaming Mode → Karty**: natywny moduł tworzenia kart biblioteki, nazw, widoczności, filtrów, kolejności i profili. Integracja z paskiem biblioteki jest eksperymentalna i domyślnie wyłączona. Nie instalujemy TabMastera i nie zastępujemy wbudowanych kart Steam.
- **Gaming Mode → Kolekcje**: odrębne kolekcje Huba, własne nazwy, ręczne AppID, reguły Wszystkie / Zainstalowane / Ulubione / Spoza Steam, zmiana kolejności i bezpieczne usuwanie. Kolekcja nie znika po usunięciu karty, a karta może wskazywać kolekcję.
- Dane kolekcji trafiają do `~/.config/gamemodehub/collections.json`; istniejące dane kart pozostają osobno w katalogu `~/.config/steamhub/` (zgodność ze starszym prototypem).
- Karty nie ingerują w Steam, dopóki użytkownik nie włączy eksperymentalnej integracji. Gdy TabMaster działa lub nie można sprawdzić konfliktu, integracja pozostaje wstrzymana. Do weryfikacji na Lenovo wymagany jest test pełnego Gaming Mode.
- Pakiet zawiera teraz backend kart oraz kolekcji i ich nowe testy. Nadal bez procesów root i uruchamiania terminala.

# GameMode Hub 0.5.46 (testowy)

- **☰ (trzy kreski / Menu) na podświetlonym polu tekstowym** otwiera natywne menu edycji tekstu **bez aktywowania klawiatury ekranowej SteamOS**. Dotyczy Szukaj w Pulpicie, paska adresu w Plikach oraz Tytułu i Opisu w Zgłoszeniach.
- **Pierwsza opcja: „Tryb zaznaczania tekstu”** — wyświetla oddzielną, fokusowalną wersję pola. Krzyżak przesuwa granicę zaznaczenia, widać wyróżniony fragment. Klawiatura SteamOS nie jest wywoływana.
- **Menu ☰ w trybie zaznaczania:** Kopiuj, Wytnij, Wklej, Zaznacz wszystko i Wyczyść wszystko. Wyczyść wszystko usuwa zawartość pola; dostępne jest też „Cofnij wyczyszczenie” w tym samym trybie. **B wychodzi z zaznaczania**.
- **Y pozostaje do standardowych funkcji ekranu.** Przy otwartej klawiaturze SteamOS fizyczne Y może być przejęte jako spacja, dlatego funkcji tekstowych nie uzależnia się od Y w nakładce klawiatury.
- **Bezpieczne operacje:** wycinanie modyfikuje tekst wyłącznie po pomyślnym zapisaniu do schowka. Niedostępność schowka nie niszczy tekstu. Nie modyfikujemy globalnych skrótów pada ani ustawień systemu.
- **Test Lenovo wymagany:** szczególnie obsługa przycisku ☰ w aktualnej wersji SteamOS, prawidłowe przechwycenie krzyżaka w trybie zaznaczania i przywrócenie fokusu po B.

# GameMode Hub 0.5.45 (testowy)

- **Aktywna edycja pól:** po naciśnięciu A i wejściu w pole tekstowe, pierwsze B uruchamia zaznaczanie od aktualnej pozycji kursora. Pojawia się krótka wskazówka. Kierunki na padzie przesuwają koniec zaznaczenia, bez zmiany wpisanego tekstu.
- **Wyjście z edycji:** drugie B kończy zaznaczanie i wychodzi z edycji pola, dlatego użytkownik nie powinien utknąć w trybie zaznaczania. Poza aktywną edycją B zachowuje dotychczasową funkcję cofania.
- **Y w aktywnym polu:** otwiera natywne menu Wytnij / Kopiuj / Wklej / Zaznacz wszystko. Wytnij usuwa tekst dopiero po pomyślnym zapisie w schowku; w razie braku uprawnień do schowka pozostawia tekst nienaruszony.
- **Wspólna obsługa:** Szukaj w Pulpicie, pasek w Plikach, edycja nazw, pola Zgłoszeń i nazwa nowego folderu. Działa zarówno ze standardowym polem SteamOS, jak i polem bez automatycznej klawiatury.
- **Ograniczenie SteamOS:** przy otwartej klawiaturze ekranowej jej własne skróty mogą przejmować B/Y. Nie ma niezawodnej identyfikacji źródła kierunku (krzyżak kontra analog) we wszystkich wersjach Steam. Z tego powodu nie wprowadzono globalnego przechwytywania analoga; B jest zawsze ścieżką wyjścia z trybu, o ile zdarzenie dociera do Huba.
- **Testowanie:** automatyczne testy ruchu kursora i integracji callbacków; wymaga fizycznego testu na Lenovo z otwartą klawiaturą SteamOS i bez niej.

# GameMode Hub 0.5.44 (testowy)

- **X wraca do paska:** w Pulpicie X przenosi fokus na Szukaj, a w Plikach X przenosi go na pasek ścieżki. Działa na liście i bez zmiany aktualnego folderu, wyszukiwania ani kategorii.
- **Zgłoszenia:** X przenosi fokus do pierwszego pola (Tytuł) z dowolnej sekcji formularza, bez usuwania tytułu i opisu.
- **B to cofanie:** B w Pulpicie kończy edycję tekstu lub cofa filtr. W Plikach kończy zaznaczanie/edycję albo przechodzi do folderu nadrzędnego. Na najwyższym poziomie obie zakładki pozwalają SteamOS obsłużyć B normalnie, zamiast automatycznie przenosić fokus do paska.
- **Inne zakładki:** nie zmieniono B w oknach potwierdzeń, menu, aktualizacjach, kontach ani pozostałych stronach, które nie miały własnego skrótu powrotu do paska. X nie jest podmieniane na globalny klawisz Back.
- **Kontroler:** obsługa X wykorzystuje natywne zdarzenie Secondary w Decky i wskazówkę w dolnej legendzie Steam. Wymaga sprawdzenia na Lenovo, szczególnie z klawiaturą ekranową i po edycji tekstu.

# GameMode Hub 0.5.43 (testowy)

- **Pulpit / Flatpak:** naprawiono wykrywanie rzeczywistych aplikacji Flatpak, których eksportowane pliki .desktop są dowiązaniami symbolicznymi. Wcześniej Hub pomijał takie skróty, przez co Firefox mógł być widoczny jako „Install Firefox”, ale nie jako zainstalowana aplikacja.
- **Kategorie:** każda wykryta aplikacja należy automatycznie do Flatpak lub Systemowe, lecz widoki Wszystkie i Ulubione nadal obejmują obie kategorie. Poprawiono źródło danych, nie zmieniono reguł ręcznego przypisania ani ustawień Ulubionych.
- **Bezpieczeństwo:** akceptowane są wyłącznie poprawne dowiązania z oficjalnych katalogów eksportu Flatpak do plików w odpowiednim drzewie instalacyjnym. Dowolne, uszkodzone lub prowadzące poza drzewo aplikacji linki pozostają odrzucone.
- **Testy:** dodano regresje dla zainstalowanego Firefoksa Flatpak, złośliwych/dowolnych dowiązań i nieistniejących celów. Sprawdzić na Lenovo, czy Pulpit → Flatpak pokazuje Firefoksa po aktualizacji i odświeżeniu. „Install Firefox” jest osobnym systemowym skrótem instalatora i może pozostać w Systemowe.

# GameMode Hub 0.5.42 (testowy)

- **Konta — lista wyboru:** zamiast stałego nagłówka Epic wprowadzono natywną listę rozwijaną w dół, sterowaną padem i przyciskiem A. W tej fazie dostępny jest tylko Epic Games; bez pozornych integracji innych sklepów.
- **Widoczne „Zaloguj”:** przycisk otwiera rozpoznany zainstalowany launcher Epic albo opcjonalnie Heroic. Gdy dostępnych jest kilka aplikacji, można wybrać launcher z drugiej listy rozwijanej.
- **Brak launchera:** przycisk logowania pozostaje nieaktywny, a Hub wyjaśnia, że wymagany jest launcher zainstalowany na pulpicie. Nie pokazuje fikcyjnego połączenia po wejściu na stronę Epic.
- **Zabezpieczenia bez kompromisów:** Hub nie przechowuje haseł, kodów 2FA ani tokenów i nie podszywa się pod klienta OAuth Epic; stan sesji pozostaje niezweryfikowany. Logowanie odbywa się wyłącznie w wybranym launcherze.
- **Testy:** regresje dla listy, przycisku logowania oraz obsługi braku launchera; nadal konieczny test fokusu oraz logowania w rzeczywistym Gaming Mode na Lenovo.

# GameMode Hub 0.5.41 (testowy)

- **Konta → Epic Games:** zastąpiono informacyjny ekran UniFiDeck testowym adapterem Epic. Wykrywa rozpoznane skróty Epic Games Launcher albo opcjonalnie Heroic, nie dopasowuje aplikacji jedynie po nazwie i pozwala uruchomić je świadomie przez SteamOS Gaming Mode.
- **Bez haseł i tokenów:** Hub nie jest klientem logowania Epic, nie skanuje danych Legendary ani nie importuje sesji Unifideck. Wyświetla wyłącznie „niezweryfikowany”, bo instalacja launchera nie potwierdza logowania.
- **Zabezpieczenia i uczciwy status:** sekcja Bezpieczeństwo podaje, co jest przechowywane przez launcher, a czego Hub nie czyta. Nie zakłada, że sesje Heroic lub Epic uruchamianego przez Proton są chronione KWallet.
- **Bezpieczny start:** używa istniejącego mechanizmu tymczasowych skrótów Steam. Błąd zapisu identyfikatora blokuje uruchomienie, a zamknięcie lub odmowa uruchomienia usuwa tymczasowy skrót.
- **Testy:** rozpoznawanie launcherów, odmowa przy fałszywym ID, wycofanie skrótu po błędzie i brak odczytu kont. Działanie prawdziwego launchera oraz logowania w Gaming Mode wymaga sprawdzenia na Lenovo.
- **Zakres:** to pierwszy adapter logowania zewnętrznego, nie pełne przeniesienie biblioteki i pobierania Epic do Huba; pozostałe funkcje UniFiDeck nie są zmieniane. Szczegóły: `docs/EPIC_SECURITY.md`.

# GameMode Hub 0.5.40 (testowy)

- **Jednolity model zakładek:** zamiast pojedynczego paska informacji, włączone opcjonalnie UI → Gaming Mode pokazuje dla skrótów nie-Steam cztery zakładki wzorowane na SteamOS: aktywność, własna biblioteka, społeczność/pomoc i szczegóły. Ich etykiety i dostępne działania różnią się zależnie od GOG, Epic i innych źródeł.
- **Steam bez duplikacji:** natywny Steam zachowuje własne, działające zakładki Aktywność / Twoje rzeczy / Społeczność / Informacje o grze. Hub nie wstawia drugiego zestawu.
- **GOG i Unifideck:** zgodne skróty Unifideck (np. `gog:1207658924` i `epic:<id>`) są rozpoznawane; na karcie GOG powstają zakładki „Aktywność”, „Moja gra”, „Forum GOG”, „O grze”. Hub korzysta ze statystyk dostępnych ze SteamOS; forum GOG i pomoc Epic otwierają rzeczywiste serwisy, a nie fikcyjne podstrony konkretnej gry.
- **Nie przejmujemy zewnętrznych funkcji:** instalacja, osiągnięcia i synchronizacja chmury w Unifideck działają na jego własnym panelu i nie są kopiowane ani podmieniane. To pierwszy etap wspólnego UI, nie pełne przepisanie interfejsu Unifideck i nie zamiana natywnych ekranów Steam.
- **Pamięć i wydajność:** ProtonDB odczytywany tylko po wejściu na zakładkę szczegółów i przy poprawnie przypisanym Steam AppID; pamięć podręczna z poprzednich wersji bez zmian. Brak cyklicznego skanowania.
- **Gamepad i bezpieczeństwo:** przyciski i fokus SteamOS, lewo/prawo między zakładkami, brak nowych uprawnień. Bezpieczne wstrzykiwanie do strony gry za panelem Unifideck tam, gdzie strukturę uda się rozpoznać; nie ukrywamy jego widoku. Domyślnie wyłączone.
- **Testy:** model dla GOG/Epic, wykrywanie Unifideck, obsługa tabów i brak duplikacji na Steam. Wymaga testów na fizycznym Lenovo przed przejmowaniem głębszych funkcji sklepu.

# GameMode Hub 0.5.39 (testowy)

- **UI zamiast głównej zakładki ProtonDB:** nowa sekcja **UI → Gaming Mode / Obraz / Konsola**. ProtonDB jest opcjonalnym źródłem informacji w Gaming Mode, a ręczne wyszukiwanie pozostaje dostępne po rozwinięciu. Obraz/Konsola to miejsca na przyszłe moduły; nie wykonują zadań.
- **Wspólny wygląd informacji o grze (wersja próbna):** po świadomym włączeniu w **UI → Gaming Mode** na ekranie szczegółów gry w SteamOS pojawia się jednakowy pasek dla Steam i skrótów z GOG/Epic/Heroic/Lutris/Bottles: tytuł, źródło, czas gry, ostatnie uruchomienie i ProtonDB, jeżeli dostępne. Oryginalne przyciski SteamOS, instalowanie i komendy launchera pozostają niezmienione. Jest to pierwsza warstwa ujednolicenia, nie pełny zamiennik całej karty gry.
- **Rozpoznawanie źródła:** na podstawie danych udostępnionych przez stronę SteamOS; nieznane launchery są oznaczane jako „Inny launcher”, bez zgadywania po tytule. Skróty można ręcznie przypisać do właściwego launchera i Steam AppID przez „Źródło / ProtonDB”. W ręcznym wyszukiwaniu dostępne są również GOG i Epic; wybór klienta sam w sobie nie rozpoznaje uruchomionej gry.
- **Bezpieczny opt-in:** modyfikacja strony gry domyślnie wyłączona, aktywuje się bez restartowania backendu. Przechwytywanie jest zachowawcze, tylko na trasie gry; kiedy struktura SteamOS nie pasuje, nie wstawia niczego zamiast psuć widok. Odznaki korzystają z istniejącego cache, bez stałego skanowania gier.
- **Weryfikacja:** testy źródeł i powiązań. Obsługa na Lenovo, w tym współpraca z Unifideck, Game Glance i innymi modyfikatorami interfejsu, wymaga sprawdzenia przed szerszym zastępowaniem widoku GOG.
- **Bez zmian:** instalator aktualizacji, system pobierania, pliki, transfer, terminal w trybie bezpiecznym i sterowanie B/Y.

# GameMode Hub 0.5.38 (testowy)

- **Zgłoszenia:** tytuł ma teraz widoczny licznik `0 / 110 znaków` analogicznie do opisu `0 / 1200 znaków`; bez zmiany stylu pól, układu ani obsługi B.
- **ProtonDB — osobny moduł i zakładka:** pobiera rzeczywistą ocenę (Platinum/Gold/Silver/Bronze/Borked/Native/Pending) tylko dla wskazanego Steam AppID. Wyświetla liczbę raportów i odsyła do oryginalnej strony ProtonDB. Nie wymaga konta, tokenów, bramy ani dodatkowego serwera.
- **Cache ocen:** zapisuje maksymalnie 80 wyników per gra w `~/.config/gamemodehub/protondb_badges.json`, ważnych 24 godziny; niepowodzenie próbuje ponownie na żądanie nie wcześniej niż po 30 minutach. Żadnego samoczynnego skanowania bibliotek.
- **Wybór klienta:** Auto (SteamOS), Steam, Heroic, Lutris, Bottles. W tym pierwszym etapie wszystkie używają jawnie podanego Steam AppID; automatyczne kojarzenie gier w innych launcherach i odznaki na kartach SteamOS wymagają osobnych adapterów. Nie ma ryzykownych patchy interfejsu Steam.
- **Licencje:** dodano źródło ProtonDB ODbL/DbCL do podziękowań i informacji prawnych; kod Huba napisany niezależnie od Decky ProtonDB Badges.
- **Bez zmian:** system awaryjny, pomiary DEV, harmonogram Flatpak, pobieranie, transfer, menu Y/B oraz instalator hotfixów.

# GameMode Hub 0.5.37 (testowy)

- **Aktualizacje → Hub / Flatpak / Pozostałe:** osobne podzakładki obsługiwane lewo/prawo; dotychczasowy instalator i kanał Testowy dla pilnych hotfixów pozostają pod Hub. „Pozostałe” nie wywołuje żadnego sprawdzania, dopóki nie dodamy kolejnych źródeł.
- **Moduł sprawdzania:** nowy `update_checks.py` zapisuje listę i datę sprawdzenia Flatpak w `~/.config/gamemodehub/update_checks.json`. Przy wejściu do Pulpitu lub podzakładki Flatpak sprawdza ponownie dopiero po 24 godzinach albo przy pierwszym użyciu. „Sprawdź teraz” wymusza ręczną kontrolę. Nie ma stałego skanowania sieci podczas grania.
- **Osobny wątek i cache:** przeglądanie Huba nie czeka na sieć. Wynik jest wspólny dla Pulpitu i Aktualizacji; błędy mają 30-minutowy odstęp między ponowieniami, a udana instalacja oznacza wynik jako nieaktualny bez natychmiastowego pobierania.
- **Trzy stany:** Uśpiony, Aktywny i Praca w tle, wyliczane z otwarcia Huba i liczby aktywnych pobrań. Bez uruchamiania dodatkowej usługi.
- **DEV w Opcjach Huba:** domyślnie wyłączony. Pokazuje zużycie CPU/RAM samego procesu backendu Decky, stan i daty sprawdzeń; pomiar tylko podczas widocznej strony ustawień z włączonym trybem DEV.
- **Lżejsze Pobieranie:** gdy kolejka jest pusta, kontrola widoku co 30 s zamiast co około 2 s; przy dodaniu zadania aktualizacja widoku następuje natychmiast.
- **Awaryjne odzyskiwanie interfejsu:** pod Otwórz Hub w panelu Decky dodano Odśwież interfejs Huba i Zamknij Hub. Odświeżenie ponownie montuje widok React, nie zabija backendu ani pobierania. Zamknięcie wraca do biblioteki. Skrót klawiaturowy `=` lub ContextMenu otwiera natywne menu awaryjne; przechwycenie fizycznego przycisku `=` w SteamOS nie jest gwarantowane i wymaga testu na Lenovo. Gdy zawiesi się całe Decky, ani skrót, ani menu wtyczki nie mogą zagwarantować ratunku.
- **Bez zmian:** menu Y, B, transfer, sposób instalowania hotfixów i autoryzacja Flatpak/Polkit. Integracja ProtonDB na różne klienty wymaga odrębnego modułu i testów, nie włączono ryzykownych modyfikacji widoków Steam w tym wydaniu.

# GameMode Hub 0.5.36 (testowy)

- **Pulpit — B na Szukaj:** naprawiono dwa przypadki: B na zaznaczonym pasku wyszukiwania ma teraz widoczną reakcję, a po A i anulowaniu edycji fokus powraca do przycisku Szukaj zamiast wysyłać użytkownika poza Hub.
- **Nawigacja SteamOS:** pasek Szukaj ma własny kontener Focusable i obsługę przycisku B z zabezpieczeniem przed podwójną reakcją. Wykorzystuje ten sam mechanizm B co Pliki, z awaryjną obsługą zdarzenia w czasie edycji TextField.
- **Bez zmiany wyglądu:** żadnych nowych przycisków, kolorów, rozwijanych list ani zmian Flatpak, Pobierania czy transferu Wi-Fi.
- **Test regresji:** kontrole obsługi B, powrotu fokusu po edycji i informacji o poziomie głównym. Zachowanie na fizycznym Lenovo wymaga jeszcze potwierdzenia.

# GameMode Hub 0.5.35 (testowy)

- **Naprawiony martwy przycisk aktualizacji:** gdy aktualizacja dotyczy tylko systemowego Firefoksa, można ją teraz wybrać i wysłać do Pobierania.
- **Aktualizuj wszystkie dostępne:** jedna decyzja dodaje zadania dla instalacji użytkownika i systemowej (jeżeli są dostępne), bez klikania każdej aplikacji. Zadania działają kolejno w tle.
- **Standardowe uprawnienia Flatpak:** systemowe aktualizacje korzystają z Flatpak/Polkit bez sudo lub haseł przechowywanych przez Hub. Jeśli konfiguracja SteamOS nie przyzna dostępu, zadanie pokaże błąd zamiast zawieszać interfejs.
- **Testy:** aktualizacja systemowego Firefoksa, deduplikacja zadań według instalacji i bezpieczna obsługa zbiorcza. Działanie na Lenovo wymaga sprawdzenia.

# GameMode Hub 0.5.34 (testowy)

- **Nowy moduł Pobieranie:** osobna kolejka backendu `downloads_manager.py` zamiast trzymania aktualizacji wewnątrz okien Huba. Aktualizacja Flatpak dodawana jest do kolejki i trwa także po zamknięciu okna Huba lub bocznego menu Decky, dopóki działa backend dodatku.
- **Dwa widoki:** Pobieranie w panelu bocznym Decky pod „Otwórz GameMode Hub” oraz jako osobna zakładka w Hubie obok Aktualizacji. Oba widoki pokazują wspólne zadania, ich stan, czas trwania i anulowanie.
- **Bez powielania:** wielokrotne kliknięcie tego samego zadania nie uruchamia go drugi raz; tylko jedno polecenie Flatpak działa jednocześnie. Pozostałe trafiają do kolejki.
- **Historia po aktualizacji wtyczki:** minimalny stan zadań zapisywany w `~/.config/gamemodehub/downloads.json`, bez haseł, logów i tokenów. Po restarcie backendu niezakończone zadania są oznaczane jako przerwane (bez automatycznego ponownego pobierania). Zamknięcie samego okna nie przerywa zadania; przeładowanie całego pluginu/Decky może je przerwać.
- **Bezpieczne zachowanie:** żadnych dodatkowych uprawnień, roota, usług zewnętrznych ani jednoczesnych aktualizacji systemowych Flatpak. Zachowano oryginalne style i obsługę SteamOS.
- **Testy:** kolejka, anulowanie oczekujących zadań, pojedyncze wykonanie, stan po ponownym otwarciu i po restarcie backendu.

# GameMode Hub 0.5.33 (testowy)

- **Flatpak — brak blokady Huba:** polecenie aktualizacji uruchamia się w osobnym, nadzorowanym zadaniu. Kliknięcie Aktualizuj nie czeka kilku minut na odpowiedź i nie blokuje kontrolera.
- **B oraz Zamknij działają podczas pracy:** okno można zamknąć, a po ponownym otwarciu zobaczyć stan nadal działającego zadania. Osobna opcja „Anuluj aktualizację” wysyła sygnał zatrzymania procesu, bez wymuszania wyjścia przez Steam.
- **Aktualizacja wszystkich w jednej operacji:** zamiast aktualizować aplikacje pojedynczo, przycisk „Aktualizuj wszystkie Flatpaki użytkownika” wykonuje jedno polecenie `flatpak --user update --noninteractive --assumeyes`, obejmujące także środowiska uruchomieniowe (runtime). Instalacje systemowe pozostają tylko do odczytu; bez roota.
- **Weryfikacja na bazie AutoFlatpaks:** AutoFlatpaks używa kolejki poleceń `flatpak install --noninteractive --no-auto-pin --or-update`, przede wszystkim dla systemowych pakietów. Hub nie kopiuje mechanizmu roota ani całego interfejsu. Szybkość aktualizacji nadal zależy od pobierania i wielkości paczek; pokazywany jest czas działania, nie fikcyjny procent.
- **Testy:** blokada duplikatów, bezpieczne anulowanie, brak roota i pojedyncze polecenie zbiorcze. Fizyczny pad Lenovo wymaga potwierdzenia.

# GameMode Hub 0.5.32 (testowy)

- **Zgłoszenia — naprawa nawigacji padem:** Tytuł i Opis są wybieralnymi natywnymi wierszami SteamOS. A otwiera edycję, B ją kończy, a góra/dół porusza się między polami jak w Szukaj i Pliki. Tytuł akceptuje strzałkę w dół do opisu.
- **Zgłoszenia — spójny wygląd:** usunięto niebieskie, ręcznie narzucone tło, kolor ramki i zaokrąglenia wielowierszowego pola. Pozostawiono większy opis i licznik 1200 znaków; elementy przeglądania są natywnymi przyciskami SteamOS.
- **Pulpit — stan aktualizacji Flatpak:** automatyczne sprawdzenie przy otwieraniu Pulpitu. Pasek stanu pokazuje Sprawdzanie, Błąd, Brak aktualizacji albo Dostępne aktualizacje: N. Stan odświeża się po aktualizacji.
- **Pulpit → Y na Szukaj:** „Sprawdź aktualizacje wszystkich” i „Aktualizuj wszystkie (użytkownika)”. Zbiorcza aktualizacja wymaga osobnego potwierdzenia i dotyczy tylko aplikacji Flatpak użytkownika, bez roota i bez zmian systemowych.
- **Bez zmian:** transfer Wi-Fi i istniejące funkcje Huba. Test sterowania na rzeczywistym Lenovo nadal wymagany.

# GameMode Hub 0.5.31 (testowy)

- **Zgłoszenia — kompaktowy interfejs:** usunięto rozciągnięte wiersze z etykietami; dwa pola tekstowe z opisem wewnątrz (jak pasek Szukaj/Pliki). Tytuł jest jednolinijkowy.
- **Większy opis:** wielowierszowe pole na pięć wierszy tekstu, limit 1200 znaków i licznik. Respektuje wspólne ustawienie klawiatury SteamOS/fizycznej.
- **Mniej pustych miejsc:** krótka informacja o prywatności i poziomy pasek trzech działań: Kopiuj raport, Zgłoś na GitHub, Istniejące zgłoszenia.
- **Bez zmian:** raport nie wysyła się automatycznie, nie odczytuje tokenów i do opublikowania wymaga konta GitHub. Transfer Wi-Fi, Flatpak, menu Y i pozostałe zakładki niezmienione.
- **Testy:** kontrola zwartego formularza, placeholderów, pola wielowierszowego i limitu 1200 znaków.

# GameMode Hub 0.5.30 (testowy)

- **Zgłoszenia po Podziękowaniach:** nowa sekcja do przygotowania raportu z opisem błędu. Kopiowanie raportu i otwieranie GitHub Issues; GitHub nadal wymaga konta do publikacji. Bez uruchamiania pozornej anonimowej wysyłki. Dodano formularz GitHub Issue i dokument zabezpieczeń planowanej anonimowej bramki.
- **Pulpit → Y → Flatpak:** sprawdzanie dostępnych aktualizacji aplikacji Flatpak bez roota, zarówno dla całego Pulpitu, jak i pojedynczej aplikacji. Aktualizacja pojedynczego **Flatpaka użytkownika** jest możliwa po osobnym potwierdzeniu. Systemowe instalacje można tylko sprawdzać; bez automatycznego sudo/root. Bez automatycznych instalacji w tle.
- **Zabezpieczenia:** backend Flatpak używa wyłącznie stałych list argumentów (bez shell), sprawdza poprawność identyfikatora i obecność aplikacji w instalacji użytkownika. Zgłoszenia nie pobierają automatycznie logów ani danych wrażliwych.
- **Bez zmian:** Transfer Wi-Fi, dotychczasowe sterowanie Y i pozostałe zakładki. Test rzeczywisty na Lenovo nadal potrzebny.

# GameMode Hub 0.5.29 (testowy)

- **Pulpit → Reguły widoku → Resetuj do automatycznych:** przyciski Anuluj/Resetuj korzystają z poziomego kontenera nawigacji SteamOS (lewo/prawo); domyślnie wskazane jest „Anuluj”.
- **Jedno okno:** menu wywołuje otwarcie tylko przez onSelected, a blokada zapobiega utworzeniu drugiego modala przed zamknięciem pierwszego. Ta sama ochrona dotyczy „Pokaż reguły”.
- **Testy:** dodane kontrole poziomego sterowania i pojedynczego okna. Zmiany nie obejmują menu Plików ani transferu Wi-Fi. Fizyczne sterowanie na Lenovo wymaga sprawdzenia.

# GameMode Hub 0.5.28 (testowy)

- **Pliki — obsługa Y:** awaryjne przechwytywanie Y wewnątrz zakładki Pliki, gdy zaznaczony wiersz nie obsługuje zdarzenia. Pozostawiono natywne menu kontekstowe ze wszystkimi akcjami, w tym Transfer Wi-Fi, Kosz, Ulubione, sortowanie, zaznaczanie, kopiowanie i przenoszenie.
- **Pulpit — Reguły widoku:** nowa opcja „Resetuj do automatycznych” w menu Y → Reguły widoku. Po potwierdzeniu przywraca automatyczną klasyfikację wszystkich ręcznie przypisanych aplikacji, nie zmienia Ulubionych, ukrytych aplikacji, skrótów ani sortowania.
- **Testy:** dodano regresje dla obsługi Y i resetu zachowującego pozostałe ustawienia. Sprawdzenie fizycznego Y na Lenovo nadal potrzebne.

# GameMode Hub 0.5.27 (testowy)

- **Transfer Mac → Lenovo — poprawka ORIGIN:** zmieniono politykę Referer z `no-referrer` na `same-origin`. Formularz parowania może teraz przekazać Referer w obrębie tej samej lokalnej strony, bez wysyłania go do obcych witryn.
- **Origin: null:** Safari i Firefox mogą użyć tej wartości przy rygorystycznych ustawieniach prywatności. Serwer dopuszcza ją wyłącznie, gdy Referer dokładnie odpowiada lokalnemu adresowi transferu; odrzuca obce Origin, obce Referer oraz żądania `cross-site`.
- **Zabezpieczenia bez zmian:** prywatny adres IPv4, zgodny Host, wymagany 8-cyfrowy PIN, ograniczenia prób, sesja, limit rozmiaru plików, bez nadpisywania plików i bez roota. HTTP tylko w zaufanej sieci.
- **Testy regresji:** sprawdzono scenariusze `Origin: null` dla `same-origin` i `same-site`, a także odrzucenie obcych żądań. Działanie w rzeczywistych Safari/Firefox wymaga jeszcze potwierdzenia na urządzeniach.

# GameMode Hub 0.5.26 (testowy)

- **Transfer Wi-Fi — diagnostyka odmowy po wpisaniu PIN:** zamiast identycznego komunikatu dla wszystkich blokad serwer podaje kod: SIEC, ADRES, ORIGIN, REFERER lub METADANE. Kody nie ujawniają adresów urządzeń, nagłówków, PIN-ów ani ciasteczek; pozwalają ustalić, co dokładnie zablokowało parowanie na Macu.
- **Safari/Firefox:** jeśli przeglądarka oznaczy żądanie jako „same-site”, serwer zaakceptuje je tylko przy zgodnym Origin albo Referer. Obce strony i połączenia wciąż są odrzucane.
- **Ochrona bez zmian:** wymagany prywatny adres IP, dokładny adres Host, poprawny 8-cyfrowy PIN i sesja dla transferu plików. Bez roota, bez nadpisywania istniejących plików i bez udostępniania innych folderów.
- **Testy:** dodano przypadek poprawnego parowania z „same-site” oraz rozróżnienie powodów odmowy. Na Macu i Lenovo wymagane potwierdzenie przyczyny po aktualizacji.

# GameMode Hub 0.5.25 (testowy)

- **Transfer Mac → Lenovo / SteamOS:** Safari po wpisaniu kodu parowania może wysłać formularz bez nagłówka Origin. Serwer teraz obsługuje takie żądania z tej samej lokalnej strony, nie odrzucając ich automatycznie jako „Odmowa dostępu”.
- **Ochrona pozostaje:** obce Origin, Referer i Sec-Fetch-Site są odrzucane; wymagany jest dokładny lokalny adres IP z portem, lokalne połączenie oraz kod parowania. Wysyłanie plików nadal wymaga aktywnej sesji i nie nadpisuje istniejących plików. Transfer bez sudo i haseł roota.
- **Czytelniejsze kierunki:** okno Transfer Wi-Fi w Hubie i strona w Safari opisują oddzielnie Mac → Lenovo (wybierz plik w Safari i wyślij) oraz Lenovo → Mac (udostępnij wybrany plik w Hubie, a następnie pobierz w Safari).
- **Testy regresji:** nowe testy parowania i przesłania pliku z Safari bez nagłówka Origin oraz odmowy obcych stron i nadpisywania istniejących danych.
- **Nie zmieniono:** Ulubionych, obsługi B, kont i pozostałych funkcji Huba.
- **Uwaga:** HTTP nie jest szyfrowane; tylko zaufana sieć lokalna. Po aktualizacji wymagany test w rzeczywistym Safari na Macu i Lenovo.

# GameMode Hub 0.5.24 (testowy)

- **Pliki — Transfer Wi-Fi:** Y na pasku adresu → „Transfer Wi-Fi…” otwiera panel ręcznego uruchamiania serwera w lokalnej sieci. Hub pokazuje adres dla przeglądarki Maca i 8-cyfrowy kod parowania. Nie wymaga roota, hasła administratora, SSH ani opuszczania Gaming Mode.
- **Mac → Steam Deck:** po sparowaniu użytkownik wysyła pliki z dowolnej przeglądarki; zapis wyłącznie do „Downloads/GameMode Hub Transfer” bez nadpisywania istniejących danych. Pojedynczy plik do 2 GiB.
- **Steam Deck → Mac:** Y na wybranym pliku → „Udostępnij przez Wi-Fi”; plik jest dostępny do pobrania tylko w bieżącej sesji, bez kopiowania i bez udostępniania całego dysku.
- **Ochrona:** transfer jest wyłączony przy starcie, blokowany dla procesów root, przypisany do lokalnego interfejsu IPv4 i kończy się po 30 minutach, po ręcznym zatrzymaniu lub wyładowaniu wtyczki. Pairing z limitem błędnych prób, tokenem ciasteczka i kontrolą Host/Origin. Bez dostępu do plików ukrytych i bez dowiązań.
- **Uwaga o bezpieczeństwie:** połączenie korzysta z lokalnego HTTP bez szyfrowania i jest przeznaczone tylko do zaufanej prywatnej sieci Wi-Fi; nie używać w publicznych sieciach. Uruchomienie wtyczki jako root jest celowo odrzucane.
- **Testy:** nowe testy autoryzacji, upload/download, ochrony przed nadpisywaniem, path traversal i root. Wymagany test na Steam Decku i Macu.

# GameMode Hub 0.5.23 (testowy)

- **Konta / UniFiDeck:** jeśli zainstalowano i włączono UniFiDeck, Hub pobiera przez Decky wyłącznie status zalogowania sklepów ze źródłowej wtyczki. Nie czyta ani nie zapisuje tokenów, haseł lub plików uwierzytelniania; logowanie, wylogowanie i odświeżanie sesji pozostają w UniFiDeck. „Odśwież” sprawdza bieżący stan.
- **Pulpit / Reguły widoku:** w menu Y na pasku pojawia się „Reguły widoku → Pokaż reguły”. Reguły opisują rozpoznawanie Flatpak (X-Flatpak, eksport, polecenie flatpak) i pozostałych aplikacji systemowych.
- **Pulpit / własne kategorie:** Y na aplikacji → „Przypisanie” pozwala ustawić Automatycznie, Flatpak lub Systemowe. To tylko klasyfikacja w Hubie; nie zmienia instalacji ani uruchamiania. Własne ustawienia zapisywane są w preferencjach Huba i zaznaczane na liście.
- **Podziękowania i licencje:** UniFiDeck wymieniony jako projekt zewnętrzny, którego statusy są odczytywane poprzez API.
- **Pozostawiono bez zmian:** Ulubione, obsługę B, kolejność zakładek i funkcję Kosza.
- **Testy:** dodano regresje automatycznej klasyfikacji, ręcznych reguł i odczytu tylko statusów. Wymagany test na urządzeniu z UniFiDeck.

# GameMode Hub 0.5.22 (testowy)

- **Obsługa B:** zidentyfikowano przypadek, w którym B z listy Pulpitu albo korzenia Plików wracał od razu do ekranu Steam. Pulpit przechwytuje teraz anulowanie również poza polem wyszukiwania; zamyka edycję, wraca z kategorii do Wszystkich, czyści wyszukiwanie lub przenosi fokus na pasek. Pliki zachowują B do katalogu nadrzędnego, ale w korzeniu B kieruje fokus na pasek adresu, zamiast opuszczać Huba.
- **Konta:** nowa czwarta zakładka po Terminalu, przed Dodatkami. To przygotowana sekcja, bez fikcyjnego logowania lub przechowywania haseł.
- **Nawigacja:** Pulpit → Pliki → Terminal → Konta → Dodatki → Opcje Huba → Aktualizacje → Podziękowania; brak separatorów.
- **Testy:** regresje sprawdzające przechwycenie B w Pulpicie i Plikach oraz obecność i pozycję Kont. Zachowanie na urządzeniu nadal wymaga potwierdzenia.

# GameMode Hub 0.5.21 (testowy)

- **Nawigacja padem:** usunięto dwa sztuczne separatory w bocznej liście między Terminalem a Dodatkami oraz między Opcjami Huba a Aktualizacjami. Każda zakładka jest teraz sąsiadem następnej, bez dodatkowego kroku góra/dół.
- **Kolejność bez zmian:** Pulpit, Pliki, Terminal, Dodatki, Opcje Huba, Aktualizacje, Podziękowania.
- **Testy:** kontrola braku separatorów i nieprzerwanej kolejności kart. Test interakcji na prawdziwym SteamOS nadal potrzebny.

# GameMode Hub 0.5.20 (testowy)

- **Pulpit — B podczas szukania:** przeniesiono obsługę cofania do grupy SteamOS Focusable. B zamyka edycję i przywraca fokus na pasku, nie powinno zamykać całego Huba. Escape/Enter również kończą edycję bez przekazywania klawisza do routera.
- **Pulpit — ścieżka widoku:** usunięto niepotrzebny, pełnoszeroki przycisk „Pulpit”, który zasłaniał nazwę aktualnego widoku. Nad paskiem wyszukiwania jest tylko czytelna, nieinteraktywna informacja „Pulpit › Wszystkie” lub wybrana kategoria.
- **Pulpit — Widok pod Y:** poprawiono wywołanie wyboru kategorii przez natywne pozycje menu. Kategorie Wszystkie, Ulubione, Systemowe, Flatpak i Ukryte korzystają ze wspólnej, niezależnie testowanej logiki filtrowania oraz sortowania; wyszukiwanie działa wewnątrz każdej kategorii.
- **Testy:** dodano osiem testów zawartości kategorii, wyszukiwania i sortowania oraz regresyjne testy UI przechwycenia przycisku B. Działanie natywnej klawiatury i menu wymaga jeszcze sprawdzenia na urządzeniu.
- **Pozostałe:** kolejność zakładek, ustawienia terminala, Podziękowania i zabezpieczenia Plików bez zmian.

# GameMode Hub 0.5.19 (testowy)

- **Pulpit — wyszukiwarka:** przycisk „Wszystkie” zastąpiono jednym paskiem wyszukiwania jak pasek adresu w Plikach. A otwiera pole wpisywania i klawiaturę SteamOS zgodnie z ustawieniem Huba; filtrowanie działa na bieżąco, również wewnątrz wybranej kategorii.
- **Pulpit — menu Y na pasku:** „Widok” → Wszystkie / Ulubione / Flatpak / Systemowe / Ukryte. „Sortowanie” → Ulubione / ostatnie / A–Z, Nazwa A–Z, Nazwa Z–A lub Ostatnio uruchamiane. Wybrana kategoria widoczna jest jako ścieżka „Pulpit › Kategoria”, a wyszukiwanie, widok i sortowanie zachowują się przy przełączeniu kart (jeśli zapis sesji jest włączony).
- **Nawigacja:** kolejność zakładek Pulpit → Pliki → Terminal → Dodatki → Opcje Huba → Aktualizacje → Podziękowania. Usunięto osobną kartę „Opcje terminala”; rozmiar czcionki przeniesiono do Opcji Huba. Terminal nadal pozostaje w trybie bezpiecznym.
- **Podziękowania:** dodano atrybucję Desktop Apps (Decky, allmazz) oraz standardów freedesktop.org/XDG i informacje licencyjne.
- **Testy:** dodano sprawdzenia układu wyszukiwania, menu Y, kategorii, sortowania i kolejności zakładek.
- **Bez zmian w bezpieczeństwie:** brak odblokowania terminala i brak modyfikacji zabezpieczeń Kosza oraz operacji na plikach. Wymagane sprawdzenie sterowania padem na urządzeniu.

# GameMode Hub 0.5.18 (testowy)

- **Pliki — Kosz:** Y na pliku albo folderze → „Przenieś do Kosza”; osobne okno z nazwą elementu i potwierdzeniem. B anuluje. Usuwanie na zawsze nie jest dostępne.
- **Przywracanie:** Y na pasku adresu → „Kosz” pokazuje wpisy zapisane przez GameMode Hub; A przywraca plik lub folder na pierwotną ścieżkę, bez nadpisywania istniejących elementów.
- **Ochrona:** odmowa przenoszenia katalogu domowego, folderów systemowych i ukrytych konfiguracji; odmowa operacji na dowiązaniach; tylko dysk domowy (nośniki zewnętrzne pozostają nietknięte). Pliki trafiają do standardowego Kosza użytkownika, bez trwałego usuwania.
- **Testy:** nowe przypadki odwracalnego przenoszenia, przywracania, kolizji i zabezpieczeń.
- **Bez zmian:** funkcje Pulpitu, bezpieczny terminal i istniejące operacje kopiowania/przenoszenia.

# GameMode Hub 0.5.17 (testowy)

- **Pliki:** usunięto zbędny tekst „Wstecz” z menu kontekstowych. Przycisk B i krzyżak/pad nadal obsługują cofanie i nawigację.
- **Pliki — Nowy folder:** wybranie z menu Y otwiera osobne okno z polem nazwy i klawiaturą SteamOS (zgodnie z globalną opcją klawiatury); Enter lub „Utwórz” tworzy katalog, a po sukcesie lista jest odświeżana. B zamyka okno bez zmian.
- **Pulpit:** natywna lista aplikacji desktopowych (.desktop, Flatpak) w stylistyce zakładki Pliki: pasek stanu, poziome tagi kategorii, pełna lista nawigowana padem. A uruchamia aplikację przez Steam; Y otwiera krótkie menu Ulubione / Biblioteka Steam / Ukryj. Zapis ulubionych i skrótów pozostaje po aktualizacji.
- **Uruchamianie:** aplikacje uruchamiane są przez API Steam jako skróty, bez wykonywania poleceń powłoki w backendzie. Tymczasowe skróty są sprzątane po zakończeniu i po awaryjnym restarcie Huba.
- **Testy:** dodano testy odkrywania aplikacji, preferencji, układu pulpitu i okna nowego folderu. Wymagany test na rzeczywistym SteamOS/Decky.

# GameMode Hub 0.5.16 (testowy)

- **Pliki — Ulubione:** uproszczono listę do jednej pozycji „Dodaj” i nazw zapisanych folderów. Nie ma już powtarzanych sformułowań „Otwórz zakładkę” i „Usuń zakładkę” ani długich ścieżek przy każdym wpisie.
- **Sterowanie padem:** A otwiera zaznaczoną zakładkę, prawo otwiera opcję „Usuń”, a B cofa. Usunięcie wpisu z Ulubionych nie usuwa katalogu ani plików.
- **Testy:** dostosowano kontrole nawigacji i niedestrukcyjnego usuwania zakładek.
- **Zakres:** pozostałe ekrany, w tym Pulpit, bez nowych zmian w tej wersji.

# GameMode Hub 0.5.15 (testowy)

- **Podziękowania, Pulpit, Terminal:** cofnięto rozwijane opisy. Cały tekst jest zawsze widoczny, jak dawniej. Wiersze tekstu są dostępne dla krzyżaka; fokus automatycznie przewija stronę w dół i w górę, bez używania dotyku.
- **Pliki — ulubione:** nazwy operacji rozróżniają otwarcie zakładki i usunięcie zakładki. Usuwanie zakładki usuwa wyłącznie zapisany skrót, nigdy katalog ani pliki z dysku. Usunięto dodatkowe zagłębione menu „Usuń zapisany folder”.
- **Testy:** nowe kontrole dla stałego tekstu, przewijania kontrolerem i niedestrukcyjnego usuwania zakładek.
- Nie zmieniono struktury plików ani zabezpieczeń kopiowania, ustawień podziału ekranu i bezpiecznego trybu terminala.

# GameMode Hub 0.5.14 (testowy)

- **Pliki — fokus:** po otwarciu katalogu lub przejściu poziom wyżej interfejs przenosi fokus do nowego drzewa zamiast oddawać go zakładkom bocznym. Podczas wczytywania przyciski listy pozostają nawigowalne, co zapobiega utracie fokusu.
- **Pliki — układ:** na górze pokazane są informacje o widoku, sortowaniu, ukrytych elementach i podziale; poniżej poziomy pasek tagów katalogów (lewo/prawo), potem wspólny pasek adresu z menu Y, a bezpośrednio pod nim drzewo plików.
- **Pliki — bez podziału:** lista nadal wykorzystuje 100% dostępnej szerokości. Przy podziale oba panele zachowują osobne katalogi.
- **Sterowanie:** tagi lokalizacji są pojedynczą, poziomą grupą fokusowania; także tag aktualnie otwartego katalogu pozostaje nawigowalny.
- **Bez zmian w bezpieczeństwie:** uruchamianie terminala pozostaje w trybie bezpiecznym; ulubione i schowek z wydania 0.5.13 zostają zachowane.

# GameMode Hub 0.5.13 (testowy)

- **Pliki — ulubione:** menu Y na wspólnym pasku adresu → Ulubione → dodawanie bieżącego folderu, szybkie przechodzenie do zapisanych katalogów i usuwanie wpisów. Lista zostaje zachowana po aktualizacji.
- **Pliki — wybór wielu:** Y na pliku lub folderze → Zaznacz kilka. A zaznacza i odznacza kolejne elementy (również katalogi). B wychodzi z trybu. Menu Y pozwala skopiować/przenieść wybrane elementy.
- **Pliki — wklejanie:** Y na katalogu → Wklej do folderu; Y na pasku adresu → Wklej tutaj. Można kopiować całe foldery modów wraz z zawartością. Wklejanie nie nadpisuje istniejących plików; operacje są ograniczone do dozwolonych katalogów.
- **Pliki — nawigacja:** dwa niezależne panele, jeden pasek adresu wskazujący aktywny panel, stan podziału i przewijanie.
- **Klawiatura:** usunięte zbędne przyciski Przejdź / Anuluj z paska adresu; globalny przełącznik klawiatury ekranowej w Opcjach Huba.
- **Sterowanie padem:** Podziękowania, Pulpit i opisy Terminala mają dostępne nawigowalne sekcje. A rozwija/zwija opis, przechodzenie między elementami padem przewija treść.
- **Bezpieczeństwo:** terminal PTY nadal w trybie bezpiecznym; ustawienia podziału tylko w Plikach; bez pull requestów.

# GameMode Hub 0.5.12

- **Pliki:** opcje otwierane przyciskiem Y na pasku adresu w natywnym menu SteamOS: Nowy folder, Pokaż ukryte, Podziel ekran i Sortowanie (podmenu w prawo). Na stałym pasku pokazujemy jedynie bieżące sortowanie i widoczność ukrytych plików.
- **Nawigacja:** A na pasku adresu umożliwia edycję ścieżki; A na katalogu otwiera katalog, Y na pliku/katalogu pokazuje menu jego działań. Dodano pierwszy wiersz „... — Katalog wyżej”.
- **Przeglądanie:** stałe górne opcje i oddzielny obszar przewijania plików. Podział dotyczy wyłącznie drzewa katalogów i listy plików; przy podziale oba panele przewijają się niezależnie.
- **Sesje:** zachowywanie stanu kart w pamięci przy przełączaniu, w tym otwartego katalogu, zaznaczeń i przewijania; ustawienie globalne w Opcjach Huba. Podział ekranu dostępny tylko w Plikach, nie w Opcjach Huba.
- **Aktualizacje:** natywne menu wyboru kanału (Testowy/Stabilny) i nakładkowa lista dostępnych wersji zamiast rozwijania strony. Bez zmian w zabezpieczeniach instalacji i cofania wersji.
- Kanał **Testowy** (prerelease); brak zmian w wyłączonym terminalu. Wymagane sprawdzenie sterowania kontrolerem na Legion Go S.

# GameMode Hub 0.5.11

- **Opcje Huba** w głównym menu: Zachowuj stan kart (domyślnie włączone) oraz Podział drzewa plików (domyślnie wyłączony). Ustawienia przeżywają ponowną instalację wtyczki.
- **Sesja:** przy zmianie karty zapamiętywane są katalog, edytowany adres, sortowanie, ukryte pliki, zaznaczenie, schowek i operacja zmiany nazwy. Analogicznie zachowywany jest stan aktualizatora, wybrana sesja w bezpiecznym terminalu i ustawienia paneli. Dane sesji tylko w RAM; terminal PTY pozostaje wyłączony.
- Wyłączenie zachowywania sesji natychmiast czyści zapamiętane stany. Stan panelu wraca do domyślnego po jego ponownym otwarciu.
- **Podział pionowy dotyczy wyłącznie obszaru drzewa i listy plików**: foldery z lewej, pliki z prawej; nawigacja kontrolerem góra/dół w kolumnach oraz prawo/lewo między kolumnami. Pasek ścieżki, opcje i reszta Huba pozostają pełnej szerokości.
- W poziomych rzędach używany jest układ nawigacyjny Decky `flow-children="right"` (ten sam mechanizm co w natywnej przeglądarce plików Decky).
- Zachowano natywne menu Y oraz nakładkę sortowania. Brak zmian w terminalu i kanałach aktualizacji.

# GameMode Hub 0.5.10

- Menedżer plików: **Y** przy wskazanym pliku lub folderze otwiera natywne menu SteamOS na wierzchu listy, bez rozciągania wiersza i bez dodawania wysokości.
- Menu pliku: Zmień nazwę, Kopiuj (pliki), Przenieś; wraca standardowym B. Nie ma osobnego „Zamknij”, ikon ⋯ ani dodatkowego ekranu.
- A otwiera folder lub zaznacza plik. Systemowy pasek sterowania wyświetla Y — Opcje na pozycji w liście.
- „Sortuj” otwiera natywne menu na wierzchu, z pozycjami Nazwa A–Z/Z–A, Typ A–Z/Z–A, Rozmiar ↑/↓ i Data ↑/↓. Sortowanie nie przesuwa listy plików.
- Zmiana nazwy odbywa się w tym samym wierszu. Zachowano wybieranie katalogów przez klikalne segmenty ścieżki, ukryte pliki i aktualizator.
- Brak zmian w wyłączonym terminalu. Testy automatyczne nie zastępują sprawdzenia kontrolera na Legion Go S.

# GameMode Hub 0.5.9

- Pliki: A otwiera katalog lub zaznacza plik. X pokazuje działania w tym samym wierszu, bez osobnego menu.
- Zmień / Kopiuj / Przenieś mieszczą się obok nazwy zamiast w nowej sekcji. Usunięto zbędny „Zamknij”.
- Sortowanie przez natywną rozwijaną listę SteamOS: Nazwa A–Z/Z–A, Typ A–Z/Z–A, Rozmiar ↑/↓ i Data ↑/↓. Bez osobnego przycisku strzałki.
- Edytowalna ścieżka obsługuje Enter, ale nie ma przycisku „Przejdź”. Foldery otwierają się przez wybór.
- Odświeżanie pozostaje pod kontrolerem / F5, bez tekstowego przycisku.
- Nadal dostępne: klikalna ścieżka, ukryte pliki, kopiowanie i przenoszenie bez nadpisywania. Terminal bez zmian.

# GameMode Hub 0.5.8

- Systemowy czarny pasek SteamOS pozostaje własnością Steam. Podpowiedzi A (Otwórz/Opcje), X (Opcje), B (W górę/Wstecz) i Y (Odśwież) są deklarowane poprzez natywne właściwości fokusu Decky UI, a nie przez własny pasek.
- A na folderze otwiera go; X pokazuje działania na wybranym folderze/pliku. Nie ma już obok każdego folderu dodatkowego przycisku „⋯”.
- B wraca do nadrzędnego katalogu, dopóki użytkownik pozostaje wewnątrz katalogów. Z katalogu głównego działanie B pozostaje systemowe.
- Usunięto tekstowe „Przejdź”, „Odśwież” i powielony przycisk ↑. Do wpisanego adresu służy Enter lub kompaktowy przycisk ↵. Klawisz F5 i przycisk Y odświeżają listę.
- Zostają edytowalny pasek ścieżki, klikalne segmenty, Ukryte oraz Sortuj. Terminal i aktualizator bez zmian poza numerem wersji.
- Zachowanie systemowego paska wymaga weryfikacji na urządzeniu; API fokusu zależy od wersji SteamOS.

# GameMode Hub 0.5.7

- Minimalistyczny menedżer plików: bez podwójnego tytułu i pól „Bieżący katalog”, „Lokalizacje”, „Nawigacja”, „Stan” oraz „Bezpieczeństwo”.
- Na górze edytowalny pasek pełnej ścieżki. Enter lub przycisk „Przejdź” otwiera wpisany katalog.
- Klikalne segmenty ścieżki (np. Dom › Downloads) służą do przechodzenia do katalogów nadrzędnych.
- Zwięzły pasek: folder nadrzędny, odświeżanie, tworzenie folderu, ukryte pliki włącz/wyłącz, sortowanie po nazwie/rozmiarze/dacie oraz kierunek ↑/↓.
- Pliki i foldery zajmują szerokość panelu. Folder otwiera się jednym przyciskiem, ⋯ wyświetla jego operacje.
- Sortowanie wykonywane przed stronicowaniem po stronie Pythona; foldery pozostają nad plikami.
- Bez zmian w terminalu ani kanałach aktualizacji. Bez dopisków do numeru wydania.

# GameMode Hub 0.5.6 — Pliki w Quick Access

- Dodano własną sekcję **Pliki** w bocznym menu GameMode Hub, bez zależności od zewnętrznej wtyczki Decky Manager.
- Przeglądanie katalogu domowego i nośników dostępnych dla użytkownika SteamOS, nawigacja między folderami, strony po 40 pozycji i pokazywanie ukrytych plików.
- Podstawowe operacje: tworzenie folderu, zmiana nazwy pliku, kopiowanie lub przenoszenie pojedynczych plików między folderami. Przenoszenie folderu w obrębie tego samego systemu plików.
- Operacje zapisu blokowane przy uruchomieniu backendu jako root oraz poza zdefiniowanymi obszarami użytkownika. Brak nadpisywania istniejących plików, uruchamiania plików, kasowania, terminala i wykonywania poleceń.
- Wbudowano testy izolacji ścieżek, walidacji nazw, kopiowania i nawigacji.
- Zachowano numery wersji bez dopisków oraz aktualizator w kanałach Stabilny/Testowy. Terminal bez zmian, nadal wyłączony.
- Testy CI nie zastępują sprawdzenia działania kontrolerem na Legion Go S.

# GameMode Hub 0.5.5 — hotfix aktualizatora

- Poprawiono obsługę pustej lub nieaktualnej odpowiedzi GitHub w przeglądarce Steam: kanał Testowy próbuje wtedy ponownie przez backend Decky.
- Zabezpieczono nieprawidłową odpowiedź backendu przed błędem interfejsu.
- Dodano jednoznaczną instrukcję aktualizacji z 0.5.2: wcześniejsze `/releases/latest` nie wykrywa wydań testowych i wymaga jednorazowej instalacji ZIP przez Decky.
- Zachowano kanały Stabilny (pusty) i Testowy, możliwość wyboru wersji i downgrade.
- Numer wydania zawiera tylko cyfry i kropki; GitHub oznacza wydanie jako prerelease poza nazwą.
- Terminal pozostaje wyłączony dla bezpieczeństwa SteamOS Gaming Mode.

# GameMode Hub 0.5.4 — zwykłe numery wersji

- Kanały Testowy i Stabilny pozostają w aktualizatorze, ale nowe wydania mają **wyłącznie numer**, np. `v0.5.4`, bez nazw i dopisków w tagu.
- O kanale decyduje flaga wydania `prerelease` na GitHubie. Bieżące wydanie jest testowe, a Stabilny pozostaje pusty.
- Starsze wydania, w tym historyczne `v0.5.3-test.1`, zostają zachowane jako możliwe wersje do cofnięcia.
- Zachowano wybór wersji, potwierdzenie downgrade'u, weryfikację SHA-256 i działanie w SteamOS Quick Access przez Decky.

# GameMode Hub 0.5.3-test.1 — kanały aktualizacji i wybór wersji

- Pierwsze wydanie **Testowe** (oznaczone prerelease). Kanał **Stabilny** pozostaje pusty do czasu weryfikacji na urządzeniu.
- Aktualizator pozwala wybrać kanał i konkretną wersję oraz wykonać aktualizację lub **downgrade** po potwierdzeniu.
- Testowy uwzględnia wydania `-test.N` oraz historyczne `v0.5.2` jako awaryjny punkt powrotu (ten sam identyfikator wtyczki). Starsze wydania SteamHub nie są oferowane.
- Używamy oficjalnego okna instalacji Decky: operacja 2 dla aktualizacji i **3 dla downgrade**, zgodnie z typami instalatora Decky.
- Każda wersja musi mieć dokładny adres pliku `GameMode-Hub.zip` i SHA-256 podany przez GitHub.
- Nie ma automatycznych aktualizacji ani automatycznych downgrade’ów. Pobieranie listy wersji odbywa się tylko po naciśnięciu przycisku.
- Terminal nadal pozostaje wyłączony. Wszystkie przestarzałe metody PTY backendu odmawiają uruchomienia lub importowania silnika.
- Pakiet dla Quick Access pozostaje lekki i bez Electrona.
- Zmiana wersji przez wewnętrzny instalator Decky wymaga jeszcze sprawdzenia na Legion Go S.

# GameMode Hub 0.5.2 — Gaming Mode Quick Access

- **Nowa tożsamość wtyczki: GameMode Hub.** Wcześniejsza SteamHub powinna zostać usunięta przed instalacją; to świadoma migracja z zerwaniem zgodności tożsamości.
- Instalator wtyczki to `GameMode-Hub.zip`, a folder w nim ma nazwę `GameMode Hub`.
- Ekran otwierany bezpośrednio z Quick Access SteamOS przez minimalny adapter Decky; nie uruchamia osobnego launchera.
- Kod głównego manifestu funkcji i identyfikatorów jest wydzielony do `src/core`, bez importów Steam ani Decky. W przyszłości będzie można go wykorzystać we własnym launcherze.
- Instalator nie zawiera ciężkiej aplikacji Electron, Flatpak ani AppImage. Wyłączono ich budowanie w GitHub Actions.
- Terminal pozostaje w bezpiecznym trybie nieaktywnym; jego pliki silnika PTY nie są już pakowane do ZIP.
- Aktualizator wskazuje na nowe repozytorium `BlueGalaxySlime/GameMode-Hub` i nowy plik ZIP.
- Nadal wymagane testy na Legion Go S: nawigacja kontrolerem, Quick Access i wtyczki zewnętrzne.

# SteamHub 0.5.0 — samodzielna aplikacja Linux

- Nowa aplikacja Linux uruchamiana bez Steam i Decky.
- Instalatory: `SteamHub-0.5.0-x86_64.flatpak` do KDE Discover i `SteamHub-0.5.0-x86_64.AppImage` do uruchamiania bez instalacji lub samodzielnego dodania skrótu.
- Interfejs w stylu ustawień SteamOS i podstawowa nawigacja kontrolerem.
- Wykrywanie systemu, menedżer plików tylko do odczytu, aktualizacje GitHub i podziękowania.
- AppImage instaluje się w katalogu użytkownika bez `sudo`. Flatpak korzysta z graficznej instalacji Discover.
- Terminal i wykonywanie poleceń pozostają wyłączone po wcześniejszych restartach Steam.
- Dotychczasowa wtyczka `SteamHub.zip` nadal jest dostępna osobno i nie jest wymagana do pracy samodzielnego Huba.
- Automatyczne dodanie do Steam, repozytoryjne aktualizacje Flatpak i działające integracje sklepów pozostają przyszłymi etapami.
- **Pakiety zbudowano w CI; zachowanie na Legion Go S wymaga osobnego sprawdzenia.**

# SteamHub 0.4.14 — bezpieczeństwo Gaming Mode

- Tymczasowo wstrzymano uruchamianie terminala i emulatora xterm.js. Na nagraniu użytkownika uruchomienie modułu poprzedzało restart interfejsu Steam.
- Zostawiono w menu pozycje Terminal i Opcje terminala; dostępne są trzy przyciski sesji, ale nie uruchamiają procesów ani nie wysyłają żądań RPC.
- Backend odrzuca `terminal_start` również dla starych frontendów z pamięci podręcznej Steam, aby ograniczyć ryzyko ponownego uruchomienia powłoki.
- Zachowano silnik Linux PTY w kodzie źródłowym, do dalszego odizolowanego debugowania, bez narażania Gaming Mode.
- Na nagraniu widać traceback bibliotek Pythona z katalogu Unifideck tuż przed restartem. Jest to wskazówka do diagnostyki, **nie potwierdzona przyczyna awarii**.
- Pozostałe sekcje Huba działają tak jak dotychczas.
- Przywrócenie terminala będzie wymagało ustalenia przyczyny restartu oraz testu kompatybilności dodatków.

# SteamHub 0.4.13

## Naprawa uruchamiania backendu Decky

- Naprawiono importowanie `hub_settings` i `terminal_core` z katalogu wtyczki w procesie Decky. Loader używa `spec_from_file_location` i nie dodaje katalogu wtyczki do `sys.path` — przez co `main.py` mógł zakończyć uruchamianie przed obsłużeniem `terminal_ping`.
- Dodano test integracyjny uruchamiający `main.py` w osobnym procesie Pythona z katalogu poza repozytorium, tak jak robi to Decky. Test sprawdza, że import `hub_settings` działa i wywołanie `terminal_ping` zwraca protokół 2.
- Nie zmieniono wyglądu terminala, trzech sesji ani sposobu czyszczenia wyjścia. Nie przywracamy funkcji pełnego ekranu ani przycisku ponawiania, które wcześniej prowadziły do zawieszenia interfejsu.
- Po aktualizacji trzeba przeładować backend SteamHub w Decky, aby proces Pythona uruchomił się z poprawionym `main.py`.

**Uwaga:** poprawność pakowania i testów uruchamiania backendu sprawdza CI; działanie z aktualną wersją Decky na Legion Go S wymaga jeszcze testu na urządzeniu.

# SteamHub 0.4.12

- Dopracowano zachowanie sesji podczas szybkiego przełączania terminali oraz powrotu do Huba w trakcie łączenia z backendem.
- Stan powłoki jest synchronizowany z pamięcią sesji po powrocie do terminala, bez ponownego uruchamiania tej samej sesji.
- Wysyłanie znaków do terminala korzysta bezpośrednio z identyfikatora zapamiętanej sesji, również po odtworzeniu widoku.
- Zachowano trzy sesje 1/2/3, czyszczenie ekranu bez zamykania sesji, brak pełnego ekranu oraz blokadę powtarzanych nieodpowiadających wywołań Decky.

# SteamHub 0.4.11

- Usunięto niedziałającą funkcję pełnego ekranu terminala i przycisk „Ponów”, którego użycie mogło zawiesić SteamOS.
- Zamiast przycisku „+” są trzy małe przyciski sesji 1/2/3. Fizyczne LB/RB nadal pozwalają przełączać między nimi.
- Sesje PTY i ich ograniczony bufor wyjścia pozostają w pamięci podczas przechodzenia między sekcjami SteamHub; nie są zamykane przy opuszczeniu terminala.
- Ikona gumki czyści wyłącznie ekran i jego lokalny bufor, nie kończy działającej sesji.
- Przed uruchomieniem powłoki frontend sprawdza gotowość backendu i wersję protokołu. Przy braku odpowiedzi blokuje kolejne próby oraz odczyty, aby ograniczyć ryzyko zawieszenia Gaming Mode.
- Silnik PTY jest ładowany leniwie: błąd importu terminala nie blokuje uruchomienia innych funkcji SteamHub i diagnostyki backendu.
- Zachowano systemową klawiaturę SteamOS i natywną nawigację kontrolerem.
- Weryfikacja połączenia terminala z backendem nadal wymaga testu na Legion Go S. W razie niezgodności wersji backendu wymagane jest przeładowanie SteamHub w Decky.

# SteamHub 0.4.10

- Przywrócono widoczne podświetlenie fokusu: usunięto noFocusRing, a pasek terminala jest natywną grupą Focusable z nawigacją poziomą SteamOS.
- LB/RB mają niewielkie przyciski ze strzałkami, równe przyciskom klawiatury i pełnego ekranu; fizyczne bumpery nadal przełączają sesje.
- Pełny ekran otwiera terminal w portalu na poziomie dokumentu, poza elementem SidebarNavigation, który ucinał górę interfejsu.
- Podczas przełączania pełnego ekranu zachowujemy istniejący terminal xterm i sesję PTY, przenosząc jego DOM do nowego kontenera.
- Usunięto przestarzały komunikat sugerujący ręczne uruchomienie terminala.
- Wciąż wymagane sprawdzenie zachowania nawigacji kontrolerem i klawiatury na Legion Go S.

# SteamHub 0.4.9

- Usunięto własną klawiaturę ekranową Huba. Ikona klawiatury używa natywnego pola wejściowego SteamOS — technika zaadaptowana z Decky Terminal (BSD-3-Clause).
- Kompaktowy pasek: LB, Terminal 1/2/3, +, RB, klawiatura SteamOS, pełny ekran.
- LB/RB przełączają niezależne sesje (również przyciski kontrolera), + uruchamia nową sesję, maksymalnie trzy.
- Terminal bez dodatkowych nagłówków i przycisków Uruchom / Zamknij. Sesja uruchamia się przy otwarciu.
- Pełny ekran zasłania lewy panel, a w zwykłym widoku terminal zajmuje cały dostępny obszar po prawej; scrollback jest wewnętrzny.
- Diagnostyka połączenia z Decky rozróżnia problem silnika PTY od niedostępności backendu.
- Opcje terminala pozostają po lewej, oddzielone separatorami, zgodnie z SteamOS.
- Kompilacja nie zastępuje testu na Legion Go S; działanie systemowej klawiatury i backendu należy zweryfikować.

# SteamHub 0.4.8

- Naprawiono dostępność klawiatury ekranowej: przycisk „Pokaż klawiaturę” działa również bez uruchomionej sesji i podczas oczekiwania na backend.
- Terminal na górze panelu i tylko jego zawartość jest przewijana. Ekran terminala ma stały obszar, a klawiatura pojawia się pod nim, we własnym przewijanym obszarze.
- Opcje terminala (m.in. czcionka i klawisze dodatkowe) są przeniesione do lewej nawigacji, oddzielone separatorami SteamOS.
- Usunięto podwójne nagłówki „Terminal” i nadmiar wierszy nad ekranem terminala.
- Dodano 12-sekundowy limit oczekiwania na rozpoczęcie sesji; późne odpowiedzi są sprzątane, aby nie pozostawiać osieroconych procesów.
- Terminal nadal korzysta z niezależnego silnika Linux PTY oraz natywnych przycisków SteamOS.
- Wymaga weryfikacji na urządzeniu Legion Go S.

# SteamHub 0.4.7

- W terminalu dodano klawiaturę ekranową obsługiwaną przyciskami kontrolera SteamOS.
- Litery, cyfry, znaki specjalne, wielkie litery, usuwanie, spacja i wysyłanie polecenia.
- Przycisk pokazywania/ukrywania klawiatury; działa niezależnie od globalnej klawiatury Steam.
- Pole wpisywania poleceń i klawiatura są teraz nad oknem wyjścia terminala, więc nie trzeba przewijać całego ekranu.
- Terminal nie przechwytuje już automatycznie fokusu z kontrolek po uruchomieniu sesji.
- Natywny wygląd kontrolek SteamOS i niezależny silnik Linux PTY zostały zachowane.
- Wersja wymaga weryfikacji działania klawiatury kontrolerem na Legion Go S.

# SteamHub 0.4.6

- Natywne formatowanie terminala: wiersze ustawień, przyciski i pole tekstowe Decky UI w stylu SteamOS.
- Wygląd specyficzny dla SteamOS został przeniesiony do adaptera; silnik Linux PTY i widok terminala nadal nie zależą od Decky.
- Nowa pozycja **Podziękowania** w lewym menu — autorzy, wykorzystana praca, licencje i źródła.
- Osobno pokazane integracje zewnętrzne, których kod nie został skopiowany.
- Pełne informacje prawne w `THIRD_PARTY_NOTICES.md`.

# SteamHub 0.4.5

## Niezależny terminal Linux

- Terminal w bocznym menu SteamHub nie wymaga zewnętrznej wtyczki Decky Terminal.
- Silnik PTY w Pythonie jest niezależny od Steam i Decky; adapter transportowy dla Decky jest oddzielny.
- Wbudowany interfejs oparty na xterm.js, sesja uruchamiana ręcznie, obsługa klawiatury i przycisków Ctrl+C/Tab/Enter.
- Ochrona: uruchamianie bez uprawnień root, limit liczby sesji i bufora, zamykanie procesów po wyjściu z ekranu.
- Zachowano Decky Manager bez zmian; stary Decky Terminal może nadal istnieć jako osobny dodatek.
- Nie jest to hotfix ani wersja preview. Działanie wymaga testu na urządzeniu SteamOS.

## Poprzednie zmiany


- Pliki (Decky Manager) i Terminal (Decky Terminal) mają dedykowane sekcje w menu.
- Po wybraniu sekcji panel wtyczki wyświetla się bezpośrednio po prawej, jeśli Decky udostępnia jej interfejs.
- Opcje zaawansowane są rozwijane; niedostępne lub wyłączone wtyczki pokazują zrozumiały komunikat.
- Nie instalujemy ani nie modyfikujemy obcych wtyczek.



Hotfix: sprawdzanie aktualizacji przez Steam WebView z zapasową ścieżką przez backend Decky.


Hotfix aktualizatora i spójnego publikowania: ograniczenie czasu oczekiwania na instalację, zapobieganie ponawianiu przyjętej instalacji i dokładniejszy komunikat potwierdzenia.


Nowy układ w stylu ustawień SteamOS:

- **Quick Access** zawiera jeden przycisk: **Otwórz SteamHub**.
- Przycisk otwiera **pełnoekranowe okno SteamHub** z natywnym bocznym menu.
- **Pulpit:** lista wybranych dodatków Decky i ich stan.
- **Dodatki:** wybieranie dodatków z listy zainstalowanych w Decky; zapis wyboru jest niezależny od ich stanu i aktualizacji.
- **Aktualizacje:** sprawdzanie GitHub Releases oraz instalowanie aktualizacji w oddzielnej zakładce, z limitem czasu i możliwością ponowienia.
- Każdy wybrany dodatek ma osobną pozycję w panelu. Opcje wybranych dodatków: stan, widoczność, odnośnik do Decky oraz możliwość otwarcia oryginalnego panelu zainstalowanej wtyczki (na żądanie). Nowe, natywne opcje mogą być dodawane przez adaptery SteamHub. SteamHub nie zmienia kodu ani konfiguracji obcych wtyczek bez działania użytkownika.
- Usunięto modyfikowanie zakładek biblioteki SteamOS; nie kolidujemy z TabMaster.

Wersja jest wydaniem standardowym. Nie wymaga żadnego trybu preview.


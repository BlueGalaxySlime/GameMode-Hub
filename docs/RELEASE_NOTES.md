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


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


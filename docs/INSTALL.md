# Instalacja GameMode Hub na SteamOS

GameMode Hub **0.5.2** to wtyczka **Quick Access** w Gaming Mode, a nie osobny program z menu Steam. Do otwarcia Quick Access korzysta obecnie z Decky Loader.

1. W Decky usuń wcześniejszą wtyczkę **SteamHub**, jeśli jest zainstalowana. Zmieniamy identyfikator wtyczki — to nowa instalacja.
2. Pobierz `GameMode-Hub.zip` z [GameMode Hub Releases](https://github.com/BlueGalaxySlime/GameMode-Hub/releases/latest) w części **Assets**. Plik `Source code (zip)` nie jest instalatorem.
3. W Gaming Mode otwórz **Decky Loader** i aktywuj **Developer Mode** (jeśli potrzeba).
4. Użyj opcji instalacji wtyczki z ZIP i wybierz `GameMode-Hub.zip`.
5. Naciśnij **⋯** i otwórz **GameMode Hub → Otwórz GameMode Hub**.

Pozostajesz w SteamOS Gaming Mode. Wtyczka nie uruchamia osobnego okna Electron, AppImage ani Flatpak. Nie wymaga przechodzenia do trybu pulpitu, jeśli masz już Decky i możesz wskazać ZIP.

**Ważne:** nie modyfikujemy bezpośrednio interfejsu Steam z pominięciem Decky. Jeśli Decky zmieni API, adapter może wymagać aktualizacji — bez zmian w podstawowych modułach.

Terminal jest wyłączony z powodów bezpieczeństwa. Usunięcie poprzedniej wtyczki nie usuwa danych innych dodatków.

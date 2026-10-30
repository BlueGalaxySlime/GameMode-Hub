# GameMode Hub — plan rozwoju

## Kierunek główny: SteamOS Gaming Mode / Quick Access
- [x] Główny interfejs uruchamiany przez adapter Decky w menu Quick Access.
- [x] Oddzielny manifest modułów bez zależności od Steam/Decky.
- [x] Nowa nazwa / nowa tożsamość pakietu GameMode Hub.
- [x] Mały ZIP wtyczki bez Electron/Flatpak/AppImage i bez uruchamiania terminala.
- [ ] Sprawdzenie na Legion Go S: otwieranie z Quick Access, pad, focus i współpraca z dodatkami.
- [ ] Stabilne adaptery dla menedżera plików, ustawień, dodatków i bibliotek.
- [ ] Przetestowanie na Legion Go S przywróconego na żądanie terminala: PTY, klawiatura Steam, 3 sesje, przejścia między kartami, brak restartu Gaming Mode. Kod testowy w osobnej gałęzi.
- [ ] Ciągła zgodność adaptera z aktualizacjami Decky Loader.

## Opcjonalny etap późniejszy
- [ ] Własny launcher/powłoka gamingowa na Linux/SteamOS, **dobrowolnie wybierana** przez użytkownika.
- [ ] Integracja z Quick Access bez Decky, tylko jeśli możliwa w bezpieczny i stabilny sposób.
- [ ] Instalator wykrywający system operacyjny i oferujący właściwy tryb.
- [ ] Nie zastępuj domyślnego SteamOS bez świadomej zgody użytkownika.

Kod dawnej wersji desktop/Electron w katalogu `desktop/` to archiwalny prototyp; nie jest częścią obecnego wydania.

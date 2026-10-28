# Anonimowe raporty — plan bezpiecznego wdrożenia

GitHub Issues wymaga konta do tworzenia zgłoszeń. Nie wolno umieszczać tokenu
repozytorium w kodzie wtyczki ani w lokalnej przeglądarce Steam.

Docelowy model: Hub → publiczna strona formularza z Cloudflare Turnstile →
serwerless relay (np. Cloudflare Worker) → GitHub API /issues przez token
GitHub App trzymany wyłącznie w sekretach serwera.

Niezbędne zabezpieczenia przed uruchomieniem:
1. Turnstile sprawdzany **po stronie serwera**; token jednorazowy i krótki czas.
2. IP rate limit (np. 2 raporty/godzinę, 5/dobę) z prywatnością retencji.
3. Limit 100 znaków tytułu, 1200 znaków opisu, brak załączników.
4. Deduplikacja hashem treści i tymczasowa kolejka moderacyjna.
5. Domyślny label `needs-triage`, blokada linków, automatyczne zamknięcie po nadużyciach.
6. CORS allow-list + CSRF, kontrola rozmiaru body i egzekwowanie schematu.
7. Bez IP, tokenów, identyfikatorów Steam i logów w treści Issue.
8. Mechanizm natychmiastowego wyłączenia endpointu i ograniczenia wydatków API.

Na obecnym etapie nie uruchomiono żadnego anonimowego endpointu.
Zakładka Zgłoszenia w Hubie przygotowuje lokalny raport i otwiera GitHub
wymagający logowania. Nigdy nie udaje, że raport został anonimowo wysłany.

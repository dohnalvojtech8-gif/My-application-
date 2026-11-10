# Stav dodávky

## Ověřeno

- Produkční build Vite, TypeScript, generování Prisma klienta a migrace na PostgreSQL 16.
- 8 jednotkových testů: přesné částky, neplatné vstupy, plánované platby mimo zůstatek, měsíční/roční/týdenní opakování.
- Integrační scénář: souběžná první registrace, jediný OWNER, uzavření registrace, jednorázová pozvánka, přihlášení, zákaz běžné administrace pro USER, kontrola Origin, izolace OWNER/USER, vytvoření/úprava/smazání/potvrzení, idempotence, opakování bez duplicit, zachování přeskočených výskytů, zákaz cizího uploadu a neplatného obrazového formátu, obnova s novými ID, zákaz obnovy do neprázdného účtu, blokování sessions.
- 10 Chromium/Playwright testů: přihlášení, dashboard, nastavení a analytika při 1440×900 a 390×844; kontrola vodorovného přetečení.
- Render YAML vyhovuje veřejnému schématu draft 2020-12.

## Implementováno, vyžaduje provozní ověření

- Web Push subscription, VAPID worker, centrum upozornění a noční klid: bez testu skutečného doručení na telefon.
- PWA manifest, PNG/SVG ikony, service worker s offline zprávou: instalaci ověřit na cílových prohlížečích.
- Xcode projekt s WidgetKit extension, konfigurací a App Intents pro přímé uložení: lokálně bez macOS/Xcode neověřeno; přidán macOS CI build. Test na fyzickém iPhonu a podpisy zbývají.
- Android AppWidgetProvider s konfigurací, zůstatkem a přímou akcí: debug APK úspěšně sestaveno s JDK 21 a SDK 36. Instalace a funkčnost na fyzickém telefonu zatím neověřena.

## Odchylky od úplného původního zadání

- Widgety jsou implementované pro formulář i přímý zápis předvolených příjmů/výdajů a volitelný zůstatek. Přímý zápis na zamčené obrazovce iOS se nenabízí. Viz [MOBILE.md](MOBILE.md) pro nastavení a platformní omezení.
- Mobilní push používá webovou cestu tam, kde ji systém podporuje; samostatné nativní APNs/FCM doručování není implementované.
- Bez tematických presetů a změny měny (aktuálně CZK), individuálních upozornění na jednotlivé série, úplného auditu systémových událostí a více peněženek.
- Uživatelská obnova nepřenáší série ani preference; kompletní provozní obnova je přes PostgreSQL.
- PDF je export přes tisk prohlížeče. Editace částky/data/komentáře platby používá formulář aplikace.
- Notifikace jsou při síťové chybě doručení zaznamenány v centru; automatický retry fronty push není implementovaný.
- Pokročilé grafy denního panelu, editace typu položky a rozsáhlé E2E pokrytí všech editorů ještě chybí.

Tento soubor záměrně rozlišuje implementaci, ověření a zbývající části. Celé původní zadání nelze označit za kompletně dokončené.

## Aktualizace vizuálního editoru (10. 11. 2026)

- Přepracované rozhraní, sjednocené SVG ikony, dashboard s grafem a formulář úprav plateb místo promptů.
- Samostatný responzivní editor, 3 470 značkových log, univerzální knihovna, barevné presetové styly, gradienty, živý náhled, duplikace, pořadí a mazání.
- Databázové testy ověřují vyřazení smazaných položek z nabídky, zachování historie/zůstatku, pozastavení opakování a zákaz mazání cizích položek.
- Prohlížečové testy na desktopu i mobilu ověřují vytvoření, výběr značky, barvy, perzistenci po obnovení, výměnu ikony, duplikaci a smazání.

## Widgety (10. 11. 2026)

- Serverové předvolby, migrace, oddělené odvolatelné 30denní tokeny, Argon2 opětovné ověření hesla, secure storage v Android Keystore / iOS Keychain. Logout a změna hesla ruší přístupy.
- Integrace ověřuje izolaci uživatelů, nepřístupnost obecného API widget tokenem, omezení částky serverovou předvolbou, pět souběžných duplicitních zápisů jako jedinou platbu, režim FORM, skrytí zůstatku, expiraci a odvolání.
- Playwright ověřuje vytvoření předvolby a otevření předvyplněného formuláře bez automatického zaúčtování na desktopu i mobilním viewportu.
- Android build sestaven; iOS zdroje a CI konfigurace připraveny. Žádný nativní test na zařízení zde není označen za dokončený.

# Stav dodávky

## Ověřeno

- Produkční build Vite, TypeScript, generování Prisma klienta a migrace na PostgreSQL 16.
- 6 jednotkových testů: přesné částky, neplatné vstupy, plánované platby mimo zůstatek, měsíční/roční/týdenní opakování.
- Integrační scénář: souběžná první registrace, jediný OWNER, uzavření registrace, jednorázová pozvánka, přihlášení, zákaz běžné administrace pro USER, kontrola Origin, izolace OWNER/USER, vytvoření/úprava/smazání/potvrzení, idempotence, opakování bez duplicit, zachování přeskočených výskytů, zákaz cizího uploadu a neplatného obrazového formátu, obnova s novými ID, zákaz obnovy do neprázdného účtu, blokování sessions.
- 2 Chromium/Playwright testy: přihlášení, dashboard, nastavení a analytika při 1440×900 a 390×844; kontrola vodorovného přetečení.
- Render YAML vyhovuje veřejnému schématu draft 2020-12.

## Implementováno, vyžaduje provozní ověření

- Web Push subscription, VAPID worker, centrum upozornění a noční klid: bez testu skutečného doručení na telefon.
- PWA manifest, PNG/SVG ikony, service worker s offline zprávou: instalaci ověřit na cílových prohlížečích.
- Xcode projekt s WidgetKit extension a App Intent pro otevření formuláře: bez Xcode/macOS build nelze ověřit.
- Android projekt s AppWidgetProvider: Gradle download v prostředí selhal; Android SDK není instalovaný. APK nebylo sestaveno.

## Odchylky od úplného původního zadání

- Widgety podporují rychlý formulář výdaje; přímé účtování, zobrazení zůstatku a konfigurovatelné oblíbené akce nejsou hotové.
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

# Stav dodávky

## Ověřeno

- Produkční build Vite, TypeScript, generování Prisma klienta a migrace na PostgreSQL 16.
- 10 jednotkových testů: přesné částky, neplatné vstupy, plánované platby mimo zůstatek, měsíční/roční/týdenní opakování.
- Integrační scénář: souběžná první registrace, jediný OWNER, uzavření registrace, jednorázová pozvánka, přihlášení, zákaz běžné administrace pro USER, kontrola Origin, izolace OWNER/USER, vytvoření/úprava/smazání/potvrzení, idempotence, opakování bez duplicit, zachování přeskočených výskytů, zákaz cizího uploadu a neplatného obrazového formátu, obnova s novými ID, zákaz obnovy do neprázdného účtu, blokování sessions.
- 18 Chromium/Playwright testů: přihlášení, dashboard, nastavení a analytika při 1440×900 a 390×844; kontrola vodorovného přetečení.
- Render YAML vyhovuje veřejnému schématu draft 2020-12.

## Implementováno, vyžaduje provozní ověření

- Web Push subscription, VAPID worker, centrum upozornění a noční klid: bez testu skutečného doručení na telefon.
- PWA manifest, PNG/SVG ikony, service worker s offline zprávou: instalaci ověřit na cílových prohlížečích.
- Xcode projekt s WidgetKit extension, konfigurací a App Intents pro přímé uložení: simulátorový build app + extension úspěšně ověřen na macOS v GitHub Actions. Test na fyzickém iPhonu a podpisy zbývají.
- Android AppWidgetProvider s konfigurací, zůstatkem a přímou akcí: debug APK úspěšně sestaveno s JDK 21 a SDK 36. Instalace a funkčnost na fyzickém telefonu zatím neověřena.

## Odchylky od úplného původního zadání

- Widgety jsou implementované pro formulář i přímý zápis předvolených příjmů/výdajů a volitelný zůstatek. Jednotlivé přímé akce na zamčené obrazovce iOS používají systémové ověření; velký panel 5 + 5 se nabízí na ploše. Viz [MOBILE.md](MOBILE.md) pro nastavení a platformní omezení.
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
- Android debug APK a iOS simulátorový build včetně widget extension úspěšně sestaveny. Žádný nativní test na zařízení zde není označen za dokončený.

## Rozšíření widgetů: zamčená obrazovka a panel 5 + 5

- iOS: samostatné widgety Příjem a Výdaj pro otevření listu, jednotlivá přímá akce s požadavkem na místní odemčení a nový panel deseti plateb na domovské obrazovce.
- Android: výběr jednoduchého tlačítka, jedné akce nebo panelu; přímé platby výhradně přes neexportovanou Activity s ověřením systémového zámku. Zámek widgetů závisí na verzi systému/výrobci.
- Server a editor: pevně deset pozic, prohazování řádků, kontrola vlastnictví a typu, prázdné pozice při odstranění předvolby. Žádná platba nevzniká pouhou konfigurací.
- Android debug build i iOS simulátorový build této aktualizace včetně všech widgetů prošly v GitHub Actions (Native apps, běh 42823446720). Webové CI rovněž prošlo (Validate, běh 42823446727). Ověření na skutečném iPhone 13 a Android telefonu není provedeno.

## Bankovní integrace (10. 11. 2026)

- Implementováno Enable Banking AIS: živý katalog podle země a osobního/firemního účtu (včetně dostupných konektorů Revolutu), autorizace, souhlasy, zůstatky, stránkovaná synchronizace, import/párování a odpojení.
- Bankovní zůstatky zůstávají v původní měně, evidence je nadále CZK. Nejde o záruku podpory všech bank a produktů ani o automatické bankovní účtování bez kontroly uživatele.
- Testy používají skutečnou PostgreSQL a testovací odpovědi poskytovatele. Živý ani poskytovatelův sandbox účet nebyl připojen; aktivaci a vlastní klíče musí zajistit provozovatel podle [BANKING.md](BANKING.md).
- Automatický worker potřebuje stejné bankovní klíče jako web. Sestavení nativních aplikací nezajišťuje jejich podpis ani instalaci na uživatelův telefon.

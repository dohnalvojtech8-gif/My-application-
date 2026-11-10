# SYSTEMATIC MONEY

Česká aplikace osobních financí s React/Vite/TypeScript, Tailwind, Recharts, Express a PostgreSQL/Prisma. Obsahuje web, PWA a zdrojové projekty Capacitor pro iOS/Android. Stav a limity jsou v [STATUS.md](STATUS.md); Android debug build a iOS simulátorový build prošly, testy na fyzických telefonech zbývají.

## Lokální spuštění

Node.js 22+, PostgreSQL 16+. Zkopírujte `.env.example` do `.env`, nastavte `DATABASE_URL` a `APP_ORIGIN=http://localhost:3000`. Proměnné načtěte do shellu: `set -a; source .env; set +a`.

```sh
npm ci
npm run migrate
npm run build
npm start
```

Otevřete http://localhost:3000. Vytvořte první účet (OWNER, heslo nejméně 12 znaků). Veřejná registrace se poté uzavře. Pozvánky vytváří OWNER v Profilu; ostatní účty začínají prázdné. Nejdříve založte příjmové/výdajové položky v Nastavení.

Pro vývoj backendu `npm run dev`; klient po změnách sestavte `npm run build`. Produkční Express obsluhuje web i API na stejném originu.

## Funkce

- Session cookies HTTP-only/Secure v produkci, Argon2, atomická první registrace, jednorázové pozvánky, blokace účtů, změna hesla odhlašující sessions.
- Oddělení financí na serveru; OWNER nemá administrátorský endpoint k cizím finančním datům. Složený databázový cizí klíč chrání vazbu platby a položky stejného uživatele.
- Částky v haléřích přes BigInt; plánované platby nemění zůstatek a nikdy se automaticky nepotvrzují. Potvrzení dovoluje skutečné minulé/dnešní datum. Idempotentní vytvoření platby.
- Dashboard, týdenní a měsíční kalendář, denní součty, analytika, TOP 5/10, průměry, nejvyšší platby, porovnání období, vyhledávání, CSV a tisk/uložení PDF.
- Položky s barvami, gradientem, ikonami, vybranými značkami Simple Icons, bezpečně překódovaným uploadem, oblíbením/skrytím/pořadím/důležitostí, výchozí částkou a živým náhledem.
- Opakování den/týden/měsíc/rok, interval, konec/počet, pozastavení generování, úprava série/výskytu a přeskočení (smazání výskytu). Uskutečněné a přeskočené výskyty se znovu negenerují.
- Preference, rychlé částky, seznam/mřížka, JSON export a obnova transakcí/položek do prázdného účtu.
- Centrum upozornění, Web Push subscription a cron worker s nočním klidem. Doručení na fyzická zařízení není ověřeno.

## Render

Nasazení provádí majitel repozitáře. New → Blueprint → tento repozitář. `render.yaml` deklaruje web, PostgreSQL a cron (mohou být placené). Struktura byla ověřena proti veřejnému schématu Render. Nastavte `APP_ORIGIN` na přesný HTTPS origin bez koncového lomítka. TLS zajišťuje Render.

Vygenerujte vlastní VAPID klíče příkazem `npx web-push generate-vapid-keys`. Ve webové službě nastavte veřejný klíč, v cronu stejný veřejný i soukromý klíč a `VAPID_SUBJECT=mailto:vas@email.cz`. Soukromý klíč patří výhradně do Render secrets. Cron každých 15 minut generuje budoucí platby a upozornění. Bez klíčů je dostupné centrum upozornění, nikoli doručení push.

Migrace běží před startem aplikace. Pro více instancí použijte jednorázový pre-deploy krok a sdílený rate-limit store; současné omezení požadavků je v paměti jedné instance.

## Ověření

```sh
npm run build
npm test
# Použijte pouze samostatnou testovací databázi, tento test ji čistí!
TEST_DATABASE_URL=postgresql://.../systematic_test npm test
DATABASE_URL=postgresql://.../systematic_test npx playwright test
```

Integrační test nejprve vyžaduje migrace v testovací DB. Playwright scénáře navazují na účty vytvořené integračním testem. CI připravuje vlastní PostgreSQL a spouští oba kroky.

Ověřeno lokálně i ve webovém CI: TypeScript a produkční build, 10 jednotkových testů a 3 rozsáhlé integrační scénáře (13 testů Vitest), 18 Playwright testů pro mobil/desktop. Přesný rozsah v STATUS.md. Nejde o nezávislý bezpečnostní audit.

## Mobil a provoz

[PWA, iOS, Android a widgety — návod](MOBILE.md). Podepisovací klíče, Apple Developer účet a Android SDK nejsou součástí repozitáře.

Pro úplnou zálohu včetně sessions, pozvánek a konfigurace použijte PostgreSQL `pg_dump` do šifrovaného úložiště a ověřte `pg_restore` do samostatné databáze. Uživatelská JSON obnova obnovuje položky/transakce a počáteční zůstatek, nikoli série, preferences, sessions či push odběry. Databázový administrátor technicky disponuje přístupem k databázi; aplikační OWNER takové API nemá.

[Licenční informace k ikonám](LICENSES.md). Nikdy necommitujte `.env`, privátní VAPID klíč nebo mobilní keystore.

## Řešení potíží při prvním spuštění

Aplikace nejprve ověří databázi. V prázdné databázi automaticky nabídne **Vytvoření hlavního účtu** a po úspěšné registraci uživatele přihlásí. Vlastní heslo musí mít alespoň 12 znaků; uživatelské jméno nejméně 3 znaky, bez mezer a bez e-mailové adresy.

Pokud se zobrazí „Databáze není připravená“, nejde o heslo. Ve službě Render ověřte `DATABASE_URL` (skutečné PostgreSQL připojení) a dokončení migrací. `npm start` nyní provádí migrace automaticky přes `prestart`. `/api/health` kontroluje také dostupnost registrační tabulky. Aplikace přijímá svůj Render origin z důvěryhodné proměnné `RENDER_EXTERNAL_URL`; vlastní doménu nastavte v `APP_ORIGIN`. Koncové lomítko nevadí.

## Vizuální editor položek

V Nastavení otevřete **Položky & vzhled**. Příjmy a výdaje mají vlastní seznamy. Editor obsahuje vyhledávání v 3 470 značkách Simple Icons, univerzální ikony Lucide s českými názvy, vlastní obrázky, barevné styly, HEX barvy, směr gradientu, tvar a provedení karty a živý náhled. Změny uložte tlačítkem **Uložit položku**. Položku lze duplikovat, přeuspořádat nebo smazat.

Smazání položku vyřadí z nových plateb; historické a již naplánované transakce zůstanou zachovány, generování jejích opakování se pozastaví. Nová migrace přidává `Item.deletedAt` a proběhne při `npm start`. Žádná uživatelská finanční data se migrací nemažou.

## Systémové widgety

V Nastavení → Widgety a rychlé akce lze připravit vlastní položky a částky pro příjmy i výdaje, s formulářem nebo přímým uložením. Připojení telefonu, volitelný zůstatek, ochrana proti duplicitám, sestavení iOS/Android a instalace jsou popsány v [MOBILE.md](MOBILE.md). PWA sama systémové widgety neposkytuje. Workflow **Native apps** sestavuje Android debug APK a kontroluje iOS simulátorový build; stav skutečného ověření je v [STATUS.md](STATUS.md).

[Srovnání funkcí se Spendee a návrhy dalšího rozvoje](FEATURE_COMPARISON.md).

[Instalovatelná aplikace bez vlastního Macu: TestFlight, podpisy a Google Play](DISTRIBUTION.md). Workflow pro vydání jsou připravené; žádná aplikace zatím nebyla zveřejněna v obchodech ani dodána do TestFlight.

## Bankovní účty a Revolut

Nastavení obsahuje připojení účtů přes Enable Banking, živý katalog dostupných bank podle země a typu účtu, bankovní zůstatky, pravidelnou synchronizaci, kontrolovaný import a párování transakcí. Provoz vyžaduje vlastní aktivovaný přístup poskytovatele; živé propojení nebylo při vývoji ověřeno. Rozsah bank, omezení měn, aktivace na Renderu a bezpečnost jsou v [BANKING.md](BANKING.md).

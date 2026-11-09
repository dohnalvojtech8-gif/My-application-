# SYSTEMATIC MONEY

Rozpracovaná finanční aplikace. **Není dokončenou implementací celého zadání ani auditovanou produkční platformou.**

## Spuštění

Node.js 22+, PostgreSQL 16+. Zkopírujte `.env.example` do `.env`, nastavte vlastní přístup k databázi. Proměnné načtěte do prostředí (např. `set -a; source .env; set +a`).

```sh
npm ci
npm run migrate
npm run build
npm start
```

Otevřete http://localhost:3000. Vytvořte první účet (OWNER), heslo alespoň 12 znaků. Další registrace vyžadují pozvánku z Profilu. V Nastavení vytvořte vlastní příjmové a výdajové položky. Žádná finanční data nejsou předvyplněna.

## Implementováno

- React/Vite/TypeScript, Express, Prisma/PostgreSQL.
- Jednorázový OWNER chráněný primárním klíčem Bootstrap uvnitř transakce; jednorázové pozvánky s expirací.
- Argon2, hashované session tokeny, HTTP-only cookies, kontrola Origin pro zápisy, omezení požadavků, Helmet, validace Zod.
- Finance v haléřích pomocí BigInt, filtrování podle uživatele, složený cizí klíč položky a uživatele.
- Vytvoření a smazání platby, plánované platby, ruční potvrzení skutečného data, idempotentní vytvoření.
- Dashboard, měsíční kalendář, základní sloupcový graf a CSV export, základní položky, počáteční zůstatek.
- API blokování uživatelů; administrace neposkytuje finanční data jiných účtů.
- Responzivní design podle dodané reference, vysouvací/připínací panel.

## Render

Nasazení není provedeno. Na Render zvolte New → Blueprint a tento GitHub repozitář. Zkontrolujte cenu zvolených služeb. APP_ORIGIN nastavte na přesný HTTPS origin aplikace bez koncového lomítka. Render ukončuje TLS; aplikace používá Secure cookies v produkci. Migrace běží při startu. Pro více instancí přesuňte migrace do jednorázového pre-deploy kroku a rate limit do sdíleného úložiště.

## Testy a omezení

`npm test` ověřuje převod částek, odmítnutí neplatných částek a vyloučení plánovaných plateb ze zůstatku. To nenahrazuje integrační bezpečnostní testy. Úplný seznam chybějících částí je v STATUS.md.

## Mobil a PWA

PWA manifest/service worker a nativní projekty dosud nejsou implementovány. Aplikaci nelze označovat za hotovou PWA ani sestavenou iOS/Android aplikaci. Návod na jejich sestavení bude možný až po vytvoření skutečných projektů. Žádné widgety nyní nejsou dostupné.

## Provoz

Před veřejným provozem dokončete integrační a bezpečnostní testy, distribuovaný rate limiting, zálohy a obnovu. Zálohu PostgreSQL provádějte `pg_dump` do šifrovaného úložiště, obnovu ověřujte v oddělené databázi. Databázový administrátor technicky disponuje přístupem k datům; aplikační OWNER takové API nemá. Nikdy necommitujte `.env`.

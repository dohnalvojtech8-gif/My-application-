# Bankovní účty: aktivace a rozsah

Integrace používá **Enable Banking Account Information API**. Implementuje skutečné volání API, autorizaci uživatele, načtení účtů, zůstatků a zaúčtovaných transakcí. Bez vlastní aktivované aplikace u poskytovatele a serverových klíčů nebude živé připojení fungovat. Žádný skutečný bankovní účet nebyl při vývoji připojen.

## Podpora bank a Revolutu

V Nastavení → Bankovní účty zvolte zemi, osobní nebo firemní účet, načtěte aktuální banky a vyhledejte banku. Nabídka pochází z `/aspsps`, nikoli z pevného seznamu slibujícího univerzální podporu. Včetně Revolutu se dostupnost a typ účtu ověřují podle poskytovatele.

Výběr zahrnuje Česko, Německo a další evropské země. **Není zaručena každá licencovaná banka ani každý produkt Revolutu.** Open Banking obvykle zpřístupňuje platební účty; dostupnost spoření, společných, dětských, investičních či dalších produktů rozhoduje banka a poskytovatel. Aktuální přístupné účty vrátí až autorizace. Revolut Business je volitelný typ uživatele v Open Banking, nejde o použití jeho samostatného Business API. K žádnému bankovnímu heslu aplikace nemá přístup.

Podklady: [coverage](https://enablebanking.com/open-banking-apis), [Česko](https://enablebanking.com/docs/markets/cz), [Revolut Open Banking](https://developer.revolut.com/docs/guides/build-banking-apps/introduction-to-the-open-banking-api/who-can-access-the-api), [aktuální změny včetně Revolutu](https://enablebanking.com/blog/2025/11/05/enable-banking-changelog-october-2025).

## Co musí udělat provozovatel

1. Založte účet v [Enable Banking](https://enablebanking.com/sign-in/) a vytvořte API aplikaci podle [návodu](https://enablebanking.com/docs/api/control-panel/). Pro testy vyberte Sandbox. Pro své skutečné osobní účty lze použít omezenou produkční aktivaci jejich propojením v Control Panelu.
2. Pro veřejnou aplikaci a účty dalších lidí poskytovatel vyžaduje smlouvu a obchodní ověření. Firemní nebo komerční provoz nelze považovat za bezplatné osobní testování. Podmínky a cenu sjednává provozovatel; tento projekt nic neobjednává. Viz [FAQ](https://enablebanking.com/docs/faq/) a [podmínky](https://enablebanking.com/terms/).
3. Při registraci aplikace nastavte návratovou adresu přesně `https://my-application-99m3.onrender.com/bank/callback` (nebo odpovídající adresu vašeho serveru). Povolte použití pro informace o účtech. Integrace neposílá platby.
4. Získejte Application ID a soukromý RSA klíč v Control Panelu. Klíč uložte do **Render Secret File**; ne do GitHubu, chatu ani klientské aplikace. Do prostředí webu nastavte:

| Proměnná | Hodnota |
|---|---|
| `BANK_PROVIDER_MODE` | `sandbox` pro testovací aplikaci; `production` pro produkční aplikaci |
| `BANK_APP_ID` | UUID aplikace od poskytovatele |
| `BANK_PRIVATE_KEY_FILE` | Např. `/etc/secrets/enable-banking.pem` |
| `BANK_PRIVATE_KEY` | Alternativa k souboru: PEM v tajné proměnné; nenastavujte obě varianty |
| `BANK_DATA_KEY` | Vlastní náhodný 32bajtový klíč jako 64 HEX znaků, viz níže |
| `BANK_REDIRECT_URL` | `https://my-application-99m3.onrender.com/bank/callback` |
| `APP_ORIGIN` | `https://my-application-99m3.onrender.com` |

Samostatný šifrovací klíč vygenerujte lokálně příkazem `openssl rand -hex 32`. Uložte jej rovnou do správce tajemství. Bez stejného klíče nebudou po obnově databáze použitelné uložené souhlasy. Klíč nezaměňujte s privátním RSA klíčem poskytovatele.

5. Pro automatické aktualizace nastavte stejné bankovní proměnné a secret file také ve službě spouštějící `npm run worker`. Stávající cron ji spouští každých 15 minut; jednotlivé připojení se aktualizuje nejvýše jednou za 6 hodin. Bez workeru lze použít ruční aktualizaci se stejným limitem.
6. Nasaďte aktuální `main`. `npm start` provede databázovou migraci. Otevřete Nastavení → Bankovní účty a připojte banku. Po návratu zvolte dokončení ve webu nebo návrat do nativní aplikace. Přihlášení musí být pod stejným účtem SYSTEMATIC MONEY, který připojení zahájil.
7. Po dokončení autorizace spusťte Aktualizovat účty; další aktualizace zajistí worker. V omezené produkční aplikaci může poskytovatel vrátit prázdný seznam, pokud nebyl účet předem povolen v Control Panelu.

## Import a součty

- Načítají se zůstatky jednotlivých bankovních účtů a nejvýše posledních 90 dní **zaúčtovaných** transakcí. Skutečná historie závisí na bance a souhlasu. Rozpracované kartové blokace nejsou zaúčtovány.
- Bankovní zůstatky se zobrazují odděleně v původní měně. Automaticky se nepřičítají k osobnímu zůstatku aplikace, aby se nesmíchaly historie a ruční zápisy.
- Každou načtenou platbu lze **přidat do evidence**, **spárovat s již zadanou platbou** nebo **vynechat**. Vlastní převody lze vynechat, aby se nevydávaly za spotřebu či nový příjem. Automatické párování převodů není implementované.
- Osobní evidence zatím pracuje v CZK. Pro bankovní platbu v jiné měně uživatel zadává korunovou hodnotu; automatické kurzy ani více měn v hlavním zůstatku nejsou hotové. Původní částka/měna zůstává v bankovní historii.
- Při párování musí existující platba patřit témuž uživateli a mít stejnou korunovou částku, směr a uskutečněný stav. Jedna ruční platba nesmí být spárována dvakrát.
- Identita účtu je stabilní přes obnovení souhlasu. Pro transakce se používá stálé `entry_reference`; dokumentace poskytovatele výslovně nedovoluje považovat `transaction_id` za stálé ID.
- Když banka stálé ID neposkytne, stejné výskyty se uchovají jednotlivě a označí k ruční kontrole. Před importem je nutné potvrdit kontrolu duplicity. Nelze garantovat automatické rozlišení všech oprav bankovních dat bez stálého ID.
- Smazání již importované platby v osobní evidenci nezpůsobí její tiché opětovné vytvoření při další synchronizaci. Bankovní historie zůstává označená jako zpracovaná.

## Bezpečnost a odpojení

Server podepisuje krátkodobé JWT privátním RSA klíčem. Session ID a bankovní identifikátory pro čtení účtu jsou v databázi šifrované AES-256-GCM. Klient je neobdrží; účet se zobrazuje se zkráceným IBAN. Data jsou autorizována podle uživatele, včetně vlastníka platformy.

Návrat používá jednorázový náhodný `state`, který patří přihlášenému účtu a platí 15 minut. Kód se po načtení stránky odstraní z adresního řádku. Nezapínejte logování query parametrů návratové adresy na proxy. U nativní aplikace autorizace probíhá v systémovém prohlížeči přes Capacitor Browser, nikoli v aplikací vytvořeném formuláři na bankovní heslo.

Odpojení okamžitě zastaví místní synchronizaci a požádá poskytovatele o zrušení session. Pokud poskytovatel zrušení nepotvrdí, UI ukazuje potřebu odpojení zopakovat; lze také odebrat souhlas přímo v bance. Načtené platby a dřívější zápisy se odpojením nemažou. Souběžné ruční/cron synchronizace používají databázový zámek s expirací; import stejné platby používá transakci a unikátní klíče.

## Co bylo ověřeno

- Testy na skutečné PostgreSQL s **testovacími odpověďmi poskytovatele**: stav autorizace a opakovaný callback, izolace účtů, stránkování, opakovaná i souběžná synchronizace, čtyři souběžné importy jako jediný zápis, ruční párování, šifrování, odpojení a databázové cizí klíče.
- Jednotkové testy podpisu JWT, integrity šifrování a identity transakcí.
- Prohlížečové testy importu EUR s potvrzenou korunovou hodnotou a očištění návratové adresy.
- Nebylo ověřeno živé připojení k Revolutu ani jiné bance, chování bankovní aplikace při přesměrování na skutečném telefonu ani poskytovatelův sandbox s přiděleným Application ID. Tyto kroky vyžadují jeho aktivované přístupy a souhlas majitele účtu.

Technický zdroj: [API reference](https://enablebanking.com/docs/api/reference/) a [Quick Start](https://enablebanking.com/docs/api/quick-start/).

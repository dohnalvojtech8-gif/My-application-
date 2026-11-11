# SYSTEMATIC MONEY a Spendee

Stav zpracování: 10. listopadu 2026. Spendee je popsáno podle oficiální dokumentace, nikoli podle vlastního měření nebo testu placeného účtu. U SYSTEMATIC MONEY vychází stav z kódu a provedených kontrol. Nenalezená informace neznamená, že funkce v konkurenční aplikaci neexistuje. „Potenciální výhoda“ je hypotéza k ověření s uživateli.

## 1. Funkce Spendee

| Oblast | Doložená funkce a omezení | Zdroj |
|---|---|---|
| Mobil a web | iOS, Android a synchronizované webové rozhraní. Web nabízí analýzy, filtry, import a hromadné úpravy. | [Web](https://help.spendee.com/article/199-spendee-web-app), [platformy](https://help.spendee.com/article/200-is-spendee-for-free) |
| Evidence a přehledy | Příjmy, výdaje, přehled více peněženek a období. | [Přehled](https://help.spendee.com/article/169-all-wallets-overview) |
| Bankovní propojení | Premium: import z podporovaných bank, e-wallets a kryptopeněženek. Podpora konkrétní banky se musí ověřit. | [Premium](https://help.spendee.com/article/202-what-is-spendee-premium) |
| Automatické zařazení | Kategorizace importovaných bankovních transakcí. | [Premium](https://help.spendee.com/article/202-what-is-spendee-premium) |
| Peněženky | Basic jedna hotovostní peněženka; Plus/Premium neomezené peněženky. | [Tarify](https://www.spendee.com/pricing) |
| Rozpočty | Basic jeden; placené tarify více. Upozornění při 75 % a 90 % rozpočtu. Ceník uvádí dostupnost na mobilu, web zatím ne. | [Rozpočty](https://help.spendee.com/article/131-budget-my-money), [tarify](https://www.spendee.com/pricing) |
| Sdílení | Sdílené hotovostní peněženky; předplatné potřebuje vlastník. Bankovní peněženky a samotné rozpočty se podle nápovědy nesdílejí. | [Sdílení](https://help.spendee.com/article/224-shared-wallets) |
| Plánování | Budoucí jednorázové a opakované transakce; opakování jen pro ruční peněženky. | [Plánované transakce](https://help.spendee.com/article/229-scheduled-transactions) |
| Kategorie a štítky | Vlastní názvy, barvy a ikony kategorií; více štítků u transakce. | [Kategorie](https://help.spendee.com/article/227-how-to-create-a-custom-category), [štítky](https://help.spendee.com/article/237-what-are-labels-and-how-to-use-them) |
| Účtenky | Magic AI Scan v Premium: načtení částky, kategorie a poznámek/štítků z účtenky. | [AI Scan](https://help.spendee.com/article/248-magic-ai-scan) |
| Import a export | Web importuje CSV/XLS; mobil exportuje CSV/XLS. Basic export posledních 365 dnů, placené tarify bez tohoto omezení. Webový export podle nápovědy není dostupný. | [Web](https://help.spendee.com/article/199-spendee-web-app), [export](https://help.spendee.com/article/137-export-transactions) |
| Zámek aplikace | Kód a Touch/Face ID. | [Zabezpečení](https://help.spendee.com/article/153-passcode-touch-id-fingerprint) |
| Vzhled | Světlý, tmavý a systémový motiv. | [Motivy](https://help.spendee.com/article/241-light-dark-mode) |
| Widgety 5 + 5 a vlastní brandový editor | V prověřených oficiálních podkladech nebyla doložena přesně tato podoba. Není to důkaz nepřítomnosti všech widgetů nebo jiných možností přizpůsobení. | [Přehled dokumentace](https://help.spendee.com/category/129-spendee-features) |

## 2. Současné funkce SYSTEMATIC MONEY

„Implementováno“ neznamená nezávislý audit ani úplné pokrytí testy. Nativní kompilace není test chování na telefonu.

| Funkce | Skutečný stav | Ověření / hranice |
|---|---|---|
| Web, PWA, iOS a Android | Společný backend, databáze a účet; nativní aplikace s Capacitor a vlastními widgety. | Web build, Android APK i iOS simulátorový build prošly. V obchodech nezveřejněno. |
| Uživatelé a soukromí | OWNER, hromadné jednorázové pozvánky s přehledem aktivací, blokace, sessions; uživatelská data oddělena na serveru. | Integrační kontroly izolace a souběžné aktivace, registrace přes kód v E2E; není to nezávislý bezpečnostní audit. |
| Příjmy a výdaje | Vytvoření, úprava, smazání až v detailu, počáteční zůstatek každého účtu, přesné uložení v haléřích. | Výpočty a API pokryty testy. Evidence v CZK. |
| Skutečné versus plánované | Plánované platby se do zůstatku započtou až po potvrzení se skutečným datem. | Ověřeno integračně. |
| Dashboard a kalendáře | Období, týdenní a měsíční kalendář, denní platby a součty. | Responzivní web testován ve dvou velikostech. Denní analytický panel má prostor pro rozšíření. |
| Statistiky | Barevné grafy s procenty, míra úspor, vývoj zůstatku, TOP 5/10, četnost, průměry, maxima, porovnání období, vlastní rozsah a kombinované filtry. | Výpočty jednotkově; E2E ověřují procenta, filtrování, detail a společný výběr účtu. Nikoli všechny kombinace filtrů. |
| Editor položek | 3 470 log Simple Icons a 26 dalších log pro ČR, filtry značek/měst/dopravy, univerzální ikony, upload, HEX, gradienty, náhled, oblíbené, pořadí, duplikace a smazání. | Desktop/mobil E2E, ověření lokálních obrázků a testy zachování historie při smazání. Zdroje log v CZECH_LOGOS.md. |
| Opakování | Den/týden/měsíc/rok, interval, konec/počet, pauza, přeskočení, změna výskytu a cílový účet. Přehled sérií s projekcí na 30 dní a platbami po splatnosti. | Generování, přesunuté/přeskočené výskyty a vybrané kalendářní hraniční případy testovány. |
| Widget Příjem/Výdaj | Otevře příslušný list bez zápisu; na iOS i v zamčených accessory slotech. | Oba webové cíle otestované; nativní ovládání na telefonu ještě ne. |
| Přímá widgetová platba | Předvolená částka, systémové ověření, omezený token, ochrana proti opakovanému požadavku. | Backend a sestavení ověřeny. iOS může využít již odemčený stav; nejde o vynucení nového kódu pokaždé. |
| Panel 5 výdajů + 5 příjmů | Deset pevných pozic, prázdné sloty, prohození řádků, nastavení z webu. | API/E2E ověřeny. iPhone: plocha; Android zámek: jen podporované systémy/výrobci. |
| Upozornění | Centrum, Web Push a plánovací worker. | Skutečné doručení na telefon neověřeno; nativní APNs/FCM chybí. |
| Export a obnova | Filtrovaný CSV, PDF přes tisk, JSON záloha účtů, položek, transakcí, převodů a sérií. | Obnova do prázdného účtu testována; kompletní obnovu serveru z PostgreSQL je třeba provozně nacvičit. |
| Banky | Integrace Enable Banking implementovaná; aktivace poskytovatele a test živých účtů zbývají. | Revolut/ostatní banky podle aktuálního katalogu, ne všechny produkty. Viz BANKING.md. |
| Více účtů / peněženek | Vlastní bankovní, hotovostní, spořicí a ostatní účty; převody, archivace a cílový účet bankovního importu. | CZK, soukromé účty jednoho uživatele. Izolace, převody bez duplicit, migrace a obnova testovány. |
| Rozpočty | Zatím neimplementováno. | Bez rozpočtových limitů a obálek. |
| Další chybějící oblasti | AI účtenky, offline zápisy, společné peněženky, více měn, ucelený zámek celé aplikace. | Nejde o hotové funkce ani o slíbené datum dodání. |

## 3. Funkce a vlastnosti, které mohou dát výhodu

Ne všechny položky jsou novinkou proti Spendee. Dorovnání základů je nutné dřív, než lze obhájit celkovou převahu. Priority nejsou termíny ani automatický souhlas s placenými službami.

| Priorita / oblast | Co navrhuji | Proč by to mohlo být lepší | Jak ověřit výsledek |
|---|---|---|---|
| P0 · Spolehlivost | Reálné testy widgetů, offline/timeout scénářů, aktualizací a obnovy dat. | Důvěryhodnost je důležitější než počet funkcí. | Testy na iPhone 13 a vybraných Androidech; při opakování požadavku jediný zápis. |
| P0 · Sjednocené ovládání | Dotáhnout stejné hlavní úkony na webu, iOS a Androidu; přístupnost, stav načítání a srozumitelné chyby. | Menší překvapení při změně zařízení. | Testování stejných scénářů na všech platformách. |
| P1 · Rychlé zadávání | Dotažené widgety, 5 + 5, vlastní předvolby a volitelné zkratky. | Méně kroků u každodenních plateb; kandidát odlišení, ne doložená převaha. | Změřit čas a počet kroků proti Spendee na stejném telefonu. |
| P1 · Vizuální editor | Rozvinout současné knihovny, vlastní loga, vzhled karet a náhled napříč widgety a webem. | Přesnější přizpůsobení konkrétnímu člověku. | Ověřit s uživateli, že položku rychleji najdou a správně vyberou. |
| P1 · Rozpočty i na webu | Rozpočty, obálky, převod nevyčerpaných peněz a shodné ovládání na všech platformách. | Dokumentace Spendee uvádí rozpočty jen na mobilu; plný web je konkrétní příležitost. | Stejný výsledek rozpočtu na webu i telefonu, včetně přelomu měsíce. |
| P1 · Banky, měny, peněženky | Bezpečné účty, převody, kurzy a bankovní synchronizace přes vhodného poskytovatele. | Především dorovnání konkurenčního základu, nikoli automatická výhoda. | Párování importů bez duplicit, testy kurzů; vyřešit náklady a přístupy poskytovatele. |
| P2 · Budoucí zůstatek | Projekce na 30/90 dní, oddělené potvrzené a očekávané platby, scénáře „co když“. | Pomoc před vznikem nedostatku peněz. | Ukázat zdroj každé projekce; žádné automatické potvrzování plánů. |
| P2 · Sdílení se soukromím | Soukromé a společné peněženky, společný rozpočet, jasná oprávnění. | Spendee podle dokumentace nesdílí rozpočty; prostor pro lepší spolupráci. | Test izolace soukromých dat i při sdílení a odebrání členství. |
| P2 · Offline režim | Šifrovaná lokální evidence, fronta změn a řešení konfliktů. | Použitelnost bez internetu; konkurenční převaha vyžaduje samostatné porovnání. | Ztráta spojení, restart aplikace a synchronizace bez ztrát či duplicit. |
| P2 · Účtenky a pravidla | OCR s náhledem, kontrolou částky a vysvětlením pravidel kategorizace. | Samotné AI skenování už Spendee má; výhodou může být přesnost, kontrola a soukromí. | Měřit chyby na sadě českých účtenek, vždy možnost opravy před uložením. |
| P2 · Přenositelnost | Průvodce importem ze Spendee, přehledné mapování kategorií a plná obnova/export z webu. | Jednodušší přechod a menší závislost na aplikaci. | Import/export zachová částky, měny, data, vazby a součty. |
| P2 · Předplatná a cíle | Detekce zdražení, roční cena služeb, upozornění na obnovení, spořicí cíle. | Praktická doporučení založená na vlastních datech. | Doložit každý závěr konkrétními transakcemi; žádná neověřitelná tvrzení o úspoře. |

Doporučené pořadí: ověřit widgety na zařízeních → uživatelské ověření nových přehledů a účtů → rozpočty a měny → živé bankovní propojení → rozšířené projekce a další odlišení. Vydání do obchodů je samostatný krok s podpisy, soukromím, smazáním účtu a kontrolou Apple/Google; není nyní hotové.

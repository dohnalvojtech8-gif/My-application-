# Přehledy, účty a převody

## Více účtů pod jedním přihlášením

V **Přehledy → Účty** nebo v příslušné sekci Nastavení založte bankovní účet, hotovost, spoření či jiný účet. Každý má vlastní název, barvu a počáteční zůstatek. Všechny účty této verze vedou evidenci v CZK; přístup má pouze jejich uživatel. Nejde o společné účty více lidí.

Přepínač účtu na hlavních obrazovkách nabízí jednotlivé účty i všechny dohromady. Volba se používá v dashboardu, kalendáři a přehledech. Při vytvoření příjmu, výdaje, opakované série nebo widgetové předvolby zvolte cílový účet. Počáteční zůstatek upravujte v detailu konkrétního účtu.

**Převést peníze** zaznamená interní přesun mezi dvěma vlastními aktivními účty. Například převod 1 000 Kč z banky do hotovosti sníží banku a zvýší hotovost o 1 000 Kč; celkový zůstatek, příjmy a výdaje zůstávají stejné. Záznam je atomický a opakované odeslání stejného požadavku jej nezdvojí. Převod lze odstranit z jeho detailu po potvrzení. Jde o evidenci přesunu; aplikace tento úkon neposílá do banky.

Archivace schová účet z nabídky nových plateb a pozastaví generování jeho sérií. Historie, zůstatek i již naplánované platby zůstávají. Archivovaný účet je proto nadále zahrnut v celkovém zůstatku. Výchozí osobní účet nelze archivovat. Po obnovení účtu se série obnovují samostatně.

## Pět přehledných záložek

| Záložka | Obsah |
|---|---|
| Souhrn | Příjmy, výdaje, rozdíl, míra úspor, porovnání období, vývoj zůstatku, grafy a plánované platby. |
| Položky | Barevné rozdělení příjmů nebo výdajů, procentní podíly, TOP 5/10/vše, četnost, průměry a nejvyšší platby. Kliknutí zobrazí příslušné transakce. |
| Trvalé platby | Aktivní a pozastavené série, očekávané částky na příštích 30 dní, platby po splatnosti, pauza/obnovení a odkaz na editor série. |
| Transakce | Hledání, filtry, řazení, stránkování, detail platby a export filtrovaného seznamu. |
| Účty | Zůstatky, založení a úprava účtů, archivace, převody a historie převodů. |

Období je den, týden od pondělí, kalendářní měsíc, rok, vše nebo vlastní rozsah. Filtry umožňují kombinovat typ platby, stav, položku, text, částku a opakování. Porovnání používá bezprostředně předcházející období se stejným počtem kalendářních dní. Při nulovém základu se neuvádí zavádějící procentní růst. Míra úspor je `(uskutečněné příjmy − uskutečněné výdaje) / uskutečněné příjmy`; při nulových příjmech nemá procentní hodnotu.

Aktuální zůstatek vychází z počátečních zůstatků a všech uskutečněných plateb; časový filtr jej nemění. U jednotlivého účtu započítává také převody. Graf zůstatku zachovává historii před začátkem vybraného období. Interní převody se nezapočítávají do spotřeby ani do podílů jednotlivých položek.

Přehled trvalých plateb používá pevně následujících 30 dní, nezávisle na období a filtru částky/stavu transakcí; rozsah je označen přímo v rozhraní. Respektuje účet, typ, položku a hledání. Projekce respektuje změněné či přeskočené výskyty a nikdy sama nepotvrdí platbu. Při pozastavení série zůstávají již vytvořené plánované platby zachovány. Trvalá platba zde znamená opakovanou evidenci, nikoli příkaz odesílaný bance.

## Detail a bezpečné odstranění

Mazání není na přehledové kartě položky. Nejdříve otevřete položku v editoru a potom zvolte odstranění a potvrďte je. Historické platby si uchovávají svůj název, barvu a typ. Platbu upravujte nebo mažte z jejího detailu; odstranění výskytu opakování jej označí jako přeskočený. Potvrzení plánované platby nabídne skutečné datum uskutečnění.

## Export, obnova a aktualizace

CSV exportuje transakce odpovídající filtrům, PDF využívá tisk prohlížeče. Interní převody mají vlastní historii v Účtech. Uživatelská JSON záloha verze 2 obsahuje účty, počáteční zůstatky, položky, transakce, převody a série. Obnovuje se do prázdného uživatelského účtu s novými ID a zachovanými vazbami. Přijímány jsou i starší zálohy verze 1. Kompletní serverová obnova včetně nastavení a přístupů používá PostgreSQL zálohu.

Při aktualizaci stávající instalace migrace `20261110040000_wallets` vytvoří každému uživateli „Osobní účet“, převede na něj původní počáteční zůstatek, transakce, série a widgetové předvolby. Finanční historie se nemaže. `npm start` spouští migrace automaticky; před produkční aktualizací pořiďte databázovou zálohu. Další proměnné prostředí tato změna nevyžaduje.

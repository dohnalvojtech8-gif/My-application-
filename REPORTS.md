# Přehledy, účty a převody

## Více účtů pod jedním přihlášením

V **Přehledy → Účty** nebo v příslušné sekci Nastavení založte bankovní účet, hotovost, spoření či jiný účet. Každý má vlastní název, barvu a počáteční zůstatek. Podporované měny jsou CZK, EUR, USD, GBP, CHF, PLN, HUF, SEK, NOK a DKK. Měnu volíte při založení; po založení je pevná, aby se nezměnil význam historie. Přístup má pouze jejich uživatel. Nejde o společné účty více lidí.

Přepínač účtu na hlavních obrazovkách nabízí jednotlivé účty i všechny účty v právě zvolené měně. Samostatný přepínač měny nikdy nesčítá různé měny dohromady. Volba se používá v dashboardu, kalendáři a přehledech. Při vytvoření příjmu, výdaje, opakované série nebo widgetové předvolby zvolte cílový účet. Počáteční zůstatek upravujte v detailu konkrétního účtu.

**Převést peníze** zaznamená interní přesun mezi dvěma vlastními aktivními účty. Například převod 1 000 Kč z banky do hotovosti sníží banku a zvýší hotovost o 1 000 Kč; celkový zůstatek, příjmy a výdaje zůstávají stejné. Záznam je atomický a opakované odeslání stejného požadavku jej nezdvojí. Převod lze odstranit z jeho detailu po potvrzení. Jde o evidenci přesunu; aplikace tento úkon neposílá do banky.

Archivace schová účet z nabídky nových plateb a pozastaví generování jeho sérií. Historie, zůstatek i již naplánované platby zůstávají. Archivovaný účet je proto nadále zahrnut v celkovém zůstatku. Výchozí osobní účet nelze archivovat. Po obnovení účtu se série obnovují samostatně.

## Šest přehledných záložek

| Záložka | Obsah |
|---|---|
| Souhrn | Příjmy, výdaje, rozdíl, míra úspor, porovnání období, vývoj zůstatku, grafy a plánované platby. |
| Položky | Barevné rozdělení příjmů nebo výdajů, procentní podíly, TOP 5/10/vše, četnost, průměry a nejvyšší platby. Kliknutí zobrazí příslušné transakce. |
| Trvalé platby | Aktivní a pozastavené série, očekávané částky na příštích 30 dní, platby po splatnosti, pauza/obnovení a odkaz na editor série. |
| Transakce | Hledání, filtry, řazení, stránkování, detail platby a export filtrovaného seznamu. |
| Účty | Zůstatky, založení a úprava účtů, archivace, převody a historie převodů. |
| Rozšířené analýzy | Čerpání rozpočtu v čase, porovnání obchodníků a neobvyklé výdaje. |

Období je den, týden od pondělí, kalendářní měsíc, rok, vše nebo vlastní rozsah. Filtry umožňují kombinovat typ platby, stav, položku, obchodníka, text, částku a opakování. Porovnání používá bezprostředně předcházející období se stejným počtem kalendářních dní. Při nulovém základu se neuvádí zavádějící procentní růst. Míra úspor je `(uskutečněné příjmy − uskutečněné výdaje) / uskutečněné příjmy`; při nulových příjmech nemá procentní hodnotu.

Aktuální zůstatek vychází z počátečních zůstatků a všech uskutečněných plateb; časový filtr jej nemění. U jednotlivého účtu započítává také převody. Graf zůstatku zachovává historii před začátkem vybraného období. Interní převody se nezapočítávají do spotřeby ani do podílů jednotlivých položek.

Přehled trvalých plateb používá pevně následujících 30 dní, nezávisle na období a filtru částky/stavu transakcí; rozsah je označen přímo v rozhraní. Respektuje účet, měnu, typ, položku, obchodníka a hledání. Projekce respektuje změněné či přeskočené výskyty a nikdy sama nepotvrdí platbu. Při pozastavení série zůstávají již vytvořené plánované platby zachovány. Trvalá platba zde znamená opakovanou evidenci, nikoli příkaz odesílaný bance.

## Detail a bezpečné odstranění

Seznamy plateb mají výchozí pořadí od nejnovějšího data. V rámci stejného dne je první naposledy vytvořený záznam; pořadí je společné pro příjmy i výdaje a zachovává se po obnovení. Původní verze čas vytvoření neukládala, proto u starších záznamů není možné zpětně určit přesné pořadí uvnitř dne. Nová migrace jej nevymýšlí a označuje jako neznámý. TOP žebříčky nadále porovnávají částky a časová osa grafu postupuje zleva doprava.

Mazání není na přehledové kartě položky. Nejdříve otevřete položku v editoru a potom zvolte odstranění a potvrďte je. Historické platby si uchovávají svůj název, barvu a typ. Platbu upravujte nebo mažte z jejího detailu; odstranění výskytu opakování jej označí jako přeskočený. Potvrzení plánované platby nabídne skutečné datum uskutečnění.

## Export, obnova a aktualizace

CSV exportuje transakce odpovídající filtrům, PDF využívá tisk prohlížeče. Interní převody mají vlastní historii v Účtech. Uživatelská JSON záloha verze 3 obsahuje účty, počáteční zůstatky, položky, transakce včetně obchodníků, převody včetně obou měnových částek, rozpočty a série. Obnovuje se do prázdného uživatelského účtu s novými ID a zachovanými vazbami. Přijímány jsou i starší zálohy verze 1 a 2. Kompletní serverová obnova včetně nastavení a přístupů používá PostgreSQL zálohu.

Při aktualizaci stávající instalace migrace `20261110040000_wallets` vytvoří každému uživateli „Osobní účet“, převede na něj původní počáteční zůstatek, transakce, série a widgetové předvolby. Finanční historie se nemaže. `npm start` spouští migrace automaticky; před produkční aktualizací pořiďte databázovou zálohu. Další proměnné prostředí tato změna nevyžaduje.

## Rozpočty a limity

V Nastavení → Rozpočty a limity lze pro každý účet uložit jeden opakující se týdenní, měsíční nebo roční rozpočet a/nebo limit jedné výdajové platby. Částky jsou vždy v měně účtu. Upozornění nastavíte od 1–100 % rozpočtu; limit je informační, neblokuje evidenci skutečné platby. Není bankovním limitem karty ani příkazem bance. Upozornění se zobrazují uvnitř aplikace, nejde o nové push zprávy.

Čerpání zahrnuje uskutečněné výdaje účtu, samostatně ukazuje plánované výdaje a zbývající částku. Příjmy, interní převody a přeskočené platby se do spotřeby nepočítají. Denní dostupná částka je kladný zbytek dělený počtem zbývajících kalendářních dní včetně vybraného dne; nevychází z bankovního zůstatku. Pozastavení zachová nastavení. Rozpočet se každý týden/měsíc/rok hodnotí znovu bez převodu nevyčerpaného zbytku.

Graf v Rozšířených analýzách ukazuje kumulativní čerpání a limit pro období rozpočtu obsahující zvolené datum (u vlastního rozsahu datum Do). Ostatní filtry obchodníků/položek/částek rozpočet neomezují. Změna limitu platí i při pohledu na starší období; historie změn limitů se nevede.

## Obchodníci a tři nové analýzy

Obchodník je nepovinné pole platby, opakování, widgetové předvolby a bankovního importu. Historickým platbám se obchodník nevymýšlí; doplníte jej v detailu. Filtr slučuje názvy bez rozdílu velikosti písmen, diakritiky a nadbytečných mezer. Není to automatická identifikace obchodníků bankou.

1. **Čerpání rozpočtu v čase** — průběh skutečných výdajů proti limitu, plán a zbývající denní částka.
2. **Porovnání obchodníků** — počet nákupů, útrata, průměr, předchozí stejně dlouhé období, rozdíl v měně účtu i procentech. Při nulovém základu se procenta nezobrazí; pro Vše porovnání není dostupné.
3. **Neobvyklé výdaje** — platba přesahující trojnásobek mediánu nejméně pěti starších nákupů stejného obchodníka za 90 dní. Bez obchodníka se porovnává položka. Vzorky jsou jen ze zvolených účtů téže měny a dní před platbou. Jde o vysvětlitelnou kontrolu, nikoli detekci podvodu; bez dostatku dat se závěr nezobrazuje.

CSV přidává obchodníka a měnu. Částky a součty se počítají v přesných setinách měny pomocí BigInt; pouze vykreslení grafů používá Number.

## Převody různých měn a vzhled

Při převodu CZK → EUR zadejte skutečně odeslanou korunovou a přijatou eurovou částku. Každý zůstatek se změní v příslušné měně. Automatické směnné kurzy ani agregace do jedné základní měny nejsou implementované. Případný samostatný bankovní poplatek zapište jako výdaj. Původní převody CZK zůstávají beze změny. Existující platbu ani sérii nelze přesunout do jiné měny bez nového záznamu.

V Nastavení → Vzhled a ovládací panel upravíte motiv (světlý/tmavý/systém), akcent včetně HEX, boční panel, rohy, rozestupy, text 90–120 %, animace a sekce dashboardu. Náhled je okamžitý, perzistence až po Uložit vzhled. Změny lze zrušit nebo obnovit výchozí návrh. Preference jsou soukromé a uložené na serveru. Barevný styl vlastních položek zůstává pod kontrolou editoru položek.

Widgetové částky respektují měnu cílového účtu. Volitelný zůstatek widgetu prozatím zobrazuje součet účtů v CZK, nikoli součet různých měn. Nativní změny vyžadují novou verzi instalované aplikace.

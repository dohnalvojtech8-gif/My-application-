# Mobilní aplikace a systémové widgety

SYSTEMATIC MONEY obsahuje projekty `android/` a `ios/App/App.xcodeproj` s nativními widgety. Stav skutečně provedených testů je v [STATUS.md](STATUS.md). PWA systémové widgety neposkytuje.

## Společný backend

Nejdříve nasaďte aktuální větev main na Render s PostgreSQL a proveďte migrace (`npm run migrate`, také automaticky v prestart). HTTPS origin musí odpovídat `APP_ORIGIN`. Mobilní aplikace používá stejný server, databázi a HTTP-only session jako web.

```sh
npm ci
npm run build
MOBILE_SERVER_URL=https://my-application-99m3.onrender.com npx cap sync
```

Při vlastním nasazení nahraďte adresu. Bez `MOBILE_SERVER_URL` se zabalí lokální web, který neposkytuje samostatný backend. Pro běžný provoz a widgety je nutné připojení k internetu; offline zápisy nejsou řazeny do fronty.

## Nastavení widgetů

1. V Nastavení → Widgety a rychlé akce vytvořte pojmenovanou akci: příjmovou/výdajovou položku, částku a režim. Oblíbené položky jsou označené hvězdou. Každý widget může mít jinou akci; lze přidat více widgetů.
2. **Formulář** otevře aplikaci s položkou a částkou. Platba vznikne až po Uložit. **Přímé uložení** odešle pevnou částku jedním klepnutím z podporovaného nativního widgetu.
3. V nainstalované nativní aplikaci se přihlaste, otevřete stejnou sekci, potvrďte heslo a zvolte Připojit widgety. Čtení zůstatku povolte pouze pokud ho chcete ve widgetech zobrazovat.
4. Přidejte systémový widget a vyberte rychlou akci. Zůstatek je standardně skrytý. Android má volbu zobrazení u rychlé akce; iOS při úpravě widgetu.
5. Po úspěšném přímém uložení opakované klepnutí nezaloží další platbu. Pro další stejnou platbu stiskněte **Obnovit**. Při neověřeném výsledku opakujte původní akci: zachová identifikátor požadavku i při výpadku spojení. Obnovení při nevyřešeném požadavku identifikátor nemění.

Akce lze smazat a přístupy jednotlivých telefonů odebrat na webu. Smazaná či skrytá finanční položka není dostupná pro nové widgetové platby. Obnova stavu probíhá na žádost a přibližně po 30 minutách; skutečné intervaly určuje OS. Widget není živý bankovní displej.

## Android

Vyžaduje JDK 21, Android SDK 36 a Gradle wrapper v repozitáři. Otevřete `npx cap open android`, nebo po výše uvedeném sync:

```sh
cd android
./gradlew assembleDebug
```

APK je `android/app/build/outputs/apk/debug/app-debug.apk`. Instalace na připojený telefon: `adb install -r app/build/outputs/apk/debug/app-debug.apk`. Debug podpis slouží k testování. Release podepište vlastním keystore přes Android Studio → Generate Signed Bundle / APK. Klíče nepatří do GitHubu.

Na domovské obrazovce dlouhý stisk → Widgety → SYSTEMATIC MONEY → vybrat akci. Widget obsahuje částku, volitelný zůstatek, stav, obnovení a nastavení. Přímý zápis se kontroluje i při přijetí akce a vyžaduje odemčený telefon. Android widget zde podporuje **domovskou obrazovku**, nikoli univerzálně zamčenou obrazovku.

Workflow **Native apps** na GitHubu vytváří debug APK jako artefakt `systematic-money-android-debug`, připojené k výše uvedenému Render serveru. Stažení vyžaduje úspěšný běh workflow; build není test na skutečném telefonu.

## iPhone / iOS

Vyžaduje macOS a Xcode kompatibilní s Capacitor 8. Widget extension má minimum iOS 17. Po sync spusťte `npx cap open ios`.

- Vyberte vlastní Apple Developer Team pro **App** a **MoneyWidget** a nastavte dostupné bundle IDs (výchozí `cz.systematic.money` a `cz.systematic.money.widget`).
- Pro oba targety zapněte **App Groups** se stejnou skupinou `group.cz.systematic.money` a **Keychain Sharing** se skupinou `$(AppIdentifierPrefix)cz.systematic.money.shared`.
- Pokud jsou identifikátory obsazené nebo je změníte, upravte je konzistentně v obou entitlements, Info.plist (`WidgetKeychainGroup`) a `WidgetShared/WidgetStore.swift` (UserDefaults suite). Skupinu zaregistrujte u vlastního Apple týmu.
- Build/Run na zařízení. Pro distribuci Archive → Distribute přes TestFlight/App Store s vlastním podpisem. Nepodepsaný simulátorový build nelze nainstalovat na iPhone.

Domovská obrazovka: přidejte malý nebo střední widget, dlouhý stisk → Upravit widget → vyberte rychlou akci a případně zůstatek. WidgetKit používá App Intents; přímý zápis vyžaduje autentizaci systému. Kruhová a obdélníková accessory varianta na zamčené obrazovce otevírá formulář, přímý zápis tam nenabízí. Zůstatek je označen `privacySensitive`; konkrétní skrytí závisí na nastavení systému.

Workflow **Native apps** kompiluje app + vloženou widget extension pro simulátor na macOS. Nenahrazuje ověření podpisů, sdílené Keychain a ovládání na fyzickém iPhonu.

## Bezpečnost a omezení

Widget používá samostatný 30denní náhodný token pouze pro čtení povoleného souhrnu a provedení vlastních přednastavených akcí. Token nedovoluje číst obecné finanční API. Server ukládá pouze SHA-256 hash, kontroluje vlastníka, blokaci, platnost a aktuální položku; částku přijímá ze serverové předvolby. Souběžné zápisy stejného požadavku jsou deduplikované databázovým unikátním klíčem.

Na Androidu je token šifrovaný pomocí Android Keystore; iOS používá sdílenou Keychain s ochranou ThisDeviceOnly. Token se nevkládá do URL ani localStorage. Připojení musí používat HTTPS origin nativní aplikace. Logout a změna hesla ruší všechna widgetová oprávnění účtu. Vypršené připojení obnovte v aplikaci. Již vykreslený obsah může zůstat viditelný do dalšího obnovení widgetu; proto je zůstatek volitelný.

## PWA

Na HTTPS webu Chrome/Edge → nabídka → Nainstalovat aplikaci. iPhone: Safari → Sdílet → Přidat na plochu. PWA má manifest a service worker s offline zprávou; finanční data se do jeho cache neukládají. Pro systémové widgety nainstalujte nativní aplikaci podle návodu výše.

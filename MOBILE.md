# Mobilní aplikace a widgety

V repozitáři jsou skutečné projekty `ios/App/App.xcodeproj` a `android/`, nikoli pouze konfigurační soubor Capacitoru. **Nativní sestavení není v tomto prostředí ověřeno.**

## Sdílený server

Nejprve nasaďte web a PostgreSQL. HTTPS adresa aplikace je současně origin API. Nativní WebView načítá tento origin, proto používá stejné zabezpečené HTTP-only sessions, CSRF kontrolu a databázi. Není vložen žádný API token. Mobilní aplikace vyžaduje internet.

```sh
npm ci
npm run build
MOBILE_SERVER_URL=https://VASE-APLIKACE.onrender.com npx cap sync
```

`MOBILE_SERVER_URL` musí být HTTPS a musí odpovídat `APP_ORIGIN` serveru. Bez této proměnné je synchronizován lokální webový balíček, který není samostatným backendem.

## iOS

Na macOS s aktuálním Xcode spusťte `npx cap open ios`. Nastavte vlastní Apple Developer Team pro App a MoneyWidget; přizpůsobte bundle IDs `cz.systematic.money` a `cz.systematic.money.widget`. Pro extension je minimum iOS 17. Vyberte zařízení, Build/Run, pro distribuci Archive → Distribute. TestFlight/App Store vyžadují vlastní certifikáty a účet.

MoneyWidget je WidgetKit extension přidaná do Xcode projektu. Nabízí odkaz na rychlý výdaj pro malé/střední widgety a dostupné accessory varianty. URL scheme `systematicmoney://quick?kind=EXPENSE` otevře formulář; uživatel musí být přihlášený. Zdroj obsahuje App Intent pro otevření aplikace. Přímý zápis a zobrazování soukromého zůstatku z widgetu nejsou podporované.

## Android

Nainstalujte Android Studio, SDK požadované `android/variables.gradle` a JDK kompatibilní s použitým Gradle. `npx cap open android`, synchronizujte Gradle a spusťte Run. Debug APK: `cd android && ./gradlew assembleDebug`. Podepsaný release vytvořte přes Android Studio; keystore uchovávejte mimo repozitář.

MoneyWidget používá nativní AppWidgetProvider a PendingIntent s immutable příznakem. Po instalaci jej přidejte dlouhým stiskem domovské obrazovky → Widgety → SYSTEMATIC MONEY. Otevře rychlý formulář výdaje; přímé účtování není implementované. Neposkytuje přihlašovací údaje widgetu.

## PWA

Na HTTPS otevřete web. Chrome/Edge: nabídka → Nainstalovat aplikaci (dostupnost závisí na prohlížeči). iPhone: Safari → Sdílet → Přidat na plochu. PWA má manifest, ikonu a service worker s offline zprávou. Finanční data se neukládají do service-worker cache. Web Push na iOS vyžaduje podporovanou verzi systému a instalaci na plochu.

PWA sama neposkytuje nativní widgety. Doručení push na skutečných zařízeních, podepisování, widget target a mobilní build je nutné ověřit na cílových platformách.

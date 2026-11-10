# Instalovatelná aplikace a vydání bez vlastního Macu

## Co existuje a co ještě nebylo vydáno

Repozitář obsahuje Android aplikaci a iOS aplikaci s WidgetKit extension. Android debug APK lze získat z úspěšného běhu **Actions → Native apps → Artifacts → systematic-money-android-debug**. Rozbalte ZIP a APK otevřete na Androidu; případné povolení instalace z daného zdroje lze potom zase vypnout. APK se připojuje k nasazenému Render backendu. Debug APK není verze pro Google Play a instalace na fyzickém telefonu zatím nebyla ověřena.

**iPhone aplikace zatím není dostupná v TestFlight ani App Storu.** Úspěšné sestavení pro simulátor není instalovatelná iPhone aplikace. Safari ani PWA systémové widgety nepřidají. Pro cestu popsanou níže není nutné vlastnit Mac; GitHub poskytne macOS sestavovací prostředí. Je nutné vlastní aktivní členství Apple Developer Program a podpisové přístupy. Ty nelze nahradit přihlášením do GitHubu.

## iPhone: jednorázové nastavení vydavatele

1. Založte a dokončete ověření [Apple Developer Program](https://developer.apple.com/programs/enroll/). Členství a případné náklady schvaluje a hradí vlastník aplikace.
2. V [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/) zaregistrujte explicitní ID `cz.systematic.money` a `cz.systematic.money.widget`. Pro obě povolte App Groups a připojte skupinu `group.cz.systematic.money`. Profily musí umožňovat sdílenou Keychain `$(AppIdentifierPrefix)cz.systematic.money.shared`. Pokud jsou ID obsazená, upravte je konzistentně podle [MOBILE.md](MOBILE.md), také v obou release skriptech a profilech.
3. Vytvořte distribuční certifikát **Apple Distribution** a dva profily **App Store Connect**: samostatně pro aplikaci a widget. Oba patří stejnému týmu, App Group a distribučnímu certifikátu. Vývojový nebo ad hoc profil nestačí pro TestFlight.
4. V [App Store Connect](https://appstoreconnect.apple.com/) založte záznam aplikace SYSTEMATIC MONEY pro ID hlavní aplikace. Pro nahrávání vytvořte týmový API klíč s oprávněním potřebným pro upload (typicky App Manager); zapište Key ID a Issuer ID. Stažený `.p8` je tajný.
5. Na GitHubu otevřete repozitář → Settings → Environments → **app-store**. Uložte níže uvedené proměnné a Secrets. Tajné soubory nevkládejte do repozitáře ani chatu.

| Typ | Název | Obsah |
|---|---|---|
| Variable | `IOS_TEAM_ID` | Desetiznakové Apple Team ID |
| Variable | `MOBILE_SERVER_URL` | HTTPS adresa backendu; výchozí je současný Render |
| Variable | `ASC_KEY_ID` | Key ID týmového App Store Connect API klíče |
| Variable | `ASC_ISSUER_ID` | Issuer ID API klíče |
| Secret | `IOS_DISTRIBUTION_P12` | Base64 souboru P12 s certifikátem **i odpovídajícím soukromým klíčem** |
| Secret | `IOS_DISTRIBUTION_PASSWORD` | Heslo šifrovaného P12 |
| Secret | `IOS_APP_PROFILE` | Base64 distribučního profilu hlavní aplikace |
| Secret | `IOS_WIDGET_PROFILE` | Base64 distribučního profilu widget extension |
| Secret | `ASC_PRIVATE_KEY` | Úplný obsah souboru `.p8` v PEM formátu, nikoli base64 |

P12 a oba profily jsou nutné i pro export bez uploadu. App Store Connect klíč je nutný při zapnutém uploadu.

### Podpisové soubory bez Macu

Privátní klíč a žádost CSR lze vytvořit lokálně pomocí OpenSSL na Windows/Linuxu. Pracujte v soukromé složce **mimo repozitář**. Příkazy vyžádají hesla interaktivně; nezapisujte je do příkazové historie:

```sh
openssl genrsa -aes256 -out apple-distribution.key 2048
openssl req -new -key apple-distribution.key -out apple-distribution.csr
```

CSR odešlete v Apple Developer portálu při vytvoření Apple Distribution certifikátu. Stažený certifikát převádějte a spojte s původním klíčem:

```sh
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey apple-distribution.key -in distribution.pem -out distribution.p12
```

Base64 každého binárního souboru lze lokálně zapsat do soukromého souboru například `openssl base64 -A -in distribution.p12 -out distribution.p12.base64`. Obsah vložte do odpovídajícího GitHub Secret, potom pomocný soubor bezpečně odstraňte. Certifikát s klíčem a profily zálohujte mimo GitHub. Nikdy nesdílejte privátní klíč ani heslo v issue či chatu.

## iPhone: sestavení a instalace

1. Nejdříve musí projít **Validate** a **Native apps** pro verzi, kterou vydáváte; backend musí běžet na HTTPS s aktuálními migracemi.
2. Actions → **iOS TestFlight** → Run workflow na `main`. Zadejte verzi například `1.0.0` a nové rostoucí číslo sestavení. První spuštění může ponechat `upload` vypnuté; výsledkem je podepsaná IPA v artefaktu. App Store IPA není určena k ruční instalaci otevřením souboru na iPhonu.
3. Pro skutečnou instalaci spusťte workflow s `upload` zapnutým. Skript kontroluje profily aplikace i widgetu, jejich platnost, skupiny a tým. Podepíše archiv, exportuje IPA a odešle build do App Store Connect. Dočasný keychain, profily a API klíč se po běhu uklidí. Nikdy se nenahrávají do artefaktů.
4. V App Store Connect → TestFlight vyčkejte na zpracování. Doplňte skutečné informace o šifrování a požadované údaje. Přidejte sebe jako interního testera; u externích testerů může Apple vyžadovat Beta App Review.
5. Na iPhonu nainstalujte [TestFlight](https://apps.apple.com/app/testflight/id899247664), přijměte pozvánku a nainstalujte SYSTEMATIC MONEY. Aplikaci otevřete, přihlaste se a nakonfigurujte widgety podle [MOBILE.md](MOBILE.md).

Workflow sám aplikaci nezveřejňuje na App Storu. Úspěšný upload neznamená schválení App Review ani okamžitou dostupnost testerům. Podepsaný export/upload dosud nebyl vykonán, protože nebyl dodán vývojářský účet a podpisové přístupy. Popisuje připravený postup, nikoli již vydanou aplikaci.

## Android: podepsaná instalace a Google Play

Pro první zkoušku je dostupné debug APK z **Native apps**. Pro vlastní distribuci používejte trvale vlastní podpisový/upload klíč. Může být vytvořen lokálně pomocí JDK `keytool`; heslo vyplňte interaktivně:

```sh
keytool -genkeypair -v -keystore systematic-money-upload.jks -alias systematic-money -keyalg RSA -keysize 3072 -validity 10000
```

Soubor a hesla bezpečně zálohujte mimo zdrojový kód. V GitHub Environment **google-play** nastavte:

| Typ | Název | Obsah |
|---|---|---|
| Variable | `ANDROID_KEY_ALIAS` | Alias, např. `systematic-money` |
| Variable | `MOBILE_SERVER_URL` | HTTPS backend; výchozí je současný Render |
| Secret | `ANDROID_KEYSTORE_BASE64` | Base64 binárního JKS |
| Secret | `ANDROID_KEYSTORE_PASSWORD` | Heslo úložiště |
| Secret | `ANDROID_KEY_PASSWORD` | Heslo zvoleného klíče |

Spusťte **Actions → Android release** na `main`, zadejte verzi a nové rostoucí číslo sestavení. Artefakt obsahuje podepsanou instalovatelnou APK a AAB pro Play Console. Workflow ověří podpis APK a uklidí dočasný klíč. S vaším distribučním klíčem ještě nebyl spuštěn.

APK s jiným certifikátem nenahradí debug instalaci; Android ji odmítne aktualizovat. Při změně testovacího podpisu nejprve odpojte widgety a odinstalujte starou aplikaci. Finanční data jsou na serveru; lokální přihlášení a konfigurace telefonu se ztratí. Následující produkční aktualizace musí zachovat stejnou identitu podpisu.

Pro Google Play založte vlastní Play Console účet, dokončete požadované ověření a použijte **Internal testing** s vytvořeným AAB. Zapněte Play App Signing a uchovejte upload key. Workflow záměrně nepoužívá žádný cizí účet a neprovádí veřejnou publikaci.

## Co zbývá před veřejným vydáním

- Ověřit instalaci, přihlášení, zámek/odemčení, zrušené ověření, opakovaný dotyk, výpadek internetu, Keychain/App Groups a odvolání widgetových přístupů na skutečném iPhone 13 a Android telefonu.
- Dokončit zbývající produktové části v [STATUS.md](STATUS.md). Nativní APNs/FCM, odstranění účtu z aplikace a úplné obchodní/store podklady nejsou tímto workflow dodány.
- Připravit pravdivé App Privacy / Data Safety údaje, zásady soukromí, smazání účtu a dat, podporu, screenshoty, privacy manifests a přístup pro review. Apple/Google stanovují vlastní podmínky a publikaci schvalují.
- Pro banky aktivovat poskytovatele, podmínky komerčního použití a skutečné integrační testy podle [BANKING.md](BANKING.md).

Oficiální podklady: [Apple distribuce buildů](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [TestFlight](https://developer.apple.com/testflight/), [Android podepisování](https://developer.android.com/studio/publish/app-signing), [Google Play interní testování](https://support.google.com/googleplay/android-developer/answer/9845334).

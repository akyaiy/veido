# Veido

> Projekts tiek izstrādāts **Jelgavas novada jauniešu iniciatīvu konkursa 2026** ietvaros.

## Projekta mērķis

Veido - tīmekļa platforma vietņu izveidei, rediģēšanai, publicēšanai un pārvaldībai. Platformas frontend daļa ir izstrādāta, izmantojot HTML, CSS un JavaScript, savukārt servera daļa - Go programmēšanas valodā. Platforma ietver vizuālos redaktorus, failu pārvaldības sistēmu, HTTP API, autentifikāciju un virtuālo failu sistēmu (VFS).

## Lokālā palaišana

Nepieciešama Go versija 1.24.3 vai jaunāka.

```bash
cp .env.example .env
```

Failā `.env` norādiet `JWT_SECRET` vismaz 32 baitu garumā, pēc tam izpildiet:

```bash
scripts/migrate.sh
go run ./cmd/server
```

## Galvenās iespējas

- HTML lapu un vietnes statisko failu publicēšana.
- Failu un citu resursu pārvaldība, izmantojot VFS API un pievienojamus pakalpojumu sniedzējus (providers).
- Lietotāju autentifikācija ar JWT un piekļuves tiesību pārbaude resursiem.
- Metadatu glabāšana SQLite datubāzē un failu glabāšana pēc satura adresētā krātuvē (CAS).

## Arhitektūra un pieprasījumu apstrāde

Galvenie komponenti nodala ienākošo pieprasījumu apstrādi, identitātes noteikšanu, piekļuves pārbaudi, resursu maršrutēšanu un darbu ar datiem:

- **HTTP serveris un API** pieņem pārlūkprogrammu un ārējo klientu pieprasījumus. Atsevišķi maršruti nodrošina VFS API, autentifikāciju un publiskās vietnes lapas.
- **Auth** pārbauda piekļuves JWT un nosaka actor - lietotāju vai viesi. Actor identifikators tiek iegūts no pārbaudīta tokena, nevis no pieprasījuma satura.
- **ACL un piekļuves politika** nosaka, vai darbības ar resursiem ir atļautas.
- **VFS Core** analizē resursa kanonisko URI, nosaka resursa apgabalu un savienojumu, pārbauda piekļuvi un pēc tam nodod operāciju atbilstošajam provider. Lasīšana, rakstīšana, direktoriju apskate, pārvietošana un provider komandas tiek apstrādātas caur šo kopīgo slāni.
- **Providers** pielāgo dažādus resursu tipus vienotam VFS līgumam. HTML provider pārvalda vietnes un lapu struktūru; local provider nodrošina piekļuvi failu saturam; citi providers apkalpo sistēmas un lietotāju resursus.

Parastā API pieprasījumā tokens vispirms nosaka actor. Pēc tam VFS Core apstrādā URI, pārbauda piekļuvi resursa apgabalam un pieprasītajai darbībai un tikai pēc atļaujas saņemšanas izsauc provider. Provider veic savu datu pārbaudi un operāciju; ja provider atsaka operāciju, atteikums tiek atgriezts klientam. Pārlūkprogramma un providers nepiekļūst tieši cits cita datu krātuvēm.

Pašreizējā servera versijā VFS piekļuves pārbaude izmanto pagaidu politiku sistēmas, lietotāju un konfigurētajiem publiskajiem resursu apgabaliem. Tas ir pārejas risinājums, nevis pilnvērtīga detalizētu ACL tiesību pārvaldība katram resursam.

## Vietnes, lapas un bloki

Vietne sastāv no lapu struktūras un to satura failiem. HTML provider glabā vietnes metadatus, lapu koku, to adreses, statusus un bundle atrašanās vietas, savukārt bundle failus caur VFS apkalpo failu provider.

- Katrai lapai ir metadati un bundle ar `content.md`, `style.css` un `script.js`.
- **Bloki** ir atkārtoti izmantojami vietnes elementi. To metadati un atrašanās vietas tiek glabātas atsevišķi, un bloks var saturēt Markdown, stilus un JavaScript. Bloki tiek organizēti kokveida struktūrā, lai nodrošinātu to pārvaldību un ielādi.
- **Lietotnes veidne** satur vietnes pamata struktūru un frontend failus. Uzstādītās veidnes versijas ir nemaināmas: veidnes atjaunināšana neaizstāj lapu saturu.

Atverot vietni, serveris pārbauda maršrutu un atgriež frontend pamata struktūru. Frontend iegūst vietnes kontekstu, ielādē lapu koku un metadatus caur VFS API, pēc tam pieprasa nepieciešamās lapas bundle un izmantotos blokus. Pārlūkprogramma izveido lapu no satura, stiliem un skriptiem. Publiskais maršruts ir pieejams lapai ar statusu `ready`, ja visas tās hierarhijā esošās lapas atbilst publicēšanas nosacījumiem.

## SPA (Single Page Application)

Veido frontend darbojas pēc SPA (Single Page Application) principa - pārejot starp vietnes lapām, nav nepieciešams pilnībā pārlādēt pārlūkprogrammas lapu.

JavaScript pārvalda navigāciju un dinamiski ielādē nepieciešamo lapu un bloku saturu, izmantojot VFS API. HTML/Markdown saturs tiek attēlots pārlūkprogrammā kopā ar attiecīgajiem CSS stiliem un JavaScript skriptiem. Tas ļauj mainīt vietnes saturu, saglabājot kopējo lietotnes struktūru.

## Redaktori un resursu pārvaldība

- **Bloku redaktors** ļauj strādāt ar vizuālo attēlojumu un HTML/Markdown, CSS un JavaScript pirmkodu, mainīt elementu īpašības, priekšskatīt rezultātu un atgriezties pie iepriekšējām izmaiņām.
- **Failu pārvaldnieks** ļauj apskatīt direktorijas, meklēt un izvēlēties failus, pārvietoties pa navigācijas vēsturi, pārdēvēt un pārvietot resursus, kā arī pārvaldīt to īpašības un piekļuves tiesības.
- **Vietnes pārvaldība** nodrošina darbu ar lapām, blokiem, veidnēm un to metadatiem, izmantojot VFS API un HTML provider komandas. Fiziskos failus un attiecīgos datus maina provider, kura pārziņā tie atrodas.
- Mainot vietnes vai lapas struktūru, tiek izmantotas revīzijas. Ja dati jau ir mainīti, serveris atgriež konflikta kļūdu, lai nepieļautu jaunākas versijas nemanāmu pārrakstīšanu.

## Datu glabāšana, piekļuve un publicēšana

SQLite glabā vietnes, lietotāju, lapu, bloku un resursu apgabalu metadatus. Failu saturs tiek glabāts CAS (content-addressed storage), savukārt providers sasaista failus ar VFS resursiem.

Katra operācija tiek veikta sākotnējā pieprasījuma actor vārdā un adresēta ar kanonisko URI. VFS Core veic piekļuves pārbaudi pirms provider izsaukšanas. Redzamības filtrs palīdz noteikt vietnes attēlojumu, taču neaizstāj autorizāciju.

Publicēšanas sistēma nodala frontend veidni no vietnes satura: veidne tiek uzstādīta kā atsevišķa versija, lapas tiek pārvaldītas, izmantojot metadatus un bundle, bet publicēšanai gatavās lapas tiek iekļautas publiskajā maršrutēšanā. Atverot vietni, apmeklētājs saņem vietnes pamata struktūru un izvēlētajam maršrutam nepieciešamos resursus.

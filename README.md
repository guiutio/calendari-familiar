# Calendari Familiar · Web MVP v0.1.11

Prototip funcional **mobile-first** en català per planificar la convivència i els horaris escolars dels fills. **Sense servidor d'aplicació, registre ni sincronització**. La informació familiar roman al navegador del dispositiu.

## Provar-lo al Mac
**Via ràpida (macOS):** fes doble clic a `Inicia-al-Mac.command` o executa `./Inicia-al-Mac.command` des del Terminal. Obrirà el navegador i mantindrà un servidor local actiu fins que tanquis el Terminal.


1. Descomprimeix el projecte.
2. Obre Terminal dins la carpeta `calendari-familiar-web`.
3. Executa `python3 -m http.server 8080`.
4. Visita `http://localhost:8080` al Mac.

No requereix `npm install`. El JavaScript `app.js` ja està compilat.

> **No obris `index.html` amb un doble clic** per fer proves de persistència/PWA: Safari pot restringir `IndexedDB` o els Service Workers sota `file://`. Utilitza HTTP local o un allotjament HTTPS.

## Instal·lar-lo a l'iPhone

Per obrir-lo des de l'iPhone, has de servir els mateixos fitxers en una URL **HTTPS** (p. ex. Cloudflare Pages, Netlify o GitHub Pages). Un servidor al Mac accessible des de l'iPhone per HTTP pot servir per comprovar la interfície, però per instal·lar una PWA amb funcionament offline, usa HTTPS.

1. Publica el contingut de la carpeta com a lloc web estàtic, sense pas de compilació.
2. Obre la URL HTTPS amb Safari a l'iPhone.
3. Comparteix → «Afegir a la pantalla d'inici» → «Obrir com a aplicació» (si apareix).
4. Obre l'aplicació des de la icona nova.

**Important:** Safari i l'app instal·lada poden mantenir les dades en espais d'emmagatzematge diferents. Exporta/Importa JSON per moure-les. No utilitzis navegació privada si vols conservar-les.

## Inclou

- Calendari mensual de dilluns a diumenge, avançar/retrocedir mes i tornar a avui.
- Agrupament de fills quan dormen amb el mateix tutor, amb color i inicials dels fills, sense icona o inicial del tutor en les caselles.
- Filtres compactes de fills i tutors.
- Editor de rotació amb durada configurable en dies o setmanes (per exemple, 10 setmanes = 70 dies), i assignació setmanal ràpida, aplicació «Tots igual» i «Copiar de ...».
- Modificacions puntuals per fill i data; tornar al patró habitual.
- Fills i tutors editables; data de naixement opcional i aniversaris.
- Persistència automàtica en **IndexedDB** (fallback a localStorage quan no és disponible).
- Còpies de seguretat: exportació/importació JSON, amb comprovacions bàsiques.
- Dades de mostra: Elna i Blai, Pare i Mare, sense dates de naixement, amb patró de **10 setmanes (70 dies)** des del **12 d’octubre de 2026**. Una mostra antiga intacta s’actualitza automàticament; si hi ha canvis, es conserven i es poden restablir explícitament les dades de mostra.
- PWA amb manifest, icones i memòria cau de fitxers per a ús offline.

## Desenvolupament

Codi font a `src/app.ts` i estils a `styles.css`. No hi ha dependències en execució. Si vols modificar TypeScript, utilitza el compilador TypeScript (`tsc`) i executa:

```sh
npm run build
```

Aquest prototip de validació és **TypeScript + DOM natiu** per poder-lo executar sense passos d'instal·lació ni dependències. Si l'app es consolida, es pot refactoritzar la capa de presentació cap a React sense canviar el model de dades.

## Limitacions actuals

- Hi ha vistes **mensual, setmanal i diària**, però la representació detallada de les noves activitats de l'horari escolar ordinari a les cel·les es definirà a la v0.2.0.
- No inclou rotacions amb dates d'inici específiques per fill ni múltiples patrons alhora: una rotació global, independentment de les assignacions per fill.
- No hi ha comptes ni sincronització entre dispositius. Cada origin web/navegador disposa de dades independents.
- Les dades locals poden desaparèixer en eliminar dades del lloc, de l'app o per polítiques del navegador. **Exporta còpies periòdicament.**
- La informació es desa en clar al dispositiu; no està xifrada ni protegida per una contrasenya pròpia.

## Estructura

```text
index.html               Entrada web
styles.css               Interfície responsive per iPhone
app.js                   JavaScript compilat, llest per servir
src/app.ts               Codi font TypeScript
sw.js                    Service Worker / caché offline
manifest.webmanifest     Metadades PWA
assets/                  Icones
```

## Aparença (v0.1.2)

A **Configuració → Aparença** es pot seleccionar **Automàtic** (segueix el tema del sistema), **Clar** o **Fosc**. La preferència es desa amb les dades locals, s’inclou al fitxer exportat i els fitxers de còpies anteriors continuen sent compatibles.

## Dades d’exemple (v0.1.3)

El patró comença el **dilluns 12 d’octubre de 2026** i es repeteix cada **70 dies**, igual per a Elna i Blai.

| Setmana | Tutor principal | Dies especials |
|---|---|---|
| 1 | Pare | — |
| 2 | Mare | Diumenge: Pare (25/10/2026) |
| 3 | Pare | — |
| 4 | Mare | — |
| 5 | Pare | — |
| 6 | Pare | — |
| 7 | Mare | Diumenge: Pare (29/11/2026) |
| 8 | Pare | — |
| 9 | Mare | — |
| 10 | Pare | Dissabte i diumenge: Mare (19–20/12/2026) |

Les excepcions formen part del patró que es repeteix, no són canvis d'una sola data. Per veure aquest patró amb dades guardades d'una altra versió, ves a **Configuració → Restableix les dades d'exemple**; l'acció demana confirmació i esborra els teus canvis (recomanem exportar un JSON abans). Si les dades eren les mostres anteriors intactes, s'actualitzen soles.


## v0.1.7: escoles visibles opcionalment al calendari

- Les escoles es mostren com a contenidors de fills, per sobre de la pernocta (tutor). Per defecte estan ocultes.
- Les icones de persones (fills), cases (tutors) i escoles només acompanyen aquestes entitats al panell de filtres.
- Cada escola pot triar un color propi, distint dels altres centres; migració automàtica dels antics registres sense color.
- Es mostra una escola en dies de curs no festius; es respecta l’horari setmanal del grup i, si és buit, s’assumeix de dilluns a divendres.
- Les dades existents, la configuració de pernoctes i les còpies JSON antigues són compatibles.

## v0.1.8: franges i columnes per fill

- Calendari mensual amb cinc files per dia (Matí, Dinar, Tarda, Sopar, Nit) i una columna per fill. Els fills no s'agrupen.
- Vistes mensual, setmanal i diària, totes amb les mateixes franges. Al panell de filtres, cada franja es pot mostrar o ocultar. Les escoles continuen ocultes per defecte.
- La nit segueix la rotació de 10 setmanes i manté les excepcions; les altres franges són independents i queden buides si no estan assignades. Es poden assignar tutors a una data i una franja puntual.
- Escoles: si hi ha horari setmanal, es mostra l'escola a les franges de matí/dinar/tarda quan cobreix com a mínim la meitat de la franja aproximada (08–12, 12–15, 15–18). Sense horari, s'assumeixen matí i tarda de dilluns a divendres, però no el dinar. En festius no es mostra; en dies reduïts només es mostra el matí.
- Les preferències i les assignacions puntuals de franges es desen en IndexedDB i en les còpies JSON; els fitxers de versions antigues s'importen sense necessitat de migració destructiva.

## v0.1.9: horari escolar ordinari

- **Escoles → Curs → Grup:** crea horaris ordinaris setmanals, amb dia de la setmana, hora d'inici i final, tipus d'activitat (classe, pati, menjador, extraescolar o altres) i descripció opcional.
- Es poden crear franges per a **diversos dies alhora** (dilluns a divendres per defecte), editar franges existents i suprimir-les. Es rebutgen els solapaments dins d'un mateix horari.
- L'horari del grup és el patró comú. A la mateixa pantalla, selecciona un fill i prem **Personalitza l'horari** per crear una còpia independent que pots ajustar sense canviar la resta del grup. **Recupera l'horari del grup** descarta la personalització.
- Els horaris individuals només existeixen per a fills matriculats al grup: es netegen en moure o esborrar una matrícula i en suprimir el fill.
- **Compatibilitat:** les còpies i dades de la v0.1.8 continuen sent vàlides; les franges existents es tracten com a activitats de tipus «Classe». L'exportació JSON conserva els horaris individuals.
- **Abast:** aquesta versió defineix i desa els **horaris ordinaris**. La configuració de jornades reduïdes i els seus horaris especials es reserva per a la v0.1.10; la representació detallada d'aquests horaris a les vistes del calendari es definirà a la v0.2.0. L'indicador escolar bàsic del calendari actual es conserva.

### Com provar la v0.1.9

1. Afegeix una escola, curs i grup; assigna-hi un fill.
2. A l'horari del **Grup**, crea una franja per a dilluns-divendres i prova de crear-ne una altra que se solapi: no s'ha de permetre.
3. Selecciona el fill, personalitza l'horari, edita una franja i comprova que les franges del grup no canvien.
4. Recupera l'horari del grup i comprova que es tornen a veure les franges compartides.
5. Exporta un JSON, torna a importar-lo i comprova que es conserven els horaris.

## v0.1.10: jornades escolars reduïdes

- **Escoles → Curs → Hores de jornada reduïda:** especifica les hores d'inici i final reals del tipus de jornada reduïda. No se n'assumeix cap hora per defecte. Els dies del curs marcats com a «Horari reduït» comparteixen aquesta finestra horària.
- **Escoles → Curs → Grup → Jornada reduïda:** veu el resultat automàtic de retallar cada activitat de l'horari ordinari a la finestra establerta. Les activitats que no coincideixen amb la finestra s'ometen; les que hi coincideixen parcialment es retallen. L'horari ordinari no es modifica.
- **Horari reduït específic:** si el resultat automàtic no coincideix amb la realitat, pots crear una còpia independent i modificar-la, afegir-hi franges o eliminar-ne. Permet horaris específics per grup o per fill. Les activitats específiques han de ser dins de la finestra i no poden solapar-se.
- **Herència i recuperació:** els fills hereten l'horari reduït específic del grup, si existeix; en cas contrari s'utilitza el seu horari ordinari retallat. Recuperar l'horari de referència descarta les modificacions reduïdes, no les ordinàries.
- **Validació i migració:** les dades de 0.1.9 i les còpies JSON anteriors continuen funcionant. Les noves dades es conserven en exportar/importar; es rebutgen intervals invàlids i franges fora dels límits, i es netegen les dades d'un fill en canviar de grup o eliminar-lo.
- **Calendari:** manté les vistes i els contenidors de la 0.1.9. El color escolar bàsic consulta les activitats corresponents a la jornada reduïda; la representació detallada de les activitats a les cel·les resta per a la **v0.2.0**.

### Prova manual de la 0.1.10

1. Al curs, afegeix un dia de jornada reduïda i configura una finestra, per exemple de 09:00 a 13:00.
2. Al grup, defineix una activitat ordinària 08:30–10:30 i una altra de 12:30–14:00. A «Jornada reduïda» s'han de veure 09:00–10:30 i 12:30–13:00.
3. Crea un horari reduït específic del grup i edita una franja; comprova que la jornada ordinària no canvia.
4. Personalitza l'horari reduït d'un fill i després recupera l'horari del grup. Verifica que el resultat és l'esperat.
5. Exporta/importa les dades i comprova que el límit reduït i les personalitzacions es mantenen.

## v0.1.11: correcció de desplaçament vertical

- En mòbils i tauletes, el contingut té scroll propi; la barra inferior forma part de la graella i no cobreix l'últim element de les pantalles.
- Es respecta l'àrea segura inferior de l'iPhone i l'alçada visible de la finestra.
- Es conserva la posició vertical quan es redibuixa la mateixa vista (filtres, canvis i formularis); navegar entre seccions o nivells escolars comença a dalt.
- Els diàlegs llargs es desplacen independentment, amb alçada adaptada a la pantalla.
- No canvia cap dada, ni la importació/exportació JSON de versions anteriors.

La visualització detallada dels horaris escolars al calendari queda reservada per a la **v0.2.0**.

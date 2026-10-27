# Calendari Familiar · Web MVP v0.1.3

Prototip funcional **mobile-first** en català per planificar les nits dels fills. **Sense servidor d'aplicació, registre ni sincronització**. La informació familiar roman al navegador del dispositiu.

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

- Només vista **mensual** (amb full de detall i edició del dia). Les vistes setmanal/diària amb horaris encara no estan implementades.
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

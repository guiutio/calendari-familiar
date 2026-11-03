# Calendari Familiar · Web MVP v0.5.3

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
- PWA amb manifest, icones i memòria cau de fitxers per a ús offline.

## Desenvolupament

Codi font a `src/app.ts` i estils a `styles.css`. No hi ha dependències en execució. Si vols modificar TypeScript, utilitza el compilador TypeScript (`tsc`) i executa:

```sh
npm run build
```

Aquest prototip de validació és **TypeScript + DOM natiu** per poder-lo executar sense passos d'instal·lació ni dependències. Si l'app es consolida, es pot refactoritzar la capa de presentació cap a React sense canviar el model de dades.

## Limitacions actuals

- Les vistes **diària i setmanal** mostren activitats escolars a escala horària proporcional; la vista **mensual** utilitza indicadors compactes i permet obrir-ne el detall per dia.
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
- **Abast:** aquesta versió defineix i desa els **horaris ordinaris**. La configuració de jornades reduïdes i els seus horaris especials es reserva per a la v0.1.10; la representació detallada d'aquests horaris a les vistes del calendari es definirà a la v0.3.0. L'indicador escolar bàsic del calendari actual es conserva.

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
- **Calendari:** en aquella versió es conservà la representació bàsica; des de la **v0.3.0** també es poden veure les activitats amb hores reals.

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

La visualització detallada dels horaris escolars al calendari queda reservada per a la **v0.3.0**.

## v0.1.12: barra inferior estable amb contingut curt

- Corregeix la barra de navegació inferior, que es podia aixecar en algunes pantalles d'**Escoles** amb poc contingut.
- En mòbils, el contenidor global ocupa sempre l'espai de pantalla real disponible i distribueix l'espai vertical amb Flexbox, sense dependre de `100dvh` ni de l'alçada del contingut.
- La barra inferior queda fora de la zona desplaçable i conserva l'àrea segura de l'iPhone. Les vistes llargues continuen permetent arribar fins al final.
- Sense canvis a dades, horaris, rotacions ni còpies JSON. La següent versió funcional continua sent **v0.3.0**.

## v0.1.13: evitar el rebot tàctil d'iOS a Escoles

- En pantalles curtes (especialment **Escoles**) es bloqueja l'arrossegament que voldria desplaçar contingut inexistent i provocar el rebot elàstic de Safari.
- A les pantalles llargues, el scroll vertical continua funcionant en tots dos sentits fins al primer i l'últim element; es bloqueja només el gest que ultrapassa els extrems.
- Els formularis i filtres poden continuar desplaçant-se de forma independent; els gestos horitzontals i l'escriptori no es veuen afectats.
- Correcció complementària de `overscroll-behavior` i de la gestió de `touchmove`, amb listener explícit no passiu i proves de regressió.
- Sense canvis en les dades locals o les còpies de seguretat. La següent versió funcional segueix sent **v0.3.0**.

## v0.2.0: mida de lletra ajustable

- A **Configuració → Mida de lletra**, un control lliscant ofereix tres nivells: **Normal (100 %)**, **Gran (125 %)** i **Molt gran (150 %)**.
- El canvi és immediat mentre es mou el control, tant en mode clar com fosc. Escala tots els textos de les vistes, dels botons, del calendari i dels formularis.
- Les pantalles estretes adapten l'espai disponible perquè els títols, els botons i les pestanyes no quedin tallats.
- La preferència es desa automàticament amb la resta de dades i s'inclou en exportar/importar JSON. Les còpies anteriors, sense aquesta propietat, importen el nivell Normal.
- El restabliment de dades de mostra conserva les preferències de tema i de mida de lletra.

**Planificació:** la visualització detallada dels horaris escolars passa a la **v0.3.0** i els patrons familiars a la **v0.5.0** (la 0.2.0 es dedica a llegibilitat).

## v0.3.0: horaris escolars detallats al calendari

- **Mes:** marcador del nombre d'activitats escolars amb hores definides en cada dia. El detall és accessible tocant la data.
- **Setmana:** cada jornada mostra, sota les assignacions familiars, les activitats horàries reals amb una línia temporal d'escala homogènia durant la setmana i columnes per fill.
- **Dia i detall del mes:** activitats ordinàries o reduïdes per escola i fill, amb hores exactes, classe, pati, menjador, extraescolar o altres activitats, descripció i color identificatiu del centre.
- **Temps proporcional:** la posició i altura dels blocs depenen dels minuts d'inici, final i durada. No es generen hores inexistents. Les sessions molt curtes poden consultar-se tocant el bloc o a la llista accessible.
- **Filtres i compatibilitat:** les escoles continuen ocultes per defecte; només es mostren les activitats dels centres activats. Es respecten festius, dates del curs, horaris individuals, jornades reduïdes i personalitzacions. La rotació de nits i les franges familiars no canvien.
- S'afegeix un llistat alternatiu d'activitats per llegir horaris complets, especialment amb mida de lletra gran o molts fills.
- No canvia l'estructura del model de dades ni el format dels JSON.

**Planificació actual:** v0.5.0, patrons de responsabilitat familiar recurrents.

## v0.3.1: correcció de jerarquia dels horaris escolars

- Cada **escola** disposa d'un horari ordinari setmanal de referència, configurat a la fitxa de l'escola sense haver de crear cap grup ni curs.
- Els fills es poden associar directament a l'escola i consultar-ne l'horari escolar al calendari sense assignar-los a cap grup.
- Dins de cada **grup** es poden afegir activitats específiques (pati, menjador, extraescolars, etc.) **dins de les hores de l'escola**, que substitueixen només la part de la franja general ocupada per l'activitat.
- Es retiren els controls per definir o canviar horaris ordinaris individualitzats per fill. Els antics horaris individuals i les personalitzacions reduïdes es conserven en les dades per compatibilitat, però no es creen de nous.
- Les jornades reduïdes continuen depenent de l'interval definit al curs i els dies festius no presenten activitats. Els horaris especials de grup continuen disponibles.
- La còpia de dades antiga s'importa sense errors; les noves propietats d'horari ordinari i fills de l'escola es creen buides en importar fitxers antics.
- No es canvien nits, rotacions ni preferències de mida de lletra. Funcionalitat pendent: patrons recurrents a la v0.5.0.

## v0.3.2: correcció de les hores generals del curs escolar

- **Escoles → Curs → Calendari escolar** incorpora «Hores de jornada ordinària», amb un únic inici i final per a tots els dies lectius normals del curs, al mateix nivell que les hores de jornada reduïda.
- **L’escola no defineix activitats per franges.** Es retira l’editor de franges generals d’escola introduït a la 0.3.1. L’interval ordinari no indica si els fills fan classe, pati o mengen.
- **Cada grup** defineix les seves pròpies activitats i hores dins d’aquest interval ordinari. Les activitats d’un grup poden ser diferents i en hores diferents de les d’un altre. No es poden crear activitats noves fora de la jornada ordinària.
- **Calendari:** el temps ordinari d’un fill matriculat es mostra com a «Jornada escolar», mentre les activitats del grup es mostren amb la seva categoria. La jornada normal només s’aplica de dilluns a divendres i s’exclou en festius i dies reduïts; els dies reduïts segueixen el seu interval específic.
- **Compatibilitat:** les franges generals antigues de la v0.3.1 continuen guardades dins dels JSON i només s’utilitzen com a lectura de compatibilitat en cursos que encara no tenen una jornada ordinària definida. No es perden els horaris de grup ja introduïts.
- Aquest canvi és una **correcció v0.3.2**, no una nova funcionalitat.

## v0.3.3: activitats de grup en jornada reduïda

- A **Escoles → Curs → Grup**, l'apartat anterior «Jornada reduïda del grup» passa a ser **«Activitats en jornada reduïda»**.
- Si el curs té definides les hores de jornada reduïda, es pot prémer **«+ Activitat»** directament, escollir els dies de la setmana, l'hora inicial/final de cada activitat, el tipus (classe, pati, menjador, extraescolar, altres) i la descripció. Les hores han de quedar dins de l'interval reduït configurat al curs.
- Les activitats es poden **afegir, editar i suprimir individualment** i també es poden esborrar totes les activitats reduïdes d'un grup. Desapareix l'etapa «Defineix horari específic» que copiava automàticament franges genèriques.
- En l'editor del grup **només figuren les activitats definides**; no es llisten com a activitats les cinc franges generals «Altres» de 09:00 a 13:00.
- **Calendari:** en un dia reduït es mostra la jornada escolar com a context entre les hores del curs i les activitats específiques del grup, si n'hi ha. Les activitats ordinàries del grup no s'atribueixen automàticament a dies reduïts. Els dies no marcats com a jornada reduïda continuen mostrant l'horari ordinari.
- **Compatibilitat:** es preserven les activitats reduïdes que l'usuari havia introduït prèviament, així com els horaris individuals històrics (només lectura). El format de dades es manté.
- Correcció **v0.3.3** els patrons familiars recurrents passen a la v0.5.0.

## v0.4.0: vista diària de 24 hores i canvi de pernocta

- **Calendari → Dia:** substitueix exclusivament la graella de cinc franges familiars per una sola línia temporal de 24 hores, amb una columna per fill, les hores proporcionals als minuts reals i les activitats escolars superposades. Les vistes mensual i setmanal no es modifiquen.
- La línia temporal té scroll vertical propi de **00:00 a 24:00**, s'obre posicionada a les **06:00** i presenta inicialment aproximadament les hores **06:00–22:00**; es pot desplaçar per veure el tram anterior i posterior. També admet scroll horitzontal quan hi ha molts fills.
- **Rotacions → Hora de canvi de pernocta:** valor inicial **19:00**, editable amb selector horari. La nit assignada a una data s'aplica des de l'hora de canvi d'aquella data fins a la mateixa hora de l'endemà.
- A la vista diària, **00:00–19:00** correspon a l'assignació de la nit anterior i **19:00–24:00** a la de la nit actual, per defecte. Els canvis puntuals de nits es respecten. Els blocs permeten obrir l'editor de la nit.
- Els horaris escolars s'apilen per damunt del color de pernocta, però no alteren la rotació ni les assignacions. Els filtres de fills, tutors i escoles segueixen actius.
- L'hora de canvi es conserva amb la rotació al desament i a les còpies JSON; les còpies anteriors sense l'hora de canvi es migren amb **19:00**, sense alterar altres dades.
- Es mantenen intactes les cinc franges convencionals a les vistes setmanal i mensual, i al detall mensual.

**Planificació vigent:** v0.5.0, patrons recurrents d'horaris familiars i responsabilitat diürna.

## v0.4.1: eliminació del text redundant de la vista diària

- Es retira el bloc de tres línies situat damunt de la cronologia diària: «Dia complet · 00:00–24:00», «Inici visible: 06:00…» i «Canvi de pernocta: 19:00».
- La taula **Hora / Fills** queda immediatament sota la data, sense aquest text intermedi.
- No canvien el scroll de 24 hores, el posicionament inicial a les 06:00, les activitats escolars ni les pernoctes. L'hora de canvi continua essent editable a Rotacions i predeterminada a les 19:00.
- No hi ha canvis en l'estructura de les dades ni en les còpies JSON.

## v0.5.0: setmana horària en set columnes

- **Calendari → Setmana** reutilitza la mateixa línia temporal que la vista **Dia**: una escala vertical de 24 hores, de les **00:00 a les 24:00**, amb desplaçament inicial a les **06:00**, pernoctes i activitats escolars superposades a la franja temporal que els correspon.
- Els **set dies de dilluns a diumenge** es mostren en columnes d'esquerra a dreta. Cada dia conté una subcolumna per cadascun dels fills visibles, amb pernocta i activitats pròpies. Les activitats no es barregen entre dies ni entre fills.
- L'espai de capçaleres mostra **dia i fills** i es manté visible en desplaçar-se verticalment. L'eix «Hora» es manté visible en desplaçar-se horitzontalment.
- En pantalles estretes, es permet **scroll horitzontal** dins de la mateixa taula i **scroll vertical** per recórrer les hores d'un dia complet. Els set dies comparteixen exactament la mateixa escala temporal.
- Tocant la capçalera d'una jornada, es passa a la vista **Dia** de la data corresponent. Les pernoctes i les activitats escolars mantenen els editors i els filtres existents.
- La vista Dia i el Mes no canvien d'estructura; el desplaçament vertical i horitzontal de la vista Setmana es preserva en actualitzar dades sense navegar a una altra setmana.
- No canvia el model de dades, la persistència local o l'exportació/importació JSON. La funcionalitat planificada de patrons familiars recurrents es posposa a una futura versió (a partir de la v0.6.0).

## v0.5.2: Zoom horari a Dia i Setmana

- **Calendari → Dia / Setmana** incorpora un control de zoom vertical amb botons **−** i **+** i un lliscador de cinc nivells: **50%, 75%, 100%, 125%, 150%**.
- El valor per defecte és **100%**, igual que l'escala de la v0.5.0. A **50%** la cronologia de 24 hores ocupa aproximadament la meitat d'alçada i s'hi veuen moltes més hores de cop; a **150%** els blocs són més alts i les activitats es poden llegir amb més detall.
- El zoom és **compartit** entre Dia i Setmana, canvia les posicions i alçades de les activitats, les pernoctes i les línies horàries, sense alterar les dades, els horaris ni les dates.
- En canviar el zoom, es procura mantenir **la mateixa hora al centre** de la vista; el desplaçament horitzontal setmanal també es conserva. Els límits naturals del scroll s'apliquen quan entra tot el dia.
- La preferència queda desada localment, s'inclou a les exportacions/importacions JSON i es manté en restablir les dades de mostra. Les còpies antigues sense zoom adopten **100%**.
- Les activitats molt breus poden quedar visualment petites als zooms més baixos; són consultables tocant-les o a la llista accessible de sota la cronologia.
- No modifica les vistes mensual ni les franges familiars. És una millora puntual de la **v0.5.2**.

## v0.5.2: zoom 50 % per defecte, mínim 25 % i scroll setmanal natural

- **Dia i Setmana:** sis nivells de zoom: **25 %, 50 %, 75 %, 100 %, 125 % i 150 %**. El predeterminat és **50 %** per a noves dades i còpies antigues sense aquesta preferència. Una preferència ja desada es manté.
- **25 %:** les 24 hores ocupen **288 px**, amb etiquetes horàries cada dues hores per evitar superposicions. **50 %:** les 24 hores ocupen **576 px**.
- **Dia:** el contenidor ajusta l'alçada quan el calendari és més petit per evitar espais buits.
- **Setmana:** la graella manté el scroll horitzontal, però **el gest vertical desplaça la pàgina sencera**, fins i tot quan comença dins del calendari. La vista deixa marges tàctils a esquerra i dreta i mostra les 24 hores a l'alçada real del zoom.
- El protector de desplaçament d'iOS respecta el scroll de la pàgina quan un gest vertical comença dins de la setmana.
- Es conserven pernoctes, escoles, filtres, imports i preferències.

## v0.5.3: Dia i Setmana compactes, scroll vertical de pàgina

- **Dia i Setmana:** totes les 24 hores formen part del desplaçament vertical de la **pàgina principal**, no d'una finestra de scroll vertical interior. Els gestos verticals sobre la graella es deleguen a la pàgina; els horitzontals continuen desplaçant el calendari.
- **Marges tàctils:** el calendari ocupa una amplada lleugerament menor que la pàgina per facilitar el scroll vertical començant fora de la graella, igual a Dia i Setmana.
- **Columnes més estretes:** cada fill té una columna d'uns **98 px**, en lloc dels **145 px** anteriors, tant en la vista diària com en cadascun dels set dies de la setmana. Quan hi ha molts fills, es manté el scroll horitzontal.
- **Zoom:** es conserven els sis nivells **25%, 50%, 75%, 100%, 125% i 150%**, amb **50% per defecte**. En ampliar o reduir la cronologia, l'app procura conservar l'hora que es veia al centre, ara ajustant el scroll de la pàgina.
- La línia temporal completa comença a 00:00 i acaba a 24:00; quan no es mostren totes les hores, el desplaçament de la pàgina permet consultar-les. Les pernoctes, activitats, filtres i còpies JSON no canvien.


## v0.7.0: mesos continus i navegació fixa

- Vista Mes amb desplaçament vertical pels mesos consecutius, en ambdues direccions. Els mesos es carreguen a mesura que calen i es limita el nombre de panells per mantenir el rendiment.
- Barra superior fixa amb Mes, Setmana i Dia, el període visible, Avui i fletxes per avançar o retrocedir segons la vista.
- En desplaçar els mesos, la barra mostra el mes visible. Canviar de vista conserva la data de referència; Avui torna a la data actual.
- Es conserven miniatures, contorns, filtres, números de setmana i edició de pernoctes i activitats.


## v0.7.1: actualització a la versió publicada

- La pantalla d’actualització detecta la versió que serveix index.html i comprova que app.js coincideixi abans de renovar els fitxers temporals. Ja no exigeix una versió antiga fixada al codi.
- El botó d’actualització obre la comprovació amb una URL nova per evitar una pàgina antiga a la memòria cau. Les dades familiars es conserven.


## v0.7.2: barra superior ancorada fora del calendari

- La barra de navegació ocupa tota l’amplada superior, sense cantonades arrodonides ni efecte flotant.
- En mòbil és fora del contenidor desplaçable, inclou la zona segura superior amb fons opac i el calendari queda retallat per sota. També s’aplica a Dia i Setmana.
- Es conserva la posició dels mesos en navegar, aplicar filtres i carregar mesos consecutius.


## v0.7.3: mesos units sense setmanes repetides

- Les setmanes compartides entre mesos apareixen una sola vegada, en una graella contínua sense separadors ni títols intermedis.
- La capçalera dels dies de la setmana queda una sola vegada a la barra fixa; el títol superior indica el mes visible.
- Es conserven els contorns reals de cada mes i la navegació enfoca la setmana que conté el primer dia, també si el mes comença en diumenge.


## v0.7.4: desplaçament mensual estable

- La càrrega i retirada de mesos s’executa després que s’aturi el moviment i sense cap dit premut, per respectar la inèrcia tàctil.
- La posició només es compensa si ha canviat el contingut; les correccions no activen un nou cicle de càrrega. Es desactiva l’ancoratge automàtic del navegador al calendari per evitar compensacions dobles.


## v0.7.5: filtres de fills, tutors i escoles

- Es retira el filtre antic de Matí, Dinar, Tarda, Sopar i Nit. L’indicador de filtres actius ja no té en compte aquesta preferència antiga.
- «Mostra-ho tot» actua sobre els fills, tutors i escoles. Es mantenen els horaris, les franges familiars i les còpies de seguretat existents.


## v0.7.6: límits de mes amb títol a tota l’amplada

- Cada mes acaba el seu últim dia; després hi ha el nom del següent mes a tota l’amplada i la seva graella comença pel dia 1.
- Els espais abans de l’1 i després de l’últim dia queden buits per respectar les columnes de dilluns a diumenge. No es repeteixen dates ni assignacions d’altres mesos.
- La navegació enfoca el títol del mes i es conserven la barra fixa, els contorns i l’estabilització de la inèrcia.


## v0.7.7: amplada de les franges mensuals coherent amb Dia i Setmana

- Les activitats de rotació amb tutor ocupen tota la columna del fill. Sense tutor deixen el mateix marge lateral del 23% que a Dia i Setmana, en lloc del 48% anterior.
- Les activitats escolars aprofiten tota l’amplada de la columna, sense el marge especial que només s’aplicava al mes, també en pantalles estretes.
- Es conserven els horaris, els colors, els filtres i la compressió de les hores nocturnes.


## v0.7.8: desament explícit de les altres rotacions

- Cada rotació addicional té «Desa els canvis» i «Descarta canvis», com el patró de pernocta.
- Nom, horari, dates, durada, participants, dies actius i tutors s’editen en un esborrany. El calendari i les exportacions continuen utilitzant el patró confirmat fins que es desa.
- Les rotacions noves també s’han de desar. Descartar-les elimina només l’esborrany. Els canvis puntuals d’una data al calendari mantenen el seu desament propi.


## v0.7.9: sense dades d’exemple

- L’app comença buida, sense fills, tutors, escoles ni assignacions predefinides.
- S’elimina el botó de carregar dades d’exemple i les migracions automàtiques d’aquelles mostres. Les dades familiars ja desades es conserven.


## v0.8.0: pestanya Persones

- Nova pestanya «Persones», amb icona de grup de persones, a la barra inferior i al menú lateral.
- La gestió de fills, dates de naixement, tutors i colors passa d’Ajustos a Persones. Els accessos per començar a afegir fills o tutors també porten a aquesta pestanya.
- Ajustos conserva aparença, mida de lletra, actualitzacions, còpies de seguretat i gestió de dades.


## v0.8.1: zoom en un panell propi

- El zoom de Dia i Setmana es configura des d’un botó amb lupa al costat dels filtres, a la barra superior.
- S’obre un panell com el de filtres, amb botons −/+, lliscador, percentatge i «Fet». Es retira el control que ocupava espai damunt de la graella.
- Es mantenen els nivells de 25% a 150% i la mateixa hora visible en ajustar el zoom. Dia i Setmana desen nivells independents, que es recuperen en canviar de vista i en reobrir l’app. Les còpies anteriors amb un únic nivell es migren a les dues vistes.


## v0.8.2: selectors de dates i hores estables

- Els canvis no reconstrueixen la pantalla mentre un selector nadiu és actiu. El redibuix pendent s’aplica en acabar l’edició, respectant els clics de desar i els formularis.
- Canviar l’hora d’una pernocta puntual conserva el panell obert fins que l’usuari el tanca.
- Es limita l’amplada dels controls nadius i dels seus contenidors per evitar que surtin del requadre a iOS.


## v0.9.0: períodes de vacances escolars

- A Escoles → curs → Calendari escolar es poden afegir, editar i eliminar períodes amb nom, inici i final, com Setmana Santa o Vacances de Nadal.
- Tots els dies de l’interval, inclosos els extrems, tenen el mateix efecte que un festiu escolar: no generen jornada ni activitats escolars a Mes, Setmana o Dia. La informació diària mostra el nom del període.
- Els períodes es desen amb el curs i s’inclouen a les còpies JSON. Les còpies anteriors es carreguen amb la llista de vacances buida. Han de quedar dins del curs i no poden coincidir amb dies d’horari reduït.
- Es conserven els festius individuals, els altres períodes i les assignacions familiars.


## v0.9.1: amplada visible de les franges mensuals

- Les franges puntuals i les rotacions amb tutor mantenen el color fins als dos extrems de la columna del fill, com la pernocta. Es retiren els contorns laterals que les feien semblar més estretes.
- Es conserva la separació horitzontal entre franges i l’amplada reduïda de les rotacions sense tutor.


## v0.10.0: selecció múltiple de dies del curs

- Els botons «Tria dies» de festius i jornada reduïda obren un calendari mensual. Es poden marcar o desmarcar dies i navegar entre mesos sense perdre la selecció.
- Els dies ja desats apareixen seleccionats. «Desa els dies» confirma el conjunt complet d’una vegada; «Cancel·la» conserva les dades anteriors.
- Es bloquegen les dates fora del curs i les incompatibilitats amb l’altre tipus de jornada o les vacances. Es mantenen les vacances amb nom i l’horari reduït configurat.


## v0.10.1: selecció escolar només entre setmana

- Dissabtes i diumenges es mantenen visibles al selector mensual, però no es poden marcar com a festius o jornada reduïda.
- La validació del desament també rebutja caps de setmana. Si hi havia dates de cap de setmana desades, l’esborrany les exclou i només es retiren de les dades en confirmar «Desa els dies»; cancel·lar conserva les dades anteriors.


## v0.10.2: estabilitat del desplaçament mensual

- Els mesos carregats es conserven durant el desplaçament. No es retiren panells anteriors ni es reajusta scrollTop per navegar pels mesos ja visitats o afegir-ne al final. Una navegació explícita amb fletxes, Avui o canvi de vista recupera un interval inicial petit.
- Es prioritza l’esdeveniment nadiu scrollend per esperar el final de la inèrcia. En navegadors anteriors s’espera una pausa de 400 ms; en tots dos casos es comproven dues pintades estables i es cancel·la la càrrega si comença un altre gest.
- Afegir mesos anteriors conserva el mateix mes i posició visible. Sortir de la vista cancel·la temporitzadors i pintades pendents.


## v0.11.0: rotacions condicionades als dies d’escola

- Cada rotació addicional incorpora la casella «Només si el fill té escola», desactivada per defecte. Es confirma amb «Desa els canvis» i es conserva en les còpies JSON.
- Es comprova la presència escolar per fill i data independentment dels filtres de visualització: matrícula, curs, festius, vacances i horari propi. La jornada reduïda continua sent lectiva, també si encara no s’han configurat les hores; sense horaris detallats es consideren lectius els dies de dilluns a divendres de la matrícula.
- La condició no retalla ni mou les hores de la rotació. Es manté en les excepcions puntuals i es comparteix entre Mes, Setmana i Dia. Les rotacions i còpies anteriors conserven el comportament habitual.


## v0.12.0: pernoctes opcionals i múltiples, amb intervals propis

- La pernocta és un tipus de rotació dins del mateix editor que les altres franges. Es poden afegir zero, una o diverses pernoctes; cada una té nom, inici, final opcional, fills participants, patró i hores de canvi propis. Totes les targetes es poden plegar i s’ordenen per data d’inici.
- La data final és inclusiva. La validació de desament i importació impedeix dues pernoctes amb dates compartides per a un mateix fill, encara que algun dia del patró no tingui tutor. Es permeten períodes consecutius sense dia compartit i intervals simultanis per a fills diferents. Les altres franges poden continuar solapant-se.
- Les altres rotacions també incorporen final opcional i només s’apliquen entre l’inici i el final indicats. La durada del patró determina el cicle, independentment del període d’aplicació.
- El tutor i l’hora de canvi de cada dia es continuen editant conjuntament. Els calendaris resolen la pernocta aplicable a cada fill, amb la seva hora de canvi; l’última nit d’un període es conserva fins al canvi de l’endemà.
- Les dades passen al format 2: la pernocta única de les còpies anteriors es converteix automàticament en una rotació, conservant assignacions, hores del patró i excepcions. Les hores puntuals passen a ser per fill. Les còpies noves permeten no tenir cap pernocta i no en recreen una després d’eliminar-la.


## v0.12.1: vistes de dia i setmana més compactes

- Es retira el bloc introductori «El teu calendari / Calendari Familiar» i el seu subtítol de les vistes Dia i Setmana. La navegació superior continua indicant la data i la vista activa.


## v0.13.0: vista anual

- Nou selector «Any» al costat de Mes, Setmana i Dia. Mostra els dotze mesos de l’any, amb dues columnes en mòbil i tres en escriptori.
- Cada dia utilitza una miniatura de les mateixes pernoctes i franges que a Mes, respectant els filtres de fills, tutors i escoles. El dia actual queda ressaltat.
- Tocar un mes obre Mes a l’any i mes triats. Les fletxes avancen o retrocedeixen anys i «Avui» torna a l’any actual. Els canvis d’any reinicien el desplaçament; modificar filtres conserva la posició.
- El zoom horari continua sent propi de Dia i Setmana. La navegació anual tracta correctament el 29 de febrer.


## v0.13.1: pernoctes més clares a la vista anual

- Any utilitza una escala pròpia: cada hora entre les 22:00 i les 06:00 rep quatre vegades l’espai d’una hora diürna. Així, una jornada escolar de 09:00 a 17:00 ocupa aproximadament una sisena part de la miniatura.
- Es retiren els contorns de les franges a les miniatures anuals per deixar llegibles els colors de pernocta. La resta de vistes conserven la seva escala.


## v0.14.0: festius i vacances personals

- A Persones, cada fill i tutor disposa de «Festius i vacances». Els festius es marquen amb multiselecció mensual, incloent caps de setmana; les vacances s’afegeixen com a períodes amb nom, inici i final inclusius. Es poden editar i eliminar.
- «Soc jo» identifica una única persona i es pot retirar. La identitat es conserva en reobrir i es mostra als filtres personals.
- A Any i Mes, els dies consecutius de cada persona s’emmarquen amb un contorn vermell per als festius i verd per a les vacances. Els períodes contigus o superposats es fusionen visualment per persona, els contorns es tanquen als límits dels mesos i tots dos tipus es poden mostrar quan coincideixen.
- El filtre permet activar cada tipus de contorn i triar les persones que es visualitzen, independentment de les franges de pernocta i escola. El calendari d’una persona oculta no es torna a activar quan se n’editen les dades.
- Les dades i preferències personals s’inclouen a les còpies JSON; les còpies anteriors es carreguen sense calendaris personals. Eliminar una persona també neteja el seu calendari i la seva identificació.

## v0.14.1: calendaris personals només per a adults

Festius, vacances i «Soc jo» només apareixen als tutors i responsables. Els fills mantenen la seva configuració escolar; els calendaris personals i la identificació de fills de la versió anterior s'exclouen en carregar les dades i als filtres.

## v0.14.2: colors personals i contorns al perímetre

Cada tutor o responsable pot triar el color dels festius i el de les vacances dins de «Festius i vacances». Es conserven a les còpies de seguretat i apareixen als filtres i a la llegenda. Els contorns d’Any i Mes segueixen el perímetre de les cel·les, amb el mateix gruix de 4 px que el requadre del mes. Les vores coincidents alternen els colors sense requadres interiors.

## v0.15.0: horari laboral personal

L’àrea dels tutors i responsables passa a dir-se «Horari laboral». Cada selector de color és dins de la seva secció de festius o vacances i comparteix el format dels colors de persones.

S’hi poden afegir diverses rotacions de feina, ordenades per inici, amb nom, data d’inici, final opcional i un cicle d’1 a 12 setmanes. Cada dia admet diverses franges, incloses jornades partides i torns que passen de mitjanit. Les setmanes s’alineen amb el dilluns de la setmana inicial; les dates d’inici i final limiten els dies en què s’aplica el patró.

L’editor treballa amb un esborrany fins a «Desa els canvis», permet copiar les franges d’un dia de dilluns a divendres i valida que no se superposin dins del patró. Els festius i les vacances personals anul·len les hores de feina d’aquelles dates. L’agenda de Dia i Setmana mostra l’horari resultant, amb filtre per persona i per franges de feina. Les dades i preferències es conserven a les còpies de seguretat i fora de línia.

## v0.15.1: prioritat de festius i requadres niats

La marca es calcula per persona: un festiu es mostra sempre; les vacances només es mostren si aquell dia no és festiu i hi havia feina prevista al patró laboral original. El càlcul de feina prevista no aplica les absències ni els filtres de visualització. Els dies de descans o fora de la vigència de les rotacions separen els trams de vacances.

Quan coincideixen persones, els contorns són sòlids i niats: cada capa entra exactament un gruix de línia, de manera que les vores es toquen. Cada tram manté la seva capa i les cantonades contínues; amagar persones al filtre torna a aprofitar les capes exteriors disponibles. Any i Mes comparteixen aquestes regles.

## v0.15.2: contorns anuals més fins

Els contorns de festius i vacances d’Any passen a 1 px, incloses les cantonades i les capes niades. Mes conserva el gruix de 4 px.


## v0.15.3: vista anual més ampla i compacta

Els mesos queden alineats a dalt i aprofiten l’amplada sense el requadre exterior ni el seu marge interior. La llegenda anual s’obre des d’un botó petit d’informació al costat dels filtres. Es retiren el text d’ajuda anual i el peu informatiu de l’app.


## v0.15.4: mes i dia actuals a la vista anual

En obrir Any o prémer Avui, el calendari es desplaça fins al mes actual, que es distingeix amb un perímetre més gruixut. El dia actual ressalta tota la cel·la amb els mateixos colors de Mes, sense el cercle del número. Els filtres i diàlegs conserven el desplaçament manual, i els altres anys no ressalten cap mes com a actual.


## v0.15.5: sis setmanes visibles a Mes

Seleccionar un mes, navegar amb fletxes o prémer Avui alinea la graella sota la barra fixa i deixa amagat el títol repetit. L’alçada de les setmanes s’ajusta a l’espai visible, descomptant la navegació superior i inferior, perquè hi càpiguen sis setmanes completes. Les miniatures s’adapten a aquesta alçada, també amb franges nocturnes especials. En redimensionar la finestra es recalcula la mida mantenint la posició del mes.


## v0.15.6: vista mensual sense perímetre ressaltat

Es retira el contorn gruixut que resseguia els dies de cada mes. Es conserven les línies de la graella, els contorns personals de festius i vacances i el ressaltat del dia actual.


## v0.15.7: llegenda flotant a totes les vistes

Mes, Setmana i Dia deixen de mostrar la llegenda i els textos explicatius sota el calendari. Totes les vistes disposen del botó petit de llegenda al costat dels filtres, amb els colors visibles i la indicació de canvi puntual dins d’un diàleg.


## v0.16.0: desplaçament continu per anys

Any mostra anys consecutius i carrega els anteriors i posteriors en arribar als extrems. Els anys visitats es conserven al seu lloc; la càrrega espera el final del gest i de la inèrcia, compartint el mateix mecanisme que Mes. La barra indica l’any visible i la data de referència segueix el mes visible.

Els filtres i la llegenda conserven la posició. Avui recentra l’interval al voltant de l’any actual i enfoca el mes actual; les fletxes naveguen per anys i tocar qualsevol mes l’obre a Mes. Els límits del calendari són els anys 0100 a 9999.

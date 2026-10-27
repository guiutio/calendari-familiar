"use strict";
const $app = document.getElementById('app');
const DB_NAME = 'calendari-familiar-db';
const DB_STORE = 'data';
const DB_KEY = 'app-v1';
const MAX_ROTATION_DAYS = 3640; // 520 setmanes, per limitar el cost de visualitzar el patró
const weekdays = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];
const weekLong = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];
const months = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const icons = {
    school: '<path d="M3 22V8l9-5 9 5v14M2 22h20M7 12h2m6 0h2M7 16h2m6 0h2M10 22v-4h4v4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-2.85v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2-2 .06-.06A1.65 1.65 0 0 0 7.6 15a1.65 1.65 0 0 0-1.51-1H6v-2.85h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-2 .06.06A1.65 1.65 0 0 0 11.09 6a1.65 1.65 0 0 0 1-1.51V4h2.85v.49a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2 2-.06.06A1.65 1.65 0 0 0 19.4 10a1.65 1.65 0 0 0 1.51 1H21v3h-.09a1.65 1.65 0 0 0-1.51 1Z" transform="translate(-.5 -.5) scale(.94)"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>', chevronRight: '<path d="m9 18 6-6-6-6"/>',
    filter: '<path d="M4 7h16M7 12h10M10 17h4"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v6m4-6v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    pencil: '<path d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
    home: '<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>'
};
function icon(name, size = 19) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)); }
function localDate(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); }
function parseDate(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 12); }
function addDays(date, days) { const d = parseDate(date); d.setDate(d.getDate() + days); return localDate(d); }
function utcDay(date) { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1) / 86400000; }
function diffDays(a, b) { return utcDay(a) - utcDay(b); }
function monthTitle(year, month) { return `${months[month]} ${year}`; }
function fullDate(date) { const d = parseDate(date); const dayIndex = (d.getDay() + 6) % 7; return `${weekLong[dayIndex]}, ${d.getDate()} d’${months[d.getMonth()]} de ${d.getFullYear()}`; }
function initial(name) { return [...name.trim()][0]?.toUpperCase() || '?'; }
function newId() { return (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
const DEMO_START_DATE = '2026-10-12'; // Dilluns de la primera setmana
const LEGACY_DEMO_SEQUENCE = ['pare', 'pare', 'mare', 'mare', 'pare', 'pare', 'pare', 'mare', 'mare', 'pare', 'pare', 'mare', 'mare', 'mare'];
/** Cicle de 10 setmanes, amb excepcions incorporades dins del patró (no com a dates soltes). */
function demoSequence() {
    const weeklyGuardians = ['pare', 'mare', 'pare', 'mare', 'pare', 'pare', 'mare', 'pare', 'mare', 'pare'];
    return Array.from({ length: 70 }, (_, day) => {
        const week = Math.floor(day / 7); // 0 = setmana 1
        const weekday = day % 7; // 0 = dilluns, 6 = diumenge
        if ((week === 1 || week === 6) && weekday === 6)
            return 'pare'; // Diumenge setmanes 2 i 7
        if (week === 9 && weekday >= 5)
            return 'mare'; // Dissabte i diumenge setmana 10
        return weeklyGuardians[week];
    });
}
function seedState() {
    const sequence = demoSequence();
    return {
        version: 1,
        children: [{ id: 'elna', name: 'Elna', birthDate: '' }, { id: 'blai', name: 'Blai', birthDate: '' }],
        guardians: [{ id: 'pare', name: 'Pare', color: '#8bb8e8' }, { id: 'mare', name: 'Mare', color: '#efafc3' }],
        rotation: { startDate: DEMO_START_DATE, length: sequence.length, assignments: { elna: [...sequence], blai: [...sequence] } },
        overrides: {}, preferences: { visibleChildren: ['elna', 'blai'], visibleGuardians: ['pare', 'mare'], theme: 'auto' }, schools: []
    };
}
function validTheme(value) { return value === 'light' || value === 'dark' ? value : 'auto'; }
function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && localDate(parseDate(s)) === s; }
/** Validació i migració no destructiva: còpies anteriors a Escoles són vàlides. */
function cleanSchools(raw, children) {
    if (raw === undefined)
        return [];
    if (!Array.isArray(raw) || raw.length > 50)
        throw Error('La còpia conté escoles incorrectes');
    const childSet = new Set(children.map(c => c.id)), schoolIds = new Set();
    const isText = (x) => typeof x === 'string';
    const name = (x, max = 120) => typeof x === 'string' ? x.trim().slice(0, max) : '';
    const validTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    return raw.map((entry) => {
        const school = entry;
        if (!school || !isText(school.id) || schoolIds.has(school.id) || !name(school.name) || !Array.isArray(school.years) || school.years.length > 60)
            throw Error('Hi ha una escola invàlida a la còpia');
        schoolIds.add(school.id);
        const yearIds = new Set();
        const years = school.years.map(entryYear => {
            const year = entryYear;
            if (!year || !isText(year.id) || yearIds.has(year.id) || !isValidDate(year.startDate) || !isValidDate(year.endDate) || year.startDate >= year.endDate || !Array.isArray(year.groups) || year.groups.length > 80)
                throw Error('Un curs escolar no és vàlid');
            yearIds.add(year.id);
            const validateDays = (days) => {
                if (!Array.isArray(days) || days.length > 1000 || days.some(d => typeof d !== 'string' || !isValidDate(d) || d < year.startDate || d > year.endDate))
                    throw Error('Hi ha dies fora del curs escolar');
                return [...new Set(days)].sort();
            };
            const holidays = validateDays(year.holidays ?? []), reducedDays = validateDays(year.reducedDays ?? []);
            if (reducedDays.some(d => holidays.includes(d)))
                throw Error('Un dia no pot ser festiu i d’horari reduït alhora');
            const groupIds = new Set(), enrolled = new Set();
            const groups = year.groups.map(g => {
                if (!g || !isText(g.id) || groupIds.has(g.id) || !name(g.name) || !Array.isArray(g.childIds) || !Array.isArray(g.weeklySchedule) || g.childIds.length > 30 || g.weeklySchedule.length > 200)
                    throw Error('Un grup classe no és vàlid');
                groupIds.add(g.id);
                const childIds = g.childIds.filter(id => childSet.has(id));
                if (new Set(childIds).size !== childIds.length || childIds.some(id => enrolled.has(id)))
                    throw Error('Un fill no pot pertànyer a dos grups del mateix curs');
                childIds.forEach(id => enrolled.add(id));
                const sessionIds = new Set();
                const weeklySchedule = g.weeklySchedule.map(a => {
                    if (!a || !isText(a.id) || sessionIds.has(a.id) || !Number.isInteger(a.weekday) || a.weekday < 0 || a.weekday > 6 || !validTime(a.startTime) || !validTime(a.endTime) || a.startTime >= a.endTime)
                        throw Error('Hi ha un horari setmanal incorrecte');
                    sessionIds.add(a.id);
                    return { id: a.id, weekday: a.weekday, startTime: a.startTime, endTime: a.endTime, label: name(a.label, 80) };
                });
                return { id: g.id, name: name(g.name, 80), tutorName: name(g.tutorName, 100), weeklySchedule, childIds };
            });
            return { id: year.id, startDate: year.startDate, endDate: year.endDate, holidays, reducedDays, groups };
        });
        return { id: school.id, name: name(school.name, 100), address: name(school.address, 200), phone: name(school.phone, 50), years };
    });
}
function cleanState(raw) {
    if (!raw || typeof raw !== 'object')
        throw Error('Fitxer sense dades vàlides');
    const obj = raw;
    if (obj.version !== 1 || !Array.isArray(obj.children) || !Array.isArray(obj.guardians) || !obj.rotation || !obj.preferences || !obj.overrides)
        throw Error('Format de còpia no compatible');
    const children = obj.children.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.birthDate === 'string').map(c => ({ ...c, name: c.name.slice(0, 70), birthDate: isValidDate(c.birthDate) ? c.birthDate : '' }));
    const guardians = obj.guardians.filter(g => g && typeof g.id === 'string' && typeof g.name === 'string' && typeof g.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(g.color)).map(g => ({ ...g, name: g.name.slice(0, 70) }));
    if (!children.length || !guardians.length || children.length > 30 || guardians.length > 30 || new Set(children.map(x => x.id)).size !== children.length || new Set(guardians.map(x => x.id)).size !== guardians.length)
        throw Error('La còpia conté fills o tutors incorrectes');
    const validGuardians = new Set(guardians.map(x => x.id));
    const length = obj.rotation.length;
    if (!Number.isInteger(length) || length < 1 || length > MAX_ROTATION_DAYS || !isValidDate(obj.rotation.startDate))
        throw Error('El patró no és vàlid');
    const assignments = {};
    for (const child of children) {
        const seq = obj.rotation.assignments?.[child.id];
        if (!Array.isArray(seq) || seq.length !== length || seq.some(x => !validGuardians.has(x)))
            throw Error('El patró de nits està incomplet');
        assignments[child.id] = [...seq];
    }
    const overrides = {};
    for (const [key, value] of Object.entries(obj.overrides)) {
        const [date, childId] = key.split('|');
        if (date && childId && isValidDate(date) && children.some(c => c.id === childId) && validGuardians.has(value))
            overrides[key] = value;
    }
    return { version: 1, children, guardians, rotation: { startDate: obj.rotation.startDate, length, assignments }, overrides, preferences: { visibleChildren: children.filter(c => obj.preferences.visibleChildren?.includes(c.id)).map(c => c.id), visibleGuardians: guardians.filter(g => obj.preferences.visibleGuardians?.includes(g.id)).map(g => g.id), theme: validTheme(obj.preferences.theme) }, schools: cleanSchools(obj.schools, children) };
}
/** Actualitza només el patró de mostra v0.1 íntegre i sense editar; mai modifica dades personalitzades. */
function upgradeOriginalDemo(data) {
    const untouched = data.schools.length === 0
        && data.children.length === 2
        && data.children[0]?.id === 'elna' && data.children[0]?.name === 'Elna' && data.children[0]?.birthDate === '2015-10-08'
        && data.children[1]?.id === 'blai' && data.children[1]?.name === 'Blai' && data.children[1]?.birthDate === '2019-04-16'
        && data.guardians.length === 3
        && data.guardians[0]?.id === 'pare' && data.guardians[0]?.name === 'Pare' && data.guardians[0]?.color === '#8bb8e8'
        && data.guardians[1]?.id === 'mare' && data.guardians[1]?.name === 'Mare' && data.guardians[1]?.color === '#efafc3'
        && data.guardians[2]?.id === 'avia' && data.guardians[2]?.name === 'Àvia' && data.guardians[2]?.color === '#c9b4ef'
        && data.rotation.length === 14
        && ['elna', 'blai'].every(id => JSON.stringify(data.rotation.assignments[id]) === JSON.stringify(LEGACY_DEMO_SEQUENCE))
        && Object.keys(data.overrides).length === 0
        && JSON.stringify(data.preferences.visibleChildren) === JSON.stringify(['elna', 'blai'])
        && JSON.stringify(data.preferences.visibleGuardians) === JSON.stringify(['pare', 'mare', 'avia']);
    if (!untouched)
        return { data, changed: false };
    data.children.forEach(c => c.birthDate = '');
    data.guardians = data.guardians.filter(g => g.id !== 'avia');
    data.preferences.visibleGuardians = data.preferences.visibleGuardians.filter(id => id !== 'avia');
    return { data, changed: true };
}
/** Només substitueix les dades de demostració 14 dies sense modificar.
 * Si hi ha canvis d'usuari en noms, tutors, rotació, filtres o excepcions, es conserva tot. */
function upgradeUntouchedDemo(data) {
    const demoLike = data.schools.length === 0
        && data.children.length === 2
        && data.children[0]?.id === 'elna' && data.children[0]?.name === 'Elna' && data.children[0]?.birthDate === ''
        && data.children[1]?.id === 'blai' && data.children[1]?.name === 'Blai' && data.children[1]?.birthDate === ''
        && data.guardians.length === 2
        && data.guardians[0]?.id === 'pare' && data.guardians[0]?.name === 'Pare' && data.guardians[0]?.color === '#8bb8e8'
        && data.guardians[1]?.id === 'mare' && data.guardians[1]?.name === 'Mare' && data.guardians[1]?.color === '#efafc3'
        && data.rotation.length === LEGACY_DEMO_SEQUENCE.length
        && parseDate(data.rotation.startDate).getDay() === 1
        && ['elna', 'blai'].every(id => JSON.stringify(data.rotation.assignments[id]) === JSON.stringify(LEGACY_DEMO_SEQUENCE))
        && Object.keys(data.overrides).length === 0
        && JSON.stringify(data.preferences.visibleChildren) === JSON.stringify(['elna', 'blai'])
        && JSON.stringify(data.preferences.visibleGuardians) === JSON.stringify(['pare', 'mare']);
    if (!demoLike)
        return { data, changed: false };
    data.rotation = seedState().rotation; // Preferències de tema desades intactes
    return { data, changed: true };
}
function upgradeDemo(data) {
    const legacy = upgradeOriginalDemo(data);
    const current = upgradeUntouchedDemo(legacy.data);
    return { data: current.data, changed: legacy.changed || current.changed };
}
function resizedRotation(rotation, length) {
    const fallback = defaultGuardian();
    const assignments = {};
    for (const child of state.children) {
        const old = rotation.assignments[child.id] ?? [];
        assignments[child.id] = Array.from({ length }, (_, i) => old.length ? old[i % old.length] ?? fallback : fallback);
    }
    return { ...rotation, length, assignments };
}
let db = null;
let storageMode = 'session';
let state = seedState();
let viewYear = new Date().getFullYear(), viewMonth = new Date().getMonth();
let tab = 'calendar';
let schoolNav = {};
let sheet = null;
let rotationDraft = null;
let rotationUnit = 'weeks';
let toastTimer = null;
let writeQueue = Promise.resolve();
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
    const mode = validTheme(state.preferences.theme);
    const effective = mode === 'auto' ? (themeMedia.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'dark' ? '#101722' : '#f6f7f8');
    try {
        localStorage.setItem('calendari-familiar-theme', mode);
    }
    catch { /* Emmagatzematge opcional */ }
}
themeMedia.addEventListener?.('change', () => { if (state.preferences.theme === 'auto')
    applyTheme(); });
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => { const database = request.result; if (!database.objectStoreNames.contains(DB_STORE))
            database.createObjectStore(DB_STORE); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function idbGet() {
    return new Promise((resolve, reject) => {
        const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
function idbPut(data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(data, DB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
async function loadState() {
    try {
        db = await openDB();
        storageMode = 'indexeddb';
        const raw = await idbGet();
        if (raw) {
            const result = upgradeDemo(cleanState(raw));
            state = result.data;
            if (result.changed)
                await idbPut(state);
        }
        else
            await idbPut(state);
        return;
    }
    catch (e) {
        console.warn('IndexedDB no disponible; s’intenta emmagatzematge alternatiu.', e);
    }
    try {
        storageMode = 'localStorage';
        const raw = localStorage.getItem('calendari-familiar-v1');
        if (raw) {
            const result = upgradeDemo(cleanState(JSON.parse(raw)));
            state = result.data;
            if (result.changed)
                localStorage.setItem('calendari-familiar-v1', JSON.stringify(state));
        }
        else
            localStorage.setItem('calendari-familiar-v1', JSON.stringify(state));
    }
    catch (e) {
        console.error('No hi ha emmagatzematge persistent disponible', e);
        storageMode = 'session';
    }
}
function saveState() {
    const snapshot = JSON.parse(JSON.stringify(state));
    writeQueue = writeQueue.catch(() => { }).then(async () => {
        if (storageMode === 'indexeddb' && db)
            await idbPut(snapshot);
        else if (storageMode === 'localStorage')
            localStorage.setItem('calendari-familiar-v1', JSON.stringify(snapshot));
    }).catch(e => { console.error('No s’han desat els canvis', e); notify('No s’ha pogut desar. Exporta una còpia.'); });
}
function update() { applyTheme(); saveState(); render(); }
function guardian(id) { return state.guardians.find(g => g.id === id); }
function childById(id) { return state.children.find(c => c.id === id); }
function defaultGuardian() { return state.guardians[0]?.id ?? ''; }
function rotationAssignment(date, childId, rotation = state.rotation) {
    const arr = rotation.assignments[childId];
    if (!arr?.length)
        return defaultGuardian();
    const index = ((diffDays(date, rotation.startDate) % rotation.length) + rotation.length) % rotation.length;
    return arr[index] ?? defaultGuardian();
}
function assigned(date, childId) { return state.overrides[`${date}|${childId}`] ?? rotationAssignment(date, childId); }
function overridden(date, childId) { return Object.hasOwn(state.overrides, `${date}|${childId}`); }
function birthdays(date) { return state.children.filter(c => c.birthDate && c.birthDate.slice(5) === date.slice(5)); }
function birthdayAge(date, child) { return parseInt(date.slice(0, 4), 10) - parseInt(child.birthDate.slice(0, 4), 10); }
function groupAssignments(date) {
    const visible = state.children.filter(c => state.preferences.visibleChildren.includes(c.id));
    return state.guardians.filter(g => state.preferences.visibleGuardians.includes(g.id)).map(g => ({ guardian: g, children: visible.filter(c => assigned(date, c.id) === g.id) })).filter(g => g.children.length);
}
function navButton(target, label, name, kind) {
    return `<button type="button" class="${kind === 'side' ? 'nav-button' : 'mobile-tab'} ${tab === target ? 'active' : ''}" data-action="tab" data-tab="${target}" aria-current="${tab === target ? 'page' : 'false'}">${icon(name, 20)}<span>${label}</span></button>`;
}
function layout(content) {
    return `<div class="app-layout"><aside class="sidebar">
  <div class="brand"><span class="brand-mark">${icon('home', 22)}</span><span><div class="brand-name">Calendari<br>Familiar</div><div class="brand-caption">El teu espai familiar</div></span></div>
  <nav class="side-nav" aria-label="Navegació">${navButton('calendar', 'Calendari', 'calendar', 'side')}${navButton('rotation', 'Rotacions', 'repeat', 'side')}${navButton('schools', 'Escoles', 'school', 'side')}${navButton('settings', 'Configuració', 'settings', 'side')}</nav>
  <p class="side-foot">${icon('shield', 17)}<br><strong>Les dades són teves.</strong><br>Tot queda al teu dispositiu.</p>
  </aside><main class="main-area"><div class="content">${content}<div class="footer">Calendari Familiar · MVP web v0.1.5 · Privat per disseny</div></div></main>
  <nav class="mobile-tabs" aria-label="Navegació principal">${navButton('calendar', 'Calendari', 'calendar', 'mobile')}${navButton('rotation', 'Rotacions', 'repeat', 'mobile')}${navButton('schools', 'Escoles', 'school', 'mobile')}${navButton('settings', 'Ajustos', 'settings', 'mobile')}</nav></div>${sheet ? sheetMarkup() : ''}<div id="toast-region" aria-live="polite"></div>`;
}
function calendarPage() {
    const today = localDate(new Date());
    const visibleCh = state.preferences.visibleChildren.length;
    const visibleG = state.preferences.visibleGuardians.length;
    const filtered = visibleCh !== state.children.length || visibleG !== state.guardians.length;
    const monthStart = new Date(viewYear, viewMonth, 1, 12);
    const firstDay = (monthStart.getDay() + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const rows = Math.ceil((firstDay + daysInMonth) / 7);
    const starting = localDate(new Date(viewYear, viewMonth, 1 - firstDay, 12));
    const cells = Array.from({ length: rows * 7 }, (_, i) => {
        const date = addDays(starting, i), d = parseDate(date), other = d.getMonth() !== viewMonth, groups = groupAssignments(date);
        const bdays = birthdays(date).filter(c => state.preferences.visibleChildren.includes(c.id));
        const overrides = state.children.some(c => overridden(date, c.id));
        return `<button type="button" class="day-cell ${other ? 'other-month' : ''} ${date === today ? 'today' : ''}" data-action="open-day" data-date="${date}" aria-label="${escapeHtml(fullDate(date))}. ${groups.map(g => g.children.map(c => c.name).join(' i ') + ' amb ' + g.guardian.name).join('; ') || 'Sense assignacions visibles'}">
     <span class="day-top"><span class="day-number">${d.getDate()}</span>${overrides ? '<span class="change-dot" title="Excepció puntual"></span>' : ''}</span>
     ${groups.slice(0, 3).map(g => `<span class="assignment" style="background:${g.guardian.color}" title="${escapeHtml(g.children.map(c => c.name).join(', ') + ' · ' + g.guardian.name)}">${escapeHtml(g.children.map(c => initial(c.name)).join('+'))}</span>`).join('')}
     ${groups.length > 3 ? `<span class="birth-label">+${groups.length - 3}</span>` : ''}
     ${bdays.length ? `<span class="birth-label" title="${escapeHtml(bdays.map(c => `${c.name} fa ${birthdayAge(date, c)} anys`).join(', '))}">🎂 ${escapeHtml(bdays.map(c => initial(c.name)).join('+'))}</span>` : ''}
    </button>`;
    });
    return `<header class="page-heading"><div><div class="eyebrow">EL TEU CALENDARI</div><h1 class="page-title">Calendari Familiar</h1><p class="page-subtitle">Qui dorm amb qui, d’un cop d’ull.</p></div>
   <div class="heading-actions"><button class="filter-button" data-action="open-filters" aria-label="Filtrar fills i tutors">${icon('filter', 18)}<span class="filter-copy">Filtres</span>${filtered ? '<span class="filter-dot"></span>' : ''}</button></div></header>
   <section class="calendar-card" aria-label="Calendari mensual"><div class="calendar-toolbar"><div class="calendar-title">${monthTitle(viewYear, viewMonth)}</div><div class="calendar-nav"><button class="soft-btn" data-action="today">Avui</button><button class="btn-icon" data-action="prev-month" aria-label="Mes anterior">${icon('chevronLeft', 18)}</button><button class="btn-icon" data-action="next-month" aria-label="Mes següent">${icon('chevronRight', 18)}</button></div></div>
   <div class="weekdays">${weekdays.map(d => `<span>${d}</span>`).join('')}</div><div class="month-grid">${cells.join('')}</div>
   <footer class="calendar-bottom"><div class="legend">${state.guardians.filter(g => state.preferences.visibleGuardians.includes(g.id)).map(g => `<span class="legend-entry"><span class="legend-color" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>`).join('')}</div><span class="legend-note">● canvi puntual</span></footer></section>
   ${!visibleCh || !visibleG ? '<div class="tip-card">No hi ha assignacions visibles. Revisa els filtres per seleccionar algun fill i tutor.</div>' : `<div class="tip-card">${icon('info', 18)}<span><strong>Toca qualsevol dia</strong> per veure qui hi dorm i modificar una nit puntual. Les modificacions no alteren la rotació habitual.</span></div>`}`;
}
function rotationPage() {
    const r = rotationDraft ?? state.rotation;
    return `<header class="page-heading"><div><div class="eyebrow">ORGANITZACIÓ</div><h1 class="page-title">Rotacions</h1><p class="page-subtitle">Defineix el patró habitual de les nits.</p></div></header>
    <section class="card"><div class="panel-header"><h2 class="section-title">Configuració del patró</h2><span class="sample-tag">Repetició automàtica</span></div><p class="section-description">Tria el primer dia del patró i la seva durada. El patró es repeteix indefinidament cap endavant i cap enrere.</p>
    <div class="form-row"><div class="field"><label for="rotation-start">Data d’inici</label><input id="rotation-start" type="date" value="${r.startDate}" data-action="rotation-start" /></div>
    <div class="field"><label for="rotation-length">Durada de la rotació</label><div class="duration-row"><input id="rotation-length" type="number" min="1" max="${rotationUnit === 'weeks' ? MAX_ROTATION_DAYS / 7 : MAX_ROTATION_DAYS}" step="1" inputmode="numeric" value="${rotationUnit === 'weeks' ? Math.ceil(r.length / 7) : r.length}" data-action="rotation-length" aria-label="Nombre de dies o setmanes" /><select id="rotation-unit" data-action="rotation-unit" aria-label="Unitat de la rotació"><option value="days" ${rotationUnit === 'days' ? 'selected' : ''}>dies</option><option value="weeks" ${rotationUnit === 'weeks' ? 'selected' : ''}>setmanes</option></select></div></div></div>
    <p class="duration-help">${r.length} ${r.length === 1 ? 'dia' : 'dies'} de rotació · ${Math.ceil(r.length / 7)} ${Math.ceil(r.length / 7) === 1 ? 'setmana' : 'setmanes'} ${r.length % 7 === 0 ? '' : '(l’última incompleta)'}. Les nits afegides hereten el patró actual fins que les canviïs.</p>
    <hr><div class="panel-header"><h2 class="section-title">Assignació per fill</h2><button class="secondary-btn" data-action="rotation-same">${icon('copy', 14)} Tots igual</button></div><p class="section-description">Toca cada casella per triar el tutor d’aquella nit. La lletra i el color corresponen al tutor.</p>
    ${state.children.map((c, cIndex) => `<div class="rotation-child"><div class="rotation-child-header"><strong>${escapeHtml(c.name)}</strong>${cIndex > 0 ? `<button class="soft-btn" data-action="rotation-copy" data-child="${escapeHtml(c.id)}" data-from="${escapeHtml(state.children[0].id)}">Copiar de ${escapeHtml(state.children[0].name)}</button>` : ''}</div>
    ${Array.from({ length: Math.ceil(r.length / 7) }, (_, week) => `<div class="rotation-week"><div class="rotation-week-header"><div class="rotation-week-title">Setmana ${week + 1}</div><button class="week-fill-btn" data-action="rotation-week-fill" data-child="${escapeHtml(c.id)}" data-week="${week}" aria-label="Assigna tota la setmana ${week + 1} de ${escapeHtml(c.name)}">Assigna setmana</button></div><div class="rotation-days">${Array.from({ length: Math.min(7, r.length - week * 7) }, (_, day) => {
        const i = week * 7 + day, g = guardian(r.assignments[c.id]?.[i] ?? '');
        return `<button class="rotation-cell" data-action="rotation-cell" data-child="${escapeHtml(c.id)}" data-index="${i}" aria-label="${escapeHtml(c.name)}, dia ${i + 1}, ${escapeHtml(g?.name ?? 'sense tutor')}"><span class="small-day">${weekdays[(parseDate(addDays(r.startDate, i)).getDay() + 6) % 7]}</span><span class="guardian-initial" style="background:${g?.color ?? '#edf0f4'}">${escapeHtml(initial(g?.name ?? '?'))}</span></button>`;
    }).join('')}</div></div>`).join('')}</div>`).join('')}
    <div class="action-row"><button class="primary-btn" data-action="rotation-save">Desa el patró</button>${rotationDraft ? '<button class="soft-btn" data-action="rotation-cancel">Descarta canvis</button>' : ''}</div>
    <p class="settings-note">Les excepcions de dies concrets tenen prioritat sobre el patró. Si canvies el patró, les excepcions continuaran guardades.</p></section>`;
}
function schoolById(id) { return state.schools.find(s => s.id === id); }
function yearById(school, id) { return school?.years.find(y => y.id === id); }
function groupById(year, id) { return year?.groups.find(g => g.id === id); }
function schoolYearName(y) { return `Curs ${y.startDate.slice(0, 4)}-${y.endDate.slice(0, 4)}`; }
function shortDate(date) { const d = parseDate(date); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; }
function schoolNavButton(label, nav, style = 'school-link') {
    return `<button type="button" class="${style}" data-action="school-nav" ${nav.schoolId ? `data-school="${escapeHtml(nav.schoolId)}"` : ''} ${nav.yearId ? `data-year="${escapeHtml(nav.yearId)}"` : ''} ${nav.groupId ? `data-group="${escapeHtml(nav.groupId)}"` : ''}>${escapeHtml(label)} ${icon('chevronRight', 15)}</button>`;
}
function schoolCrumb(text, nav = {}) {
    return `<button class="school-breadcrumb" type="button" data-action="school-nav" ${nav.schoolId ? `data-school="${escapeHtml(nav.schoolId)}"` : ''} ${nav.yearId ? `data-year="${escapeHtml(nav.yearId)}"` : ''}>${icon('chevronLeft', 15)} ${escapeHtml(text)}</button>`;
}
function schoolsPage() {
    const school = schoolById(schoolNav.schoolId), year = yearById(school, schoolNav.yearId), group = groupById(year, schoolNav.groupId);
    if (!school)
        return `<header class="page-heading"><div><div class="eyebrow">VIDA ESCOLAR</div><h1 class="page-title">Escoles</h1><p class="page-subtitle">Escoles, cursos i grups dels fills.</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Les escoles</h2><button class="secondary-btn" data-action="school-add">${icon('plus', 15)} Afegir escola</button></div>
 <p class="section-description">Cada escola pot tenir diferents cursos, grups classe, festius i dies d’horari reduït. Les dades són privades i es desen al teu dispositiu.</p>
 ${state.schools.length ? state.schools.map(s => `<div class="school-row">${schoolNavButton(s.name, { schoolId: s.id })}<span class="school-meta">${s.years.length} ${s.years.length === 1 ? 'curs' : 'cursos'}</span></div>`).join('') : '<div class="empty-state">Encara no has afegit cap escola. Afegeix-ne una per començar.</div>'}</section>`;
    if (!year)
        return `<header class="page-heading"><div>${schoolCrumb('Escoles')}<div class="eyebrow">ESCOLA</div><h1 class="page-title">${escapeHtml(school.name)}</h1><p class="page-subtitle">${escapeHtml(school.address || 'Adreça no indicada')}${school.phone ? ` · ${escapeHtml(school.phone)}` : ''}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Dades de l’escola</h2><button class="secondary-btn" data-action="school-edit" data-school="${escapeHtml(school.id)}">${icon('pencil', 15)} Edita</button></div>
 <div class="school-details">${school.address ? `<p><strong>Adreça:</strong> ${escapeHtml(school.address)}</p>` : ''}${school.phone ? `<p><strong>Telèfon:</strong> <a href="tel:${escapeHtml(school.phone.replace(/[^+\d]/g, ''))}">${escapeHtml(school.phone)}</a></p>` : ''}${!school.address && !school.phone ? '<p class="settings-note">Sense adreça ni telèfon.</p>' : ''}</div>
 <div class="action-row"><button class="danger-btn" data-action="school-delete" data-school="${escapeHtml(school.id)}">Suprimeix l’escola</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Cursos escolars</h2><button class="secondary-btn" data-action="year-add" data-school="${escapeHtml(school.id)}">${icon('plus', 15)} Afegir curs</button></div>
 ${school.years.length ? [...school.years].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(y => `<div class="school-row">${schoolNavButton(schoolYearName(y), { schoolId: school.id, yearId: y.id })}<span class="school-meta">${shortDate(y.startDate)} – ${shortDate(y.endDate)}</span></div>`).join('') : '<div class="empty-state">Afegeix un curs escolar indicant les dates d’inici i final.</div>'}</section>`;
    if (!group)
        return `<header class="page-heading"><div>${schoolCrumb(school.name, { schoolId: school.id })}<div class="eyebrow">${escapeHtml(school.name)}</div><h1 class="page-title">${schoolYearName(year)}</h1><p class="page-subtitle">Del ${shortDate(year.startDate)} al ${shortDate(year.endDate)}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Calendari escolar</h2><button class="soft-btn" data-action="year-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil', 14)} Dates</button></div>
 <p class="section-description">Els festius i els dies d’horari reduït han d’estar compresos dins del curs. Són dies concrets, no es repeteixen automàticament.</p>
 <div class="school-period"><div class="panel-header"><strong>Dies festius (${year.holidays.length})</strong><button class="secondary-btn" data-action="school-day-add" data-kind="holiday" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus', 14)} Dia</button></div>
 ${year.holidays.length ? `<div class="school-day-list">${year.holidays.map(d => `<span class="school-day-pill">${shortDate(d)} <button type="button" data-action="school-day-delete" data-kind="holiday" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-date="${d}" aria-label="Suprimeix el festiu ${d}">${icon('close', 13)}</button></span>`).join('')}</div>` : '<p class="settings-note">No hi ha dies festius.</p>'}</div>
 <div class="school-period"><div class="panel-header"><strong>Horari reduït (${year.reducedDays.length})</strong><button class="secondary-btn" data-action="school-day-add" data-kind="reduced" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus', 14)} Dia</button></div>
 ${year.reducedDays.length ? `<div class="school-day-list">${year.reducedDays.map(d => `<span class="school-day-pill reduced">${shortDate(d)} <button type="button" data-action="school-day-delete" data-kind="reduced" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-date="${d}" aria-label="Suprimeix l’horari reduït ${d}">${icon('close', 13)}</button></span>`).join('')}</div>` : '<p class="settings-note">No hi ha dies d’horari reduït.</p>'}</div>
 <div class="action-row"><button class="danger-btn" data-action="year-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">Suprimeix el curs</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Grups classe</h2><button class="secondary-btn" data-action="group-add" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus', 14)} Afegir grup</button></div>
 ${year.groups.length ? year.groups.map(g => `<div class="school-row">${schoolNavButton(g.name, { schoolId: school.id, yearId: year.id, groupId: g.id })}<span class="school-meta">${g.childIds.length} ${g.childIds.length === 1 ? 'fill' : 'fills'}${g.tutorName ? ` · ${escapeHtml(g.tutorName)}` : ''}</span></div>`).join('') : '<div class="empty-state">Encara no hi ha cap grup. Pots afegir-hi «Segon», «Sisè A» o qualsevol altre.</div>'}</section>`;
    const sessions = [...group.weeklySchedule].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    return `<header class="page-heading"><div>${schoolCrumb(schoolYearName(year), { schoolId: school.id, yearId: year.id })}<div class="eyebrow">${escapeHtml(school.name)} · ${schoolYearName(year)}</div><h1 class="page-title">${escapeHtml(group.name)}</h1><p class="page-subtitle">${group.tutorName ? `Tutor/a: ${escapeHtml(group.tutorName)}` : 'Tutor/a no especificat'}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Grup classe</h2><button class="secondary-btn" data-action="group-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">${icon('pencil', 15)} Edita</button></div>
 <div class="action-row"><button class="danger-btn" data-action="group-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">Suprimeix el grup</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Fills del grup</h2></div><p class="section-description">Selecciona els fills que pertanyen a aquest grup aquest curs. Un fill només pot estar en un grup del mateix curs i escola.</p>
 ${state.children.map(c => { const selected = group.childIds.includes(c.id), other = year.groups.find(g => g.id !== group.id && g.childIds.includes(c.id)); return `<button class="school-child-choice ${selected ? 'selected' : ''}" data-action="school-child-toggle" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}" data-child="${escapeHtml(c.id)}" aria-pressed="${selected}"><span>${escapeHtml(c.name)}${other ? `<small>Actualment a ${escapeHtml(other.name)}</small>` : ''}</span>${selected ? icon('check', 18) : icon('plus', 17)}</button>`; }).join('')}
 </section><section class="card"><div class="panel-header"><h2 class="section-title">Horari setmanal</h2><button class="secondary-btn" data-action="schedule-add" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">${icon('plus', 14)} Franja</button></div>
 <p class="section-description">Opcional. Pots afegir més d’una franja per dia (per exemple, matí i tarda).</p>
 ${sessions.length ? sessions.map(a => `<div class="school-schedule-row"><div><strong>${weekLong[a.weekday]}</strong> · ${a.startTime}–${a.endTime}${a.label ? `<span class="school-meta">${escapeHtml(a.label)}</span>` : ''}</div><button class="delete-icon" aria-label="Suprimeix franja" data-action="schedule-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}" data-session="${escapeHtml(a.id)}">${icon('trash', 15)}</button></div>`).join('') : '<div class="empty-state">Encara no s’ha introduït cap franja horària.</div>'}</section>`;
}
function schoolFormMarkup() {
    if (!sheet)
        return '';
    const heading = (title, subtitle) => `<div class="sheet-heading"><div><h2 class="sheet-title">${escapeHtml(title)}</h2><p class="sheet-subtitle">${escapeHtml(subtitle)}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>`;
    const field = (label, name, type, value, required = false, maxLength = 0) => `<div class="field"><label for="school-field-${name}">${escapeHtml(label)}</label><input id="school-field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${maxLength ? `maxlength="${maxLength}"` : ''} /></div>`;
    const actions = '<div class="action-row"><button class="primary-btn" type="submit">Desa</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button></div>';
    if (sheet.type === 'schoolForm') {
        const school = schoolById(sheet.schoolId);
        return heading(school ? 'Edita escola' : 'Afegeix escola', 'Nom obligatori; adreça i telèfon opcionals') + `<form data-school-form="school" data-school="${escapeHtml(school?.id ?? '')}"><div class="school-form-fields">${field('Nom de l’escola', 'name', 'text', school?.name ?? '', true, 100)}${field('Adreça (opcional)', 'address', 'text', school?.address ?? '', false, 200)}${field('Telèfon (opcional)', 'phone', 'tel', school?.phone ?? '', false, 50)}</div>${actions}</form>`;
    }
    if (sheet.type === 'yearForm') {
        const school = schoolById(sheet.schoolId), year = yearById(school, sheet.yearId);
        const now = new Date(), startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
        return heading(year ? 'Edita curs escolar' : 'Afegeix curs escolar', 'El nom es genera automàticament a partir dels anys de les dates') + `<form data-school-form="year" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(year?.id ?? '')}"><div class="school-form-fields">${field('Data d’inici', 'startDate', 'date', year?.startDate ?? `${startYear}-09-01`, true)}${field('Data de finalització', 'endDate', 'date', year?.endDate ?? `${startYear + 1}-06-30`, true)}</div><p class="settings-note">Format del nom: «Curs any inici-any final». Els dies festius i d’horari reduït han de quedar dins d’aquest interval.</p>${actions}</form>`;
    }
    if (sheet.type === 'groupForm') {
        const school = schoolById(sheet.schoolId), year = yearById(school, sheet.yearId), group = groupById(year, sheet.groupId);
        return heading(group ? 'Edita grup classe' : 'Afegeix grup classe', 'Exemples: Segon, Sisè A') + `<form data-school-form="group" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}" data-group="${escapeHtml(group?.id ?? '')}"><div class="school-form-fields">${field('Nom del grup', 'name', 'text', group?.name ?? '', true, 80)}${field('Nom del tutor/a (opcional)', 'tutorName', 'text', group?.tutorName ?? '', false, 100)}</div>${actions}</form>`;
    }
    if (sheet.type === 'schoolDayForm') {
        const school = schoolById(sheet.schoolId), year = yearById(school, sheet.yearId);
        if (!year)
            return '';
        return heading(sheet.kind === 'holiday' ? 'Afegeix dia festiu' : 'Afegeix dia d’horari reduït', `${schoolYearName(year)} · ${shortDate(year.startDate)} – ${shortDate(year.endDate)}`) + `<form data-school-form="day" data-kind="${sheet.kind}" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}"><div class="school-form-fields"><div class="field"><label for="school-date">Data</label><input id="school-date" name="date" type="date" min="${year.startDate}" max="${year.endDate}" value="${year.startDate}" required /></div></div>${actions}</form>`;
    }
    if (sheet.type === 'scheduleForm') {
        const school = schoolById(sheet.schoolId), year = yearById(school, sheet.yearId), group = groupById(year, sheet.groupId);
        return heading('Afegeix franja horària', group?.name ?? 'Grup classe') + `<form data-school-form="schedule" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}" data-group="${escapeHtml(sheet.groupId)}"><div class="school-form-fields"><div class="field"><label for="session-weekday">Dia de la setmana</label><select name="weekday" id="session-weekday">${weekLong.map((label, i) => `<option value="${i}">${label}</option>`).join('')}</select></div><div class="form-row">${field('Inici', 'startTime', 'time', '09:00', true)}${field('Final', 'endTime', 'time', '13:00', true)}</div>${field('Descripció (opcional)', 'label', 'text', '', false, 80)}</div>${actions}</form>`;
    }
    return '';
}
/** Festius/reducció de tots els centres en què un fill està matriculat aquell dia. */
function schoolInfoForDay(date) {
    const lines = [];
    for (const school of state.schools)
        for (const year of school.years) {
            if (date < year.startDate || date > year.endDate)
                continue;
            const dayKind = year.holidays.includes(date) ? 'Festiu escolar' : year.reducedDays.includes(date) ? 'Horari reduït' : '';
            if (!dayKind)
                continue;
            const enrolled = year.groups.flatMap(g => g.childIds).filter((id, i, ids) => ids.indexOf(id) === i).map(id => childById(id)?.name).filter((name) => Boolean(name));
            if (enrolled.length)
                lines.push(`<div class="school-day-notice"><strong>${escapeHtml(dayKind)}</strong> · ${escapeHtml(school.name)} (${escapeHtml(enrolled.join(', '))})</div>`);
        }
    return lines.length ? `<div class="sheet-section-label">Informació escolar</div>${lines.join('')}` : '';
}
function settingsPage() {
    const storageDescription = storageMode === 'indexeddb' ? 'IndexedDB · desat automàtic' : storageMode === 'localStorage' ? 'LocalStorage · mode alternatiu' : 'Sense persistència garantida';
    return `<header class="page-heading"><div><div class="eyebrow">PREFERÈNCIES</div><h1 class="page-title">Configuració</h1><p class="page-subtitle">Personalitza el teu calendari familiar.</p></div></header>
  <section class="card appearance-card"><h2 class="section-title">Aparença</h2><p class="section-description">Tria el tema de l'aplicació. Automàtic segueix l'aparença de l'iPhone.</p>
  <div class="theme-options" role="group" aria-label="Mode d’aparença">${[['auto', 'Automàtic', 'monitor'], ['light', 'Clar', 'sun'], ['dark', 'Fosc', 'moon']].map(([mode, label, glyph]) => `<button type="button" class="theme-choice ${validTheme(state.preferences.theme) === mode ? 'is-selected' : ''}" data-action="set-theme" data-theme-mode="${mode}" aria-pressed="${validTheme(state.preferences.theme) === mode}">${icon(glyph, 19)}<span>${label}</span></button>`).join('')}</div></section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Fills</h2><button class="secondary-btn" data-action="add-child">${icon('plus', 14)} Afegir</button></div><p class="section-description">La data de naixement és opcional. Si l’afegeixes, els aniversaris apareixeran al calendari.</p>
  ${state.children.map(c => `<div class="settings-item"><div class="field"><label for="child-name-${escapeHtml(c.id)}">Nom</label><input id="child-name-${escapeHtml(c.id)}" type="text" maxlength="70" value="${escapeHtml(c.name)}" data-action="child-name" data-child="${escapeHtml(c.id)}" /></div><div class="field"><label for="child-birth-${escapeHtml(c.id)}">Naixement</label><input id="child-birth-${escapeHtml(c.id)}" type="date" value="${escapeHtml(c.birthDate)}" data-action="child-birth" data-child="${escapeHtml(c.id)}" /></div><button class="delete-icon" data-action="delete-child" data-child="${escapeHtml(c.id)}" aria-label="Suprimeix ${escapeHtml(c.name)}" ${state.children.length === 1 ? 'disabled' : ''}>${icon('trash', 16)}</button></div>`).join('')}</section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Tutors i responsables</h2><button class="secondary-btn" data-action="add-guardian">${icon('plus', 14)} Afegir</button></div><p class="section-description">Tria un color diferent per identificar cada tutor d’un cop d’ull.</p>
  ${state.guardians.map(g => `<div class="settings-item guardian"><input class="color-input" type="color" value="${g.color}" data-action="guardian-color" data-guardian="${escapeHtml(g.id)}" aria-label="Color de ${escapeHtml(g.name)}" /><div class="field"><label for="guardian-name-${escapeHtml(g.id)}">Nom</label><input id="guardian-name-${escapeHtml(g.id)}" type="text" maxlength="70" value="${escapeHtml(g.name)}" data-action="guardian-name" data-guardian="${escapeHtml(g.id)}" /></div><button class="delete-icon" data-action="delete-guardian" data-guardian="${escapeHtml(g.id)}" aria-label="Suprimeix ${escapeHtml(g.name)}" ${state.guardians.length === 1 ? 'disabled' : ''}>${icon('trash', 16)}</button></div>`).join('')}</section>
  <section class="card"><h2 class="section-title">Les teves dades</h2><p class="section-description">Les dades es queden en aquest navegador. Exporta una còpia si canvies de dispositiu o abans de netejar-ne les dades.</p>
  <div class="status-good">${icon('shield', 17)} ${escapeHtml(storageDescription)}</div><div class="action-row"><button class="primary-btn" data-action="export">${icon('download', 15)} Exporta JSON</button><button class="secondary-btn" data-action="import">${icon('upload', 15)} Importa JSON</button><input class="sr-only" id="import-file" type="file" accept=".json,application/json" /></div><hr>
  <div class="panel-header"><h2 class="section-title">Dades d’exemple</h2><span class="sample-tag">Elna i Blai</span></div><p class="settings-note">Restableix les dades fictícies de demostració. Es perdran els canvis actuals, així que exporta una còpia abans si et cal.</p>
  <div class="action-row"><button class="danger-btn" data-action="reset">Restableix les dades d’exemple</button></div></section>`;
}
function sheetMarkup() {
    let contents = '';
    if (sheet?.type === 'filters') {
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Filtres</h2><p class="sheet-subtitle">Decideix qui vols veure al calendari</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    <div class="sheet-section-label">Fills</div>${state.children.map(c => filterOption(c.id, c.name, state.preferences.visibleChildren.includes(c.id), 'child')).join('')}
    <div class="sheet-section-label">Tutors</div>${state.guardians.map(g => filterOption(g.id, g.name, state.preferences.visibleGuardians.includes(g.id), 'guardian', g.color)).join('')}
    <div class="action-row"><button class="secondary-btn" data-action="filter-all">Mostra-ho tot</button><button class="primary-btn" data-action="close-sheet">Fet</button></div>`;
    }
    else if (sheet?.type === 'day') {
        const date = sheet.date;
        const bdays = birthdays(date);
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">${parseDate(date).getDate()} de ${months[parseDate(date).getMonth()]}</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    ${bdays.length ? `<div class="tip-card" style="margin:0 0 14px;padding:12px">🎂 ${escapeHtml(bdays.map(c => `${c.name} fa ${birthdayAge(date, c)} anys`).join(' · '))}</div>` : ''}
    <div class="sheet-section-label">Amb qui dorm cada fill?</div>${state.children.map(c => {
            const current = assigned(date, c.id), isOverride = overridden(date, c.id);
            return `<div class="day-member"><div class="member-head"><span class="member-name">${escapeHtml(c.name)}</span><span class="member-source">${isOverride ? '● Canvi puntual' : 'Segons la rotació'}</span></div><div class="guardian-choices">${state.guardians.map(g => `<button class="guardian-choice ${g.id === current ? 'is-selected' : ''}" data-action="assign-night" data-date="${date}" data-child="${escapeHtml(c.id)}" data-guardian="${escapeHtml(g.id)}" aria-pressed="${g.id === current}"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</button>`).join('')}</div>${isOverride ? `<div class="action-row" style="margin-top:10px"><button class="soft-btn" data-action="clear-night" data-date="${date}" data-child="${escapeHtml(c.id)}">Torna al patró habitual</button></div>` : ''}</div>`;
        }).join('')}${schoolInfoForDay(date)}<p class="settings-note">Una modificació aquí només canvia la nit seleccionada. Pots tocar un altre tutor per canviar-la.</p>`;
    }
    else if (sheet && ['schoolForm', 'yearForm', 'groupForm', 'schoolDayForm', 'scheduleForm'].includes(sheet.type)) {
        contents = schoolFormMarkup();
    }
    else if (sheet?.type === 'rotationWeek') {
        const { childId, week } = sheet, c = childById(childId), r = rotationDraft ?? state.rotation;
        const begin = week * 7, end = Math.min(r.length, begin + 7);
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Assigna una setmana</h2><p class="sheet-subtitle">${escapeHtml(c?.name ?? 'Fill')} · Setmana ${week + 1} · Dies ${begin + 1}–${end}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    <p class="settings-note">Assigna totes les nits d’aquesta setmana a un mateix tutor. Després podràs ajustar nits concretes.</p>
    ${state.guardians.map(g => `<button class="option" data-action="rotation-set-week" data-child="${escapeHtml(childId)}" data-week="${week}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span></button>`).join('')}`;
    }
    else if (sheet?.type === 'rotationCell') {
        const { childId, index } = sheet, c = childById(childId), r = rotationDraft ?? state.rotation;
        const current = r.assignments[childId]?.[index], date = addDays(r.startDate, index);
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Tria un tutor</h2><p class="sheet-subtitle">${escapeHtml(c?.name ?? 'Fill')} · Dia ${index + 1} · ${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    ${state.guardians.map(g => `<button class="option ${g.id === current ? 'selected' : ''}" data-action="rotation-set-cell" data-child="${escapeHtml(childId)}" data-index="${index}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>${g.id === current ? icon('check', 17) : ''}</button>`).join('')}`;
    }
    return `<div class="overlay" data-action="close-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${sheet?.type === 'filters' ? 'Filtres' : 'Detall del calendari'}"><div class="sheet-handle"></div>${contents}</section></div>`;
}
function filterOption(id, name, selected, kind, color) { return `<button class="option ${selected ? 'selected' : ''}" aria-pressed="${selected}" data-action="toggle-filter" data-filter-kind="${kind}" data-id="${escapeHtml(id)}"><span class="option-left">${color ? `<span class="color-dot" style="background:${color}"></span>` : icon('home', 16)}${escapeHtml(name)}</span>${selected ? icon('check', 17) : '<span class="badge-soft">Ocult</span>'}</button>`; }
function render() {
    $app.innerHTML = layout(tab === 'calendar' ? calendarPage() : tab === 'rotation' ? rotationPage() : tab === 'schools' ? schoolsPage() : settingsPage());
    document.body.style.overflow = sheet ? 'hidden' : '';
}
function notify(message) {
    const host = document.getElementById('toast-region') ?? $app;
    host.innerHTML = `<div class="toast" role="status">${escapeHtml(message)}</div>`;
    if (toastTimer !== null)
        window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { const target = document.getElementById('toast-region'); if (target)
        target.innerHTML = ''; }, 2900);
}
function goToMonth(delta) { const d = new Date(viewYear, viewMonth + delta, 1, 12); viewYear = d.getFullYear(); viewMonth = d.getMonth(); render(); }
function changeTab(value) { tab = value; sheet = null; if (tab === 'rotation') {
    rotationDraft = JSON.parse(JSON.stringify(state.rotation));
    rotationUnit = state.rotation.length % 7 === 0 ? 'weeks' : 'days';
} render(); window.scrollTo({ top: 0, behavior: 'instant' }); }
function chooseGuardian(date, childId, guardianId) {
    if (guardianId === rotationAssignment(date, childId))
        delete state.overrides[`${date}|${childId}`];
    else
        state.overrides[`${date}|${childId}`] = guardianId;
    update();
    notify('Nit actualitzada');
}
function removeGuardian(id) {
    if (state.guardians.length < 2)
        return;
    const g = guardian(id);
    if (!g || !confirm(`Vols suprimir «${g.name}»? Les seves nits passaran al primer tutor disponible.`))
        return;
    state.guardians = state.guardians.filter(x => x.id !== id);
    const alternate = defaultGuardian();
    Object.values(state.rotation.assignments).forEach(arr => arr.forEach((v, i) => { if (v === id)
        arr[i] = alternate; }));
    Object.keys(state.overrides).forEach(key => { if (state.overrides[key] === id)
        state.overrides[key] = alternate; });
    state.preferences.visibleGuardians = state.preferences.visibleGuardians.filter(x => x !== id);
    rotationDraft = null;
    update();
}
function removeChild(id) {
    if (state.children.length < 2)
        return;
    const c = childById(id);
    if (!c || !confirm(`Vols suprimir «${c.name}» i totes les seves assignacions?`))
        return;
    state.children = state.children.filter(x => x.id !== id);
    delete state.rotation.assignments[id];
    state.schools.forEach(s => s.years.forEach(y => y.groups.forEach(g => g.childIds = g.childIds.filter(x => x !== id))));
    Object.keys(state.overrides).forEach(key => { if (key.endsWith(`|${id}`))
        delete state.overrides[key]; });
    state.preferences.visibleChildren = state.preferences.visibleChildren.filter(x => x !== id);
    rotationDraft = null;
    update();
}
async function exportData() {
    await writeQueue;
    const text = JSON.stringify(state, null, 2);
    const blob = new Blob([text], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendari-familiar-${localDate(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Còpia JSON preparada');
}
async function importData(file) {
    if (file.size > 5_000_000) {
        notify('El fitxer és massa gran');
        return;
    }
    try {
        const text = await file.text();
        const imported = cleanState(JSON.parse(text));
        if (!confirm('Vols substituir totes les dades actuals per les del fitxer?'))
            return;
        state = imported;
        rotationDraft = null;
        sheet = null;
        schoolNav = {};
        update();
        notify('Dades importades correctament');
    }
    catch (err) {
        notify(err instanceof Error ? err.message : 'No es pot importar aquest fitxer');
    }
}
async function resetData() { if (!confirm('Vols restablir les dades de mostra? S’esborraran els canvis actuals.'))
    return; const theme = state.preferences.theme; state = seedState(); state.preferences.theme = theme; rotationDraft = null; sheet = null; schoolNav = {}; update(); notify('Dades de mostra restablertes'); }
function clickAction(button) {
    const action = button.dataset.action;
    switch (action) {
        case 'school-nav':
            schoolNav = { schoolId: button.dataset.school || undefined, yearId: button.dataset.year || undefined, groupId: button.dataset.group || undefined };
            render();
            window.scrollTo({ top: 0, behavior: 'instant' });
            break;
        case 'school-add':
            sheet = { type: 'schoolForm' };
            render();
            break;
        case 'school-edit':
            sheet = { type: 'schoolForm', schoolId: button.dataset.school };
            render();
            break;
        case 'year-add':
            sheet = { type: 'yearForm', schoolId: button.dataset.school };
            render();
            break;
        case 'year-edit':
            sheet = { type: 'yearForm', schoolId: button.dataset.school, yearId: button.dataset.year };
            render();
            break;
        case 'group-add':
            sheet = { type: 'groupForm', schoolId: button.dataset.school, yearId: button.dataset.year };
            render();
            break;
        case 'group-edit':
            sheet = { type: 'groupForm', schoolId: button.dataset.school, yearId: button.dataset.year, groupId: button.dataset.group };
            render();
            break;
        case 'school-day-add':
            sheet = { type: 'schoolDayForm', schoolId: button.dataset.school, yearId: button.dataset.year, kind: button.dataset.kind === 'holiday' ? 'holiday' : 'reduced' };
            render();
            break;
        case 'schedule-add':
            sheet = { type: 'scheduleForm', schoolId: button.dataset.school, yearId: button.dataset.year, groupId: button.dataset.group };
            render();
            break;
        case 'school-child-toggle': {
            const year = yearById(schoolById(button.dataset.school), button.dataset.year), group = groupById(year, button.dataset.group), id = button.dataset.child;
            if (!year || !group || !childById(id))
                break;
            if (group.childIds.includes(id))
                group.childIds = group.childIds.filter(x => x !== id);
            else {
                year.groups.forEach(g => g.childIds = g.childIds.filter(x => x !== id));
                group.childIds.push(id);
            }
            update();
            notify('Assignació al grup actualitzada');
            break;
        }
        case 'school-delete': {
            const school = schoolById(button.dataset.school);
            if (!school || !confirm(`Vols suprimir «${school.name}» amb tots els cursos i grups?`))
                break;
            state.schools = state.schools.filter(s => s.id !== school.id);
            schoolNav = {};
            update();
            notify('Escola suprimida');
            break;
        }
        case 'year-delete': {
            const school = schoolById(button.dataset.school), year = yearById(school, button.dataset.year);
            if (!school || !year || !confirm(`Vols suprimir «${schoolYearName(year)}» amb tots els seus grups i dies especials?`))
                break;
            school.years = school.years.filter(y => y.id !== year.id);
            schoolNav = { schoolId: school.id };
            update();
            notify('Curs suprimit');
            break;
        }
        case 'group-delete': {
            const school = schoolById(button.dataset.school), year = yearById(school, button.dataset.year), group = groupById(year, button.dataset.group);
            if (!school || !year || !group || !confirm(`Vols suprimir el grup «${group.name}»?`))
                break;
            year.groups = year.groups.filter(g => g.id !== group.id);
            schoolNav = { schoolId: school.id, yearId: year.id };
            update();
            notify('Grup suprimit');
            break;
        }
        case 'school-day-delete': {
            const year = yearById(schoolById(button.dataset.school), button.dataset.year), date = button.dataset.date;
            if (!year)
                break;
            if (button.dataset.kind === 'holiday')
                year.holidays = year.holidays.filter(d => d !== date);
            else
                year.reducedDays = year.reducedDays.filter(d => d !== date);
            update();
            notify('Dia eliminat');
            break;
        }
        case 'schedule-delete': {
            const group = groupById(yearById(schoolById(button.dataset.school), button.dataset.year), button.dataset.group);
            if (!group)
                break;
            group.weeklySchedule = group.weeklySchedule.filter(a => a.id !== button.dataset.session);
            update();
            notify('Franja suprimida');
            break;
        }
        case 'tab':
            changeTab(button.dataset.tab);
            break;
        case 'set-theme':
            state.preferences.theme = validTheme(button.dataset.themeMode);
            update();
            break;
        case 'open-filters':
            sheet = { type: 'filters' };
            render();
            break;
        case 'close-sheet':
            sheet = null;
            render();
            break;
        case 'today': {
            const now = new Date();
            viewMonth = now.getMonth();
            viewYear = now.getFullYear();
            render();
            break;
        }
        case 'prev-month':
            goToMonth(-1);
            break;
        case 'next-month':
            goToMonth(1);
            break;
        case 'open-day':
            sheet = { type: 'day', date: button.dataset.date };
            render();
            break;
        case 'toggle-filter': {
            const kind = button.dataset.filterKind === 'child' ? 'visibleChildren' : 'visibleGuardians', id = button.dataset.id;
            const selected = state.preferences[kind];
            state.preferences[kind] = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
            update();
            break;
        }
        case 'filter-all':
            state.preferences.visibleChildren = state.children.map(c => c.id);
            state.preferences.visibleGuardians = state.guardians.map(g => g.id);
            update();
            break;
        case 'assign-night':
            chooseGuardian(button.dataset.date, button.dataset.child, button.dataset.guardian);
            break;
        case 'clear-night':
            delete state.overrides[`${button.dataset.date}|${button.dataset.child}`];
            update();
            notify('Patró habitual restaurat');
            break;
        case 'rotation-cell':
            sheet = { type: 'rotationCell', childId: button.dataset.child, index: Number(button.dataset.index) };
            render();
            break;
        case 'rotation-week-fill':
            sheet = { type: 'rotationWeek', childId: button.dataset.child, week: Number(button.dataset.week) };
            render();
            break;
        case 'rotation-set-week': {
            if (!rotationDraft)
                rotationDraft = JSON.parse(JSON.stringify(state.rotation));
            const week = Number(button.dataset.week), childId = button.dataset.child, gId = button.dataset.guardian;
            const end = Math.min(rotationDraft.length, (week + 1) * 7);
            for (let i = week * 7; i < end; i++)
                rotationDraft.assignments[childId][i] = gId;
            sheet = null;
            render();
            notify('Setmana assignada al tutor');
            break;
        }
        case 'rotation-set-cell': {
            if (!rotationDraft)
                rotationDraft = JSON.parse(JSON.stringify(state.rotation));
            rotationDraft.assignments[button.dataset.child][Number(button.dataset.index)] = button.dataset.guardian;
            sheet = null;
            render();
            break;
        }
        case 'rotation-same': {
            if (!rotationDraft)
                rotationDraft = JSON.parse(JSON.stringify(state.rotation));
            const first = state.children[0]?.id;
            if (first) {
                for (const child of state.children)
                    rotationDraft.assignments[child.id] = [...(rotationDraft.assignments[first] ?? [])];
            }
            render();
            notify('Patró copiat a tots els fills');
            break;
        }
        case 'rotation-copy': {
            if (!rotationDraft)
                rotationDraft = JSON.parse(JSON.stringify(state.rotation));
            rotationDraft.assignments[button.dataset.child] = [...(rotationDraft.assignments[button.dataset.from] ?? [])];
            render();
            notify('Patró copiat');
            break;
        }
        case 'rotation-save': {
            if (!rotationDraft)
                return;
            state.rotation = JSON.parse(JSON.stringify(rotationDraft));
            rotationDraft = JSON.parse(JSON.stringify(state.rotation));
            update();
            notify('Patró de rotació desat');
            break;
        }
        case 'rotation-cancel':
            rotationDraft = JSON.parse(JSON.stringify(state.rotation));
            render();
            notify('Canvis descartats');
            break;
        case 'add-child': {
            const id = newId();
            const prev = state.children[0];
            const name = `Fill ${state.children.length + 1}`;
            state.children.push({ id, name, birthDate: '' });
            state.rotation.assignments[id] = [...(state.rotation.assignments[prev?.id ?? ''] ?? Array.from({ length: state.rotation.length }, () => defaultGuardian()))];
            state.preferences.visibleChildren.push(id);
            rotationDraft = null;
            update();
            notify('Fill afegit · pots editar-ne el nom');
            break;
        }
        case 'add-guardian': {
            const palette = ['#b2a0e9', '#97cbb7', '#f0c17c', '#8eb9d9', '#d6a8bb'];
            const color = palette[state.guardians.length % palette.length] ?? '#aabbcc', id = newId();
            state.guardians.push({ id, name: `Tutor ${state.guardians.length + 1}`, color });
            state.preferences.visibleGuardians.push(id);
            update();
            notify('Tutor afegit · pots editar-ne el nom');
            break;
        }
        case 'delete-child':
            removeChild(button.dataset.child);
            break;
        case 'delete-guardian':
            removeGuardian(button.dataset.guardian);
            break;
        case 'export':
            void exportData();
            break;
        case 'import':
            document.getElementById('import-file')?.click();
            break;
        case 'reset':
            void resetData();
            break;
    }
}
document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element))
        return;
    const actionButton = target.closest('[data-action]');
    if (!actionButton)
        return;
    if (actionButton.dataset.action === 'close-backdrop') {
        if (target === actionButton) {
            sheet = null;
            render();
        }
        return;
    }
    if (actionButton.matches('button') && !actionButton.disabled)
        clickAction(actionButton);
});
document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.schoolForm)
        return;
    event.preventDefault();
    const values = new FormData(form), get = (key) => String(values.get(key) ?? '').trim();
    const formKind = form.dataset.schoolForm;
    const school = schoolById(form.dataset.school), year = yearById(school, form.dataset.year), group = groupById(year, form.dataset.group);
    const finish = (message) => { sheet = null; update(); notify(message); };
    if (formKind === 'school') {
        const name = get('name').slice(0, 100);
        if (!name) {
            notify('Indica el nom de l’escola');
            return;
        }
        if (school) {
            school.name = name;
            school.address = get('address').slice(0, 200);
            school.phone = get('phone').slice(0, 50);
            finish('Escola actualitzada');
        }
        else {
            const id = newId();
            state.schools.push({ id, name, address: get('address').slice(0, 200), phone: get('phone').slice(0, 50), years: [] });
            schoolNav = { schoolId: id };
            finish('Escola afegida');
        }
        return;
    }
    if (formKind === 'year') {
        if (!school)
            return;
        const startDate = get('startDate'), endDate = get('endDate');
        if (!isValidDate(startDate) || !isValidDate(endDate) || startDate >= endDate) {
            notify('La data final ha de ser posterior a la inicial');
            return;
        }
        if (school.years.some(y => y.id !== year?.id && y.startDate === startDate && y.endDate === endDate)) {
            notify('Aquest curs ja existeix');
            return;
        }
        if (year) {
            if ([...year.holidays, ...year.reducedDays].some(d => d < startDate || d > endDate)) {
                notify('Hi ha dies especials fora de les noves dates. Revisa’ls abans.');
                return;
            }
            year.startDate = startDate;
            year.endDate = endDate;
            finish('Dates del curs actualitzades');
        }
        else {
            const id = newId();
            school.years.push({ id, startDate, endDate, holidays: [], reducedDays: [], groups: [] });
            schoolNav = { schoolId: school.id, yearId: id };
            finish('Curs escolar afegit');
        }
        return;
    }
    if (formKind === 'group') {
        if (!school || !year)
            return;
        const name = get('name').slice(0, 80), tutorName = get('tutorName').slice(0, 100);
        if (!name) {
            notify('Indica el nom del grup classe');
            return;
        }
        if (group) {
            group.name = name;
            group.tutorName = tutorName;
            finish('Grup classe actualitzat');
        }
        else {
            const id = newId();
            year.groups.push({ id, name, tutorName, weeklySchedule: [], childIds: [] });
            schoolNav = { schoolId: school.id, yearId: year.id, groupId: id };
            finish('Grup classe afegit');
        }
        return;
    }
    if (formKind === 'day') {
        if (!year)
            return;
        const date = get('date'), kind = form.dataset.kind;
        if (!isValidDate(date) || date < year.startDate || date > year.endDate) {
            notify('La data ha d’estar compresa dins del curs');
            return;
        }
        if (year.holidays.includes(date) || year.reducedDays.includes(date)) {
            notify('Aquest dia ja està marcat al curs');
            return;
        }
        const days = kind === 'holiday' ? year.holidays : year.reducedDays;
        days.push(date);
        days.sort();
        finish(kind === 'holiday' ? 'Festiu afegit' : 'Dia d’horari reduït afegit');
        return;
    }
    if (formKind === 'schedule') {
        if (!group)
            return;
        const weekday = Number(get('weekday')), startTime = get('startTime'), endTime = get('endTime');
        if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) {
            notify('L’horari ha de tenir una hora final posterior a la inicial');
            return;
        }
        if (group.weeklySchedule.some(a => a.weekday === weekday && a.startTime < endTime && a.endTime > startTime)) {
            notify('Aquesta franja se solapa amb una altra del mateix dia');
            return;
        }
        group.weeklySchedule.push({ id: newId(), weekday, startTime, endTime, label: get('label').slice(0, 80) });
        finish('Franja horària afegida');
    }
});
document.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))
        return;
    const action = target.dataset.action;
    if (action === 'rotation-start' && rotationDraft && isValidDate(target.value)) {
        rotationDraft.startDate = target.value;
        render();
    }
    else if (action === 'rotation-length' && rotationDraft) {
        const count = Number(target.value), factor = rotationUnit === 'weeks' ? 7 : 1, length = count * factor;
        if (!Number.isSafeInteger(count) || count < 1 || length > MAX_ROTATION_DAYS) {
            notify('Indica una durada vàlida entre 1 i ' + (MAX_ROTATION_DAYS / factor));
            render();
            return;
        }
        rotationDraft = resizedRotation(rotationDraft, length);
        render();
    }
    else if (action === 'rotation-unit' && rotationDraft) {
        rotationUnit = target.value === 'weeks' ? 'weeks' : 'days';
        if (rotationUnit === 'weeks' && rotationDraft.length % 7 !== 0) {
            rotationDraft = resizedRotation(rotationDraft, Math.ceil(rotationDraft.length / 7) * 7);
            notify('Durada arrodonida a setmanes completes');
        }
        render();
    }
    else if (action === 'child-name') {
        const child = childById(target.dataset.child);
        if (child) {
            child.name = target.value.trim().slice(0, 70) || child.name;
            update();
        }
    }
    else if (action === 'child-birth') {
        const child = childById(target.dataset.child);
        if (child) {
            child.birthDate = target.value;
            update();
        }
    }
    else if (action === 'guardian-name') {
        const g = guardian(target.dataset.guardian);
        if (g) {
            g.name = target.value.trim().slice(0, 70) || g.name;
            update();
        }
    }
    else if (action === 'guardian-color') {
        const g = guardian(target.dataset.guardian);
        if (g && /^#[0-9a-fA-F]{6}$/.test(target.value)) {
            g.color = target.value;
            update();
        }
    }
    else if (target instanceof HTMLInputElement && target.id === 'import-file' && target.files?.[0]) {
        void importData(target.files[0]);
        target.value = '';
    }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && sheet) {
    sheet = null;
    render();
} });
async function init() {
    await loadState();
    applyTheme();
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => reg.update().catch(() => { })).catch(err => console.warn('Service worker no registrat:', err));
    }
}
void init();

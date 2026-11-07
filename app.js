"use strict";
const SESSION_KINDS = ['classe', 'pati', 'menjador', 'extraescolar', 'altres'];
const SESSION_KIND_NAMES = { classe: 'Classe', pati: 'Pati', menjador: 'Menjador', extraescolar: 'Extraescolar', altres: 'Altres' };
function sessionKind(value) { return SESSION_KINDS.includes(value) ? value : 'classe'; }
const BANDS = ['mati', 'dinar', 'tarda', 'sopar', 'nit'];
const BAND_NAMES = { mati: 'Matí', dinar: 'Dinar', tarda: 'Tarda', sopar: 'Sopar', nit: 'Nit' };
// Hores orientatives. No equivalen a un horari escolar real i no es mostren com a hores exactes.
const BAND_RANGES = { mati: [8 * 60, 12 * 60], dinar: [12 * 60, 15 * 60], tarda: [15 * 60, 18 * 60] };
function isTimeBand(value) { return BANDS.some(b => b === value); }
const DEFAULT_CHANGE_TIME = '19:00';
function validChangeTime(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : DEFAULT_CHANGE_TIME; }
function timeMinutes(value) { const [h, m] = value.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); }
/** Retalla les franges a l'interval reduït conegut, sense modificar el patró original. */
function clippedWeeklySchedule(sessions, window) {
    return sessions.map(a => ({ ...a, startTime: a.startTime < window.startTime ? window.startTime : a.startTime, endTime: a.endTime > window.endTime ? window.endTime : a.endTime }))
        .filter(a => a.startTime < a.endTime);
}
function ordinaryScheduleForChild(group, childId) {
    return childId && Object.hasOwn(group.childSchedules ?? {}, childId) ? group.childSchedules[childId] : group.weeklySchedule;
}
function reducedScheduleForChild(group, year, childId) {
    if (!year.reducedWindow)
        return [];
    const specific = childId && Object.hasOwn(group.reducedChildSchedules ?? {}, childId)
        ? group.reducedChildSchedules[childId]
        : group.reducedWeeklySchedule;
    return clippedWeeklySchedule(specific ?? ordinaryScheduleForChild(group, childId), year.reducedWindow);
}
function scheduleForSchoolDay(group, year, childId, date) {
    if (date < year.startDate || date > year.endDate || year.holidays.includes(date) || year.vacations?.some(p => date >= p.startDate && date <= p.endDate))
        return [];
    const weekday = (parseDate(date).getDay() + 6) % 7;
    const weekly = year.reducedDays.includes(date) ? reducedScheduleForChild(group, year, childId) : ordinaryScheduleForChild(group, childId);
    return weekly.filter(a => a.weekday === weekday);
}
/** Les hores comunes delimiten l'estada, sense atribuir activitats al centre. */
function ordinaryBaseForSchool(school, year) {
    if (year?.ordinaryWindow)
        return Array.from({ length: 5 }, (_, weekday) => ({
            id: `__school_window__${weekday}`, weekday, startTime: year.ordinaryWindow.startTime,
            endTime: year.ordinaryWindow.endTime, kind: 'altres', label: ''
        }));
    // Compatibilitat no destructiva amb horaris generals definits a la v0.3.1.
    return school.weeklySchedule ?? [];
}
/** Mescla l'horari de centre amb activitats de grup; preserva els registres antics per fill en mode lectura. */
function schoolScheduleForCalendarDay(school, year, group, childId, date) {
    if (year && (date < year.startDate || date > year.endDate || year.holidays.includes(date) || year.vacations?.some(p => date >= p.startDate && date <= p.endDate)))
        return [];
    const weekday = (parseDate(date).getDay() + 6) % 7;
    const base = ordinaryBaseForSchool(school, year).filter(s => s.weekday === weekday);
    const oldChild = group?.childSchedules && Object.hasOwn(group.childSchedules, childId) ? group.childSchedules[childId] : undefined;
    const extra = (oldChild ?? group?.weeklySchedule ?? []).filter(s => s.weekday === weekday);
    const core = window.schoolScheduleCore;
    const ordinary = core ? core.combine(base, extra) : [...base, ...extra];
    if (!year?.reducedDays.includes(date))
        return ordinary;
    if (!year.reducedWindow || weekday > 4)
        return [];
    // Els dies reduïts tenen activitats pròpies per grup; els buits mantenen
    // el context de presència a l'escola, mai activitats ordinàries inventades.
    const baseReduced = { id: `__reduced_window__${weekday}`, weekday,
        startTime: year.reducedWindow.startTime, endTime: year.reducedWindow.endTime, kind: 'altres', label: '' };
    const oldReduced = group?.reducedChildSchedules && Object.hasOwn(group.reducedChildSchedules, childId) ? group.reducedChildSchedules[childId] : undefined;
    const special = (oldReduced ?? group?.reducedWeeklySchedule ?? []).filter(s => s.weekday === weekday);
    return core ? core.combine([baseReduced], special) : [baseReduced, ...special];
}
function inReducedWindow(sessions, window) {
    return sessions.every(a => a.startTime >= window.startTime && a.endTime <= window.endTime);
}
const $app = document.getElementById('app');
const APP_VERSION = '0.16.31';
const TIMELINE_ZOOM_LEVELS = [25, 50, 75, 100, 125, 150];
const FONT_SIZE_OPTIONS = ['normal', 'large', 'xlarge'];
const FONT_SIZE_LABELS = { normal: 'Normal', large: 'Gran', xlarge: 'Molt gran' };
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
    'calendar-year': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M7 13h2m4 0h2m2 0h.01M7 17h2m4 0h2m2 0h.01"/>',
    'calendar-month': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9 10v11m6-11v11M3 15h18"/>',
    'calendar-week': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M7 10v11m5-11v11m5-11v11"/>',
    'calendar-day': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h8m-8 3h5"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-2.85v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2-2 .06-.06A1.65 1.65 0 0 0 7.6 15a1.65 1.65 0 0 0-1.51-1H6v-2.85h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-2 .06.06A1.65 1.65 0 0 0 11.09 6a1.65 1.65 0 0 0 1-1.51V4h2.85v.49a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2 2-.06.06A1.65 1.65 0 0 0 19.4 10a1.65 1.65 0 0 0 1.51 1H21v3h-.09a1.65 1.65 0 0 0-1.51 1Z" transform="translate(-.5 -.5) scale(.94)"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>', chevronRight: '<path d="m9 18 6-6-6-6"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6m-3-3v6"/>',
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
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    person: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    home: '<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/>',
    monitor: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>'
};
function icon(name, size = 19) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)); }
function localDate(date) { return [String(date.getFullYear()).padStart(4, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); }
function parseDate(value) { const [y, m, d] = value.split('-').map(Number); return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 12); }
function addDays(date, days) { const d = parseDate(date); d.setDate(d.getDate() + days); return localDate(d); }
function utcDay(date) { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1) / 86400000; }
function diffDays(a, b) { return utcDay(a) - utcDay(b); }
/** Dia i mes en català: de gener, d’abril, d’agost i d’octubre. */
function dayMonth(date, capitalMonth = false) { const d = parseDate(date), month = months[d.getMonth()], label = capitalMonth ? month[0].toUpperCase() + month.slice(1) : month; return `${d.getDate()} ${/^[aeiou]/.test(month) ? 'd’' : 'de '}${label}`; }
function monthTitle(year, month) { return `${months[month]} ${year}`; }
function fullDate(date) { const d = parseDate(date); const dayIndex = (d.getDay() + 6) % 7; return `${weekLong[dayIndex]}, ${dayMonth(date)} de ${d.getFullYear()}`; }
function initial(name) { return [...name.trim()][0]?.toUpperCase() || '?'; }
function newId() { return (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
/** Estat inicial completament buit, sense dades familiars predefinides. */
function emptyState() {
    return {
        version: 2, children: [], guardians: [], personTimeOff: {},
        overrides: {}, bandOverrides: {}, daySlots: {}, schools: [], nightDateTimes: {}, extraRotations: [], extraExceptions: {},
        preferences: { showHolyWeek: false, showWorkSchedules: true, mePerson: '', visibleTimeOffPeople: [], showPersonalHolidays: true, showPersonalVacations: true, visibleChildren: [], visibleGuardians: [], visibleSchools: [], visibleBands: [...BANDS], theme: 'auto', fontSize: 'normal', timelineZoom: 50, timelineZooms: { day: 50, week: 50 } }
    };
}
const SCHOOL_PALETTE = ['#74c6a3', '#f0be75', '#afa4e6', '#7bbcc9', '#d3a1cd', '#bbc773', '#d4a68f', '#87b8e1'];
function suggestedSchoolColor(schools) {
    const used = new Set(schools.map(s => s.color.toLowerCase()));
    for (const color of SCHOOL_PALETTE)
        if (!used.has(color))
            return color;
    for (let i = 0; i < 360; i++) {
        const hue = (i * 137 + 57) % 360, rgb = (h) => {
            const k = (h + hue / 30) % 12, a = .62 * .35;
            return Math.round(255 * (.62 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
        };
        const color = '#' + rgb(0) + rgb(8) + rgb(4);
        if (!used.has(color))
            return color;
    }
    return '#74c6a3';
}
function validTheme(value) { return value === 'light' || value === 'dark' ? value : 'auto'; }
function validFontSize(value) { return value === 'large' || value === 'xlarge' ? value : 'normal'; }
function validTimelineZoom(value) { return typeof value === 'number' && TIMELINE_ZOOM_LEVELS.includes(value) ? value : 50; }
function timelineZoomForView(view = calendarView === 'day' ? 'day' : 'week') {
    return validTimelineZoom(state.preferences.timelineZooms?.[view] ?? state.preferences.timelineZoom);
}
function setTimelineZoomForView(value) {
    if (calendarView !== 'day' && calendarView !== 'week')
        return;
    const next = validTimelineZoom(value);
    if (next === timelineZoomForView())
        return;
    state.preferences.timelineZooms = { day: timelineZoomForView('day'), week: timelineZoomForView('week'), [calendarView]: next };
    update();
}
function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && localDate(parseDate(s)) === s; }
/** Validació i migració no destructiva: còpies anteriors a Escoles són vàlides. */
/** Horari ordinari general de l'escola, independent dels grups. */
function cleanSchoolWeeklySchedule(raw) {
    if (!Array.isArray(raw) || raw.length > 200)
        throw Error('L’horari ordinari de l’escola no és vàlid');
    const ids = new Set();
    const result = raw.map((x) => {
        if (!x || typeof x.id !== 'string' || ids.has(x.id) || !Number.isInteger(x.weekday) || x.weekday < 0 || x.weekday > 6 ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.endTime) ||
            x.startTime >= x.endTime || (x.kind !== undefined && !SESSION_KINDS.includes(x.kind)))
            throw Error('Hi ha una franja ordinària d’escola incorrecta');
        ids.add(x.id);
        return { id: x.id, weekday: x.weekday, startTime: x.startTime, endTime: x.endTime, label: typeof x.label === 'string' ? x.label.trim().slice(0, 80) : '', kind: sessionKind(x.kind) };
    });
    const ordered = [...result].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    if (ordered.some((a, i) => i > 0 && ordered[i - 1].weekday === a.weekday && ordered[i - 1].endTime > a.startTime))
        throw Error('Hi ha franges escolars solapades');
    return result;
}
function cleanSchools(raw, children) {
    if (raw === undefined)
        return [];
    if (!Array.isArray(raw) || raw.length > 50)
        throw Error('La còpia conté escoles incorrectes');
    const childSet = new Set(children.map(c => c.id)), schoolIds = new Set();
    const isText = (x) => typeof x === 'string';
    const name = (x, max = 120) => typeof x === 'string' ? x.trim().slice(0, max) : '';
    const validTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const acceptedColors = new Set();
    return raw.map((entry, index) => {
        const school = entry;
        if (!school || !isText(school.id) || schoolIds.has(school.id) || !name(school.name) || !Array.isArray(school.years) || school.years.length > 60)
            throw Error('Hi ha una escola invàlida a la còpia');
        schoolIds.add(school.id);
        const preferredColor = typeof school.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(school.color) ? school.color.toLowerCase() : '';
        const previouslyColored = [...acceptedColors].map((color, i) => ({ id: String(i), name: '', address: '', phone: '', color, years: [], weeklySchedule: [], childIds: [] }));
        const color = preferredColor && !acceptedColors.has(preferredColor) ? preferredColor : suggestedSchoolColor(previouslyColored);
        acceptedColors.add(color);
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
            const rawVacations = year.vacations ?? [];
            if (!Array.isArray(rawVacations) || rawVacations.length > 100)
                throw Error('Períodes de vacances escolars incorrectes');
            const vacationIds = new Set();
            const vacations = rawVacations.map(period => {
                if (!period || typeof period.id !== 'string' || !period.id || period.id.length > 100 || vacationIds.has(period.id) || !name(period.name) ||
                    !isValidDate(period.startDate) || !isValidDate(period.endDate) || period.startDate > period.endDate || period.startDate < year.startDate || period.endDate > year.endDate)
                    throw Error('Hi ha un període de vacances incorrecte o fora del curs escolar');
                vacationIds.add(period.id);
                return { id: period.id, name: name(period.name, 120), startDate: period.startDate, endDate: period.endDate };
            }).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
            const windowRaw = year.reducedWindow;
            if (windowRaw !== undefined && (!windowRaw || !validTime(windowRaw.startTime) || !validTime(windowRaw.endTime) || windowRaw.startTime >= windowRaw.endTime))
                throw Error('L’interval de jornada reduïda no és vàlid');
            const reducedWindow = windowRaw ? { startTime: windowRaw.startTime, endTime: windowRaw.endTime } : undefined;
            const ordinaryRaw = year.ordinaryWindow;
            if (ordinaryRaw !== undefined && (!ordinaryRaw || !validTime(ordinaryRaw.startTime) || !validTime(ordinaryRaw.endTime) || ordinaryRaw.startTime >= ordinaryRaw.endTime))
                throw Error('L’interval de jornada ordinària no és vàlid');
            const ordinaryWindow = ordinaryRaw ? { startTime: ordinaryRaw.startTime, endTime: ordinaryRaw.endTime } : undefined;
            if (reducedDays.some(d => holidays.includes(d) || vacations.some(p => d >= p.startDate && d <= p.endDate)))
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
                // Les còpies 0.1.8 no tenen categoria ni horaris particulars.
                const parseSchedule = (entries) => {
                    if (!Array.isArray(entries) || entries.length > 200)
                        throw Error('Un horari escolar no és vàlid');
                    const ids = new Set();
                    const sessions = entries.map((a) => {
                        if (!a || !isText(a.id) || ids.has(a.id) || !Number.isInteger(a.weekday) || a.weekday < 0 || a.weekday > 6 || !validTime(a.startTime) || !validTime(a.endTime) || a.startTime >= a.endTime || (a.kind !== undefined && !SESSION_KINDS.includes(a.kind)))
                            throw Error('Hi ha un horari setmanal incorrecte');
                        ids.add(a.id);
                        return { id: a.id, weekday: a.weekday, startTime: a.startTime, endTime: a.endTime, label: name(a.label, 80), kind: sessionKind(a.kind) };
                    });
                    const ordered = [...sessions].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
                    for (let i = 1; i < ordered.length; i++) {
                        const prev = ordered[i - 1], next = ordered[i];
                        if (prev.weekday === next.weekday && prev.endTime > next.startTime)
                            throw Error('Hi ha franges escolars solapades');
                    }
                    return sessions;
                };
                const weeklySchedule = parseSchedule(g.weeklySchedule);
                const childSchedules = {};
                if (g.childSchedules !== undefined) {
                    if (!g.childSchedules || typeof g.childSchedules !== 'object' || Array.isArray(g.childSchedules) || Object.keys(g.childSchedules).length > 30)
                        throw Error('Els horaris individuals no són vàlids');
                    for (const [id, sessions] of Object.entries(g.childSchedules)) {
                        if (!childIds.includes(id))
                            throw Error('Hi ha un horari per a un fill que no pertany al grup');
                        childSchedules[id] = parseSchedule(sessions);
                    }
                }
                const reducedWeeklySchedule = g.reducedWeeklySchedule === undefined ? undefined : parseSchedule(g.reducedWeeklySchedule);
                const reducedChildSchedules = {};
                if (g.reducedChildSchedules !== undefined) {
                    if (!g.reducedChildSchedules || typeof g.reducedChildSchedules !== 'object' || Array.isArray(g.reducedChildSchedules) || Object.keys(g.reducedChildSchedules).length > 30)
                        throw Error('Els horaris de jornada reduïda no són vàlids');
                    for (const [id, sessions] of Object.entries(g.reducedChildSchedules)) {
                        if (!childIds.includes(id))
                            throw Error('Hi ha un horari reduït per a un fill no matriculat');
                        reducedChildSchedules[id] = parseSchedule(sessions);
                    }
                }
                if ((reducedWeeklySchedule !== undefined || Object.keys(reducedChildSchedules).length > 0) && !reducedWindow)
                    throw Error('Cal definir les hores de jornada reduïda abans dels horaris especials');
                if (reducedWindow && (reducedWeeklySchedule !== undefined && !inReducedWindow(reducedWeeklySchedule, reducedWindow) || Object.values(reducedChildSchedules).some(a => !inReducedWindow(a, reducedWindow))))
                    throw Error('Hi ha activitats fora de les hores de jornada reduïda');
                return { id: g.id, name: name(g.name, 80), tutorName: name(g.tutorName, 100), weeklySchedule, childIds, childSchedules, reducedWeeklySchedule, reducedChildSchedules };
            });
            return { id: year.id, startDate: year.startDate, endDate: year.endDate, holidays, vacations, reducedDays, groups, reducedWindow, ordinaryWindow };
        });
        const schoolChildIds = school.childIds === undefined ? [] : school.childIds;
        if (!Array.isArray(schoolChildIds) || schoolChildIds.length > 30 || schoolChildIds.some(id => typeof id !== 'string' || !childSet.has(id)) || new Set(schoolChildIds).size !== schoolChildIds.length)
            throw Error('Els fills associats a l’escola no són vàlids');
        return { id: school.id, name: name(school.name, 100), address: name(school.address, 200), phone: name(school.phone, 50), color, years, weeklySchedule: cleanSchoolWeeklySchedule(school.weeklySchedule ?? []), childIds: [...schoolChildIds] };
    });
}
function cleanState(raw) {
    if (!raw || typeof raw !== 'object')
        throw Error('Fitxer sense dades vàlides');
    const obj = raw;
    if ((obj.version !== 1 && obj.version !== 2) || !Array.isArray(obj.children) || !Array.isArray(obj.guardians) || !obj.preferences || !obj.overrides)
        throw Error('Format de còpia no compatible');
    const children = obj.children.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.birthDate === 'string').map(c => ({ ...c, name: c.name.slice(0, 70), birthDate: isValidDate(c.birthDate) ? c.birthDate : '' }));
    const guardians = obj.guardians.filter(g => g && typeof g.id === 'string' && typeof g.name === 'string' && typeof g.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(g.color)).map(g => ({ ...g, name: g.name.slice(0, 70) }));
    if (children.length > 30 || guardians.length > 30 || new Set(children.map(x => x.id)).size !== children.length || new Set(guardians.map(x => x.id)).size !== guardians.length)
        throw Error('La còpia conté fills o tutors incorrectes');
    const personTimeOff = personalTimeOff.clean(obj.personTimeOff, children, guardians);
    const personalPrefs = personalTimeOff.cleanPreferences(obj.preferences, children, guardians, personTimeOff);
    const validGuardians = new Set(guardians.map(x => x.id));
    const overrides = {};
    for (const [key, value] of Object.entries(obj.overrides)) {
        const [date, childId] = key.split('|');
        if (date && childId && isValidDate(date) && children.some(c => c.id === childId) && validGuardians.has(value))
            overrides[key] = value;
    }
    const schools = cleanSchools(obj.schools, children);
    const daySlots = monthDayUI.clean(obj.daySlots, children.map(c => c.id), guardians.map(g => g.id));
    const visibleBands = Array.isArray(obj.preferences.visibleBands)
        ? BANDS.filter(b => obj.preferences.visibleBands.includes(b)) : [...BANDS];
    const bandOverrides = {};
    const rawBands = obj.bandOverrides;
    if (rawBands !== undefined) {
        if (!rawBands || typeof rawBands !== 'object' || Array.isArray(rawBands) || Object.keys(rawBands).length > 50000)
            throw Error('Les assignacions de franges no són vàlides');
        for (const [key, who] of Object.entries(rawBands)) {
            const parts = key.split('|');
            if (parts.length !== 3 || !isValidDate(parts[0] ?? '') || !children.some(c => c.id === parts[1]) || !isTimeBand(parts[2] ?? '') || parts[2] === 'nit' || (who !== '' && !validGuardians.has(who)))
                continue;
            bandOverrides[key] = who;
        }
    }
    const extraRotations = rotationPatterns.cleanExtras(obj.extraRotations, children, guardians, MAX_ROTATION_DAYS);
    if (obj.version === 1) {
        const migrated = rotationPatterns.legacyNight(obj.rotation, obj.nightPatternTimes, children, guardians);
        for (const night of migrated) {
            let suffix = 0;
            while (extraRotations.some(r => r.id === night.id))
                night.id = 'legacy-night-' + (++suffix);
            extraRotations.push(night);
        }
        rotationPatterns.validateNightOverlaps(extraRotations);
    }
    extraRotations.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
    const nightDateTimes = rotationPatterns.cleanNightDateTimes(obj.nightDateTimes, children);
    const extraExceptions = rotationPatterns.cleanExtraExceptions(obj.extraExceptions, extraRotations, children, guardians);
    return { version: 2, children, guardians, personTimeOff, nightDateTimes, extraRotations, extraExceptions, overrides, bandOverrides, daySlots, preferences: { ...personalPrefs, showHolyWeek: obj.preferences.showHolyWeek === true, visibleChildren: children.filter(c => obj.preferences.visibleChildren?.includes(c.id)).map(c => c.id), visibleGuardians: guardians.filter(g => obj.preferences.visibleGuardians?.includes(g.id)).map(g => g.id), visibleSchools: schools.filter(s => obj.preferences.visibleSchools?.includes(s.id)).map(s => s.id), visibleBands, theme: validTheme(obj.preferences.theme), fontSize: validFontSize(obj.preferences.fontSize), timelineZoom: validTimelineZoom(obj.preferences.timelineZoom), timelineZooms: { day: validTimelineZoom(obj.preferences.timelineZooms?.day ?? obj.preferences.timelineZoom), week: validTimelineZoom(obj.preferences.timelineZooms?.week ?? obj.preferences.timelineZoom) } }, schools };
}
let db = null;
let storageMode = 'session';
let state = emptyState();
let viewYear = new Date().getFullYear(), viewMonth = new Date().getMonth();
let calendarView = 'month';
let selectedDate = localDate(new Date());
let monthRange = null;
let yearRange = null;
let monthScrollTarget = true;
let stopCalendarScroll = null;
let tab = 'calendar';
let schoolNav = {};
let sheet = null;
let detailOrigin = 'calendar';
let detailReturnDate = '';
let extraRotationOpen = null;
let extraRotationDrafts = {};
let extraRotationUnit = 'weeks';
let extraRotationUnits = {};
let toastTimer = null;
let writeQueue = Promise.resolve();
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
    const mode = validTheme(state.preferences.theme);
    const effective = mode === 'auto' ? (themeMedia.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effective === 'dark' ? '#1c1c1e' : '#ffffff');
    try {
        localStorage.setItem('calendari-familiar-theme', mode);
    }
    catch { /* Emmagatzematge opcional */ }
}
function applyFontSize() { document.documentElement.dataset.fontSize = validFontSize(state.preferences.fontSize); }
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
        if (raw)
            state = cleanState(raw);
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
        if (raw)
            state = cleanState(JSON.parse(raw));
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
function update() { applyTheme(); applyFontSize(); saveState(); render(); }
function guardian(id) { return state.guardians.find(g => g.id === id); }
function childById(id) { return state.children.find(c => c.id === id); }
function defaultGuardian() { return state.guardians[0]?.id ?? ''; }
function nightChangeTime(date, childId = state.children[0]?.id ?? '') {
    return rotationPatterns.nightTimeFor(state.extraRotations, date, childId, state.nightDateTimes);
}
function rotationAssignment(date, childId) {
    return rotationPatterns.nightAssignment(state.extraRotations, date, childId);
}
function assigned(date, childId) { return state.overrides[`${date}|${childId}`] ?? rotationAssignment(date, childId); }
function overridden(date, childId) { return Object.hasOwn(state.overrides, `${date}|${childId}`); }
function birthdays(date) { return state.children.filter(c => c.birthDate && c.birthDate.slice(5) === date.slice(5)); }
function birthdayAge(date, child) { return parseInt(date.slice(0, 4), 10) - parseInt(child.birthDate.slice(0, 4), 10); }
function groupAssignments(date) {
    const visible = state.children.filter(c => state.preferences.visibleChildren.includes(c.id));
    return state.guardians.filter(g => state.preferences.visibleGuardians.includes(g.id)).map(g => ({ guardian: g, children: visible.filter(c => assigned(date, c.id) === g.id) })).filter(g => g.children.length);
}
function schoolForBand(date, childId, band) {
    if (band === 'nit' || band === 'sopar')
        return undefined;
    const weekday = (parseDate(date).getDay() + 6) % 7;
    const range = BAND_RANGES[band];
    if (!range)
        return undefined;
    return state.schools.find(s => {
        if (!state.preferences.visibleSchools.includes(s.id))
            return false;
        const year = s.years.find(y => date >= y.startDate && date <= y.endDate);
        if (s.years.length && !year)
            return false;
        if (year && (year.holidays.includes(date) || year.vacations?.some(p => date >= p.startDate && date <= p.endDate)))
            return false;
        const group = year?.groups.find(g => g.childIds.includes(childId));
        if (!s.childIds.includes(childId) && !group)
            return false;
        const sessions = schoolScheduleForCalendarDay(s, year, group, childId, date);
        if (!sessions.length && !year?.ordinaryWindow && !s.weeklySchedule.length && !group?.weeklySchedule.length && !year?.reducedDays.includes(date))
            return !!group && weekday < 5 && (band === 'mati' || band === 'tarda');
        const covered = sessions.reduce((sum, a) => sum + Math.max(0, Math.min(timeMinutes(a.endTime), range[1]) - Math.max(timeMinutes(a.startTime), range[0])), 0);
        return covered >= (range[1] - range[0]) / 2;
    });
}
function responsibility(date, childId, band) {
    const none = { type: 'none', name: 'Sense assignar', color: '', source: 'Sense assignació', changed: false };
    if (band === 'nit') {
        const g = guardian(assigned(date, childId));
        return g && state.preferences.visibleGuardians.includes(g.id) ? { type: 'guardian', name: g.name, color: g.color, source: overridden(date, childId) ? 'Canvi puntual' : 'Rotació nocturna', changed: overridden(date, childId) } : { ...none, changed: overridden(date, childId) };
    }
    const key = `${date}|${childId}|${band}`;
    if (Object.hasOwn(state.bandOverrides, key)) {
        const id = state.bandOverrides[key] ?? '', g = guardian(id);
        return g && state.preferences.visibleGuardians.includes(g.id) ? { type: 'guardian', name: g.name, color: g.color, source: 'Assignació puntual', changed: true } : { ...none, source: 'Assignació puntual', changed: true };
    }
    const school = schoolForBand(date, childId, band);
    return school ? { type: 'school', name: school.name, color: school.color, source: 'Horari escolar', changed: false } : none;
}
function activeChildren() { return state.children.filter(c => state.preferences.visibleChildren.includes(c.id)); }
function activeBands() { return BANDS.filter(b => state.preferences.visibleBands.includes(b)); }
function bandKey(date, childId, band) { return `${date}|${childId}|${band}`; }
function shortChildLabel(c) { return initial(c.name); }
const schoolCalendarUI = window.schoolCalendarUI;
function schoolActivities(date, children) {
    return schoolCalendarUI?.collect(date, children, state.schools, state.preferences.visibleSchools, schoolScheduleForCalendarDay) ?? [];
}
function schoolReducedDay(date, children) {
    return state.schools.some(s => state.preferences.visibleSchools.includes(s.id) && s.years.some(y => date >= y.startDate && date <= y.endDate && y.reducedDays.includes(date) && y.groups.some(g => g.childIds.some(id => children.some(c => c.id === id)))));
}
function schoolTimeline(date, children, range, empty = false) {
    if (!state.preferences.visibleSchools.length || !children.length)
        return '';
    return schoolCalendarUI?.render(date, fullDate(date), children, schoolActivities(date, children), range, empty, schoolReducedDay(date, children)) ?? '';
}
const dayTimelineUI = window.dayTimelineUI;
const monthDayUI = window.monthDayUI;
const rotationPatterns = window.rotationPatterns;
const rotationEditor = window.rotationEditor;
const workSchedule = window.workSchedule;
const personalTimeOff = window.personalTimeOff;
/** Presència escolar real, independent dels filtres de visualització i de l’hora de la rotació. */
function childHasSchool(date, childId) {
    const weekday = (parseDate(date).getDay() + 6) % 7;
    return state.schools.some(school => {
        const years = school.years.filter(year => date >= year.startDate && date <= year.endDate);
        if (school.years.length && !years.length)
            return false;
        return (years.length ? years : [undefined]).some(year => {
            if (year && (year.holidays.includes(date) || year.vacations?.some(p => date >= p.startDate && date <= p.endDate)))
                return false;
            const group = year?.groups.find(g => g.childIds.includes(childId));
            if (!school.childIds.includes(childId) && !group)
                return false;
            if (schoolScheduleForCalendarDay(school, year, group, childId, date).some(s => s.startTime < s.endTime))
                return true;
            // Una jornada reduïda continua sent lectiva encara que encara no tingui hores configurades.
            if (year?.reducedDays.includes(date))
                return weekday < 5;
            // Sense horaris detallats, la matrícula indica presència de dilluns a divendres.
            // Un horari individual buit explícit sí que indica absència.
            const individual = group?.childSchedules && Object.hasOwn(group.childSchedules, childId);
            return !year?.ordinaryWindow && !school.weeklySchedule.length && !group?.weeklySchedule.length && !individual && weekday < 5;
        });
    });
}
function extraSlots(date, children) {
    return rotationPatterns.slots(state, date, children, state.guardians, state.preferences.visibleGuardians, childHasSchool);
}
function monthData(date, children) {
    const nights = {};
    for (const c of children)
        nights[c.id] = dayTimelineUI?.overnightSegments(date, c.id, nightChangeTime(date, c.id), assigned, (d) => addDays(d, -1), guardian, state.preferences.visibleGuardians) ?? [];
    return { nights, activities: schoolActivities(date, children), slots: monthDayUI.slots(state, date, children, state.guardians, state.preferences.visibleGuardians), extra: extraSlots(date, children) };
}
function dayTimeline(date, children, minimumHeight = 0) {
    if (!dayTimelineUI)
        return '<p class="settings-note">No es pot carregar la línia temporal diària.</p>';
    const changeTime = nightChangeTime(date);
    const nights = {};
    for (const c of children)
        nights[c.id] = dayTimelineUI.overnightSegments(date, c.id, nightChangeTime(date, c.id), assigned, (d) => addDays(d, -1), guardian, state.preferences.visibleGuardians);
    if (!children.length)
        return `<div class="calendar-empty-state"><p>${state.children.length ? 'No hi ha fills visibles. Revisa els filtres.' : 'Encara no hi ha fills al calendari.'}</p><button class="secondary-btn" data-action="${state.children.length ? 'open-filters' : 'tab'}" ${state.children.length ? '' : 'data-tab="people"'}>${state.children.length ? 'Configura els filtres' : 'Afegeix un fill'}</button></div>`;
    return dayTimelineUI.render(date, fullDate(date), children, schoolActivities(date, children), nights, changeTime, timelineZoomForView('day'), monthDayUI.slots(state, date, children, state.guardians, state.preferences.visibleGuardians), extraSlots(date, children), minimumHeight);
}
function weekTimeline(start, children, minimumHeight = 0) {
    if (!dayTimelineUI)
        return '<p class="settings-note">No es pot carregar la línia temporal setmanal.</p>';
    const days = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const nightSegments = {};
        for (const c of children)
            nightSegments[c.id] = dayTimelineUI.overnightSegments(date, c.id, nightChangeTime(date, c.id), assigned, (d) => addDays(d, -1), guardian, state.preferences.visibleGuardians);
        return { date, label: `${weekLong[i]} ${parseDate(date).getDate()}`, dayOff: Boolean(state.preferences.mePerson && workSchedule.isDayOff(state, date)), activities: schoolActivities(date, children), nightSegments, customSlots: monthDayUI.slots(state, date, children, state.guardians, state.preferences.visibleGuardians), rotatingSlots: extraSlots(date, children) };
    });
    if (!children.length)
        return `<div class="calendar-empty-state"><p>${state.children.length ? 'No hi ha fills visibles. Revisa els filtres.' : 'Encara no hi ha fills al calendari.'}</p><button class="secondary-btn" data-action="${state.children.length ? 'open-filters' : 'tab'}" ${state.children.length ? '' : 'data-tab="people"'}>${state.children.length ? 'Configura els filtres' : 'Afegeix un fill'}</button></div>`;
    return dayTimelineUI.renderWeek(start, days, children, timelineZoomForView('week'), selectedDate, localDate(new Date()), minimumHeight);
}
function miniBands(date, children, bands) {
    if (!children.length || !bands.length)
        return '<span class="mini-empty">—</span>';
    return `<span class="mini-children" style="--child-count:${children.length}">${children.map(c => `<span title="${escapeHtml(c.name)}">${escapeHtml(shortChildLabel(c))}</span>`).join('')}</span>
    <span class="mini-grid">${bands.map(b => `<span class="mini-band" style="--child-count:${children.length}" title="${BAND_NAMES[b]}">${children.map(c => {
        const value = responsibility(date, c.id, b);
        return `<span class="mini-band-color ${value.type === 'none' ? 'mini-band-empty' : ''}" ${value.type === 'none' ? '' : `style="background:${value.color}"`} title="${escapeHtml(BAND_NAMES[b] + ' · ' + c.name + ': ' + value.name)}"></span>`;
    }).join('')}</span>`).join('')}</span>`;
}
function weekStart(date) { return addDays(date, -((parseDate(date).getDay() + 6) % 7)); }
function fullAgenda(date) {
    const children = activeChildren(), bands = activeBands();
    if (!children.length)
        return '<p class="settings-note">Selecciona algun fill als filtres.</p>';
    if (!bands.length)
        return '<p class="settings-note">Activa alguna franja del dia als filtres.</p>';
    return `<div class="agenda" style="--child-count:${children.length}"><div class="agenda-corner" aria-hidden="true">Franja</div>${children.map(c => `<div class="agenda-child" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`).join('')}
  ${bands.map(b => `<div class="agenda-band-name">${BAND_NAMES[b]}</div>${children.map(c => {
        const value = responsibility(date, c.id, b);
        return `<button class="agenda-cell ${value.type === 'none' ? 'is-empty' : ''}" type="button" data-action="edit-band" data-date="${date}" data-band="${b}" data-child="${escapeHtml(c.id)}" style="${value.color ? `--band-color:${value.color}` : ''}" aria-label="${escapeHtml(BAND_NAMES[b] + ', ' + c.name + ': ' + value.name + '. Toca per editar.')}"><span>${value.type === 'none' ? '—' : escapeHtml(value.name)}</span>${value.changed ? '<span class="agenda-modified">●</span>' : ''}</button>`;
    }).join('')}`).join('')}</div>`;
}
function periodTitle() {
    if (calendarView === 'year')
        return String(viewYear);
    if (calendarView === 'month')
        return monthTitle(viewYear, viewMonth);
    if (calendarView === 'week') {
        const first = weekStart(selectedDate), last = addDays(first, 6);
        return `${dayMonth(first, true)} – ${dayMonth(last, true)}`;
    }
    return dayMonth(selectedDate, true);
}
function navigateCalendar(delta) {
    if (calendarView === 'year') {
        const year = viewYear + delta, d = parseDate(selectedDate), month = d.getMonth();
        if (year < 100 || year > 9999)
            return;
        selectedDate = localDate(new Date(year, month, Math.min(d.getDate(), new Date(year, month + 1, 0).getDate()), 12));
    }
    else if (calendarView === 'month') {
        const d = new Date(viewYear, viewMonth + delta, 1, 12);
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        selectedDate = localDate(new Date(viewYear, viewMonth, 1, 12));
    }
    else
        selectedDate = addDays(selectedDate, delta * (calendarView === 'week' ? 7 : 1));
    viewYear = parseDate(selectedDate).getFullYear();
    viewMonth = parseDate(selectedDate).getMonth();
    monthScrollTarget = true;
    render();
}
function navButton(target, label, name, kind) {
    const active = target === 'settings' ? tab !== 'calendar' : tab === target;
    return `<button type="button" class="${kind === 'side' ? 'nav-button' : 'mobile-tab'} ${active ? 'active' : ''}" data-action="tab" data-tab="${target}" aria-current="${active ? 'page' : 'false'}">${icon(name, 20)}<span>${label}</span></button>`;
}
function calendarViewButtons(kind) {
    return [['year', 'Any'], ['month', 'Mes'], ['week', 'Setmana'], ['day', 'Dia']].map(([view, label]) => {
        const active = tab === 'calendar' && calendarView === view;
        return `<button type="button" class="${kind === 'side' ? 'nav-button' : 'mobile-tab'} ${active ? 'active' : ''}" data-action="calendar-view" data-view="${view}" aria-current="${active ? 'page' : 'false'}" aria-label="Vista de calendari: ${label}">${icon('calendar-' + view, 20)}<span>${label}</span></button>`;
    }).join('');
}
function calendarNavigation() {
    if (calendarView === 'year')
        return '';
    if (calendarView === 'month') {
        return `<header class="calendar-sticky-bar" aria-label="Dies de la setmana"><div class="weekdays"><span class="month-week-heading" title="Número de setmana ISO">Setm.</span>${weekdays.map(d => `<span>${d}</span>`).join('')}</div></header>`;
    }
    const dayOff = calendarView === 'day' && state.preferences.mePerson && workSchedule.isDayOff(state, selectedDate);
    return `<header class="calendar-sticky-bar" aria-label="Títol del calendari"><div class="calendar-toolbar"><div class="calendar-title"${isCurrentPeriod() ? ' data-current-period' : ''}${dayOff ? ' data-day-off' : ''}>${escapeHtml(periodTitle())}</div></div></header>`;
}
function isCurrentPeriod() {
    const todayDate = localDate(new Date());
    return calendarView === 'week' ? weekStart(selectedDate) === weekStart(todayDate) : selectedDate === todayDate;
}
function calendarControls() {
    const children = activeChildren();
    const showHolyWeek = state.preferences.showHolyWeek && (calendarView === 'year' || calendarView === 'month');
    const filtered = showHolyWeek || children.length !== state.children.length || state.preferences.visibleGuardians.length !== state.guardians.length || state.preferences.visibleSchools.length > 0 || Boolean(state.personTimeOff && personalTimeOff.filtered(state));
    return `<nav class="calendar-controls" aria-label="Controls del calendari"><div class="calendar-tools"><button class="filter-button" data-action="open-filters" aria-label="Filtres del calendari">${icon('filter', 18)}<span class="filter-copy">Filtres</span>${filtered ? '<span class="filter-dot"></span>' : ''}</button><button type="button" class="filter-button legend-panel-button" data-action="open-legend" aria-label="Llegenda del calendari" aria-haspopup="dialog" aria-expanded="${sheet?.type === 'legend'}" title="Llegenda">${icon('info', 18)}</button>${calendarView === 'day' ? `<button type="button" class="filter-button edit-panel-button" data-action="open-day-edit" aria-label="Edita el dia" aria-haspopup="dialog" aria-expanded="${sheet?.type === 'dayEdit'}" title="Edita el dia">${icon('pencil', 18)}</button>` : ''}${calendarView === 'day' || calendarView === 'week' ? `<button type="button" class="filter-button zoom-panel-button" data-action="open-zoom" aria-label="Zoom de les hores" aria-haspopup="dialog" aria-expanded="${sheet?.type === 'zoom'}" title="Zoom: ${timelineZoomForView()}%">${icon('zoom', 18)}</button>` : ''}</div><div class="calendar-nav calendar-period-nav"><button class="btn-icon" data-action="calendar-navigate" data-step="-1" aria-label="${calendarView === 'year' ? 'Any anterior' : calendarView === 'month' ? 'Mes anterior' : calendarView === 'week' ? 'Setmana anterior' : 'Dia anterior'}">${icon('chevronLeft', 18)}</button><button class="soft-btn" data-action="today">Avui</button><button class="btn-icon" data-action="calendar-navigate" data-step="1" aria-label="${calendarView === 'year' ? 'Any següent' : calendarView === 'month' ? 'Mes següent' : calendarView === 'week' ? 'Setmana següent' : 'Dia següent'}">${icon('chevronRight', 18)}</button></div></nav>`;
}
function layout(content) {
    return `<div class="app-layout ${tab === 'calendar' ? 'calendar-layout' : ''}${tab === 'calendar' && calendarView === 'week' ? ' calendar-week-layout' : ''}${tab === 'calendar' && calendarView === 'day' ? ' calendar-day-layout' : ''}"><aside class="sidebar">
  <div class="brand"><span class="brand-mark">${icon('home', 22)}</span><span><div class="brand-name">Calendari<br>Familiar</div><div class="brand-caption">El teu espai familiar</div></span></div>
  <nav class="side-nav" aria-label="Navegació">${calendarViewButtons('side')}${navButton('settings', 'Configuració', 'settings', 'side')}</nav>
  <p class="side-foot">${icon('shield', 17)}<br><strong>Les dades són teves.</strong><br>Tot queda al teu dispositiu.</p>
  </aside>${tab === 'calendar' ? calendarControls() + calendarNavigation() : ''}<main class="main-area"><div class="content">${tab !== 'calendar' && tab !== 'settings' ? `<nav aria-label="Torna a configuració"><button type="button" class="school-breadcrumb settings-back" data-action="tab" data-tab="settings">${icon('chevronLeft', 17)} Configuració</button></nav>` : ''}${content}</div></main>
  <nav class="mobile-tabs" aria-label="Navegació principal">${calendarViewButtons('mobile')}${navButton('settings', 'Configuració', 'settings', 'mobile')}</nav></div>${sheet ? sheetMarkup() : ''}<div id="toast-region" aria-live="polite"></div>`;
}
function monthPanel(index, children, today) {
    const year = Math.floor(index / 12), month = index - year * 12;
    const firstDay = (new Date(year, month, 1, 12).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStart = localDate(new Date(year, month, 1, 12)), monthEnd = localDate(new Date(year, month, daysInMonth, 12));
    const outlineEntries = state.personTimeOff || state.preferences?.showHolyWeek ? personalTimeOff.calendarEntries(state, year, monthStart, monthEnd) : [];
    const starting = localDate(new Date(year, month, 1 - firstDay, 12));
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const cells = Array.from({ length: totalCells }, (_, offset) => {
        const date = addDays(starting, offset), d = parseDate(date), i = offset;
        const iso = offset % 7 === 0 ? monthDayUI.isoWeek(date) : null;
        const weekButton = iso ? `<button type="button" class="month-week-number" data-action="show-calendar-week" data-date="${date}" title="Setmana ${iso.week} de ${iso.year}" aria-label="Mostra la setmana ${iso.week} de ${iso.year}, del ${date} al ${addDays(date, 6)}">${iso.week}</button>` : '';
        // Els espais dels altres mesos només alineen els dies: no repeteixen cap data ni assignació.
        if (offset < firstDay || offset >= firstDay + daysInMonth)
            return `${weekButton}<span class="month-empty-cell" aria-hidden="true"></span>`;
        const personalMarks = outlineEntries.length ? personalTimeOff.marks(outlineEntries, date, monthStart, monthEnd) : { html: '', label: '' };
        const monthEdges = monthDayUI.outline(date, year, month, i, totalCells, daysInMonth);
        const changed = monthDayUI.hasChanges(state, date);
        const bdays = birthdays(date).filter(c => children.some(child => child.id === c.id));
        const snapshot = monthData(date, children), schoolCount = snapshot.activities.length;
        return `${weekButton}<button type="button" class="day-cell ${date === today ? 'today' : ''} ${monthEdges}" data-action="show-calendar-day" data-date="${date}" ${date === today ? 'aria-current="date"' : ''} aria-label="${escapeHtml(fullDate(date))}. ${personalMarks.label ? escapeHtml(personalMarks.label) + '. ' : ''}${schoolCount ? schoolCount + ' activitats escolars. ' : ''}Obre la vista Dia.">
        <span class="day-top"><span class="day-number${state.preferences?.mePerson && workSchedule.isDayOff(state, date) ? ' is-day-off' : ''}">${d.getDate()}</span>${changed ? '<span class="change-dot" title="Canvi puntual"></span>' : ''}</span>
        ${monthDayUI.mini(children, snapshot.nights, snapshot.activities, snapshot.slots, snapshot.extra)}
        ${bdays.length ? '<span class="mini-birthday" title="Aniversari">Aniv.</span>' : ''}${personalMarks.html}
      </button>`;
    });
    return `<section class="month-panel" data-month-index="${index}" aria-label="${escapeHtml(monthTitle(year, month))}"><h2 class="month-section-title">${escapeHtml(monthTitle(year, month))}</h2><div class="month-grid">${cells.join('')}</div></section>`;
}
// Keep loaded months and years in place: removing earlier panels rebases the scroll range
// and can make Safari jump during momentum. Only prepend after scrolling stops.
function monthPosition() {
    const annual = calendarView === 'year';
    const sequence = $app.querySelector(annual ? '.year-sequence' : '.month-sequence');
    const bar = $app.querySelector(annual ? '.calendar-controls' : '.calendar-sticky-bar');
    if (!sequence || !bar)
        return null;
    const panels = Array.from(sequence.querySelectorAll(annual ? '.year-panel' : '.month-panel'));
    const top = bar.getBoundingClientRect().bottom;
    const panel = panels.find(el => el.getBoundingClientRect().bottom > top + 1) ?? panels.at(-1);
    const cell = panel ? Array.from(panel.querySelectorAll(annual ? '.year-month' : '.day-cell')).find(el => el.getBoundingClientRect().bottom > top + 1) : null;
    return panel ? { index: Number(annual ? panel.dataset.yearIndex : panel.dataset.monthIndex), top: panel.getBoundingClientRect().top, date: annual ? cell?.dataset.focusDate : cell?.dataset.date } : null;
}
/** Sis setmanes caben entre la barra superior i el límit visible del calendari. */
function fitMonthRows(main, sequence, bar, mobile) {
    const bottom = mobile ? main.getBoundingClientRect().bottom : window.innerHeight;
    const available = bottom - bar.getBoundingClientRect().bottom;
    if (!sequence.style || !Number.isFinite(available) || available <= 7)
        return false;
    // Vora superior, cinc separadors i 1 px per al perímetre inferior.
    const height = String(Math.floor((available - 7) / 6)) + 'px';
    if (sequence.style.getPropertyValue('--month-week-height') === height)
        return false;
    sequence.style.setProperty('--month-week-height', height);
    return true;
}
function mountCalendarScroll(position, resetScroll = false) {
    if (resetScroll && !window.matchMedia('(max-width:900px)').matches)
        window.scrollTo(0, 0);
    if (tab !== 'calendar' || (calendarView !== 'month' && calendarView !== 'year'))
        return;
    const annual = calendarView === 'year';
    const main = $app.querySelector('.main-area');
    const sequence = $app.querySelector(annual ? '.year-sequence' : '.month-sequence');
    const bar = $app.querySelector(annual ? '.calendar-controls' : '.calendar-sticky-bar');
    const mobile = () => window.matchMedia('(max-width:900px)').matches;
    const panelSelector = (index) => `[data-${annual ? 'year' : 'month'}-index="${index}"]`;
    if (!annual)
        fitMonthRows(main, sequence, bar, mobile());
    const shift = (delta) => { if (mobile())
        main.scrollTop += delta;
    else
        window.scrollBy(0, delta); };
    const restore = (anchor) => {
        const el = sequence.querySelector(panelSelector(anchor.index));
        if (el)
            shift(el.getBoundingClientRect().top - anchor.top);
    };
    if (monthScrollTarget || !position) {
        const target = sequence.querySelector(panelSelector(annual ? viewYear : viewYear * 12 + viewMonth));
        if (target) {
            // La barra queda fora del contenidor desplaçable: el límit visible és la seva vora inferior.
            const top = bar.getBoundingClientRect().bottom;
            const currentMonth = annual ? target.querySelector('.year-month.current-month') : null;
            const start = currentMonth ?? target;
            shift(start.getBoundingClientRect().top - top);
        }
    }
    else
        restore(position);
    monthScrollTarget = false;
    let frame = 0, settleFrame = 0, idleTimer, touching = false, disposed = false, revision = 0, correctedScroll;
    const nativeScrollEnd = 'onscrollend' in (mobile() ? main : window);
    const scrollTop = () => mobile() ? main.scrollTop : window.scrollY;
    const refresh = () => {
        frame = 0;
        if (disposed || !sequence.isConnected)
            return;
        const anchor = monthPosition();
        if (!anchor)
            return;
        viewYear = annual ? anchor.index : Math.floor(anchor.index / 12);
        viewMonth = annual ? (anchor.date ? parseDate(anchor.date).getMonth() : viewMonth) : anchor.index - viewYear * 12;
        const selected = parseDate(selectedDate);
        if (selected.getFullYear() !== viewYear || selected.getMonth() !== viewMonth)
            selectedDate = localDate(new Date(viewYear, viewMonth, 1, 12));
    };
    const extendMonths = () => {
        idleTimer = undefined;
        if (disposed || touching || !sequence.isConnected)
            return;
        const anchor = monthPosition();
        if (!anchor)
            return;
        const first = sequence.firstElementChild, last = sequence.lastElementChild;
        const top = bar.getBoundingClientRect().bottom;
        const bottom = mobile() ? main.getBoundingClientRect().bottom : window.innerHeight;
        let firstIndex = Number(annual ? first.dataset.yearIndex : first.dataset.monthIndex), lastIndex = Number(annual ? last.dataset.yearIndex : last.dataset.monthIndex), changed = false;
        const children = activeChildren(), today = localDate(new Date());
        if (first.getBoundingClientRect().top > top - 700) {
            if (annual) {
                if (firstIndex > 100) {
                    sequence.insertAdjacentHTML('afterbegin', yearPanel(firstIndex - 1, children, today));
                    firstIndex--;
                    changed = true;
                }
            }
            else {
                sequence.insertAdjacentHTML('afterbegin', monthPanel(firstIndex - 2, children, today) + monthPanel(firstIndex - 1, children, today));
                firstIndex -= 2;
                changed = true;
            }
        }
        if (last.getBoundingClientRect().bottom < bottom + 700) {
            if (annual) {
                if (lastIndex < 9999) {
                    sequence.insertAdjacentHTML('beforeend', yearPanel(lastIndex + 1, children, today));
                    lastIndex++;
                    changed = true;
                }
            }
            else {
                sequence.insertAdjacentHTML('beforeend', monthPanel(lastIndex + 1, children, today) + monthPanel(lastIndex + 2, children, today));
                lastIndex += 2;
                changed = true;
            }
        }
        if (annual)
            yearRange = { first: firstIndex, last: lastIndex };
        else
            monthRange = { first: firstIndex, last: lastIndex };
        // Safari pot accelerar o interrompre la inèrcia si escrivim scrollTop durant el gest.
        // Només compensem els mesos nous afegits abans del punt visible, ja en repòs.
        if (changed) {
            const el = sequence.querySelector(panelSelector(anchor.index));
            const delta = el ? el.getBoundingClientRect().top - anchor.top : 0;
            if (Math.abs(delta) > .5) {
                shift(delta);
                correctedScroll = scrollTop();
            }
        }
    };
    const cancelSettle = () => {
        revision++;
        window.clearTimeout(idleTimer);
        window.cancelAnimationFrame(settleFrame);
        settleFrame = 0;
    };
    const settle = () => {
        cancelSettle();
        if (disposed || touching || !sequence.isConnected)
            return;
        const version = revision, at = scrollTop();
        // El scroll compositat d’iOS pot arribar tard al fil principal. Comprovem
        // dues pintades sense moviment abans d’afegir contingut o compensar píxels.
        settleFrame = window.requestAnimationFrame(() => {
            settleFrame = 0;
            if (disposed || touching || version !== revision || Math.abs(scrollTop() - at) > .5)
                return;
            settleFrame = window.requestAnimationFrame(() => {
                settleFrame = 0;
                if (disposed || touching || version !== revision || Math.abs(scrollTop() - at) > .5)
                    return;
                extendMonths();
            });
        });
    };
    const scheduleIdle = () => {
        cancelSettle();
        // Amb scrollend esperem el final nadiu de la inèrcia, no un silenci temporal
        // entre esdeveniments. El temporitzador és només per a navegadors anteriors.
        if (!nativeScrollEnd && !touching && !disposed)
            idleTimer = window.setTimeout(settle, 400);
    };
    const schedule = () => {
        if (disposed)
            return;
        // La correcció de píxels produeix un altre esdeveniment scroll: no és un nou gest.
        if (correctedScroll !== undefined && Math.abs(scrollTop() - correctedScroll) < 1) {
            correctedScroll = undefined;
            return;
        }
        correctedScroll = undefined;
        if (!frame)
            frame = window.requestAnimationFrame(refresh);
        scheduleIdle();
    };
    const touchStart = () => { touching = true; cancelSettle(); };
    const touchEnd = () => { touching = false; scheduleIdle(); };
    main.addEventListener('scroll', schedule, { passive: true });
    main.addEventListener('scrollend', settle, { passive: true });
    main.addEventListener('touchstart', touchStart, { passive: true });
    main.addEventListener('touchend', touchEnd, { passive: true });
    main.addEventListener('touchcancel', touchEnd, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scrollend', settle, { passive: true });
    const resize = () => {
        const anchor = monthPosition();
        if (!annual && fitMonthRows(main, sequence, bar, mobile()) && anchor)
            restore(anchor);
        schedule();
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    stopCalendarScroll = () => {
        disposed = true;
        cancelSettle();
        main.removeEventListener('scroll', schedule);
        main.removeEventListener('scrollend', settle);
        main.removeEventListener('touchstart', touchStart);
        main.removeEventListener('touchend', touchEnd);
        main.removeEventListener('touchcancel', touchEnd);
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('scrollend', settle);
        window.removeEventListener('resize', resize);
        window.visualViewport?.removeEventListener('resize', resize);
        window.cancelAnimationFrame(frame);
    };
    schedule();
}
function zoomControls() {
    const zoom = timelineZoomForView(), zoomIndex = TIMELINE_ZOOM_LEVELS.indexOf(zoom);
    return `<div class="timeline-zoom-toolbar zoom-sheet-controls" role="group" aria-label="Zoom vertical de les hores">
      <label for="timeline-zoom">Escala horària</label>
      <button type="button" class="timeline-zoom-button" data-action="timeline-zoom-step" data-step="-1" aria-label="Allunya el zoom per veure més hores" ${zoomIndex === 0 ? 'disabled' : ''}>−</button>
      <input id="timeline-zoom" data-action="timeline-zoom" type="range" min="0" max="5" step="1" value="${zoomIndex}" aria-label="Zoom de la línia temporal" aria-valuetext="${zoom} per cent" />
      <button type="button" class="timeline-zoom-button" data-action="timeline-zoom-step" data-step="1" aria-label="Apropa el zoom per veure més detall" ${zoomIndex === TIMELINE_ZOOM_LEVELS.length - 1 ? 'disabled' : ''}>+</button>
      <output id="timeline-zoom-value" for="timeline-zoom" aria-live="polite">${zoom}%</output>
    </div>`;
}
function yearOverview(year, children, today) {
    const outlineEntries = state.personTimeOff || state.preferences?.showHolyWeek ? personalTimeOff.calendarEntries(state, year, localDate(new Date(year, 0, 1, 12)), localDate(new Date(year, 11, 31, 12))) : [];
    return `<div class="year-overview" aria-label="Calendari anual ${year}">${months.map((name, month) => {
        const firstDay = (new Date(year, month, 1, 12).getDay() + 6) % 7, count = new Date(year, month + 1, 0).getDate();
        const monthStart = localDate(new Date(year, month, 1, 12)), monthEnd = localDate(new Date(year, month, count, 12));
        const cells = Array.from({ length: 42 }, (_, index) => {
            const day = index - firstDay + 1;
            if (day < 1 || day > count)
                return '<span class="year-empty-day"></span>';
            const date = localDate(new Date(year, month, day, 12)), snapshot = monthData(date, children);
            const marks = outlineEntries.length ? personalTimeOff.marks(outlineEntries, date, monthStart, monthEnd) : { html: '', label: '' };
            return `<span class="year-day ${date === today ? 'today' : ''}" data-year-date="${date}" ${date === today ? 'aria-current="date"' : ''} ${marks.label ? `title="${escapeHtml(fullDate(date) + '. ' + marks.label)}"` : ''}><span class="year-day-number${state.preferences?.mePerson && workSchedule.isDayOff(state, date) ? ' is-day-off' : ''}">${day}</span>${monthDayUI.mini(children, snapshot.nights, snapshot.activities, snapshot.slots, snapshot.extra, 'year')}${marks.html}</span>`;
        }).join('');
        return `<button type="button" class="year-month${today >= monthStart && today <= monthEnd ? ' current-month' : ''}" data-action="show-calendar-month" data-year="${year}" data-month="${month}" data-focus-date="${monthStart}" aria-label="Obre ${escapeHtml(name)} de ${year}"><span class="year-month-title">${escapeHtml(name)}</span><span class="year-days" aria-hidden="true">${cells}</span></button>`;
    }).join('')}</div>`;
}
function yearPanel(year, children, today) {
    const current = year === Number(today.slice(0, 4));
    return `<section class="year-panel" data-year-index="${year}" aria-label="Any ${year}"><h2 class="year-section-title"${current ? ' data-current-period' : ''}>${year}</h2>${yearOverview(year, children, today)}</section>`;
}
function calendarLegend() {
    const showOutlines = calendarView === 'year' || calendarView === 'month';
    const personalLegend = showOutlines && state.personTimeOff ? personalTimeOff.legendMarkup(state) : '';
    const holyWeekLegend = showOutlines && state.preferences.showHolyWeek ? '<span class="legend-entry"><span class="personal-legend holy-week" aria-hidden="true"></span>Setmana Santa</span>' : '';
    return `<div class="legend">${state.schools.filter(s => state.preferences.visibleSchools.includes(s.id)).map(s => `<span class="legend-entry"><span class="legend-color" style="background:${s.color}"></span>${escapeHtml(s.name)}</span>`).join('')}${state.guardians.filter(g => state.preferences.visibleGuardians.includes(g.id)).map(g => `<span class="legend-entry"><span class="legend-color" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>`).join('')}${personalLegend}${holyWeekLegend}<span class="legend-entry"><span class="legend-color legend-empty"></span>Sense assignar</span></div>`;
}
function calendarPage() {
    const today = localDate(new Date()), children = activeChildren();
    let content = '';
    if (calendarView === 'year') {
        if (monthScrollTarget || !yearRange || viewYear < yearRange.first || viewYear > yearRange.last)
            yearRange = { first: Math.max(100, viewYear - 1), last: Math.min(9999, viewYear + 1) };
        return `<div class="year-sequence">${Array.from({ length: yearRange.last - yearRange.first + 1 }, (_, i) => yearPanel(yearRange.first + i, children, today)).join('')}</div>`;
    }
    else if (calendarView === 'month') {
        const index = viewYear * 12 + viewMonth;
        if (monthScrollTarget || !monthRange || index <= monthRange.first || index >= monthRange.last)
            monthRange = { first: index - 3, last: index + 3 };
        content = `${!state.children.length ? `<div class="calendar-empty-state"><p>El calendari encara no té fills.</p><button class="secondary-btn" data-action="tab" data-tab="people">Afegeix un fill</button></div>` : ''}<div class="month-sequence">${Array.from({ length: monthRange.last - monthRange.first + 1 }, (_, i) => monthPanel(monthRange.first + i, children, today)).join('')}</div>`;
    }
    else if (calendarView === 'week') {
        return weekTimeline(weekStart(selectedDate), children);
    }
    else {
        return dayTimeline(selectedDate, children);
    }
    return `<section class="calendar-card" aria-label="Calendari familiar">
    ${content}
    </section>`;
}
function rotationPage() {
    return `<header class="page-heading"><div><div class="eyebrow">ORGANITZACIÓ</div><h1 class="page-title">Rotacions</h1><p class="page-subtitle">Patrons opcionals de pernocta i altres franges, amb dates i fills propis.</p></div></header>
  ${!state.children.length ? `<section class="card"><p class="settings-note">Afegeix fills a Persones per seleccionar a qui s’aplica cada rotació.</p><button class="secondary-btn" data-action="tab" data-tab="people">Ves a Persones</button></section>` : ''}
  ${rotationEditor.render(rotationEditor.draftState(state, extraRotationDrafts), extraRotationOpen, extraRotationUnits)}`;
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
function schoolMembershipPanel(school) {
    const base = `data-school="${escapeHtml(school.id)}"`;
    return `<section class="card"><h2 class="section-title">Fills associats a l’escola</h2>
    <p class="section-description">Associa els fills a l’escola sense necessitat de crear grups. Les hores de jornada s’estableixen a cada curs.</p>
    ${state.children.map(c => { const chosen = school.childIds.includes(c.id); return `<button type="button" class="school-child-choice ${chosen ? 'selected' : ''}" data-action="school-membership-toggle" ${base} data-child="${escapeHtml(c.id)}" aria-pressed="${chosen}"><span>${escapeHtml(c.name)}</span>${chosen ? icon('check', 18) : icon('plus', 17)}</button>`; }).join('')}
  </section>`;
}
function schoolSchedulePanel(school, year, group) {
    const entries = [...group.weeklySchedule].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    const base = `data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}"`;
    return `<section class="card">
    <div class="panel-header"><h2 class="section-title">Activitats del grup</h2><button class="secondary-btn" data-action="schedule-add" ${base}>${icon('plus', 14)} Activitat</button></div>
    <p class="section-description">Les hores d’inici i final de la jornada ordinària es defineixen al curs. Cada grup pot tenir activitats diferents i a hores diferents, dins d’aquest interval. No hi ha horaris ordinaris diferents per fill.</p>
    ${!year.ordinaryWindow ? '<p class="school-schedule-notice">Configura les hores de jornada ordinària al curs abans d’afegir activitats noves.</p>' : ''}
    ${entries.length ? entries.map(a => `<div class="school-schedule-row"><div><strong>${weekLong[a.weekday]}</strong> · ${a.startTime}–${a.endTime}<span class="school-meta">${SESSION_KIND_NAMES[sessionKind(a.kind)]}${a.label ? ` · ${escapeHtml(a.label)}` : ''}</span></div><div class="school-schedule-actions"><button class="school-schedule-edit" data-action="schedule-edit" ${base} data-session="${escapeHtml(a.id)}" aria-label="Edita l’activitat">${icon('pencil', 15)}</button><button class="delete-icon" data-action="schedule-delete" ${base} data-session="${escapeHtml(a.id)}" aria-label="Suprimeix l’activitat">${icon('trash', 15)}</button></div></div>`).join('') : '<p class="settings-note">Aquest grup encara no té activitats afegides. S’aplica l’horari general de l’escola.</p>'}
  </section>`;
}
function scheduleEntriesForEdit(group, childId, mode) {
    if (childId)
        return undefined; // Els horaris individuals antics són de lectura, però no es poden continuar editant.
    return mode === 'reduced' ? (group.reducedWeeklySchedule ?? []) : group.weeklySchedule;
}
function schoolReducedPanel(school, year, group) {
    const sessions = [...(group.reducedWeeklySchedule ?? [])].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
    const base = `data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}" data-mode="reduced"`;
    return `<section class="card">
    <div class="panel-header"><h2 class="section-title">Activitats en jornada reduïda</h2>${year.reducedWindow ? `<button class="secondary-btn" data-action="schedule-add" ${base}>${icon('plus', 14)} Activitat</button>` : ''}</div>
    <p class="section-description">Defineix les activitats d’aquest grup i les hores de cadascuna per als dies marcats com a jornada reduïda al curs. Poden ser diferents de les activitats dels dies ordinaris.</p>
    ${year.reducedWindow ? `<p class="settings-note">Límit horari del curs: <strong>${year.reducedWindow.startTime}–${year.reducedWindow.endTime}</strong>. Les activitats s’apliquen només als dies de jornada reduïda i segons el dia de la setmana.</p>
    ${sessions.length ? sessions.map(a => `<div class="school-schedule-row"><div><strong>${weekLong[a.weekday]}</strong> · ${a.startTime}–${a.endTime}<span class="school-meta">${SESSION_KIND_NAMES[sessionKind(a.kind)]}${a.label ? ` · ${escapeHtml(a.label)}` : ''}</span></div><div class="school-schedule-actions"><button class="school-schedule-edit" data-action="schedule-edit" ${base} data-session="${escapeHtml(a.id)}" aria-label="Edita l’activitat de jornada reduïda">${icon('pencil', 15)}</button><button class="delete-icon" data-action="schedule-delete" ${base} data-session="${escapeHtml(a.id)}" aria-label="Suprimeix l’activitat de jornada reduïda">${icon('trash', 15)}</button></div></div>`).join('') + `<div class="action-row"><button class="soft-btn" data-action="schedule-inherit" ${base}>Esborra totes les activitats reduïdes</button></div>` : '<p class="settings-note">Encara no hi ha activitats específiques de jornada reduïda. Pots afegir-ne amb el botó «Activitat». Al calendari es continua indicant la jornada escolar dins de les hores reduïdes.</p>'}` :
        `<div class="school-schedule-notice">Configura primer les hores de jornada reduïda al curs. <button class="secondary-btn" data-action="reduced-window-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">Configura les hores</button></div>`}
  </section>`;
}
function schoolsPage() {
    const school = schoolById(schoolNav.schoolId), year = yearById(school, schoolNav.yearId), group = groupById(year, schoolNav.groupId);
    if (!school)
        return `<header class="page-heading"><div><div class="eyebrow">VIDA ESCOLAR</div><h1 class="page-title">Escoles</h1><p class="page-subtitle">Escoles, cursos i grups dels fills.</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Les escoles</h2><button class="secondary-btn" data-action="school-add">${icon('plus', 15)} Afegir escola</button></div>
 <p class="section-description">Cada escola pot tenir diferents cursos, grups classe, festius i dies d’horari reduït. Les dades són privades i es desen al teu dispositiu.</p>
 ${state.schools.length ? state.schools.map(s => `<div class="school-row"><span class="school-color-dot" style="background:${s.color}" aria-hidden="true"></span>${schoolNavButton(s.name, { schoolId: s.id })}<span class="school-meta">${s.years.length} ${s.years.length === 1 ? 'curs' : 'cursos'}</span></div>`).join('') : '<div class="empty-state">Encara no has afegit cap escola. Afegeix-ne una per començar.</div>'}</section>`;
    if (!year)
        return `<header class="page-heading"><div>${schoolCrumb('Escoles')}<div class="eyebrow">ESCOLA</div><h1 class="page-title">${escapeHtml(school.name)}</h1><p class="page-subtitle">${escapeHtml(school.address || 'Adreça no indicada')}${school.phone ? ` · ${escapeHtml(school.phone)}` : ''}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Dades de l’escola</h2><button class="secondary-btn" data-action="school-edit" data-school="${escapeHtml(school.id)}">${icon('pencil', 15)} Edita</button></div>
 <div class="school-details"><p><span class="school-color-dot" style="background:${school.color}"></span><strong>Color de l’escola</strong></p>${school.address ? `<p><strong>Adreça:</strong> ${escapeHtml(school.address)}</p>` : ''}${school.phone ? `<p><strong>Telèfon:</strong> <a href="tel:${escapeHtml(school.phone.replace(/[^+\d]/g, ''))}">${escapeHtml(school.phone)}</a></p>` : ''}${!school.address && !school.phone ? '<p class="settings-note">Sense adreça ni telèfon.</p>' : ''}</div>
 <div class="action-row"><button class="danger-btn" data-action="school-delete" data-school="${escapeHtml(school.id)}">Suprimeix l’escola</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Cursos escolars</h2><button class="secondary-btn" data-action="year-add" data-school="${escapeHtml(school.id)}">${icon('plus', 15)} Afegir curs</button></div>
 ${school.years.length ? [...school.years].sort((a, b) => b.startDate.localeCompare(a.startDate)).map(y => `<div class="school-row">${schoolNavButton(schoolYearName(y), { schoolId: school.id, yearId: y.id })}<span class="school-meta">${shortDate(y.startDate)} – ${shortDate(y.endDate)}</span></div>`).join('') : '<div class="empty-state">Afegeix un curs escolar indicant les dates d’inici i final.</div>'}</section>${schoolMembershipPanel(school)}`;
    if (!group)
        return `<header class="page-heading"><div>${schoolCrumb(school.name, { schoolId: school.id })}<div class="eyebrow">${escapeHtml(school.name)}</div><h1 class="page-title">${schoolYearName(year)}</h1><p class="page-subtitle">Del ${shortDate(year.startDate)} al ${shortDate(year.endDate)}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Calendari escolar</h2><button class="soft-btn" data-action="year-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil', 14)} Dates</button></div>
 <p class="section-description">Els festius, les vacances i els dies d’horari reduït han d’estar compresos dins del curs. Són dates concretes i no es repeteixen automàticament.</p>
 <div class="school-period"><div class="panel-header"><strong>Dies festius (${year.holidays.length})</strong><button class="secondary-btn" data-action="school-day-add" data-kind="holiday" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('calendar', 14)} Tria dies</button></div>
 ${year.holidays.length ? `<div class="school-day-list">${year.holidays.map(d => `<span class="school-day-pill">${shortDate(d)} <button type="button" data-action="school-day-delete" data-kind="holiday" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-date="${d}" aria-label="Suprimeix el festiu ${d}">${icon('close', 13)}</button></span>`).join('')}</div>` : '<p class="settings-note">No hi ha dies festius.</p>'}</div>
 <div class="school-period"><div class="panel-header"><strong>Vacances escolars (${(year.vacations ?? []).length})</strong><button class="secondary-btn" data-action="school-vacation-add" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus', 14)} Període</button></div>
 ${(year.vacations ?? []).length ? [...(year.vacations ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(period => `<div class="school-schedule-row"><div><strong>${escapeHtml(period.name)}</strong><span class="school-meta">${shortDate(period.startDate)} – ${shortDate(period.endDate)}</span></div><div class="school-schedule-actions"><button type="button" class="school-schedule-edit" data-action="school-vacation-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-vacation="${escapeHtml(period.id)}" aria-label="Edita ${escapeHtml(period.name)}">${icon('pencil', 15)}</button><button type="button" class="delete-icon" data-action="school-vacation-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-vacation="${escapeHtml(period.id)}" aria-label="Suprimeix ${escapeHtml(period.name)}">${icon('trash', 15)}</button></div></div>`).join('') : '<p class="settings-note">Afegeix les vacances indicant-ne el nom i les dates d’inici i final.</p>'}</div>
 <div class="school-period"><div class="panel-header"><strong>Horari reduït (${year.reducedDays.length})</strong><button class="secondary-btn" data-action="school-day-add" data-kind="reduced" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('calendar', 14)} Tria dies</button></div>
 ${year.reducedDays.length ? `<div class="school-day-list">${year.reducedDays.map(d => `<span class="school-day-pill reduced">${shortDate(d)} <button type="button" data-action="school-day-delete" data-kind="reduced" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-date="${d}" aria-label="Suprimeix l’horari reduït ${d}">${icon('close', 13)}</button></span>`).join('')}</div>` : '<p class="settings-note">No hi ha dies d’horari reduït.</p>'}</div>
 <div class="school-period"><div class="panel-header"><strong>Hores de jornada ordinària</strong><button class="secondary-btn" data-action="ordinary-window-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil', 14)} ${year.ordinaryWindow ? 'Edita' : 'Configura'}</button></div>
  <p class="settings-note">${year.ordinaryWindow ? `De ${year.ordinaryWindow.startTime} a ${year.ordinaryWindow.endTime}. Aquestes hores delimiten la jornada normal dels dies lectius del curs. Les activitats són pròpies de cada grup.` : "Encara no s’han especificat les hores de jornada ordinària d’aquest curs."}</p></div>
  <div class="school-period"><div class="panel-header"><strong>Hores de jornada reduïda</strong><button class="secondary-btn" data-action="reduced-window-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil', 14)} ${year.reducedWindow ? 'Edita' : 'Configura'}</button></div>
 <p class="settings-note">${year.reducedWindow ? `De ${year.reducedWindow.startTime} a ${year.reducedWindow.endTime}. Aquestes hores s'apliquen a tots els dies reduïts del curs.` : "Encara no s'han especificat les hores de jornada reduïda; no se'n calcula un horari fins que les configuris."}</p></div>
 <div class="action-row"><button class="danger-btn" data-action="year-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">Suprimeix el curs</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Grups classe</h2><button class="secondary-btn" data-action="group-add" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus', 14)} Afegir grup</button></div>
 ${year.groups.length ? year.groups.map(g => `<div class="school-row">${schoolNavButton(g.name, { schoolId: school.id, yearId: year.id, groupId: g.id })}<span class="school-meta">${g.childIds.length} ${g.childIds.length === 1 ? 'fill' : 'fills'}${g.tutorName ? ` · ${escapeHtml(g.tutorName)}` : ''}</span></div>`).join('') : '<div class="empty-state">Encara no hi ha cap grup. Pots afegir-hi «Segon», «Sisè A» o qualsevol altre.</div>'}</section>`;
    const schedulePanel = schoolSchedulePanel(school, year, group);
    return `<header class="page-heading"><div>${schoolCrumb(schoolYearName(year), { schoolId: school.id, yearId: year.id })}<div class="eyebrow">${escapeHtml(school.name)} · ${schoolYearName(year)}</div><h1 class="page-title">${escapeHtml(group.name)}</h1><p class="page-subtitle">${group.tutorName ? `Tutor/a: ${escapeHtml(group.tutorName)}` : 'Tutor/a no especificat'}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Grup classe</h2><button class="secondary-btn" data-action="group-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">${icon('pencil', 15)} Edita</button></div>
 <div class="action-row"><button class="danger-btn" data-action="group-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">Suprimeix el grup</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Fills del grup</h2></div><p class="section-description">Selecciona els fills que pertanyen a aquest grup aquest curs. Un fill només pot estar en un grup del mateix curs i escola.</p>
 ${state.children.map(c => { const selected = group.childIds.includes(c.id), other = year.groups.find(g => g.id !== group.id && g.childIds.includes(c.id)); return `<button class="school-child-choice ${selected ? 'selected' : ''}" data-action="school-child-toggle" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}" data-child="${escapeHtml(c.id)}" aria-pressed="${selected}"><span>${escapeHtml(c.name)}${other ? `<small>Actualment a ${escapeHtml(other.name)}</small>` : ''}</span>${selected ? icon('check', 18) : icon('plus', 17)}</button>`; }).join('')}
 </section>${schedulePanel}${schoolReducedPanel(school, year, group)}`;
}
function schoolDayIsWeekend(date) {
    const day = parseDate(date).getDay();
    return day === 0 || day === 6;
}
function schoolDayUnavailableReason(year, kind, date) {
    if (!isValidDate(date) || date < year.startDate || date > year.endDate)
        return 'Fora del curs';
    if (schoolDayIsWeekend(date))
        return 'Cap de setmana';
    if (kind === 'holiday')
        return year.reducedDays.includes(date) ? 'Jornada reduïda' : '';
    if (year.holidays.includes(date))
        return 'Festiu';
    return year.vacations?.find(p => date >= p.startDate && date <= p.endDate)?.name ?? '';
}
function schoolDayCalendarMarkup(year, draft) {
    const first = draft.month + '-01', date = parseDate(first), offset = (date.getDay() + 6) % 7;
    const count = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const title = months[date.getMonth()] + ' ' + date.getFullYear(), selected = new Set(draft.dates);
    const cells = Array.from({ length: offset }, () => '<span aria-hidden="true"></span>');
    for (let day = 1; day <= count; day++) {
        const value = draft.month + '-' + String(day).padStart(2, '0'), reason = schoolDayUnavailableReason(year, draft.kind, value), pressed = selected.has(value);
        cells.push(`<button type="button" class="school-date-cell ${pressed ? 'selected' : ''}" data-action="school-day-toggle" data-date="${value}" aria-pressed="${pressed}" aria-label="${escapeHtml(fullDate(value) + (reason ? ' · ' + reason : ''))}" ${reason ? 'disabled' : ''}>${day}</button>`);
    }
    return `<div class="school-date-picker ${draft.kind}"><div class="school-date-nav"><button type="button" class="soft-btn" data-action="school-day-month" data-step="-1" aria-label="Mes anterior" ${draft.month <= year.startDate.slice(0, 7) ? 'disabled' : ''}>${icon('chevronLeft', 18)}</button><h3>${escapeHtml(title)}</h3><button type="button" class="soft-btn" data-action="school-day-month" data-step="1" aria-label="Mes següent" ${draft.month >= year.endDate.slice(0, 7) ? 'disabled' : ''}>${icon('chevronRight', 18)}</button></div>
 <div class="school-date-weekdays" aria-hidden="true">${weekdays.map(d => `<span>${d}</span>`).join('')}</div><div class="school-date-grid" role="group" aria-label="${escapeHtml(title)}">${cells.join('')}</div></div>`;
}
function schoolFormMarkup() {
    if (!sheet)
        return '';
    const heading = (title, subtitle) => `<div class="sheet-heading"><div><h2 class="sheet-title">${escapeHtml(title)}</h2><p class="sheet-subtitle">${escapeHtml(subtitle)}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>`;
    const field = (label, name, type, value, required = false, maxLength = 0) => `<div class="field"><label for="school-field-${name}">${escapeHtml(label)}</label><input id="school-field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${maxLength ? `maxlength="${maxLength}"` : ''} /></div>`;
    const actions = '<div class="action-row"><button class="primary-btn" type="submit">Desa</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button></div>';
    if (sheet.type === 'schoolForm') {
        const school = schoolById(sheet.schoolId);
        return heading(school ? 'Edita escola' : 'Afegeix escola', 'Nom obligatori; adreça i telèfon opcionals') + `<form data-school-form="school" data-school="${escapeHtml(school?.id ?? '')}"><div class="school-form-fields">${field('Nom de l’escola', 'name', 'text', school?.name ?? '', true, 100)}${field('Adreça (opcional)', 'address', 'text', school?.address ?? '', false, 200)}${field('Telèfon (opcional)', 'phone', 'tel', school?.phone ?? '', false, 50)}${field('Color de l’escola', 'color', 'color', school?.color ?? suggestedSchoolColor(state.schools), true)}</div>${actions}</form>`;
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
    if (sheet.type === 'schoolVacationForm') {
        const year = yearById(schoolById(sheet.schoolId), sheet.yearId);
        if (!year)
            return '';
        const vacationId = sheet.vacationId, period = year.vacations?.find(p => p.id === vacationId);
        if (sheet.vacationId && !period)
            return '';
        const today = localDate(new Date()), initial = today < year.startDate ? year.startDate : today > year.endDate ? year.endDate : today;
        return heading(period ? 'Edita vacances escolars' : 'Afegeix vacances escolars', schoolYearName(year)) + `<form data-school-form="vacation" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}" data-vacation="${escapeHtml(period?.id ?? '')}"><div class="school-form-fields">
    ${field('Nom del període', 'name', 'text', period?.name ?? '', true, 120)}
    <div class="form-row"><div class="field"><label for="vacation-start">Data d’inici</label><input id="vacation-start" name="startDate" type="date" min="${year.startDate}" max="${year.endDate}" value="${period?.startDate ?? initial}" required></div>
    <div class="field"><label for="vacation-end">Data de finalització</label><input id="vacation-end" name="endDate" type="date" min="${year.startDate}" max="${year.endDate}" value="${period?.endDate ?? initial}" required></div></div></div>
    <p class="settings-note">Pots indicar, per exemple, «Setmana Santa» o «Vacances de Nadal». Tots els dies de l’interval, inclosos l’inici i el final, seran festius escolars.</p>${actions}</form>`;
    }
    if (sheet.type === 'schoolDayForm') {
        const year = yearById(schoolById(sheet.schoolId), sheet.yearId);
        if (!year)
            return '';
        return heading(sheet.kind === 'holiday' ? 'Tria dies festius' : 'Tria dies de jornada reduïda', schoolYearName(year)) + `<form data-school-form="day" data-kind="${sheet.kind}" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}">
    <p class="settings-note">Toca els dies per marcar-los o desmarcar-los. Pots canviar de mes abans de desar. Els dissabtes i diumenges no es poden seleccionar.</p>
    ${schoolDayCalendarMarkup(year, sheet)}
    <p class="school-date-count" role="status">${sheet.dates.length} ${sheet.dates.length === 1 ? 'dia seleccionat' : 'dies seleccionats'}</p>
    <p class="settings-note">${sheet.kind === 'holiday' ? 'Els dies amb jornada reduïda no es poden marcar com a festius.' : 'Els festius i les vacances escolars no es poden marcar com a jornada reduïda.'}</p>
    <div class="action-row"><button class="primary-btn" type="submit">Desa els dies</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button></div></form>`;
    }
    if (sheet.type === 'reducedWindowForm') {
        const year = yearById(schoolById(sheet.schoolId), sheet.yearId);
        if (!year)
            return '';
        return heading('Hores de jornada reduïda', schoolYearName(year)) + `<form data-school-form="reducedWindow" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}"><div class="school-form-fields">
   <p class="settings-note">Introdueix les hores conegudes: l'aplicació no les assumeix. Els horaris ordinaris es retallaran a aquest interval sense modificar-ne els originals.</p>
   <div class="form-row">${field('Inici', 'startTime', 'time', year.reducedWindow?.startTime ?? '', true)}${field('Final', 'endTime', 'time', year.reducedWindow?.endTime ?? '', true)}</div>
   </div>${actions}</form>`;
    }
    if (sheet.type === 'ordinaryWindowForm') {
        const year = yearById(schoolById(sheet.schoolId), sheet.yearId);
        if (!year)
            return '';
        return heading('Hores de jornada ordinària', schoolYearName(year)) + `<form data-school-form="ordinaryWindow" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}"><div class="school-form-fields">
      <p class="settings-note">Indica l’hora d’entrada i la de sortida de l’escola els dies lectius normals. Les activitats concretes es defineixen a cada grup.</p>
      <div class="form-row">${field('Inici', 'startTime', 'time', year.ordinaryWindow?.startTime ?? '', true)}${field('Final', 'endTime', 'time', year.ordinaryWindow?.endTime ?? '', true)}</div>
    </div>${actions}</form>`;
    }
    if (sheet.type === 'scheduleForm') {
        const school = schoolById(sheet.schoolId), year = yearById(school, sheet.yearId), group = groupById(year, sheet.groupId);
        if (!group)
            return '';
        const childId = group.childIds.includes(sheet.childId ?? '') ? sheet.childId ?? '' : '';
        const mode = sheet.mode === 'reduced' ? 'reduced' : 'ordinary';
        const entries = scheduleEntriesForEdit(group, childId, mode);
        if (!entries)
            return '';
        const sessionId = sheet.sessionId;
        const reducedWindow = mode === 'reduced' ? year?.reducedWindow : undefined;
        const ordinaryWindow = mode === 'ordinary' ? year?.ordinaryWindow : undefined;
        if (mode === 'reduced' && !reducedWindow)
            return '';
        const session = entries.find(a => a.id === sessionId);
        const weekdaysInput = session
            ? `<div class="field"><label for="session-weekday">Dia de la setmana</label><select name="weekday" id="session-weekday">${weekLong.map((label, i) => `<option value="${i}" ${session.weekday === i ? 'selected' : ''}>${label}</option>`).join('')}</select></div>`
            : `<fieldset class="school-schedule-weekdays"><legend>Dies de la setmana</legend><div>${weekLong.map((label, i) => `<label><input type="checkbox" name="weekdays" value="${i}" ${i < 5 ? 'checked' : ''}/> ${label}</label>`).join('')}</div></fieldset>`;
        return heading(session ? 'Edita activitat' : 'Afegeix activitat', mode === 'reduced' ? 'Jornada reduïda · ' + group.name : group.name) + `<form data-school-form="schedule" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}" data-group="${escapeHtml(sheet.groupId)}" data-child="${escapeHtml(childId)}" data-session="${escapeHtml(session?.id ?? '')}" data-mode="${mode}"><div class="school-form-fields">
  ${weekdaysInput}
  <div class="form-row">${field('Inici', 'startTime', 'time', session?.startTime ?? reducedWindow?.startTime ?? ordinaryWindow?.startTime ?? '09:00', true)}${field('Final', 'endTime', 'time', session?.endTime ?? reducedWindow?.endTime ?? ordinaryWindow?.endTime ?? '13:00', true)}</div>
  <div class="field"><label for="session-kind">Tipus d'activitat</label><select name="kind" id="session-kind">${SESSION_KINDS.map(k => `<option value="${k}" ${sessionKind(session?.kind) === k ? 'selected' : ''}>${SESSION_KIND_NAMES[k]}</option>`).join('')}</select></div>
  ${field('Descripció (opcional)', 'label', 'text', session?.label ?? '', false, 80)}</div>
  <p class="settings-note">Les activitats del mateix grup i dia no es poden solapar. ${reducedWindow ? `Aquesta activitat només s’aplica als dies de jornada reduïda marcats al curs que coincideixin amb el dia de la setmana seleccionat. Ha de quedar entre les ${reducedWindow.startTime} i les ${reducedWindow.endTime}.` : 'L’activitat s’aplica als dies ordinaris del grup, dins de la jornada del curs.'}</p>${actions}</form>`;
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
            const vacations = (year.vacations ?? []).filter(p => date >= p.startDate && date <= p.endDate);
            const dayKind = vacations.length ? vacations.map(p => p.name).join(' · ') : year.holidays.includes(date) ? 'Festiu escolar' : year.reducedDays.includes(date) ? 'Horari reduït' : '';
            if (!dayKind)
                continue;
            const ids = [...new Set([...school.childIds, ...year.groups.flatMap(g => g.childIds)])];
            const enrolled = ids.map(id => childById(id)?.name).filter((name) => Boolean(name));
            if (enrolled.length)
                lines.push(`<div class="school-day-notice"><strong>${escapeHtml(dayKind)}</strong> · ${escapeHtml(school.name)} (${escapeHtml(enrolled.join(', '))})</div>`);
        }
    return lines.length ? `<div class="sheet-section-label">Informació escolar</div>${lines.join('')}` : '';
}
function personActions(key) {
    if (!personalTimeOff.person(state, key))
        return '';
    const me = state.preferences.mePerson === key;
    return `<div class="person-actions"><button class="soft-btn person-me ${me ? 'selected' : ''}" data-action="person-me" data-person="${escapeHtml(key)}" aria-pressed="${me}">${me ? icon('check', 15) : icon('person', 15)} ${me ? 'Jo' : 'Soc jo'}</button></div>`;
}
function peopleList(kind) {
    const entries = kind === 'child' ? state.children : state.guardians;
    const label = kind === 'child' ? 'Fills' : 'Tutors i responsables';
    if (!entries.length)
        return `<p class="settings-note">Encara no hi ha ${kind === 'child' ? 'fills' : 'tutors'}. Prem «Afegir» per començar.</p>`;
    return `<ol class="people-list" aria-label="${label}">${entries.map((person, index) => {
        const key = kind + ':' + person.id, me = state.preferences.mePerson === key;
        const avatar = 'color' in person ? `<span class="person-list-color" style="background:${person.color}" aria-hidden="true"></span>` : icon('person', 20);
        return `<li class="person-list-row"><button type="button" class="person-list-open" data-action="open-person" data-person="${escapeHtml(key)}" aria-label="Obre ${escapeHtml(person.name)}">${avatar}<span class="person-list-name">${escapeHtml(person.name)}${me ? '<small>Jo</small>' : ''}</span>${icon('chevronRight', 18)}</button>
      <div class="person-order" role="group" aria-label="Ordre de ${escapeHtml(person.name)}">${[-1, 1].map(step => `<button type="button" class="person-order-button" data-action="move-person" data-kind="${kind}" data-id="${escapeHtml(person.id)}" data-step="${step}" aria-label="${step === -1 ? 'Puja' : 'Baixa'} ${escapeHtml(person.name)}" ${index + step < 0 || index + step >= entries.length ? 'disabled' : ''}>${icon(step === -1 ? 'chevronLeft' : 'chevronRight', 16)}</button>`).join('')}</div></li>`;
    }).join('')}</ol>`;
}
function personDetails(key) {
    const child = key.startsWith('child:') ? childById(key.slice(6)) : undefined;
    const tutor = key.startsWith('guardian:') ? guardian(key.slice(9)) : undefined;
    const person = child ?? tutor;
    if (!person)
        return '';
    const id = escapeHtml(person.id);
    const fields = child ? `<div class="field"><label for="child-name-${id}">Nom</label><input id="child-name-${id}" type="text" maxlength="70" value="${escapeHtml(child.name)}" data-action="child-name" data-child="${id}" /></div>
    <div class="field"><label for="child-birth-${id}">Data de naixement (opcional)</label><input id="child-birth-${id}" type="date" value="${escapeHtml(child.birthDate)}" data-action="child-birth" data-child="${id}" /></div><p class="settings-note">La data de naixement permet mostrar els aniversaris al calendari.</p>` :
        `<div class="school-form-fields"><div class="field"><label for="guardian-name-${id}">Nom</label><input id="guardian-name-${id}" type="text" maxlength="70" value="${escapeHtml(tutor.name)}" data-action="guardian-name" data-guardian="${id}" /></div>
    <div class="field"><label for="guardian-color-${id}">Color al calendari</label><input id="guardian-color-${id}" type="color" value="${tutor.color}" data-action="guardian-color" data-guardian="${id}" /></div></div>${personActions(key)}<h3 class="sheet-section-label">Horari laboral</h3>${personalTimeOff.sections(state, key)}`;
    return `<div class="sheet-heading"><div><h2 class="sheet-title">${escapeHtml(person.name)}</h2><p class="sheet-subtitle">${child ? 'Fill' : 'Tutor o responsable'}</p></div><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    ${fields}<div class="action-row"><button type="button" class="primary-btn" data-action="close-sheet">Fet</button><button type="button" class="danger-btn" data-action="${child ? 'delete-child' : 'delete-guardian'}" data-${child ? 'child' : 'guardian'}="${id}">${icon('trash', 16)} Suprimeix ${child ? 'el fill' : 'el tutor'}</button></div>`;
}
function reorderPerson(entries, id, step) {
    if (step !== -1 && step !== 1)
        return false;
    const index = entries.findIndex(person => person.id === id), next = index + step;
    if (index < 0 || next < 0 || next >= entries.length)
        return false;
    const [person] = entries.splice(index, 1);
    entries.splice(next, 0, person);
    return true;
}
function peoplePage() {
    return `<header class="page-heading"><div><div class="eyebrow">LA FAMÍLIA</div><h1 class="page-title">Persones</h1><p class="page-subtitle">Toca una persona per editar-la. Les fletxes permeten canviar-ne l’ordre.</p></div></header>
    <section class="card"><div class="panel-header"><h2 class="section-title">Fills</h2><button type="button" class="secondary-btn" data-action="add-child">${icon('plus', 14)} Afegir</button></div>${peopleList('child')}</section>
    <section class="card"><div class="panel-header"><h2 class="section-title">Tutors i responsables</h2><button type="button" class="secondary-btn" data-action="add-guardian">${icon('plus', 14)} Afegir</button></div>${peopleList('guardian')}</section>`;
}
function settingsPage() {
    const areas = [
        ['general', 'General', 'settings', 'Aparença, actualitzacions i dades.'],
        ['people', 'Persones', 'people', 'Fills, tutors i responsables.'],
        ['rotation', 'Rotacions', 'repeat', 'Patrons de pernocta i altres franges.'],
        ['schools', 'Escoles', 'school', 'Centres, cursos i horaris escolars.']
    ];
    return `<header class="page-heading"><div><h1 class="page-title">Configuració</h1><p class="page-subtitle">Tria l’àrea que vols configurar.</p></div></header>
  <nav class="settings-areas" aria-label="Àrees de configuració">${areas.map(([target, label, glyph, description]) => `<button type="button" class="card settings-area-link" data-action="tab" data-tab="${target}"><span class="settings-area-icon">${icon(glyph, 23)}</span><span class="settings-area-copy"><strong>${label}</strong><span>${description}</span></span>${icon('chevronRight', 18)}</button>`).join('')}</nav>`;
}
function generalSettingsPage() {
    const storageDescription = storageMode === 'indexeddb' ? 'IndexedDB · desat automàtic' : storageMode === 'localStorage' ? 'LocalStorage · mode alternatiu' : 'Sense persistència garantida';
    return `<header class="page-heading"><div><div class="eyebrow">CONFIGURACIÓ</div><h1 class="page-title">General</h1><p class="page-subtitle">Personalitza el teu calendari familiar.</p></div></header>
  <section class="card appearance-card"><h2 class="section-title">Aparença</h2><p class="section-description">Tria el tema de l'aplicació. Automàtic segueix l'aparença de l'iPhone.</p>
  <div class="theme-options" role="group" aria-label="Mode d’aparença">${[['auto', 'Automàtic', 'monitor'], ['light', 'Clar', 'sun'], ['dark', 'Fosc', 'moon']].map(([mode, label, glyph]) => `<button type="button" class="theme-choice ${validTheme(state.preferences.theme) === mode ? 'is-selected' : ''}" data-action="set-theme" data-theme-mode="${mode}" aria-pressed="${validTheme(state.preferences.theme) === mode}">${icon(glyph, 19)}<span>${label}</span></button>`).join('')}</div></section>
  <section class="card font-size-card"><div class="panel-header"><h2 class="section-title">Mida de lletra</h2><output id="font-size-current" for="font-size-slider" class="sample-tag">${FONT_SIZE_LABELS[validFontSize(state.preferences.fontSize)]}</output></div>
  <p class="section-description">Augmenta la lletra de totes les vistes per llegir més còmodament.</p>
  <input id="font-size-slider" type="range" class="font-size-range" min="0" max="2" step="1" value="${FONT_SIZE_OPTIONS.indexOf(validFontSize(state.preferences.fontSize))}" data-action="font-size" aria-label="Mida de lletra" aria-valuetext="${FONT_SIZE_LABELS[validFontSize(state.preferences.fontSize)]}" />
  <div class="font-size-labels"><span>Normal</span><span>Gran</span><span>Molt gran</span></div></section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Actualitzacions</h2><span class="sample-tag">v${APP_VERSION}</span></div><p class="section-description">Si l’iPhone mostra una versió anterior, pots actualitzar els fitxers de l’app sense esborrar les dades del calendari.</p><div class="action-row"><button type="button" class="secondary-btn" data-action="check-update">Comprova actualitzacions</button></div></section>
  <section class="card"><h2 class="section-title">Les teves dades</h2><p class="section-description">Les dades es queden en aquest navegador. Exporta una còpia si canvies de dispositiu o abans de netejar-ne les dades.</p>
  <div class="status-good">${icon('shield', 17)} ${escapeHtml(storageDescription)}</div><div class="action-row"><button class="primary-btn" data-action="export">${icon('download', 15)} Exporta JSON</button><button class="secondary-btn" data-action="import">${icon('upload', 15)} Importa JSON</button><input class="sr-only" id="import-file" type="file" accept=".json,application/json" /></div><hr>
  <div class="panel-header"><h2 class="section-title">Comença de zero</h2></div>
  <p class="settings-note">Esborra tots els fills, tutors, escoles, horaris, rotacions i canvis puntuals desats. Aquesta acció no es pot desfer. Exporta abans una còpia JSON si vols conservar les dades.</p>
  <div class="action-row"><button type="button" class="danger-btn" data-action="clear-all">${icon('trash', 15)} Esborra totes les dades</button></div></section>`;
}
function returnFromDetail(date) { return detailOrigin === 'day' ? { type: 'day', date: detailReturnDate || date } : null; }
function sheetMarkup() {
    let contents = '';
    if (sheet?.type === 'personDetails') {
        contents = personDetails(sheet.personKey);
    }
    else if (sheet?.type === 'personWork') {
        contents = workSchedule.form(state, sheet.personKey, sheet.draft);
    }
    else if (sheet?.type === 'personHolidays') {
        contents = personalTimeOff.holidayPicker(state, sheet);
    }
    else if (sheet?.type === 'personVacation') {
        contents = personalTimeOff.vacationForm(state, sheet.personKey, sheet.periodId, localDate(new Date()));
    }
    else if (sheet?.type === 'legend') {
        contents = `<div class="sheet-heading"><h2 class="sheet-title">Llegenda</h2><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    <div class="calendar-legend-dialog">${calendarLegend()}<p class="settings-note">● Canvi puntual</p></div>
    <div class="action-row"><button type="button" class="primary-btn" data-action="close-sheet">Fet</button></div>`;
    }
    else if (sheet?.type === 'zoom') {
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Zoom · ${calendarView === 'day' ? 'Dia' : 'Setmana'}</h2><p class="sheet-subtitle">El nivell de zoom es desa per a aquesta vista.</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    ${zoomControls()}
    <div class="action-row"><button type="button" class="primary-btn" data-action="close-sheet">Fet</button></div>`;
    }
    else if (sheet?.type === 'filters') {
        const showHolyWeek = state.preferences.showHolyWeek === true;
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Filtres</h2><p class="sheet-subtitle">Tria què vols veure al calendari</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    <div class="sheet-section-label">Calendari</div>
    <button type="button" class="option ${showHolyWeek ? 'selected' : ''}" data-action="toggle-holy-week" aria-pressed="${showHolyWeek}"><span class="option-left"><span class="personal-legend holy-week" aria-hidden="true"></span>Setmana Santa</span>${showHolyWeek ? icon('check', 17) : '<span class="badge-soft">Oculta</span>'}</button>
    <p class="settings-note">De Rams a Pasqua, a les vistes Any i Mes.</p>
    <div class="sheet-section-label">Fills</div>${state.children.map(c => filterOption(c.id, c.name, state.preferences.visibleChildren.includes(c.id), 'child')).join('')}
    <div class="sheet-section-label">Tutors</div>${state.guardians.map(g => filterOption(g.id, g.name, state.preferences.visibleGuardians.includes(g.id), 'guardian', g.color)).join('')}
    <div class="sheet-section-label">Escoles <span class="filter-section-hint">(ocultes per defecte)</span></div>${state.schools.length ? state.schools.map(s => filterOption(s.id, s.name, state.preferences.visibleSchools.includes(s.id), 'school', s.color)).join('') : '<p class="settings-note">Afegeix escoles a la pestanya Escoles.</p>'}
    ${personalTimeOff.filterMarkup(state)}
    <div class="action-row"><button class="secondary-btn" data-action="filter-all">Mostra-ho tot</button><button class="primary-btn" data-action="close-sheet">Fet</button></div>`;
    }
    else if (sheet?.type === 'day') {
        const date = sheet.date, bdays = birthdays(date).filter(c => state.preferences.visibleChildren.includes(c.id));
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">${dayMonth(date, true)}</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    ${bdays.length ? `<div class="tip-card" style="margin:0 0 14px;padding:12px">Aniversari: ${escapeHtml(bdays.map(c => `${c.name} fa ${birthdayAge(date, c)} anys`).join(' · '))}</div>` : ''}
    ${schoolInfoForDay(date)}${monthDayUI.detail(date, fullDate(date), activeChildren(), monthData(date, activeChildren()).nights, monthData(date, activeChildren()).activities, monthData(date, activeChildren()).slots, state)}${state.personTimeOff ? workSchedule.agenda(state, [date]) : ''}`;
    }
    else if (sheet?.type === 'dayEdit') {
        const date = sheet.date;
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Edita el dia</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close', 17)}</button></div>
    <div class="day-edit-actions">${state.children.length ? `<button type="button" class="soft-btn" data-action="day-slot-add" data-date="${date}">+ Afegeix una franja</button>` : `<button type="button" class="soft-btn" data-action="tab" data-tab="people">Afegeix un fill</button>`}${state.extraRotations.some(r => r.kind !== 'night' && rotationPatterns.inRange(r, date)) ? `<button type="button" class="soft-btn" data-action="extra-date-choose" data-date="${date}">Edita rotacions del dia</button>` : ''}${monthDayUI.hasChanges(state, date) ? `<button type="button" class="soft-btn" data-action="day-restore" data-date="${date}">Restaurar segons la rotació</button>` : ''}</div>
    ${schoolInfoForDay(date)}${state.personTimeOff ? workSchedule.agenda(state, [date]) : ''}
    <div class="action-row"><button type="button" class="primary-btn" data-action="close-sheet">Fet</button></div>`;
    }
    else if (sheet?.type === 'daySlotForm') {
        contents = monthDayUI.form(sheet.date, sheet.childId, sheet.slotId, state.children, state.guardians, state);
    }
    else if (sheet?.type === 'schoolActivity') {
        const { date, childId, schoolId, sessionId } = sheet;
        const activity = schoolActivities(date, activeChildren()).find(a => a.id === sessionId && a.schoolId === schoolId && a.childId === childId);
        const c = childById(sheet.childId);
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">Activitat escolar</h2><p class="sheet-subtitle">${escapeHtml(fullDate(sheet.date))}</p></div><button class="sheet-close" data-action="return-detail" data-date="${escapeHtml(date)}" aria-label="Torna a la vista anterior">${icon('close', 17)}</button></div>
    ${activity ? `<div class="school-activity-info"><strong>${escapeHtml(activity.kind)}</strong><p>${escapeHtml(c?.name ?? 'Fill')} · ${escapeHtml(activity.schoolName)}</p><p>${activity.startTime}–${activity.endTime}</p>${activity.description ? `<p>${escapeHtml(activity.description)}</p>` : ''}</div>` : '<p class="settings-note">Aquesta activitat ja no està disponible.</p>'}`;
    }
    else if (sheet?.type === 'extraCell') {
        contents = rotationEditor.patternDayForm(rotationEditor.draftState(state, extraRotationDrafts, sheet.rotationId), sheet.rotationId, sheet.childId, sheet.index);
    }
    else if (sheet?.type === 'extraDate') {
        contents = sheet.rotationId ? rotationEditor.dateForm(state, sheet.date, sheet.rotationId, sheet.childId) : rotationEditor.datePicker(state, sheet.date);
    }
    else if (sheet?.type === 'bandEdit') {
        const { date, childId, band } = sheet, c = childById(childId), value = responsibility(date, childId, band), visibleDate = sheet.viewDate ?? date;
        const isNight = band === 'nit';
        const manual = !isNight && Object.hasOwn(state.bandOverrides, bandKey(date, childId, band));
        contents = `<div class="sheet-heading"><div><h2 class="sheet-title">${BAND_NAMES[band]} · ${escapeHtml(c?.name ?? 'Fill')}</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="return-detail" data-date="${escapeHtml(date)}" aria-label="Torna a la vista anterior">${icon('close', 17)}</button></div>
    <p class="settings-note">${isNight ? 'Aquesta nit segueix la rotació, excepte si la canvies.' : 'Assignació independent de la nit. Les escoles es calculen a partir de l’horari escolar.'} Actualment: ${escapeHtml(value.name)}.</p>
    ${isNight ? `<div class="field"><label for="night-date-time">Hora de canvi de responsabilitat del ${escapeHtml(fullDate(visibleDate))}</label><input id="night-date-time" type="time" data-action="night-date-time" data-date="${escapeHtml(visibleDate)}" data-child="${escapeHtml(childId)}" value="${nightChangeTime(visibleDate, childId)}"></div>
      ${Object.hasOwn(state.nightDateTimes, visibleDate + '|' + childId) ? `<button class="soft-btn" data-action="night-date-time-clear" data-date="${escapeHtml(visibleDate)}" data-child="${escapeHtml(childId)}">Restaura l'hora de canvi de la rotació</button>` : ''}` : ''}
    ${state.guardians.map(g => `<button class="option ${value.type === 'guardian' && value.name === g.name ? 'selected' : ''}" data-action="${isNight ? 'assign-night' : 'assign-band'}" data-date="${date}" data-child="${escapeHtml(childId)}" data-band="${band}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span></button>`).join('')}
    ${!isNight ? `<button class="option" data-action="assign-band" data-date="${date}" data-child="${escapeHtml(childId)}" data-band="${band}" data-guardian=""><span class="option-left">Sense assignar</span></button>` : ''}
    ${isNight && overridden(date, childId) ? `<button class="soft-btn" data-action="clear-night" data-date="${date}" data-child="${escapeHtml(childId)}">Torna a la rotació</button>` : ''}
    ${!isNight && manual ? `<button class="soft-btn" data-action="clear-band" data-date="${date}" data-child="${escapeHtml(childId)}" data-band="${band}">Restaura l’assignació automàtica</button>` : ''}
    <button class="soft-btn" data-action="return-detail" data-date="${date}">${detailOrigin === 'day' ? 'Torna al dia' : 'Torna al calendari'}</button>`;
    }
    else if (sheet && ['schoolForm', 'yearForm', 'groupForm', 'schoolDayForm', 'schoolVacationForm', 'reducedWindowForm', 'ordinaryWindowForm', 'scheduleForm'].includes(sheet.type)) {
        contents = schoolFormMarkup();
    }
    return `<div class="overlay" data-action="close-backdrop"><section class="sheet ${sheet?.type === 'day' ? 'month-day-sheet' : sheet?.type.startsWith('person') ? 'personal-sheet' : ''}" data-sheet-key="${escapeHtml(sheet?.type === 'personWork' ? JSON.stringify([sheet.type, sheet.personKey, sheet.draft.id, sheet.draft.week]) : sheet?.type === 'personHolidays' ? JSON.stringify([sheet.type, sheet.personKey]) : sheet?.type === 'schoolDayForm' ? JSON.stringify([sheet.type, sheet.schoolId, sheet.yearId, sheet.kind]) : JSON.stringify(sheet))}" role="dialog" aria-modal="true" aria-label="${sheet?.type === 'filters' ? 'Filtres' : sheet?.type === 'zoom' ? 'Zoom' : sheet?.type === 'legend' ? 'Llegenda' : sheet?.type === 'dayEdit' ? 'Edita el dia' : sheet?.type === 'personDetails' ? 'Dades de la persona' : sheet?.type.startsWith('person') ? 'Horari laboral' : 'Detall del calendari'}"><div class="sheet-handle"></div>${contents}</section></div>`;
}
function filterOption(id, name, selected, kind, color) {
    const symbol = kind === 'child' ? 'person' : kind === 'school' ? 'school' : 'home';
    return `<button class="option ${selected ? 'selected' : ''}" aria-pressed="${selected}" data-action="toggle-filter" data-filter-kind="${kind}" data-id="${escapeHtml(id)}"><span class="option-left"><span class="filter-entity-icon">${icon(symbol, 18)}</span>${color ? `<span class="color-dot" style="background:${color}"></span>` : ''}${escapeHtml(name)}</span>${selected ? icon('check', 17) : '<span class="badge-soft">Ocult</span>'}</button>`;
}
// Els selectors nadius d’iOS emeten change mentre encara s’està triant una roda.
// Conservem el node actiu i només ajornem el redibuix; les dades es poden desar igualment.
let nativePickerRenderPending = false, nativePickerPointerDown = false;
let nativePickerRenderTimer;
function nativePickerIsActive() {
    const input = document.activeElement;
    return input instanceof HTMLInputElement && ['date', 'time', 'datetime-local', 'month', 'week', 'color'].includes(input.type);
}
function deferRenderForNativePicker() {
    if (nativePickerIsActive() || nativePickerPointerDown) {
        nativePickerRenderPending = true;
        return true;
    }
    nativePickerRenderPending = false;
    return false;
}
function finishNativePickerEdit() {
    if (nativePickerIsActive())
        document.activeElement.blur();
}
function flushNativePickerRender() {
    nativePickerRenderTimer = undefined;
    if (!nativePickerRenderPending || nativePickerPointerDown || nativePickerIsActive())
        return;
    const active = document.activeElement;
    // Tampoc substituïm un altre camp si l’usuari hi ha passat a escriure.
    if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement || active instanceof HTMLTextAreaElement)
        return;
    render();
}
function queueNativePickerRender(delay = 100) {
    if (!nativePickerRenderPending)
        return;
    window.clearTimeout(nativePickerRenderTimer);
    nativePickerRenderTimer = window.setTimeout(flushNativePickerRender, delay);
}
function fitCalendarTimeline(main) {
    if (tab !== 'calendar' || (calendarView !== 'week' && calendarView !== 'day'))
        return;
    const head = main.querySelector(calendarView === 'week' ? '.week-timeline-head' : '.day-timeline-headers');
    const content = main.querySelector('.content');
    if (!head || !content)
        return;
    // La capçalera ocupa espai propi: les 24 hores omplen la resta de la zona útil.
    const minimumHeight = Math.max(0, main.clientHeight - head.offsetHeight);
    content.innerHTML = calendarView === 'week' ? weekTimeline(weekStart(selectedDate), activeChildren(), minimumHeight) : dayTimeline(selectedDate, activeChildren(), minimumHeight);
    if (typeof ResizeObserver === 'undefined')
        return;
    let width = main.clientWidth, height = main.clientHeight, frame = 0;
    const observer = new ResizeObserver(() => {
        if (width === main.clientWidth && height === main.clientHeight)
            return;
        width = main.clientWidth;
        height = main.clientHeight;
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => render());
    });
    observer.observe(main);
    stopCalendarScroll = () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
}
function render() {
    if (deferRenderForNativePicker())
        return;
    const monthAnchor = monthPosition();
    stopCalendarScroll?.();
    stopCalendarScroll = null;
    const previousTimeline = $app.querySelector('.day-timeline-viewport');
    const timelineKey = tab === 'calendar' ? (calendarView === 'day' ? `day:${selectedDate}` : calendarView === 'week' ? `week:${weekStart(selectedDate)}` : '') : '';
    const keepTimeline = Boolean(timelineKey && previousTimeline?.dataset.timelineKey === timelineKey);
    const focusDate = calendarView === 'week' ? selectedDate : '';
    const keepHorizontalScroll = keepTimeline && (calendarView !== 'week' || previousTimeline?.dataset.focusDate === focusDate);
    const timelineLeft = keepHorizontalScroll ? previousTimeline.scrollLeft : 0;
    const oldScale = Number(previousTimeline?.dataset.pxPerMinute ?? 0);
    const previousMain = $app.querySelector('.main-area');
    const scrollKey = [tab, tab === 'calendar' ? calendarView : '', schoolNav.schoolId ?? '', schoolNav.yearId ?? '', schoolNav.groupId ?? ''].join('|');
    const mainScroll = previousMain?.dataset.scrollKey === scrollKey ? previousMain.scrollTop : 0;
    const oldTimelineOffset = previousMain && previousTimeline
        ? previousMain.scrollTop + previousTimeline.getBoundingClientRect().top - previousMain.getBoundingClientRect().top : NaN;
    const minuteAtCenter = keepTimeline && previousMain && oldScale > 0
        ? Math.max(0, Math.min(1440, (previousMain.scrollTop + previousMain.clientHeight / 2 - oldTimelineOffset) / oldScale)) : NaN;
    const previousSheet = $app.querySelector('.sheet');
    const sheetKey = sheet?.type === 'personWork' ? JSON.stringify([sheet.type, sheet.personKey, sheet.draft.id, sheet.draft.week]) : sheet?.type === 'personHolidays' ? JSON.stringify([sheet.type, sheet.personKey]) : sheet?.type === 'schoolDayForm' ? JSON.stringify([sheet.type, sheet.schoolId, sheet.yearId, sheet.kind]) : JSON.stringify(sheet);
    const sheetScroll = previousSheet?.dataset.sheetKey === sheetKey ? previousSheet.scrollTop : 0;
    const pickerFocus = sheet && (sheet.type === 'schoolDayForm' || sheet.type === 'personHolidays') ? document.activeElement?.closest('.school-date-picker button') : null;
    const pickerFocusKey = pickerFocus?.dataset.date ? `[data-action="${pickerFocus.dataset.action}"][data-date="${pickerFocus.dataset.date}"]` : pickerFocus?.dataset.step ? `[data-action="${pickerFocus.dataset.action}"][data-step="${pickerFocus.dataset.step}"]` : '';
    $app.innerHTML = layout(tab === 'calendar' ? calendarPage() : tab === 'rotation' ? rotationPage() : tab === 'schools' ? schoolsPage() : tab === 'people' ? peoplePage() : tab === 'general' ? generalSettingsPage() : settingsPage());
    const main = $app.querySelector('.main-area');
    if (main && (calendarView === 'week' || calendarView === 'day'))
        fitCalendarTimeline(main);
    if (main) {
        main.dataset.scrollKey = scrollKey;
        main.scrollTop = mainScroll;
    }
    const currentSheet = $app.querySelector('.sheet');
    if (currentSheet)
        currentSheet.scrollTop = sheetScroll;
    if (pickerFocusKey)
        currentSheet?.querySelector(pickerFocusKey)?.focus({ preventScroll: true });
    const timeline = $app.querySelector('.day-timeline-viewport');
    if (timeline) {
        const newScale = Number(timeline.dataset.pxPerMinute ?? 0);
        // Dia i Setmana: l'alçada completa és part del scroll principal, no d'un scroll intern.
        timeline.scrollTop = 0;
        timeline.scrollLeft = timelineLeft;
        if (calendarView === 'week' && !keepHorizontalScroll) {
            // Quan s'entra a Setmana o canvia el dia de referència, situa'l al costat de l'eix d'hores.
            // No forcem el scroll en tornar a pintar la mateixa setmana (zoom, filtres, edició):
            // així es preserva el desplaçament horitzontal que l'usuari ja ha fet manualment.
            const header = Array.from(timeline.querySelectorAll('.week-day-header')).find(el => el.dataset.date === focusDate);
            if (header) {
                const offset = header.getBoundingClientRect().left - timeline.getBoundingClientRect().left + timeline.scrollLeft - 52;
                timeline.scrollLeft = Math.max(0, Math.min(timeline.scrollWidth - timeline.clientWidth, offset));
            }
        }
        if (main && Number.isFinite(minuteAtCenter) && newScale > 0 && newScale !== oldScale) {
            const newOffset = main.scrollTop + timeline.getBoundingClientRect().top - main.getBoundingClientRect().top;
            main.scrollTop = Math.max(0, newOffset + minuteAtCenter * newScale - main.clientHeight / 2);
        }
    }
    mountCalendarScroll(monthAnchor, previousMain?.dataset.scrollKey !== scrollKey);
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
function changeTab(value) { tab = value; sheet = null; window.scrollTo({ top: 0, behavior: 'instant' }); render(); }
function chooseGuardian(date, childId, guardianId) {
    if (guardianId === rotationAssignment(date, childId))
        delete state.overrides[`${date}|${childId}`];
    else
        state.overrides[`${date}|${childId}`] = guardianId;
    update();
    notify('Nit actualitzada');
}
function removeGuardian(id) {
    const g = guardian(id);
    if (!g || !confirm(state.guardians.length === 1
        ? `Vols suprimir «${g.name}»? Et quedaràs sense tutors, i les nits passaran a «Sense assignar».`
        : `Vols suprimir «${g.name}»? Les seves nits passaran al primer tutor disponible.`))
        return;
    if (state.personTimeOff)
        personalTimeOff.removePerson(state, 'guardian:' + id);
    state.guardians = state.guardians.filter(x => x.id !== id);
    const alternate = defaultGuardian();
    Object.keys(state.overrides).forEach(key => { if (state.overrides[key] === id)
        state.overrides[key] = alternate; });
    Object.keys(state.bandOverrides).forEach(key => { if (state.bandOverrides[key] === id)
        state.bandOverrides[key] = alternate; });
    monthDayUI.removeGuardian(state.daySlots, id, alternate);
    rotationPatterns.removeGuardian(state, id, alternate);
    if (sheet?.type === 'personDetails' && sheet.personKey === 'guardian:' + id)
        sheet = null;
    state.preferences.visibleGuardians = state.preferences.visibleGuardians.filter(x => x !== id);
    extraRotationDrafts = {};
    extraRotationOpen = null;
    update();
}
function removeChild(id) {
    const c = childById(id);
    if (!c || !confirm(`Vols suprimir «${c.name}» i totes les seves assignacions?`))
        return;
    if (state.personTimeOff)
        personalTimeOff.removePerson(state, 'child:' + id);
    state.children = state.children.filter(x => x.id !== id);
    for (const key of Object.keys(state.nightDateTimes))
        if (key.endsWith('|' + id))
            delete state.nightDateTimes[key];
    state.schools.forEach(s => { s.childIds = s.childIds.filter(x => x !== id); s.years.forEach(y => y.groups.forEach(g => { g.childIds = g.childIds.filter(x => x !== id); if (g.childSchedules)
        delete g.childSchedules[id]; if (g.reducedChildSchedules)
        delete g.reducedChildSchedules[id]; })); });
    Object.keys(state.overrides).forEach(key => { if (key.endsWith(`|${id}`))
        delete state.overrides[key]; });
    Object.keys(state.bandOverrides).forEach(key => { if (key.split('|')[1] === id)
        delete state.bandOverrides[key]; });
    monthDayUI.removeChild(state.daySlots, id);
    rotationPatterns.removeChild(state, id);
    if (sheet?.type === 'personDetails' && sheet.personKey === 'child:' + id)
        sheet = null;
    state.preferences.visibleChildren = state.preferences.visibleChildren.filter(x => x !== id);
    extraRotationDrafts = {};
    extraRotationOpen = null;
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
        extraRotationDrafts = {};
        extraRotationOpen = null;
        sheet = null;
        schoolNav = {};
        update();
        notify('Dades importades correctament');
    }
    catch (err) {
        notify(err instanceof Error ? err.message : 'No es pot importar aquest fitxer');
    }
}
function clearAllData() {
    if (!confirm('ATENCIÓ: vols esborrar tots els fills, tutors, escoles, horaris, rotacions i assignacions? No es pot desfer. Exporta una còpia JSON abans si vols conservar-los.'))
        return;
    state = emptyState();
    extraRotationDrafts = {};
    extraRotationOpen = null;
    sheet = null;
    schoolNav = {};
    tab = 'general';
    calendarView = 'month';
    selectedDate = localDate(new Date());
    viewYear = parseDate(selectedDate).getFullYear();
    viewMonth = parseDate(selectedDate).getMonth();
    update();
    notify('Totes les dades esborrades. Ja pots començar de zero.');
}
function clickAction(button) {
    const action = button.dataset.action;
    switch (action) {
        case 'work-add':
        case 'work-edit': {
            const key = button.dataset.person ?? '', draft = workSchedule.draft(state, key, action === 'work-edit' ? button.dataset.rotation : undefined, localDate(new Date()));
            if (draft) {
                sheet = { type: 'personWork', personKey: key, draft };
                render();
            }
            break;
        }
        case 'work-cancel': {
            const key = sheet?.type === 'personWork' ? sheet.personKey : button.dataset.person ?? '';
            if (personalTimeOff.person(state, key)) {
                sheet = { type: 'personDetails', personKey: key };
                render();
            }
            break;
        }
        case 'work-week':
        case 'work-shift-add':
        case 'work-shift-remove':
        case 'work-copy': {
            if (sheet?.type !== 'personWork')
                break;
            const kind = action === 'work-week' ? 'week' : action === 'work-shift-add' ? 'add' : action === 'work-copy' ? 'copy' : 'remove';
            if (workSchedule.edit(sheet.draft, kind, Number(action === 'work-week' ? button.dataset.week : button.dataset.day), Number(button.dataset.slot)))
                render();
            break;
        }
        case 'work-delete': {
            const key = button.dataset.person ?? '', id = button.dataset.rotation ?? '', rotation = workSchedule.rotations(state, key).find((r) => r.id === id);
            if (rotation && confirm(`Vols suprimir «${rotation.name}»?`) && workSchedule.remove(state, key, id)) {
                update();
                notify('Rotació de feina eliminada');
            }
            break;
        }
        case 'open-person': {
            const key = button.dataset.person ?? '';
            const exists = key.startsWith('child:') ? childById(key.slice(6)) : key.startsWith('guardian:') ? guardian(key.slice(9)) : undefined;
            if (exists) {
                sheet = { type: 'personDetails', personKey: key };
                render();
            }
            break;
        }
        case 'move-person': {
            const kind = button.dataset.kind, id = button.dataset.id ?? '', step = Number(button.dataset.step);
            const moved = kind === 'child' ? reorderPerson(state.children, id, step) : kind === 'guardian' ? reorderPerson(state.guardians, id, step) : false;
            if (moved) {
                update();
                const controls = Array.from($app.querySelectorAll('[data-action="move-person"]')).filter(el => el.dataset.kind === kind && el.dataset.id === id && !el.disabled);
                (controls.find(el => el.dataset.step === String(step)) ?? controls[0])?.focus({ preventScroll: true });
            }
            break;
        }
        case 'person-me': {
            if (personalTimeOff.setMe(state, button.dataset.person ?? '')) {
                update();
                notify(state.preferences.mePerson ? 'Identitat actualitzada' : 'Identificació retirada');
            }
            break;
        }
        case 'person-time-off': {
            const key = button.dataset.person ?? '';
            if (!personalTimeOff.person(state, key))
                break;
            sheet = { type: 'personDetails', personKey: key };
            render();
            break;
        }
        case 'person-holidays': {
            const key = button.dataset.person ?? '';
            if (!personalTimeOff.person(state, key))
                break;
            sheet = { type: 'personHolidays', personKey: key, month: localDate(new Date()).slice(0, 7), dates: [...personalTimeOff.get(state, key).holidays] };
            render();
            break;
        }
        case 'person-holiday-month': {
            if (sheet?.type !== 'personHolidays')
                break;
            const step = Number(button.dataset.step);
            if (![-1, 1].includes(step))
                break;
            const [year, month] = sheet.month.split('-').map(Number), next = new Date(Date.UTC(year, month - 1 + step, 1, 12));
            if (next.getUTCFullYear() < 100 || next.getUTCFullYear() > 9999)
                break;
            sheet.month = next.toISOString().slice(0, 7);
            render();
            break;
        }
        case 'person-holiday-toggle': {
            if (sheet?.type !== 'personHolidays')
                break;
            const date = button.dataset.date ?? '';
            if (!personalTimeOff.valid(date))
                break;
            sheet.dates = sheet.dates.includes(date) ? sheet.dates.filter(d => d !== date) : [...sheet.dates, date].sort();
            render();
            break;
        }
        case 'person-holidays-save': {
            if (sheet?.type !== 'personHolidays')
                break;
            const key = sheet.personKey, error = personalTimeOff.setHolidays(state, key, sheet.dates);
            if (error) {
                notify(error);
                break;
            }
            sheet = { type: 'personDetails', personKey: key };
            update();
            notify('Festius desats');
            break;
        }
        case 'person-holiday-delete': {
            const key = button.dataset.person ?? '', data = personalTimeOff.get(state, key), error = personalTimeOff.setHolidays(state, key, data.holidays.filter((d) => d !== button.dataset.date));
            if (error) {
                notify(error);
                break;
            }
            update();
            notify('Festiu eliminat');
            break;
        }
        case 'person-vacation-add':
        case 'person-vacation-edit': {
            const key = button.dataset.person ?? '', id = button.dataset.period;
            if (!personalTimeOff.person(state, key))
                break;
            if (button.dataset.action === 'person-vacation-edit' && !personalTimeOff.get(state, key).vacations.some((v) => v.id === id))
                break;
            sheet = { type: 'personVacation', personKey: key, periodId: button.dataset.action === 'person-vacation-edit' ? id : undefined };
            render();
            break;
        }
        case 'person-vacation-delete': {
            const key = button.dataset.person ?? '', id = button.dataset.period ?? '', period = personalTimeOff.get(state, key).vacations.find((v) => v.id === id);
            if (!period || !confirm(`Vols suprimir «${period.name}»?`))
                break;
            if (personalTimeOff.deleteVacation(state, key, id)) {
                update();
                notify('Vacances eliminades');
            }
            break;
        }
        case 'person-off-type': {
            const kind = button.dataset.kind;
            if (kind !== 'holiday' && kind !== 'vacation' && kind !== 'work')
                break;
            const flag = kind === 'holiday' ? 'showPersonalHolidays' : kind === 'vacation' ? 'showPersonalVacations' : 'showWorkSchedules';
            state.preferences[flag] = state.preferences[flag] === false;
            update();
            break;
        }
        case 'person-off-filter': {
            const key = button.dataset.person ?? '';
            if (!personalTimeOff.person(state, key))
                break;
            const selected = state.preferences.visibleTimeOffPeople;
            state.preferences.visibleTimeOffPeople = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key];
            update();
            break;
        }
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
        case 'school-vacation-add':
        case 'school-vacation-edit': {
            const school = schoolById(button.dataset.school), year = yearById(school, button.dataset.year);
            if (!school || !year)
                break;
            const vacationId = button.dataset.vacation;
            if (vacationId && !year.vacations?.some(p => p.id === vacationId))
                break;
            sheet = { type: 'schoolVacationForm', schoolId: school.id, yearId: year.id, vacationId };
            render();
            break;
        }
        case 'school-vacation-delete': {
            const year = yearById(schoolById(button.dataset.school), button.dataset.year);
            if (!year || !year.vacations?.some(p => p.id === button.dataset.vacation))
                break;
            year.vacations = year.vacations.filter(p => p.id !== button.dataset.vacation);
            update();
            notify('Període de vacances eliminat');
            break;
        }
        case 'school-day-add': {
            const school = schoolById(button.dataset.school), year = yearById(school, button.dataset.year);
            if (!school || !year)
                break;
            const kind = button.dataset.kind === 'holiday' ? 'holiday' : 'reduced', today = localDate(new Date());
            const initial = today < year.startDate ? year.startDate : today > year.endDate ? year.endDate : today;
            sheet = { type: 'schoolDayForm', schoolId: school.id, yearId: year.id, kind, month: initial.slice(0, 7), dates: (kind === 'holiday' ? year.holidays : year.reducedDays).filter(date => !schoolDayIsWeekend(date)) };
            render();
            break;
        }
        case 'school-day-month': {
            if (sheet?.type !== 'schoolDayForm')
                break;
            const year = yearById(schoolById(sheet.schoolId), sheet.yearId), step = Number(button.dataset.step);
            if (!year || ![-1, 1].includes(step))
                break;
            const date = parseDate(sheet.month + '-01');
            date.setMonth(date.getMonth() + step);
            const month = localDate(date).slice(0, 7);
            if (month < year.startDate.slice(0, 7) || month > year.endDate.slice(0, 7))
                break;
            sheet.month = month;
            render();
            break;
        }
        case 'school-day-toggle': {
            if (sheet?.type !== 'schoolDayForm')
                break;
            const year = yearById(schoolById(sheet.schoolId), sheet.yearId), date = button.dataset.date ?? '';
            if (!year || schoolDayUnavailableReason(year, sheet.kind, date))
                break;
            sheet.dates = sheet.dates.includes(date) ? sheet.dates.filter(d => d !== date) : [...sheet.dates, date].sort();
            render();
            break;
        }
        case 'ordinary-window-edit': {
            const year = yearById(schoolById(button.dataset.school), button.dataset.year);
            if (!year)
                break;
            sheet = { type: 'ordinaryWindowForm', schoolId: button.dataset.school, yearId: button.dataset.year };
            render();
            break;
        }
        case 'reduced-window-edit': {
            const year = yearById(schoolById(button.dataset.school), button.dataset.year);
            if (!year)
                break;
            sheet = { type: 'reducedWindowForm', schoolId: button.dataset.school, yearId: button.dataset.year };
            render();
            break;
        }
        case 'school-membership-toggle': {
            const school = schoolById(button.dataset.school), id = button.dataset.child ?? '';
            if (!school || !childById(id))
                break;
            school.childIds = school.childIds.includes(id) ? school.childIds.filter(x => x !== id) : [...school.childIds, id];
            update();
            notify('Fills associats a l’escola actualitzats');
            break;
        }
        case 'schedule-inherit': {
            const group = groupById(yearById(schoolById(button.dataset.school), button.dataset.year), button.dataset.group);
            if (!group || button.dataset.mode !== 'reduced' || group.reducedWeeklySchedule === undefined || !confirm('Vols esborrar totes les activitats específiques de jornada reduïda d’aquest grup?'))
                break;
            delete group.reducedWeeklySchedule;
            update();
            notify('Activitats de jornada reduïda esborrades');
            break;
        }
        case 'schedule-add': {
            const school = schoolById(button.dataset.school), group = groupById(yearById(school, button.dataset.year), button.dataset.group);
            const mode = button.dataset.mode === 'reduced' ? 'reduced' : 'ordinary';
            if (!school || !group || !scheduleEntriesForEdit(group, '', mode))
                break;
            if (mode === 'ordinary' && !yearById(school, button.dataset.year)?.ordinaryWindow) {
                notify('Configura primer les hores de jornada ordinària del curs');
                break;
            }
            sheet = { type: 'scheduleForm', schoolId: school.id, yearId: button.dataset.year, groupId: group.id, mode };
            render();
            break;
        }
        case 'schedule-edit': {
            const school = schoolById(button.dataset.school), group = groupById(yearById(school, button.dataset.year), button.dataset.group), sessionId = button.dataset.session ?? '';
            const mode = button.dataset.mode === 'reduced' ? 'reduced' : 'ordinary';
            if (!school || !group || !scheduleEntriesForEdit(group, '', mode)?.some(a => a.id === sessionId))
                break;
            sheet = { type: 'scheduleForm', schoolId: school.id, yearId: button.dataset.year, groupId: group.id, sessionId, mode };
            render();
            break;
        }
        case 'school-child-toggle': {
            const year = yearById(schoolById(button.dataset.school), button.dataset.year), group = groupById(year, button.dataset.group), id = button.dataset.child;
            if (!year || !group || !childById(id))
                break;
            if (group.childIds.includes(id)) {
                group.childIds = group.childIds.filter(x => x !== id);
                if (group.childSchedules)
                    delete group.childSchedules[id];
            }
            else {
                year.groups.forEach(g => { g.childIds = g.childIds.filter(x => x !== id); if (g.childSchedules)
                    delete g.childSchedules[id]; if (g.reducedChildSchedules)
                    delete g.reducedChildSchedules[id]; });
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
            state.preferences.visibleSchools = state.preferences.visibleSchools.filter(id => id !== school.id);
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
            const mode = button.dataset.mode === 'reduced' ? 'reduced' : 'ordinary';
            if (!group)
                break;
            const entries = scheduleEntriesForEdit(group, '', mode);
            if (!entries)
                break;
            const filtered = entries.filter(a => a.id !== button.dataset.session);
            if (filtered.length === entries.length)
                break;
            if (mode === 'reduced') {
                if (filtered.length)
                    group.reducedWeeklySchedule = filtered;
                else
                    delete group.reducedWeeklySchedule;
            }
            else
                group.weeklySchedule = filtered;
            update();
            notify('Activitat suprimida');
            break;
        }
        case 'tab':
            changeTab(button.dataset.tab);
            break;
        case 'set-theme':
            state.preferences.theme = validTheme(button.dataset.themeMode);
            update();
            break;
        case 'check-update':
            window.location.assign('./actualitza.html?comprovacio=' + Date.now());
            break;
        case 'open-legend':
            sheet = { type: 'legend' };
            render();
            break;
        case 'open-day-edit':
            if (calendarView === 'day') {
                sheet = { type: 'dayEdit', date: selectedDate };
                render();
            }
            break;
        case 'open-filters':
            sheet = { type: 'filters' };
            render();
            break;
        case 'open-zoom':
            if (calendarView === 'day' || calendarView === 'week') {
                sheet = { type: 'zoom' };
                render();
            }
            break;
        case 'close-sheet':
            sheet = null;
            render();
            break;
        case 'return-detail':
            sheet = returnFromDetail(button.dataset.date ?? detailReturnDate);
            render();
            break;
        case 'today': {
            selectedDate = localDate(new Date());
            const now = parseDate(selectedDate);
            viewMonth = now.getMonth();
            viewYear = now.getFullYear();
            monthScrollTarget = true;
            render();
            break;
        }
        case 'timeline-zoom-step': {
            if (calendarView !== 'day' && calendarView !== 'week')
                break;
            const index = TIMELINE_ZOOM_LEVELS.indexOf(timelineZoomForView());
            const next = TIMELINE_ZOOM_LEVELS[Math.max(0, Math.min(TIMELINE_ZOOM_LEVELS.length - 1, index + (button.dataset.step === '-1' ? -1 : 1)))];
            if (next !== undefined)
                setTimelineZoomForView(next);
            break;
        }
        case 'calendar-view': {
            const v = button.dataset.view;
            if (v === 'year' || v === 'month' || v === 'week' || v === 'day') {
                if (v === calendarView && tab === 'calendar')
                    break;
                tab = 'calendar';
                sheet = null;
                calendarView = v;
                const d = parseDate(selectedDate);
                viewYear = d.getFullYear();
                viewMonth = d.getMonth();
                monthScrollTarget = true;
                render();
            }
            break;
        }
        case 'calendar-navigate':
            navigateCalendar(Number(button.dataset.step) === -1 ? -1 : 1);
            break;
        case 'prev-month':
            goToMonth(-1);
            break;
        case 'next-month':
            goToMonth(1);
            break;
        case 'open-school-activity': {
            const date = button.dataset.date ?? '', childId = button.dataset.child ?? '', schoolId = button.dataset.school ?? '', sessionId = button.dataset.session ?? '';
            if (schoolActivities(date, activeChildren()).some(a => a.id === sessionId && a.schoolId === schoolId && a.childId === childId)) {
                detailOrigin = button.closest('.month-day-sheet') ? 'day' : 'calendar';
                detailReturnDate = date;
                sheet = { type: 'schoolActivity', date, childId, schoolId, sessionId };
                render();
            }
            break;
        }
        case 'show-calendar-month': {
            const year = Number(button.dataset.year), month = Number(button.dataset.month);
            if (!Number.isInteger(year) || year < 100 || year > 9999 || !Number.isInteger(month) || month < 0 || month > 11)
                break;
            viewYear = year;
            viewMonth = month;
            selectedDate = localDate(new Date(year, month, 1, 12));
            calendarView = 'month';
            monthScrollTarget = true;
            sheet = null;
            render();
            break;
        }
        case 'show-calendar-day':
        case 'open-day': {
            const date = button.dataset.date ?? '';
            if (!isValidDate(date))
                break;
            selectedDate = date;
            calendarView = 'day';
            sheet = null;
            const day = parseDate(date);
            viewYear = day.getFullYear();
            viewMonth = day.getMonth();
            render();
            break;
        }
        case 'show-calendar-week': {
            const date = button.dataset.date ?? '';
            if (!isValidDate(date))
                break;
            const start = weekStart(date), today = localDate(new Date());
            selectedDate = today >= start && today <= addDays(start, 6) ? today : start;
            calendarView = 'week';
            sheet = null;
            render();
            break;
        }
        case 'day-slot-add': {
            const date = button.dataset.date ?? '';
            if (!isValidDate(date) || !state.children.length)
                break;
            detailOrigin = button.closest('.month-day-sheet') ? 'day' : 'calendar';
            detailReturnDate = date;
            sheet = { type: 'daySlotForm', date, childId: activeChildren()[0]?.id ?? state.children[0]?.id ?? '' };
            render();
            break;
        }
        case 'day-slot-edit': {
            const date = button.dataset.date ?? '', childId = button.dataset.child ?? '', slotId = button.dataset.slot ?? '';
            if (!isValidDate(date) || !childById(childId) || !monthDayUI.find(state, date, childId, slotId))
                break;
            detailOrigin = button.closest('.month-day-sheet') ? 'day' : 'calendar';
            detailReturnDate = date;
            sheet = { type: 'daySlotForm', date, childId, slotId };
            render();
            break;
        }
        case 'day-slot-delete': {
            const date = button.dataset.date ?? '', childId = button.dataset.child ?? '', slotId = button.dataset.slot ?? '';
            if (!isValidDate(date) || !childById(childId) || !monthDayUI.find(state, date, childId, slotId))
                break;
            if (!confirm('Vols eliminar aquesta franja puntual?'))
                break;
            monthDayUI.remove(state, date, childId, slotId);
            sheet = returnFromDetail(date);
            update();
            notify('Franja eliminada');
            break;
        }
        case 'day-restore': {
            const date = button.dataset.date ?? '';
            if (!isValidDate(date) || !monthDayUI.hasChanges(state, date))
                break;
            if (!confirm('Vols eliminar tots els canvis puntuals d’aquest dia i recuperar la planificació habitual?'))
                break;
            monthDayUI.restore(state, date);
            rotationPatterns.clearDate(state, date);
            sheet = null;
            update();
            notify('Dia restaurat segons la rotació');
            break;
        }
        case 'edit-band': {
            const band = button.dataset.band ?? '', date = button.dataset.date ?? '', childId = button.dataset.child ?? '';
            if (isTimeBand(band) && isValidDate(date) && childById(childId)) {
                detailOrigin = button.closest('.month-day-sheet') ? 'day' : 'calendar';
                detailReturnDate = button.dataset.viewDate ?? date;
                sheet = { type: 'bandEdit', date, childId, band, viewDate: button.dataset.viewDate ?? date };
                render();
            }
            break;
        }
        case 'assign-band': {
            const date = button.dataset.date ?? '', childId = button.dataset.child ?? '', band = button.dataset.band ?? '', gId = button.dataset.guardian ?? '';
            if (!isValidDate(date) || !childById(childId) || !isTimeBand(band) || band === 'nit' || (gId && !guardian(gId)))
                break;
            state.bandOverrides[bandKey(date, childId, band)] = gId;
            sheet = returnFromDetail(date);
            update();
            notify('Franja actualitzada');
            break;
        }
        case 'clear-band': {
            const date = button.dataset.date ?? '', childId = button.dataset.child ?? '', band = button.dataset.band ?? '';
            if (!isTimeBand(band))
                break;
            delete state.bandOverrides[bandKey(date, childId, band)];
            sheet = returnFromDetail(date);
            update();
            notify('Assignació automàtica restaurada');
            break;
        }
        case 'toggle-filter': {
            const kind = button.dataset.filterKind === 'child' ? 'visibleChildren' : button.dataset.filterKind === 'school' ? 'visibleSchools' : 'visibleGuardians', id = button.dataset.id;
            const selected = state.preferences[kind];
            state.preferences[kind] = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
            update();
            break;
        }
        case 'toggle-holy-week':
            state.preferences.showHolyWeek = !state.preferences.showHolyWeek;
            update();
            break;
        case 'filter-all':
            state.preferences.showHolyWeek = true;
            state.preferences.visibleChildren = state.children.map(c => c.id);
            state.preferences.visibleGuardians = state.guardians.map(g => g.id);
            state.preferences.visibleSchools = state.schools.map(s => s.id);
            if (state.personTimeOff)
                personalTimeOff.showAll(state);
            update();
            break;
        case 'assign-night': {
            const date = button.dataset.date, childId = button.dataset.child, gId = button.dataset.guardian;
            if (!childById(childId) || !guardian(gId))
                break;
            sheet = returnFromDetail(date);
            chooseGuardian(date, childId, gId);
            break;
        }
        case 'clear-night':
            delete state.overrides[`${button.dataset.date}|${button.dataset.child}`];
            sheet = returnFromDetail(button.dataset.date);
            update();
            notify('Patró habitual restaurat');
            break;
        case 'night-date-time-clear': {
            const date = button.dataset.date ?? '';
            delete state.nightDateTimes[date + '|' + button.dataset.child];
            sheet = returnFromDetail(date);
            update();
            notify('Hora habitual restaurada');
            break;
        }
        case 'extra-date-clear': {
            const { date, rotation: rotationId, child: childId } = button.dataset;
            delete state.extraExceptions[`${rotationId}|${date}|${childId}`];
            sheet = returnFromDetail(date ?? '');
            update();
            notify('Rotació restaurada');
            break;
        }
        case 'extra-date-choose': {
            const date = button.dataset.date ?? '';
            if (!isValidDate(date))
                break;
            sheet = { type: 'extraDate', rotationId: '', childId: '', date };
            render();
            break;
        }
        case 'edit-extra-slot': {
            const date = button.dataset.date ?? '', rotationId = button.dataset.rotation ?? '', childId = button.dataset.child ?? '';
            if (!isValidDate(date) || !state.extraRotations.some(r => r.id === rotationId && r.childIds.includes(childId)))
                break;
            detailOrigin = button.closest('.month-day-sheet') ? 'day' : 'calendar';
            detailReturnDate = date;
            sheet = { type: 'extraDate', rotationId, childId, date };
            render();
            break;
        }
        case 'extra-cell': {
            const rotationId = button.dataset.rotation ?? '', childId = button.dataset.child ?? '', index = Number(button.dataset.index);
            const rotation = rotationEditor.draftState(state, extraRotationDrafts, rotationId).extraRotations.find((r) => r.id === rotationId);
            if (!rotation || !rotation.childIds.includes(childId) || !Number.isInteger(index) || index < 0 || index >= rotation.length)
                break;
            sheet = { type: 'extraCell', rotationId, childId, index };
            render();
            break;
        }
        case 'extra-save': {
            const id = button.dataset.rotation ?? '', error = rotationEditor.saveDraft(state, extraRotationDrafts, id);
            if (error) {
                notify(error);
                break;
            }
            update();
            notify('Canvis de la rotació desats');
            break;
        }
        case 'extra-cancel': {
            const id = button.dataset.rotation ?? '';
            delete extraRotationDrafts[id];
            if (!state.extraRotations.some(r => r.id === id))
                extraRotationOpen = null;
            render();
            notify('Canvis descartats');
            break;
        }
        case 'extra-add':
        case 'extra-toggle':
        case 'extra-delete':
        case 'extra-child':
        case 'extra-week':
        case 'extra-all':
        case 'extra-copy': {
            const id = button.dataset.rotation ?? '', work = rotationEditor.draftState(state, extraRotationDrafts, id);
            const result = rotationEditor.click(work, button.dataset.action, button.dataset, newId, localDate(new Date()), confirm);
            if (!result)
                break;
            if (button.dataset.action === 'extra-add') {
                const added = work.extraRotations.find((r) => r.id === result.open);
                if (added)
                    extraRotationDrafts[added.id] = added;
            }
            if (button.dataset.action === 'extra-delete') {
                delete extraRotationDrafts[id];
                state.extraRotations = state.extraRotations.filter(r => r.id !== id);
                state.extraExceptions = work.extraExceptions;
                extraRotationOpen = null;
                update();
                break;
            }
            extraRotationOpen = result.toggle && extraRotationOpen === result.open ? null : result.open;
            render();
            break;
        }
        case 'add-child': {
            const id = newId();
            const prev = state.children[0];
            const name = `Fill ${state.children.length + 1}`;
            state.children.push({ id, name, birthDate: '' });
            state.preferences.visibleChildren.push(id);
            for (const extra of state.extraRotations) {
                if (extra.kind !== 'night' && extra.childIds.length === state.children.length - 1) {
                    extra.childIds.push(id);
                    extra.assignments[id] = [...(extra.assignments[prev?.id ?? ''] ?? Array.from({ length: extra.length }, () => ''))];
                }
            }
            extraRotationDrafts = {};
            extraRotationOpen = null;
            sheet = { type: 'personDetails', personKey: 'child:' + id };
            update();
            notify('Fill afegit');
            break;
        }
        case 'add-guardian': {
            const palette = ['#b2a0e9', '#97cbb7', '#f0c17c', '#8eb9d9', '#d6a8bb'];
            const color = palette[state.guardians.length % palette.length] ?? '#aabbcc', id = newId();
            state.guardians.push({ id, name: `Tutor ${state.guardians.length + 1}`, color });
            state.preferences.visibleGuardians.push(id);
            sheet = { type: 'personDetails', personKey: 'guardian:' + id };
            update();
            notify('Tutor afegit');
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
        case 'clear-all':
            clearAllData();
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
            finishNativePickerEdit();
            sheet = null;
            render();
        }
        return;
    }
    if (actionButton.matches('button') && !actionButton.disabled) {
        finishNativePickerEdit();
        clickAction(actionButton);
    }
});
document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement))
        return;
    finishNativePickerEdit();
    if (form.dataset.workRotationForm) {
        event.preventDefault();
        if (sheet?.type !== 'personWork')
            return;
        workSchedule.readForm(sheet.draft, new FormData(form));
        const key = sheet.personKey, error = workSchedule.save(state, key, sheet.draft, newId);
        if (error) {
            notify(error);
            return;
        }
        sheet = { type: 'personDetails', personKey: key };
        update();
        notify('Rotació de feina desada');
        return;
    }
    if (form.dataset.personVacationForm) {
        event.preventDefault();
        const key = form.dataset.person ?? '', error = personalTimeOff.saveVacation(state, key, form.dataset.period ?? '', new FormData(form), newId);
        if (error) {
            notify(error);
            return;
        }
        sheet = { type: 'personDetails', personKey: key };
        update();
        notify('Vacances desades');
        return;
    }
    if (form.dataset.extraPatternDayForm) {
        event.preventDefault();
        const error = rotationEditor.savePatternDay(rotationEditor.draftState(state, extraRotationDrafts, form.dataset.rotation), form.dataset.rotation ?? '', form.dataset.child ?? '', Number(form.dataset.index), new FormData(form));
        if (error) {
            notify(error);
            return;
        }
        sheet = null;
        render();
        notify('Dia aplicat a l’esborrany. Prem «Desa els canvis» per confirmar-lo.');
        return;
    }
    if (form.dataset.extraDateForm) {
        event.preventDefault();
        const date = form.dataset.date ?? '', rotationId = form.dataset.rotation ?? '', childId = form.dataset.child ?? '';
        const error = rotationEditor.saveDate(state, date, rotationId, childId, new FormData(form));
        if (error) {
            notify(error);
            return;
        }
        sheet = returnFromDetail(date);
        update();
        notify('Excepció de rotació desada');
        return;
    }
    if (form.dataset.daySlotForm) {
        event.preventDefault();
        const date = form.dataset.date ?? '', slotId = form.dataset.slot ?? '';
        const values = new FormData(form), childId = slotId ? form.dataset.child ?? '' : String(values.get('childId') ?? '');
        if (values.has('endAtMidnight'))
            values.set('endTime', '24:00');
        const error = monthDayUI.save(state, date, childId, slotId, values, newId);
        if (error) {
            notify(error);
            return;
        }
        sheet = returnFromDetail(date);
        update();
        notify('Franja puntual desada');
        return;
    }
    if (!form.dataset.schoolForm)
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
        const color = get('color').toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(color)) {
            notify('Tria un color vàlid');
            return;
        }
        if (state.schools.some(s => s.id !== school?.id && s.color.toLowerCase() === color)) {
            notify('Aquest color ja correspon a una altra escola');
            return;
        }
        if (school) {
            school.name = name;
            school.address = get('address').slice(0, 200);
            school.phone = get('phone').slice(0, 50);
            school.color = color;
            finish('Escola actualitzada');
        }
        else {
            const id = newId();
            state.schools.push({ id, name, address: get('address').slice(0, 200), phone: get('phone').slice(0, 50), color, years: [], weeklySchedule: [], childIds: [] });
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
            if ([...year.holidays, ...year.reducedDays].some(d => d < startDate || d > endDate) || (year.vacations ?? []).some(p => p.startDate < startDate || p.endDate > endDate)) {
                notify('Hi ha dies especials fora de les noves dates. Revisa’ls abans.');
                return;
            }
            year.startDate = startDate;
            year.endDate = endDate;
            finish('Dates del curs actualitzades');
        }
        else {
            const id = newId();
            school.years.push({ id, startDate, endDate, holidays: [], vacations: [], reducedDays: [], groups: [] });
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
            year.groups.push({ id, name, tutorName, weeklySchedule: [], childIds: [], childSchedules: {} });
            schoolNav = { schoolId: school.id, yearId: year.id, groupId: id };
            finish('Grup classe afegit');
        }
        return;
    }
    if (formKind === 'vacation') {
        if (!year)
            return;
        const name = get('name').slice(0, 120), startDate = get('startDate'), endDate = get('endDate'), id = form.dataset.vacation ?? '';
        if (!name) {
            notify('Indica el nom del període de vacances');
            return;
        }
        if (!isValidDate(startDate) || !isValidDate(endDate) || startDate > endDate) {
            notify('La data final no pot ser anterior a la inicial');
            return;
        }
        if (startDate < year.startDate || endDate > year.endDate) {
            notify('Les vacances han d’estar compreses dins del curs escolar');
            return;
        }
        if (year.reducedDays.some(d => d >= startDate && d <= endDate)) {
            notify('Hi ha dies d’horari reduït dins del període. Revisa’ls abans.');
            return;
        }
        year.vacations ??= [];
        const existing = year.vacations.find(p => p.id === id);
        if (id && !existing) {
            notify('Aquest període ja no existeix');
            return;
        }
        if (!existing && year.vacations.length >= 100) {
            notify('No es poden afegir més de 100 períodes per curs');
            return;
        }
        if (existing) {
            existing.name = name;
            existing.startDate = startDate;
            existing.endDate = endDate;
        }
        else
            year.vacations.push({ id: newId(), name, startDate, endDate });
        year.vacations.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
        finish(existing ? 'Vacances escolars actualitzades' : 'Vacances escolars afegides');
        return;
    }
    if (formKind === 'day') {
        if (!year || sheet?.type !== 'schoolDayForm' || sheet.schoolId !== school?.id || sheet.yearId !== year.id || sheet.kind !== form.dataset.kind)
            return;
        const kind = sheet.kind, dates = [...new Set(sheet.dates)].sort();
        if (dates.some(date => schoolDayUnavailableReason(year, kind, date))) {
            notify('Revisa els dies seleccionats: hi ha dates fora del curs o incompatibles.');
            return;
        }
        if (kind === 'holiday')
            year.holidays = dates;
        else
            year.reducedDays = dates;
        finish(kind === 'holiday' ? 'Dies festius desats' : 'Dies de jornada reduïda desats');
        return;
    }
    if (formKind === 'reducedWindow') {
        if (!year)
            return;
        const startTime = get('startTime'), endTime = get('endTime');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) {
            notify('Indica unes hores vàlides, amb el final posterior a l’inici');
            return;
        }
        const window = { startTime, endTime };
        if (year.groups.some(g => (g.reducedWeeklySchedule !== undefined && !inReducedWindow(g.reducedWeeklySchedule, window)) || Object.values(g.reducedChildSchedules ?? {}).some(a => !inReducedWindow(a, window)))) {
            notify('Hi ha franges especials fora d’aquest interval. Modifica-les abans de canviar les hores.');
            return;
        }
        year.reducedWindow = window;
        finish('Hores de jornada reduïda desades');
        return;
    }
    if (formKind === 'ordinaryWindow') {
        if (!year)
            return;
        const startTime = get('startTime'), endTime = get('endTime');
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) {
            notify('Indica unes hores vàlides, amb el final posterior a l’inici');
            return;
        }
        year.ordinaryWindow = { startTime, endTime };
        finish('Hores de jornada ordinària desades');
        return;
    }
    if (formKind === 'schedule') {
        if (!group)
            return;
        const childId = '', mode = form.dataset.mode === 'reduced' ? 'reduced' : 'ordinary';
        const entries = scheduleEntriesForEdit(group, childId, mode);
        if (mode === 'reduced' && !year?.reducedWindow) {
            notify('Primer cal configurar les hores de jornada reduïda');
            return;
        }
        if (!entries)
            return;
        const existing = entries.find(a => a.id === form.dataset.session);
        if (form.dataset.session && !existing) {
            notify('Aquesta franja ja no existeix');
            return;
        }
        const days = existing ? [Number(get('weekday'))] : values.getAll('weekdays').map(Number);
        const startTime = get('startTime'), endTime = get('endTime'), kind = get('kind');
        if (!days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(days).size !== days.length) {
            notify('Selecciona com a mínim un dia vàlid');
            return;
        }
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || startTime >= endTime) {
            notify('L’hora final ha de ser posterior a la inicial');
            return;
        }
        if (mode === 'reduced' && year?.reducedWindow && (startTime < year.reducedWindow.startTime || endTime > year.reducedWindow.endTime)) {
            notify('Aquesta franja queda fora de les hores de jornada reduïda');
            return;
        }
        if (!SESSION_KINDS.includes(kind)) {
            notify('Tria un tipus d’activitat vàlid');
            return;
        }
        if (mode === 'ordinary' && (!year?.ordinaryWindow || startTime < year.ordinaryWindow.startTime || endTime > year.ordinaryWindow.endTime)) {
            notify('L’activitat ha d’estar dins de les hores de jornada ordinària del curs');
            return;
        }
        if (days.some(day => entries.some(a => a.id !== existing?.id && a.weekday === day && a.startTime < endTime && a.endTime > startTime))) {
            notify('Hi ha una franja que se solapa amb aquest horari');
            return;
        }
        const label = get('label').slice(0, 80);
        if (mode === 'reduced' && group.reducedWeeklySchedule === undefined)
            group.reducedWeeklySchedule = entries;
        if (existing) {
            existing.weekday = days[0];
            existing.startTime = startTime;
            existing.endTime = endTime;
            existing.kind = kind;
            existing.label = label;
            finish('Franja horària actualitzada');
        }
        else {
            for (const weekday of days)
                entries.push({ id: newId(), weekday, startTime, endTime, kind: kind, label });
            finish('Franges horàries afegides');
        }
        return;
    }
});
document.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement))
        return;
    if (target.dataset.action === 'timeline-zoom') {
        const next = TIMELINE_ZOOM_LEVELS[Number(target.value)];
        if (next !== undefined) {
            const output = document.getElementById('timeline-zoom-value');
            if (output)
                output.textContent = next + '%';
            target.setAttribute('aria-valuetext', next + ' per cent');
        }
        return;
    }
    if (target.dataset.action !== 'font-size')
        return;
    const chosen = FONT_SIZE_OPTIONS[Number(target.value)];
    if (!chosen)
        return;
    state.preferences.fontSize = chosen;
    applyFontSize();
    const current = document.getElementById('font-size-current');
    if (current)
        current.textContent = FONT_SIZE_LABELS[chosen];
    target.setAttribute('aria-valuetext', FONT_SIZE_LABELS[chosen]);
});
document.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))
        return;
    const action = target.dataset.action;
    if (target.dataset.workField && sheet?.type === 'personWork') {
        if (workSchedule.change(sheet.draft, target.dataset.workField, target.value, Number(target.dataset.day), Number(target.dataset.slot), target.dataset.edge) && target.dataset.workField === 'weeks')
            render();
        return;
    }
    if (action === 'timeline-zoom') {
        if (calendarView === 'day' || calendarView === 'week') {
            const next = TIMELINE_ZOOM_LEVELS[Number(target.value)];
            if (next !== undefined)
                setTimelineZoomForView(next);
        }
        return;
    }
    if (action === 'font-size') {
        const chosen = FONT_SIZE_OPTIONS[Number(target.value)];
        if (chosen) {
            state.preferences.fontSize = chosen;
            applyFontSize();
            saveState();
        }
        return;
    }
    if (action === 'night-date-time' && isValidDate(target.dataset.date ?? '') && childById(target.dataset.child ?? '')) {
        state.nightDateTimes[target.dataset.date + '|' + target.dataset.child] = validChangeTime(target.value);
        update();
    }
    else if (target.dataset.extraChange) {
        const work = rotationEditor.draftState(state, extraRotationDrafts, target.dataset.rotation);
        const result = rotationEditor.change(work, target.dataset, target instanceof HTMLInputElement && target.type === 'checkbox' ? String(target.checked) : target.value, extraRotationUnits);
        if (result?.error) {
            notify(result.error);
            render();
        }
        else if (['unit', 'length'].includes(target.dataset.extraChange))
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
    else if (action === 'person-off-color') {
        if (personalTimeOff.setColor(state, target.dataset.person ?? '', target.dataset.kind ?? '', target.value))
            update();
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
    finishNativePickerEdit();
    sheet = null;
    render();
} });
// focusout pot precedir el clic de Desa/Fet. Esperem el final del gest perquè
// el botó o formulari no desaparegui entre pointerdown i click.
document.addEventListener('pointerdown', () => { nativePickerPointerDown = true; window.clearTimeout(nativePickerRenderTimer); }, true);
document.addEventListener('pointerup', () => { nativePickerPointerDown = false; queueNativePickerRender(); }, true);
document.addEventListener('pointercancel', () => { nativePickerPointerDown = false; queueNativePickerRender(); }, true);
document.addEventListener('focusout', () => queueNativePickerRender(), true);
document.addEventListener('click', () => queueNativePickerRender(0));
async function init() {
    await loadState();
    applyTheme();
    applyFontSize();
    await document.fonts?.load('800 22px "Roboto Condensed"').catch(() => []);
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => reg.update().catch(() => { })).catch(err => console.warn('Service worker no registrat:', err));
    }
}
void init();

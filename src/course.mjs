// Book course (HSK Standard Course 1). Pure functions shared by the UI and the tests.
// Progress here is per PHRASE and per communicative goal, kept apart from the HSK 3.0 word repertoire.
import {normalizeAnswer, scheduleEntries} from './progress.mjs';

/** @typedef {{task:string,kind:string,text:string,correct:boolean,assisted:boolean,modality:string,at:string,matched:string|null}} CourseAttempt */
/** @typedef {{phrase:string,at:string,modality:string}} CourseExposure */
/** @typedef {{type:'es'|'zh',text?:string,hanzi?:string,pinyin?:string,es?:string,source?:string}} CaptionPart */
const HAN = /\p{Script=Han}/u;
const RANK = {none:-1, exposed:0, recognized:2, repeated:3, independent:4};
export const STAGE_LABEL = {
  none: 'Sin empezar',
  exposed: 'Escuchada',
  recognized: 'Reconocida',
  repeated: 'Dicha con apoyo',
  independent: 'Usada sin modelo',
};

// ── Lookup ───────────────────────────────────────────────────────────────
export const availableLessons = course => course.lessons.filter(l => l.status === 'available');
export function phraseIndex(course) {
  const index = new Map();
  for (const lesson of availableLessons(course)) for (const phrase of lesson.phrases) index.set(phrase.id, {...phrase, lessonId: lesson.id});
  return index;
}
export const phraseOf = (lesson, id) => lesson.phrases.find(p => p.id === id);
// Words of every available lesson up to (and including) this one: what the teacher may say in Chinese.
export function wordsUpTo(course, lesson) {
  return availableLessons(course).filter(l => l.number <= lesson.number).flatMap(l => l.words);
}

// ── Answer matching ──────────────────────────────────────────────────────
// Typed pinyin: case, spaces, punctuation and apostrophes are ignored; ü may be written ü, v or u:.
// Tones are NOT compared (tone marks, tone numbers and tone sandhi spellings all reduce to the same letters):
// the app says so instead of pretending to grade tones from text.
export function normalizePinyin(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase()
    .replace(/u:/g, 'v')
    .replace(/[üǖǘǚǜ]/g, 'v')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z]/g, '');
}
export const hasHan = text => HAN.test(String(text || ''));

// ── Personal answers with a bounded slot ─────────────────────────────────
// A phrase with "slots" (e.g. 我今年…岁。) accepts each "…" filled with ONE value of that slot: a number in a
// fixed range (Chinese numerals, pinyin or digits) or an item of a short list. Nothing else, and no prefix match.
// two: how 2 is said on its own in that context (两岁, 两口人, 两块; but 二月, 二号).
const LIST = (...items) => items.map(([zh, py, es]) => ({zh, py, es}));
export const SLOTS = {
  age: {type: 'number', min: 1, max: 99, two: 'liang', es: 'tu edad, del 1 al 99, en pinyin o en cifras (2 = liǎng)'},
  count: {type: 'number', min: 1, max: 20, two: 'liang', es: 'cuántas personas, del 1 al 20, en pinyin o en cifras (2 = liǎng)'},
  money: {type: 'number', min: 1, max: 99, two: 'liang', es: 'un precio del 1 al 99, en pinyin o en cifras (2 = liǎng)'},
  month: {type: 'number', min: 1, max: 12, two: 'er', es: 'el mes, del 1 al 12'},
  day: {type: 'number', min: 1, max: 31, two: 'er', es: 'el día, del 1 al 31'},
  weekday: {type: 'list', es: 'el día de la semana', values: LIST(['一', 'yī', 'lunes'], ['二', 'èr', 'martes'], ['三', 'sān', 'miércoles'], ['四', 'sì', 'jueves'], ['五', 'wǔ', 'viernes'], ['六', 'liù', 'sábado'], ['日', 'rì', 'domingo'], ['天', 'tiān', 'domingo'])},
  country: {type: 'list', es: 'tu país', extra: 'Salvo China y Estados Unidos, estos países no están en el libro: son apoyo para contestar con la verdad.', values: LIST(['中国', 'Zhōngguó', 'China'], ['美国', 'Měiguó', 'Estados Unidos'], ['秘鲁', 'Bìlǔ', 'Perú'], ['墨西哥', 'Mòxīgē', 'México'],
    ['西班牙', 'Xībānyá', 'España'], ['阿根廷', 'Āgēntíng', 'Argentina'], ['哥伦比亚', 'Gēlúnbǐyà', 'Colombia'], ['智利', 'Zhìlì', 'Chile'], ['委内瑞拉', 'Wěinèiruìlā', 'Venezuela'],
    ['厄瓜多尔', 'Èguāduō’ěr', 'Ecuador'], ['玻利维亚', 'Bōlìwéiyà', 'Bolivia'], ['乌拉圭', 'Wūlāguī', 'Uruguay'], ['巴拉圭', 'Bālāguī', 'Paraguay'], ['古巴', 'Gǔbā', 'Cuba'],
    ['多米尼加', 'Duōmǐníjiā', 'República Dominicana'], ['哥斯达黎加', 'Gēsīdálíjiā', 'Costa Rica'], ['巴拿马', 'Bānámǎ', 'Panamá'], ['危地马拉', 'Wēidìmǎlā', 'Guatemala'],
    ['洪都拉斯', 'Hóngdūlāsī', 'Honduras'], ['萨尔瓦多', 'Sà’ěrwǎduō', 'El Salvador'], ['尼加拉瓜', 'Níjiālāguā', 'Nicaragua'], ['巴西', 'Bāxī', 'Brasil'],
    ['英国', 'Yīngguó', 'Reino Unido'], ['法国', 'Fǎguó', 'Francia'], ['德国', 'Déguó', 'Alemania'], ['意大利', 'Yìdàlì', 'Italia'], ['加拿大', 'Jiānádà', 'Canadá'], ['日本', 'Rìběn', 'Japón'])},
  drink: {type: 'list', es: 'lo que quieres beber', extra: 'Agua y café no están en esta lección del libro.', values: LIST(['茶', 'chá', 'té'], ['水', 'shuǐ', 'agua'], ['咖啡', 'kāfēi', 'café'])},
  workplace: {type: 'list', es: 'dónde trabajas', extra: 'Empresa (gōngsī) no está en esta lección del libro.', values: LIST(['学校', 'xuéxiào', 'una escuela'], ['医院', 'yīyuàn', 'un hospital'], ['商店', 'shāngdiàn', 'una tienda'],
    ['家', 'jiā', 'casa'], ['公司', 'gōngsī', 'una empresa'], ['饭馆儿', 'fànguǎnr', 'un restaurante'])},
};
const UNITS_PY = ['yi', 'er', 'san', 'si', 'wu', 'liu', 'qi', 'ba', 'jiu'];
const UNITS_ZH = '一二三四五六七八九';
const NUM_PY = new RegExp(`^(?:(${UNITS_PY.join('|')})?(shi))?(${UNITS_PY.join('|')})?$`);
const NUM_ZH = new RegExp(`^(?:([${UNITS_ZH}])?(十))?([${UNITS_ZH}])?$`);
// Parses 1–99 written as digits, Chinese numerals or toneless pinyin. Returns NaN for anything else.
export function parseNumber(raw, slot) {
  if (!raw) return NaN;
  if (/^\d{1,3}$/.test(raw)) return Number(raw);
  if (raw === 'liang' || raw === '两') return slot.two === 'liang' ? 2 : NaN;
  const han = hasHan(raw);
  const m = raw.match(han ? NUM_ZH : NUM_PY);
  if (!m) return NaN;
  const unit = x => x ? (han ? UNITS_ZH.indexOf(x) : UNITS_PY.indexOf(x)) + 1 : 0;
  const [, tens, ten, ones] = m;
  if (ten && unit(tens) === 1) return NaN; // 一十 is not how 10–19 are said
  const value = (ten ? (tens ? unit(tens) : 1) * 10 : 0) + unit(ones);
  if (value === 2 && !ten && slot.two === 'liang') return NaN; // 二岁, 二口人, 二块 → 两
  return value;
}
const WEEKDAY = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 7, '天': 7};
function slotValue(raw, name, han) {
  const slot = SLOTS[name];
  if (!slot || !raw) return null;
  if (slot.type === 'number') {
    const n = parseNumber(raw, slot);
    return Number.isInteger(n) && n >= slot.min && n <= slot.max ? n : null;
  }
  const item = slot.values.find(v => han ? v.zh === raw : normalizePinyin(v.py) === raw);
  if (!item) return null;
  return name === 'weekday' ? WEEKDAY[item.zh] : item.zh;
}
// Pinyin that keeps written numbers: "jiu3 yue4 1 hao4" → "jiuyue1hao". A single digit 1–5 right after a letter is a tone.
function pinyinWithDigits(text) {
  return text.toLowerCase().replace(/u:/g, 'v').replace(/[üǖǘǚǜ]/g, 'v').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/([a-z])[1-5](?![0-9])/g, '$1').replace(/[^a-z0-9]/g, '');
}
// Fills the slots of a phrase from an answer. Returns the values, or null when it does not fit.
export function slotValues(text, phrase) {
  if (typeof text !== 'string' || !Array.isArray(phrase?.slots)) return null;
  const han = hasHan(text);
  const typed = han ? normalizeAnswer(text) : pinyinWithDigits(text);
  const parts = (han ? phrase.hanzi : phrase.pinyin).split('…').map(p => han ? normalizeAnswer(p) : normalizePinyin(p));
  if (parts.length !== phrase.slots.length + 1) return null;
  const pattern = new RegExp('^' + parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$', 'u');
  const m = typed.match(pattern);
  if (!m) return null;
  const values = phrase.slots.map((name, i) => slotValue(m[i + 1], name, han));
  return values.every(v => v !== null) ? values : null;
}
// "today": a date answer must be the real date of the attempt (local time of the device).
function fitsToday(phrase, values, today) {
  if (!today) return true;
  const expected = {month: today.getMonth() + 1, day: today.getDate(), weekday: today.getDay() || 7};
  return phrase.slots.every((name, i) => !(name in expected) || values[i] === expected[name]);
}

// Returns the matched phrase id (or null) for a typed/transcribed answer.
/** @param {string} text @param {any[]} phrases @param {{today?:Date}} [opts] */
export function matchAnswer(text, phrases, {today} = {}) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const han = hasHan(text);
  const typed = han ? normalizeAnswer(text) : normalizePinyin(text);
  if (!typed) return null;
  for (const phrase of phrases) {
    if (phrase.slots) {
      const values = slotValues(text, phrase);
      if (values && fitsToday(phrase, values, today)) return phrase.id;
      continue;
    }
    const target = han ? normalizeAnswer(phrase.hanzi.replace(/…/g, '')) : normalizePinyin(phrase.pinyin);
    if (!target) continue;
    if (phrase.prefix ? typed.startsWith(target) && typed.length > target.length : typed === target) return phrase.id;
  }
  return null;
}

// ── Examples for slot phrases ────────────────────────────────────────────
const UNIT_TONE = ['yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];
export const numberZh = n => (n >= 20 ? UNITS_ZH[Math.floor(n / 10) - 1] : '') + (n >= 10 ? '十' : '') + (n % 10 ? UNITS_ZH[n % 10 - 1] : '');
// èr after another syllable takes the syllable-dividing mark: shí'èr (book, p. 35).
export const numberPinyin = n => (n >= 20 ? UNIT_TONE[Math.floor(n / 10) - 1] : '') + (n >= 10 ? 'shí' : '') + (n % 10 ? (n > 10 && n % 10 === 2 ? "'" : '') + UNIT_TONE[n % 10 - 1] : '');
const MONTH_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAY_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const todayEs = date => `${WEEKDAY_ES[date.getDay()]} ${date.getDate()} de ${MONTH_ES[date.getMonth()]}`;
const DATED = ['month', 'day', 'weekday'];
// The model shown and played for a slot phrase. On a "today" step it is today's real date.
/** @returns {{hanzi:string,pinyin:string,es:string}|undefined} */
export function exampleOf(phrase, {today} = {}) {
  if (!phrase?.slots) return undefined;
  if (!today || !phrase.slots.some(s => DATED.includes(s))) return phrase.example;
  const fill = {
    month: [numberZh(today.getMonth() + 1), numberPinyin(today.getMonth() + 1)],
    day: [numberZh(today.getDate()), numberPinyin(today.getDate())],
    weekday: today.getDay() ? [UNITS_ZH[today.getDay() - 1], UNIT_TONE[today.getDay() - 1]] : ['天', 'tiān'],
  };
  const join = (template, k) => template.split('…').map((part, i) => i === 0 ? part : (fill[phrase.slots[i - 1]]?.[k] ?? '') + part).join('');
  const es = phrase.slots.includes('day')
    ? `Hoy es ${phrase.slots.includes('weekday') ? todayEs(today) : `${today.getDate()} de ${MONTH_ES[today.getMonth()]}`}.`
    : `Hoy es ${WEEKDAY_ES[today.getDay()]}.`;
  return {hanzi: join(phrase.hanzi, 0), pinyin: join(phrase.pinyin, 1), es};
}
// Short, honest description of what a slot phrase accepts, for the screen and for the teacher.
export function slotHint(phrase) {
  if (!phrase?.slots) return '';
  return [...new Set(phrase.slots)].map(name => {
    const slot = SLOTS[name];
    if (!slot) return '';
    if (slot.type === 'number') return `Pon ${slot.es}.`;
    if (name === 'weekday') return 'Día de la semana: xīngqī yī (lunes) … xīngqī liù (sábado); domingo: xīngqīrì o xīngqītiān.';
    return `Vale ${slot.es}: ${slot.values.map(v => `${v.py} (${v.es})`).join(', ')}.${slot.extra ? ' ' + slot.extra : ''}`;
  }).filter(Boolean).join(' ');
}
// Words of the slot lists, so the teacher's lines with them can be captioned with pinyin.
export const slotWords = () => Object.values(SLOTS).flatMap(s => s.type === 'list' ? s.values.map(v => ({hanzi: v.zh, pinyin: v.py, es: v.es})) : []);

// ── What the learner said ────────────────────────────────────────────────
// Spanish requests are commands for the teacher and the app, never graded as answers.
/** @type {[string, RegExp][]} */
const COMMANDS = [
  ['restart', /\b(volvamos|vuelve|volver|regresemos)\b.*\b(principio|comienzo|inicio)\b|\bdesde el (principio|comienzo|inicio)\b/],
  ['slow', /\b(mas|muy) (lento|despacio)\b|\bdespacio\b|\blento\b/],
  ['repeat', /\brepite\b|\brepitelo\b|\brepetir\b|\botra vez\b|\bde nuevo\b/],
  ['explain', /\bno (entendi|entiendo|comprendo)\b|\bque significa\b|\bque quiere decir\b/],
  ['wait', /\bespera\b|\bespere\b|\bun momento\b|\bpausa\b/],
  ['next', /\b(siguiente|sigamos|continuemos|continuar|adelante)\b/],
];
export function detectCommand(text) {
  if (typeof text !== 'string' || hasHan(text)) return null;
  const plain = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain || plain.split(' ').length > 9) return null;
  for (const [command, pattern] of COMMANDS) if (pattern.test(plain)) return command;
  return null;
}
// A transcript from the student's microphone. Pure Spanish that is not a command is talk, not an attempt.
/** @param {string} text @param {any[]} phrases @param {{at?:string, appAudio?:{start:number,end:number}[]}} [opts] @returns {{type:'command',command:string,reason?:string}|{type:'ignored',reason:string,command?:string}|{type:'attempt',reason?:string,command?:string}} */
export function routeUtterance(text, phrases, {at, appAudio = []} = {}) {
  const time = Date.parse(at || '');
  if (Number.isFinite(time) && appAudio.some(w => time >= w.start && time <= w.end)) return {type: 'ignored', reason: 'app-audio'};
  const command = detectCommand(text);
  if (command) return {type: 'command', command};
  if (hasHan(text)) return {type: 'attempt'};
  if (matchAnswer(text, phrases)) return {type: 'attempt'};
  return {type: 'ignored', reason: 'talk'};
}

// ── Runs ─────────────────────────────────────────────────────────────────
export function reviewLesson(lesson) {
  return {...lesson, id: lesson.id + '.review', review: true, steps: lesson.steps.filter(s => s.kind === 'recall')};
}
export function lessonById(course, id) {
  const base = course.lessons.find(l => l.id === String(id).replace(/\.review$/, '') && l.status === 'available');
  if (!base) return undefined;
  return String(id).endsWith('.review') ? reviewLesson(base) : base;
}
// The support card starts visible when you are learning, hidden when you are recalling.
export const supportDefault = step => step.kind === 'respond';
export function createCourseRun(lesson, now = new Date().toISOString(), id = crypto.randomUUID()) {
  return {id, date: now, lessonId: lesson.id, version: lesson.version, index: 0, passed: false, ended: false,
    supportVisible: supportDefault(lesson.steps[0]), supportUsed: supportDefault(lesson.steps[0]),
    attempts: /** @type {CourseAttempt[]} */([]), exposures: /** @type {CourseExposure[]} */([]), skipped: /** @type {{task:string,at:string}[]} */([])};
}
export function validCourseRun(run, lesson) {
  return !!run && !!lesson && typeof run.id === 'string' && run.lessonId === lesson.id && run.version === lesson.version
    && Number.isFinite(Date.parse(run.date)) && Number.isInteger(run.index) && run.index >= 0 && run.index < lesson.steps.length
    && typeof run.passed === 'boolean' && typeof run.ended === 'boolean' && typeof run.supportVisible === 'boolean' && typeof run.supportUsed === 'boolean'
    && Array.isArray(run.attempts) && run.attempts.every(a => a && typeof a.text === 'string' && typeof a.correct === 'boolean' && typeof a.assisted === 'boolean' && typeof a.modality === 'string' && lesson.steps.some(s => s.id === a.task) && Number.isFinite(Date.parse(a.at)))
    && Array.isArray(run.exposures) && run.exposures.every(e => e && typeof e.phrase === 'string' && Number.isFinite(Date.parse(e.at)))
    && Array.isArray(run.skipped);
}
// Withdrawing the support card hides it; it never erases the fact that it was used in this step.
export function setSupport(run, visible) {
  return {...run, supportVisible: visible, supportUsed: run.supportUsed || visible};
}
export function recordExposure(run, phraseId, {modality = 'listening', at = new Date().toISOString()} = {}) {
  return {...run, exposures: [...run.exposures, {phrase: phraseId, at, modality}]};
}
const CHOICE_MODALITIES = new Set(['choice', 'listening-choice', 'reading-choice']);
// modality: transcript (voice) | pinyin (typed pinyin) | text (typed characters) | choice | listening-choice | reading-choice
export function courseAttempt(run, lesson, text, {modality = 'pinyin', at = new Date().toISOString(), teacherModeled = false} = {}) {
  const step = lesson.steps[run.index];
  if (run.ended || !step || typeof text !== 'string' || !text.trim() || text.length > 500) throw Error('Respuesta no válida.');
  let correct = false, matched = null;
  if (step.kind === 'understand') correct = text === step.answer;
  else {
    const pool = step.kind === 'teach' ? step.lines.map(l => l.phrase) : step.answers;
    matched = matchAnswer(text, pool.map(id => phraseOf(lesson, id)).filter(Boolean), {today: step.today ? new Date(at) : undefined});
    correct = !!matched;
  }
  const assisted = step.kind === 'teach' || run.supportUsed || teacherModeled || CHOICE_MODALITIES.has(modality);
  const attempt = {task: step.id, kind: step.kind, text: text.trim(), correct, assisted, modality, at, matched};
  return {...run, attempts: [...run.attempts, attempt], passed: step.kind === 'teach' ? run.passed : run.passed || correct};
}
export const canAdvance = (run, lesson) => !run.ended && (lesson.steps[run.index].kind === 'teach' || run.passed);
// skip: "Repasarlo otro día" on a recall step. It is recorded, so the phrase comes back for review.
export function courseNext(run, lesson, {skip = false, at = new Date().toISOString()} = {}) {
  const step = lesson.steps[run.index];
  if (run.ended) throw Error('La lección ya terminó.');
  if (!canAdvance(run, lesson) && !(skip && step.kind === 'recall')) throw Error('Responde, elige una opción o pide ayuda antes de seguir.');
  const skipped = skip && !run.passed ? [...run.skipped, {task: step.id, at}] : run.skipped;
  if (run.index === lesson.steps.length - 1) return {...run, skipped, ended: true};
  const next = lesson.steps[run.index + 1];
  return {...run, skipped, index: run.index + 1, passed: false, supportVisible: supportDefault(next), supportUsed: supportDefault(next)};
}
export function restartRun(run, lesson) {
  return {...run, index: 0, passed: false, supportVisible: supportDefault(lesson.steps[0]), supportUsed: supportDefault(lesson.steps[0])};
}

// ── Evidence ─────────────────────────────────────────────────────────────
function phrasesOfStep(step) {
  if (step.kind === 'teach') return step.lines.map(l => l.phrase);
  if (step.kind === 'understand') return [step.cue];
  return [step.support];
}
// Stage rules: understanding = recognized; choosing a reply = recognized; saying/typing with any support
// or right after a model = repeated; only a recall step without support is independent use.
export function stageOf(attempt) {
  if (!attempt.correct) return 'needs_review';
  if (attempt.kind === 'understand' || CHOICE_MODALITIES.has(attempt.modality)) return 'recognized';
  if (attempt.kind === 'recall' && !attempt.assisted) return 'independent';
  return 'repeated';
}
export function courseEvents(run, lesson, course) {
  const base = {scope: 'course', framework: course.framework.id, lessonId: lesson.id, version: lesson.version};
  const wordsOf = ids => ids.map(id => phraseOf(lesson, id)?.hanzi).filter(Boolean);
  const exposures = run.exposures.map(e => ({...base, stage: 'exposed', phrases: [e.phrase], words: wordsOf([e.phrase]), at: e.at, modality: e.modality, evidence: phraseOf(lesson, e.phrase)?.hanzi || e.phrase, task: 'audio'}));
  const attempts = run.attempts.map(a => {
    const step = lesson.steps.find(s => s.id === a.task);
    const ids = a.matched ? [a.matched] : step ? phrasesOfStep(step) : [];
    return {...base, stage: stageOf(a), phrases: ids, words: wordsOf(ids), at: a.at, modality: a.modality, evidence: a.text, task: a.task};
  }).filter(e => e.phrases.length);
  const skipped = run.skipped.map(s => {
    const step = lesson.steps.find(x => x.id === s.task);
    const ids = step ? phrasesOfStep(step) : [];
    return {...base, stage: 'needs_review', phrases: ids, words: wordsOf(ids), at: s.at, modality: 'skipped', evidence: 'Lo dejó para otro día', task: s.task};
  });
  return [...exposures, ...attempts, ...skipped];
}
// A notebook session compatible with readHistory(): mode 'guided', snapshot of the exact lesson version.
export function courseSession(run, lesson, course) {
  const events = courseEvents(run, lesson, course);
  const said = [...new Set(events.filter(e => ['repeated', 'independent'].includes(e.stage)).flatMap(e => e.phrases))];
  const independent = events.some(e => e.stage === 'independent');
  return {id: run.id, date: run.date, level: 1, topic: `Lección ${lesson.number}${lesson.review ? ' · repaso' : ''} · ${lesson.title.pinyin} (${lesson.title.es})`,
    mode: 'guided', framework: course.framework.id, courseLessonId: lesson.id,
    duration: Math.max(0, Math.floor((Date.now() - Date.parse(run.date)) / 1000)),
    messages: run.attempts.map(a => ({role: 'user', text: a.text})), feedback: [], practiced: [],
    learningEvents: events, run, lessonSnapshot: lesson, ended: run.ended,
    summary: run.ended ? {kind: 'summary', practiced: said.map(id => phraseOf(lesson, id)?.pinyin).filter(Boolean), errors: [],
      recommendation: independent ? 'Vuelve mañana y prueba el repaso sin ayuda antes de escuchar los modelos.' : 'Vuelve mañana: primero intenta recordar, después usa el apoyo.',
      homework: 'Usa una de estas frases hoy en voz alta, sin mirar.', completed: true} : undefined};
}

// ── Progress ─────────────────────────────────────────────────────────────
export function deriveCourseProgress(history, course, intervals = [1, 3, 7, 14], now = Date.now()) {
  const entries = [];
  for (const session of history) for (const event of Array.isArray(session?.learningEvents) ? session.learningEvents : []) {
    if (!event || event.scope !== 'course' || event.framework !== course.framework.id || !Array.isArray(event.phrases)) continue;
    if (!['exposed', 'recognized', 'repeated', 'independent', 'needs_review'].includes(event.stage) || !Number.isFinite(Date.parse(event.at))) continue;
    for (const id of event.phrases) if (typeof id === 'string') entries.push({word: id, stage: event.stage, at: event.at, modality: event.modality});
  }
  return scheduleEntries(entries, intervals, now);
}
// A goal lists alternative ways to do ONE communicative act; the best evidence among them is the goal's status.
export function goalStatus(goal, progress, now = Date.now()) {
  const stages = goal.phrases.map(id => progress[id]?.stage || 'none');
  const stage = stages.reduce((best, s) => (RANK[s] ?? -1) > (RANK[best] ?? -1) ? s : best, 'none');
  // Recall without help makes sense on another day, not minutes after the model was shown.
  const sameDay = t => new Date(t).toDateString() === new Date(now).toDateString();
  // Due when every form you have actually said is due: one successful recall of any form clears the goal.
  const said = goal.phrases.map(id => progress[id]).filter(p => p && (RANK[p.stage] ?? -1) >= RANK.repeated);
  const due = said.length > 0 && said.every(p => p.nextDue <= now && !sameDay(p.lastSeen));
  return {stage, label: STAGE_LABEL[stage] || STAGE_LABEL.none, due};
}
export function lessonState(lesson, history, progress, now = Date.now()) {
  if (lesson.status !== 'available') return {status: 'future'};
  const sessions = history.filter(s => s?.run?.lessonId === lesson.id || s?.run?.lessonId === lesson.id + '.review');
  const pending = sessions.find(s => s.run && !s.run.ended && s.run.lessonId === lesson.id && validCourseRun(s.run, lesson));
  const pendingReview = sessions.find(s => s.run && !s.run.ended && s.run.lessonId === lesson.id + '.review' && validCourseRun(s.run, reviewLesson(lesson)));
  const done = sessions.some(s => s.run?.ended && s.run.lessonId === lesson.id);
  const goals = lesson.goals.map(g => ({...g, ...goalStatus(g, progress, now)}));
  const due = done && goals.some(g => g.due);
  return {status: pending ? 'in-progress' : due ? 'review' : done ? 'done' : 'new', pending, pendingReview, done, goals};
}

// ── Teacher captions ─────────────────────────────────────────────────────
// A Chinese line is shown as pinyin + natural Spanish when it is a reviewed phrase, or when the agent sent a
// structured caption (show_line). Otherwise: pinyin only if every word is known, and an honest "sin traducción".
const SENTENCE = /[^。！？!?]+[。！？!?]*/gu;
export function validateCaption(raw) {
  const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const field = (name, max) => {
    if (!event || typeof event[name] !== 'string' || !event[name].trim() || event[name].length > max) throw Error(`Campo no válido: ${name}`);
    return event[name].trim();
  };
  const hanzi = field('hanzi', 200);
  if (!hasHan(hanzi)) throw Error('La línea no contiene chino.');
  return {hanzi, pinyin: field('pinyin', 400), es: field('es', 400)};
}
export const captionKey = text => normalizeAnswer(String(text || '').replace(/…/g, ''));
function glossPinyin(text, words) {
  const index = [...words].sort((a, b) => b.hanzi.length - a.hanzi.length);
  const chars = normalizeAnswer(text);
  const out = [];
  for (let i = 0; i < chars.length;) {
    if (!HAN.test(chars[i])) { i++; continue; }
    const word = index.find(w => chars.startsWith(w.hanzi, i));
    if (!word) return null;
    out.push(word.pinyin); i += word.hanzi.length;
  }
  return out.join(' ');
}
/** @returns {CaptionPart|null} */
function captionChunk(chunk, reviewed, agent) {
  const key = captionKey(chunk);
  const known = reviewed.get(key) || agent.get(key);
  if (known) return {type: 'zh', hanzi: chunk.trim(), pinyin: known.pinyin, es: known.es, source: reviewed.has(key) ? 'reviewed' : 'agent'};
  return null;
}
export function reviewedIndex(course) {
  const map = new Map();
  for (const phrase of phraseIndex(course).values()) {
    if (phrase.slots) { if (phrase.example) map.set(captionKey(phrase.example.hanzi), phrase.example); }
    else if (!phrase.prefix) map.set(captionKey(phrase.hanzi), phrase);
  }
  return map;
}
/** @param {string} text @param {{reviewed:Map<string,any>, agent?:Map<string,any>, words?:any[]}} opts @returns {CaptionPart[]} */
export function captionLine(text, {reviewed, agent = new Map(), words = []}) {
  if (typeof text !== 'string' || !text.trim()) return [];
  /** @type {CaptionPart[]} */
  const parts = [];
  // Split into Chinese runs (with their punctuation) and the rest.
  const runs = text.match(/[\p{Script=Han}，。！？、：；“”…]+[!?.,]?|[^\p{Script=Han}，。！？、：；“”…]+/gu) || [];
  for (const run of runs) {
    if (!hasHan(run)) { if (run.trim()) parts.push({type: 'es', text: run.trim()}); continue; }
    const whole = captionChunk(run, reviewed, agent);
    if (whole) { parts.push(whole); continue; }
    for (const sentence of run.match(SENTENCE) || [run]) {
      const found = captionChunk(sentence, reviewed, agent);
      if (found) { parts.push(found); continue; }
      const pieces = (sentence.match(/[^，,]+[，,]?/gu) || [sentence]).map(c => captionChunk(c, reviewed, agent));
      if (pieces.length > 1 && pieces.every(Boolean)) { parts.push(.../** @type {CaptionPart[]} */(pieces)); continue; }
      const pinyin = glossPinyin(sentence, words);
      parts.push({type: 'zh', hanzi: sentence.trim(), pinyin: pinyin || '', es: '', source: pinyin ? 'words' : 'none'});
    }
  }
  return parts;
}

// ── Shared state with the voice teacher ──────────────────────────────────
const line = p => p ? `«${p.hanzi}» (${p.pinyin}: ${p.es})` : '';
/** @param {any} lesson @param {any} run @param {{progress?:Record<string, any>, course?:any}} [opts] */
export function coachContext(lesson, run, {progress = {}, course, now = Date.now()} = {}) {
  const step = lesson.steps[run.index];
  const cue = step.cue && phraseOf(lesson, step.cue);
  const support = step.support && phraseOf(lesson, step.support);
  // A personal answer (age, country, real date…): the teacher must accept any valid value, not one fixed model.
  const today = step.today ? new Date(now) : undefined;
  const example = exampleOf(support, {today});
  const personal = support?.slots ? ` Es una respuesta personal: ${today ? `la correcta es la fecha real de hoy, ${line(example)}` : `vale cualquier valor válido (${slotHint(support)}); ejemplo: ${line(example)}`}.` : '';
  const reviewedLines = lesson.phrases.filter(p => p.listed !== false).map(p => `${p.hanzi} | ${p.pinyin} | ${p.es}`).join('\n');
  const learned = lesson.phrases.filter(p => (RANK[progress[p.id]?.stage] ?? -1) >= RANK.repeated).map(p => p.pinyin);
  const tasks = {
    teach: () => `Enseña este diálogo: ${step.lines.map(l => `${l.who}: ${line(phraseOf(lesson, l.phrase))}`).join(' / ')}. Di cada frase una vez, despacio, y pide que la repita. Explicación disponible: ${step.note || ''}`,
    understand: () => `Ejercicio de comprensión. Di solo ${line(cue)} y pregunta en español qué entendió. No traduzcas antes de que responda; la app muestra las opciones.`,
    respond: () => `${cue ? `Di ${line(cue)} y espera.` : `Pide en español: «${step.prompt}» y espera.`} Respuesta esperada del estudiante: ${line(support)}.${personal} ${run.supportVisible ? 'El estudiante ve el apoyo en pantalla.' : 'El apoyo está oculto: no le des la respuesta salvo que la pida.'}`,
    recall: () => `Recuperación sin modelo. ${cue ? `Di ${line(cue)} y espera.` : `Plantea en español: «${step.prompt}» y espera.`} No digas la respuesta ${line(support)} antes de que lo intente, salvo que pida ayuda.${personal}`,
  };
  const task = tasks[step.kind]();
  return [
    `[Curso del libro · ${course?.title || 'HSK Standard Course 1'} · Lección ${lesson.number}${lesson.review ? ' (repaso)' : ''}: ${lesson.title.hanzi} (${lesson.title.pinyin}, ${lesson.title.es})]`,
    `Objetivo comunicativo: ${lesson.objective}`,
    `Paso ${run.index + 1} de ${lesson.steps.length} (${step.kind}): ${step.prompt}`,
    `Tu tarea en este paso: ${task}`,
    `Ya dicho por el estudiante en esta lección: ${learned.length ? learned.join(', ') : 'nada todavía; es principiante absoluto'}.`,
    `Frases revisadas de esta lección (hanzi | pinyin | español). En chino usa SOLO estas o las de lecciones anteriores. Si necesitas otra frase en chino, llama antes a show_line:\n${reviewedLines}`,
    'Reglas: una sola frase en chino y una sola pregunta por turno. La app evalúa y decide el avance; no avances tú ni anuncies dominio. Corrige una cosa por vez, en español y en una frase.',
  ].join('\n');
}
// Short app→teacher message that asks her to open the current step. Marked as control: never learner production.
export function stepOpening(lesson, run) {
  const step = lesson.steps[run.index];
  return `(Mensaje de la app, no es mi respuesta) Empecemos el paso ${run.index + 1}: ${step.prompt}`;
}
export function resultUpdate(step, attempt, lesson) {
  const expected = phraseOf(lesson, step.support || step.cue || '');
  if (attempt.correct) return `La app comprobó la respuesta del estudiante («${attempt.text}», ${attempt.modality}) y coincide. Felicítalo en una frase corta en español y espera; no evalúes tonos.`;
  const model = expected?.slots ? exampleOf(expected, {today: step.today ? new Date(attempt.at) : undefined}) : expected;
  const personal = expected?.slots ? ` (respuesta personal${step.today ? ': debe ser la fecha real de hoy' : `: ${slotHint(expected)}`}; modelo ${line(model)})` : '';
  return `La app comprobó la respuesta del estudiante («${attempt.text}», ${attempt.modality}) y no coincide${expected ? ` con ${line(expected)}${personal}` : ''}. Da UNA corrección breve en español y ofrece intentarlo otra vez.`;
}

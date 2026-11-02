import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePinyin, matchAnswer, detectCommand, routeUtterance, createCourseRun, courseAttempt, courseNext, setSupport, restartRun, recordExposure,
  courseSession, courseEvents, deriveCourseProgress, goalStatus, lessonState, validCourseRun, reviewLesson, lessonById, captionLine, reviewedIndex,
  validateCaption, coachContext, phraseOf, availableLessons, wordsUpTo, canAdvance} from '../src/course.mjs';
import {deriveProgress} from '../src/progress.mjs';
import {readHistory} from '../src/learning.mjs';

const course = JSON.parse(readFileSync(new URL('../src/course.json', import.meta.url), 'utf8'));
const curriculum = JSON.parse(readFileSync(new URL('../src/curriculum.json', import.meta.url), 'utf8'));
const [l1, l2, l3] = availableLessons(course);
const date = '2026-11-01T12:00:00.000Z', start = Date.parse(date), DAY = 86400000;
const iso = ms => new Date(ms).toISOString();

test('the path follows the book: three complete lessons first, the rest marked as future', () => {
  assert.deepEqual(course.lessons.map(l => l.number), [...Array(15)].map((_, i) => i + 1));
  assert.deepEqual(availableLessons(course).map(l => l.title.hanzi), ['你好', '谢谢你', '你叫什么名字']);
  for (const l of course.lessons.slice(3)) { assert.equal(l.status, 'future'); assert.equal(l.steps, undefined); }
  for (const l of availableLessons(course)) {
    assert.equal(l.steps[0].kind, 'teach', `${l.id} teaches before it asks`);
    assert.ok(l.book.pdf && l.book.printed, `${l.id} keeps its book reference`);
    const ids = new Set(l.phrases.map(p => p.id));
    for (const s of l.steps) {
      // Everything that is graded or shown as the model must live in the lesson itself (a review of an earlier
      // lesson copies the phrase), so a recall can be checked. Only distractor options may come from earlier lessons.
      for (const id of [s.cue, s.support, ...(s.answers || []), ...(s.lines || []).map(x => x.phrase)].filter(Boolean)) assert.ok(ids.has(id), `${l.id}/${s.id}: ${id}`);
      for (const id of s.options || []) assert.ok(ids.has(id) || availableLessons(course).some(o => o.number < l.number && o.phrases.some(p => p.id === id)), `${l.id}/${s.id}: ${id}`);
    }
    for (const s of l.steps.filter(s => s.kind === 'respond' || s.kind === 'recall')) assert.ok(s.options.includes(s.support) && s.answers.includes(s.support));
  }
});

test('every communicative goal can be recalled without help, so a review can clear it', () => {
  for (const l of availableLessons(course)) for (const g of l.goals)
    assert.ok(l.steps.some(s => s.kind === 'recall' && s.answers.some(a => g.phrases.includes(a))), `${l.id}/${g.id}`);
});

test('the first lesson is the greeting of the book, not «nǐ hǎo ma»', () => {
  assert.equal(phraseOf(l1, l1.steps[0].lines[0].phrase).pinyin, 'Nǐ hǎo!');
  assert.ok(!availableLessons(course).flatMap(l => l.phrases).some(p => /吗/.test(p.hanzi) && /好/.test(p.hanzi)));
});

test('book words are not blocked by the HSK 3.0 repertoire, and the difference is explicit', () => {
  const outside = availableLessons(course).flatMap(l => l.words).filter(w => !curriculum.words.some(c => c.hanzi === w.hanzi));
  assert.ok(outside.some(w => w.hanzi === '您') && outside.some(w => w.hanzi === '对不起'));
  assert.match(course.framework.label, /2009/);
  assert.match(curriculum.framework, /2025/);
});

test('pinyin normalization ignores case, spaces, punctuation and tones; ü can be v', () => {
  assert.equal(normalizePinyin('Nǐ hǎo!'), 'nihao');
  assert.equal(normalizePinyin('ni3 hao3'), 'nihao');
  assert.equal(normalizePinyin("NI HAO"), 'nihao');
  assert.equal(normalizePinyin('nǚ’ér'), 'nver');
  assert.equal(normalizePinyin('nu:er'), 'nver');
  assert.equal(normalizePinyin(42), '');
});

test('answers match characters or pinyin; «me llamo + nombre» accepts any name', () => {
  const phrases = l1.phrases;
  assert.equal(matchAnswer('你好', phrases), 'nihao');
  assert.equal(matchAnswer('ni hao', phrases), 'nihao');
  assert.equal(matchAnswer('Méi guānxi', phrases), 'meiguanxi');
  assert.equal(matchAnswer('hola', phrases), null);
  const wojiao = [phraseOf(l3, 'wojiao')];
  assert.equal(matchAnswer('我叫Alonso。', wojiao), 'wojiao');
  assert.equal(matchAnswer('wo jiao Alonso', wojiao), 'wojiao');
  assert.equal(matchAnswer('我叫', wojiao), null, 'a name is required');
});

test('Spanish requests are commands, not wrong answers', () => {
  assert.equal(detectCommand('Espera'), 'wait');
  assert.equal(detectCommand('más lento, por favor'), 'slow');
  assert.equal(detectCommand('¿Puedes repetir?'), 'repeat');
  assert.equal(detectCommand('No entendí'), 'explain');
  assert.equal(detectCommand('Volvamos al principio'), 'restart');
  assert.equal(detectCommand('sigamos'), 'next');
  assert.equal(detectCommand('你好'), null);
  assert.deepEqual(routeUtterance('no entendí', l1.phrases), {type: 'command', command: 'explain'});
  assert.deepEqual(routeUtterance('creo que es hola', l1.phrases), {type: 'ignored', reason: 'talk'});
  assert.deepEqual(routeUtterance('ni hao', l1.phrases), {type: 'attempt'});
  assert.deepEqual(routeUtterance('你好', l1.phrases), {type: 'attempt'});
});

test('audio played by the app is never graded as the learner', () => {
  const appAudio = [{start: start, end: start + 2500}];
  assert.equal(routeUtterance('你好', l1.phrases, {at: iso(start + 1000), appAudio}).reason, 'app-audio');
  assert.equal(routeUtterance('你好', l1.phrases, {at: iso(start + 4000), appAudio}).type, 'attempt');
});

test('first visit: teach steps can always continue; replies need an answer or a choice', () => {
  let run = createCourseRun(l1, date, 'r');
  assert.ok(canAdvance(run, l1));
  run = courseNext(run, l1, {at: date});
  assert.equal(l1.steps[run.index].kind, 'respond');
  assert.equal(run.supportVisible, true, 'support is visible by default while learning');
  assert.throws(() => courseNext(run, l1));
  const wrong = courseAttempt(run, l1, '谢谢', {at: date});
  assert.equal(wrong.passed, false);
  const right = courseAttempt(wrong, l1, 'ni hao', {at: date, modality: 'pinyin'});
  assert.equal(right.passed, true);
  assert.equal(right.attempts.at(-1).matched, 'nihao');
});

test('a review step inside a later lesson can be answered', () => {
  const step = l2.steps.findIndex(s => s.id === 'c-nihao2');
  const run = courseAttempt({...createCourseRun(l2, date, 'r'), index: step, supportVisible: false, supportUsed: false}, l2, 'ni hao', {at: date});
  assert.equal(run.passed, true);
  assert.deepEqual(courseEvents(run, l2, course).at(-1).words, ['你好！']);
});

test('hiding the support does not erase that it was used', () => {
  let run = courseNext(createCourseRun(l1, date, 'r'), l1, {at: date});
  run = setSupport(run, false);
  assert.equal(run.supportVisible, false);
  assert.equal(run.supportUsed, true);
  run = courseAttempt(run, l1, '你好', {at: date, modality: 'transcript'});
  assert.equal(run.attempts[0].assisted, true);
  assert.equal(courseEvents(run, l1, course).at(-1).stage, 'repeated');
});

test('only a recall step without support counts as independent use; choices are recognition', () => {
  let run = createCourseRun(l1, date, 'r');
  while (l1.steps[run.index].id !== 'c-duibuqi') {
    const step = l1.steps[run.index];
    if (step.kind === 'understand') run = courseAttempt(run, l1, step.answer, {at: date, modality: 'listening-choice'});
    else if (step.kind !== 'teach') run = courseAttempt(run, l1, phraseOf(l1, step.support).hanzi, {at: date, modality: 'transcript'});
    run = courseNext(run, l1, {at: date});
  }
  assert.equal(run.supportVisible, false, 'recall hides the support by default');
  const viaChoice = courseAttempt(run, l1, '对不起！', {at: date, modality: 'choice'});
  assert.equal(courseEvents(viaChoice, l1, course).at(-1).stage, 'recognized');
  const alone = courseAttempt(run, l1, 'duì bu qǐ', {at: date, modality: 'pinyin'});
  const ev = courseEvents(alone, l1, course).at(-1);
  assert.equal(ev.stage, 'independent'); assert.equal(ev.modality, 'pinyin'); assert.deepEqual(ev.phrases, ['duibuqi']);
  assert.equal(courseEvents(setSupport(run, true), l1, course).length, courseEvents(run, l1, course).length);
  const helped = courseAttempt(setSupport(run, true), l1, '对不起', {at: date, modality: 'transcript'});
  assert.equal(courseEvents(helped, l1, course).at(-1).stage, 'repeated');
  const teacherSaidIt = courseAttempt(run, l1, '对不起', {at: date, modality: 'transcript', teacherModeled: true});
  assert.equal(courseEvents(teacherSaidIt, l1, course).at(-1).stage, 'repeated');
});

test('a recall can be left for another day, which schedules it for review', () => {
  let run = createCourseRun(l1, date, 'r');
  run = {...run, index: l1.steps.findIndex(s => s.kind === 'recall')};
  assert.throws(() => courseNext(run, l1));
  run = courseNext(run, l1, {skip: true, at: date});
  assert.equal(courseEvents(run, l1, course).at(-1).stage, 'needs_review');
});

test('restart goes back to the first step and keeps what was already recorded', () => {
  let run = courseNext(createCourseRun(l1, date, 'r'), l1, {at: date});
  run = courseAttempt(run, l1, '你好', {at: date});
  const again = restartRun(run, l1);
  assert.equal(again.index, 0); assert.equal(again.attempts.length, 1);
});

test('a full lesson survives the notebook and resumes only with the same content version', () => {
  let run = createCourseRun(l3, date, 'r3');
  for (const step of l3.steps) {
    if (step.kind === 'understand') run = courseAttempt(run, l3, step.answer, {at: date, modality: 'listening-choice'});
    else if (step.kind !== 'teach') run = courseAttempt(run, l3, step.support === 'wojiao' ? 'wo jiao Alonso' : phraseOf(l3, step.support).pinyin, {at: date, modality: 'pinyin'});
    run = courseNext(run, l3, {at: date});
  }
  assert.equal(run.ended, true);
  const saved = courseSession(run, l3, course);
  const notebook = readHistory({getItem: () => JSON.stringify([saved])}, 'k');
  assert.equal(notebook.length, 1, 'stays compatible with the existing notebook reader');
  assert.equal(notebook[0].lessonSnapshot.version, l3.version);
  assert.ok(notebook[0].learningEvents.every(e => e.scope === 'course' && e.framework === 'hsk2009-sc1'));
  const midway = courseSession({...createCourseRun(l3, date, 'mid'), index: 2}, l3, course);
  assert.ok(validCourseRun(midway.run, l3));
  assert.equal(validCourseRun(midway.run, {...l3, version: l3.version + 1}), false, 'an old run is not replayed against new content');
  assert.equal(validCourseRun({...midway.run, attempts: [null]}, l3), false);
});

test('course evidence is scheduled per phrase and kept out of the HSK 3.0 word progress', () => {
  let run = {...createCourseRun(l1, date, 'r'), index: l1.steps.findIndex(s => s.id === 'c-nihao')};
  run = courseAttempt(run, l1, '你好', {at: date, modality: 'transcript'});
  const history = [courseSession(run, l1, course)];
  const p = deriveCourseProgress(history, course, curriculum.reviewIntervalsDays, start + 1000);
  assert.equal(p.nihao.stage, 'independent');
  assert.equal(p.nihao.nextDue, start + DAY);
  assert.deepEqual(deriveProgress(history, curriculum, start + 1000), {}, 'no silent mixing with the other framework');
  const goal = goalStatus(l1.goals[0], p, start + 1000);
  assert.equal(goal.label, 'Usada sin modelo'); assert.equal(goal.due, false);
  assert.equal(goalStatus(l1.goals[0], p, start + DAY).due, true);
  assert.equal(goalStatus(l1.goals.find(g => g.id === 'sorry'), p, start).stage, 'none');
  // One communicative act, several ways to say it: the best evidence counts.
  const thanks = deriveCourseProgress([courseSession(courseAttempt({...createCourseRun(l2, date, 't'), index: l2.steps.findIndex(s => s.id === 'c-xiexie'), supportVisible: false, supportUsed: false}, l2, 'xiexie', {at: date}), l2, course)], course, curriculum.reviewIntervalsDays, start + 1000);
  assert.equal(goalStatus(l2.goals.find(g => g.id === 'thank'), thanks, start + 1000).stage, 'independent');
});

test('listening, viewing or repeating does not reach independent use', () => {
  let run = recordExposure(createCourseRun(l1, date, 'r'), 'nihao', {at: date});
  run = courseAttempt(run, l1, '你好', {at: date, modality: 'transcript'});
  const p = deriveCourseProgress([courseSession(run, l1, course)], course, curriculum.reviewIntervalsDays, start + 1000);
  assert.equal(p.nihao.stage, 'repeated');
  assert.equal(p.nihao.successfulReviews, 0);
});

test('lesson states: new, in progress, done and review due', () => {
  const none = lessonState(l1, [], {}, start);
  assert.equal(none.status, 'new');
  assert.equal(lessonState(course.lessons[5], [], {}, start).status, 'future');
  const pending = courseSession({...createCourseRun(l1, date, 'p'), index: 3}, l1, course);
  assert.equal(lessonState(l1, [pending], {}, start).status, 'in-progress');
  let run = createCourseRun(l1, date, 'd');
  for (const step of l1.steps) {
    if (step.kind === 'understand') run = courseAttempt(run, l1, step.answer, {at: date, modality: 'listening-choice'});
    else if (step.kind !== 'teach') run = courseAttempt(run, l1, phraseOf(l1, step.support).hanzi, {at: date, modality: 'transcript'});
    run = courseNext(run, l1, {at: date});
  }
  const history = [courseSession(run, l1, course)];
  const progress = deriveCourseProgress(history, course, curriculum.reviewIntervalsDays, start + 1000);
  assert.equal(lessonState(l1, history, progress, start + 1000).status, 'done');
  const later = deriveCourseProgress(history, course, curriculum.reviewIntervalsDays, start + 2 * DAY);
  assert.equal(lessonState(l1, history, later, start + 2 * DAY).status, 'review');
  const review = lessonById(course, 'sc1-01.review');
  assert.ok(review.steps.length && review.steps.every(s => s.kind === 'recall'));
  assert.deepEqual(reviewLesson(l1).steps.map(s => s.id), review.steps.map(s => s.id));
});

test('teacher lines get reviewed pinyin and Spanish; unknown lines never get an invented meaning', () => {
  const reviewed = reviewedIndex(course);
  const words = wordsUpTo(course, l3);
  const known = captionLine('Muy bien. 你好！', {reviewed, words});
  assert.deepEqual(known.map(p => p.type), ['es', 'zh']);
  assert.equal(known[1].pinyin, 'Nǐ hǎo!'); assert.equal(known[1].es, '¡Hola!'); assert.equal(known[1].source, 'reviewed');
  const two = captionLine('你好！你叫什么名字？', {reviewed, words});
  assert.deepEqual(two.map(p => p.es), ['¡Hola!', '¿Cómo te llamas?']);
  const glossOnly = captionLine('你是老师。', {reviewed, words});
  assert.equal(glossOnly[0].source, 'words'); assert.equal(glossOnly[0].es, ''); assert.equal(glossOnly[0].pinyin, 'nǐ shì lǎoshī');
  const unknown = captionLine('我喜欢咖啡。', {reviewed, words});
  assert.equal(unknown[0].source, 'none'); assert.equal(unknown[0].pinyin, ''); assert.equal(unknown[0].es, '');
  const agent = new Map([['我喜欢咖啡', {hanzi: '我喜欢咖啡。', pinyin: 'Wǒ xǐhuan kāfēi.', es: 'Me gusta el café.'}]]);
  const captioned = captionLine('我喜欢咖啡。', {reviewed, agent, words});
  assert.equal(captioned[0].es, 'Me gusta el café.'); assert.equal(captioned[0].source, 'agent');
});

test('structured captions from the agent are validated', () => {
  assert.equal(validateCaption('{"hanzi":"你好！","pinyin":"Nǐ hǎo!","es":"¡Hola!"}').es, '¡Hola!');
  assert.throws(() => validateCaption({hanzi: 'Hola', pinyin: 'x', es: 'y'}));
  assert.throws(() => validateCaption({hanzi: '你好', pinyin: '', es: 'y'}));
  assert.throws(() => validateCaption('broken'));
});

test('the teacher receives the lesson, the step, the reviewed phrases and what was already said', () => {
  let run = courseNext(createCourseRun(l1, date, 'r'), l1, {at: date});
  const text = coachContext(l1, run, {course, progress: {nihao: {stage: 'repeated'}}});
  assert.match(text, /Lección 1/); assert.match(text, new RegExp(`Paso 2 de ${l1.steps.length}`)); assert.match(text, /你好！ \| Nǐ hǎo! \| ¡Hola!/);
  assert.match(text, /Ya dicho por el estudiante en esta lección: Nǐ hǎo!/);
  assert.match(text, /ve el apoyo/);
  assert.match(coachContext(l1, setSupport(run, false), {course}), /apoyo está oculto/);
  const recall = {...run, index: l1.steps.findIndex(s => s.kind === 'recall'), supportVisible: false};
  assert.match(coachContext(l1, recall, {course}), /No digas la respuesta/);
});

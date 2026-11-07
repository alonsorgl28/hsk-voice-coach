// Lessons 4–9 of HSK Standard Course 1: data integrity, personal answers and full walk-throughs without characters.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {matchAnswer, slotValues, parseNumber, SLOTS, exampleOf, slotHint, numberPinyin, numberZh, createCourseRun, courseAttempt, courseNext, courseSession,
  deriveCourseProgress, lessonState, validCourseRun, reviewLesson, reviewedIndex, captionLine, coachContext, resultUpdate, phraseOf, availableLessons,
  wordsUpTo, routeUtterance, hasHan} from '../src/course.mjs';
import {readHistory} from '../src/learning.mjs';

const course = JSON.parse(readFileSync(new URL('../src/course.json', import.meta.url), 'utf8'));
const curriculum = JSON.parse(readFileSync(new URL('../src/curriculum.json', import.meta.url), 'utf8'));
const lessons = availableLessons(course);
const added = lessons.filter(l => l.number >= 4);
// A local date (the device's), like the browser uses: Saturday 7 November 2026, noon.
const today = new Date(2026, 10, 7, 12);
const at = today.toISOString();

// What the UI sends when you click an option (CourseLesson.tsx).
const optionText = (lesson, step, p) => p.prefix ? p.pinyin.replace('…', '(tu nombre)') : p.slots ? exampleOf(p, {today: step.today ? new Date(at) : undefined}).hanzi : p.hanzi;
const find = (lesson, id) => phraseOf(lesson, id) || lessons.flatMap(l => l.phrases).find(p => p.id === id);
const answerAt = (lesson, step, text, modality = 'pinyin') => courseAttempt({...createCourseRun(lesson, at, 'x'), index: lesson.steps.indexOf(step), supportVisible: false, supportUsed: false}, lesson, text, {at, modality});

test('lessons 1–3 keep their exact content and version, so saved runs still resume', () => {
  const hash = createHash('sha256').update(JSON.stringify(course.lessons.slice(0, 3))).digest('hex');
  assert.equal(hash, '9334be8c22eb09169086bacc2bc485bf5e8df84818f398b9f887b6097f894bd0');
  assert.deepEqual(course.lessons.slice(0, 3).map(l => [l.id, l.version]), [['sc1-01', 2], ['sc1-02', 2], ['sc1-03', 2]]);
  assert.deepEqual(added.map(l => [l.id, l.version]), [['sc1-04', 1], ['sc1-05', 1], ['sc1-06', 1], ['sc1-07', 1], ['sc1-08', 1], ['sc1-09', 1]]);
});

test('identifiers never collide: a shared phrase id is the same phrase, step ids are unique', () => {
  const seen = new Map();
  for (const l of lessons) for (const p of l.phrases) {
    const key = JSON.stringify([p.hanzi, p.pinyin, p.es, p.slots || null, p.prefix || false]);
    if (seen.has(p.id)) assert.equal(seen.get(p.id), key, `${l.id}: ${p.id} reused with other content`);
    else seen.set(p.id, key);
    if (p.from) assert.ok(lessons.find(x => x.id === p.from)?.phrases.some(q => q.id === p.id), `${l.id}: ${p.id} from ${p.from}`);
  }
  const steps = lessons.flatMap(l => l.steps.map(s => s.id));
  assert.equal(new Set(steps).size, steps.length, 'step ids are unique across the course');
  for (const l of added) {
    assert.equal(new Set(l.phrases.map(p => p.id)).size, l.phrases.length, `${l.id}: duplicated phrase id`);
    for (const p of l.phrases.filter(p => !p.from)) assert.match(p.id, new RegExp(`^l${l.number}-`), `${l.id}: new ids carry the lesson prefix`);
  }
});

test('book references distinguish printed and PDF pages and fall inside the lesson', () => {
  const ranges = {4: [22, 29], 5: [30, 39], 6: [40, 47], 7: [48, 55], 8: [56, 63], 9: [64, 71]};
  for (const l of added) {
    const [a, b] = ranges[l.number];
    assert.equal(l.book.printed, `${a}–${b}`); assert.equal(l.book.pdf, `${a + course.source.pdfPageOffset}–${b + course.source.pdfPageOffset}`);
    const wb = l.book.workbook.match(/impresa (\d+)–(\d+), PDF (\d+)–(\d+)/);
    assert.ok(wb && +wb[3] === +wb[1] + 2 && +wb[4] === +wb[2] + 2, `${l.id}: workbook PDF = impresa + 2`);
    for (const s of l.steps) {
      assert.ok(s.ref, `${l.id}/${s.id} has a reference`);
      for (const m of s.ref.matchAll(/pp?\. (\d+)(?:–(\d+))? \(PDF (\d+)(?:–(\d+))?\)/g)) {
        assert.equal(+m[3], +m[1] + 20, `${l.id}/${s.id}: ${m[0]}`);
        const own = !/^Lección \d/.test(s.ref);
        if (own) assert.ok(+m[1] >= a && +m[1] <= b, `${l.id}/${s.id}: page ${m[1]} outside the lesson`);
      }
    }
  }
});

test('teach before asking, and every goal is practised several times', () => {
  for (const l of added) {
    assert.equal(l.steps[0].kind, 'teach');
    const kinds = new Set(l.steps.map(s => s.kind));
    for (const k of ['teach', 'understand', 'respond', 'recall']) assert.ok(kinds.has(k), `${l.id} has ${k}`);
    // Recall steps come after every teach step: you recover what was taught, not something new.
    const lastTeach = l.steps.map(s => s.kind).lastIndexOf('teach');
    const firstRecall = l.steps.findIndex(s => s.kind === 'recall');
    assert.ok(firstRecall > lastTeach, `${l.id}: recall after teaching`);
    for (const g of l.goals) {
      const uses = l.steps.filter(s => s.answers?.some(a => g.phrases.includes(a)));
      assert.ok(uses.length >= 2, `${l.id}/${g.id} is used at least twice (${uses.length})`);
    }
    // The last step reviews the previous lesson.
    const review = l.steps.at(-1);
    assert.equal(review.title, 'Repaso');
    assert.ok(review.answers.every(id => phraseOf(l, id).from), `${l.id}: review uses copied phrases of an earlier lesson`);
  }
});

test('every answer is taught or shown before it is asked without help', () => {
  for (const l of added) {
    const shown = new Set();
    for (const s of l.steps) {
      if (s.kind === 'recall') {
        const ok = s.answers.some(id => shown.has(id) || phraseOf(l, id).from);
        assert.ok(ok, `${l.id}/${s.id}: recall of something never shown`);
      }
      for (const id of [...(s.lines || []).map(x => x.phrase), s.cue, s.support].filter(Boolean)) shown.add(id);
    }
  }
});

test('options: the model and every accepted answer pass; distractors never do; nothing needs characters', () => {
  for (const l of added) for (const s of l.steps) {
    if (s.kind === 'understand') {
      assert.equal(new Set(s.choices).size, s.choices.length);
      assert.ok(s.choices.includes(s.answer));
      continue;
    }
    if (s.kind === 'teach') continue;
    for (const id of s.options) {
      const p = find(l, id);
      assert.ok(p, `${l.id}/${s.id}: option ${id}`);
      const run = answerAt(l, s, optionText(l, s, p), 'choice');
      assert.equal(run.passed, s.answers.includes(id), `${l.id}/${s.id}: option ${id} ${s.answers.includes(id) ? 'should' : 'should not'} pass`);
    }
    for (const id of s.answers) {
      const p = phraseOf(l, id);
      // Typed pinyin, without characters: the fixed phrase itself, or the example of a personal answer.
      const typed = p.slots ? exampleOf(p, {today: s.today ? new Date(at) : undefined}).pinyin : p.pinyin;
      assert.ok(answerAt(l, s, typed).passed, `${l.id}/${s.id}: typed pinyin of ${id}`);
      assert.ok(!hasHan(typed));
      // The same in characters (voice transcripts arrive in characters).
      const han = p.slots ? exampleOf(p, {today: s.today ? new Date(at) : undefined}).hanzi : p.hanzi;
      assert.ok(answerAt(l, s, han, 'transcript').passed, `${l.id}/${s.id}: characters of ${id}`);
    }
  }
});

test('personal numbers: ages, family size and prices accept a bounded range in pinyin, characters or digits', () => {
  const l5 = lessons.find(l => l.id === 'sc1-05');
  const age = [phraseOf(l5, 'l5-jinnian')];
  for (const ok of ['Wǒ jīnnián èrshí suì.', 'wo jinnian 35 sui', 'wo3 jin1nian2 san1shi2wu3 sui4', '我今年四十二岁。', '我今年42岁', 'wo jinnian liang sui', '我今年两岁', 'wo jinnian shiyi sui', 'wo jinnian jiushijiu sui', 'wo jinnian 1 sui'])
    assert.equal(matchAnswer(ok, age), 'l5-jinnian', ok);
  for (const bad of ['wo jinnian sui', 'wo jinnian er sui', '我今年二岁', 'wo jinnian 0 sui', 'wo jinnian 100 sui', 'wo jinnian yishi sui', 'wo jinnian shishi sui', 'wo jinnian Alonso sui',
    'wo jinnian ershi sui ma', 'wo jinnian ershi', 'ni jinnian ershi sui', 'wo jinnian ershi sui wo jiao Alonso', '我今年二十'])
    assert.equal(matchAnswer(bad, age), null, bad);
  const family = [phraseOf(l5, 'l5-jiayou')];
  assert.equal(matchAnswer('wo jia you liang kou ren', family), 'l5-jiayou');
  assert.equal(matchAnswer('我家有五口人', family), 'l5-jiayou');
  assert.equal(matchAnswer('wo jia you er kou ren', family), null, '二口人 is not said');
  assert.equal(matchAnswer('wo jia you 30 kou ren', family), null, 'a family of 30 is outside the range');
  const l8 = lessons.find(l => l.id === 'sc1-08');
  const price = [phraseOf(l8, 'l8-kuai'), phraseOf(l8, 'l8-kuaiqian')];
  assert.equal(matchAnswer('Èrshíbā kuài.', price), 'l8-kuai');
  assert.equal(matchAnswer('shiba kuai qian', price), 'l8-kuaiqian');
  assert.equal(matchAnswer('liang kuai', price), 'l8-kuai');
  assert.equal(matchAnswer('kuai', price), null);
  assert.equal(parseNumber('ershi', SLOTS.age), 20); assert.equal(parseNumber('二十三', SLOTS.age), 23); assert.ok(Number.isNaN(parseNumber('', SLOTS.age)));
  assert.deepEqual([2, 12, 22, 31].map(numberPinyin), ['èr', "shí'èr", "èrshí'èr", 'sānshíyī']);
  assert.deepEqual([10, 11, 20, 99].map(numberZh), ['十', '十一', '二十', '九十九']);
});

test('the date answer must be the real date of the device; examples teach the book date', () => {
  const l7 = lessons.find(l => l.id === 'sc1-07');
  const step = l7.steps.find(s => s.id === 'r7-today');
  assert.equal(step.today, true);
  for (const ok of ['Jīntiān shíyī yuè qī hào.', 'jintian 11 yue 7 hao', '今天十一月七号。', '十一月七号', 'jintian shi shiyi yue qi hao', '今天十一月七号，星期六。', 'jintian shiyi yue qi hao, xingqi liu'])
    assert.ok(answerAt(l7, step, ok).passed, ok);
  for (const bad of ['jintian jiu yue yi hao', 'jintian shiyi yue ba hao', 'jintian shiyi yue qi hao xingqi ri', 'jintian shisan yue qi hao', 'jintian qi hao', 'jintian liang yue qi hao'])
    assert.equal(answerAt(l7, step, bad).passed, false, bad);
  const week = l7.steps.find(s => s.id === 'r7-weektoday');
  assert.ok(answerAt(l7, week, 'xingqi liu').passed);
  assert.ok(answerAt(l7, week, '今天星期六。').passed);
  assert.equal(answerAt(l7, week, 'xingqi san').passed, false);
  // Sunday has two names.
  const sunday = new Date(2026, 10, 8, 12).toISOString();
  for (const t of ['xingqi tian', 'xingqiri', '星期日']) assert.ok(courseAttempt({...createCourseRun(l7, sunday, 's'), index: l7.steps.indexOf(week)}, l7, t, {at: sunday}).passed, t);
  // Without the "today" rule (the book's calendar), the example is the book date.
  assert.equal(exampleOf(phraseOf(l7, 'l7-date')).pinyin, 'Jīntiān jiǔ yuè yī hào.');
  assert.deepEqual(exampleOf(phraseOf(l7, 'l7-date'), {today}), {hanzi: '今天十一月七号。', pinyin: 'Jīntiān shíyī yuè qī hào.', es: 'Hoy es 7 de noviembre.'});
  assert.equal(exampleOf(phraseOf(l7, 'l7-xingqi'), {today: new Date(2026, 10, 8)}).pinyin, 'Xīngqī tiān.');
  // The step without "today" accepts only the book's date.
  const fixed = l7.steps.find(s => s.id === 'r7-jiuyue');
  assert.ok(answerAt(l7, fixed, 'jiu yue yi hao').passed);
  assert.equal(answerAt(l7, fixed, 'shiyi yue qi hao').passed, false);
});

test('country, drink and workplace come from short honest lists', () => {
  const l4 = lessons.find(l => l.id === 'sc1-04');
  const country = [phraseOf(l4, 'l4-woshiguo'), phraseOf(l4, 'l4-woshiguo-ne')];
  for (const [t, id] of [['wo shi Bilu ren', 'l4-woshiguo'], ['我是墨西哥人。', 'l4-woshiguo'], ['Wǒ shì Xībānyá rén. Nǐ ne?', 'l4-woshiguo-ne'], ['wo shi zhongguo ren ni ne', 'l4-woshiguo-ne'], ["wo shi Eguaduo'er ren", 'l4-woshiguo']])
    assert.equal(matchAnswer(t, country), id, t);
  for (const t of ['wo shi ren', 'wo shi Alonso ren', 'wo shi bilu', 'wo shi bilu ren ni hao']) assert.equal(matchAnswer(t, country), null, t);
  assert.match(slotHint(country[0]), /Bìlǔ \(Perú\)/);
  const l8 = lessons.find(l => l.id === 'sc1-08');
  assert.equal(matchAnswer('wo xiang he kafei', [phraseOf(l8, 'l8-he')]), 'l8-he');
  assert.equal(matchAnswer('wo xiang he mifan', [phraseOf(l8, 'l8-he')]), null, 'rice is not a drink');
  const l9 = lessons.find(l => l.id === 'sc1-09');
  const work = l9.steps.find(s => s.id === 'c9-wozai');
  for (const t of ['wo zai gongsi gongzuo', '我在医院工作。', 'wo zai jia gongzuo', 'Wǒ shì xuésheng.']) assert.ok(answerAt(l9, work, t).passed, t);
  for (const t of ['wo zai nar gongzuo', 'wo zai gongzuo', 'wo zai Lima gongzuo']) assert.equal(answerAt(l9, work, t).passed, false, t);
  assert.deepEqual(slotValues('wo zai gongsi gongzuo', phraseOf(l9, 'l9-wozai')), ['公司']);
});

test('tones are not graded: nǎr and nàr type the same, but choosing the statement is wrong', () => {
  const l9 = lessons.find(l => l.id === 'sc1-09');
  const step = l9.steps.find(s => s.id === 'r9-mao');
  assert.ok(answerAt(l9, step, 'xiao mao zai nar').passed);
  assert.equal(answerAt(l9, step, '小猫在那儿。', 'choice').passed, false);
  assert.ok(answerAt(l9, step, '小猫在哪儿？', 'transcript').passed);
});

test('each new lesson can be finished with pinyin only, resumes after a reload and ends in the notebook', () => {
  for (const l of added) {
    let run = createCourseRun(l, at, 'walk-' + l.id);
    for (const step of l.steps) {
      if (step.kind === 'understand') run = courseAttempt(run, l, step.answer, {at, modality: 'listening-choice'});
      else if (step.kind !== 'teach') {
        const p = phraseOf(l, step.support);
        run = courseAttempt(run, l, p.slots ? exampleOf(p, {today: step.today ? new Date(at) : undefined}).pinyin : p.pinyin, {at, modality: 'pinyin'});
        assert.ok(run.passed, `${l.id}/${step.id}`);
      }
      // A reload in the middle: the saved run is read back from the notebook and continues.
      const saved = readHistory({getItem: () => JSON.stringify([courseSession(run, l, course)])}, 'k')[0];
      assert.ok(validCourseRun(saved.run, l), `${l.id}/${step.id} resumes`);
      run = courseNext(saved.run, l, {at});
    }
    assert.equal(run.ended, true);
    const session = courseSession(run, l, course);
    assert.equal(session.lessonSnapshot.version, 1);
    assert.ok(session.learningEvents.every(e => e.scope === 'course' && e.framework === 'hsk2009-sc1'));
    const progress = deriveCourseProgress([session], course, curriculum.reviewIntervalsDays, Date.parse(at) + 1000);
    const state = lessonState(l, [session], progress, Date.parse(at) + 1000);
    assert.equal(state.status, 'done');
    // Recall steps were answered without support: every goal reaches independent use, none by a choice.
    for (const g of state.goals) assert.equal(g.stage, 'independent', `${l.id}/${g.id}`);
    assert.ok(reviewLesson(l).steps.length >= 5 && reviewLesson(l).steps.every(s => s.kind === 'recall'));
  }
});

test('an existing notebook keeps lessons 1–3 and opens lesson 4 next', () => {
  const [l1, l2, l3, l4] = lessons;
  const finished = [l1, l2, l3].map((l, i) => {
    let run = createCourseRun(l, '2026-11-01T12:00:00.000Z', 'old-' + i);
    for (const step of l.steps) {
      if (step.kind === 'understand') run = courseAttempt(run, l, step.answer, {at: run.date, modality: 'listening-choice'});
      else if (step.kind !== 'teach') run = courseAttempt(run, l, step.support === 'wojiao' ? 'wo jiao Alonso' : phraseOf(l, step.support).pinyin, {at: run.date});
      run = courseNext(run, l, {at: run.date});
    }
    return courseSession(run, l, course);
  });
  const drinks = {id: 'old-drinks', date: '2026-10-31T10:00:00.000Z', mode: 'guided', level: 1, topic: '¿Agua o té?', duration: 300, messages: [], feedback: [], practiced: [], learningEvents: []};
  const notebook = readHistory({getItem: () => JSON.stringify([...finished, drinks])}, 'k');
  assert.equal(notebook.length, 4, 'nothing is dropped');
  const now = Date.parse('2026-11-07T12:00:00.000Z');
  const progress = deriveCourseProgress(notebook, course, curriculum.reviewIntervalsDays, now);
  assert.deepEqual([l1, l2, l3].map(l => lessonState(l, notebook, progress, now).done), [true, true, true]);
  assert.equal(lessonState(l4, notebook, progress, now).status, 'new');
  assert.ok(finished.every(s => s.lessonSnapshot.version === 2));
});

test('the teacher gets the new lessons, their personal answers and the real date', () => {
  const l5 = lessons.find(l => l.id === 'sc1-05');
  const run = {...createCourseRun(l5, at, 'c'), index: l5.steps.findIndex(s => s.id === 'r5-myage')};
  const text = coachContext(l5, run, {course});
  assert.match(text, /Lección 5/); assert.match(text, /respuesta personal/); assert.match(text, /del 1 al 99/);
  assert.match(text, /你多大了？ \| Nǐ duō dà le\?/);
  const l7 = lessons.find(l => l.id === 'sc1-07');
  const dated = coachContext(l7, {...createCourseRun(l7, at, 'd'), index: l7.steps.findIndex(s => s.id === 'c7-today'), supportVisible: false}, {course, now: today.getTime()});
  assert.match(dated, /fecha real de hoy, «今天十一月七号。»/);
  assert.match(dated, /No digas la respuesta/);
  const wrong = answerAt(l7, l7.steps.find(s => s.id === 'r7-today'), 'jiu yue yi hao').attempts.at(-1);
  assert.match(resultUpdate(l7.steps.find(s => s.id === 'r7-today'), wrong, l7), /fecha real de hoy.*今天十一月七号/);
  // The voice session's vocabulary includes every lesson up to the current one, not just 1–3.
  const words = wordsUpTo(course, lessons.at(-1)).map(w => w.hanzi);
  for (const w of ['谁', '岁', '会', '星期', '多少', '哪儿']) assert.ok(words.includes(w), w);
});

test('captions: reviewed examples are shown with Spanish; templates with … are never matched as text', () => {
  const reviewed = reviewedIndex(course);
  assert.ok(![...reviewed.keys()].some(k => k.includes('…')));
  const words = wordsUpTo(course, lessons.at(-1));
  const c = captionLine('很好！我今年二十岁。', {reviewed, words});
  assert.equal(c.at(-1).es, 'Tengo 20 años.');
  const age = captionLine('我今年三十岁。', {reviewed, words});
  assert.equal(age[0].source, 'words'); assert.equal(age[0].pinyin, 'wǒ jīnnián sān shí suì'); assert.equal(age[0].es, '');
  // Voice: a sentence with the right shape is an attempt; plain Spanish is talk.
  const l5 = lessons.find(l => l.id === 'sc1-05');
  assert.deepEqual(routeUtterance('我今年36岁。', [phraseOf(l5, 'l5-jinnian')]), {type: 'attempt'});
  assert.deepEqual(routeUtterance('tengo treinta', [phraseOf(l5, 'l5-jinnian')]), {type: 'ignored', reason: 'talk'});
});

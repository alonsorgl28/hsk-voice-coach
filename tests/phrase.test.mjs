import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makePlan, validatePhrase} from '../src/learning.mjs';

const curriculum = JSON.parse(readFileSync(new URL('../src/curriculum.json', import.meta.url), 'utf8'));
const plan = makePlan(curriculum, 1, 'introductions', []);
const inLevel = {hanzi:'我是学生。', pinyin:'Wǒ shì xuésheng.', es:'Soy estudiante.'};

test('accepts a phrase built from the session vocabulary and marks it in level', () => {
  const result = validatePhrase(inLevel, plan);
  assert.equal(result.hanzi, '我是学生。');
  assert.equal(result.beyond, false);
});

test('accepts a phrase beyond the level and flags it instead of rejecting', () => {
  // This is the whole point of asking "¿cómo digo…?": the answer is usually
  // something you cannot say yet. It must arrive, but never count as practiced.
  const result = validatePhrase({hanzi:'我不知道怎么说。', pinyin:'Wǒ bù zhīdào zěnme shuō.', es:'No sé cómo se dice.'}, plan);
  assert.equal(result.beyond, true);
});

test('accepts a serialized JSON payload', () => {
  assert.equal(validatePhrase(JSON.stringify(inLevel), plan).pinyin, 'Wǒ shì xuésheng.');
});

test('keeps optional context and defaults it to an empty string', () => {
  assert.equal(validatePhrase(inLevel, plan).context, '');
  assert.equal(validatePhrase({...inLevel, context:'Para presentarte.'}, plan).context, 'Para presentarte.');
});

test('rejects a payload with no Chinese in it', () => {
  assert.throws(() => validatePhrase({hanzi:'Soy estudiante', pinyin:'x', es:'y'}, plan), /no contiene chino/);
});

test('rejects missing, empty or oversized fields', () => {
  assert.throws(() => validatePhrase({hanzi:'我是学生。', pinyin:'Wǒ shì xuésheng.'}, plan), /es/);
  assert.throws(() => validatePhrase({...inLevel, pinyin:'   '}, plan), /pinyin/);
  assert.throws(() => validatePhrase({...inLevel, hanzi:'我'.repeat(241)}, plan), /hanzi/);
});

test('rejects an empty payload', () => {
  assert.throws(() => validatePhrase(null, plan), /vacía/);
});

test('truncates an overlong context instead of failing the whole phrase', () => {
  assert.equal(validatePhrase({...inLevel, context:'a'.repeat(900)}, plan).context.length, 600);
});

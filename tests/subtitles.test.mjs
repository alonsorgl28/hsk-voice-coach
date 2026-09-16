import test from 'node:test';
import assert from 'node:assert/strict';
import {glossChinese, pinyinOf, meaningOf, fullyGlossed} from '../src/subtitles.mjs';

const words = [
  {hanzi:'我', pinyin:'wǒ', es:'yo'},
  {hanzi:'你', pinyin:'nǐ', es:'tú'},
  {hanzi:'好', pinyin:'hǎo', es:'bien; bueno'},
  {hanzi:'叫', pinyin:'jiào', es:'llamarse'},
  {hanzi:'名字', pinyin:'míngzi', es:'nombre'},
  {hanzi:'什么', pinyin:'shénme', es:'qué'},
];

test('segmenta prefiriendo la palabra más larga', () => {
  const tokens = glossChinese('你叫什么名字', words);
  assert.deepEqual(tokens.map(t => t.hanzi), ['你','叫','什么','名字']);
  assert.equal(pinyinOf(tokens), 'nǐ jiào shénme míngzi');
  assert.equal(meaningOf(tokens), 'tú · llamarse · qué · nombre');
});

test('la puntuación china se queda en la línea china', () => {
  const tokens = glossChinese('你好！Responde en voz alta.', words);
  assert.deepEqual(tokens.map(t => t.hanzi ?? t.text), ['你','好','！','Responde en voz alta.']);
  assert.equal(fullyGlossed(tokens), true);
});

test('una frase con palabras fuera del vocabulario no está totalmente glosada', () => {
  assert.equal(fullyGlossed(glossChinese('你叫什么名字？', words)), true);
  assert.equal(fullyGlossed(glossChinese('你爱什么？', words)), false);
});

test('no inventa significado para caracteres desconocidos', () => {
  const tokens = glossChinese('我爱学习', words);
  assert.deepEqual(tokens, [{hanzi:'我', pinyin:'wǒ', es:'yo'}, {hanzi:'爱学习'}]);
  assert.equal(meaningOf(tokens), 'yo');
  assert.equal(fullyGlossed(tokens), false);
});

test('una línea totalmente cubierta se marca como glosada', () => {
  assert.equal(fullyGlossed(glossChinese('我叫', words)), true);
});

test('una línea sin chino no se marca como glosada', () => {
  assert.equal(fullyGlossed(glossChinese('Muy bien, sigue así.', words)), false);
});

test('toma solo la primera acepción del glosario', () => {
  assert.equal(meaningOf(glossChinese('好', words)), 'bien');
});

test('texto vacío no produce tokens', () => {
  assert.deepEqual(glossChinese('   ', words), []);
  assert.deepEqual(glossChinese(undefined, words), []);
});

// Word-by-word gloss for live subtitles. Pure functions, shared with the contract tests.
// The gloss never guesses: a Chinese run we cannot segment is shown without meaning.
const HAN = /\p{Script=Han}/u;
// Chinese punctuation rides with the Chinese run so it never floats off the line.
const CJK = /[\p{Script=Han}。，、；：？！“”‘’（）《》〈〉「」『』【】…—]/u;

// Longest-match-first segmentation of one Chinese run against the curriculum.
function segmentRun(run, index) {
  const tokens = [];
  let i = 0;
  while (i < run.length) {
    let match = null;
    for (const word of index) if (run.startsWith(word.hanzi, i)) { match = word; break; }
    if (match) { tokens.push({hanzi: match.hanzi, pinyin: match.pinyin, es: match.es}); i += match.hanzi.length; }
    else {
      const last = tokens.at(-1);
      if (last && !last.es) last.hanzi += run[i];
      else tokens.push({hanzi: run[i]});
      i += 1;
    }
  }
  return tokens;
}

// Splits mixed Spanish/Chinese text into gloss tokens. Non-Chinese text passes through as {text}.
export function glossChinese(text, words) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const index = [...words].sort((a, b) => b.hanzi.length - a.hanzi.length);
  const parts = [];
  let buffer = '';
  let chinese = false;
  const flush = () => {
    if (!buffer) return;
    if (chinese) parts.push(...segmentRun(buffer, index));
    else parts.push({text: buffer});
    buffer = '';
  };
  for (const char of text) {
    const isChinese = CJK.test(char);
    if (isChinese !== chinese) { flush(); chinese = isChinese; }
    buffer += char;
  }
  flush();
  return parts;
}

// Tone-marked pinyin for the Chinese of a line. Unknown characters contribute nothing.
export function pinyinOf(tokens) {
  return tokens.filter(t => t.pinyin).map(t => t.pinyin).join(' ').trim();
}

// Spanish meaning, word by word. Explicitly not a fluent translation — the UI must say so.
export function meaningOf(tokens) {
  return tokens.filter(t => t.es).map(t => t.es.split(';')[0].trim()).join(' · ');
}

// True when every Chinese word in the line has a gloss behind it. Punctuation does not count.
export function fullyGlossed(tokens) {
  const words = tokens.filter(t => t.hanzi && HAN.test(t.hanzi));
  return words.length > 0 && words.every(t => t.es);
}

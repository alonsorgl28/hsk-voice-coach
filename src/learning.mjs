// Pure functions shared by the UI and contract tests. Agent output is untrusted.
export function makePlan(curriculum, level, topicId, history) {
  const topic = curriculum.topics.find(t => t.id === topicId && (t.minLevel || 1) <= level) || curriculum.topics[0];
  const eligible = curriculum.words.filter(w => w.level <= level);
  const practiced = [...new Set(history.filter(s => s.mode !== 'demo').flatMap(s => s.practiced || []))];
  const review = practiced.filter(w => eligible.some(e => e.hanzi === w)).slice(-curriculum.reviewCount);
  const targets = topic.words.filter(w => !practiced.includes(w)).slice(0, curriculum.maxNewWords);
  const familiar = topic.words.filter(w => practiced.includes(w));
  const allowed = eligible.filter(w => [...curriculum.foundation, ...review, ...targets, ...familiar].includes(w.hanzi));
  return { topic, review, targets, allowed };
}

export function chineseAllowed(text, words) {
  const chunks = text.match(/[\p{Script=Han}]+/gu) || [];
  return chunks.every(chunk => {
    const reached = new Set([0]);
    for (let i = 0; i < chunk.length; i++) if (reached.has(i))
      for (const word of words) if (chunk.startsWith(word, i)) reached.add(i + word.length);
    return reached.has(chunk.length);
  });
}

export function validateLearningEvent(raw, plan, messages) {
  const event = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!event || !['lesson', 'correction', 'summary'].includes(event.kind)) throw Error('Tipo de registro no válido.');
  const required = (field, max = 1600) => {
    if (typeof event[field] !== 'string' || !event[field].trim() || event[field].length > max) throw Error(`Campo no válido: ${field}`);
    return event[field].trim();
  };
  const words = plan.allowed.map(w => w.hanzi);
  if (event.kind !== 'summary') {
    const hanzi = required('hanzi', 240);
    if (!chineseAllowed(hanzi, words)) throw Error('La frase incluye vocabulario fuera de esta sesión.');
    const result = {kind:event.kind, hanzi, pinyin:required('pinyin', 500), explanation:required('explanation')};
    if (event.kind === 'correction') {
      const evidence = required('evidence', 500);
      if (!messages.some(m => m.role === 'user' && m.text.includes(evidence))) throw Error('La corrección no tiene evidencia en una respuesta del estudiante.');
      return {...result, evidence};
    }
    return result;
  }
  const transcript = messages.map(m => m.text).join('\n');
  if (!messages.some(m => m.role === 'user')) throw Error('No se puede resumir progreso sin respuestas del estudiante.');
  if (!Array.isArray(event.practiced) || !event.practiced.every(w => typeof w === 'string' && words.includes(w) && transcript.includes(w))) throw Error('Vocabulario sin evidencia o fuera de nivel.');
  if (!Array.isArray(event.errors) || event.errors.length > 5) throw Error('Lista de errores no válida.');
  const errors = event.errors.map(error => validateLearningEvent({...error, kind:'correction'}, plan, messages));
  return {kind:'summary', practiced:[...new Set(event.practiced)], errors, recommendation:required('recommendation'), homework:required('homework'), completed:event.completed === true};
}

export function readHistory(storage, key) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter(s => s && typeof s.id === 'string' && typeof s.date === 'string' && typeof s.topic === 'string' && Number.isFinite(s.duration) && Array.isArray(s.messages) && s.messages.every(m => m && typeof m.text === 'string' && ['user','agent'].includes(m.role)) && Array.isArray(s.practiced) && s.practiced.every(w => typeof w === 'string') && Array.isArray(s.feedback) && s.feedback.every(f => f && ['lesson','correction'].includes(f.kind) && typeof f.hanzi === 'string' && typeof f.pinyin === 'string' && typeof f.explanation === 'string') && (!s.summary || (s.summary.kind === 'summary' && typeof s.summary.homework === 'string' && typeof s.summary.recommendation === 'string' && Array.isArray(s.summary.practiced) && Array.isArray(s.summary.errors)))) : [];
  } catch { return []; }
}

export function upsertSession(history, session, limit) {
  return [session, ...history.filter(s => s.id !== session.id)].slice(0, limit);
}

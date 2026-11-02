import {ArrowRight} from 'lucide-react';
import curriculum from './curriculum.json';
import {course, type Lesson} from './CourseLesson';
import {deriveCourseProgress, lessonState} from './course.mjs';

type Session = {learningEvents?:unknown[]; run?:unknown};
const STATUS = {new:'Disponible', 'in-progress':'En curso', done:'Completada', review:'Repaso pendiente', future:'Por preparar'} as Record<string,string>;

export function useCourseState(history:Session[]) {
  const progress = deriveCourseProgress(history as never, course, curriculum.reviewIntervalsDays);
  const lessons = course.lessons.map(l => ({lesson: l, state: lessonState(l as never, history as never, progress)}));
  return {progress, lessons};
}

// The book's real order. Lessons not built yet are listed honestly, without a button.
export default function CoursePath({history, onOpen}:{history:Session[]; onOpen:(lesson:Lesson, mode:'lesson'|'review', resume?:unknown)=>void}) {
  const {lessons} = useCourseState(history);
  const next = lessons.find(x => x.state.status === 'in-progress') || lessons.find(x => x.state.status === 'review') || lessons.find(x => x.state.status === 'new');
  return <section className="path" aria-labelledby="path-title">
    <div className="path-head">
      <p className="eyebrow">Tu libro · {course.title}</p>
      <h2 id="path-title">Escuchar y conversar, lección por lección</h2>
      <p className="microcopy">Mismo orden que el libro. Pinyin y español siempre visibles; los caracteres son opcionales. {course.framework.differs}</p>
    </div>
    {next && <button className="primary path-cta" onClick={() => onOpen(next.lesson as Lesson, next.state.status === 'review' ? 'review' : 'lesson', next.state.status === 'review' ? next.state.pendingReview?.run : next.state.pending?.run)}>
      {next.state.status === 'in-progress' ? `Continuar la lección ${next.lesson.number}` : next.state.status === 'review' ? `Repasar la lección ${next.lesson.number} sin ayuda` : `Empezar la lección ${next.lesson.number}`} <ArrowRight size={17}/>
    </button>}
    <ol className="path-list">
      {lessons.map(({lesson, state}) => <li key={lesson.id} className={`path-item path-${state.status}`}>
        <span className="path-num">{String(lesson.number).padStart(2, '0')}</span>
        <div className="path-body">
          <b>{lesson.title.pinyin} <span>· {lesson.title.es}</span></b>
          <small>{lesson.objective}{state.status === 'future' ? ' (según el índice del libro)' : ''}</small>
          {state.goals && state.status !== 'new' && <span className="path-goals">{state.goals.map((g:{id:string;es:string;stage:string;label:string}) => <i key={g.id} className={`stage stage-${g.stage}`}>{g.es}: {g.label.toLowerCase()}</i>)}</span>}
          <small className="book-ref">Libro p. {lesson.book.printed} · PDF {lesson.book.pdf}</small>
        </div>
        <div className="path-side">
          <span className={`path-status status-${state.status}`}>{STATUS[state.status]}</span>
          {state.status !== 'future' && <button className="text-button" onClick={() => onOpen(lesson as Lesson, 'lesson', state.pending?.run)}>{state.status === 'in-progress' ? 'Continuar' : state.status === 'new' ? 'Empezar' : 'Repetir lección'}</button>}
          {(state.status === 'done' || state.status === 'review') && <button className="text-button" onClick={() => onOpen(lesson as Lesson, 'review', state.pendingReview?.run)}>Repaso sin ayuda</button>}
        </div>
      </li>)}
    </ol>
  </section>;
}

// Notebook view: what you can communicate, per goal, with honest evidence labels.
export function CourseGoals({history}:{history:Session[]}) {
  const {lessons} = useCourseState(history);
  const started = lessons.filter(x => x.state.status !== 'future' && x.state.status !== 'new');
  if (!started.length) return null;
  return <div className="course-goals">
    <h2>Lo que puedes comunicar</h2>
    <p className="microcopy">{course.framework.label}. Se cuenta por frases y objetivos, aparte del repertorio HSK 3.0. «Usada sin modelo» solo sale de los pasos de recordar sin ayuda; nada de esto evalúa tonos.</p>
    {started.map(({lesson, state}) => <div key={lesson.id} className="goal-list">
      <h3>Lección {lesson.number} · {lesson.title.pinyin}</h3>
      {state.goals?.map((g:{id:string;es:string;stage:string;label:string;due:boolean}) => <p key={g.id}><b>{g.es}</b><span className={`stage stage-${g.stage}`}>{g.label}{g.due ? ' · repaso pendiente' : ''}</span></p>)}
    </div>)}
  </div>;
}

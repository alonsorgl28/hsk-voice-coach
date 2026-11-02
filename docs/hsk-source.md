# Marco y vocabulario

Verificado el 5 de septiembre de 2026.

Fuente primaria: [Chinese Test — HSK 3.0 / Examination Syllabus](https://www.chinesetest.cn/research).
El enlace del sitio apunta al [PDF oficial](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf).

La portada indica publicación 2025-11 e implementación 2026-07. La lista de vocabulario comienza en la página impresa 77. HSK 1: entradas 1–300; HSK 2 comienza en la entrada 301. Este proyecto adopta ese temario; no afirma que cada centro examinador haya migrado al mismo tiempo.

El MVP contiene 35 entradas de HSK 1 y 5 de HSK 2, comprobadas contra sus secciones del documento. Es un repertorio de práctica inicial, no el temario completo ni una certificación HSK. Pinyin y traducciones son glosas breves; los ejemplos, explicaciones y roleplays son originales. No se incluyen libros ni ejercicios del examen.

`src/curriculum.json` fija niveles, temas, palabras, límites de sesión y fuente. Para ampliar el contenido: verificar cada entrada en el temario, añadir glosa propia, crear un tema de hasta cinco objetivos y ejecutar los tests. Las palabras funcionales son apoyo; no significan que el estudiante las domine. El agente debe contar cualquier apoyo explícitamente enseñado dentro del límite de cinco y reducir objetivos cuando haga falta.

## Libro del alumno: HSK Standard Course 1 (verificado el 1 de noviembre de 2026)

Fuente del curso para principiantes: `HSK标准教程1.pdf` (escaneo de 152 páginas, sin texto extraíble), en la carpeta personal de materiales de Alonso. No se sube a GitHub ni se distribuye en la app.

- Portada y créditos (PDF 1–4): *HSK Standard Course 1*, autora principal Jiang Liping; autores Wang Fang, Wang Feng, Liu Liping. Beijing Language and Culture University Press. Prólogo de Xu Lin fechado el 16 de noviembre de 2013.
- Marco (prefacio, impresa 8 / PDF 10): libro 1 = HSK nivel 1, **150 palabras** (temario HSK de 2009). Es otro marco distinto del temario HSK 3.0 (2025) usado por la conversación libre; la app guarda su progreso aparte (`scope: "course"`, `framework: "hsk2009-sc1"`).
- Guía de uso (impresa 12 / PDF 14): 15 lecciones; las lecciones 1 y 2 se centran en la pronunciación con expresiones breves de saludo, despedida, agradecimiento y disculpa.
- Índice: PDF 16–21. **En las lecciones, página PDF = impresa + 20.**

| Lección | Título | Impresa | PDF | Diálogos usados |
|---|---|---|---|---|
| 1 | 你好 Nǐ hǎo | 2–7 | 22–27 | 你好/你好; 您好/你们好; 对不起/没关系 (p. 2) |
| 2 | 谢谢你 Xièxie nǐ | 8–13 | 28–33 | 谢谢/不谢; 谢谢你/不客气; 再见/再见 (p. 8) |
| 3 | 你叫什么名字 Nǐ jiào shénme míngzi | 14–21 | 34–41 | 你叫什么名字/我叫李月 (p. 14); 你是老师吗/我不是老师，我是学生; 你是中国人吗/我不是中国人，我是美国人 (p. 15); ejercicio «responde según tu caso», incluido 你是学生吗 (p. 16) |
| 4–15 | según el índice | 22–112 | 42–132 | solo título y objetivo; marcadas «Por preparar» |

«Nǐ hǎo ma?» **no** aparece en las lecciones 1–3 del libro.

Cuaderno de ejercicios (`workbook.pdf`, 129 páginas): página PDF = impresa + 2 (lección 1: impresa 1–4, PDF 3–6; lección 2: impresa 5–8, PDF 7–10; lección 3 desde impresa 9, PDF 11). Tipos de ejercicio: escuchar y elegir imagen, marcar tonos, verdadero/falso al escuchar. Se tomó como referencia de tipo de ejercicio, no de contenido.

Resumen de clases (`HSK1_Ch1_to_9_Summary-2.docx`): útil como apoyo, pero **su numeración no coincide con el libro** (su «Chapter 2» mezcla la lección 3 con diálogos que no están en el libro, como 你姓什么 o 王鹏). Por eso la secuencia se tomó del libro.

Los ejercicios, variantes, explicaciones y traducciones al español de la app son propios; solo se reutilizan frases cortas de los diálogos.

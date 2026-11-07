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
| 4 | 她是我的汉语老师 Tā shì wǒ de Hànyǔ lǎoshī | 22–29 | 42–49 | 她是谁/她是我的汉语老师，她叫李月 (p. 22); 你是哪国人/我是美国人。你呢/我是中国人; 他是谁/他是我同学/她呢？她是你同学吗/她不是我同学，她是我朋友 (p. 23); notas 谁·哪, 的, 呢 (p. 23–24); ejercicio «responde según tu caso» (p. 24) |
| 5 | 她女儿今年二十岁 Tā nǚ'ér jīnnián èrshí suì | 30–39 | 50–59 | 你家有几口人/我家有三口人 (p. 30); 你女儿几岁了/她今年四岁了; 李老师多大了/她今年50岁了/她女儿呢/她女儿今年20岁 (p. 31); notas 几, números hasta 99, 了, 多大 (p. 32–33); cultura: 几岁 / 多大 / 多大年纪 (p. 39) |
| 6 | 我会说汉语 Wǒ huì shuō Hànyǔ | 40–47 | 60–67 | 你会说汉语吗/我会说汉语/你妈妈会说汉语吗/她不会说 (p. 40); 中国菜好吃吗/中国菜很好吃/你会做中国菜吗/我不会做; 你会写汉字吗/我会写/这个字怎么写/对不起，这个字我会读，不会写 (p. 41); notas 会, 很 + adjetivo, 怎么 (p. 42) |
| 7 | 今天几号 Jīntiān jǐ hào | 48–55 | 68–75 | 请问，今天几号/今天9月1号/今天星期几/星期三 (p. 48); 昨天是几月几号/昨天是8月31号，星期二/明天呢/明天是9月2号，星期四; 明天星期六，你去学校吗/我去学校/你去学校做什么/我去学校看书 (p. 49); notas fecha, predicado nominal, 去 + lugar + acción (p. 50); meses y días (p. 51) |
| 8 | 我想喝茶 Wǒ xiǎng hē chá | 56–63 | 76–83 | 你想喝什么/我想喝茶/你想吃什么/我想吃米饭 (p. 56); 下午你想做什么/下午我想去商店/你想买什么/我想买一个杯子; 你好！这个杯子多少钱/28块/那个杯子多少钱/那个杯子18块钱 (p. 57); notas 想, 多少, 个·口, 元/块 (p. 58–59) |
| 9 | 你儿子在哪儿工作 Nǐ érzi zài nǎr gōngzuò | 64–71 | 84–91 | 小猫在哪儿/小猫在那儿/小狗在哪儿/小狗在椅子下面 (p. 64); 你在哪儿工作/我在学校工作/你儿子在哪儿工作/我儿子在医院工作，他是医生; 你爸爸在家吗/不在家/他在哪儿呢/他在医院 (p. 65); notas 在 (verbo), 哪儿, 在 (preposición), 呢 (p. 66–67) |
| 10–15 | según el índice | 72–112 | 92–132 | solo título y objetivo; marcadas «Por preparar» |

«Nǐ hǎo ma?» **no** aparece en las lecciones 1–3 del libro.

Cuaderno de ejercicios (`workbook.pdf`, 129 páginas): página PDF = impresa + 2 (lección 1: impresa 1–4, PDF 3–6; lección 2: impresa 5–8, PDF 7–10; lección 3 desde impresa 9, PDF 11). Lecciones 4–9, según los marcadores del PDF y comprobado en las páginas: L4 impresa 17–24 (PDF 19–26), L5 25–32 (27–34), L6 33–40 (35–42), L7 41–48 (43–50), L8 49–56 (51–58), L9 57–64 (59–66). Tipos de ejercicio: escuchar y elegir imagen, marcar tonos, verdadero/falso al escuchar. Se tomó como referencia de tipo de ejercicio, no de contenido.

Resumen de clases (`HSK1_Ch1_to_9_Summary-2.docx`): útil como apoyo, pero **su numeración no coincide con el libro** (su «Chapter 2» mezcla la lección 3 con diálogos que no están en el libro, como 你姓什么 o 王鹏). Por eso la secuencia se tomó del libro. En los capítulos 4–9 la diferencia es mayor: su «Chapter 4» incluye 爸爸妈妈都好吗, su «Chapter 5» 男朋友 y 医生, y su «Chapter 9» trata de cocinar (你会做饭吗), mientras que la lección 9 del libro es 你儿子在哪儿工作 (在 / 哪儿). Las lecciones 4–9 de la app siguen solo el libro.

Los ejercicios, variantes, explicaciones y traducciones al español de la app son propios; solo se reutilizan frases cortas de los diálogos.

### Lecciones 4–9 (verificado el 7 de noviembre de 2026)

Leídas completas en el PDF renderizado (PDF 42–91): calentamiento, los tres textos con vocabulario, notas, ejercicios, pinyin, caracteres, aplicación y cultura. Para la conversación se usan los textos, las notas y los ejercicios «responde según tu caso» y de aplicación. Las secciones de pronunciación y caracteres (trazos, radicales) no se convierten en pasos porque la app no exige leer ni escribir caracteres.

Respuestas personales (edad, número de familiares, país, fecha real, bebida, lugar de trabajo, precio): la app acepta solo valores de un rango o una lista cerrada (`SLOTS` en `src/course.mjs`). Los países distintos de 中国 y 美国, 公司 (empresa), 水 y 咖啡 no están en esas lecciones del libro: son apoyo propio para contestar con la verdad; la pista bajo el apoyo lo dice en pantalla.

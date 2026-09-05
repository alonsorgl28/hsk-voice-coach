# Marco y vocabulario

Verificado el 5 de septiembre de 2026.

Fuente primaria: [Chinese Test — HSK 3.0 / Examination Syllabus](https://www.chinesetest.cn/research).
El enlace del sitio apunta al [PDF oficial](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf).

La portada indica publicación 2025-11 e implementación 2026-07. La lista de vocabulario comienza en la página impresa 77. HSK 1: entradas 1–300; HSK 2 comienza en la entrada 301. Este proyecto adopta ese temario; no afirma que cada centro examinador haya migrado al mismo tiempo.

El MVP contiene 35 entradas de HSK 1 y 5 de HSK 2, comprobadas contra sus secciones del documento. Es un repertorio de práctica inicial, no el temario completo ni una certificación HSK. Pinyin y traducciones son glosas breves; los ejemplos, explicaciones y roleplays son originales. No se incluyen libros ni ejercicios del examen.

`src/curriculum.json` fija niveles, temas, palabras, límites de sesión y fuente. Para ampliar el contenido: verificar cada entrada en el temario, añadir glosa propia, crear un tema de hasta cinco objetivos y ejecutar los tests. Las palabras funcionales son apoyo; no significan que el estudiante las domine. El agente debe contar cualquier apoyo explícitamente enseñado dentro del límite de cinco y reducir objetivos cuando haga falta.

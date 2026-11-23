# Guion de presentación · Club Pingüí · 23/11/2026

**Alumno:** Luis Javier Tovar Segura
**Materia:** Formulación de Proyectos de Tecnología (7A) · Mtro. Domingo Fraga Hernández
**Duración objetivo:** 14–16 min + preguntas
**Entrega:** hasta el 23/NOV/2026. La presentación comienza apenas empiece la clase.
**Regla de oro:** no leer la diapositiva. Cada una tiene una idea; el texto de apoyo ya está en pantalla.
**Corte:** estado técnico y capturas del 22–23/11/2026; valor ganado sigue siendo del 06/10/2026.

---

## Mapa rápido

| # | Tema | Tiempo | Frase ancla |
|---|------|--------|-------------|
| 1 | Portada | 0:35 | “Del documento al producto ejecutable.” |
| 2 | Punto de partida | 1:00 | “Retomo el ‘todavía incompleto’ del 27/10.” |
| 3 | Ruta y KPIs | 0:55 | “Cuatro bloques, todos con evidencia.” |
| 4 | Prácticas 1–3 | 1:10 | “Planear, investigar y diseñar dejó artefactos que hoy se usan.” |
| 5 | Prácticas 4–5 | 1:10 | “Medir el avance y calcular el riesgo de la fecha.” |
| 6 | Práctica 6 | 0:55 | “$3,025 es lo que se gasta; $21,025 es lo que vale.” |
| 7 | Riesgos ocurridos | 1:20 | “Lo que sí pasó tuvo impacto y corrección.” |
| 8 | Matriz prospectiva | 1:10 | “Probabilidad por impacto, no lista de deseos.” |
| 9 | Medidas | 1:00 | “Acción, plazo y métrica de salida.” |
| 10 | Factibilidad tecnológica | 1:00 | “El stack no es una apuesta: ya sostiene el producto.” |
| 11 | Factibilidad e impactos | 0:55 | “Viable dentro del corte académico.” |
| 12 | Demo · recorrido | 1:40 | “Isla, seis portales, seis modos reales.” |
| 13 | Demo · Ciudad | 1:40 | “C1 y C2 están cerradas; C3–C5, no.” |
| 14 | Validación | 0:50 | “Revisé antes de subir y validé que se vea.” |
| 15 | Objetivos pendientes | 0:50 | “No subo un objetivo sin su evidencia.” |
| 16 | Cierre | 0:40 | “Real y medible; lo incompleto tiene nombre y fecha.” |

---

## Bloque I · Apertura (2:30)

### 1 · Portada
**Objetivo:** ubicar al docente en 20 segundos.
**Di:** “Buenos días. Soy Luis Javier Tovar Segura y presento el avance de Club Pingüí al 23 de noviembre de 2026. La frase que retomo de la presentación anterior es: pasamos de la documentación a un producto ejecutable.”
**Señala:** nombre, fecha y la tira inferior: 6/6 modos · C1–C2 · 14 suites · 60 bots.
**Transición:** “Empiezo por donde quedamos.”

### 2 · Punto de partida
**Di:** “El 27 de octubre cerramos diciendo: ‘el avance es real, medible y todavía incompleto’. Quedaban tres cosas: el acta con dos o más clientes para O1, repetir la verificación del tuner de mapas para O4, y carga, despliegue y aceptación para O6. El 6 de noviembre se cumplió el prototipo; hoy presentamos la versión estable; la entrega final es el 2 de diciembre y la aceptación, el 15.”
**Señala:** la cita y los tres pendientes a la izquierda; la línea de hitos a la derecha.
**Frase honesta:** “Lo que ya estaba cerrado no se tocó: armas, mapas y cero regresiones.”
**Transición:** “Esta es la ruta y lo que cambió.”

### 3 · Ruta y KPIs
**Di:** “Cuatro bloques: las seis prácticas con capturas, la matriz de riesgos, la factibilidad y la demo. Los cinco números de arriba resumen el corte: seis modos en vivo, catorce suites verdes, sesenta bots con p95 de 132 milisegundos, quince defectos móviles corregidos y Ciudad C1–C2.”
**Señala:** la tabla de la rúbrica; luego la tarjeta de cambios.
**Dato clave:** “El valor ganado sigue siendo del 06/10; mover una sola variable sin recalcular las tres sería inventar cifras.”
**Transición:** “Empiezo por las prácticas.”

---

## Bloque II · Prácticas (3:00)

### 4 · Prácticas 1–3
**Di:** “Las tres primeras prácticas fijaron el qué, el con qué y el cómo. Quince actividades en cuatro fases con línea base del 15 de septiembre; la investigación comparó motores 3D y mantuvo Three.js porque migrar costaba cero y tirar ~250 KB de lógica propia, no; y la arquitectura cliente-servidor permitió que los seis modos se enchufen como reglas sin reescribir render, chat ni red.”
**Señala:** las tres capturas: documento de fases, diagrama de arquitectura y tuner de armas.
**Transición:** “Después vino la medición.”

### 5 · Prácticas 4–5
**Di:** “La práctica 4 dejó los seis objetivos con indicador y las técnicas aplicadas: MBO, SMART, OKR, PMBOK, valor ganado y Stage-Gate, con SPI 1.13 y CPI 1.04 al 06/10. La práctica 5 estimó la fecha con tres valores: ruta crítica de 85.17 días, sigma 4.02 y 88 % de probabilidad de terminar en 90 días. A8 y A9 concentran la varianza.”
**Señala:** captura del documento de seguimiento; luego Gantt y PERT.
**Dato clave:** “El Stage-Gate detuvo dos cierres: el acta de clientes y el tuner de mapas.”
**Transición:** “Y todo eso necesitaba recursos.”

### 6 · Práctica 6
**Di:** “El desembolso real son $3,025: VPS, dominio, internet, energía y una contingencia del 10 %. El valor total es $21,025 porque incluye el equipo de cómputo que ya tenía. Las 160 horas se reparten en 95 de desarrollo, 35 de diseño 3D, 20 de calidad y 10 de documentación.”
**Señala:** la frase “3,025 es lo que se gasta; 21,025 es lo que vale”.
**Transición:** “Ahora los riesgos: primero los que ya ocurrieron.”

---

## Bloque III · Matriz de riesgos (3:30)

### 7 · Riesgos ocurridos
**Di:** “Cinco riesgos pasaron de verdad. El más grave fue un error de zona muerta en crystalTick: cualquier cristal ofertado apagaba el servidor entero; se corrigió renombrando una variable y la carga posterior pasó 60 de 60. En móvil encontramos y corregimos 15 defectos en siete viewports: login cortado, joystick fuera de pantalla, HUD solapado e inventario que no respondía al toque. Y quedan dos evidencias formales pendientes: el acta de O1 y la reverificación del tuner de mapas.”
**Señala:** la fila de crystalTick y la de O1.
**Dato clave:** “Después de las correcciones: 14 suites en verde y 0 regresiones.”
**Transición:** “Estos son los que pueden ocurrir.”

### 8 · Matriz prospectiva
**Di:** “La matriz usa probabilidad y impacto del 1 al 3. Cuatro riesgos quedan en nivel alto: rendimiento de Ciudad con 30 a 50 avatares, el techo de unas 60 sesiones por proceso, el riesgo de extender C3 a C5 antes del 2 de diciembre, y la falta de acta y despliegue aceptado. Tres quedan en nivel medio: WebGL en gama baja, regresiones y moderación.”
**Señala:** la columna de nivel; detente en R1 y R4.
**Frase honesta:** “No prometo 50 jugadores medidos: prometo el diseño de celdas y la prueba de 30 bots más dos humanos.”
**Transición:** “Cada uno tiene una medida.”

### 9 · Medidas
**Di:** “R1 ya tiene culling por celdas de 20 metros, etiquetas solo a menos de 15 metros y animación reducida para lejanos. R3 se controló con la congelación del 18 al 23 y el tag v0.2. R5 se corrigió con LOD y el arnés de viewports. R6 se cubre con las catorce suites antes de cada entrega. Lo que sigue pendiente es R4: acta con 2+ clientes, publicación con base persistente y aceptación del 15 de diciembre. R2 y R7 quedan en diseño y parcial, respectivamente.”
**Señala:** las columnas Estado y Métrica de salida.
**Transición:** “Pasamos a factibilidad.”

---

## Bloque IV · Factibilidad (1:55)

### 10 · Factibilidad tecnológica
**Di:** “Mantener Three.js cuesta cero y conserva el render propio; Node y Socket.IO ya demostraron 60 sesiones y 132 milisegundos de p95; SQLite da persistencia sin otro servidor; y el contrato de modo permite que los seis modos compartan red y HUD. Rapier y Colyseus están estudiados para Karts y Ciudad, pero todavía no justifican migrar el servidor.”
**Señala:** la columna de evidencia.
**Dato clave:** “El techo de 60 sesiones está documentado y tiene respuesta prevista, no improvisada.”
**Transición:** “Y el dinero y el impacto.”

### 11 · Factibilidad e impactos
**Di:** “El proyecto es viable dentro del corte académico: $3,025 de gasto real, $21,025 de valor de recursos, 160 horas de línea base y catorce suites verdes. El impacto es tecnológico —producto en navegador—, académico —seis prácticas con evidencia—, económico —operación barata—, operativo —un desarrollador con hitos y gates— y social —salas, chat, modos y un distrito accesible en móvil.”
**Señala:** la tabla de ámbitos y el veredicto.
**Frase honesta:** “C3 a C5 quedan fuera del corte; no las cuento como entregadas.”
**Transición:** “Ahora la demostración del avance actual.”

---

## Bloque V · Penúltimo avance / demo (3:20)

### 12 · Demo 1 · recorrido del sistema
**Di:** “Voy a entrar con un invitado, pasar por el vestidor y llegar a la isla. El anillo tiene seis portales y los seis responden ‘live’. Entro a Pares, vuelvo, entro a TNT, a Karts, al Coliseo y al Escondite. Fíjense en que el combate solo se habilita en Coliseo y que cada modo guarda estadísticas en user_stats.”
**Señala:** las seis capturas si la demo en vivo falla; ese es el plan B.
**Dato clave:** “Los seis portales estaban anunciados el 27/10; hoy los seis son jugables.”
**Transición:** “Ahora profundizo en Ciudad.”

### 13 · Demo 2 · Ciudad C1–C2
**Di:** “Ciudad es el cambio más grande desde octubre. Cámara en primera persona bloqueada, sin combate, distrito procedural. En C2 recojo un objeto —el contador de la billetera sube— y compro en la tienda; ambos datos persisten en SQLite. El interés por celdas mantiene etiquetas solo a menos de 15 metros y reduce la animación de quien está lejos.”
**Señala:** las tres capturas de FP, recogida y tienda.
**Frase honesta:** “C1 y C2 están cerradas. Parcelas, trabajos y moderación son C3 a C5 y no están en esta versión.”
**Si preguntan por 50 jugadores:** “El contrato declara 50, pero lo medido es 60 sesiones totales; por eso el DoD pide 30 bots y dos humanos antes de hablar de 50.”
**Transición:** “Cierro con la revisión previa.”

---

## Bloque VI · Cierre (1:30)

### 14 · Validación
**Di:** “Antes de subirlo ejecuté las catorce suites, revisé el reporte de carga y verifiqué los logs de captura: trece imágenes del juego y cuatro de documentos, con ok en verdadero y cero errores de consola. Después validé que el HTML se navegue con flechas, que el PDF tenga 16 páginas y que el PPTX tenga 16 diapositivas editables.”
**Señala:** los cuatro KPI y la tabla de revisiones.
**Transición:** “Y esto es lo que todavía no cierro.”

### 15 · Objetivos pendientes
**Di:** “O1 se queda en 95 %: la técnica funciona, pero no hay acta con dos o más clientes en la carpeta de documentos. O4 está cumplido con reserva hasta repetir el tuner de mapas. O6 está en proceso: la carga y el servidor local responden, pero faltan publicación y aceptación. O2, O3 y O5 sí están cerrados.”
**Señala:** la fila de O1.
**Dato clave:** “No subo un objetivo a 100 % sin la evidencia que su indicador exige.”
**Transición:** “Una última idea.”

### 16 · Cierre
**Di:** “El 27 de octubre dijimos que el avance era real, medible y todavía incompleto. Hoy es real y medible —seis modos, Ciudad C1–C2, 14 suites y 60 bots— y la parte incompleta tiene nombre, responsable y fecha: acta el 15 de diciembre, entrega final el 2. Quedo atento a preguntas.”
**Señala:** la línea de hitos y el chip “Preguntas”.

---

## Preguntas previsibles · respuesta en una línea

- **¿Ya están los 50 jugadores en Ciudad?** No. El contrato declara 50; la evidencia es de 60 sesiones totales y el DoD de Ciudad pide 30 bots + 2 humanos antes de hablar de 50.
- **¿Por qué O1 al 95 % si la carga pasó 60/60?** Porque el indicador exige acta con 2+ clientes y no hay un acta real en `docs/`. No es un pendiente técnico.
- **¿Se entregó todo lo del plan de modalidades?** No. Se entregaron seis modos y C1–C2 de Ciudad; C3–C5 están planificados para después del 2 de diciembre.
- **¿Por qué no migrar a otro motor o a Colyseus?** El costo de migrar es alto y el stack actual sostiene lo medido; la investigación dejó los spikes decisiones documentadas para cuando el límite aparezca.
- **¿El acta de clientes está en la carpeta?** No. Por eso no se afirma que O1 esté cerrada; se pedirá en la aceptación.
- **¿Cómo sé que las capturas son reales?** Se tomaron desde el servidor local con Edge headless; los logs `capture-23nov-log.json` y `capture-docs-23nov-log.json` registran cero errores de consola y contenido verificado.

---

## 10 minutos antes

- Servidor Node y proxy arriba: `/healthz` → `{"ok":true,...}` y `http://localhost:3000/` → 200.
- Navegador en la sala con sesión iniciada; si falla la demo, usar las capturas de las diapositivas 12 y 13.
- Notificaciones apagadas y pestañas extra cerradas.
- HTML en `#1`; PDF de respaldo abierto.
- Comprobar que las tres rutas nuevas (`presentacion_23nov.html`, `.pdf`, `.pptx`) se vean desde esta carpeta.
- Botella de agua fuera de cuadro. Respirar.

## Versión de 8 minutos

Mantener **1, 3, 4, 6, 7, 8, 10, 12, 13, 15 y 16**. Comprimir 2, 5, 9, 11 y 14 a una frase cada una.

## Si te quedas en blanco

Mira el número más grande de la diapositiva y di su lectura. Después conecta con la siguiente: “y eso se traduce en…”. Nunca improvises una cifra: usa las de la tira superior o las del guion.

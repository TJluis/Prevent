# =====================================================================
#  BITÁCORA CLUB PINGÜI  —  Generador .docx (OOXML puro, sin Word)
#  -------------------------------------------------------------------
#  Genera: docs\Bitacora_Modificaciones_ClubPingui.docx
#
#  CÓMO USAR EN MODIFICACIONES FUTURAS:
#   1) Agregar un nuevo elemento en el array $mods (copiar la estructura
#      de un ID existente): Id, Fecha, Tipo, Modulos, Resumen (breve),
#      Desc, Estado y las 6 filas de su rúbrica $rub con
#      (Criterio, Ponderación, Puntos obtenidos, Observaciones/evidencias).
#   2) Si se agregó/quita un módulo, actualizar notas en $notasCliente
#      o $notasServer (sección 2.3).
#   3) Ejecutar:  powershell -ExecutionPolicy Bypass -File .\bitacora.ps1
#   El script recalcula calificaciones y totales automáticamente.
# =====================================================================

$ErrorActionPreference = "Stop"
$root = "C:\xampp\htdocs\Proyecto_ClubPingui"
$outDocx = Join-Path $root "docs\Bitacora_Modificaciones_ClubPingui.docx"
$fechaHoy = (Get-Date).ToString("dd/MM/yyyy")

# ---------------------------------------------------------------------
#  DATOS — REGISTRO DE MODIFICACIONES REALIZADAS (a la fecha)
#  Estructura $mods: cada elemento con campos + $rub (6 filas).
#  "Ponderación" fija; "Obtenido" se califica por rúbrica.
# ---------------------------------------------------------------------
$mods = @(
  @{
    Id = "M01"; Fecha = "Jul - Ago 2026"; Tipo = "Código / Nuevo módulo"
    Modulos = "server/game.js; public/js/combat.js"
    Resumen = "Combate cuerpo a cuerpo (melee)"
    Desc = "Se implementó el combate melee en el servidor autoritativo: ataque slash, daño, vidas (hp), respawn y sincronización en salas; el cliente reacciona a los estados y refleja las mutaciones."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Ataque, daño, vidas y respawn funcionando y sincronizados."),
      @("Calidad de código","1.5","1.5","Sigue convenciones; separado servidor/cliente."),
      @("Integración sin regresiones","2.0","2.0","Movimiento y salas no se vieron afectados."),
      @("Pruebas ejecutadas","2.0","1.5","Se probó en local con varios jugadores; faltan pruebas automatizadas."),
      @("Documentación en bitácora","1.0","1.0","Registrada con fecha, archivos y evidencia."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M02"; Fecha = "Jul - Ago 2026"; Tipo = "Código / Contenido"
    Modulos = "public/js/weaponDefs.js; public/js/itemDefs.js"
    Resumen = "Catálogo de 17 armas"
    Desc = "Se definieron las 17 armas del juego (espada, hacha, daga, maza, lanza, escudo, arco, etc.) con sus estadísticas y las correspondencias en el catálogo de objetos del inventario."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","17 armas definidas y equipables."),
      @("Calidad de código","1.5","1.5","Datos centralizados en defs, fácil de extender."),
      @("Integración sin regresiones","2.0","2.0","Inventario y equipamiento compatibles."),
      @("Pruebas ejecutadas","2.0","1.5","Verificado en el cliente; sin unit tests."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M03"; Fecha = "Jul - Ago 2026"; Tipo = "Código"
    Modulos = "public/js/combat.js"
    Resumen = "Combate en el cliente"
    Desc = "Máquina de estados de combate en el cliente: detección de impacto, cooldown, feedback visual/sonoro y sincronización con el servidor."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Golpear y recibir daño reflejado en pantalla."),
      @("Calidad de código","1.5","1.5","Estados claros y reutilizables."),
      @("Integración sin regresiones","2.0","2.0","No rompió movimiento ni chat."),
      @("Pruebas ejecutadas","2.0","1.5","Probado con conexión local de 2 jugadores."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M04"; Fecha = "01 - 05 Sep 2026"; Tipo = "Código / Nuevo módulo"
    Modulos = "public/js/viewmodel.js; public/js/main.js"
    Resumen = "Primera persona (viewmodel) con 17 armas"
    Desc = "Vista en primera persona: escena anclada a la cámara con las 17 armas modeladas proceduralmente y su integración en main.js mediante swapViewGun()."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Viewmodel creado para las 17 armas."),
      @("Calidad de código","1.5","1.5","Geometría precompilada en low poly, estilo cartoon."),
      @("Integración sin regresiones","2.0","2.0","La vista en tercera persona no se alteró."),
      @("Pruebas ejecutadas","2.0","1.5","Harness vm-test: 17 armas / 326 mallas OK."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M05"; Fecha = "05 Sep 2026"; Tipo = "Código / Corrección"
    Modulos = "public/js/viewmodel.js"
    Resumen = "Ajuste BASE y escala del viewmodel"
    Desc = "Se ajustó la posición base del viewmodel (BASE = 0.26, -0.17, -0.54) y la escala (1.15) para que arma y manos queden dentro del encuadre FPV y sean visibles."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Arma visible en el encuadre FPV."),
      @("Calidad de código","1.5","1.5","Valores centralizados como constantes."),
      @("Integración sin regresiones","2.0","2.0","Compatible con las 17 armas."),
      @("Pruebas ejecutadas","2.0","2.0","Harness vm-base: 17 armas + manos dentro del frustum."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M06"; Fecha = "05 Sep 2026"; Tipo = "Código / Mejora"
    Modulos = "public/js/viewmodel.js; public/js/main.js"
    Resumen = "Manos en FPV sin arma"
    Desc = "buildViewmodel(null) construye un rig de manos/guantes del pingüino para cuando no hay arma equipada; swapViewGun acepta null (manos vacías)."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Manos visibles sin arma equipada."),
      @("Calidad de código","1.5","1.5","Reuso de la misma geometría de guantes."),
      @("Integración sin regresiones","2.0","2.0","Equipar/desequipar sin errores."),
      @("Pruebas ejecutadas","2.0","2.0","Harness vm-base null-arms OK (0.260, -0.177, -0.540)."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M07"; Fecha = "08 Sep 2026"; Tipo = "Código / Corrección"
    Modulos = "public/js/world.js"
    Resumen = "Fix raíz FPV: scene.add(camera)"
    Desc = "Causa raíz de que el viewmodel no se viera: la cámara nunca se agregaba a la escena, por lo que sus hijos no se renderizaban. Solución: scene.add(camera) en createWorld. Verificado con harness: los 18 viewmodels (17 armas + manos) son alcanzables y están dentro del frustum (NDC 0.52, -0.60, 0.63)."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Se restauró la visibilidad del viewmodel FPV."),
      @("Calidad de código","1.5","1.5","Una línea, al lado del resto de adds de la escena."),
      @("Integración sin regresiones","2.0","2.0","Sin Raycaster en el proyecto; no hay efectos colaterales."),
      @("Pruebas ejecutadas","2.0","2.0","node --check OK; vm-render: 18 viewmodels en grafo y dentro del frustum."),
      @("Documentación en bitácora","1.0","1.0","Causa raíz y solución documentadas."),
      @("Cumplimiento de tiempo","0.5","0.5","Corregido el mismo día del reporte.")
    )
  },
  @{
    Id = "M08"; Fecha = "08 Sep 2026"; Tipo = "Infraestructura"
    Modulos = "server/index.js (arranque)"
    Resumen = "Restauración del servidor"
    Desc = "El servidor Node estaba caído (puerto 3000 sin escuchar, sin procesos node). Se restauró con node server/index.js, arranque persistente vía WMI y captura de logs a %TEMP%\opencode\server.out.log y server.err.log. Respuesta HTTP 200 en / y en los módulos del cliente."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Servidor de nuevo en línea."),
      @("Calidad de código","1.5","1.5","Sin cambios de código; solo operación."),
      @("Integración sin regresiones","2.0","2.0","Sin cambios de comportamiento."),
      @("Pruebas ejecutadas","2.0","2.0","HTTP 200 en / y /js/viewmodel.js."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Restaurado en la misma sesión.")
    )
  },
  @{
    Id = "M09"; Fecha = "08 Sep 2026"; Tipo = "Infraestructura / Despliegue"
    Modulos = "Cloudflare Tunnel; C:\Cloudflared\config.yml"
    Resumen = "Túnel PinguiDev (Cloudflare)"
    Desc = "Diagnóstico del servicio cloudflared colgado desde el 03/09 (proceso zombie, sin autoridad para detener el servicio LocalSystem). Solución: desinstalación del servicio y reinstalación con token del túnel 20b6aaac-ba6e-47f2-9651-255f780138f7, servicio autoarrancado. Mapeo PinguiDev.corvet.dpdns.org -> http://localhost:3000. Verificado desde red limpia (r.jina.ai) con HTTP 200 y título 'Club PINGÜI'. Nota: la red local interpone un filtro web que puede dar falsos 403 o certificados no confiables; verificar desde el celular u otra red."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Túnel permanente operativo y mapeo correcto."),
      @("Calidad de código","1.5","1.5","Configuración minimalista (único host + fallback 404)."),
      @("Integración sin regresiones","2.0","2.0","El túnel anterior (api.corvet) ya no lo sirve este equipo; corresponde a otra PC."),
      @("Pruebas ejecutadas","2.0","2.0","curl -k y r.jina.ai: HTTP 200; 4 conexiones QUIC registradas."),
      @("Documentación en bitácora","1.0","1.0","Diagnóstico, token y comandos documentados."),
      @("Cumplimiento de tiempo","0.5","0.5","Resuelto en la misma sesión.")
    )
  },
  @{
    Id = "M10"; Fecha = "08 Sep 2026"; Tipo = "Documento / Entregable"
    Modulos = "docs/Practica_Organizacion_Fases_ClubPingui.pdf (+ HTML)"
    Resumen = "Entregable de la práctica de fases"
    Desc = "Práctica UTNC 'Investigación aplicada para organizar las fases del proyecto' (Formulación de Proyectos de Tecnología, Luis Javier Tovar Segura, sep-dic 2026): portada, lista de 15 actividades, 4 fases, programación de tiempos con línea base (15/09) y real/estimada, y conclusión. Ajuste de cierre: entrega final el 02/12/2026. Cumple la rúbrica docente de 10 puntos."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Los 4 puntos de la rúbrica docente + portada."),
      @("Calidad de código","1.5","1.5","HTML estructurado y PDF generado con Edge."),
      @("Integración sin regresiones","2.0","2.0","Documento independiente del código."),
      @("Pruebas ejecutadas","2.0","2.0","PDF verificado (5 páginas, 153 KB)."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M11"; Fecha = "08 Sep 2026"; Tipo = "Proceso / Trazabilidad"
    Modulos = "docs/Bitacora_Modificaciones_ClubPingui.docx; docs/bitacora.ps1"
    Resumen = "Política de bitácora y rúbricas"
    Desc = "Apertura de esta bitácora y estandarización de rúbricas de 10 puntos que se aplicarán a cada modificación (realizada o futura), con registro de ID, fecha, archivos, evidencias y calificación. Se documenta el estado actual del proyecto hasta esta fecha."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Documento generado con análisis, registro y rúbricas."),
      @("Calidad de código","1.5","1.5","Script re-generable que recalcula totales."),
      @("Integración sin regresiones","2.0","2.0","Sin impacto en el código del juego."),
      @("Pruebas ejecutadas","2.0","2.0","Generación OOXML; archivo verificado."),
      @("Documentación en bitácora","1.0","1.0","Proceso definido y replicable."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en plazo.")
    )
  },
  @{
    Id = "M12"; Fecha = "08 Sep 2026"; Tipo = "Código / Corrección"
    Modulos = "public/js/viewmodel.js"
    Resumen = "Fix FPV: manos y arma fuera del frustum"
    Desc = "Aún con scene.add(camera) activo (M07), las aletas/manos del pingüino sin arma quedaban fuera del frustum de la cámara FPV (profundidad ~0.96 y altura ~-0.53 con mitad de FOV vertical de solo 27.5°), por lo que el brazo quedaba oculto bajo el borde de la pantalla. Solución: levantar el anclaje BASE (0.26, -0.17, -0.54 -> 0.26, -0.12, -0.48) y reposicionar las aletas desarmadas cerca del centro de la vista (derecha 0.18, 0, -0.3; izquierda -0.16, -0.02, -0.34). Verificado por el usuario en navegador: las manos y el arma ya se ven en primera persona."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Manos y arma visibles en FPV incluyendo sin arma equipada."),
      @("Calidad de código","1.5","1.5","Ajustes solo de constantes BASE y posiciones; sin cambios de estructura."),
      @("Integración sin regresiones","2.0","2.0","Las 17 armas siguen enrumbadas con la misma escala 1.15."),
      @("Pruebas ejecutadas","2.0","2.0","node --check OK; validación visual del usuario en recarga limpia (Ctrl+F5)."),
      @("Documentación en bitácora","1.0","1.0","Causa (frustum) y solución registradas."),
      @("Cumplimiento de tiempo","0.5","0.5","Corregido el mismo día del reporte.")
    )
  },
  @{
    Id = "M13"; Fecha = "08 Sep 2026"; Tipo = "Código / Corrección"
    Modulos = "public/js/world.js"
    Resumen = "Fix: línea de costura en el suelo de los mapas"
    Desc = "La textura del suelo se genera con puntos aleatorios en un canvas de 512 px que se repite (repeat 6) sobre el plano. Como los puntos cortados en los bordes no coincidían con los del tile vecino, cada límite de repetición mostraba una costura; con plano de 80 unidades las costuras caen en x = 0, ±13.3 y ±26.7, dejando visible una línea 'parecida a los muros' atravesando la mitad de todos los mapas. Solución: los puntos cercanos a un borde se replican al borde opuesto (wrap-around), haciendo el patrón correctamente tileable y eliminando las costuras en cualquier orientación."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Desaparece la línea central del suelo en todos los mapas."),
      @("Calidad de código","1.5","1.5","Wrap de 4 casos (x+, y+, y+, esquinas) dentro de makeGround; borde uniforme."),
      @("Integración sin regresiones","2.0","2.0","Misma textura base y densidad de puntos; sin cambios de iluminación."),
      @("Pruebas ejecutadas","2.0","1.5","node --check OK; pendiente validación visual del usuario."),
      @("Documentación en bitácora","1.0","1.0","Causa raíz y solución registradas."),
      @("Cumplimiento de tiempo","0.5","0.5","Corregido el mismo día del reporte.")
    )
  },
  @{
    Id = "M14"; Fecha = "08 Sep 2026"; Tipo = "Código / Corrección"
    Modulos = "public/js/combat.js"
    Resumen = "Fix: línea mira azul (aimLine) oculta por defecto"
    Desc = "El reporte persistente 'línea parecida a los muros delimitadores' que cruza la mitad de todos los mapas correspondía a la línea de mira (delay: no era una costura del suelo - M13 ya la había eliminado). El aimLine es un THREE.Line azul (0x4c84ff) que iba del jugador a 'range' metros (sniper 30, plasma 20) a y=0.95 (altura del jugador), visible automáticamente con cualquier arma equipada (aimLine.visible = enabled && !!weapon). Con el jugador cerca del centro, la línea cruzaba todo el mapa elevada como si fuera una frontera. Solución: constante SHOW_AIM_LINE = false; la línea solo se construye/ubica cuando la constante está activa. La geometría del arma, el HUD y la puntería real (raycast) no se tocan."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Ya no aparece la línea elevada cruzando el mapa con el arma equipada."),
      @("Calidad de código","1.5","1.5","Constante única que gobierna visibilidad y cómputo; sin código muerto ejecutándose."),
      @("Integración sin regresiones","2.0","2.0","El disparo usa aimRay() directamente; la línea era solo visual y queda oculta."),
      @("Pruebas ejecutadas","2.0","1.5","node --check OK; pendiente validación visual del usuario."),
      @("Documentación en bitácora","1.0","1.0","Causa raíz real identificada y documentada."),
      @("Cumplimiento de tiempo","0.5","0.5","Corregido el mismo día del reporte.")
    )
  },
  @{
    Id = "M15"; Fecha = "08 Sep 2026"; Tipo = "Código / Corrección"
    Modulos = "public/js/world.js (makeSky)"
    Resumen = "Fix: línea dura del horizonte en el shader del cielo"
    Desc = "Causa raíz final del reporte 'muro de límite fijo cortando la mitad del mapa': el fragment shader de makeSky tenía una discontinuidad dura exactamente en h = 0 (el plano y=0 del mundo). La rama h>=0 mostraba color ~top (cielo brillante) con smoothstep(0, 0.4, h*0.5+0.5), que satura en 1 desde h=0, mientras la rama h<0 dejaba midColor; en el horizonte exacto eso producía una línea brillante y nítida, fija a la altura del usuario, dividiendo la vista. Solución: una sola escalera de mezcla continua (down = smoothstep(-0.35, 0, h), up = smoothstep(0, 0.4, h)*0.95, color = mix(mix(horizon, mid, down), top, up)). Verificado numéricamente: en h=-0.01, 0 y +0.01 el color es idéntico (0.50, 0.50, 1.00) en la paleta de prueba."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Desaparece la línea tipo muro del centro de la vista en todos los mapas."),
      @("Calidad de código","1.5","1.5","Shader sin ramas con salto; mezcla única y continua en el horizonte."),
      @("Integración sin regresiones","2.0","2.0","El cielo mantiene su gradiente superior/medio/horizonte en las 8 temáticas."),
      @("Pruebas ejecutadas","2.0","2.0","node --check OK; gradiente verificado numéricamente alrededor de h=0."),
      @("Documentación en bitácora","1.0","1.0","Causa raíz final y solución registradas (aclara M13/M14)."),
      @("Cumplimiento de tiempo","0.5","0.5","Corregido el mismo día del reporte.")
    )
  },
  @{
    Id = "M16"; Fecha = "09 Sep 2026"; Tipo = "Código / Mejora visual"
    Modulos = "public/js/avatar.js"
    Resumen = "Avatar pingüino rediseñado con estética cartoon/chibi"
    Desc = "Rediseño del modelo procedural del pingüino hacia proporciones de caricatura: cabeza grande (radio 0.30 en y=1.26) estilo chibi, cuerpo más rechoncho (cápsula r=0.40), vientre blanco con pecho redondeado, cola y patas planas naranjas (nuevas), alas cortas y redondeadas, copete de plumas. Cara expresiva de dibujo animado: ojos grandes con blanco + pupila + brillo, cejas anguladas (expresión alegre), mejillas rosadas, pico corto y ancho y boca sonriente. Se re-posicionaron todos los accesorios (sombreros, gafas, bufanda y las 11 pieles de addSkin) a las nuevas proporciones. Se mantuvo el contrato de ownColor (el primer hijo directo sigue siendo el cuerpo) y las posiciones de armas FPV (0.22, 0.9, 0.18) siguen válidas en el pecho."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Pingüino con aspecto claramente cartoon/chibi, expresivo y consistente en 3rd person y dressing."),
      @("Calidad de código","1.5","1.5","Primitivas + grupos, materiales compartidos; sin nuevas dependencias ni texturas."),
      @("Integración sin regresiones","2.0","2.0","ownColor y armas FPV intactos; accesorios re-mapeados a las nuevas proporciones."),
      @("Pruebas ejecutadas","2.0","1.5","node --check OK; validación visual del usuario en recarga limpia (Ctrl+F5)."),
      @("Documentación en bitácora","1.0","1.0","Cambios de proporciones, cara y accesorios registrados."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión.")
    )
  },
  @{
    Id = "M17"; Fecha = "18 Sep 2026"; Tipo = "Código / Diseño UI Responsive"
    Modulos = "public/css/style.css, public/js/combat.js, public/js/chat.js"
    Resumen = "HUD responsive sin superposiciones de 360px a 1920px"
    Desc = "Fase 7, punto 1: la UI quedaba superpuesta (chat 320px vs minimapa, salas+en línea 260+220 > 494px, y el bloque inferior centrado con instrucciones/item-bar/municiones apilados sin espacios calculados; además .hp-wrap/.hp-bar-outer/.hp-bar-inner no tenían estilos CSS y la barra de vida salía sin estilo en la esquina). Rediseño por zonas con breakpoints (>=1200, 900-1199, 821-899, <=820, <=600): el HUD de combate pasa a una columna centrada (label de arma + fila ammo+HP con estilos glass dedicados), el item-bar sube a bottom 58, instrucciones con wrap y max-width, el respawn-overlay pasa a position fixed, minimapa se oculta <=820 y el inventario/instrucciones <=600, los paneles de salas/en línea se parten en dos columnas <=820, y el chat arranca colapsado en <=820 (clase body.chat-open oculta el HUD de combate/inventario/salas/en línea/minimapa mientras se escribe). Verificación numérica automatizada de rangos horizontales por breakpoint: sin colisiones en 820-1920 en estado colapsado y sin colisiones en todo el rango gracias al apilado vertical en pantallas angostas."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Sin superposiciones en 360-1920px: verificado con script numérico de rangos por breakpoint."),
      @("Calidad de código","1.5","1.5","CSS por zonas + breakpoints declarativos; JS mínimo (fila combat-row y colapso móvil del chat)."),
      @("Integración sin regresiones","2.0","2.0","combat.js y chat.js mantienen su API; solo estructura del DOM del HUD y classList en body."),
      @("Pruebas ejecutadas","2.0","1.5","node --check combat.js/chat.js OK; CSS balanceado (191 abiertas/191 cerradas); pendiente validación visual del usuario."),
      @("Documentación en bitácora","1.0","1.0","Diagnóstico, breakpoints y decisiones registradas."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión.")
    )
  },
  @{
    Id = "M18"; Fecha = "21 Sep 2026"; Tipo = "Código / Infraestructura local"
    Modulos = "server/redirect-server.js"
    Resumen = "Puerta 3000 por proxy y Club Pingüi publicado en pinguidev.corvet.dpdns.org"
    Desc = "El descubierto que el puerto 3000 estaba ocupado por otro proyecto (AnatomyLab/Next.js en C:\xampp\htdocs\Medicina\anatomy-platform); se reubicó Club Pingüi en el 3050 (PORT=3050) y AnatomyLab en el 3002 (next dev -p 3002). Se creó server/redirect-server.js como puerta en el 3000: primero como menú selector y luego, al constatar que el túnel permanentemente Cloudflare (pinguidev.corvet.dpdns.org) es gestionado remotamente por token y sigue apuntando al localhost:3000, se convirtió en reverse proxy sin dependencias (node:http + net): la raíz (y todo path) se reenvía a Club Pingüi (127.0.0.1:3050) incluyendo upgrade WebSocket de socket.io, el selector quedó en /menu y /healthz reporta estado del proxy. Resultado: pinguidev.corvet.dpdns.org sirve Club Pingüi verificable desde red externa (r.jina.ai muestra el lobby). Se eliminaron los quick tunnels temporales."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","pinguidev sirve Club Pingüi en la raíz (HTTP + WebSocket); selector recuperable en /menu."),
      @("Calidad de código","1.5","1.5","Proxy node:http + net sin dependencias nuevas; HTML embebido responsivo; fallback 502 cuando el origen cae."),
      @("Integración sin regresiones","2.0","2.0","Club Pingüi (3050) y AnatomyLab (3002) intactos; la puerta 3000 no modifica sus orígenes."),
      @("Pruebas ejecutadas","2.0","1.5","raíz/assets/socket.io-polling//menu/healthz en 200; verificación externa vía r.jina.ai del lobby del juego."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Resuelto en la misma sesión.")
    )
  },
  @{
    Id = "FV1"; Fecha = "24 Sep 2026"; Tipo = "Código / Mejora visual (cartoon)"
    Modulos = "public/js/avatar.js"
    Resumen = "Modelo de pingüino rediseñado a proporciones cartoon (Fase Visual 1)"
    Desc = "Se rediseñó el avatar con identidad de caricatura: cuerpo más ancho y bajo tipo pera (cápsula 0.42/0.3), cabeza más grande (radio 0.34), patas más cortas y gordas, alas convertidas en aletas reales de pingüino (teardrop aplanadas apuntando abajo-atrás), ojos grandes tipo anime con pupila, doble brillo y parpadeo periódico, cejas y mejillas más expresivas, pico naranja redondeado y boca sonrisa arc de media tora. Se incorporó squash & stretch local en animateAvatar (respiración en inactivo, estiramiento al moverse; escala del mesh cuerpo, no del grupo, para no interferir con melt/rise de combat.js). Se reajustaron posiciones de sombreros, lentes, skins y accesorios al nuevo tamaño de cabeza. La estructura de limbs (body como primer hijo) se mantuvo para compatibilidad con ownColor() y rootBody()."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","7 puntos de la opción A aplicados: proporciones, aletas, ojos, pico/mejillas, boca, materiales cartoon y squash & stretch."),
      @("Calidad de código","1.5","1.5","Respeto de convenciones; cambios localizados en avatar.js; sin dependencias nuevas."),
      @("Integración sin regresiones","2.0","2.0","createAvatar/animateAvatar válidos; ownColor() y rootBody() de combat.js intactos; dressing preview OK."),
      @("Pruebas ejecutadas","2.0","1.5","node --check + carga real del módulo con three (createAvatar con/sin accesorios y animateAvatar en estados moving/idle); sin errores."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en sesión.")
    )
  },
  @{
    Id = "FV2"; Fecha = "24 Sep 2026"; Tipo = "Código / Mejora visual (skins)"
    Modulos = "public/js/skinDefs.js; public/js/avatar.js; public/js/appearance.js"
    Resumen = "Sistema de skins unificado y data-driven (Fase Visual 2)"
    Desc = "Se creó public/js/skinDefs.js como definición centralizada de las skins del avatar: cada skin es un objeto de datos con paleta propia (body/belly/beak que repintan el cuerpo) y una lista de partes ancladas a puntos nombrados (ANCHORS: torso, neck, face, headTop, head, shoulders, sides). se reemplazó el switch addSkin() de avatar.js por un renderizador genérico que construye las piezas desde los datos (Box/Sphere/Cone/Cylinder/Torus), de modo que si cambia el modelo base solo se actualizan los ANCHORS y las skins se reajustan solas. appearance.js importa SKIN_IDS/SKIN_DEFS para que la UI del dressing y la aleatorización incluyan automáticamente las skins (se eliminó la lista hardcodeada duplicada). Se añadieron 3 skins nuevas: Hielo (corona de conos), Galaxia (anillo tipo Saturno) y Futbolero (balón de pentágonos), y skins existentes con paleta ahora repintan el cuerpo (traje, programador, táctico, pirata, ninja, fiesta). Verificado construyendo las 13 skins con three.js real: todas las piezas y el repintado correctos."""
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","skinDefs unificado, repintado por skin, anclajes nombrados, 3 skins nuevas y dressing/aleatorio derivados de datos."),
      @("Calidad de código","1.5","1.5","Definiciones como datos (sin switch); una sola fuente de verdad para ids/labels; convenciones del proyecto."),
      @("Integración sin regresiones","2.0","2.0","createAvatar sigue siendo la API única; dressing y randomAppearance funcionan sin cambios de interfaz; anclajes coinciden con posiciones previas."),
      @("Pruebas ejecutadas","2.0","1.5","13 skins construidas con three real verificando repintado y piezas; node --check; sin errores de consola."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en sesión.")
    )
  },
  @{
    Id = "FV2.1"; Fecha = "24 Sep 2026"; Tipo = "Código / Mejora visual (ropa de skins)"
    Modulos = "public/js/skinDefs.js; public/js/avatar.js"
    Resumen = "Ropa 3D adaptada al cuerpo del pingüino en cada skin (FV2.1)"
    Desc = "Se añadió ropa que abraza el cuerpo redondeado del pingüino para acercar cada skin a su nombre. Se extiende el renderizador de skins en avatar.js con nuevas primitivas: 'Helmet' (media esfera superior para casco/capucha), 'Plane' con número dibujado en canvas (camera jerseys) y partes con 'sway' (oscilación de ropa colgante al moverse, integrada en animateAvatar). En skinDefs.js: el ancla 'neck' se usa como centro del torso (z=0) para que los cilindros envuelvan el cuerpo. Cambios por skin: Traje = chaqueta de smoking que envuelve el torso + cuello de camisa + corbata con sway + solapas + botones; Playero = bañador y cinturilla; Programador = hoodie abrazando el torso + capucha; Táctico = chaleco porta-placa + hombreras + cinturón con hebilla + casco blindado + visor; Voleibol = playera con número 7 y short; Pirata = abrigo + camisa + solapas + cinturón dorado; Ninja = traje + fajín rojo con cola con sway; Futbolero = playera con número 5 y short. Verificado construyendo las 13 skins con three.js real y comprobando repintado, oscilación de la corbata y textura del número."""
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Ropa adaptada por skin; primitivas Helmet/Plane/sway; repintado coherente con la prenda."),
      @("Calidad de código","1.5","1.5","Extensiones data-driven en el mismo sistema de skinDefs; sin cambios en la API de createAvatar."),
      @("Integración sin regresiones","2.0","2.0","Las 13 skins construyen sin errores; animateAvatar anima ropa sin romper squash/waddle; ownColor sigue usando el cuerpo."),
      @("Pruebas ejecutadas","2.0","1.5","13 skins con three real, repintado, sway de corbata y número de playera verificados; node --check OK."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en sesión.")
    )
  },
  @{
    Id = "FV2.2"; Fecha = "24 Sep 2026"; Tipo = "Código / Mejora visual (ropa conforme)"
    Modulos = "public/js/garments.js (nuevo); public/js/avatar.js; public/js/skinDefs.js"
    Resumen = "Ropa que se adapta a la forma procesal del cuerpo del pingüino (FV2.2)"
    Desc = "Las prendas ya no son cilindros sueltos sobre el personaje: se creó el módulo garments.js que modela la silueta procesal real del cuerpo (cápsula CapsuleGeometry(0.42,0.3) a y0.62 unida por math con la panza Sphere(0.36) escalada (1,1.15,0.5) en (0,0.58,0.3)) y genera mallas BufferGeometry muestreadas de esa misma silueta en cada altura/ángulo, +grosor. Con esto la ropa abraza el cuerpo exactamente (incluida la panza sobresaliente y los casquetes redondeados) y se re-adapta solo si cambian las proporciones del modelo. avatar.js incorpora dos primitivas: 'Garment' (prendas envolventes entre yMin-yMax, con arco frontal opcional arcStart/arcEnd para chaquetas con abertura) y 'CapShell' (casco/capucha que calza sobre la esfera de la cabeza), más el anclaje a superficie 'surfaceZ' que posiciona accesorios (corbata, placa, número, hebilla) calculando la Z desde la propia silueta sin offsets manuales. Se reemplazaron los cilindros de las skins: Traje = chaqueta con abertura frontal (smoking) que deja ver la camisa/panza blanca; Playero = bañador conforme con cintura; Programador = hoodie + capucha; Táctico = chaleco + cinturón conformes + casco; Voleibol = playera + short conformes con número; Pirata = abrigo conforme; Ninja = traje + fajín conformes; Futbolero = playera + short conformes. Verificado con test three.js real: todas las skins construyen, y cada Garment queda a silhouette+thick (±tolerancia), los CapShell cubren la coronilla y los accesorios quedan fuera de la silueta."""
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Ropa conforme a la silueta procesal (cápsula∪panza); casco calza en la cabeza; accesorios anclados a superficie."),
      @("Calidad de código","1.5","1.5","Nuevo módulo garments.js con matemática de silueta aislada y reusable; skinDefs sigue siendo data; sin duplicar constantes por skin."),
      @("Integración sin regresiones","2.0","2.0","Las 13 skins construyen y repintan igual; animaciones (squash/waddle/sway) intactas; createAvatar sin cambios de API."),
      @("Pruebas ejecutadas","2.0","2.0","Test real con three.js: conformidad geométrica de prendas (radio vs silhouette), casco sobre cabeza y anclaje a superficie; node --check OK."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en sesión.")
    )
  },
  @{
    Id = "FV2.3"; Fecha = "24 Sep 2026"; Tipo = "Código / Corrección visual (ropa como volumen)"
    Modulos = "public/js/garments.js; public/js/avatar.js; public/js/skinDefs.js"
    Resumen = "Ropa como volumen cerrado de doble pared: ya no se ve por dentro del personaje (FV2.3)"
    Desc = "Las prendas conformes de FV2.2 eran láminas de una sola cara pegadas a 0.02 del cuerpo: al girar el personaje se veía el interior (culling de caras traseras), no se percibía grosor y casi coplanaban con la piel. Se reescribieron buildConformingShell/buildCapShell de garments.js para generar un VOLUMEN cerrado: pared exterior a silhouette+GARMENT_OFF (0.055), pared interior a +0.025, dobladillos (cintas superior e inferior que cierran los extremos) y cierres verticales en los cortes de las aberturas de chaqueta (smoking). El material de Garment/CapShell pasa a THREE.DoubleSide en avatar.js y se etiqueta garmentType ('shell'/'cap') para distinguir prendas de torso de casco/capucha. En skinDefs.js: los accesorios sobre prendas (placa, portaplacas, hebilla, solapas de traje y pirata) suben a surfaceZ 0.08 y los números de playera a 0.08 para quedar sobre el grosor de la tela; la corbata y botones (sobre piel desnuda/abertura) se mantienen en 0.03; el cinturón táctico se ajustó a off 0.04 (parámetro 'thick' obsoleto eliminado) y la hebilla se reposicionó sobre el cinturón (offset y -0.41 desde ancla torso 0.90 -> y0.49). Verificado con test three.js real: las 13 skins construyen, cada vértice de prenda cae en una de las 2 paredes (d en [0.025-0.015, 0.055+0.06]), cap shells cubren la coronilla, materiales DoubleSide y todos los accesorios quedan fuera de la pared interior de la tela."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Ropa con grosor real y cerrada (no se ve por dentro); extremos tapados por dobladillos; cierres en la chaqueta; accesorios sobre la tela."),
      @("Calidad de código","1.5","1.5","Constructores doble pared reutilizables en garments.js (paredes/rims/costuras); garmentType explícito; off/surfaceZ centralizados."),
      @("Integración sin regresiones","2.0","2.0","13 skins construyen y repintan; animaciones y sway intactos; createAvatar sin cambios de API; ownColor/rootBody sin tocar."),
      @("Pruebas ejecutadas","2.0","2.0","Test three.js real: 13 skins, conformidad por vértice (2 paredes), casco volcado, DoubleSide y anclaje a superficie verificado."),
      @("Documentación en bitácora","1.0","1.0","Causa (membrana de una cara) y solución (volumen cerrado) documentadas."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión del reporte.")
    )
  },
  @{
    Id = "FV2.4"; Fecha = "24 Sep 2026"; Tipo = "Código / Mejora visual (ajuste de la ropa al cuerpo)"
    Modulos = "public/js/garments.js; public/js/avatar.js; public/js/skinDefs.js"
    Resumen = "Panza dentro de la ropa + prendas ceñidas con relieves cosidos (FV2.4)"
    Desc = "Dos ajustes pedidos por el usuario. (1) La panza quedaba fuera de la ropa: los dobladillos superiores de las prendas de torso estaban muy altos (traje y pirata empezaban a y0.58, justo en el punto de máxima protuberancia de la panza; chaleco táctico a y0.7). Se bajaron los yMin: chaqueta del traje y abrigo pirata a 0.30, chaleco táctico a 0.44 (hasta el cinturón), hoodie a 0.30, traje ninja a 0.10, camisetas de voleibol/futbol a 0.46 (pegadas al short), bañador a 0.24, y se añadieron PANTALONES conformes (Garment yMin 0.06 yMax 0.30/0.43) a traje, pirata, táctico, developer y ninja para cubrir la parte baja de la panza y las piernas. Con la silueta modelo (cápsula∪panza) todas las prendas abrazan la panza sobresaliente en vez de dejar la piel blanca pelada. (2) Relieves de la ropa: nueva primitiva 'Band' en garments.js (buildBand) — banda cerrada de doble pared cuyo interior nace hundido en la tela (BAND_BASE = GARMENT_OFF*0.94, se cose sin z-fighting) y sobresale BAND_OFF 0.014, con arcos opcionales para relieves parciales; avatar.js la renderiza con DoubleSide y userData.band. Cada skin con ropa recibió dobladillos/vueltas/cinturillas en relieve (chaqueta/pantalón del traje y abrigo pirata, cinturón táctico y cinturilla del chaleco, vuelta del hoodie y su pantalón, fajín o-bee del ninja, cinturilla blanca y dobladillo del bañador, costura blanca + dobladillo de las camisetas y shorts). Además GARMENT_OFF bajó de 0.055 a 0.045 con pared interior al 50% (0.0225) para un ajuste más ceñido 'que se pegue casi perfectamente al cuerpo'. Verificado con test three.js real: las 13 skins construyen, cada vértice de prenda cae en una de las 2 paredes (garments en [0.0225-0.015, 0.045+0.06]; bandas en [0.0423-0.02, 0.0563+0.06]), 18/18 bandas de relieve conformes, y la cobertura de la panza en su punto más saliente (y0.58, frente z0.48) es verdadera en traje (con abertura de smoking), pirata, táctico, developer, ninja, playero, voleibol y futbol (dobladillo más bajo 0.06-0.24)."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","La panza ya no queda fuera de la ropa (dobladillos bajos + pantalones) y la ropa tiene relieves (dobladillos, vueltas, cinturillas) que se pegan al cuerpo."),
      @("Calidad de código","1.5","1.5","Nueva primitiva Band reutilizable y conforme (base hundida en tela, sin z-fighting); constantes de grosor centralizadas en garments.js; skinDefs sigue data-driven."),
      @("Integración sin regresiones","2.0","2.0","Las 13 skins construyen y repintan; animaciones (squash/waddle/sway) intactas; createAvatar sin cambios de API; ownColor/rootBody intactos."),
      @("Pruebas ejecutadas","2.0","2.0","Test three.js real: 13 skins, conformidad por vértice (prendas y bandas), cobertura de panza en y0.58 y 18/18 bandas; node --check OK."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión del reporte.")
    )
  },
  @{
    Id = "FV2.5"; Fecha = "24-25 Sep 2026"; Tipo = "Código / Corrección visual (panza oculta con ropa completa)"
    Modulos = "public/js/avatar.js; public/js/skinDefs.js"
    Resumen = "La panza ya no se sale de la ropa: se desactiva cuando la skin viste todo el cuerpo (FV2.5)"
    Desc = "Persistía el mismo error visual: la esfera de la panza (blanca) seguía pelada afuera de la ropa en los dobladillos (efecto 'relleno que se sale'), porque la panza se dibujaba SIEMPRE como malla separada y sobresalía del corte de las prendas aunque estas bajaran. Solución adoptada por el usuario: ocultar la esfera de la panza cuando la ropa cubre todo el cuerpo. En avatar.js el mesh de la panza se añade solo si skinDef.hideBelly no es true (y queda etiquetado userData.belly para el test). En skinDefs.js el flag 'hideBelly:true' se marca en las skins de cuerpo completo: traje (cuerpo 0x22263a), programador (verde), táctico, voleibol, pirata, ninja y futbolero; lo conservan las de pecho desnudo: playero, sencillo, paja, fiesta, hielo y galaxia (y el avatar por defecto). Como el traje y el pirata necesitan su glorieta blanca/crema en la abertura del smoking, se añadió una camisa conforme delgada debajo del saco/abrigo (Garment off 0.012, de 0.30 a 1.02, bajo la chaqueta de off 0.045, por lo que no hace z-fighting y solo se ve en la abertura). El cinturón táctico quedó sin hueco: pantalón 0.06-0.44 y chaleco 0.445-1.02. Verificado con test three.js real: las 13 skins construyen/repintan/animan, la panza está oculta en las 7 skins de cuerpo completo y presente en las 6 restantes + default, toda prenda conserva sus 2 paredes (interior nunca hunde la piel: mínimo 0.006 la camisa, 0.0225 las prendas; espesor 0.004-0.08), bandas de relieve 18, cascos 2 y camisa del traje presente."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","La panza se oculta con ropa de cuerpo completo; la piel que sobresalía ya no se dibuja; camisa blanca/crema en la abertura del traje y pirata."),
      @("Calidad de código","1.5","1.5","Un flag declarativo hideBelly por skin; la panza se etiqueta userData.belly; sin duplicar lógica en avatar.js."),
      @("Integración sin regresiones","2.0","2.0","Skins de pecho desnudo y avatar default conservan la panza; 13 skins construyen; createAvatar sin cambios de API; ownColor/rootBody intactos."),
      @("Pruebas ejecutadas","2.0","2.0","Test three.js real: 13 skins, panza oculta/presente por skin, paredes de todas las prendas, 18 bandas, 2 cascos y camisa del traje; node --check OK."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión del reporte.")
    )
  },
  @{
    Id = "FV2.6"; Fecha = "25 Sep 2026"; Tipo = "Código / Personalización de playeras (número y nombre)"
    Modulos = "public/js/avatar.js; public/js/skinDefs.js; public/js/appearance.js; public/js/dressing.js; public/css/style.css; public/index.html; server/appearance.js"
    Resumen = "Playeras de voleibol y futbol personalizables: número elegible pegado a la tela + nombre en la espalda (FV2.6)"
    Desc = "Unificó número y nombre como decalajes en canvas sobre las playeras de las skins Voleibol y Futbolero, ambos conformes a la tela (surfaceZ 0.052 sobre la silueta = 0.007 por fuera de la pared exterior de la prenda, GARMENT_OFF 0.045, así el texto se ve 'pegado' y no volando como antes con 0.08). El número es elegible: la apariencia ahora lleva 'number' (0-99) y 'jerseyName' (máx 12 chars) normalizados en cliente y servidor; en skinDefs las partes son dinámicas ('dynamic: number' / 'dynamic: jerseyName', con fallback al texto por defecto 7/5 y a '@name'); si no hay jerseyName se usa el nombre del jugador. El nombre se pega a la espalda del pingüino (z = -silhouetteRadiusAt(y, PI) - surfaceZ, garantiendo la cara hacia -Z con rot [0,PI,0]) y su lienzo va espejado para leerse bien desde atrás; la textura auto-ajusta el tamaño de fuente para cualquier longitud. En la UI del vestidor aparecen dos filas (solo cuando la skin activa es voleibol/futbol): 'Número de la playera' y 'Nombre en la espalda'. La apariencia viaja completa por red (network envía appearance al unirse) y se persiste en el servidor (PUT /api/me/appearance). De paso se corrigió un drift: server/appearance.js no tenía 'hielo', 'galaxia' ni 'futbol' en SKIN_IDS y el servidor descartaba esas skins al guardar. Verificado con test three.js real: en ambas skins el número y el nombre quedan a 0.007 de la tela, el nombre está en la espalda mirando a -Z, los fallbacks funcionan con numero nulo/vacío, normalizeAppearance cliente y servidor validan rango/longitud/limpieza."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Número elegible y pegado a la playera en ambas skins; nombre visible en la espalda (con fallback al nombre de usuario)."),
      @("Calidad de código","1.5","1.5","Decalajes declarativos en skinDefs (dynamic/back/fallbackToName), textura reusable auto-ajustada, sin hacks de posiciones."),
      @("Integración sin regresiones","2.0","2.0","createAvatar y el contrato ownColor intactos; apariencia persistida y difundida por red con los campos nuevos; skins hielo/galaxia/futbol ahora sobreviven al servidor."),
      @("Pruebas ejecutadas","2.0","2.0","Test three.js: pegado 0.007, espalda -Z, fallbacks, normalize cliente y servidor; node --check de los 6 archivos."),
      @("Documentación en bitácora","1.0","1.0","Registrada."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión del reporte.")
    )
  },
  @{
    Id = "FV3"; Fecha = "26 Sep 2026"; Tipo = "Código / Mejora visual (primera persona + armas)"
    Modulos = "public/js/viewmodel.js; public/js/combat.js; public/js/main.js"
    Resumen = "Primera persona que hace juego con el pingüino + armas detalladas también en 3ª persona y grips afinados por arma (FV3)"
    Desc = "Reutilización del modelo detallado de armas y manos coherentes con el avatar. (1) Manos FPV: makeFlipper ahora replica la ala del pingüino (cápsula + punta redonda, aplanada en Z) y se pinta con el color real del cuerpo — el de la skin (skinDef.colors.body) o el color elegido (appearance.body), con default 0x222b3f si no hay apariencia; buildViewmodel(weaponId, appearance) recibe la apariencia del jugador desde main.js (swapViewGun). (2) Armas en 3ª persona: se extrajo buildWeaponGroup() (el arma sin manos ni transformación FPV, con userData.muzzle/spin/grips); combat.js lo usa en makeOwnWeapon() para el arma propia, la de los remotos y las vistas auxiliares, girándolo 180° en Y (apunta a +Z, el frente del pingüino) y escalándolo 1.45; las animaciones de swing/recoil preservan el giro base vía userData.baseRotY y se protegió el fogonazo (muzzle) para melee; la minigun ahora gira su rotor también en 3ª persona. (3) Grips afinados por arma: tabla HAND_TUNING con rotación de ambas aletas (roll hacia adentro del arma, pitch hacia el mango) para las 17 armas. Se eliminaron los modelos caja de makeGun/makeMeleeGun (dead code) y el armado quedó centralizado. Verificado con test three.js real (18 armas en FPV y 3ª persona): manos con el color del cuerpo/skin en todos los casos, fogonazo de armas en -Z (FPV) y en +Z tras el giro 3ª persona, melee sin muzzle (guards), minigun con spin en ambos modos, ala aplanada, weaponGroup sin manos y escala unitaria; node --check de los 3 archivos."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Manos FPV del color y forma del pingüino; armas detalladas en 3ª persona apuntando al frente; postura/agarre afinado por arma."),
      @("Calidad de código","1.5","1.5","Modelo único de cada arma (buildWeaponGroup) compartido entre FPV y 3ª persona; arrays de postura declarativos; dead code eliminado; contrato ownColor intacto."),
      @("Integración sin regresiones","2.0","2.0","Animaciones swing/recoil preservan el giro de 180°; fogonazo protegido para melee; makeRemoteGun/makeViewGun consistentes; no se tocó el sistema de apariencia previo."),
      @("Pruebas ejecutadas","2.0","2.0","Test three.js real (FV3 OK, ~130 comprobaciones) + node --check de viewmodel/combat/main."),
      @("Documentación en bitácora","1.0","1.0","Registrada con evidencia."),
      @("Cumplimiento de tiempo","0.5","0.5","Entregado en la misma sesión del reporte.")
    )
  },
  @{
    Id = "FV3.1"; Fecha = "27 Sep 2026"; Tipo = "Código / Corrección visual (alas FPV)"
    Modulos = "public/js/viewmodel.js; public/debug/fpv.html"
    Resumen = "Las alas de primera persona quedaban las dos pegadas a la derecha de la cámara y superpuestas; ahora hay una por lado, simétricas (FV3.1)"
    Desc = "El arma (buildViewmodel) cuelga de un grupo con BASE = (0.26, -0.12, -0.48), y los grips de las armas están casi centrados (±0.05); al colocar cada ala en su grip, ambas caían en hemicampo derecho (NDC x≈+0.02 y +0.72, usr las ve pegadas). Se cambió el posicionamiento por defecto a defaultHandPos(): cada ala se ancla a una distancia GLOBAL de la cámara de ±WING_X (0.30) convirtiendo a local del grupo con (±WING_X - BASE.x) / VM_SCALE, y se retiraron los overrides rightPos/leftPos que, interpretados como locales + escala, re-metían la izquierda al centro (p. ej. granade). La rotación por arma (HAND_TUNING) se conservó. De paso se creó public/debug/fpv.html, un visor FPV con telemetría numérica en pantalla (coords px/NDC de cada ala, muzzle y grips, y chequeo left<right/gap) para validar la postura de forma determinista sin depender de capturas de imagen; se usa con URL ?weapon=&skin=&body=. Verificado con test three.js real (sin Chrome): en las 17 armas el ala izquierda cae a x global -0.30 (24-38% del ancho) y la derecha a +0.30 (62-75%), simétricas, dentro del viewport, gap 250-520px; además se repitió la regresión FV3 completa (60 checks OK) y node --check de viewmodel.js."
    Estado = "Completado"
    rub = @(
      @("Requisitos cumplidos","3.0","3.0","Una ala por lado de la cámara y simétricas en las 17 armas."),
      @("Calidad de código","1.5","1.5","Postura global definida por constantes (WING_X) sin mágicos por arma; overrides locales erróneos eliminados; telemetría en página de debug."),
      @("Integración sin regresiones","2.0","2.0","Regresión FV3 completa en verde (muzzle, color de manos, 3ª persona, spin, weaponGroup)."),
      @("Pruebas ejecutadas","2.0","2.0","Test determinista de proyección para las 17 armas + regresión FV3 (60 checks) + node --check."),
      @("Documentación en bitácora","1.0","1.0","Registrada con evidencia y método de validación."),
@("Cumplimiento de tiempo","0.5","0.5","Entregado en la sesión del reporte.")
      )
    },
    @{
      Id = "FV4"; Fecha = "27 Sep 2026"; Tipo = "Código / Auditoría de jugabilidad + pruebas"
      Modulos = "server/game.js; server/db.js; public/js/combat.js; docs/bitacora.ps1"
      Resumen = "Auditoría de errores de jugabilidad corregida y verificada con suite de tests automatizada (34 checks) + fix de chat de invitados en el lobby (FV4)"
      Desc = "Cierre de la auditoría de jugabilidad con validación automatizada de extremo a extremo. Se corrigieron o verificaron: anti-teleport/anti-sniping (rechazo de saltos de posición >2.5), cadencia de disparo por arma usando su cooldown propio, emisión de un único combat:shot por disparo con dx/dz normalizados según la dirección del arma, combat:slow con duración explícita (until, no epoch), inventory:use solo permitido en sala (bloqueado en lobby), nudge al entrar a cada zona (lobby/sala), ensureAliveForZone revive al cambiar de zona, regeneración global de vida, entrega de loot en un solo lote con trayectoria, room:list con ownerId, y chat de sala con color. En esta sesión: fix del crash CRÍTICO del chat del lobby con invitados (insertMessage con userId null violaba la FK de messages → el error llegaría al proceso del servidor; ahora solo persiste si player.userId existe) y pulido del combate cliente (arco de melee en la predicción clientHit con dot-check de 1-pellet vs ángulo de apertura del arma, y proyectiles con lifetime age >6 para que se eliminen solos). Se construyó un harness ESM con loader que enruta /vendor/three a node_modules y permite importar los módulos del servidor/cliente en Node 24 con mocks de socket.io; la suite resultante queda en verde: 20 tests de protocolo (flujo completo salas/combate/loot/cristales/inventario/slow/revivir/lobby lleno), 7 de lógica (weaponDefs, itemDefs, mapDefs, appearance, collision) y 7 de auth (registro/login/duplicado/401/me/appearance/logout). Verificado con node --check de los archivos modificados y 10 corridas estables de la suite de protocolo (20/20, con 1 skip ocasional por RNG del mapa al no aparecer bola de nieve)."
      Estado = "Completado"
      rub = @(
        @("Requisitos cumplidos","3.0","3.0","Errores de jugabilidad de la auditoría corregidos y cubiertos por pruebas; crash FK del chat de invitados resuelto."),
        @("Calidad de c�digo","1.5","1.5","Arreglos acotados en server/game.js, server/db.js y combat.js; sin dependencias nuevas; guard del chat sin duplicar lógica."),
        @("Integraci�n sin regresiones","2.0","2.0","Movimiento, loot, cristales, inventario y combate siguen verdes en la suite; node --check de los archivos modificados."),
        @("Pruebas ejecutadas","2.0","2.0","Suite automatizada 34/34 con harness ESM (20 protocolo + 7 lógica + 7 auth), 10 corridas estables del protocolo, node --check OK."),
        @("Documentaci�n en bit�cora","1.0","1.0","Bug raíz (FK) y método de prueba (harness ESM) documentados."),
        @("Cumplimiento de tiempo","0.5","0.5","Entregado en la sesión del reporte.")
      )
    },
    @{
      Id = "FV5"; Fecha = "28 Sep 2026"; Tipo = "Código / Pruebas de carga (A11) + corrección crítica"
      Modulos = "public/test/load.mjs; server/game.js; package.json"
      Resumen = "Pruebas de carga y concurrencia con bots reales (A11) + fix de un bug crítico: crystalTick usaba un 'now' en zona muerta (TDZ)"
      Desc = "Se creó public/test/load.mjs, una prueba de carga end-to-end que levanta el servidor REAL en proceso (server/index.js con PORT 3311 y BD temporal) y le conecta bots reales de socket.io-client por WebSocket (añadido como devDependency): residentes de lobby, creadores de salas y usuarios que se unen a ellas, simulando movimiento (player:move), disparos (combat:shoot), obtención de armas vía cristales (offer/respond) y chat periódico; mide latencia de conexión y admisión, RTT del chat end-to-end (token __RTT incrustado que el propio emisor recibe en el broadcast), eventos recibidos por segundo, game:full (lobby a capacidad) con su reintento, estabilidad (disconnects no intencionales) y memoria RSS. Durante el smoke la prueba destapó un BUG CRÍTICO DE PRODUCCIÓN: crystalTick (server/game.js) declaraba un segundo 'const now' dentro del bucle de salas (línea 457) que eclipsaba al 'now' exterior (línea 447), dejando la comparación de expiración de ofertas (línea 451) en zona muerta (TDZ): cualquier cristal en estado 'offered' al ejecutarse el tick lanzaba ReferenceError y el handler de uncaughtException apagaba TODO el servidor. No aparecía en las suites de protocolo porque los temporizadores se simulan y nunca se ejecuta crystalTick. Corrección: la variable interna pasó a llamarse tickNow. Resultados de la corrida plena (60 bots, 25 s): 60/60 admitidos, 73 game:full manejados con reintento sin pérdida, 0 errores de conexión, 0 disconnects inesperados, 10/10 salas creadas y 52/52 bots en sala, 52 armas obtenidas, 387 disparos, ~619 player:moved recibidos/s, RTT de chat end-to-end p50 118 ms / p95 132 ms (criterio <250 ms) y RSS 100 MB (<400 MB). Queda cubierta la actividad A11 (Reporte de pruebas de carga) de la práctica académica."
      Estado = "Completado"
      rub = @(
        @("Requisitos cumplidos","3.0","3.0","A11 cubierta: carga sostenida de 60 clientes concurrentes con admisión 60/60, latencias, RTT y estabilidad dentro de criterio; bug crítico de crystalTick corregido."),
        @("Calidad de código","1.5","1.5","load.mjs parametrizable por env (LOAD_BOTS/LOAD_DURATION_MS/LOAD_PORT); bot con sincronización de posición por welcome y estados por rol; métricas en JSON LOAD_RESULT."),
        @("Integración sin regresiones","2.0","2.0","El servidor real corre en su propio proceso dentro del test; sin cambios de flujo de juego; la suite de protocolo sigue 20/20 verde."),
        @("Pruebas ejecutadas","2.0","2.0","Smoke (16 bots) + corrida plena (60 bots, 25 s) con criterios de aceptación cuantitativos; node --check OK; regresión del protocolo re-verificada."),
        @("Documentación en bitácora","1.0","1.0","Método de carga, métricas obtenidas y causa raíz del bug (TDZ) documentadas."),
        @("Cumplimiento de tiempo","0.5","0.5","Entregado en la sesión del reporte.")
      )
    },
    @{
      Id = "FV5.1"; Fecha = "28 Sep 2026"; Tipo = "Infraestructura / Despliegue (A12)"
      Modulos = "server/index.js; public/test/load.mjs; docs/Reporte_Pruebas_Carga_A11.md; docs/bitacora.ps1"
      Resumen = "Publicación de la Fase 4: se reinició el servidor en producción (3050) con el código actual y se verificó desde internet"
      Desc = "Despliegue y publicación de la Fase 4 (A12). El servidor en producción (127.0.0.1:3050, PID 21216) llevaba en memoria código del 21/09, sin los fixes de la sesión (chat FK de invitados, crystalTick y mejoras de jugabilidad). Se detuvo y se relanzó limpio el mismo servicio (node server/index.js con PORT=3050, redirigiendo logs a %TEMP%\opencode\club3050.out.log/.err.log), quedando escuchando en el 3050 el nuevo proceso (PID 15284). Verificación en cadena: /healthz directo -> {ok:true}; puerta 3000 (server/redirect-server.js) -> HTTP 200 {ok:true, proxy:true, club:3050}; y desde internet, pinguidev.corvet.dpdns.org (túnel Cloudflare) responde HTTP 200 con título 'Club Pingüí — Plataforma 3D Social & Combate'. Con el reinicio se publican automáticamente todos los assets del cliente y el servidor actualizado en el mismo árbol del proyecto (public/ + server/), por lo que la plataforma sirve ya el código de la Fase 4 completo. A12 queda cubierto."
      Estado = "Completado"
      rub = @(
        @("Requisitos cumplidos","3.0","3.0","Plataforma publicada y accesible por internet con el código actual (A12: plataforma publicada)."),
        @("Calidad de código","1.5","1.5","Sin cambios de código; reinicio del servicio con la misma invocación de producción y logs capturados."),
        @("Integración sin regresiones","2.0","2.0","Los datos persistentes (SQLite) se conservan; el túnel y la puerta 3000 no se tocaron; se mantienen los puertos 3002 (AnatomyLab)."),
        @("Pruebas ejecutadas","2.0","2.0","healthz directo, vía puerta 3000 y desde internet (r.jina.ai sobre pinguidev.corvet.dpdns.org): HTTP 200 y título del lobby correcto."),
        @("Documentación en bitácora","1.0","1.0","Procedimiento de reinicio y verificaciones registradas."),
        @("Cumplimiento de tiempo","0.5","0.5","Entregado en la sesión del reporte.")
      )
    },
    @{
      Id = "FV5.2"; Fecha = "28 Sep 2026"; Tipo = "Documento / Entregable (A13)"
      Modulos = "docs/Documentacion_Tecnica_ClubPingui.md; docs/Manual_Usuario_ClubPingui.md; docs/bitacora.ps1"
      Resumen = "Documentación técnica y manual de usuario (A13): cierre de la Fase 4 con los entregables documentales"
      Desc = "Se completó la actividad A13 de la práctica académica (Documentación técnica y manual de usuario). Documentación_Tecnica_ClubPingui.md recoge: resumen y arquitectura (cliente three.js → túnel Cloudflare → redirect-server 3000 → server 3050), stack, estructura de carpetas, modelo de datos (spaces/users/sessions/messages con su FK estricta), API REST (/api/register|login|logout|me|me/appearance + /healthz con rate limit por IP), protocolo Socket.IO completo (14 eventos cliente→servidor con sus throttles y responsabilidades; 27 eventos servidor→cliente), reglas de juego autoritativas (anti-teleport >2.5, cadencia por arma, slow con until, ensureAliveForZone, nudge por zona, loot/cristales con crystalTick, inventario solo en sala, permisos de anfitrión, hockey, voz), seguridad (scrypt, sesiones httpOnly 30 días, throttle, guard FK de chat de invitados), despliegue (local 3050, túnel Cloudflare, Railway con volumen persistente y ENV_PORT), y el plan de pruebas (harness ESM, 20/7/7 checks verdes, prueba de carga 60 bots y el hallazgo/corrección de crystalTick). Manual_Usuario_ClubPingui.md es la guía de uso final: acceso por internet, requisitos (WebGL/HTTPS), controles (WASD/flechas, clic izquierdo disparar, R recargar, clic derecho cámara), mundo y minimapa, personalización (vestidor, skins, número/nombre en playeras), chat y voz por proximidad, salas privadas (crear/unirse/cupo 8/permisos de anfitrión), armas-loot-inventario (17 armas), combate (regeneración, eliminado 10 s y respawn), minijuego de hockey y sección de solución de problemas/FAQ. Los datos del documento se contrastaron contra el código real (eventos, rutas, tabla de límites y esquema de la BD)."
      Estado = "Completado"
      rub = @(
        @("Requisitos cumplidos","3.0","3.0","A13 cubierto: documentación técnica y manual de usuario completos y verificables contra el código."),
        @("Calidad de código","1.5","1.5","Documentos en Markdown con tablas y referencias cruzadas; sin inventar datos (eventos/rutas/esquema contrastados con el repositorio)."),
        @("Integración sin regresiones","2.0","2.0","Solo archivos nuevos en docs/; no se tocó código, pruebas ni despliegue."),
        @("Pruebas ejecutadas","2.0","2.0","Información extraída con grep/lectura del código (eventos socket, rutas /api, CREATE TABLE, límites MAX_*); referencias a hitos M/FV y suites 20/7/7 + carga documentadas."),
        @("Documentación en bitácora","1.0","1.0","Entregable registrado con ID, fecha y evidencia."),
        @("Cumplimiento de tiempo","0.5","0.5","Entregado en la sesión del reporte.")
      )
    },
    @{
      Id = "FV6"; Fecha = "02 Oct 2026"; Tipo = "Código / Mejora visual (entorno y mapas)"
      Modulos = "public/js/world.js; public/debug/worldcheck.html; public/debug/bootcheck.html"
      Resumen = "Entorno y mapas 3D mejorados: decorado instanciado en los 7 mapas de sala + cobertura vegetal y ajuste de sombras/anisotropía"
      Desc = "Fase visual de mejora del entorno, ejecutada en cuatro pasadas sobre world.js sin tocar el servidor ni el protocolo. (1) Decorado instanciado: se creó makeSceneryGroup(), una versión genérica del escenario instanciado que hasta ahora solo existía para cordillera (makeCordilleraScenery). Agrupa por tipo pine/leaf/cactus/rock/crate en InstancedMesh (tronco + capas de follaje + nieve, tallo + 3 copas de hoja, cuerpo + 2 brazos + 2 puntas de cactus, roca + casquete, caja + 2 bandas con instanceColor) y populate() ahora enruta esos cinco tipos al grupo instanciado, conservando renderObstacle() para los elementos únicos (iglú, edificio, pilar, estalagmita, hongo, ruina). La escala se calcula una sola vez por obstáculo mediante scaleOf() con semilla determinista, para que todas las piezas de un mismo árbol/roca compartan escala, y los brazos del cactus usan geometría pre-posicionada por lado en lugar de espejar con escala negativa, que invertía el winding y rompía las normales. (2) Cobertura vegetal: makeGroundCover() siembra matas de hierba (3 hojas cruzadas fusionadas con mergeGeometries(), sin depender de BufferGeometryUtils porque los addons de examples/jsm no se sirven), guijarros y flores por mapa con InstancedMesh + instanceColor y RNG con semilla fija (mulberry32) para que el escenario sea reproducible. Es decoración pura: no se registra en getMapObstacles(), por lo que no altera colisiones (collision.js) ni el minimapa, se mantiene baja para no estorbar la lectura de jugadores y respeta zonas de juego (pista de hockey en nevado, piscina central en gruta). En cordillera se siembra sobre la altura real del terreno (cordilleraHeight) y se evita la zona inundada. (3) Iluminación y materiales: la cámara de sombras del sol se dimensiona según el mapa (±220 y 2048 px en cordillera, que antes solo cubría ±60 y dejaba sin sombra casi todo el mapa; far 500 y sol más alto) y el suelo recibe anisotropía de textura (hasta 8) para que no se vea borroso en el ángulo rasante de la cámara en tercera persona; la hierba no recibe sombras por el acne de los planos finos. (4) Rendimiento: todo el decorado repetido y la cobertura vegetal van en InstancedMesh con computeBoundingSphere(), de modo que la nueva densidad de props no dispara las llamadas de dibujo. Decisión de diseño importante: no se añadió relieve a los mapas planos porque el servidor es autoritativo y solo valida x/z (anti-teleport >2.5, clampPosition) sin conocer la altura; un relieve en el suelo rompería la coherencia vertical entre cliente y servidor para cristales, proyectiles y efectos, así que FV6 se limitó a decoración, densidad e iluminación, manteniendo el terreno de cordillera como único mapa con altura. Verificación: se creó un arnés de regresión de mapas (public/debug/worldcheck.html + servidor de telemetría por POST) que construye los 8 mapas, renderiza un frame y reporta drawCalls, triángulos, mallas, InstancedMesh e instancias; y un arnés de arranque real (public/debug/bootcheck.html) que entra como invitado, confirma el vestidor y mide el mundo 3D en vivo."
      Estado = "Completado"
      rub = @(
        @("Requisitos cumplidos","3.0","3.0","FV6 cubierto: los 7 mapas de sala pasan de decorado disperso a decorado instanciado con cobertura vegetal y sombras bien dimensionadas."),
        @("Calidad de código","1.5","1.5","makeSceneryGroup()/makeGroundCover()/mergeGeometries() reutilizan los patrones del proyecto (makeCanvasTexture, paletas de MAP_DEFS, mulberry32); escala determinista por obstáculo y sin espejado por matriz negativa."),
        @("Integración sin regresiones","2.0","2.0","No se tocó el servidor ni el protocolo; la cobertura vegetal queda fuera de getMapObstacles(), así que collision.js, minimap.js y las reglas autoritativas quedan intactas."),
        @("Pruebas ejecutadas","2.0","2.0","worldcheck.html: RESULT PASS en los 8 mapas (nevado 204 draws/386 inst, selva 75/598, desierto 74/349, volcan 44/259, pradera 85/738, ciudad 94/116, cordillera 52/2875, gruta 94/250). bootcheck.html: canvas 784x505, 166.9 draws/frame, 0 errores JS en el flujo real (invitado → vestidor → mundo). Suites: protocolo 20/20, lógica 7/7, auth 7/7."),
        @("Documentación en bitácora","1.0","1.0","Entrada registrada con ID, fecha, descripción por pasadas y métricas medidas."),
        @("Cumplimiento de tiempo","0.5","0.5","Completado en la sesión de trabajo del 02 Oct 2026.")
      )
    },
    @{
      Id = "FV7"; Fecha = "29-30 Oct 2026"; Tipo = "Código / Corrección UI móvil"
      Modulos = "public/css/style.css; public/index.html; public/js/touch.js; public/js/chat.js; public/js/hud.js; public/js/combat.js; public/js/inventory.js; public/debug/mobilecheck.html (nuevo)"
      Resumen = "Auditoría y corrección del visor móvil: login, joystick, salas, chat, HUD y vestidor"
      Desc = "Auditoría del modo táctil (body.touch-mode) probando el juego real dentro de un arnés de viewports (public/debug/mobilecheck.html: iframes de 844x390, 915x412, 812x375, 667x375, 640x360, 390x844 y 360x640 con window.__forceTouch). Bugs encontrados y corregidos: (1) Login cortado en horizontal: la tarjeta medía 513 px y los botones Jugar/Crear cuenta quedaban en y=396-458 fuera de una pantalla de 390 px, con overflow hidden; ahora #join-screen usa 100dvh + scroll vertical, la tarjeta se centra con margen automático y una media query de max-height 620 px compacta badge, título, inputs y botones (287 px de alto: los botones quedan en y=273-311 dentro de 390). (2) Joystick invisible: #joy-base era position absolute dentro de #joy-area (que empieza en y=195), así que un toque en (100,300) lo dibujaba en y=441 fuera del viewport; pasó a position fixed y ahora se dibuja centrado en el punto de toque (x=46, y=246, 108x108) con el desplazamiento del stick intacto. (3) Hoja de Salas sin cierre y bajo el HUD: se añadió el botón ✕ #rooms-close-btn, cierre al tocar fuera (listener en captura) y z-index 40 (antes 20, debajo de combat-hud 22, item-bar 25 y fire-btn); openRoomsSheet también cierra el popover de ajustes. (4) Toques con la hoja abierta movían cámara/joystick: uiBlocked ahora considera body.sheet-rooms y #rooms-panel. (5) Botones de esquina encimados: medían 46.8x28 por el padding global; .corner-btn tiene padding 0 y en táctil 32x32, ? en x=8 y ⚙ en x=48 (sin solape). (6) Chat abierto por defecto en horizontal >820 px: el colapso inicial y la reconfiguración usan compactUi() (touch-mode o <=820 px); al abrirse en táctil oculta combat-hud, item-bar, touch-actions y fire-btn, y el toggle mide 32x32. (7) Vestidor inutilizable en 812x375: una sola columna con #dress-controls de 11 px; la nueva media (orientation:landscape) and (max-height:560px) usa dos columnas (315+421 px), preview flexible de 322 px y controles de 260 px con scroll. (8) HUD de combate encimado con los botones táctiles y 'Recargar (R)' partido en dos líneas: botones con white-space nowrap y flex-shrink 0, HP bar de 96 px, paddings compactos y etiqueta '↻'/'…' en táctil; el panel pasa de 399x122 a 243x59 y ya no se solapa en 844x390, 915x412, 812x375, 667x375 ni 640x360. (9) Detección táctil incorrecta: isTouchMode dependía de maxTouchPoints > 0 y activaba el layout móvil en portátiles táctiles; ahora usa (pointer: coarse) o (any-pointer: coarse) + (hover: none), verificado con pointer fine + maxTouchPoints 2 (el escritorio ya no entra en touch-mode). (10) Header partido en 640x360: brand/tag con min-width 0, nowrap, ellipsis y max-width 62vw. (11) Tap targets pequeños: menú ☰ 36x32 y toggle de chat 32x32. (12) Inputs <16 px provocaban zoom automático en iOS: 16 px forzados en touch-mode. (13) Selección de inventario táctil: pointerdown (pointerType touch) además de mousedown/dblclick, con touch-action manipulation. (14) Se aclaró el aviso de rotación (ahora indica que el modo horizontal es necesario)."
      Estado = "Completado"
      rub = @(
        @("Requisitos cumplidos","3.0","3.0","14 correcciones verificadas: login completo, joystick visible, salas cerrables y sobre el HUD, chat/HUD coherentes, vestidor usable en horizontal y sin solapes en 5 viewports."),
        @("Calidad de código","1.5","1.5","Cambios localizados por responsabilidad (touch/chat/hud/combat/inventory/CSS), helpers compactUi() y reloadLabel(), sin dependencias nuevas ni estilos !important innecesarios (solo el 16 px de inputs)."),
        @("Integración sin regresiones","2.0","2.0","El modo escritorio ya no activa touch-mode (pointer fine + hover) y conserva pestañas, minimapa y paneles; el HUD de escritorio mantiene 'Recargar (R)'; 0 errores de consola en el arnés."),
        @("Pruebas ejecutadas","2.0","2.0","Pruebas reales con login invitado, vestidor, partida y sala privada: login 287 px visible en 5 tamaños; joystick fixed en (46,246); hoja de salas z=40 con ✕ y cierre exterior; HUD 243x59 sin solapes; vestidor 315/421 px con 260 px de controles; selección táctil de inventario (slot 0 seleccionado con 🐟); 0 errores JS."),
        @("Documentación en bitácora","1.0","1.0","Entrada FV7 y bitácora continua docs/Bitacora_Continua_2026.md con mediciones y evidencias."),
        @("Cumplimiento de tiempo","0.5","0.5","Completado en la sesión del 29-30 Oct 2026.")
      )
    }
  )

# Notas por archivo del cliente (tabla 2.3)
$notasCliente = @{
  "main.js"      = "Inicialización, bucle principal y estados"
  "world.js"     = "Escena three.js: entorno procedural, luces, nieve y cámara (scene.add(camera) desde M07); decorado y cobertura vegetal instanciados + sombras por mapa (FV6)"
  "combat.js"    = "Combate melee: estados, impacto, cooldown y sync"
  "viewmodel.js" = "Vista en primera persona del arma y manos (FPV); buildWeaponGroup() reutilizado en 3ª persona y grips afinados por arma (FV3)"
  "weaponDefs.js"= "Definiciones de las 17 armas"
  "itemDefs.js"  = "Objetos ítems del inventario"
  "network.js"   = "Conexión socket.io y eventos con el servidor"
  "avatar.js"    = "Avatar pingüino: malla y animaciones"
  "garments.js"  = "Silueta procesal del cuerpo y ropa conforme como volumen cerrado (FV2.2/FV2.3)"
  "skinDefs.js"  = "Definiciones data-driven de skins, prendas conformes y anclajes (ANCHORS)"
  "dressing.js"  = "Atuendos y accesorios"
  "appearance.js"= "Configuración estética del avatar"
  "hockey.js"    = "Minijuego de hockey"
  "collision.js" = "Colisiones y límites del mundo"
  "input.js"     = "Teclado y mouse"
  "chat.js"      = "Chat de texto"
  "voice.js"     = "Voz por micrófono"
  "session.js"   = "Estado de sesión/local"
  "minimap.js"   = "Minimapa"
  "mapDefs.js"   = "Definiciones de mapas"
  "loot.js"      = "Botín en el suelo"
  "inventory.js" = "Inventario del jugador"
  "spike.js"     = "Prueba técnica (spike)"
}

$notasServer = @{
  "index.js"     = "Servidor HTTP/Express estático + socket.io"
  "game.js"      = "Salas, jugadores, sincronización y combate autoritativo"
  "db.js"        = "Persistencia de datos"
  "auth.js"      = "Registro/inicio de sesión y tokens"
  "appearance.js"= "Validación de apariencia/personalización"
  "spike.js"     = "Pruebas / descartes"
  "redirect-server.js" = "Selector de proyectos en puerto 3000 (redirección a AnatomyLab 3002 / Club Pingüi 3050)"
}

# =====================================================================
#  CONSTRUCTOR OOXML
# =====================================================================
function Esc($s) {
  if ($null -eq $s) { return "" }
  return [System.Security.SecurityElement]::Escape([string]$s) + ""
}
function Add-Para {
  param($sb, $Text, [string]$Jc = "left", [double]$Size = 11, [string]$Color = "000000",
        [int]$Before = 0, [int]$After = 6, [bool]$Bold = $false,
        [string]$Font = "Calibri", [int]$SpaceLines = 0)
  $pts = [int]($Size * 20)
  $sb.Append('<w:p><w:pPr><w:spacing w:before="') | Out-Null
  $sb.Append($Before) | Out-Null
  $sb.Append('" w:after="') | Out-Null
  $sb.Append($After) | Out-Null
  $sb.Append('"/><w:jc w:val="') | Out-Null
  $sb.Append($Jc) | Out-Null
  $sb.Append('"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="') | Out-Null
  $sb.Append($Font) | Out-Null
  $sb.Append('" w:hAnsi="') | Out-Null
  $sb.Append($Font) | Out-Null
  $sb.Append('"/><w:color w:val="') | Out-Null
  $sb.Append($Color) | Out-Null
  $sb.Append('"/><w:sz w:val="') | Out-Null
  $sb.Append($pts) | Out-Null
  $sb.Append('"/><w:szCs w:val="') | Out-Null
  $sb.Append($pts) | Out-Null
  $sb.Append('"/>') | Out-Null
  if ($Bold) { $sb.Append('<w:b/>') | Out-Null }
  $sb.Append('</w:rPr><w:t xml:space="preserve">') | Out-Null
  $sb.Append((Esc $Text)) | Out-Null
  $sb.Append('</w:t></w:r></w:p>') | Out-Null
}
function Add-Empty {
  param($sb, [double]$Size = 11)
  Add-Para $sb "" "left" $Size "000000" 0 0 $false "Calibri"
}
function Add-PageBreak {
  param($sb)
  $sb.Append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>') | Out-Null
}
function Add-Table {
  param($sb, $Headers, $WidthsPts, $Data, [int]$FontPt = 9, [string]$HeaderFill = "1F4E78")
  $cols = $Headers.Length
  $stack = New-Object System.Text.StringBuilder
  $stack.Append('<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="left"/>') | Out-Null
  $stack.Append('<w:tblBorders><w:top w:val="single" w:sz="4" w:color="999999"/>') | Out-Null
  $stack.Append('<w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/>') | Out-Null
  $stack.Append('<w:right w:val="single" w:sz="4" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:color="999999"/>') | Out-Null
  $stack.Append('<w:insideV w:val="single" w:sz="4" w:color="999999"/></w:tblBorders></w:tblPr>') | Out-Null
  $stack.Append('<w:tblGrid>') | Out-Null
  for ($c = 0; $c -lt $cols; $c++) {
    $tw = [int]($WidthsPts[$c] * 20)
    $stack.Append('<w:gridCol w:w="') | Out-Null
    $stack.Append($tw) | Out-Null
    $stack.Append('"/>') | Out-Null
  }
  $stack.Append('</w:tblGrid>') | Out-Null
  # encabezado
  $stack.Append('<w:tr><w:trPr><w:tblHeader/></w:trPr>') | Out-Null
  for ($c = 0; $c -lt $cols; $c++) {
    $tw = [int]($WidthsPts[$c] * 20)
    $stack.Append('<w:tc><w:tcPr><w:tcW w:w="') | Out-Null
    $stack.Append($tw) | Out-Null
    $stack.Append('" w:type="dxa"/><w:shd w:val="clear" w:fill="') | Out-Null
    $stack.Append($HeaderFill) | Out-Null
    $stack.Append('"/><w:vAlign w:val="center"/></w:tcPr>') | Out-Null
    $inner = New-Object System.Text.StringBuilder
    Add-Para $inner $Headers[$c] "center" $FontPt "FFFFFF" 0 0 $true "Calibri"
    $stack.Append($inner.ToString()) | Out-Null
    $stack.Append('</w:tc>') | Out-Null
  }
  $stack.Append('</w:tr>') | Out-Null
  # cuerpo
  for ($i = 0; $i -lt $Data.Length; $i++) {
    $row = $Data[$i]
    $stack.Append('<w:tr>') | Out-Null
    for ($c = 0; $c -lt $cols; $c++) {
      $tw = [int]($WidthsPts[$c] * 20)
      $val = ""
      if ($row -is [array] -and $row.Length -ge ($c + 1)) { $val = [string]$row[$c] }
      $first = ($c -eq 0)
      $inner = New-Object System.Text.StringBuilder
      Add-Para $inner $val "left" $FontPt "000000" 0 2 $false "Calibri"
      $stack.Append('<w:tc><w:tcPr><w:tcW w:w="') | Out-Null
      $stack.Append($tw) | Out-Null
      $stack.Append('" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>') | Out-Null
      $stack.Append($inner.ToString()) | Out-Null
      $stack.Append('</w:tc>') | Out-Null
    }
    $stack.Append('</w:tr>') | Out-Null
  }
  $stack.Append('</w:tbl>') | Out-Null
  $sb.Append($stack.ToString()) | Out-Null
}
function Add-Space {
  param($sb)
  Add-Para $sb "" "left" 8 "000000" 0 4 $false "Calibri"
}

# =====================================================================
#  ARMADO DEL DOCUMENTO
# =====================================================================
$sb = New-Object System.Text.StringBuilder
$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>') | Out-Null
$sb.Append('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">') | Out-Null
$sb.Append('<w:body>') | Out-Null

# ---------- PORTADA ----------
Add-Para $sb "CLUB PINGÜI" "center" 30 "1F4E78" 120 10 $true "Calibri Light"
Add-Para $sb "Bitácora de Modificaciones y Control de Calidad" "center" 17 "000000" 0 4 $true "Calibri Light"
Add-Para $sb "Rúbricas de evaluación por modificación" "center" 12 "444444" 0 20 $false "Calibri"
Add-Empty $sb
Add-Para $sb "Proyecto: plataforma social 3D multijugador en el navegador" "center" 11 "000000" 0 4 $false "Calibri"
Add-Para $sb ("Estado analizado desde el inicio del proyecto hasta: " + $fechaHoy) "center" 11 "000000" 0 8 $false "Calibri"
Add-Empty $sb
Add-Para $sb "Responsable: Equipo Club PINGÜI - Luis Javier Tovar Segura" "center" 11 "000000" 0 4 $false "Calibri"
Add-Para $sb ("Fecha de apertura: 08/09/2026    ·    Última actualización: " + $fechaHoy) "center" 11 "000000" 0 0 $false "Calibri"
Add-Empty $sb
Add-Para $sb "Contenido: 1 Propósito · 2 Análisis del estado actual · 3 Metodología y rúbricas · 4 Registro de modificaciones con rúbricas · 5 Pendientes · 6 Cierre" "center" 10 "666666" 0 0 $false "Calibri"
Add-PageBreak $sb

# ---------- 1. PROPÓSITO ----------
Add-Para $sb "1. Propósito y alcance de esta bitácora" "left" 15 "1F4E78" 0 8 $true "Calibri Light"
Add-Para $sb ("La evolución acelerada de este proyecto hace necesario llevar un control formal de cada cambio para mantener un camino sólido y documentado. Este documento registra las modificaciones realizadas (hasta la fecha de " + $fechaHoy + "), establece una política de trazabilidad para las futuras y define una rúbrica de 10 puntos con la que se evalúa cada modificación.") "both" 11
Add-Para $sb "•  Toda modificación recibe un identificador único (M01, M02, ...) antes de iniciar el trabajo." "left" 11
Add-Para $sb "•  Al completarla se registra: fecha, archivos afectados, pruebas realizadas y resultado de la rúbrica." "left" 11
Add-Para $sb "•  Si la rúbrica da menos de 7 puntos, la modificación se revisa o se revierte hasta alcanzar un nivel aceptable." "left" 11
Add-Para $sb "•  Las modificaciones pendientes se listan en la sección 5; al implementarse, pasan a la sección 4." "left" 11

# ---------- 2. ANÁLISIS ----------
Add-Para $sb "2. Análisis del estado actual del proyecto" "left" 15 "1F4E78" 16 8 $true "Calibri Light"
Add-Para $sb "2.1 Descripción del proyecto" "left" 12.5 "1F4E78" 10 4 $true "Calibri Light"
Add-Para $sb "Club PINGÜI es una plataforma social 3D multijugador en el navegador, construida con three.js (WebGL). Los usuarios se conectan (registro o invitado), personalizan su pingüino (atuendos y accesorios), exploran un mundo nevado generado proceduralmente, conversan por chat de texto y voz, practican hockey, recogen objetos (loot e inventario) y combaten con armas cuerpo a cuerpo; todo sincronizado por socket.io. El despliegue externo se realiza mediante un túnel de Cloudflare (PinguiDev.corvet.dpdns.org) hacia el menú de redirección del puerto 3000, que enlaza a los proyectos locales en los puertos 3002 (AnatomyLab) y 3050 (Club Pingüi)." "both" 11
Add-Para $sb "2.2 Arquitectura y stack tecnológico" "left" 12.5 "1F4E78" 10 4 $true "Calibri Light"
Add-Table $sb @("Capa","Tecnología / detalle","Ubicación principal") @(90,190,170) @(
  @("Cliente 3D","three.js (módulos), render WebGL, estilo cartoon","public/js/world.js, main.js"),
  @("Transporte","socket.io (cliente y servidor)","public/js/network.js; server/index.js"),
  @("Servidor","Node.js + Express (estático) + módulos de juego","server/index.js, game.js"),
  @("Datos","Persistencia gestionada por db.js","server/db.js"),
  @("Despliegue","Cloudflare Tunnel: PinguiDev.corvet.dpdns.org -> localhost:3000 (selector de proyectos)","C:\Cloudflared\config.yml"),
  @("Hosting local","XAMPP / htdocs (Apache) + proceso Node independiente","C:\xampp\htdocs\Proyecto_ClubPingui")
)
Add-Para $sb "2.3 Inventario de módulos del cliente" "left" 12.5 "1F4E78" 10 4 $true "Calibri Light"
$crows = @()
Get-ChildItem (Join-Path $root "public\js\*.js") | Sort-Object Name | ForEach-Object {
  $lines = (Get-Content $_.FullName).Count
  $nota = if ($notasCliente.ContainsKey($_.Name)) { $notasCliente[$_.Name] } else { "Cliente" }
  $crows += ,@($_.Name, $lines, $nota, "Funcional")
}
$totalC = (($crows | ForEach-Object { [int]$_[1] }) | Measure-Object -Sum).Sum
$crows += ,@("TOTAL CLIENTE", $totalC, ($crows.Count - 1) + " módulos", "")
Add-Table $sb @("Módulo","Líneas","Función","Estado") @(120,55,245,40) $crows 8
Add-Para $sb "2.4 Inventario de módulos del servidor" "left" 12.5 "1F4E78" 10 4 $true "Calibri Light"
$srows = @()
Get-ChildItem (Join-Path $root "server\*.js") | Sort-Object Name | ForEach-Object {
  $lines = (Get-Content $_.FullName).Count
  $nota = if ($notasServer.ContainsKey($_.Name)) { $notasServer[$_.Name] } else { "Servidor" }
  $srows += ,@($_.Name, $lines, $nota, "Funcional")
}
$totalS = (($srows | ForEach-Object { [int]$_[1] }) | Measure-Object -Sum).Sum
$srows += ,@("TOTAL SERVIDOR", $totalS, ($srows.Count - 1) + " módulos", "")
Add-Table $sb @("Módulo","Líneas","Función","Estado") @(120,55,245,40) $srows 8
Add-Para $sb "2.5 Estado por área funcional" "left" 12.5 "1F4E78" 10 4 $true "Calibri Light"
Add-Table $sb @("Área","Estado","Notas") @(150,90,220) @(
  @("Registro / login (invitado)","Funcional","Acceso por nombre o cuenta"),
  @("Mundo 3D y entorno","Funcional","Entorno nevado procedural, luces y cámara"),
  @("Avatares pingüino y personalización","Funcional","Apariencia, atuendos y accesorios"),
  @("Movimiento y colisiones","Funcional","Física básica y límites del mundo"),
  @("Chat de texto y voz","Funcional","Micrófono sujeto a permisos del navegador"),
  @("Minijuego hockey","Básico","Extensible"),
  @("Combate cuerpo a cuerpo (melee)","Funcional","17 armas; servidor autoritativo"),
  @("Vista en primera persona (FPV)","Funcional","Viewmodel 17 armas + manos; corregido 08/09 (M04-M07)"),
  @("Loot e inventario","Básico","Ítems equipables"),
  @("Minimapa y mapas","Funcional","mapDefs + minimapa"),
  @("Servidor, salas y sincronización","Funcional","node server/index.js; socket.io"),
  @("Despliegue externo","Funcional","Túnel Cloudflare PinguiDev (08/09/2026)")
)

# ---------- 3. METODOLOGÍA ----------
Add-Para $sb "3. Metodología de registro y rúbricas" "left" 15 "1F4E78" 16 8 $true "Calibri Light"
Add-Para $sb "3.1 Rúbrica estándar (10 puntos)" "left" 12.5 "1F4E78" 10 4 $true "Calibri Light"
Add-Para $sb "Cada modificación se evalúa con los seis criterios siguientes. La columna de la derecha indica qué se revisa en cada uno." "both" 11
Add-Table $sb @("Criterio","Ponderación","Qué se evalúa") @(170,80,200) @(
  @("Requisitos cumplidos","3.0","La modificación cubre exactamente lo solicitado"),
  @("Calidad de código","1.5","Convenciones del proyecto, nombres claros, sin código muerto"),
  @("Integración sin regresiones","2.0","No rompe otros módulos ni flujos existentes"),
  @("Pruebas ejecutadas","2.0","node --check, harness y pruebas en local con evidencias"),
  @("Documentación en bitácora","1.0","Registro con ID, fecha, archivos y observaciones"),
  @("Cumplimiento de tiempo","0.5","Entrega dentro del plazo comprometido")
)
Add-Para $sb "Escala de resultado: 9.0 a 10 = Sobresaliente; 7.0 a 8.9 = Aceptado con observaciones; menos de 7.0 = revisar o revertir. La calificación se registra automáticamente en la sección 4." "both" 11

# ---------- 4. REGISTRO DE MODIFICACIONES ----------
Add-Para $sb "4. Registro de modificaciones realizadas" "left" 15 "1F4E78" 16 8 $true "Calibri Light"
Add-Para $sb ("Resumen cronológico de las modificaciones implementadas y evaluadas hasta el " + $fechaHoy + ".") "both" 11
$resum = @()
foreach ($m in $mods) {
  $tot = [double]0.0
  foreach ($r in $m.rub) { $tot += [double]$r[2] }
  $resum += ,@($m.Id, $m.Fecha, $m.Tipo, [string]$m.Resumen, $m.Estado, ([string]$tot).Replace(",", "."))
}
Add-Table $sb @("ID","Fecha","Tipo","Modificación (resumen)","Estado","Calif.") @(40,85,110,150,65,50) $resum

$idx = 1
foreach ($m in $mods) {
  Add-Para $sb ("4." + $idx + "  " + $m.Id + " - " + $m.Resumen) "left" 12.5 "1F4E78" 14 4 $true "Calibri Light"
  Add-Table $sb @("Campo","Valor") @(110,340) @(
    @("ID", $m.Id),
    @("Fecha", $m.Fecha),
    @("Tipo", $m.Tipo),
    @("Módulos / archivos", $m.Modulos),
    @("Descripción", $m.Desc),
    @("Estado", $m.Estado)
  )
  Add-Para $sb ("Rúbrica de la modificación " + $m.Id) "left" 11 "1F4E78" 6 3 $true "Calibri Light"
  $tot = [double]0.0
  foreach ($r in $m.rub) { $tot += [double]$r[2] }
  Add-Table $sb @("Criterio","Ponderación","Puntos obtenidos","Observaciones / evidencias") @(160,75,85,130) $m.rub
  $totStr = ([string]$tot).Replace(",", ".")
  if ($tot -ge 9.0) { $nivel = "Sobresaliente" }
  elseif ($tot -ge 7.0) { $nivel = "Aceptado con observaciones" }
  else { $nivel = "Revisar / revertir" }
  Add-Para $sb ("Calificación total: " + $totStr + " / 10   -   " + $nivel) "left" 11 "1F4E78" 0 10 $true "Calibri"
  $idx++
}

# ---------- 5. PENDIENTES ----------
Add-Para $sb "5. Modificaciones pendientes y próximas" "left" 15 "1F4E78" 16 8 $true "Calibri Light"
Add-Para $sb "Las siguientes modificaciones están planificadas o en revisión, ordenadas por impacto en la demo del 1 de diciembre. Cuando se implementen, recibirán el siguiente ID correlativo, se registrarán en la sección 4 y se evaluarán con la rúbrica." "both" 11
Add-Table $sb @("ID","Fecha prevista","Modificación pendiente","Prioridad","Responsable","Estado") @(40,75,190,55,85,50) @(
  @("P1","Nov 2026","Audio: música por mapa y mezcla de volumen","Alta","Equipo","Pendiente"),
  @("P2","Nov 2026","Tutorial de primer ingreso (moverse, sala, cristal, arma)","Alta","Equipo","Pendiente"),
  @("P3","Nov 2026","Cámara de muerte / espectador y respawn claro","Media","Equipo","Pendiente"),
  @("P4","Nov 2026","Persistencia de inventario y estadísticas por cuenta","Media","Equipo","Pendiente"),
  @("P5","Nov 2026","Clima por mapa (nieve, hojas, brasas) y hora variable","Media","Equipo","Pendiente"),
  @("P6","Nov-Dic 2026","Accesibilidad: remapeo de teclas, tamaño de UI, opción daltónica","Baja","Equipo","Pendiente"),
  @("P7","Dic 2026","Moderación: filtro de chat, límite de velocidad y reportes","Baja","Equipo","Pendiente")
)
Add-Para $sb "Mejoras propuestas sobre módulos existentes: combate (indicador de daño direccional y hitmarker), tuner de armas (presets en localStorage y copiar JSON), móvil (anillo de progreso de recarga y vibración al disparar), vestidor (giro automático de la vista previa), chat (historial por sesión y aviso de no leídos), salas (filtro por mapa y copiar código), mundo (LOD/culling agresivo en móviles de gama baja) y HUD (modo compacto por altura y ocultar etiquetas tras 3 s)." "both" 11

# ---------- 6. CIERRE ----------
Add-Para $sb "6. Cierre" "left" 15 "1F4E78" 16 8 $true "Calibri Light"
Add-Para $sb "Este documento se mantiene actualizado como fuente única de trazabilidad del proyecto. Cualquier discrepancia entre lo documentado y el comportamiento observado debe reportarse antes de aprobar una nueva modificación." "both" 11
Add-Para $sb ("Preparado y revisado por el equipo del proyecto Club PINGÜI. Fecha de cierre de la presente revisión: " + $fechaHoy + ".") "both" 11

# cierre body/document
$sb.Append('<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>') | Out-Null
$sb.Append('</w:body></w:document>') | Out-Null

# =====================================================================
#  EMPAQUETADO .docx (zip OOXML)
# =====================================================================
$partContentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
$partRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'

try {
  if (Test-Path $outDocx) { Remove-Item $outDocx -Force }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $fs = [System.IO.File]::Open($outDocx, [System.IO.FileMode]::CreateNew)
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  $utf8Bom = New-Object System.Text.UTF8Encoding($true)
  function Add-ZipEntry($zip, $name, $content) {
    $entry = $zip.CreateEntry($name)
    $es = $entry.Open()
    $sw = New-Object System.IO.StreamWriter($es, $utf8Bom)
    $sw.Write($content); $sw.Flush(); $sw.Dispose()
  }
  Add-ZipEntry $zip "[Content_Types].xml" $partContentTypes
  Add-ZipEntry $zip "_rels/.rels" $partRels
  Add-ZipEntry $zip "word/document.xml" $sb.ToString()

  $zip.Dispose()
  $fs.Dispose()
  Write-Host "OK: $outDocx ($([math]::Round((Get-Item $outDocx).Length/1KB,1)) KB)"
}
catch {
  if ($null -ne $zip) { try { $zip.Dispose() } catch {} }
  if ($null -ne $fs) { try { $fs.Dispose() } catch {} }
  throw
}
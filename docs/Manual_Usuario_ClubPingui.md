# Manual de Usuario — Club Pingüi

**Plataforma web 3D de interacción social y combate** · Pingüinos personalizables, salas privadas, chat, voz y combate melee.
**Versión:** Fase 4 · **Fecha:** 28/09/2026

---

## 1. Cómo entrar

1. Abre en el navegador la dirección pública: **`https://pinguidev.corvet.dpdns.org`**
   (o `http://localhost:3000` si juegas desde la misma máquina del servidor).
2. Escribe un **nombre** (se puede jugar como invitado).
3. También puedes **crear una cuenta** o **iniciar sesión** con tus datos; así conservas tu
   personalización y posición entre sesiones.

**Requisitos del dispositivo:**
- Navegador moderno con WebGL (Chrome, Edge, Firefox) y **HTTPS** para poder usar el
  micrófono (voz).
- Cualquier PC/portátil/celular con navegador actualizado.

---

## 2. Controles

| Acción | Teclado / Mouse |
|--------|-----------------|
| Moverse | `W A S D` o teclas de dirección ↑ ↓ ← → |
| Girar cámara | Mover el mouse (clic derecho para cámara libre) |
| Disparar / atacar | **Clic izquierdo** |
| Recargar | `R` |
| Chatear | Clic en el chat y escribir (`Enter` para enviar) |
| Recolectar cristales / armas | Acércate; cuando estés pegado al cristal se ofrece la acción de recoger |

---

## 3. Mundo y mapa

- Llegas al **lobby nevado** donde están los demás jugadores en línea.
- Te mueves libremente: los límites del mundo respetan el terreno y hay colisiones.
- El **minimapa** te muestra tu posición y la zona (oculto en pantallas angostas).
- Pestañas ocultas pausan el render para ahorrar recursos; al volver se reanuda.

---

## 4. Personalización del pingüino

- Al entrar puedes abrir el **vestidor** (botón "👕 Vestidor", dentro del juego) y elegir:
  - **Cuerpo, panza, pico, sombrero, bufanda, lentes** y colores.
  - **Skins / trajes**: traje, playero, programador, sencillo, táctico, voleibol, sombrero
    de paja, pirata, ninja, fiesta, hielo, galaxia y futbolero.
  - Si eliges las playeras de **voleibol o futbol**, puedes poner un **número** (0–99) y un
    **nombre** en la espalda.
  - Botón **"Aleatorio"** para combinar al azar.
- Todo se guarda con tu cuenta (y se sincroniza entre sesiones).

---

## 5. Chat y voz

- **Chat de texto:** mensajes generales en el lobby; dentro de una sala, el chat es de la sala.
- **Voz (proximidad):** activa el micrófono (el navegador pedirá permiso). Al hablar, te
  escuchan los pingüinos **cerca de ti**; al alejarte te oyen menos. Requiere HTTPS.

---

## 6. Salas privadas

- **Crear sala:** usa el panel de salas → nombre + mapa (tundra, playa o arena). Serás el
  **anfitrión** y obtienes un **código** para compartir.
- **Unirse:** pega el código de otra sala y entra (máximo 8 jugadores por sala).
- **Permisos del anfitrión:** puede **expulsar** jugadores y **cerrar** la sala (todos vuelven al lobby).
- Al llegar a la sala se te **recoloca** automáticamente en la zona.

---

## 7. Armas, loot e inventario

- Por los mapas hay **cristales** con ítems: armas, comida y objetos lanzables.
- Acércate a un cristal: se ofrece el contenido; **acepta** para equiparlo o guardarlo.
- **Inventario:** consulta tus objetos; usa comida para recuperar vida o lanza objetos (solo en sala).
- **17 armas** disponibles (espada, hacha, daga, maza, lanza, escudo, arco, minigun, etc.),
  cada una con su propia cadencia, daño y alcance.

---

## 8. Combate

- El **servidor arbitra** todo: dónde estabas, cuánto daño recibes y cuándo mueres (nada de ventajas por lag).
- Cada arma tiene **cooldown propio**; al disparar se escucha/ve el efecto.
- Tu **barra de vida** se regenera con el tiempo; al perder toda la vida entras en
  **estado de eliminado (10 s)**, te ves derretido/colapsado sobre el suelo y luego
  **reapareces** en la zona.
- Los proyectiles y el daño se sincronizan; los ataques cuerpo a cuerpo (melee) usan un arco de impacto.

---

## 9. Minijuego de hockey

- En la zona de hockey puedes participar en el minijuego; verás el estado del partido y los
  **goles** registrados (`hockey:state` / `hockey:goal`).

---

## 10. Solución de problemas

| Problema | Solución |
|----------|----------|
| Pantalla negra / mundo no carga | Verifica que tu navegador soporta WebGL; recarga con **Ctrl+F5**. |
| No se oye mi voz | El micrófono requiere **HTTPS** (usa la URL pública, no `http` plano) y que permitas el permiso de micrófono. |
| La app no responde | Cierra y vuelve a abrir la pestaña; el estado de salas es efímero (los datos de cuenta son persistentes). |
| El chat "se queda pegándose" | El chat se colapsa en pantallas angostas mientras escribes; minimízalo y abre el HUD de combate. |
| No me deja entrar a una sala | Revisa el código y que la sala tenga cupo (máx 8). |
| No aparece mi skin guardada | Vuelve a guardar en el vestidor; debe conservarse con la cuenta. |

---

## 11. Referencia rápida de comandos del juego

| Necesito... | Hago... |
|-------------|---------|
| Crear sala | Panel de salas → "Crear" → nombre y mapa → compartir el código |
| Unirme | Panel de salas → pegar código → "Unirme" |
| Equipar arma | Acercarme al cristal de arma y aceptar la oferta |
| Recuperar vida | Comer comida del inventario (solo en sala) |
| Cambiarme de skin | Vestidor → seleccionar skin → guardar |
| Celebrar un gol | ¡Suma goles en el minijuego de hockey! |
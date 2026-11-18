# Blender vía `blender-mcp` (backend opcional para los 3 dominios)

`blender-mcp` es un servidor MCP (Model Context Protocol) que conecta Blender con un agente de IA a través de OpenCode, permitiendo modelado, esculpido, rigging avanzado y generación de escenas por lenguaje natural, con ejecución real de Python dentro de Blender.

Úsalo cuando el código procedural de Three.js no baste: geometría orgánica (rostros de personajes, esculpido de detalle), generación de terreno con geometry nodes/simulación, retopología, o render de referencia antes de portar el resultado al navegador.

## Instalación (una sola vez por máquina)

1. Instalar `uv`:
   ```bash
   # macOS
   brew install uv
   # Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # Windows
   powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
2. Registrar el servidor en la configuración de OpenCode del proyecto (`opencode.json` o el archivo de config MCP que use el proyecto):
   ```json
   {
     "mcp": {
       "blender-mcp": {
         "type": "local",
         "command": ["uvx", "blender-mcp"],
         "enabled": true,
         "environment": {
           "BLENDER_HOST": "localhost",
           "BLENDER_PORT": "9876"
         }
       }
     }
   }
   ```
3. Instalar el addon dentro de Blender:
   ```bash
   uvx blender-mcp install-addon
   ```
   Luego en Blender: `Edit → Preferences → Add-ons → activar "Interface: Blender MCP"`.
4. En el viewport de Blender: presionar `N` → pestaña `BlenderMCP` → `Start MCP Server`.

## Qué puede hacer una vez conectado

- Crear, modificar y borrar objetos 3D por instrucción en lenguaje natural.
- Aplicar y modificar materiales.
- Inspeccionar la escena actual (útil para que la IA entienda qué ya existe antes de modificarlo).
- Ejecutar código Python arbitrario dentro de Blender (para operaciones que no tienen un comando directo).
- Descargar HDRIs/texturas/modelos vía Poly Haven, y buscar/importar modelos desde Sketchfab.
- Generar modelos 3D con IA (Hyper3D Rodin, Hunyuan3D) — útil para variar rápido props genéricos (rocas, vegetación) sin modelarlos a mano uno por uno.

## Flujo recomendado dentro de esta skill

1. Describir en lenguaje natural lo que se necesita construir en Blender (ej. "esculpe la cabeza del personaje pingüino guardia con esta silueta de referencia").
2. Revisar el resultado (captura de viewport) antes de continuar.
3. Ajustar iterativamente — nunca dar por bueno el primer resultado sin revisión.
4. **Exportar siempre a glTF/GLB** al terminar, para que el asset entre limpio al pipeline de Three.js del proyecto (ver checklist de calidad de cada dominio).

## Nota

Solo debe correr una instancia del servidor MCP de Blender a la vez. Si el proyecto ya tiene otro cliente (Claude Desktop, Cursor) conectado al mismo servidor, ciérralo antes de usarlo desde OpenCode para evitar conflictos de conexión.

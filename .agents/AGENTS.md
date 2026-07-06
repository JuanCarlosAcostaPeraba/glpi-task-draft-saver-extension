# Reglas del Proyecto para Agentes de IA (AGENTS.md)

Este archivo contiene reglas y directrices específicas del espacio de trabajo para agentes autónomos y asistentes de IA.

## Uso Obligatorio de `codebase-memory-mcp`

Este proyecto utiliza `codebase-memory-mcp` para mantener un grafo de conocimiento de la estructura y llamadas del código.

### Prioridad de Herramientas para Descubrimiento de Código

1. `search_graph`: Buscar funciones, clases, rutas o variables por patrón.
2. `trace_path`: Rastrear qué funciones llaman a un símbolo o cuáles son llamadas por él.
3. `get_code_snippet`: Leer el código fuente de funciones o clases específicas.
4. `query_graph`: Ejecutar consultas complejas en Cypher si es necesario.
5. `get_architecture`: Obtener resúmenes arquitectónicos de alto nivel del proyecto.

*Nota: Solo se debe recurrir a `grep`, `glob` o búsquedas de texto plano para literales de cadena específicos, mensajes de error, configuraciones o archivos no analizados por el compilador.*

---

## Directrices de Desarrollo y Arquitectura

1. **Sin Pasos de Compilación (Vanilla JS/CSS)**:
   - Todo el código en `extension/` debe permanecer escrito en Javascript vanilla estándar de navegadores modernos.
   - No añadir cargadores de módulos, Webpack, Vite, Babel o dependencias NPM complejas para la extensión salvo que el usuario lo solicite expresamente.

2. **Entornos de Ejecución (MAIN vs ISOLATED)**:
   - [content.js](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/content.js): Se ejecuta en el mundo `MAIN` para poder acceder de forma directa al objeto global `window.tinymce` y manipular los editores de texto enriquecido de GLPI.
   - [bridge.js](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/bridge.js): Se ejecuta en el mundo `ISOLATED` para tener acceso a las APIs seguras de la extensión (`chrome.storage.sync` y `chrome.storage.onChanged`).
   - **Sincronización**: `bridge.js` lee la configuración de almacenamiento y la escribe como atributos en la etiqueta `<html>` (`data-glpi-draft-saver-pos`, `data-glpi-draft-saver-theme`). `content.js` y `style.css` leen estos atributos del DOM para reaccionar al cambio de tema y posición en tiempo real.

3. **Ciclo de Vida de TinyMCE en GLPI**:
   - Los editores de tareas, seguimientos, soluciones y validaciones se renderizan dinámicamente.
   - Usar siempre polling ([content.js:112-175](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/content.js#L112-L175)) para esperar que `window.tinymce` y el editor correspondiente estén cargados e inicializados antes de interactuar con ellos.
   - Al restaurar un borrador, se debe retrasar la escritura en TinyMCE (`setContent`) al menos **300ms** ([content.js:344-362](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/content.js#L344-L362)) después de forzar la visibilidad del bloque mediante click, para permitir que se inicialicen los plugins internos de TinyMCE (como el redimensionador).

4. **Persistencia e Interfaz**:
   - Claves de `localStorage`: `glpi_draft_<type>_ticket_<id>`.
   - Copia de Respaldo: Al hacer clic en "Restaurar", el texto HTML del borrador se copia automáticamente al portapapeles (`navigator.clipboard.writeText`) como medida de contingencia antes de inyectarlo en TinyMCE.

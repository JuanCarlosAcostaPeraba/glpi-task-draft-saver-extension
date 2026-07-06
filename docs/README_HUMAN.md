# Guía de Documentación para Desarrolladores Humanos (`docs/README_HUMAN.md`)

Esta guía está diseñada para que cualquier desarrollador o técnico pueda descargar el repositorio, entender cómo funciona el proyecto y empezar a trabajar en él sin necesidad de asistentes de inteligencia artificial.

---

## 1. Descripción del Proyecto

**GLPI Draft Saver Pro** es una extensión de navegador profesional diseñada para evitar la pérdida de información en la plataforma de tickets GLPI. Guarda borradores automáticamente en tiempo real para:
- **Seguimientos** (Follow-ups)
- **Tareas** (Tasks)
- **Soluciones** (Solutions)
- **Validaciones** (Validations)

Los borradores se almacenan localmente en el navegador (`localStorage`) de manera privada y segura.

---

## 2. Estructura del Repositorio

El proyecto tiene una estructura simple sin herramientas complejas de compilación:

- **`extension/`**: Carpeta que contiene el código fuente de la extensión.
  - [manifest.json](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/manifest.json): Configuración de la extensión Chrome (permisos, scripts de contenido, etc.).
  - [content.js](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/content.js): Script de contenido principal que se inyecta en la web de GLPI para gestionar el autoguardado.
  - [bridge.js](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/bridge.js): Script puente que sincroniza la configuración de almacenamiento seguro con el DOM.
  - [style.css](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/style.css): Estilos visuales de los toasts con efecto de desenfoque y diseño moderno.
  - [popup.html](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/popup.html) y [popup.js](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/popup.js): Panel de configuración de la extensión (Tema Oscuro, posición de los toasts).
  - **`icons/`**: Contiene los iconos de la extensión en tamaños de 16, 48 y 128 píxeles.
- **`docs/`**: Carpeta de documentación del proyecto.
- [generate_icons.ps1](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/generate_icons.ps1): Script de PowerShell para redimensionar automáticamente el icono base a los tamaños requeridos por la extensión.
- [create-release.ps1](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/create-release.ps1): Script de PowerShell para empaquetar los archivos de la extensión en un archivo ZIP listo para distribución.

---

## 3. Instalación de la Extensión en el Navegador

### Google Chrome / Microsoft Edge / Brave
1. Descarga o clona este repositorio en una carpeta local (ej. `C:\dev\glpi-task-draft-saver-extension`).
2. Abre el navegador y ve a la página de administración de extensiones:
   - Chrome/Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Activa el **Modo de desarrollador** (esquina superior derecha en Chrome/Brave; esquina inferior izquierda en Edge).
4. Haz clic en el botón **Cargar descomprimida** (o "Cargar elemento sin empaquetar").
5. Selecciona la carpeta **`extension/`** dentro de este repositorio.

### Mozilla Firefox
Para desarrollo o pruebas temporales:
1. Abre Firefox e introduce en la barra de direcciones: `about:debugging`.
2. Haz clic en **Este Firefox** (This Firefox).
3. Haz clic en **Cargar complemento temporal...** (Load Temporary Add-on...).
4. Selecciona el archivo [manifest.json](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/manifest.json) de la carpeta `extension/`.

---

## 4. Arquitectura y Funcionamiento del Código

### A. Aislamiento de Contextos (Main vs Isolated)
En las extensiones de navegador, los scripts de contenido por defecto se ejecutan en un contexto aislado del que usa la página web. Sin embargo, para interactuar con la instancia global de **TinyMCE** (`window.tinymce`) (el editor de texto enriquecido que usa GLPI), necesitamos acceder directamente al contexto de la página (el mundo `MAIN`).

- **`content.js`** se inyecta en el mundo `MAIN` (`"world": "MAIN"` en el manifiesto). Puede comunicarse con el editor TinyMCE, escuchar eventos de teclado y ratón, y leer/escribir borradores de `localStorage`.
- **`bridge.js`** se ejecuta en el mundo `ISOLATED` por defecto. Es el único que tiene acceso a las APIs nativas de Chrome, como `chrome.storage.sync`.
- **Sincronización de Configuración**: Para pasar la configuración de Tema y Posición desde `bridge.js` (Isolated) a `content.js` (Main), `bridge.js` escribe atributos personalizados en la etiqueta `<html>` del DOM (ej. `data-glpi-draft-saver-pos="top-right"`). `content.js` y `style.css` leen dinámicamente estos atributos para renderizar la interfaz en la posición y tema seleccionados.

### B. Ciclo de Autoguardado y Restauración
1. **Detección Dinámica y Reactiva**: `content.js` realiza un escaneo inicial de los editores TinyMCE activos en la página (`window.tinymce.editors`). Además, para optimizar recursos y no mantener intervalos activos de forma indefinida, se añade un escuchador global a clics en la página que inicia una ventana de detección de 30 segundos cada vez que el usuario interactúa (por ejemplo, al pulsar el botón "Agregar" o al pulsar "Editar" en una tarea existente de la línea de tiempo).
2. **Identificación de Contextos (Nuevo vs Edición)**: Para cada editor detectado, se inspecciona su formulario padre:
   - Se determina el tipo de borrador mediante el campo `<input name="itemtype">` (puede ser `TicketTask` para Tareas, `ITILFollowup` para Seguimientos, `ITILSolution` para Soluciones o `TicketValidation` para Validaciones).
   - Se comprueba si es un borrador de edición leyendo el campo oculto `<input name="id">`. Si el valor es mayor a 0 y distinto al ID del ticket, se reconoce como edición de un elemento existente.
3. **Guardado Independiente**: Los borradores se guardan de forma independiente en `localStorage` con claves dinámicas diferenciando si es una creación nueva o una edición:
   - Nuevo elemento: `glpi_draft_<tipo>_ticket_<ticketId>`
   - Modificación: `glpi_draft_<tipo>_ticket_<ticketId>_edit_<id_elemento>`
   Esto permite que un técnico pueda estar redactando una tarea nueva y modificando una tarea antigua al mismo tiempo sin que se sobrescriban los borradores.
4. **Limpieza al Enviar**: Al enviar con éxito cualquiera de los formularios, el escuchador de envío (`submit`) elimina específicamente la clave de `localStorage` que pertenece a ese editor.
5. **Restauración Inteligente en la Línea de Tiempo**: Si al cargar el ticket hay borradores guardados, la extensión muestra banners informativos. Al restaurar:
   - Se copia la copia de seguridad al portapapeles.
   - Si es un borrador de un nuevo elemento, pulsa el botón correspondiente del formulario para mostrar el bloque.
   - Si es un borrador de una edición existente (posee un ID de elemento), el script busca en la línea de tiempo el botón "Editar" correspondiente a ese ID específico (`findEditButton`) y simula un clic para forzar la carga AJAX del formulario de edición.
   - Una vez cargado el TinyMCE en la pantalla, inyecta el contenido con un retardo de 300ms. Si no se localiza el botón de edición, se advierte al usuario con un toast de que el texto ha sido copiado al portapapeles para que lo pegue manualmente al abrir la edición.

### C. Auto-Actualización para Técnicos (`background.js`)
Si la extensión se despliega de manera no empaquetada (unpacked) en una carpeta de red compartida para que la usen varios técnicos:
- El script [background.js](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/background.js) comprueba cada 2 días (o al iniciar el navegador) si la versión de [manifest.json](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/manifest.json) en el disco físico ha cambiado agregando un parámetro temporal `?t=` para omitir la caché de Chrome.
- Si detecta una versión más nueva, ejecuta `chrome.runtime.reload()` para recargar la extensión automáticamente de forma transparente en el equipo de los técnicos.

---

## 5. Guía de Desarrollo y Tareas Comunes

### Generación de Iconos
Si modificas el icono base de la extensión (`extension_icon_base.png`), no necesitas redimensionarlo manualmente en varios tamaños. Puedes usar el script automatizado en PowerShell:
1. Abre una consola de PowerShell.
2. Ejecuta el script:
   ```powershell
   .\generate_icons.ps1
   ```
El script generará automáticamente los archivos de icono requeridos (`icon16.png`, `icon48.png` e `icon128.png`) y los colocará en `extension/icons/`.

### Empaquetado de Versiones (Creación de Release)
Cuando los cambios estén listos y quieras publicar una nueva versión:
1. Incrementa la versión en [manifest.json](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/extension/manifest.json) (clave `"version"`).
2. Ejecuta en PowerShell:
   ```powershell
   .\create-release.ps1
   ```
Esto creará un archivo ZIP en la raíz del repositorio con el formato `glpi-draft-saver-pro-v[version].zip`, excluyendo archivos temporales y mapas de origen.

---

## 6. Base de Conocimientos Local (`codebase-memory-mcp`)

Este repositorio cuenta con soporte para `codebase-memory-mcp`, que crea un mapa de grafos del código para facilitar la navegación y el análisis de la arquitectura.

### Instalación de codebase-memory-mcp:
1. Si deseas instalarlo en tu ordenador para ver la representación gráfica del código, ejecuta en PowerShell:
   ```powershell
   Invoke-WebRequest -Uri https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.ps1 -OutFile install.ps1
   Unblock-File .\install.ps1
   .\install.ps1 --ui
   Remove-Item .\install.ps1
   ```
2. Ejecuta la indexación inicial:
   ```powershell
   codebase-memory-mcp cli index_repository '{"repo_path": "c:/Users/japeraba/dev/glpi-task-draft-saver-extension"}'
   ```
3. Puedes ver el mapa interactivo en 3D de todo el código de la extensión abriendo un navegador en: `http://localhost:9749`

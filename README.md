# GLPI Draft Saver Pro

A professional browser extension that automatically saves drafts for **Tasks, Follow-ups, Solutions, and Validations** in GLPI to prevent data loss.

## Features

- **Multi-Editor Autosave**: Independently saves drafts for tasks, follow-ups, solutions, and validations.
- **Smart Restoration**: Detects saved drafts and offers a single-click restoration that automatically opens the correct form block.
- **Periodic Backup**: Automatically ensures your work is backed up every 5 seconds.
- **Visual Feedback**: Clean, non-intrusive toasts with glassmorphism design.
- **Legacy Support**: Automatically migrates old task drafts to the new multi-editor system.
- **Secure & Private**: All data is stored locally in your browser's `localStorage`.

## Instalación para Técnicos

### Google Chrome / Microsoft Edge / Brave

La forma más sencilla de instalar la extensión es usar el archivo `.zip`:

1. Descarga el archivo `glpi-draft-saver-pro-v2.0.0.zip`.
2. Extrae el contenido en una carpeta en tu ordenador (ej. `C:\Extensiones\GLPI-Draft-Saver`).
3. Abre tu navegador y ve a la página de extensiones:
   - Chrome/Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`
4. Activa el **Modo de desarrollador** (arriba a la derecha en Chrome, abajo a la izquierda en Edge).
5. Haz clic en el botón **Cargar descomprimida** (o "Cargar elemento sin empaquetar").
6. Selecciona la carpeta donde extrajiste los archivos.

### Mozilla Firefox

Firefox requiere que las extensiones estén firmadas por Mozilla para ser instaladas de forma permanente. Si el departamento de IT ha proporcionado el archivo `.xpi` (versión firmada No Listada en AMO):

1. Asegúrate de tener el archivo descargado (ej. `glpi-draft-saver-pro.xpi`).
2. Abre Firefox y entra en `about:addons`.
3. Arrastra el archivo `.xpi` hacia la ventana del navegador.
4. Confirma la instalación cuando Firefox te pregunte.

*(Si solo tienes el código fuente o el `.zip` y quieres probarla temporalmente, ve a `about:debugging` > Este Firefox > Cargar complemento temporal y selecciona el archivo `manifest.json`).*

## Technical Details

- **Target URL**: Only runs on GLPI ticket form pages requiring a `id` parameter.
- **Storage Strategy**: Uses `localStorage` with the key format `glpi_draft_<type>_ticket_<id>`.
- **Editor Detection**: Detects standard `textarea` and TinyMCE fields inside ITIL blocks.
- **Minimum Save Length**: Only saves if content is longer than 10 characters.

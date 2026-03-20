# GLPI Task Draft Saver

A browser extension that automatically saves drafts written in GLPI ticket tasks to prevent data loss.

## Features

- **Automatic Autosave**: Saves drafts as you type (every 1 second with debounce).
- **Periodic Backup**: Runs a backup every 5 seconds.
- **Auto Restore**: Restores a saved draft if the editor is empty upon page load.
- **Smart Cleanup**: Clears the saved draft after a successful form submission.
- **Visual Feedback**: Shows a quiet "Draft saved" toast notification in the bottom-right corner.
- **Secure & Private**: All data is stored locally in the browser's `localStorage`. No data is sent elsewhere.

## Instalación para Técnicos

### Google Chrome / Microsoft Edge / Brave
La forma más sencilla de instalar la extensión es usar el archivo `.zip`:

1. Descarga el archivo `glpi-task-draft-saver.zip`.
2. Extrae el contenido en una carpeta en tu ordenador (ej. `C:\Extensiones\GLPI-Draft-Saver`).
3. Abre tu navegador y ve a la página de extensiones:
   - Chrome/Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`
4. Activa el **Modo de desarrollador** (arriba a la derecha en Chrome, abajo a la izquierda en Edge).
5. Haz clic en el botón **Cargar descomprimida** (o "Cargar elemento sin empaquetar").
6. Selecciona la carpeta donde extrajiste los archivos.

### Mozilla Firefox
Firefox requiere que las extensiones estén firmadas por Mozilla para ser instaladas de forma permanente. Si el departamento de IT ha proporcionado el archivo `.xpi` (versión firmada No Listada en AMO):
1. Asegúrate de tener el archivo descargado (ej. `glpi-task-draft-saver.xpi`).
2. Abre Firefox y entra en `about:addons`.
3. Arrastra el archivo `.xpi` hacia la ventana del navegador.
4. Confirma la instalación cuando Firefox te pregunte.

*(Si solo tienes el código fuente o el `.zip` y quieres probarla temporalmente, ve a `about:debugging` > Este Firefox > Cargar complemento temporal y selecciona el archivo `manifest.json`).*

## Technical Details

- **Target URL**: Only runs on GLPI ticket form pages requiring a `id` parameter.
- **Storage Strategy**: Uses `localStorage` with the key format `glpi_draft_ticket_<ticketID>`.
- **Editor Detection**: Detects standard `textarea` and `contenteditable` fields.
- **Minimum Save Length**: Only saves if content is longer than 10 characters.

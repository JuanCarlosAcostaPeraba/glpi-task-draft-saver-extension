# GLPI Draft Saver Pro

A professional browser extension that automatically saves drafts for **Tasks, Follow-ups, Solutions, and Validations** in GLPI to prevent data loss.

---

## 📚 Documentación del Proyecto / Project Documentation

Para facilitar el desarrollo, mantenimiento y puesta en marcha del proyecto, la documentación se ha dividido en dos guías específicas:

1. **Para Desarrolladores Humanos 🧑‍💻**:
   - Consulta el [Manual del Desarrollador (Humano)](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/docs/README_HUMAN.md) para saber cómo funciona la arquitectura de la extensión, configurar el entorno de pruebas local, generar iconos y empaquetar una nueva release.
2. **Para Asistentes de IA y Agentes Autónomos 🤖**:
   - Consulta la [Guía de Desarrollo para AIs y Agentes](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/docs/README_AI.md) para obtener una explicación detallada del flujo de datos, restricciones del ciclo de vida de TinyMCE, sincronización DOM e instrucciones de integración con `codebase-memory-mcp`.
   - Las reglas y directrices automatizadas para agentes también están declaradas en [.agents/AGENTS.md](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/.agents/AGENTS.md) para su carga automática por copilotos compatibles.

---

## Features

- **Multi-Editor Autosave**: Independently saves drafts for tasks, follow-ups, solutions, and validations.
- **Smart Restoration**: Detects saved drafts and offers a single-click restoration that automatically opens the correct form block.
- **Periodic Backup**: Automatically ensures your work is backed up every 5 seconds.
- **Visual Feedback**: Clean, non-intrusive toasts with glassmorphism design.
- **Legacy Support**: Automatically migrates old task drafts to the new multi-editor system.
- **Secure & Private**: All data is stored locally in your browser's `localStorage`.

## Quick Start (Instalación Rápida)

### Google Chrome / Microsoft Edge / Brave
1. Descarga el archivo de la release de Chrome (`glpi-draft-saver-pro-chrome-v*.zip`).
2. Extrae el contenido en una carpeta local (ej. `C:\Extensiones\GLPI-Draft-Saver-Chrome`).
3. Abre Chrome y ve a `chrome://extensions/`.
4. Activa el **Modo de desarrollador** (arriba a la derecha).
5. Haz clic en **Cargar descomprimida** y selecciona el directorio extraído.

Para desarrollo en caliente, carga la carpeta `chrome/` directamente desde este repositorio.

### Mozilla Firefox
1. Descarga el archivo de la release de Firefox (`glpi-draft-saver-pro-firefox-v*.zip` para desarrollo o el `.xpi` firmado para producción).
2. Para cargarlo temporalmente en desarrollo:
   - Ve a `about:debugging` → **Este Firefox** → **Cargar complemento temporal...** y selecciona el archivo `manifest.json` dentro de la carpeta `firefox/` de este repositorio.
3. Para instalación permanente:
   - Instala el archivo `.xpi` firmado arrastrándolo directamente sobre Firefox o desde `about:addons` → ⚙️ → **Instalar complemento desde archivo...**

*Para más detalles sobre la arquitectura de la extensión o la configuración del auto-actualizador, consulta el [Manual del Desarrollador (Humano)](file:///c:/Users/japeraba/dev/glpi-task-draft-saver-extension/docs/README_HUMAN.md).*

## Technical Details

- **Target URL**: Only runs on GLPI ticket form pages requiring a `id` parameter.
- **Storage Strategy**: Uses `localStorage` with the key format `glpi_draft_<type>_ticket_<id>`.
- **Editor Detection**: Detects standard `textarea` and TinyMCE fields inside ITIL blocks.
- **Minimum Save Length**: Only saves if content is longer than 10 characters.

## Privacy

GLPI Draft Saver Pro **does not collect, transmit, or share any personal data**. All draft content is stored exclusively in your browser's `localStorage` and never leaves your device. User preferences (toast position and theme) are saved in `chrome.storage.sync` solely to synchronize your settings across your own devices.

- **No analytics or tracking** of any kind.
- **No external network requests**. The extension works entirely offline.
- **No access to personal information**, authentication credentials, browsing history, or any data beyond the GLPI ticket page content you are actively editing.
- **No remote code execution**. All JavaScript and CSS is bundled within the extension package.

Your data stays on your machine. Period.

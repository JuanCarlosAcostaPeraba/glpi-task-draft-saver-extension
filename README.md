# GLPI Task Draft Saver

A browser extension that automatically saves drafts written in GLPI ticket tasks to prevent data loss.

## Features

- **Automatic Autosave**: Saves drafts as you type (every 1 second with debounce).
- **Periodic Backup**: Runs a backup every 5 seconds.
- **Auto Restore**: Restores a saved draft if the editor is empty upon page load.
- **Smart Cleanup**: Clears the saved draft after a successful form submission.
- **Visual Feedback**: Shows a quiet "Draft saved" toast notification in the bottom-right corner.
- **Secure & Private**: All data is stored locally in the browser's `localStorage`. No data is sent elsewhere.

## Installation Instructions

1.  **Download/Clone** this repository to your computer.
2.  Open **Google Chrome** (or Microsoft Edge).
3.  Go to `chrome://extensions/` (or `edge://extensions/`).
4.  Enable **Developer mode** (toggle in the top-right corner).
5.  Click on **Load unpacked**.
6.  Select the `extension` folder within this project directory.
7.  The extension is now active on `https://gise.huc.es/front/ticket.form.php*`.

## Technical Details

- **Target URL**: Only runs on GLPI ticket form pages requiring a `id` parameter.
- **Storage Strategy**: Uses `localStorage` with the key format `glpi_draft_ticket_<ticketID>`.
- **Editor Detection**: Detects standard `textarea` and `contenteditable` fields.
- **Minimum Save Length**: Only saves if content is longer than 10 characters.

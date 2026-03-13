/**
 * GLPI Task Draft Saver - content.js (Interactive UI Edition)
 * Automatically saves drafts and provides a UI to restore them manually.
 */

(function () {
  'use strict';

  // 1. Global Guard
  const INSTANCE_ID = Date.now();
  if (window.__GLPI_DRAFT_SAVER_ACTIVE__) {
      console.log(`[GLPI Draft Saver] Instance ${INSTANCE_ID} aborted. Already active.`);
      return;
  }
  window.__GLPI_DRAFT_SAVER_ACTIVE__ = true;

  // --- CONFIGURATION & CONSTANTS ---
  const DEBUG = true;
  const AUTOSAVE_INTERVAL_MS = 5000;
  const DEBOUNCE_DELAY_MS = 1000;
  const MIN_CONTENT_LENGTH = 10;
  const TOAST_SUCCESS_MS = 3000; // Time for "Draft saved" toast
  const POLLING_INTERVAL_MS = 1000;
  const POLLING_MAX_TIME_MS = 30000;

  const STORAGE_KEY_PREFIX = 'glpi_draft_ticket_';
  const SUBMIT_FLAG_PREFIX = 'glpi_submit_attempt_';
  const TARGET_PATHNAME = '/front/ticket.form.php';

  // --- STATE ---
  let ticketId = null;
  let targetTextarea = null;
  let tinymceEditor = null;
  let debounceTimer = null;
  let autosaveInterval = null;
  let toastElement = null;
  let toastTimer = null;
  let pollingStartTime = 0;
  let isPolling = false;
  let lastSavedContent = '';

  /**
   * Internal logger for debug mode
   */
  function log(...args) {
    if (DEBUG) {
      console.log(`[DraftSaver ${INSTANCE_ID}]`, ...args);
    }
  }

  /**
   * Main entry point
   */
  function init() {
    log('Script initialized. Path:', window.location.pathname);
    
    if (window.location.pathname !== TARGET_PATHNAME) return;

    ticketId = getValidatedTicketId();
    if (!ticketId) return;

    setupToastIndicator();
    startTinyMCEDetectionPolling();
  }

  // --- EDITOR DETECTION ---

  function startTinyMCEDetectionPolling() {
    if (isPolling) return;
    isPolling = true;
    pollingStartTime = Date.now();

    log('Starting TinyMCE detection...');

    const poll = setInterval(() => {
      const textareas = Array.from(document.querySelectorAll('textarea[name="content"][id]'));
      
      if (textareas.length > 0) {
        const taskTextarea = textareas.find(el => {
            const id = el.id.toLowerCase();
            return id.startsWith('content_') && !id.startsWith('solution_content_');
        });

        if (taskTextarea) {
          const tinymce = window.tinymce;
          if (tinymce && typeof tinymce.get === 'function') {
            const editor = tinymce.get(taskTextarea.id);

            if (editor && typeof editor.getContent === 'function' && typeof editor.save === 'function') {
              targetTextarea = taskTextarea;
              tinymceEditor = editor;
              clearInterval(poll);
              isPolling = false;
              log(`Success: Found Task editor [${taskTextarea.id}].`);
              onEditorFound();
            }
          }
        }
      }

      if (isPolling && (Date.now() - pollingStartTime > POLLING_MAX_TIME_MS)) {
        clearInterval(poll);
        isPolling = false;
        console.warn('[GLPI Draft Saver] Task editor detection timed out.');
      }
    }, POLLING_INTERVAL_MS);
  }

  function onEditorFound() {
    checkForAvailableDraft(); // Instead of auto-restore
    attachListeners();
    startPeriodicBackup();
  }

  // --- STORAGE & LOGIC ---

  function htmlToPlainText(html) {
    if (!html) return '';
    try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return (tempDiv.textContent || tempDiv.innerText || '').replace(/\u00a0/g, ' ').trim();
    } catch (e) { return ''; }
  }

  function saveDraft() {
    if (!ticketId || !tinymceEditor) return;

    try {
      tinymceEditor.save();
      const currentHtml = tinymceEditor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      if (plainText.length >= MIN_CONTENT_LENGTH) {
        if (currentHtml !== lastSavedContent) {
          const draftData = {
            ticketId: ticketId,
            content: currentHtml,
            savedAt: new Date().toISOString()
          };
          
          localStorage.setItem(STORAGE_KEY_PREFIX + ticketId, JSON.stringify(draftData));
          lastSavedContent = currentHtml;
          
          // Show "Saved" notification only (compact)
          showStatusToast('Draft saved automatic');
        }
      }
    } catch (e) {
      console.error('[GLPI Draft Saver] Error during save:', e);
    }
  }

  /**
   * Check if a draft exists and the editor is empty
   */
  function checkForAvailableDraft() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY_PREFIX + ticketId);
      if (!rawData) return;

      const draftData = JSON.parse(rawData);
      const currentHtml = tinymceEditor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      // If editor is empty but we have a draft, prompt user
      if (plainText === '' && draftData.content) {
        log(`Draft available from ${draftData.savedAt}. Prompting user.`);
        showRestorePrompt(draftData);
      }
    } catch (e) {
      log('Check for available draft failed:', e);
    }
  }

  /**
   * Actual restoration logic triggered by user
   */
  function performRestore(draftData) {
    if (!tinymceEditor) return;
    
    log('Performing user-requested restoration...');
    try {
        tinymceEditor.setContent(draftData.content);
        tinymceEditor.save();
        lastSavedContent = draftData.content;

        if (targetTextarea) {
          targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          targetTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        showStatusToast('Draft restored successfully');
        log('Restoration complete.');
    } catch (e) {
        log('Restoration failed in performRestore:', e);
        alert('Error al restaurar el borrador. Revisa la consola.');
    }
  }

  // --- UI INDICATOR ---

  function setupToastIndicator() {
    if (document.getElementById('glpi-draft-saver-toast')) return;
    
    toastElement = document.createElement('div');
    toastElement.id = 'glpi-draft-saver-toast';
    toastElement.className = 'glpi-draft-saver-toast';
    toastElement.style.cssText = 'display: none !important;'; 

    if (document.body) {
      document.body.appendChild(toastElement);
    } else {
      window.addEventListener('load', () => {
          if (!document.getElementById('glpi-draft-saver-toast')) {
              document.body.appendChild(toastElement);
          }
      });
    }
  }

  /**
   * Shows a prompt with a button to restore the draft
   */
  function showRestorePrompt(draftData) {
    if (!toastElement) return;
    if (toastTimer) clearTimeout(toastTimer);

    const savedDate = new Date(draftData.savedAt).toLocaleString();
    
    toastElement.innerHTML = `
      <div><strong>Borrador encontrado</strong></div>
      <div style="font-size: 11px; opacity: 0.8;">Guardado el: ${savedDate}</div>
      <div class="toast-actions">
        <button id="glpi-btn-restore">Restaurar ahora</button>
        <button id="glpi-btn-dismiss" class="secondary">Ignorar</button>
      </div>
    `;

    toastElement.style.setProperty('display', 'flex', 'important');
    toastElement.classList.add('show');

    // Attach button listeners
    document.getElementById('glpi-btn-restore').onclick = () => {
        performRestore(draftData);
        hideToast();
    };

    document.getElementById('glpi-btn-dismiss').onclick = () => {
        log('User dismissed draft restoration.');
        hideToast();
    };
  }

  /**
   * Shows a simple status message (Saved, etc.)
   */
  function showStatusToast(message) {
    if (!toastElement) return;
    
    // Don't interrupt a restore prompt if it's active
    if (toastElement.querySelector('#glpi-btn-restore')) return;

    if (toastTimer) clearTimeout(toastTimer);
    
    toastElement.innerHTML = `<div>${message}</div>`;
    toastElement.style.setProperty('display', 'flex', 'important');
    toastElement.classList.add('show');

    toastTimer = setTimeout(hideToast, TOAST_SUCCESS_MS);
  }

  function hideToast() {
    if (!toastElement) return;
    toastElement.classList.remove('show');
    setTimeout(() => { 
        toastElement.style.setProperty('display', 'none', 'important');
    }, 300);
    toastTimer = null;
  }

  // --- LISTENERS & BACKUP ---

  function attachListeners() {
    if (!tinymceEditor) return;

    ['input', 'change', 'keyup', 'undo', 'redo'].forEach(eventType => {
      tinymceEditor.on(eventType, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveDraft, DEBOUNCE_DELAY_MS);
      });
    });

    if (targetTextarea) {
      const parentForm = targetTextarea.closest('form');
      if (parentForm) {
        parentForm.addEventListener('submit', () => {
          try {
            localStorage.setItem(SUBMIT_FLAG_PREFIX + ticketId, 'true');
          } catch (e) { }
        });
      }
    }
  }

  function startPeriodicBackup() {
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(saveDraft, AUTOSAVE_INTERVAL_MS);
  }

  function getValidatedTicketId() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    return (id && /^\d+$/.test(id)) ? id : null;
  }

  // Start execution
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/**
 * GLPI Task Draft Saver - content.js (Smart UX Edition)
 * Automatically saves drafts and provides UI to restore or copy them to clipboard.
 * Now supports automated task form opening on restoration.
 */

(function () {
  'use strict';

  // 1. Global Guard
  const INSTANCE_ID = Date.now();
  if (window.__GLPI_DRAFT_SAVER_ACTIVE__) {
      return;
  }
  window.__GLPI_DRAFT_SAVER_ACTIVE__ = true;

  // --- CONFIGURATION & CONSTANTS ---
  const DEBUG = true;
  const AUTOSAVE_INTERVAL_MS = 5000;
  const DEBOUNCE_DELAY_MS = 1000;
  const MIN_CONTENT_LENGTH = 10;
  const TOAST_SUCCESS_MS = 3000;
  const POLLING_INTERVAL_MS = 1000;
  const POLLING_MAX_TIME_MS = 30000;

  const STORAGE_KEY_PREFIX = 'glpi_draft_ticket_';
  const SUBMIT_FLAG_PREFIX = 'glpi_submit_attempt_';
  const TARGET_PATHNAME = '/front/ticket.form.php';
  
  // Selectors
  const TASK_BUTTON_SELECTOR = 'button.action-task, button[data-bs-target="#new-TicketTask-block"]';
  const TEXTAREA_SELECTOR = 'textarea[name="content"][id]';

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
   * Internal logger
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
    if (window.location.pathname !== TARGET_PATHNAME) return;

    ticketId = getValidatedTicketId();
    if (!ticketId) return;

    setupToastIndicator();
    
    // Check for draft IMMEDIATELY on load
    checkForAvailableDraft();

    // Start polling for general editor detection (autosave)
    startTinyMCEDetectionPolling();
  }

  // --- EDITOR DETECTION ---

  function startTinyMCEDetectionPolling(callbackOnFound = null) {
    if (isPolling && !callbackOnFound) return;
    isPolling = true;
    pollingStartTime = Date.now();

    log('Polling for TinyMCE editor...');

    const poll = setInterval(() => {
      const textareas = Array.from(document.querySelectorAll(TEXTAREA_SELECTOR));
      
      if (textareas.length > 0) {
        const taskTextarea = textareas.find(el => {
            const id = el.id.toLowerCase();
            return id.startsWith('content_') && !id.startsWith('solution_content_');
        });

        if (taskTextarea) {
          const tinymce = window.tinymce;
          if (tinymce && typeof tinymce.get === 'function') {
            const editor = tinymce.get(taskTextarea.id);

            // Check readiness (must have standard methods)
            if (editor && typeof editor.getContent === 'function' && typeof editor.save === 'function') {
              targetTextarea = taskTextarea;
              tinymceEditor = editor;
              clearInterval(poll);
              isPolling = false;
              log(`Success: Found Task editor [${taskTextarea.id}].`);
              
              onEditorFound();
              if (callbackOnFound) callbackOnFound();
            }
          }
        }
      }

      if (isPolling && (Date.now() - pollingStartTime > POLLING_MAX_TIME_MS)) {
        clearInterval(poll);
        isPolling = false;
        log('Polling timed out.');
      }
    }, POLLING_INTERVAL_MS);
  }

  function onEditorFound() {
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

  async function copyToClipboard(htmlContent) {
    try {
        const plainText = htmlToPlainText(htmlContent);
        await navigator.clipboard.writeText(plainText);
        log('Copied to clipboard.');
        return true;
    } catch (e) { 
        log('Clipboard copy failed (non-critical):', e); 
        return false;
    }
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
          showStatusToast('Borrador guardado');
        }
      }
    } catch (e) {
      console.error('[GLPI Draft Saver] Error during save:', e);
    }
  }

  function checkForAvailableDraft() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY_PREFIX + ticketId);
      if (!rawData) return;

      const draftData = JSON.parse(rawData);
      
      // If editor exists and has content, skip prompt
      if (tinymceEditor) {
          const plainText = htmlToPlainText(tinymceEditor.getContent());
          if (plainText !== '') return;
      }

      log(`Found draft from ${draftData.savedAt}. Showing prompt.`);
      showRestorePrompt(draftData);
    } catch (e) { log('Draft check error:', e); }
  }

  /**
   * Logic to handle the 'Restore' button click.
   * Ensures the task form is visible by clicking the button, then restores content.
   */
  function handleRestoreAction(draftData) {
    const taskBtn = document.querySelector(TASK_BUTTON_SELECTOR);
    
    // Always attempt to click to show form
    if (taskBtn) {
        log('Clicking Task button for visibility.');
        taskBtn.click();
    }

    if (tinymceEditor) {
        performRestore(draftData);
    } else {
        log('Waiting for editor initialization...');
        startTinyMCEDetectionPolling(() => {
            performRestore(draftData);
        });
    }
  }

  async function performRestore(draftData) {
    if (!tinymceEditor) return;
    
    log('Performing restoration...');
    try {
        tinymceEditor.setContent(draftData.content);
        tinymceEditor.save();
        lastSavedContent = draftData.content;

        if (targetTextarea) {
          targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          targetTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        showStatusToast('Borrador restaurado');

        // Non-blocking clipboard copy
        copyToClipboard(draftData.content).then(success => {
            if (success) showStatusToast('Borrador restaurado y copiado');
        });

    } catch (e) { log('Restoration error:', e); }
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

  function showRestorePrompt(draftData) {
    if (!toastElement) return;
    if (toastTimer) clearTimeout(toastTimer);

    const savedDate = new Date(draftData.savedAt).toLocaleString();
    
    toastElement.innerHTML = `
      <div><strong>Borrador encontrado</strong></div>
      <div style="font-size: 11px; opacity: 0.8;">Guardado: ${savedDate}</div>
      <div class="toast-actions">
        <button id="glpi-btn-restore">Restaurar ahora</button>
        <button id="glpi-btn-copy" class="secondary">Copiar</button>
        <button id="glpi-btn-dismiss" class="secondary">Ignorar</button>
      </div>
    `;

    toastElement.style.setProperty('display', 'flex', 'important');
    toastElement.classList.add('show');

    document.getElementById('glpi-btn-restore').onclick = () => {
        handleRestoreAction(draftData);
        hideToast();
    };

    document.getElementById('glpi-btn-copy').onclick = async () => {
        await copyToClipboard(draftData.content);
        showStatusToast('Copiado al portapapeles');
    };

    document.getElementById('glpi-btn-dismiss').onclick = () => {
        log('User dismissed and deleted draft.');
        try { localStorage.removeItem(STORAGE_KEY_PREFIX + ticketId); } catch (e) {}
        hideToast();
    };
  }

  function showStatusToast(message) {
    if (!toastElement || !toastElement.parentNode) return;
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

    const events = ['input', 'change', 'keyup', 'undo', 'redo'];
    events.forEach(eventType => {
      tinymceEditor.off(eventType);
      tinymceEditor.on(eventType, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveDraft, DEBOUNCE_DELAY_MS);
      });
    });

    if (targetTextarea) {
      const parentForm = targetTextarea.closest('form');
      if (parentForm) {
        parentForm.addEventListener('submit', () => {
          try { localStorage.setItem(SUBMIT_FLAG_PREFIX + ticketId, 'true'); } catch (e) { }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

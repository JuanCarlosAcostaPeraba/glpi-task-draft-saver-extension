/**
 * GLPI Task Draft Saver - content.js (Debug & Reliability Edition)
 * Automatically saves drafts written specifically in GLPI ticket tasks.
 */

(function () {
  'use strict';

  // 1. Global Guard: Using a timestamp to identify the instance in logs
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
  const TOAST_DURATION_MS = 3000;
  const POLLING_INTERVAL_MS = 1000; // Slower polling for less CPU impact
  const POLLING_MAX_TIME_MS = 30000; // Longer timeout for slow GLPI instances

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
    
    if (window.location.pathname !== TARGET_PATHNAME) {
        log('Aborting: Not a ticket form page.');
        return;
    }

    ticketId = getValidatedTicketId();
    if (!ticketId) {
      log('Aborting: No valid numeric ticket ID found in URL.');
      return;
    }

    log('Validated Ticket ID:', ticketId);
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
        // Specifically look for the Task editor
        const taskTextarea = textareas.find(el => {
            const id = el.id.toLowerCase();
            return id.startsWith('content_') && !id.startsWith('solution_content_');
        });

        if (taskTextarea) {
          const tinymce = window.tinymce;
          if (tinymce && typeof tinymce.get === 'function') {
            const editor = tinymce.get(taskTextarea.id);

            // Verify editor is fully ready
            if (editor && typeof editor.getContent === 'function' && typeof editor.save === 'function') {
              targetTextarea = taskTextarea;
              tinymceEditor = editor;
              clearInterval(poll);
              isPolling = false;
              log(`Success: Found Task editor [${taskTextarea.id}].`);
              onEditorFound();
            } else {
                log(`Waiting: Editor [${taskTextarea.id}] found but TinyMCE not yet ready.`);
            }
          } else {
              log('Waiting: TinyMCE global object not found.');
          }
        } else {
             // If no clear 'content_' textarea, maybe it's renamed?
             log('Waiting: Task-specific textarea (content_*) not found yet.');
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
    log('Transitioning to operational state.');
    restoreDraft();
    attachListeners();
    startPeriodicBackup();
  }

  // --- STORAGE & LOGIC ---

  function htmlToPlainText(html) {
    if (!html) return '';
    try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        // Also handle &nbsp; specifically as it's common in empty editors
        return (tempDiv.textContent || tempDiv.innerText || '').replace(/\u00a0/g, ' ').trim();
    } catch (e) {
        return '';
    }
  }

  function saveDraft() {
    if (!ticketId || !tinymceEditor) return;

    try {
      tinymceEditor.save(); // Sync to textarea
      const currentHtml = tinymceEditor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      log(`Autosave check... Text length: ${plainText.length}`);

      if (plainText.length >= MIN_CONTENT_LENGTH) {
        if (currentHtml !== lastSavedContent) {
          const draftData = {
            ticketId: ticketId,
            content: currentHtml,
            savedAt: new Date().toISOString()
          };
          
          localStorage.setItem(STORAGE_KEY_PREFIX + ticketId, JSON.stringify(draftData));
          lastSavedContent = currentHtml;
          log('Draft saved to localStorage.');
          showToastIndicator();
        }
      } else if (localStorage.getItem(STORAGE_KEY_PREFIX + ticketId)) {
          // Remove if content was deleted
          localStorage.removeItem(STORAGE_KEY_PREFIX + ticketId);
          lastSavedContent = currentHtml;
          log('Stored draft removed (content too short).');
      }
    } catch (e) {
      console.error('[GLPI Draft Saver] Error during save:', e);
    }
  }

  function restoreDraft() {
    log('Checking for draft to restore...');
    try {
      const rawData = localStorage.getItem(STORAGE_KEY_PREFIX + ticketId);
      if (!rawData) {
          log('No draft found in localStorage for this ticket.');
          return;
      }

      const draftData = JSON.parse(rawData);
      const currentHtml = tinymceEditor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      log(`Found draft from ${draftData.savedAt}. Current editor text length: ${plainText.length}`);

      // If editor looks empty, restore
      if (plainText === '') {
        log('Restoring HTML content...');
        tinymceEditor.setContent(draftData.content);
        tinymceEditor.save();
        lastSavedContent = draftData.content;

        if (targetTextarea) {
          targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          targetTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        log('Draft restoration complete.');
      } else {
        log('Restore skipped: Editor already has content.');
      }
    } catch (e) {
      log('Restore failed:', e);
    }
  }

  // --- INTERACTION ---

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
            log('Submit detected. Flag set.');
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

  // --- UI INDICATOR ---

  function setupToastIndicator() {
    if (document.getElementById('glpi-draft-saver-toast')) return;
    
    toastElement = document.createElement('div');
    toastElement.id = 'glpi-draft-saver-toast';
    toastElement.className = 'glpi-draft-saver-toast';
    toastElement.innerText = 'Draft saved';
    // Ensure visibility with high z-index and explicit positioning
    toastElement.style.cssText = 'display: none !important;'; 

    if (document.body) {
      document.body.appendChild(toastElement);
      log('Toast element appended to body.');
    } else {
      window.addEventListener('load', () => {
          if (!document.getElementById('glpi-draft-saver-toast')) {
              document.body.appendChild(toastElement);
              log('Toast element appended to body (delayed).');
          }
      });
    }
  }

  function showToastIndicator() {
    if (!toastElement) return;
    if (toastTimer) clearTimeout(toastTimer);
    
    // Using inline style for visibility to bypass CSS injection issues if any
    toastElement.style.display = 'block';
    toastElement.classList.add('show');
    
    log('Toast displayed.');

    toastTimer = setTimeout(() => {
      toastElement.classList.remove('show');
      // Subtle delay before hiding entirely
      setTimeout(() => { toastElement.style.display = 'none'; }, 500);
      toastTimer = null;
    }, TOAST_DURATION_MS);
  }

  // Final check for document ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
      init();
  } else {
      window.addEventListener('load', init);
  }

})();

/**
 * GLPI Task Draft Saver - content.js (Final TinyMCE Robust Edition)
 * Automatically saves drafts written specifically in GLPI ticket tasks.
 */

(function () {
  'use strict';

  // 1. Global Guard: Prevent multiple script initialization
  if (window.__GLPI_DRAFT_SAVER_ACTIVE__) return;
  window.__GLPI_DRAFT_SAVER_ACTIVE__ = true;

  // --- CONFIGURATION & CONSTANTS ---
  const DEBUG = true; // Still true for debugging based on user request
  const AUTOSAVE_INTERVAL_MS = 5000;
  const DEBOUNCE_DELAY_MS = 1000;
  const MIN_CONTENT_LENGTH = 10;
  const TOAST_DURATION_MS = 2000;
  const POLLING_INTERVAL_MS = 500;
  const POLLING_MAX_TIME_MS = 15000;

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
      console.log('[GLPI Draft Saver Debug]', ...args);
    }
  }

  /**
   * Main entry point
   */
  function init() {
    // Basic verification of pathname
    if (window.location.pathname !== TARGET_PATHNAME) {
        log('Not on a ticket form page. Path:', window.location.pathname);
        return;
    }

    ticketId = getValidatedTicketId();
    if (!ticketId) {
      log('No valid numeric ticket ID found in URL.');
      return;
    }

    setupToastIndicator();
    startTinyMCEDetectionPolling();
  }

  // --- EDITOR DETECTION (TinyMCE) ---

  /**
   * Robust polling to find the specific editor for "Task" (Tarea)
   */
  function startTinyMCEDetectionPolling() {
    if (isPolling) return;
    isPolling = true;
    pollingStartTime = Date.now();

    log('Starting TinyMCE detection polling (Robust Edition)...');

    const poll = setInterval(() => {
      // Find all textareas named "content", as GLPI can have several (Solution vs Task)
      const textareas = Array.from(document.querySelectorAll('textarea[name="content"][id]'));
      
      if (textareas.length > 0) {
        // Find the one that specifically starts with "content_" (usually the Task editor)
        // and avoid those that start with "solution_content_"
        targetTextarea = textareas.find(el => {
            const id = el.id.toLowerCase();
            return id.startsWith('content_') && !id.startsWith('solution_content_');
        });

        // Fallback: pick the first one if the above specific filter fails
        if (!targetTextarea) {
            targetTextarea = textareas[0];
            log('Specific task textarea not identified, falling back to first match:', targetTextarea.id);
        } else {
            log('Target Task textarea identified:', targetTextarea.id);
        }

        const tinymce = window.tinymce;
        if (tinymce && typeof tinymce.get === 'function') {
          const editor = tinymce.get(targetTextarea.id);

          if (editor && 
              typeof editor.getContent === 'function' && 
              typeof editor.setContent === 'function' && 
              typeof editor.save === 'function') {
            
            tinymceEditor = editor;
            clearInterval(poll);
            isPolling = false;
            log('TinyMCE editor instance for Task ready.');
            onEditorFound();
          }
        }
      }

      if (isPolling && (Date.now() - pollingStartTime > POLLING_MAX_TIME_MS)) {
        clearInterval(poll);
        isPolling = false;
        console.warn('[GLPI Draft Saver] Task editor not detected or not ready after 15s.');
      }
    }, POLLING_INTERVAL_MS);
  }

  function onEditorFound() {
    restoreDraft();
    attachTinyMCEListeners();
    startPeriodicBackup();
    handlePostSaveCleanup();
  }

  // --- STORAGE & LOGIC ---

  function htmlToPlainText(html) {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  function saveDraft() {
    if (!ticketId || !tinymceEditor) return;

    try {
      tinymceEditor.save();
    } catch (e) {
      log('Error syncing TinyMCE to textarea:', e);
    }

    const currentHtml = tinymceEditor.getContent();
    const plainText = htmlToPlainText(currentHtml);

    if (plainText.trim().length >= MIN_CONTENT_LENGTH) {
      if (currentHtml !== lastSavedContent) {
        const draftData = {
          ticketId: ticketId,
          content: currentHtml,
          savedAt: new Date().toISOString()
        };

        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + ticketId, JSON.stringify(draftData));
          lastSavedContent = currentHtml;
          log('Draft saved.');
          showToastIndicator();
        } catch (e) {
          console.error('[GLPI Draft Saver] localStorage write sync failed:', e);
        }
      }
    } else if (localStorage.getItem(STORAGE_KEY_PREFIX + ticketId)) {
        // Only remove if it was actually too small after being large enough before
        // This handles cases where user cleared the whole thing
        try {
            localStorage.removeItem(STORAGE_KEY_PREFIX + ticketId);
            lastSavedContent = currentHtml; 
            log('Draft removed (content below threshold).');
        } catch (e) {
            log('Error clearing small draft.', e);
        }
    }
  }

  function restoreDraft() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY_PREFIX + ticketId);
      if (!rawData) return;

      const draftData = JSON.parse(rawData);
      const currentHtml = tinymceEditor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      // Restore if current content is practically empty
      if (plainText.trim() === '' && draftData.content) {
        tinymceEditor.setContent(draftData.content);
        tinymceEditor.save();
        lastSavedContent = draftData.content;

        if (targetTextarea) {
          targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          targetTextarea.dispatchEvent(new Event('change', { bubbles: true }));
        }

        log('TinyMCE Task draft restored.');
      }
    } catch (e) {
      log('Failed to restore draft.', e);
    }
  }

  function handlePostSaveCleanup() {
    try {
      const submitFlag = localStorage.getItem(SUBMIT_FLAG_PREFIX + ticketId);
      if (submitFlag === 'true') {
        localStorage.removeItem(SUBMIT_FLAG_PREFIX + ticketId);
        log('Acknowledge submit. Keeping draft for safety.');
      }
    } catch (e) {
      log('Cleanup error.', e);
    }
  }

  // --- INTERACTION ---

  function attachTinyMCEListeners() {
    if (!tinymceEditor) return;

    const events = ['input', 'change', 'keyup', 'undo', 'redo'];

    events.forEach(eventType => {
      tinymceEditor.on(eventType, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveDraft, DEBOUNCE_DELAY_MS);
      });
    });

    if (targetTextarea) {
      // Find the form that owns this textarea
      const parentForm = targetTextarea.closest('form');
      if (parentForm) {
        parentForm.addEventListener('submit', () => {
          try {
            localStorage.setItem(SUBMIT_FLAG_PREFIX + ticketId, 'true');
            log('Form submit detected.');
          } catch (e) {
            log('Error setting submit flag.', e);
          }
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

  function showToastIndicator() {
    if (!toastElement) return;
    if (toastTimer) clearTimeout(toastTimer);

    toastElement.classList.add('show');
    toastTimer = setTimeout(() => {
      toastElement.classList.remove('show');
      toastTimer = null;
    }, TOAST_DURATION_MS);
  }

  // Start execution when the document finishes loading
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

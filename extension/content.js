/**
 * GLPI Task Draft Saver - content.js (Final Refined Edition)
 * Automatically saves drafts written in GLPI ticket tasks.
 */

(function () {
  'use strict';

  // 1. Global Guard: Prevent multiple script initialization
  if (window.__GLPI_DRAFT_SAVER_ACTIVE__) return;
  window.__GLPI_DRAFT_SAVER_ACTIVE__ = true;

  // --- CONFIGURATION & CONSTANTS ---
  const DEBUG = true;
  const AUTOSAVE_INTERVAL_MS = 5000;
  const DEBOUNCE_DELAY_MS = 1000;
  const MIN_CONTENT_LENGTH = 10;
  const TOAST_DURATION_MS = 2000;
  const POLLING_INTERVAL_MS = 500;
  const POLLING_MAX_TIME_MS = 15000;

  const STORAGE_KEY_PREFIX = 'glpi_draft_ticket_';
  const SUBMIT_FLAG_PREFIX = 'glpi_submit_attempt_';
  const TARGET_PATHNAME = '/front/ticket.form.php';

  // Keywords for prioritizing task textareas
  const TASK_KEYWORDS = ['content', 'task', 'tasks', 'comment', 'plan', 'actiontime'];

  // --- STATE ---
  let ticketId = null;
  let editorElement = null;
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
    if (window.location.pathname !== TARGET_PATHNAME) return;

    // 4. Validate ticketId: only accept numeric IDs
    ticketId = getValidatedTicketId();
    if (!ticketId) {
      log('No valid numeric ticket ID found in URL.');
      return;
    }

    setupToastIndicator();
    startEditorDetection();
  }

  // --- EDITOR DETECTION ---

  /**
   * Singleton polling mechanism
   */
  function startEditorDetection() {
    if (isPolling) return;
    isPolling = true;
    pollingStartTime = Date.now();

    log('Starting editor detection polling...');

    const poll = setInterval(() => {
      editorElement = findBestEditor();

      if (editorElement) {
        clearInterval(poll);
        isPolling = false;
        log('Best editor found and selected.');
        onEditorFound();
      } else if (Date.now() - pollingStartTime > POLLING_MAX_TIME_MS) {
        clearInterval(poll);
        isPolling = false;
        console.warn('[GLPI Draft Saver] Could not find a valid task textarea after 15 seconds.');
      }
    }, POLLING_INTERVAL_MS);
  }

  /**
   * 1. Prioritized Textarea Detection
   * Finds and scores textareas to find the most likely task editor.
   */
  function findBestEditor() {
    const textareas = Array.from(document.querySelectorAll('textarea'));
    let bestEditor = null;
    let highestScore = -1;

    for (const el of textareas) {
      // Basic requirements: visible, enabled, inside a form
      const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
      const isNotHidden = !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
      const isEnabled = !el.disabled && !el.readOnly;
      const insideForm = el.closest('form');

      if (isVisible && isNotHidden && isEnabled && insideForm) {
        let score = calculateEditorScore(el);
        if (score > highestScore) {
          highestScore = score;
          bestEditor = el;
        }
      }
    }
    return bestEditor;
  }

  /**
   * Calculates a priority score for a textarea based on keywords
   */
  function calculateEditorScore(el) {
    let score = 0;
    const attributesToMatch = [
      el.id,
      el.name,
      el.className,
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder')
    ];

    const searchableString = attributesToMatch.filter(Boolean).join(' ').toLowerCase();

    TASK_KEYWORDS.forEach(keyword => {
      if (searchableString.includes(keyword.toLowerCase())) {
        score += 10;
      }
    });

    return score;
  }

  function onEditorFound() {
    restoreDraft();
    attachEditorListeners();
    startPeriodicBackup();
    handlePostSaveCleanup();
  }

  // --- STORAGE & LOGIC ---

  /**
   * 3. Improved saveDraft: deletes draft if content is too small
   */
  function saveDraft() {
    if (!ticketId || !editorElement) return;

    const currentContent = editorElement.value;
    const trimmedContent = currentContent.trim();

    if (trimmedContent.length >= MIN_CONTENT_LENGTH) {
      if (currentContent !== lastSavedContent) {
        const draftData = {
          ticketId: ticketId,
          content: currentContent,
          savedAt: new Date().toISOString()
        };

        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + ticketId, JSON.stringify(draftData));
          lastSavedContent = currentContent;
          log('Draft saved.');
          showToastIndicator();
        } catch (e) {
          console.error('[GLPI Draft Saver] localStorage error:', e);
        }
      }
    } else {
      // 3. Remove draft if content length is below threshold
      try {
        if (localStorage.getItem(STORAGE_KEY_PREFIX + ticketId)) {
          localStorage.removeItem(STORAGE_KEY_PREFIX + ticketId);
          lastSavedContent = '';
          log('Draft removed (content too small).');
        }
      } catch (e) {
        log('Error removing small draft.', e);
      }
    }
  }

  /**
   * 2. Restore draft with event dispatching
   */
  function restoreDraft() {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY_PREFIX + ticketId);
      if (!rawData) return;

      const draftData = JSON.parse(rawData);
      if (editorElement.value.trim() === '' && draftData.content) {
        editorElement.value = draftData.content;
        lastSavedContent = draftData.content;

        // 2. Dispatch both input and change events
        editorElement.dispatchEvent(new Event('input', { bubbles: true }));
        editorElement.dispatchEvent(new Event('change', { bubbles: true }));

        log('Draft restored with event notification.');
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
        log('Submit flag cleared. Draft stays for safety.');
      }
    } catch (e) {
      log('Cleanup error.', e);
    }
  }

  // --- DOM INTERACTION ---

  function attachEditorListeners() {
    ['input', 'change', 'blur'].forEach(eventType => {
      editorElement.addEventListener(eventType, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(saveDraft, DEBOUNCE_DELAY_MS);
      });
    });

    const parentForm = editorElement.closest('form');
    if (parentForm) {
      parentForm.addEventListener('submit', () => {
        try {
          localStorage.setItem(SUBMIT_FLAG_PREFIX + ticketId, 'true');
        } catch (e) {
          log('Error setting submit flag.', e);
        }
      });
    }
  }

  function startPeriodicBackup() {
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(saveDraft, AUTOSAVE_INTERVAL_MS);
  }

  /**
   * 4. Numeric ticketId validation
   */
  function getValidatedTicketId() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    // Numeric check: non-empty and consists only of digits
    return (id && /^\d+$/.test(id)) ? id : null;
  }

  // --- UI INDICATOR ---

  /**
   * 5. Safe setupToastIndicator: ensures body exists
   */
  function setupToastIndicator() {
    if (document.getElementById('glpi-draft-saver-toast')) return;

    toastElement = document.createElement('div');
    toastElement.id = 'glpi-draft-saver-toast';
    toastElement.className = 'glpi-draft-saver-toast';
    toastElement.innerText = 'Draft saved';

    // 5. Ensure document.body exists before append
    if (document.body) {
      document.body.appendChild(toastElement);
    } else {
      // Fallback: wait for load
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

  // Start execution logic
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

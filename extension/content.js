/**
 * GLPI Task Draft Saver - content.js (Smart UX Edition)
 * Automatically saves drafts and provides UI to restore or copy them to clipboard.
 * Supports Tasks, Follow-ups, Solutions, and Validations.
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

  const LEGACY_STORAGE_KEY_PREFIX = 'glpi_draft_ticket_';
  const TARGET_PATHNAME = '/front/ticket.form.php';
  
  const DRAFT_TYPES = {
    followup: {
      id: 'followup',
      label: 'Seguimiento',
      blockSelector: '#new-ITILFollowup-block',
      buttonSelector: 'button[data-bs-target="#new-ITILFollowup-block"]',
      storageKey: 'glpi_draft_followup_ticket_'
    },
    task: {
      id: 'task',
      label: 'Tarea',
      blockSelector: '#new-TicketTask-block',
      buttonSelector: 'button.action-task, button[data-bs-target="#new-TicketTask-block"]',
      storageKey: 'glpi_draft_task_ticket_'
    },
    solution: {
      id: 'solution',
      label: 'Solución',
      blockSelector: '#new-ITILSolution-block',
      buttonSelector: 'button[data-bs-target="#new-ITILSolution-block"]',
      storageKey: 'glpi_draft_solution_ticket_'
    },
    validation: {
      id: 'validation',
      label: 'Validación',
      blockSelector: '#new-TicketValidation-block',
      buttonSelector: 'button[data-bs-target="#new-TicketValidation-block"]',
      storageKey: 'glpi_draft_validation_ticket_'
    }
  };

  // --- STATE ---
  let ticketId = null;
  const activeEditors = new Map(); // type -> { textarea, editor, lastSavedContent, debounceTimer }
  let autosaveInterval = null;
  let toastContainer = null;
  let isPolling = false;

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

    setupToastContainer();
    
    // Check for drafts IMMEDIATELY on load
    checkForAvailableDrafts();

    // Start polling for general editor detection (autosave)
    startTinyMCEDetectionPolling();
  }

  // --- EDITOR DETECTION ---

  function startTinyMCEDetectionPolling() {
    if (isPolling) return;
    isPolling = true;
    const pollingStartTime = Date.now();

    log('Polling for TinyMCE editors...');

    const poll = setInterval(() => {
      let foundAnyNew = false;

      for (const [type, config] of Object.entries(DRAFT_TYPES)) {
        if (activeEditors.has(type)) continue;

        const block = document.querySelector(config.blockSelector);
        if (!block) continue;

        const textarea = block.querySelector('textarea');
        if (!textarea || !textarea.id) continue;

        const tinymce = window.tinymce;
        if (tinymce && typeof tinymce.get === 'function') {
          const editor = tinymce.get(textarea.id);

          // Check readiness (must have standard methods)
          if (editor && typeof editor.getContent === 'function' && typeof editor.save === 'function') {
            log(`Success: Found ${config.label} editor [${textarea.id}].`);
            
            const editorData = {
                textarea: textarea,
                editor: editor,
                lastSavedContent: '',
                debounceTimer: null
            };
            activeEditors.set(type, editorData);
            attachListeners(type);
            foundAnyNew = true;
          }
        }
      }

      if (foundAnyNew) {
        if (activeEditors.size === Object.keys(DRAFT_TYPES).length) {
            log('All potential editors found.');
            clearInterval(poll);
            isPolling = false;
        }
        startPeriodicBackup();
      }

      if (Date.now() - pollingStartTime > POLLING_MAX_TIME_MS) {
        clearInterval(poll);
        isPolling = false;
        log('Polling finished.');
      }
    }, POLLING_INTERVAL_MS);
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

  function saveDraft(type) {
    const data = activeEditors.get(type);
    if (!ticketId || !data || !data.editor) return;

    const config = DRAFT_TYPES[type];

    try {
      data.editor.save();
      const currentHtml = data.editor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      if (plainText.length >= MIN_CONTENT_LENGTH) {
        if (currentHtml !== data.lastSavedContent) {
          const draftData = {
            ticketId: ticketId,
            type: type,
            content: currentHtml,
            savedAt: new Date().toISOString()
          };
          
          localStorage.setItem(config.storageKey + ticketId, JSON.stringify(draftData));
          data.lastSavedContent = currentHtml;
          showStatusToast(`Borrador de ${config.label} guardado`);
        }
      }
    } catch (e) {
      console.error(`[GLPI Draft Saver] Error during save (${type}):`, e);
    }
  }

  function checkForAvailableDrafts() {
    try {
      for (const [type, config] of Object.entries(DRAFT_TYPES)) {
        let rawData = localStorage.getItem(config.storageKey + ticketId);
        
        // Legacy support for tasks
        if (!rawData && type === 'task') {
            rawData = localStorage.getItem(LEGACY_STORAGE_KEY_PREFIX + ticketId);
            if (rawData) {
                log('Found legacy task draft. Migrating...');
                localStorage.setItem(config.storageKey + ticketId, rawData);
                localStorage.removeItem(LEGACY_STORAGE_KEY_PREFIX + ticketId);
            }
        }

        if (!rawData) continue;

        const draftData = JSON.parse(rawData);
        
        // If editor exists and has content, skip prompt
        const existingEditor = activeEditors.get(type);
        if (existingEditor) {
            const plainText = htmlToPlainText(existingEditor.editor.getContent());
            if (plainText !== '') continue;
        }

        log(`Found ${type} draft from ${draftData.savedAt}. Showing prompt.`);
        showRestorePrompt(draftData);
      }
    } catch (e) { log('Draft check error:', e); }
  }

  /**
   * Logic to handle the 'Restore' button click.
   * Ensures the correct form block is visible by clicking the button, then restores content.
   */
  function handleRestoreAction(draftData) {
    const config = DRAFT_TYPES[draftData.type];
    const btn = document.querySelector(config.buttonSelector);
    
    // Always attempt to click to show form
    if (btn) {
        log(`Clicking ${draftData.type} button for visibility.`);
        btn.click();
    }

    const editorData = activeEditors.get(draftData.type);
    if (editorData) {
        performRestore(draftData);
    } else {
        log(`Waiting for ${draftData.type} editor initialization...`);
        // We might need to restart polling if it stopped
        startTinyMCEDetectionPolling();
        
        // Wait specifically for this one
        const waitInterval = setInterval(() => {
            if (activeEditors.has(draftData.type)) {
                clearInterval(waitInterval);
                performRestore(draftData);
            }
        }, 500);
        
        // Timeout wait
        setTimeout(() => clearInterval(waitInterval), 10000);
    }
  }

  async function performRestore(draftData) {
    const data = activeEditors.get(draftData.type);
    if (!data || !data.editor) return;
    
    log(`Performing restoration for ${draftData.type}...`);
    try {
        data.editor.setContent(draftData.content);
        data.editor.save();
        data.lastSavedContent = draftData.content;

        if (data.textarea) {
          data.textarea.dispatchEvent(new Event('input', { bubbles: true }));
          data.textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        showStatusToast(`Borrador de ${DRAFT_TYPES[draftData.type].label} restaurado`);

        // Non-blocking clipboard copy
        copyToClipboard(draftData.content).then(success => {
            if (success) showStatusToast(`Borrador de ${DRAFT_TYPES[draftData.type].label} rest. y copiado`);
        });

    } catch (e) { log('Restoration error:', e); }
  }

  // --- UI INDICATOR ---

  function setupToastContainer() {
    if (document.getElementById('glpi-draft-saver-toast-container')) {
        toastContainer = document.getElementById('glpi-draft-saver-toast-container');
        return;
    }
    
    toastContainer = document.createElement('div');
    toastContainer.id = 'glpi-draft-saver-toast-container';
    toastContainer.className = 'glpi-draft-saver-toast-container';
    document.body.appendChild(toastContainer);
  }

  function showRestorePrompt(draftData) {
    if (!toastContainer) setupToastContainer();

    const toastId = `toast-restore-${draftData.type}-${ticketId}`;
    if (document.getElementById(toastId)) return;

    const config = DRAFT_TYPES[draftData.type];
    const savedDate = new Date(draftData.savedAt).toLocaleString();
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'glpi-draft-saver-toast restore-prompt';
    toast.innerHTML = `
      <div><strong>Borrador de ${config.label}</strong></div>
      <div style="font-size: 11px; opacity: 0.8;">Guardado: ${savedDate}</div>
      <div class="toast-actions">
        <button class="glpi-btn-restore">Restaurar</button>
        <button class="glpi-btn-copy secondary">Copiar</button>
        <button class="glpi-btn-dismiss secondary">Ignorar</button>
      </div>
    `;

    toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    toast.querySelector('.glpi-btn-restore').onclick = () => {
        handleRestoreAction(draftData);
        hideToast(toast);
    };

    toast.querySelector('.glpi-btn-copy').onclick = async () => {
        await copyToClipboard(draftData.content);
        showStatusToast('Copiado al portapapeles');
    };

    toast.querySelector('.glpi-btn-dismiss').onclick = () => {
        log(`User dismissed and deleted ${draftData.type} draft.`);
        try { localStorage.removeItem(config.storageKey + ticketId); } catch (e) {}
        hideToast(toast);
    };
  }

  function showStatusToast(message) {
    if (!toastContainer) setupToastContainer();

    const toast = document.createElement('div');
    toast.className = 'glpi-draft-saver-toast status-toast';
    toast.innerHTML = `<div>${message}</div>`;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        hideToast(toast);
    }, TOAST_SUCCESS_MS);
  }

  function hideToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }

  // --- LISTENERS & BACKUP ---

  function attachListeners(type) {
    const data = activeEditors.get(type);
    if (!data || !data.editor) return;

    const events = ['input', 'change', 'keyup', 'undo', 'redo'];
    events.forEach(eventType => {
      data.editor.off(eventType);
      data.editor.on(eventType, () => {
        clearTimeout(data.debounceTimer);
        data.debounceTimer = setTimeout(() => saveDraft(type), DEBOUNCE_DELAY_MS);
      });
    });

    if (data.textarea) {
      const parentForm = data.textarea.closest('form');
      if (parentForm) {
        parentForm.addEventListener('submit', () => {
          log(`Form for ${type} submitted. Cleaning up draft.`);
          try {
            localStorage.removeItem(DRAFT_TYPES[type].storageKey + ticketId);
          } catch (e) {
            log(`Error cleaning up ${type} draft on submit:`, e);
          }
        });
      }
    }
  }

  function startPeriodicBackup() {
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(() => {
        for (const type of activeEditors.keys()) {
            saveDraft(type);
        }
    }, AUTOSAVE_INTERVAL_MS);
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

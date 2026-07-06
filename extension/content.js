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
  const TARGET_PATHNAME_SUFFIX = '/front/ticket.form.php';
  
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
  const activeEditors = new Map(); // storageKey -> { textarea, editor, lastSavedContent, debounceTimer, type, itemId, label, storageKey }
  let autosaveInterval = null;
  let toastContainer = null;
  let isPolling = false;
  let isInitialized = false;

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
    // Better path check (handles /glpi/front/...)
    if (!window.location.pathname.endsWith(TARGET_PATHNAME_SUFFIX)) {
        return;
    }

    ticketId = getValidatedTicketId();
    if (!ticketId) return;

    if (isInitialized) {
        return;
    }

    log('Initializing GLPI Draft Saver core...');
    isInitialized = true;
    setupToastContainer();
    
    // Check for drafts IMMEDIATELY on load
    checkForAvailableDrafts();

    // Start polling for general editor detection (autosave)
    startTinyMCEDetectionPolling();

    // Reiniciar el bucle de polling ante interacciones para detectar editores dinámicos (AJAX)
    document.addEventListener('click', () => {
      startTinyMCEDetectionPolling(true);
    });
  }





  // --- EDITOR UTILITIES ---

  /**
   * Identifica el tipo y contexto de borrador (nuevo o edición) para un textarea de TinyMCE.
   */
  function getEditorConfig(textarea) {
    const form = textarea.closest('form');
    const action = form ? (form.getAttribute('action') || '').toLowerCase() : '';
    const itemtypeInput = form ? form.querySelector('input[name="itemtype"]') : null;
    const itemtype = itemtypeInput ? itemtypeInput.value : '';

    let type = null;
    let itemId = null;

    // 1. Identificar el tipo de borrador (seguimiento, tarea, solución, validación)
    if (itemtype === 'TicketTask' || action.includes('tickettask') || textarea.closest('#new-TicketTask-block') || textarea.id.includes('TicketTask') || (textarea.name && textarea.name.includes('TicketTask'))) {
      type = 'task';
    } else if (itemtype === 'ITILFollowup' || action.includes('itilfollowup') || textarea.closest('#new-ITILFollowup-block') || textarea.id.includes('ITILFollowup') || (textarea.name && textarea.name.includes('ITILFollowup'))) {
      type = 'followup';
    } else if (itemtype === 'ITILSolution' || action.includes('itilsolution') || textarea.closest('#new-ITILSolution-block') || textarea.id.includes('ITILSolution') || (textarea.name && textarea.name.includes('ITILSolution'))) {
      type = 'solution';
    } else if (itemtype === 'TicketValidation' || action.includes('ticketvalidation') || textarea.closest('#new-TicketValidation-block') || textarea.id.includes('TicketValidation') || (textarea.name && textarea.name.includes('TicketValidation'))) {
      type = 'validation';
    }

    if (!type) return null;

    // 2. Comprobar si es un formulario de edición (posee un input 'id' numérico válido que no es el ticketId)
    if (form) {
      const idInput = form.querySelector('input[name="id"]');
      if (idInput) {
        const val = idInput.value;
        if (val && /^\d+$/.test(val) && val !== '0' && val !== ticketId) {
          itemId = val;
        }
      }
    }

    const baseKey = DRAFT_TYPES[type].storageKey + ticketId;
    const storageKey = itemId ? `${baseKey}_edit_${itemId}` : baseKey;

    return {
      type: type,
      itemId: itemId,
      storageKey: storageKey,
      label: DRAFT_TYPES[type].label + (itemId ? ` (Edición #${itemId})` : '')
    };
  }

  /**
   * Intenta localizar el botón de "Editar" para un elemento de la línea de tiempo de GLPI.
   */
  function findEditButton(type, itemId) {
    const selectors = [
      `[data-id="${itemId}"]`,
      `a[href*="id=${itemId}"]`,
      `a[href*="update=1"][href*="id=${itemId}"]`,
      `[href*="task"][href*="${itemId}"]`,
      `[href*="followup"][href*="${itemId}"]`,
      `[href*="solution"][href*="${itemId}"]`,
      `[href*="validation"][href*="${itemId}"]`
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = (el.textContent || el.title || '').toLowerCase();
        const isEdit = text.includes('edit') || text.includes('modificar') || text.includes('actualizar') || 
                       el.classList.contains('edit') || el.classList.contains('edit_button') ||
                       el.querySelector('.ti-pencil') || el.querySelector('.fa-pencil') || 
                       el.querySelector('.fa-edit') || el.querySelector('.ti-edit');
        if (isEdit || el.tagName === 'A' || el.tagName === 'BUTTON') {
          return el;
        }
      }
    }
    
    // Búsqueda genérica por ID
    const allLinks = document.querySelectorAll('a, button');
    for (const el of allLinks) {
      const href = el.getAttribute('href') || '';
      const onclick = el.getAttribute('onclick') || '';
      const dataTarget = el.getAttribute('data-bs-target') || '';
      
      if (href.includes(itemId) || onclick.includes(itemId) || dataTarget.includes(itemId)) {
        return el;
      }
    }
    
    return null;
  }

  // --- EDITOR DETECTION ---

  function startTinyMCEDetectionPolling(force = false) {
    if (isPolling && !force) return;
    
    // If forcing and already polling, clear previous first
    if (force && isPolling && window.__draft_saver_poll_interval) {
        clearInterval(window.__draft_saver_poll_interval);
    }

    isPolling = true;
    const pollingStartTime = Date.now();

    log('Polling for TinyMCE editors' + (force ? ' (Forced restart)' : '') + '...');

    const poll = setInterval(() => {
      window.__draft_saver_poll_interval = poll;

      // 1. Limpieza de editores que ya no están en el DOM o se han destruido
      for (const [key, data] of activeEditors.entries()) {
        if (data.editor.removed || !data.textarea || !document.body.contains(data.textarea)) {
          log(`Cleaning up removed editor: ${key}`);
          clearTimeout(data.debounceTimer);
          activeEditors.delete(key);
        }
      }

      // 2. Detección de nuevos editores activos en la página
      let foundAnyNew = false;
      const tinymce = window.tinymce;
      if (tinymce && typeof tinymce.get === 'function') {
        const editors = Object.values(tinymce.editors || {});
        for (let i = 0; i < editors.length; i++) {
          const editor = editors[i];
          if (!editor || editor.removed || typeof editor.getContent !== 'function' || typeof editor.save !== 'function') {
            continue;
          }

          const textarea = editor.getElement();
          if (!textarea || !textarea.id) continue;

          const config = getEditorConfig(textarea);
          if (!config) continue;

          if (!activeEditors.has(config.storageKey)) {
            log(`Success: Found ${config.label} editor [${textarea.id}].`);
            
            const editorData = {
              textarea: textarea,
              editor: editor,
              lastSavedContent: '',
              debounceTimer: null,
              type: config.type,
              itemId: config.itemId,
              storageKey: config.storageKey,
              label: config.label
            };
            activeEditors.set(config.storageKey, editorData);
            attachListeners(config.storageKey);
            foundAnyNew = true;
          }
        }
      }

      if (foundAnyNew) {
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

  function saveDraft(storageKey) {
    const data = activeEditors.get(storageKey);
    if (!ticketId || !data || !data.editor) return;

    try {
      data.editor.save();
      const currentHtml = data.editor.getContent();
      const plainText = htmlToPlainText(currentHtml);

      if (plainText.length >= MIN_CONTENT_LENGTH) {
        if (currentHtml !== data.lastSavedContent) {
          const draftData = {
            ticketId: ticketId,
            type: data.type,
            itemId: data.itemId,
            content: currentHtml,
            savedAt: new Date().toISOString()
          };
          
          localStorage.setItem(storageKey, JSON.stringify(draftData));
          data.lastSavedContent = currentHtml;
          showStatusToast(`Borrador de ${data.label} guardado`);
        }
      }
    } catch (e) {
      console.error(`[GLPI Draft Saver] Error during save (${storageKey}):`, e);
    }
  }

  function checkForAvailableDrafts() {
    try {
      // 1. Soporte para borrador heredado (legacy)
      const legacyKey = LEGACY_STORAGE_KEY_PREFIX + ticketId;
      const legacyDataRaw = localStorage.getItem(legacyKey);
      if (legacyDataRaw) {
        log('Found legacy task draft. Migrating...');
        const newKey = DRAFT_TYPES.task.storageKey + ticketId;
        localStorage.setItem(newKey, legacyDataRaw);
        localStorage.removeItem(legacyKey);
      }

      // 2. Escanear las claves de localStorage que empiecen con los prefijos configurados
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        for (const [type, config] of Object.entries(DRAFT_TYPES)) {
          if (key.startsWith(config.storageKey + ticketId)) {
            const rawData = localStorage.getItem(key);
            if (!rawData) continue;

            const draftData = JSON.parse(rawData);
            draftData.type = draftData.type || type;
            draftData.storageKey = key;

            // Omitir si ya tiene contenido en pantalla
            const existingEditor = activeEditors.get(key);
            if (existingEditor) {
              const plainText = htmlToPlainText(existingEditor.editor.getContent());
              if (plainText !== '') continue;
            }

            log(`Found draft for key ${key} from ${draftData.savedAt}. Showing prompt.`);
            showRestorePrompt(draftData);
          }
        }
      }
    } catch (e) { log('Draft check error:', e); }
  }

  /**
   * Logic to handle the 'Restore' button click.
   * Ensures the correct form block is visible by clicking the button, then restores content.
   */
  function handleRestoreAction(draftData) {
    // 1. Copiar al portapapeles por seguridad
    copyToClipboard(draftData.content).then(success => {
        if (success) {
            log('Backup copy to clipboard successful.');
        }
    });

    // 2. Intentar mostrar el formulario
    if (draftData.itemId) {
      // Si es edición de un elemento existente, buscar el botón en la línea de tiempo
      const editBtn = findEditButton(draftData.type, draftData.itemId);
      if (editBtn) {
        log(`Clicking edit button for item ${draftData.itemId}.`);
        editBtn.click();
      } else {
        log(`Could not find edit button for item ${draftData.itemId}.`);
      }
    } else {
      // Si es un borrador de nuevo elemento
      const config = DRAFT_TYPES[draftData.type];
      const btn = document.querySelector(config.buttonSelector);
      if (btn) {
          log(`Clicking ${draftData.type} button for visibility.`);
          btn.click();
      }
    }

    // 3. Forzar el polling para detectar el editor inmediatamente al cargarse
    startTinyMCEDetectionPolling(true);

    let attempts = 0;
    const maxAttempts = 8; // 4 segundos total (8 * 500ms)
    
    log(`Attempting to restore ${draftData.type} editor...`);
    
    const waitInterval = setInterval(() => {
        attempts++;
        const editorData = activeEditors.get(draftData.storageKey);
        
        if (editorData && editorData.editor) {
            const isReady = typeof editorData.editor.getContent === 'function' && 
                             !editorData.editor.removed;
            
            if (isReady) {
                clearInterval(waitInterval);
                performRestore(draftData);
                return;
            }
        }

        if (attempts >= maxAttempts) {
            clearInterval(waitInterval);
            log(`Could not restore automatically after ${attempts} attempts.`);
            showStatusToast(`Borrador copiado al portapapeles. Abre la edición para restaurar.`, 10000, 'warning-toast');
        }
    }, 500);
  }

  async function performRestore(draftData) {
    const data = activeEditors.get(draftData.storageKey);
    if (!data || !data.editor) return;
    
    log(`Performing restoration for ${draftData.type} (${draftData.storageKey})...`);
    try {
        const doRestore = () => {
            if (data.editor.removed) return;
            if (typeof data.editor.setContent !== 'function') return;

            if (typeof data.editor.focus === 'function') {
                data.editor.focus();
            }

            data.editor.setContent(draftData.content);
            data.editor.save();
            data.lastSavedContent = draftData.content;

            if (data.textarea) {
              data.textarea.dispatchEvent(new Event('input', { bubbles: true }));
              data.textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };

        setTimeout(() => {
            try {
                doRestore();
                
                setTimeout(() => {
                    const currentContent = data.editor.getContent();
                    if (currentContent.length < 5 && draftData.content.length > 10) {
                        log('Restoration seemed to fail (content empty). Retrying...');
                        doRestore();
                    }
                    
                    showStatusToast(`Borrador de ${data.label} restaurado`);
                }, 150);
            } catch (innerError) {
                log('Inner restoration error:', innerError);
                showStatusToast(`Error de GISE, mensaje copiado al portapapeles`, 15000, 'warning-toast');
            }
        }, 300);

    } catch (e) { 
        log('Restoration error:', e); 
        showStatusToast(`Error de GISE, mensaje copiado al portapapeles`, 15000, 'warning-toast');
    }
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
        try { localStorage.removeItem(draftData.storageKey); } catch (e) {}
        hideToast(toast);
    };
  }

  function showStatusToast(message, duration = TOAST_SUCCESS_MS, extraClass = 'status-toast') {
    if (!toastContainer) setupToastContainer();

    const toast = document.createElement('div');
    toast.className = `glpi-draft-saver-toast ${extraClass}`;
    toast.innerHTML = `<div>${message}</div>`;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        hideToast(toast);
    }, duration);
  }


  function hideToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }

  // --- LISTENERS & BACKUP ---

  function attachListeners(storageKey) {
    const data = activeEditors.get(storageKey);
    if (!data || !data.editor) return;

    const events = ['input', 'change', 'keyup', 'undo', 'redo'];
    events.forEach(eventType => {
      data.editor.off(eventType);
      data.editor.on(eventType, () => {
        clearTimeout(data.debounceTimer);
        data.debounceTimer = setTimeout(() => saveDraft(storageKey), DEBOUNCE_DELAY_MS);
      });
    });

    if (data.textarea) {
      const parentForm = data.textarea.closest('form');
      if (parentForm) {
        parentForm.addEventListener('submit', () => {
          log(`Form for ${data.label} submitted. Cleaning up draft.`);
          try {
            localStorage.removeItem(storageKey);
          } catch (e) {
            log(`Error cleaning up draft ${storageKey} on submit:`, e);
          }
        });
      }
    }
  }

  function startPeriodicBackup() {
    if (autosaveInterval) clearInterval(autosaveInterval);
    autosaveInterval = setInterval(() => {
        for (const storageKey of activeEditors.keys()) {
            saveDraft(storageKey);
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

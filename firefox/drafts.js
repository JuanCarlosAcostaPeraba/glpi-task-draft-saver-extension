document.addEventListener('DOMContentLoaded', () => {
  const draftsGrid = document.getElementById('drafts-grid');
  const searchInput = document.getElementById('search-input');
  const filterBtns = document.querySelectorAll('#filter-group .filter-btn');
  const draftsCount = document.getElementById('drafts-count');
  const cleanAllBtn = document.getElementById('clean-all-btn');
  const copyToast = document.getElementById('copy-toast');

  let allDrafts = [];
  let currentFilter = 'all';
  let searchQuery = '';

  // Theme Sync
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get({ theme: 'light' }, (items) => {
      document.documentElement.setAttribute('data-theme', items.theme);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.theme) {
        document.documentElement.setAttribute('data-theme', changes.theme.newValue);
      }
    });
  }

  // Load Drafts
  function loadDrafts() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        allDrafts = Object.entries(items)
          .filter(([key]) => key.startsWith('glpi_draft_'))
          .map(([key, value]) => ({
            key,
            ...value
          }))
          .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        renderDrafts();
      });
    }
  }

  // Strip HTML for preview
  function getPlainPreview(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  }

  // Type Translations & Icons
  const TYPE_CONFIG = {
    task: { label: 'Tarea', badgeClass: 'task' },
    followup: { label: 'Seguimiento', badgeClass: 'followup' },
    solution: { label: 'Solución', badgeClass: 'solution' },
    validation: { label: 'Validación', badgeClass: 'validation' }
  };

  // Toast feedback
  let toastTimer = null;
  function showToast(message) {
    copyToast.textContent = message;
    copyToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      copyToast.classList.remove('show');
    }, 2500);
  }

  // Copy Draft Content (Dual Rich Text + Plain Text)
  function copyDraft(draft) {
    const htmlContent = draft.content;
    const plainTextContent = getPlainPreview(htmlContent);

    try {
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([plainTextContent], { type: 'text/plain' });
      const data = [new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      })];
      
      navigator.clipboard.write(data).then(() => {
        showToast(`Borrador de ${TYPE_CONFIG[draft.type]?.label || draft.type} copiado`);
      }).catch(err => {
        // Fallback if ClipboardItem fails
        navigator.clipboard.writeText(plainTextContent).then(() => {
          showToast(`Borrador copiado como texto plano`);
        });
      });
    } catch (e) {
      // Fallback
      navigator.clipboard.writeText(plainTextContent).then(() => {
        showToast(`Borrador copiado`);
      });
    }
  }

  // Delete single draft
  function deleteDraft(key, event) {
    if (event) event.stopPropagation(); // Avoid triggering card click (copy)
    
    if (confirm('¿Estás seguro de que deseas eliminar este borrador?')) {
      chrome.storage.local.remove(key, () => {
        showToast('Borrador eliminado');
        loadDrafts();
      });
    }
  }

  // Render drafts cards
  function renderDrafts() {
    draftsGrid.innerHTML = '';
    
    const filtered = allDrafts.filter(draft => {
      const matchesFilter = currentFilter === 'all' || draft.type === currentFilter;
      const plainText = getPlainPreview(draft.content).toLowerCase();
      const matchesSearch = searchQuery === '' || 
                            String(draft.ticketId).includes(searchQuery) ||
                            (draft.itemId && String(draft.itemId).includes(searchQuery)) ||
                            plainText.includes(searchQuery) ||
                            (TYPE_CONFIG[draft.type]?.label || '').toLowerCase().includes(searchQuery);
      return matchesFilter && matchesSearch;
    });

    draftsCount.textContent = `${filtered.length} borrador${filtered.length === 1 ? '' : 'es'} encontrado${filtered.length === 1 ? '' : 's'}`;

    if (filtered.length === 0) {
      draftsGrid.innerHTML = `
        <div class="empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <h3>No hay borradores</h3>
          <p>No se encontraron borradores que coincidan con tu búsqueda o filtros.</p>
        </div>
      `;
      return;
    }

    filtered.forEach(draft => {
      const card = document.createElement('div');
      card.className = 'card';
      
      const config = TYPE_CONFIG[draft.type] || { label: draft.type, badgeClass: 'task' };
      const dateStr = new Date(draft.savedAt).toLocaleString();
      const plainText = getPlainPreview(draft.content);
      const ticketLabel = draft.itemId ? `Ticket #${draft.ticketId} (Edición #${draft.itemId})` : `Ticket #${draft.ticketId}`;
      const ticketUrl = draft.url || '#';

      card.innerHTML = `
        <div class="card-header">
          <span class="badge ${config.badgeClass}">${config.label}</span>
          <a href="${ticketUrl}" target="_blank" class="ticket-link">${ticketLabel}</a>
        </div>
        <div class="card-body">
          ${plainText}
        </div>
        <div class="card-footer">
          <span>Guardado: ${dateStr}</span>
          <button class="delete-btn" title="Eliminar borrador">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      `;

      // Copy on click card
      card.addEventListener('click', () => copyDraft(draft));
      
      // Prevent link click from copying
      card.querySelector('.ticket-link').addEventListener('click', (e) => e.stopPropagation());

      // Delete action
      card.querySelector('.delete-btn').addEventListener('click', (e) => deleteDraft(draft.key, e));

      draftsGrid.appendChild(card);
    });
  }

  // Search Listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderDrafts();
  });

  // Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderDrafts();
    });
  });

  // Clean All
  cleanAllBtn.addEventListener('click', () => {
    if (allDrafts.length === 0) return;
    if (confirm(`¿Estás seguro de que deseas eliminar los ${allDrafts.length} borradores actuales?`)) {
      const keysToRemove = allDrafts.map(d => d.key);
      chrome.storage.local.remove(keysToRemove, () => {
        showToast('Todos los borradores eliminados');
        loadDrafts();
      });
    }
  });

  // Initial Load
  loadDrafts();
});

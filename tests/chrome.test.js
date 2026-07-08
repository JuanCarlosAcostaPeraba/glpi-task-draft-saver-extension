/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://example.com/front/ticket.form.php?id=123"}
 */

describe('Chrome Extension - content.js', () => {
  let content;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    
    // Clear cache/require to clean up module state
    jest.resetModules();
    window.__GLPI_DRAFT_SAVER_ACTIVE__ = false;
    content = require('../chrome/content.js');
  });

  test('getValidatedTicketId parses ticket ID correctly', () => {
    expect(content.getValidatedTicketId()).toBe('123');
  });

  test('getEditorConfig identifies task new creation draft', () => {
    const form = document.createElement('form');
    const textarea = document.createElement('textarea');
    const itemtypeInput = document.createElement('input');
    itemtypeInput.name = 'itemtype';
    itemtypeInput.value = 'TicketTask';
    
    form.appendChild(textarea);
    form.appendChild(itemtypeInput);
    document.body.appendChild(form);

    const config = content.getEditorConfig(textarea);
    expect(config).not.toBeNull();
    expect(config.type).toBe('task');
    expect(config.itemId).toBeNull();
    expect(config.storageKey).toBe('glpi_draft_task_ticket_123');
  });

  test('getEditorConfig identifies followup edit draft', () => {
    const form = document.createElement('form');
    const textarea = document.createElement('textarea');
    const itemtypeInput = document.createElement('input');
    itemtypeInput.name = 'itemtype';
    itemtypeInput.value = 'ITILFollowup';
    const idInput = document.createElement('input');
    idInput.name = 'id';
    idInput.value = '789';
    
    form.appendChild(textarea);
    form.appendChild(itemtypeInput);
    form.appendChild(idInput);
    document.body.appendChild(form);

    const config = content.getEditorConfig(textarea);
    expect(config).not.toBeNull();
    expect(config.type).toBe('followup');
    expect(config.itemId).toBe('789');
    expect(config.storageKey).toBe('glpi_draft_followup_ticket_123_edit_789');
  });

  test('findEditButton finds edit button by data-id attribute', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-id', '456');
    btn.textContent = 'Editar';
    document.body.appendChild(btn);

    const found = content.findEditButton('task', '456');
    expect(found).toBe(btn);
  });
});

describe('Chrome Extension - bridge.js', () => {
  let bridge;

  beforeEach(() => {
    document.documentElement.removeAttribute('data-glpi-draft-saver-pos');
    document.documentElement.removeAttribute('data-glpi-draft-saver-theme');
    jest.resetModules();
    bridge = require('../chrome/bridge.js');
  });

  test('updateDOMAttributes updates HTML attributes correctly', () => {
    bridge.updateDOMAttributes({
      toastPosition: 'top-left',
      theme: 'dark'
    });
    expect(document.documentElement.getAttribute('data-glpi-draft-saver-pos')).toBe('top-left');
    expect(document.documentElement.getAttribute('data-glpi-draft-saver-theme')).toBe('dark');
  });
});

/**
 * Bridge script running in ISOLATED world.
 * Synchronizes chrome.storage to the MAIN world via DOM attributes.
 */

(function() {
    'use strict';

    function updateDOMAttributes(items) {
        if (items.toastPosition) {
            document.documentElement.setAttribute('data-glpi-draft-saver-pos', items.toastPosition);
        }
        if (items.theme) {
            document.documentElement.setAttribute('data-glpi-draft-saver-theme', items.theme);
        }
    }

    // 1. Initial Load
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({
            toastPosition: 'bottom-right',
            theme: 'light'
        }, (items) => {
            updateDOMAttributes(items);
        });
    }

    // 2. Listen for changes
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync') {
                const newValues = {};
                for (let [key, { newValue }] of Object.entries(changes)) {
                    newValues[key] = newValue;
                }
                updateDOMAttributes(newValues);
            }
        });
    }

    // 3. Listen to events from MAIN world to sync drafts to chrome.storage.local
    document.addEventListener('GLPIDraftSaverSave', (e) => {
        const { key, data } = e.detail;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [key]: data });
        }
    });

    document.addEventListener('GLPIDraftSaverDelete', (e) => {
        const { key } = e.detail;
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(key);
        }
    });

    // 4. Listen to changes in chrome.storage.local (to sync deletion from visualizer back to MAIN world)
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local') {
                for (let [key, { newValue }] of Object.entries(changes)) {
                    if (key.startsWith('glpi_draft_') && !newValue) {
                        // Key was removed! Dispatch event to main world
                        document.dispatchEvent(new CustomEvent('GLPIDraftSaverRemoveLocal', {
                            detail: { key }
                        }));
                    }
                }
            }
        });
    }

    // Export functions for unit testing in Node environment
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { updateDOMAttributes };
    }

})();



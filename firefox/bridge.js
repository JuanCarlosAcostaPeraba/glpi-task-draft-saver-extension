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

    // Export functions for unit testing in Node environment
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { updateDOMAttributes };
    }

})();



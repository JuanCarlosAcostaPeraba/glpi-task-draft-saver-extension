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
        if (items.pluginEnabled !== undefined) {
            document.documentElement.setAttribute('data-glpi-draft-saver-enabled', items.pluginEnabled);
        }
        if (items.theme) {
            document.documentElement.setAttribute('data-glpi-draft-saver-theme', items.theme);
        }
    }

    // 1. Initial Load
    chrome.storage.sync.get({
        toastPosition: 'bottom-right',
        pluginEnabled: true,
        theme: 'light'
    }, (items) => {
        updateDOMAttributes(items);
    });

    // 2. Listen for changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
            const newValues = {};
            for (let [key, { newValue }] of Object.entries(changes)) {
                newValues[key] = newValue;
            }
            updateDOMAttributes(newValues);
        }
    });

})();


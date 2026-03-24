/**
 * Bridge script running in ISOLATED world.
 * Synchronizes chrome.storage to the MAIN world via DOM attributes.
 */

(function() {
    'use strict';

    function updateDOMAttribute(position) {
        if (position) {
            document.documentElement.setAttribute('data-glpi-draft-saver-pos', position);
            // console.log('[Bridge] DOM Attribute updated:', position);
        }
    }

    // 1. Initial Load
    chrome.storage.sync.get({
        toastPosition: 'bottom-right'
    }, (items) => {
        updateDOMAttribute(items.toastPosition);
    });

    // 2. Listen for changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (changes.toastPosition)) {
            updateDOMAttribute(changes.toastPosition.newValue);
        }
    });

})();

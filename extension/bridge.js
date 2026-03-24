/**
 * Bridge script running in ISOLATED world.
 * Synchronizes chrome.storage to the MAIN world via window.postMessage.
 */

(function() {
    'use strict';

    function sendConfigToMainWorld(config) {
        window.postMessage({
            source: 'glpi-draft-saver-bridge',
            type: 'config-updated',
            config: config
        }, '*');
        // console.log('[Bridge] Config posted to MAIN world:', config);
    }

    // 1. Initial Load
    chrome.storage.sync.get({
        toastPosition: 'bottom-right'
    }, (items) => {
        sendConfigToMainWorld(items);
    });

    // 2. Listen for changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && (changes.toastPosition)) {
            chrome.storage.sync.get({
                toastPosition: 'bottom-right'
            }, (items) => {
                sendConfigToMainWorld(items);
            });
        }
    });

    // 3. Listen for requests from MAIN world
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'glpi-draft-saver-content' && event.data.type === 'request-config') {
            chrome.storage.sync.get({
                toastPosition: 'bottom-right'
            }, (items) => {
                sendConfigToMainWorld(items);
            });
        }
    });

})();

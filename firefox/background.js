// Auto-updater script for Unpacked Extensions on Network Drives
const ALARM_NAME = 'check_update_alarm';

// We check every 2 days by default (in minutes). 
// Note: Checking more frequently (like every day) is technically "free" in performance 
// since it just reads a local text file, which guarantees technicians get hotfixes quickly.
const CHECK_PERIOD_MINUTES = 60 * 24 * 2; // 2 Days

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
  checkForUpdate(); // Also check once Chrome boots up
});

function setupAlarm() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: CHECK_PERIOD_MINUTES
      });
    }
  });
}

// Listen to the alarm to trigger the check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForUpdate();
  }
});

// Checks the physical disk manifest.json file to see if the version changed
async function checkForUpdate() {
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    // We add a timestamp variable `?t=` to bypass Chrome's internal cache and force it 
    // to read the file literally from the network folder (\\ruta)
    const url = chrome.runtime.getURL('manifest.json') + '?t=' + Date.now();
    
    const response = await fetch(url);
    if (response.ok) {
      const liveManifest = await response.json();
      const liveVersion = liveManifest.version;
      
      // If the version on the network share differs from the loaded memory version, reload!
      if (liveVersion && liveVersion !== currentVersion) {
        console.log(`Update detected: replacing ${currentVersion} with ${liveVersion}. Reloading extension...`);
        chrome.runtime.reload();
      }
    }
  } catch (err) {
    console.error('Failed to check for draft saver update:', err);
  }
}

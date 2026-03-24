document.addEventListener('DOMContentLoaded', () => {
  const pluginEnabledToggle = document.getElementById('plugin-enabled');
  const themeModeToggle = document.getElementById('theme-mode');
  const positionSelect = document.getElementById('toast-position');
  const status = document.getElementById('status');

  function showStatus() {
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 1500);
  }

  function applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  // Load current settings
  chrome.storage.sync.get({
    toastPosition: 'bottom-right',
    pluginEnabled: true,
    theme: 'light'
  }, (items) => {
    positionSelect.value = items.toastPosition;
    pluginEnabledToggle.checked = items.pluginEnabled;
    themeModeToggle.checked = items.theme === 'dark';
    applyTheme(items.theme === 'dark');
  });

  // Save Position
  positionSelect.addEventListener('change', () => {
    chrome.storage.sync.set({
      toastPosition: positionSelect.value
    }, showStatus);
  });

  // Save Enabled State
  pluginEnabledToggle.addEventListener('change', () => {
    chrome.storage.sync.set({
      pluginEnabled: pluginEnabledToggle.checked
    }, showStatus);
  });

  // Save Theme
  themeModeToggle.addEventListener('change', () => {
    const theme = themeModeToggle.checked ? 'dark' : 'light';
    applyTheme(themeModeToggle.checked);
    chrome.storage.sync.set({
      theme: theme
    }, showStatus);
  });
});


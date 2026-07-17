document.addEventListener('DOMContentLoaded', () => {
  const themeModeToggle = document.getElementById('theme-mode');
  const status = document.getElementById('status');
  const positionBtns = document.querySelectorAll('.pos-btn');
  const positionLabel = document.getElementById('position-label');

  // Set extension version automatically
  const versionElement = document.getElementById('app-version');
  if (versionElement && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    versionElement.textContent = manifest.version;
  }

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

  function updateActivePosition(posValue) {
    positionBtns.forEach(btn => {
      if (btn.dataset.value === posValue) {
        btn.classList.add('active');
        if (positionLabel) positionLabel.textContent = btn.title;
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Load current settings
  chrome.storage.sync.get({
    toastPosition: 'bottom-right',
    theme: 'light'
  }, (items) => {
    updateActivePosition(items.toastPosition);
    themeModeToggle.checked = items.theme === 'dark';
    applyTheme(items.theme === 'dark');
  });

  // Save Position
  positionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const newPos = btn.dataset.value;
      updateActivePosition(newPos);
      chrome.storage.sync.set({
        toastPosition: newPos
      }, showStatus);
    });
  });

  // Save Theme
  themeModeToggle.addEventListener('change', () => {
    const theme = themeModeToggle.checked ? 'dark' : 'light';
    applyTheme(themeModeToggle.checked);
    chrome.storage.sync.set({
      theme: theme
    }, showStatus);
  });

  // Open Drafts Visualizer
  const openDraftsBtn = document.getElementById('open-drafts-btn');
  if (openDraftsBtn) {
    openDraftsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'drafts.html' });
    });
  }
});



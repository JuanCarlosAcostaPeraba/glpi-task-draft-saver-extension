document.addEventListener('DOMContentLoaded', () => {
  const positionSelect = document.getElementById('toast-position');
  const status = document.getElementById('status');

  // Load current setting
  chrome.storage.sync.get({
    toastPosition: 'bottom-right'
  }, (items) => {
    positionSelect.value = items.toastPosition;
  });

  // Save on change
  positionSelect.addEventListener('change', () => {
    const position = positionSelect.value;
    chrome.storage.sync.set({
      toastPosition: position
    }, () => {
      // Show stats briefly
      status.style.display = 'block';
      setTimeout(() => {
        status.style.display = 'none';
      }, 1500);
    });
  });
});

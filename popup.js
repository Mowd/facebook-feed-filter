(function() {
  'use strict';

  const SETTING_KEY = 'filterEnabled';
  const toggle = document.getElementById('filter-toggle');
  const status = document.getElementById('filter-status');

  function getMessage(key, fallback) {
    return browser.i18n.getMessage(key) || fallback;
  }

  function localizePage() {
    document.documentElement.lang = browser.i18n.getUILanguage();

    document.querySelectorAll('[data-i18n]').forEach(element => {
      const message = browser.i18n.getMessage(element.dataset.i18n);
      if (message) {
        element.textContent = message;
      }
    });
  }

  function render(enabled) {
    toggle.checked = enabled;
    document.documentElement.dataset.enabled = String(enabled);
    status.textContent = enabled
      ? getMessage('popupStatusEnabled', 'Enabled')
      : getMessage('popupStatusPaused', 'Paused');
  }

  function showError() {
    status.textContent = getMessage('popupError', 'Could not save the setting');
  }

  localizePage();
  toggle.disabled = true;

  browser.storage.local.get({ [SETTING_KEY]: true }).then(settings => {
    render(settings[SETTING_KEY] !== false);
    toggle.disabled = false;
  }, () => {
    render(true);
    showError();
  });

  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    render(enabled);
    toggle.disabled = true;

    browser.storage.local.set({ [SETTING_KEY]: enabled }).then(() => {
      toggle.disabled = false;
    }, () => {
      render(!enabled);
      toggle.disabled = false;
      showError();
    });
  });
})();

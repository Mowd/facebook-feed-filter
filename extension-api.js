(function(global) {
  'use strict';

  const browserApi = global.browser;
  const chromeApi = global.chrome;
  const nativeApi = browserApi || chromeApi;

  if (!nativeApi) {
    return;
  }

  function chromeLastError() {
    return chromeApi && chromeApi.runtime && chromeApi.runtime.lastError;
  }

  function localGet(defaults) {
    if (browserApi) {
      return browserApi.storage.local.get(defaults);
    }

    return new Promise((resolve, reject) => {
      chromeApi.storage.local.get(defaults, values => {
        const error = chromeLastError();
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(values);
      });
    });
  }

  function localSet(values) {
    if (browserApi) {
      return browserApi.storage.local.set(values);
    }

    return new Promise((resolve, reject) => {
      chromeApi.storage.local.set(values, () => {
        const error = chromeLastError();
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      });
    });
  }

  const extensionApi = Object.freeze({
    i18n: Object.freeze({
      getMessage(key) {
        return nativeApi.i18n.getMessage(key);
      },
      getUILanguage() {
        return nativeApi.i18n.getUILanguage();
      }
    }),
    storage: Object.freeze({
      local: Object.freeze({
        get: localGet,
        set: localSet
      }),
      onChanged: Object.freeze({
        addListener(listener) {
          nativeApi.storage.onChanged.addListener(listener);
        }
      })
    })
  });

  Object.defineProperty(global, 'FBFeedFilterExtensionApi', {
    configurable: false,
    enumerable: false,
    value: extensionApi,
    writable: false
  });
})(globalThis);

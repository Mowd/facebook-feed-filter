import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { buildManifest } from './build-manifest.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredPopupMessages = [
  'popupTitle',
  'popupSubtitle',
  'popupToggleLabel',
  'popupStatusEnabled',
  'popupStatusPaused',
  'popupScope',
  'popupError'
];

function validateManifests() {
  const firefox = buildManifest('firefox');
  const chrome = buildManifest('chrome');

  assert.equal(firefox.manifest_version, 2);
  assert.equal(chrome.manifest_version, 3);
  assert.equal(chrome.version, firefox.version);
  assert.equal(chrome.name, firefox.name);
  assert.equal(chrome.action.default_popup, 'popup.html');
  assert.equal(chrome.browser_action, undefined);
  assert.equal(chrome.browser_specific_settings, undefined);
  assert.deepEqual(chrome.permissions, ['storage']);
  assert.deepEqual(
    chrome.content_scripts[0].matches,
    ['https://www.facebook.com/*']
  );
  assert.deepEqual(
    chrome.content_scripts[0].js,
    ['extension-api.js', 'content.js']
  );

  Object.values(chrome.icons).forEach(iconPath => {
    assert.match(iconPath, /\.png$/);
    assert.ok(fs.existsSync(path.join(rootDir, iconPath)), `${iconPath} is missing`);
  });
}

function validateLocales() {
  const localesDir = path.join(rootDir, '_locales');
  const locales = fs.readdirSync(localesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  assert.ok(locales.length > 0);

  locales.forEach(locale => {
    const messagesPath = path.join(localesDir, locale, 'messages.json');
    const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));

    requiredPopupMessages.forEach(key => {
      assert.equal(typeof messages[key]?.message, 'string', `${locale}: ${key}`);
      assert.notEqual(messages[key].message.trim(), '', `${locale}: ${key}`);
    });
  });
}

function validatePopupAssets() {
  const popupPath = path.join(rootDir, 'popup.html');
  const popup = fs.readFileSync(popupPath, 'utf8');
  const imageSources = Array.from(
    popup.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g),
    match => match[1]
  );

  assert.ok(imageSources.length > 0, 'popup.html must include a brand image');

  imageSources.forEach(imagePath => {
    assert.ok(
      fs.existsSync(path.join(rootDir, imagePath)),
      `Popup image is missing: ${imagePath}`
    );
  });
}

async function loadAdapter(contextValues) {
  const source = fs.readFileSync(path.join(rootDir, 'extension-api.js'), 'utf8');
  const context = vm.createContext(contextValues);
  vm.runInContext(source, context, { filename: 'extension-api.js' });
  return context.FBFeedFilterExtensionApi;
}

async function validateFirefoxAdapter() {
  let storedValue;
  let changeListener;
  const api = await loadAdapter({
    browser: {
      i18n: {
        getMessage: key => `firefox:${key}`,
        getUILanguage: () => 'zh-TW'
      },
      storage: {
        local: {
          get: async defaults => defaults,
          set: async values => {
            storedValue = values;
          }
        },
        onChanged: {
          addListener: listener => {
            changeListener = listener;
          }
        }
      }
    }
  });

  assert.equal(api.i18n.getMessage('title'), 'firefox:title');
  assert.equal(api.i18n.getUILanguage(), 'zh-TW');
  assert.equal((await api.storage.local.get({ enabled: true })).enabled, true);
  await api.storage.local.set({ enabled: false });
  assert.equal(storedValue.enabled, false);
  api.storage.onChanged.addListener(() => {});
  assert.equal(typeof changeListener, 'function');
}

async function validateChromeAdapter() {
  let storedValue;
  let changeListener;
  const chrome = {
    i18n: {
      getMessage: key => `chrome:${key}`,
      getUILanguage: () => 'en-US'
    },
    runtime: {
      lastError: null
    },
    storage: {
      local: {
        get: (defaults, callback) => callback(defaults),
        set: (values, callback) => {
          storedValue = values;
          callback();
        }
      },
      onChanged: {
        addListener: listener => {
          changeListener = listener;
        }
      }
    }
  };
  const api = await loadAdapter({ chrome });

  assert.equal(api.i18n.getMessage('title'), 'chrome:title');
  assert.equal(api.i18n.getUILanguage(), 'en-US');
  assert.equal((await api.storage.local.get({ enabled: true })).enabled, true);
  await api.storage.local.set({ enabled: false });
  assert.equal(storedValue.enabled, false);
  api.storage.onChanged.addListener(() => {});
  assert.equal(typeof changeListener, 'function');
}

validateManifests();
validateLocales();
validatePopupAssets();
await validateFirefoxAdapter();
await validateChromeAdapter();

console.log('Validated manifests, popup assets, locales, and shared APIs.');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '..');
const sourceManifestPath = path.join(rootDir, 'manifest.json');

const chromeIcons = {
  16: 'icons/icon-16.png',
  32: 'icons/icon-32.png',
  48: 'icons/icon-48.png',
  128: 'icons/icon-128.png'
};

function readSourceManifest() {
  return JSON.parse(fs.readFileSync(sourceManifestPath, 'utf8'));
}

export function buildManifest(target) {
  const manifest = readSourceManifest();

  if (target === 'firefox') {
    return manifest;
  }

  if (target !== 'chrome') {
    throw new Error(`Unsupported browser target: ${target}`);
  }

  manifest.manifest_version = 3;
  manifest.minimum_chrome_version = '105';
  manifest.icons = chromeIcons;
  manifest.action = {
    default_icon: chromeIcons,
    default_title: manifest.browser_action.default_title,
    default_popup: manifest.browser_action.default_popup
  };
  manifest.permissions = manifest.permissions.filter(
    permission => !permission.includes('://')
  );
  manifest.content_scripts = manifest.content_scripts.map(contentScript => ({
    ...contentScript,
    matches: ['https://www.facebook.com/*']
  }));

  delete manifest.browser_action;
  delete manifest.browser_specific_settings;

  return manifest;
}

function writeManifest(target, outputPath) {
  const manifest = buildManifest(target);
  const resolvedOutputPath = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (isMain) {
  const [target, outputPath] = process.argv.slice(2);

  if (!target || !outputPath) {
    console.error('Usage: node scripts/build-manifest.mjs <firefox|chrome> <output>');
    process.exit(1);
  }

  writeManifest(target, outputPath);
}

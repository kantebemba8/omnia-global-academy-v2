import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const androidSha = String(args.get('--android-sha256') || '').trim().toUpperCase();
const appleTeam = String(args.get('--apple-team-id') || '').trim().toUpperCase();
if (!androidSha && !appleTeam) {
  console.error('Indiquez --android-sha256 ou --apple-team-id.');
  process.exit(1);
}
const publicWellKnown = join(root, 'public', '.well-known');
mkdirSync(publicWellKnown, { recursive: true });
if (androidSha) {
  if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(androidSha)) throw new Error('Empreinte Android SHA-256 invalide.');
  const template = readFileSync(join(root, 'resources', 'mobile-links', 'assetlinks.template.json'), 'utf8');
  writeFileSync(join(publicWellKnown, 'assetlinks.json'), template.replace('__ANDROID_SHA256__', androidSha), 'utf8');
  console.log('assetlinks.json généré. Déployez ensuite le site web.');
}
if (appleTeam) {
  if (!/^[A-Z0-9]{10}$/.test(appleTeam)) throw new Error('Apple Team ID invalide.');
  const template = readFileSync(join(root, 'resources', 'mobile-links', 'apple-app-site-association.template.json'), 'utf8');
  writeFileSync(join(publicWellKnown, 'apple-app-site-association'), template.replaceAll('__APPLE_TEAM_ID__', appleTeam), 'utf8');
  console.log('apple-app-site-association généré. Déployez ensuite le site web.');
}

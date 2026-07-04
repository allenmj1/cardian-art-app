/**
 * Shared version helpers for Cardian Sprite Studio desktop releases.
 * Every packaged release must ship a version strictly greater than the previous one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, '..');
export const appDir = path.join(root, 'desktop-app');
const pkgPath = path.join(appDir, 'package.json');
const lockPath = path.join(appDir, 'package-lock.json');
const GITHUB_REPO = 'allenmj1/cardian-art-app';

export function parseVersion(v) {
  return String(v)
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .filter(Boolean)
    .map((n) => parseInt(n, 10) || 0);
}

/** True if `a` is strictly greater than `b` (semver-ish major.minor.patch). */
export function isNewerVersion(a, b) {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    const x = left[i] || 0;
    const y = right[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export function maxVersion(a, b) {
  return isNewerVersion(a, b) ? a : b;
}

export function bumpPatch(version) {
  const parts = parseVersion(version);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

export function getPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  return String(pkg.version || '0.0.0').replace(/^v/i, '');
}

export function setPackageVersion(version) {
  const clean = String(version).replace(/^v/i, '');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = clean;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = clean;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = clean;
    }
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  }

  return clean;
}

export function getLatestGitTagVersion() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return tag.replace(/^v/i, '') || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function getLatestRemoteReleaseVersion() {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'CardianCardArtStudio-Release' },
    });
    if (!res.ok) return '0.0.0';
    const data = await res.json();
    return String(data.tag_name || '').replace(/^v/i, '') || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function getLatestPublishedVersion() {
  const localTag = getLatestGitTagVersion();
  const remote = await getLatestRemoteReleaseVersion();
  return maxVersion(localTag, remote);
}

/**
 * Ensure package.json version increases for this release build.
 * - DESKTOP_VERSION=1.4.0 forces that version (must be > latest published)
 * - otherwise always increments the patch (and keeps going until > latest published)
 */
export async function ensureReleaseVersionIncreased() {
  const latestPublished = await getLatestPublishedVersion();
  const current = getPackageVersion();
  let version = process.env.DESKTOP_VERSION
    ? String(process.env.DESKTOP_VERSION).replace(/^v/i, '')
    : bumpPatch(current);

  if (process.env.DESKTOP_VERSION && !isNewerVersion(version, latestPublished)) {
    throw new Error(
      `DESKTOP_VERSION=${version} must be greater than latest published v${latestPublished}`,
    );
  }

  while (!isNewerVersion(version, latestPublished)) {
    version = bumpPatch(version);
  }

  setPackageVersion(version);
  console.log(`Desktop version: ${current} → ${version} (latest published v${latestPublished})`);
  return version;
}

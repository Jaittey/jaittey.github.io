import { GOOGLE_CLIENT_ID } from '../config/firebase';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
let accessToken = '';
let expiresAt = 0;

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Google Identity Services.'));
    document.head.appendChild(script);
  });
}

export async function requestDriveAccess() {
  if (!GOOGLE_CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.');
  if (accessToken && Date.now() < expiresAt - 60_000) return accessToken;
  await loadScript();

  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        accessToken = response.access_token;
        expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
        resolve(accessToken);
      },
      error_callback: (error) => reject(new Error(error?.message || 'Google Drive authorization failed.')),
    });
    client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function driveFetch(url, options = {}) {
  const token = await requestDriveAccess();
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Google Drive request failed (${response.status}).`);
  }
  return response.json();
}

async function findFolder(name, parentId = null) {
  const escaped = name.replaceAll("'", "\\'");
  const clauses = [
    `name = '${escaped}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ];
  if (parentId) clauses.push(`'${parentId}' in parents`);
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    fields: 'files(id,name)',
    pageSize: '10',
  });
  const result = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  return result.files?.[0] || null;
}

async function createFolder(name, parentId = null) {
  return driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
}

async function getOrCreateFolder(name, parentId = null) {
  return (await findFolder(name, parentId)) || createFolder(name, parentId);
}

async function uploadBlob(blob, fileName, parentId) {
  const token = await requestDriveAccess();
  const boundary = `df7_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'Could not upload the PDF to Google Drive.');
  }
  return response.json();
}

export async function uploadBusinessPdf(blob, fileName, category, rootName = 'DF7 Business') {
  const root = await getOrCreateFolder(rootName);
  const categoryFolder = await getOrCreateFolder(category, root.id);
  const yearFolder = await getOrCreateFolder(String(new Date().getFullYear()), categoryFolder.id);
  return uploadBlob(blob, fileName, yearFolder.id);
}

export function disconnectDrive() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = '';
  expiresAt = 0;
}

export const isDriveConnected = () => Boolean(accessToken && Date.now() < expiresAt);

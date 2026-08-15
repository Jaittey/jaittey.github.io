import { GOOGLE_CLIENT_ID } from '../config/supabase';

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
    const error = new Error(body?.error?.message || `Google Drive request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function findFolder(name, parentId = null) {
  const escaped = name.replaceAll("'", "\\'");
  const clauses = [`name = '${escaped}'`, "mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
  if (parentId) clauses.push(`'${parentId}' in parents`);
  const params = new URLSearchParams({ q: clauses.join(' and '), spaces: 'drive', fields: 'files(id,name)', pageSize: '10' });
  const result = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  return result.files?.[0] || null;
}

async function createFolder(name, parentId = null) {
  return driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }),
  });
}

async function getOrCreateFolder(name, parentId = null) {
  return (await findFolder(name, parentId)) || createFolder(name, parentId);
}

function multipartBody(blob, metadata) {
  const boundary = `df7_${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });
  return { boundary, body };
}

async function createPdfFile(blob, fileName, parentId) {
  const token = await requestDriveAccess();
  const { boundary, body } = multipartBody(blob, { name: fileName, parents: [parentId] });
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'Could not upload the PDF to Google Drive.');
  }
  return response.json();
}

async function replacePdfFile(blob, fileName, fileId) {
  const token = await requestDriveAccess();
  const { boundary, body } = multipartBody(blob, { name: fileName });
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error?.message || 'Could not replace the existing PDF on Google Drive.');
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function uploadBusinessPdf(blob, fileName, category, rootName = 'Small Business', existingFileId = '', folderOptions = {}) {
  // Existing document: replace the same Drive file instead of creating duplicates.
  if (existingFileId) {
    try {
      const updated = await replacePdfFile(blob, fileName, existingFileId);
      return { ...updated, replaced: true };
    } catch (error) {
      // If the old Drive file was deleted or is no longer available, create a new one.
      if (![403, 404].includes(error.status)) throw error;
    }
  }

  const root = await getOrCreateFolder(rootName || 'Small Business');
  const categoryFolder = await getOrCreateFolder(category, root.id);
  const folderYear = String(folderOptions.year || new Date().getFullYear());
  let targetFolder = await getOrCreateFolder(folderYear, categoryFolder.id);
  for (const folderName of folderOptions.subfolders || []) {
    if (folderName) targetFolder = await getOrCreateFolder(folderName, targetFolder.id);
  }
  const created = await createPdfFile(blob, fileName, targetFolder.id);
  return { ...created, replaced: false };
}

export async function uploadMultipleBusinessPdfs(files) {
  const results = [];
  for (const file of files) {
    results.push(await uploadBusinessPdf(file.blob, file.fileName, file.category, file.rootName, file.existingFileId));
  }
  return results;
}

export function disconnectDrive() {
  if (accessToken && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(accessToken, () => {});
  accessToken = '';
  expiresAt = 0;
}

export const isDriveConnected = () => Boolean(accessToken && Date.now() < expiresAt);


// ---------------------------------------------------------------------
// SB v2.1.8 Google Drive JSON backup helpers
// ---------------------------------------------------------------------
function multipartFileBody(blob, metadata, mimeType) {
  const boundary = `df7_${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });
  return { boundary, body };
}

async function createDriveFile(blob, metadata, mimeType) {
  const token = await requestDriveAccess();
  const { boundary, body } = multipartFileBody(blob, metadata, mimeType);
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,createdTime,modifiedTime,size,mimeType',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'Could not upload the backup to Google Drive.');
  }
  return response.json();
}

async function listFilesInFolder(parentId, mimeType = '') {
  const clauses = [`'${parentId}' in parents`, 'trashed = false'];
  if (mimeType) clauses.push(`mimeType = '${mimeType}'`);
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    spaces: 'drive',
    fields: 'files(id,name,webViewLink,createdTime,modifiedTime,size,mimeType)',
    orderBy: 'createdTime desc',
    pageSize: '100',
  });
  const result = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  return result.files || [];
}

const backupFileName = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return `SB_Backup_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.json`;
};

export async function uploadBusinessBackup(backup, rootName = 'Small Business') {
  const root = await getOrCreateFolder(rootName || 'Small Business');
  const backupsFolder = await getOrCreateFolder('Backups', root.id);
  const content = JSON.stringify(backup, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  return createDriveFile(
    blob,
    {
      name: backupFileName(new Date(backup.createdAt || Date.now())),
      parents: [backupsFolder.id],
      description: `Small Business backup ${backup.appVersion || ''}`.trim(),
    },
    'application/json',
  );
}

export async function listBusinessBackups(rootName = 'Small Business') {
  const root = await findFolder(rootName || 'Small Business');
  if (!root) return [];
  const backupsFolder = await findFolder('Backups', root.id);
  if (!backupsFolder) return [];
  return listFilesInFolder(backupsFolder.id, 'application/json');
}

// Migration helper: drive.file can list files previously created by this same app/OAuth client,
// even when an older Firebase deployment used a different business-root folder name.
export async function listAccessibleBusinessBackups() {
  const params = new URLSearchParams({
    q: "mimeType = 'application/json' and trashed = false and (name contains 'SB_Backup_' or name contains 'DF7_Backup_')",
    spaces: 'drive',
    fields: 'files(id,name,webViewLink,createdTime,modifiedTime,size,mimeType,parents)',
    orderBy: 'createdTime desc',
    pageSize: '100',
  });
  const result = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  return result.files || [];
}

export async function downloadBusinessBackup(fileId) {
  if (!fileId) throw new Error('Select a Google Drive backup.');
  const token = await requestDriveAccess();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || 'Could not download the selected backup.');
  }
  const backup = await response.json();
  const supported = [
    'SB_SUPABASE_TENANT_BACKUP_V3',
    'DF7_BUSINESS_TENANT_BACKUP_V2',
    'SB_BUSINESS_TENANT_BACKUP_V2',
  ];
  if (!backup || !supported.includes(backup.format) || !backup.collections) {
    throw new Error('The selected file is not a supported Small Business backup.');
  }
  return backup;
}

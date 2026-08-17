import { useEffect, useState } from 'react';
import { hasPlatinum } from '../config/plans';
import { compressImageFile } from '../utils/images';
import {
  createApplicationBackup,
  deleteCompanyAsset,
  resetApplicationData,
  restoreApplicationBackup,
  saveBusinessSettings,
  saveCompanyAsset,
} from '../services/database';
import {
  downloadBusinessBackup,
  listAccessibleBusinessBackups,
  listBusinessBackups,
  requestDriveAccess,
  uploadBusinessBackup,
} from '../services/drive';

const ASSET_CONFIG = [
  {
    id: 'companyLogo',
    field: 'companyLogoDataUrl',
    title: 'Company Logo',
    description: 'Used in the app header, invoices, quotations, salary slips and reports.',
    accept: 'image/png,image/jpeg,image/webp',
    maxWidth: 1300,
    maxHeight: 650,
  },
  {
    id: 'companyStamp',
    field: 'companyStampDataUrl',
    title: 'Company Stamp',
    description: 'Displayed beside authorized signature areas on generated documents.',
    accept: 'image/png,image/webp,image/jpeg',
    maxWidth: 800,
    maxHeight: 800,
  },
  {
    id: 'managerSignature',
    field: 'managerSignatureDataUrl',
    title: 'Manager Signature',
    description: 'Displayed above the manager or authorized-signature line.',
    accept: 'image/png,image/webp,image/jpeg',
    maxWidth: 1100,
    maxHeight: 450,
  },
];

const formatBytes = (value = 0) => {
  if (!value) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
};

const formatBackupDate = (value) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US');
};

export default function Settings({
  settings,
  companyAssets,
  notify,
  driveConnected,
  markDriveConnected,
  planId,
}) {
  const [form, setForm] = useState(settings);
  const [tab, setTab] = useState('company');
  const [assetBusy, setAssetBusy] = useState('');
  const [backupBusy, setBackupBusy] = useState('');
  const [backups, setBackups] = useState([]);
  const [restoreCandidate, setRestoreCandidate] = useState(null);
  const [restorePhrase, setRestorePhrase] = useState('');
  const [resetPhrase, setResetPhrase] = useState('');

  useEffect(() => setForm(settings), [settings]);

  const rootFolder = form.driveRootFolder || settings.driveRootFolder || 'Small Business';

  const save = async () => {
    try {
      await saveBusinessSettings({
        ...form,
        defaultGstRate: Number(form.defaultGstRate || 0),
        defaultDiscountRate: Number(form.defaultDiscountRate || 0),
        quotationValidityDays: Number(form.quotationValidityDays || 0),
        gstRegistered: Boolean(form.gstRegistered),
      });
      notify('Company and system settings saved.');
    } catch (reason) {
      notify(reason?.message || 'Could not save settings.', 'error');
    }
  };

  const uploadAsset = async (asset, file) => {
    if (!file) return;
    setAssetBusy(asset.id);
    try {
      const optimized = await compressImageFile(file, {
        maxWidth: asset.maxWidth,
        maxHeight: asset.maxHeight,
      });
      await saveCompanyAsset(asset.id, optimized);
      notify(`${asset.title} uploaded successfully.`);
    } catch (reason) {
      notify(reason?.message || `Could not upload ${asset.title}.`, 'error');
    } finally {
      setAssetBusy('');
    }
  };

  const removeAsset = async (asset) => {
    if (!window.confirm(`Remove the uploaded ${asset.title}? The built-in SB image will be used when available.`)) return;
    setAssetBusy(asset.id);
    try {
      await deleteCompanyAsset(asset.id);
      notify(`${asset.title} removed.`);
    } catch (reason) {
      notify(reason?.message || `Could not remove ${asset.title}.`, 'error');
    } finally {
      setAssetBusy('');
    }
  };

  const ensureDrive = async () => {
    await requestDriveAccess();
    markDriveConnected?.(true);
  };

  const refreshBackups = async () => {
    setBackupBusy('list');
    try {
      await ensureDrive();
      const [folderFiles, accessibleFiles] = await Promise.all([
        listBusinessBackups(rootFolder),
        listAccessibleBusinessBackups(),
      ]);
      const byId = new Map([...folderFiles, ...accessibleFiles].map((file) => [file.id, file]));
      const files = [...byId.values()].sort((a, b) => new Date(b.createdTime || b.modifiedTime || 0) - new Date(a.createdTime || a.modifiedTime || 0));
      setBackups(files);
      notify(files.length ? `${files.length} Drive backup${files.length === 1 ? '' : 's'} found.` : 'No SB backups were found on Google Drive.');
    } catch (reason) {
      notify(reason?.message || 'Could not read Google Drive backups.', 'error');
    } finally {
      setBackupBusy('');
    }
  };

  const createBackup = async ({ silent = false } = {}) => {
    setBackupBusy('create');
    try {
      await ensureDrive();
      const backup = await createApplicationBackup();
      const uploaded = await uploadBusinessBackup(backup, rootFolder);
      const [folderFiles, accessibleFiles] = await Promise.all([
        listBusinessBackups(rootFolder),
        listAccessibleBusinessBackups(),
      ]);
      const byId = new Map([...folderFiles, ...accessibleFiles].map((file) => [file.id, file]));
      const files = [...byId.values()].sort((a, b) => new Date(b.createdTime || b.modifiedTime || 0) - new Date(a.createdTime || a.modifiedTime || 0));
      setBackups(files);
      if (!silent) notify(`Backup created: ${uploaded.name}`);
      return uploaded;
    } catch (reason) {
      notify(reason?.message || 'Could not create the Google Drive backup.', 'error');
      throw reason;
    } finally {
      setBackupBusy('');
    }
  };

  const restoreBackup = async () => {
    if (!restoreCandidate || restorePhrase.trim().toUpperCase() !== 'RESTORE') {
      notify('Type RESTORE to confirm.', 'error');
      return;
    }
    setBackupBusy('restore');
    try {
      await ensureDrive();
      const backup = await downloadBusinessBackup(restoreCandidate.id);
      await restoreApplicationBackup(backup);
      notify('Backup restored. Reloading SB…');
      setTimeout(() => window.location.reload(), 900);
    } catch (reason) {
      notify(reason?.message || 'Could not restore this backup.', 'error');
      setBackupBusy('');
    }
  };

  const resetNow = async (withBackup) => {
    if (resetPhrase.trim().toUpperCase() !== 'RESET SB') {
      notify('Type RESET SB to confirm the reset.', 'error');
      return;
    }
    setBackupBusy(withBackup ? 'backup-reset' : 'reset');
    try {
      if (withBackup) await createBackup({ silent: true });
      await resetApplicationData();
      localStorage.removeItem('sb-theme');
      localStorage.removeItem('sb-custom-theme');
      localStorage.removeItem('df7-theme');
      notify('SB has been reset. Reloading the clean application…');
      setTimeout(() => window.location.reload(), 900);
    } catch (reason) {
      notify(reason?.message || 'The reset could not be completed.', 'error');
      setBackupBusy('');
    }
  };


  return (
    <div className="administration-page">
      <section className="administration-hero panel">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Company, branding and data control</h2>
          <p>Manage SB company information, document branding, Google Drive backups and the protected full reset.</p>
        </div>
        <span className="admin-owner-chip">Company Administrator</span>
      </section>

      <nav className="settings-tabs" aria-label="Administration sections">
        {[
          ['company', 'Company & System'],
          ['branding', 'Logo, Stamp & Signature'],
          ...(hasPlatinum(planId) ? [['backup', 'Backup & Restore']] : []),
          ['reset', 'Reset'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'company' && (
        <section className="settings-layout">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">COMPANY & SYSTEM</p>
                <h2>Business, tax and document details</h2>
              </div>
            </div>

            <div className="form-grid settings-form">
              <label><span>Business name</span><input value={form.businessName || ''} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></label>
              <label><span>Short name</span><input value={form.shortName || ''} onChange={(e) => setForm({ ...form, shortName: e.target.value })} /></label>
              <label className="wide"><span>Registered address</span><textarea rows="3" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
              <label><span>Phone</span><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label><span>Email</span><input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label><span>Business registration number</span><input value={form.registrationNumber || ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></label>
              <label><span>Taxpayer Identification Number (TIN)</span><input value={form.tin || ''} onChange={(e) => setForm({ ...form, tin: e.target.value })} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.gstRegistered)} onChange={(e) => setForm({ ...form, gstRegistered: e.target.checked })} /><span>Company is GST registered</span></label>
              <label><span>Default GST %</span><input type="number" min="0" max="100" step="0.01" value={form.defaultGstRate ?? 0} onChange={(e) => setForm({ ...form, defaultGstRate: e.target.value })} /></label>
              <label><span>Default discount %</span><input type="number" min="0" max="100" step="0.01" value={form.defaultDiscountRate ?? 0} onChange={(e) => setForm({ ...form, defaultDiscountRate: e.target.value })} /></label>
              <label><span>Quotation validity (days)</span><input type="number" min="1" value={form.quotationValidityDays ?? 30} onChange={(e) => setForm({ ...form, quotationValidityDays: e.target.value })} /></label>
              <label><span>Currency</span><input value={form.currency || ''} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
              <label><span>Invoice prefix</span><input value={form.invoicePrefix || ''} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })} /></label>
              <label><span>Quotation prefix</span><input value={form.quotePrefix || ''} onChange={(e) => setForm({ ...form, quotePrefix: e.target.value.toUpperCase() })} /></label>
              <label><span>Employee ID prefix</span><input value={form.employeePrefix || ''} onChange={(e) => setForm({ ...form, employeePrefix: e.target.value.toUpperCase() })} /></label>
              <label><span>Salary slip prefix</span><input value={form.salarySlipPrefix || ''} onChange={(e) => setForm({ ...form, salarySlipPrefix: e.target.value.toUpperCase() })} /></label>
              <label><span>Authorized signatory</span><input value={form.authorizedSignatory || ''} onChange={(e) => setForm({ ...form, authorizedSignatory: e.target.value })} /></label>
              <label><span>Designation</span><input value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
              <label><span>Bank name</span><input value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></label>
              <label><span>Bank account name</span><input value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} /></label>
              <label><span>Bank account number</span><input value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} /></label>
              <label className="wide"><span>Default payment terms</span><textarea rows="3" value={form.defaultTerms || ''} onChange={(e) => setForm({ ...form, defaultTerms: e.target.value })} /></label>
              <label className="wide"><span>Quotation declaration</span><textarea rows="4" value={form.quotationDeclaration || ''} onChange={(e) => setForm({ ...form, quotationDeclaration: e.target.value })} /></label>
              <label className="wide"><span>Google Drive root folder</span><input value={form.driveRootFolder || ''} onChange={(e) => setForm({ ...form, driveRootFolder: e.target.value })} /></label>
            </div>

            {!form.gstRegistered && Number(form.defaultGstRate || 0) > 0 && (
              <div className="alert alert-warning">
                GST should normally remain 0% unless the business is GST registered and permitted to charge GST.
              </div>
            )}

            <button className="button button-primary administration-save" onClick={save}>Save Company & System</button>
          </article>

          <aside className="panel security-panel">
            <p className="eyebrow">SYSTEM STATUS</p>
            <h2>Administration checklist</h2>
            <div className="security-check"><span>✓</span><div><strong>Tenant protected</strong><p>This company is isolated from every other Small Business workspace.</p></div></div>
            <div className="security-check"><span>✓</span><div><strong>Document numbering</strong><p>Invoice, quotation, employee and salary-slip prefixes are configurable.</p></div></div>
            <div className="security-check"><span>✓</span><div><strong>Google Drive ready</strong><p>PDF documents and JSON backups can use the selected root folder.</p></div></div>
            <div className="security-check"><span>✓</span><div><strong>Mobile optimized</strong><p>Administration forms use full-screen mobile sheets without overlapping layers.</p></div></div>
          </aside>
        </section>
      )}

      {tab === 'branding' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">DOCUMENT BRANDING</p>
              <h2>Company Logo, Company Stamp and Manager Signature</h2>
            </div>
          </div>
          <div className="asset-upload-grid">
            {ASSET_CONFIG.map((asset) => {
              const dataUrl = companyAssets?.[asset.field] || '';
              return (
                <article className="asset-upload-card" key={asset.id}>
                  <div className={`asset-preview ${asset.id}`}>
                    {dataUrl ? <img src={dataUrl} alt={asset.title} /> : <span>＋</span>}
                  </div>
                  <div className="asset-upload-copy">
                    <h3>{asset.title}</h3>
                    <p>{asset.description}</p>
                  </div>
                  <label className="button button-secondary asset-file-button">
                    {assetBusy === asset.id ? 'Processing…' : dataUrl ? 'Replace image' : 'Upload image'}
                    <input
                      type="file"
                      accept={asset.accept}
                      disabled={assetBusy === asset.id}
                      onChange={(event) => uploadAsset(asset, event.target.files?.[0])}
                    />
                  </label>
                  {dataUrl && <button className="button button-ghost" onClick={() => removeAsset(asset)} disabled={assetBusy === asset.id}>Remove</button>}
                </article>
              );
            })}
          </div>
          <div className="alert alert-info">
            Images are resized and optimized before being stored. Transparent PNG or WebP files are recommended for the stamp and signature.
          </div>
        </section>
      )}


      {tab === 'backup' && (
        <section className="backup-layout">
          <article className="panel backup-primary-card">
            <p className="eyebrow">GOOGLE DRIVE BACKUP</p>
            <h2>Protect all SB business data</h2>
            <p>Creates one JSON backup containing business records, settings, payroll history, attendance, uploaded branding assets, users and activity logs.</p>
            <div className="backup-action-row">
              <button className="button button-primary" onClick={() => createBackup()} disabled={Boolean(backupBusy)}>
                {backupBusy === 'create' ? 'Creating backup…' : 'Create Backup on Drive'}
              </button>
              <button className="button button-secondary" onClick={refreshBackups} disabled={Boolean(backupBusy)}>
                {backupBusy === 'list' ? 'Loading…' : 'Refresh Backup List'}
              </button>
            </div>
            <div className={`drive-backup-status ${driveConnected ? 'connected' : ''}`}>
              <span>{driveConnected ? '✓' : '!'}</span>
              <div>
                <strong>{driveConnected ? 'Google Drive connected' : 'Google Drive authorization required'}</strong>
                <p>Root folder: {rootFolder} / Backups</p>
              </div>
            </div>
          </article>

          <article className="panel backup-list-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">AVAILABLE BACKUPS</p>
                <h2>{backups.length} backup{backups.length === 1 ? '' : 's'}</h2>
              </div>
            </div>
            <div className="backup-file-list">
              {backups.map((file) => (
                <div className="backup-file-row" key={file.id}>
                  <span className="backup-file-icon">⇩</span>
                  <div>
                    <strong>{file.name}</strong>
                    <small>{formatBackupDate(file.createdTime || file.modifiedTime)} · {formatBytes(Number(file.size || 0))}</small>
                  </div>
                  <button className="button button-secondary" onClick={() => { setRestoreCandidate(file); setRestorePhrase(''); }}>Restore</button>
                </div>
              ))}
              {!backups.length && (
                <div className="empty-backup-state">
                  <span>☁</span>
                  <strong>No backups loaded</strong>
                  <p>Select Refresh Backup List after connecting Google Drive.</p>
                </div>
              )}
            </div>
          </article>

          {restoreCandidate && (
            <article className="panel restore-confirmation-card">
              <p className="eyebrow">RESTORE CONFIRMATION</p>
              <h2>Restore {restoreCandidate.name}?</h2>
              <p>This replaces the current SB database with the selected backup. Current records not included in the backup will be deleted.</p>
              <label>
                <span>Type RESTORE to continue</span>
                <input value={restorePhrase} onChange={(event) => setRestorePhrase(event.target.value)} placeholder="RESTORE" autoComplete="off" />
              </label>
              <div className="backup-action-row">
                <button className="button button-ghost" onClick={() => setRestoreCandidate(null)}>Cancel</button>
                <button className="button button-primary" onClick={restoreBackup} disabled={backupBusy === 'restore' || restorePhrase.trim().toUpperCase() !== 'RESTORE'}>
                  {backupBusy === 'restore' ? 'Restoring…' : 'Restore Selected Backup'}
                </button>
              </div>
            </article>
          )}
        </section>
      )}

      {tab === 'reset' && (
        <section className="panel danger-zone-panel">
          <div className="danger-zone-icon">!</div>
          <p className="eyebrow">DANGER ZONE</p>
          <h2>Reset Small Business</h2>
          <p>This resets the current company workspace only. Operational records, settings, documents and branding are removed, while the company registration, subscription and administrator access remain intact.</p>
          <div className="alert alert-warning">
            Recommended: VIP Platinum subscribers should create a Google Drive backup immediately before resetting. A reset cannot be undone without a valid backup.
          </div>
          <label className="reset-confirm-field">
            <span>Type RESET SB to confirm</span>
            <input value={resetPhrase} onChange={(event) => setResetPhrase(event.target.value)} placeholder="RESET SB" autoComplete="off" />
          </label>
          <div className="reset-action-grid">
            <button className="button button-secondary" onClick={() => resetNow(true)} disabled={Boolean(backupBusy) || resetPhrase.trim().toUpperCase() !== 'RESET SB'}>
              {backupBusy === 'backup-reset' ? 'Backing up and resetting…' : 'Backup to Drive, Then Reset'}
            </button>
            <button className="button reset-danger-button" onClick={() => resetNow(false)} disabled={Boolean(backupBusy) || resetPhrase.trim().toUpperCase() !== 'RESET SB'}>
              {backupBusy === 'reset' ? 'Resetting…' : 'Reset Without Backup'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

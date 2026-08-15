import { supabase, currentAuthUser, SUPER_ADMIN_EMAIL } from '../config/supabase';
import { getActiveBusinessId, getActiveBusinessName, requireActiveBusinessId } from './tenantContext';

const lower = (value = '') => String(value || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

const throwIfError = (error, fallback = 'Database operation failed.') => {
  if (error) throw new Error(error.message || fallback);
};

const cleanUndefined = (value) => {
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, cleanUndefined(item)]),
    );
  }
  if (value instanceof Date) return value.toISOString();
  return value;
};

const userEmail = async () => lower((await currentAuthUser())?.email);

async function upsertBusinessRecord(collectionName, id, data, { merge = true } = {}) {
  const businessId = requireActiveBusinessId();
  const recordId = id || newId();
  let next = cleanUndefined(data || {});

  if (merge) {
    const { data: existing, error: readError } = await supabase
      .from('business_records')
      .select('data,created_at')
      .eq('business_id', businessId)
      .eq('collection_name', collectionName)
      .eq('id', recordId)
      .maybeSingle();
    throwIfError(readError);
    next = { ...(existing?.data || {}), ...next };
    if (!next.createdAt && existing?.created_at) next.createdAt = existing.created_at;
  }

  if (!next.createdAt) next.createdAt = nowIso();
  next.updatedAt = nowIso();

  const { error } = await supabase
    .from('business_records')
    .upsert({
      business_id: businessId,
      collection_name: collectionName,
      id: recordId,
      data: next,
      updated_at: nowIso(),
    }, { onConflict: 'business_id,collection_name,id' });
  throwIfError(error);
  return recordId;
}

async function getBusinessRecord(collectionName, id) {
  const businessId = requireActiveBusinessId();
  const { data, error } = await supabase
    .from('business_records')
    .select('id,data,created_at,updated_at')
    .eq('business_id', businessId)
    .eq('collection_name', collectionName)
    .eq('id', id)
    .maybeSingle();
  throwIfError(error);
  return data ? { id: data.id, ...(data.data || {}) } : null;
}

async function listBusinessRecords(collectionName) {
  const businessId = requireActiveBusinessId();
  const { data, error } = await supabase
    .from('business_records')
    .select('id,data,created_at,updated_at')
    .eq('business_id', businessId)
    .eq('collection_name', collectionName);
  throwIfError(error);
  return (data || []).map((row) => ({ id: row.id, ...(row.data || {}) }));
}

async function writeActivity(action, module, recordId = '') {
  if (module === 'activityLogs') return;
  try {
    const user = await currentAuthUser();
    if (!user) return;
    await upsertBusinessRecord('activityLogs', newId(), {
      action,
      module,
      recordId,
      userEmail: user.email || '',
      userName: user.user_metadata?.full_name || user.user_metadata?.name || '',
      createdAt: nowIso(),
    }, { merge: false });
  } catch (error) {
    console.warn('Activity log could not be written:', error);
  }
}

const membershipPayload = (data, businessId, email) => ({
  business_id: businessId,
  email,
  display_name: String(data.displayName || '').trim(),
  role: data.role || 'user',
  active: data.active !== false,
  notes: String(data.notes || '').trim(),
  custom_permissions: Boolean(data.customPermissions),
  permissions: Array.isArray(data.permissions) ? data.permissions : [],
  business_name: getActiveBusinessName(),
  updated_at: nowIso(),
});

export async function saveRecord(collectionName, data, id = null) {
  if (collectionName === 'userAccess') {
    const businessId = requireActiveBusinessId();
    const email = lower(data.email || id);
    if (!email) throw new Error('User email is required.');

    const { error } = await supabase
      .from('business_memberships')
      .upsert(membershipPayload(data, businessId, email), { onConflict: 'business_id,email' });
    throwIfError(error);
    await writeActivity('UPDATE USER ACCESS', 'userAccess', email);
    return email;
  }

  const recordId = await upsertBusinessRecord(collectionName, id || newId(), data, { merge: Boolean(id) });
  await writeActivity(id ? 'UPDATE' : 'CREATE', collectionName, recordId);
  return recordId;
}

export async function deleteRecord(collectionName, id) {
  const businessId = requireActiveBusinessId();
  if (collectionName === 'userAccess') {
    const { error } = await supabase
      .from('business_memberships')
      .delete()
      .eq('business_id', businessId)
      .eq('email', lower(id));
    throwIfError(error);
    await writeActivity('DELETE USER ACCESS', 'userAccess', id);
    return;
  }

  const { error } = await supabase
    .from('business_records')
    .delete()
    .eq('business_id', businessId)
    .eq('collection_name', collectionName)
    .eq('id', id);
  throwIfError(error);
  await writeActivity('DELETE', collectionName, id);
}

export async function saveBusinessSettings(data) {
  await upsertBusinessRecord('settings', 'business', data);
}

export async function saveInvoiceWithStock(invoice, invoiceId = null) {
  const { data, error } = await supabase.rpc('sb_save_invoice_with_stock', {
    p_business_id: requireActiveBusinessId(),
    p_invoice_id: invoiceId || null,
    p_invoice: cleanUndefined(invoice),
  });
  throwIfError(error, 'Could not save invoice and stock changes.');
  await writeActivity(invoiceId ? 'UPDATE INVOICE' : 'CREATE INVOICE', 'invoices', data);
  return data;
}

export async function deleteInvoiceAndRestoreStock(invoice) {
  if (!invoice?.id) throw new Error('Invoice is required.');
  const { error } = await supabase.rpc('sb_delete_invoice_restore_stock', {
    p_business_id: requireActiveBusinessId(),
    p_invoice_id: invoice.id,
  });
  throwIfError(error, 'Could not delete invoice and restore stock.');
  await writeActivity('DELETE INVOICE', 'invoices', invoice.id);
}

export async function generateContractInvoice(contract, invoiceData) {
  if (!contract?.id || !invoiceData?.billingPeriodKey) throw new Error('Billing contract and period are required.');
  const { data, error } = await supabase.rpc('sb_generate_contract_invoice', {
    p_business_id: requireActiveBusinessId(),
    p_contract_id: contract.id,
    p_period_key: invoiceData.billingPeriodKey,
    p_invoice: cleanUndefined(invoiceData),
  });
  throwIfError(error, 'Could not generate recurring invoice.');
  await writeActivity('GENERATE CONTRACT INVOICE', 'billingContracts', contract.id);
  return data;
}

export async function savePayrollRecord(data, existingId = null) {
  if (!data.employeeId || !data.salaryMonth) throw new Error('Employee and salary month are required.');
  const deterministicId = `${data.employeeId}_${data.salaryMonth}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const payrollId = existingId || deterministicId;

  if (!existingId) {
    const existing = await getBusinessRecord('payroll', payrollId);
    if (existing) throw new Error('A salary record already exists for this employee and month.');
  }

  await upsertBusinessRecord('payroll', payrollId, data);
  await writeActivity(existingId ? 'UPDATE PAYROLL' : 'CREATE PAYROLL', 'payroll', payrollId);
  return payrollId;
}

export async function saveAttendanceBatch(records = []) {
  if (!records.length) return 0;
  const businessId = requireActiveBusinessId();
  const timestamp = nowIso();
  const rows = records.map((record) => {
    if (!record.employeeId || !record.date) throw new Error('Employee and attendance date are required.');
    const id = `${record.employeeId}_${record.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      business_id: businessId,
      collection_name: 'attendance',
      id,
      data: {
        ...cleanUndefined(record),
        attendanceMonth: record.attendanceMonth || String(record.date).slice(0, 7),
        createdAt: record.createdAt || timestamp,
        updatedAt: timestamp,
      },
      updated_at: timestamp,
    };
  });

  const { error } = await supabase
    .from('business_records')
    .upsert(rows, { onConflict: 'business_id,collection_name,id' });
  throwIfError(error, 'Could not save attendance.');
  await writeActivity('SAVE DAILY ATTENDANCE', 'attendance', records[0]?.date || '');
  return records.length;
}

export async function setPayrollMonthStatus(month, status, payrollIds = [], options = {}) {
  if (!month) throw new Error('Payroll month is required.');
  const email = await userEmail();
  const current = await getBusinessRecord('payrollPeriods', month) || {};
  const data = { month, status };
  if (status === 'APPROVED') Object.assign(data, { approvedAt: nowIso(), approvedBy: email });
  if (status === 'CLOSED') Object.assign(data, { closedAt: nowIso(), closedBy: email });
  if (status === 'OPEN' && current.status && current.status !== 'OPEN') Object.assign(data, { reopenedAt: nowIso(), reopenedBy: email });
  await upsertBusinessRecord('payrollPeriods', month, data);

  await Promise.all(payrollIds.map(async (id) => {
    const update = {};
    if (status === 'APPROVED') Object.assign(update, { status: 'APPROVED', approvedAt: nowIso(), approvedBy: email });
    if (status === 'OPEN') Object.assign(update, { status: 'REOPENED', reopenedAt: nowIso(), reopenedBy: email });
    if (options.markPaid) Object.assign(update, { status: 'PAID', paymentDate: options.paymentDate || new Date().toISOString().slice(0, 10), paidAt: nowIso() });
    if (Object.keys(update).length) await upsertBusinessRecord('payroll', id, update);
  }));
  await writeActivity(`${status} PAYROLL MONTH`, 'payrollPeriods', month);
}

export async function processFinalSettlementRecord(employee, settlement) {
  if (!employee?.id || !settlement?.lastWorkingDate) throw new Error('Employee and last working date are required.');
  const { data, error } = await supabase.rpc('sb_process_final_settlement', {
    p_business_id: requireActiveBusinessId(),
    p_employee_id: employee.id,
    p_employee: cleanUndefined(employee),
    p_settlement: cleanUndefined(settlement),
  });
  throwIfError(error, 'Could not process final salary settlement.');
  await writeActivity('PROCESS FINAL SETTLEMENT', 'finalSettlements', data);
  return data;
}

export async function receivePayment(invoice, payment) {
  if (!invoice?.id) throw new Error('Invoice is required.');
  const { data, error } = await supabase.rpc('sb_receive_invoice_payment', {
    p_business_id: requireActiveBusinessId(),
    p_invoice_id: invoice.id,
    p_payment: cleanUndefined(payment),
  });
  throwIfError(error, 'Could not receive invoice payment.');
  await writeActivity('RECEIVE PAYMENT', 'payments', data);
  return data;
}

export async function saveAttendanceSettings(data) {
  const shifts = Array.isArray(data?.shifts) ? data.shifts : [];
  if (!shifts.length) throw new Error('At least one attendance shift is required.');
  if (!shifts.some((shift) => shift.isDefault && shift.active !== false)) throw new Error('Select one active shift as the default shift.');
  await upsertBusinessRecord('settings', 'attendance', {
    shifts,
    updatedBy: await userEmail(),
  });
  await writeActivity('UPDATE ATTENDANCE SHIFTS', 'settings', 'attendance');
}

export async function saveAttendanceDocumentRecord(data, existingId = null) {
  if (!data.employeeId || !data.attendanceMonth || !data.documentType) throw new Error('Employee, month and attendance document type are required.');
  const id = existingId || `${data.employeeId}_${data.attendanceMonth}_${String(data.documentType).toLowerCase()}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  await upsertBusinessRecord('attendanceDocuments', id, {
    ...data,
    generatedAt: data.generatedAt || nowIso(),
    generatedBy: await userEmail(),
  });
  await writeActivity(`GENERATE ATTENDANCE ${data.documentType}`, 'attendanceDocuments', id);
  return id;
}

export async function saveSalarySlipRecord(data, existingId = null) {
  if (!existingId && (!data.employeeId || !data.salaryMonth)) throw new Error('Employee and salary month are required for a salary slip.');
  const id = existingId || `${data.employeeId}_${data.salaryMonth}_salary-slip`.replace(/[^a-zA-Z0-9_-]/g, '_');
  await upsertBusinessRecord('salarySlips', id, data);
  await writeActivity(existingId ? 'UPDATE SALARY SLIP' : 'CREATE SALARY SLIP', 'salarySlips', id);
  return id;
}

export async function setSalarySlipLock(salarySlipId, locked = true) {
  if (!salarySlipId) throw new Error('A saved salary slip is required.');
  const email = await userEmail();
  await upsertBusinessRecord('salarySlips', salarySlipId, locked ? {
    locked: true,
    lockedAt: nowIso(),
    lockedBy: email,
  } : {
    locked: false,
    unlockedAt: nowIso(),
    unlockedBy: email,
  });
  await writeActivity(locked ? 'LOCK SALARY SLIP' : 'UNLOCK SALARY SLIP', 'salarySlips', salarySlipId);
}

export async function markPayrollAndSalarySlipPaid(payrollId, salarySlipId, payment = {}) {
  if (!payrollId || !salarySlipId) throw new Error('Payroll and salary slip are required.');
  const paidData = {
    status: 'PAID',
    paymentStatus: 'PAID',
    paymentDate: payment.paymentDate || new Date().toISOString().slice(0, 10),
    paymentMethod: payment.paymentMethod || 'Bank Transfer',
    paymentReference: payment.paymentReference || '',
    paymentNotes: payment.paymentNotes || '',
    paidAt: nowIso(),
    paidBy: await userEmail(),
  };
  await Promise.all([
    upsertBusinessRecord('payroll', payrollId, paidData),
    upsertBusinessRecord('salarySlips', salarySlipId, paidData),
  ]);
  await writeActivity('MARK SALARY PAID', 'payroll', payrollId);
  await writeActivity('MARK SALARY SLIP PAID', 'salarySlips', salarySlipId);
}

// ---------------------------------------------------------------------
// Tenant backup / restore
// ---------------------------------------------------------------------
export const SB_BACKUP_COLLECTIONS = [
  'userAccess', 'customers', 'products', 'invoices', 'quotes', 'employees',
  'attendance', 'payroll', 'salarySlips', 'attendanceDocuments', 'payrollPeriods',
  'finalSettlements', 'payments', 'expenses', 'billingContracts', 'budgets',
  'settings', 'companyAssets', 'activityLogs',
];

const BACKUP_FORMAT = 'SB_SUPABASE_TENANT_BACKUP_V3';
const LEGACY_BACKUP_FORMAT = 'DF7_BUSINESS_TENANT_BACKUP_V2';
const LEGACY_SB_BACKUP_FORMAT = 'SB_BUSINESS_TENANT_BACKUP_V2';

const reviveBackupValue = (value) => {
  if (Array.isArray(value)) return value.map(reviveBackupValue);
  if (value && typeof value === 'object') {
    if ((value.__df7Type === 'timestamp' || value.__df7Type === 'date') && value.value) return value.value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveBackupValue(item)]));
  }
  return value;
};

const dataUrlToBlob = (dataUrl) => {
  const [meta, body] = String(dataUrl || '').split(',');
  const mime = meta?.match(/data:(.*?);base64/)?.[1] || 'image/png';
  const binary = atob(body || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

async function listMembershipsForBackup() {
  const businessId = requireActiveBusinessId();
  const { data, error } = await supabase
    .from('business_memberships')
    .select('*')
    .eq('business_id', businessId);
  throwIfError(error);
  return (data || []).map((row) => ({
    id: row.email,
    data: {
      email: row.email,
      displayName: row.display_name || '',
      role: row.role,
      active: row.active,
      notes: row.notes || '',
      customPermissions: row.custom_permissions,
      permissions: row.permissions || [],
      businessId: row.business_id,
      businessName: row.business_name || getActiveBusinessName(),
    },
  }));
}

async function listCompanyAssetsForBackup() {
  const businessId = requireActiveBusinessId();
  const { data, error } = await supabase.from('company_assets').select('*').eq('business_id', businessId);
  throwIfError(error);
  const rows = [];
  for (const asset of data || []) {
    const { data: blob, error: downloadError } = await supabase.storage.from('company-assets').download(asset.storage_path);
    if (downloadError) continue;
    rows.push({
      id: asset.asset_id,
      data: {
        assetId: asset.asset_id,
        dataUrl: await blobToDataUrl(blob),
        fileName: asset.file_name || '',
        contentType: asset.content_type || blob.type,
      },
    });
  }
  return rows;
}

export async function createApplicationBackup() {
  const businessId = requireActiveBusinessId();
  const collections = {};
  for (const name of SB_BACKUP_COLLECTIONS) {
    if (name === 'userAccess') collections[name] = await listMembershipsForBackup();
    else if (name === 'companyAssets') collections[name] = await listCompanyAssetsForBackup();
    else collections[name] = (await listBusinessRecords(name)).map((record) => {
      const { id, ...data } = record;
      return { id, data };
    });
  }

  const { data: periods, error } = await supabase
    .from('contract_generated_periods')
    .select('*')
    .eq('business_id', businessId);
  throwIfError(error);
  const generatedPeriods = {};
  (periods || []).forEach((row) => {
    generatedPeriods[row.contract_id] ||= [];
    generatedPeriods[row.contract_id].push({ id: row.period_key, data: row.data || {} });
  });

  return {
    format: BACKUP_FORMAT,
    appVersion: '3.2.0',
    businessId,
    createdAt: nowIso(),
    createdBy: await userEmail(),
    collections,
    subcollections: { billingContractsGeneratedPeriods: generatedPeriods },
  };
}

export async function saveCompanyAsset(assetId, asset) {
  if (!['companyLogo', 'companyStamp', 'managerSignature'].includes(assetId)) throw new Error('Unsupported company asset.');
  if (!asset?.dataUrl || !String(asset.dataUrl).startsWith('data:image/')) throw new Error('A valid image is required.');

  const businessId = requireActiveBusinessId();
  const blob = dataUrlToBlob(asset.dataUrl);
  const extension = blob.type.includes('jpeg') ? 'jpg' : blob.type.includes('webp') ? 'webp' : 'png';
  const path = `${businessId}/${assetId}.${extension}`;

  const { data: existing } = await supabase.from('company_assets').select('storage_path').eq('business_id', businessId).eq('asset_id', assetId).maybeSingle();
  if (existing?.storage_path && existing.storage_path !== path) {
    await supabase.storage.from('company-assets').remove([existing.storage_path]);
  }

  const { error: uploadError } = await supabase.storage
    .from('company-assets')
    .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
  throwIfError(uploadError, 'Could not upload company asset.');

  const { error } = await supabase.from('company_assets').upsert({
    business_id: businessId,
    asset_id: assetId,
    storage_path: path,
    file_name: asset.fileName || `${assetId}.${extension}`,
    content_type: blob.type,
    uploaded_by: await userEmail(),
    updated_at: nowIso(),
  }, { onConflict: 'business_id,asset_id' });
  throwIfError(error);
  await writeActivity('UPLOAD COMPANY ASSET', 'companyAssets', assetId);
}

export async function deleteCompanyAsset(assetId) {
  const businessId = requireActiveBusinessId();
  const { data } = await supabase.from('company_assets').select('storage_path').eq('business_id', businessId).eq('asset_id', assetId).maybeSingle();
  if (data?.storage_path) await supabase.storage.from('company-assets').remove([data.storage_path]);
  const { error } = await supabase.from('company_assets').delete().eq('business_id', businessId).eq('asset_id', assetId);
  throwIfError(error);
  await writeActivity('DELETE COMPANY ASSET', 'companyAssets', assetId);
}

export async function resetApplicationData() {
  const businessId = requireActiveBusinessId();
  const { data: business, error: businessError } = await supabase.from('businesses').select('*').eq('id', businessId).single();
  throwIfError(businessError);

  const { data: assets } = await supabase.from('company_assets').select('storage_path').eq('business_id', businessId);
  if (assets?.length) await supabase.storage.from('company-assets').remove(assets.map((item) => item.storage_path));

  const { error: recordsError } = await supabase.from('business_records').delete().eq('business_id', businessId);
  throwIfError(recordsError);
  await supabase.from('contract_generated_periods').delete().eq('business_id', businessId);
  await supabase.from('company_assets').delete().eq('business_id', businessId);
  await supabase.from('business_memberships').delete().eq('business_id', businessId).neq('role', 'administrator');

  const businessName = String(business.name || getActiveBusinessName() || 'Small Business').trim();
  await upsertBusinessRecord('settings', 'business', {
    businessName,
    shortName: businessName.slice(0, 12),
    address: business.address || '',
    phone: business.phone || '',
    email: business.email || '',
    currency: business.currency || 'MVR',
    registrationNumber: business.registration_number || '',
    driveRootFolder: `Small Business - ${businessName} - ${businessId.slice(0, 6)}`,
  });
}

export async function restoreApplicationBackup(backup) {
  if (!backup?.collections || ![BACKUP_FORMAT, LEGACY_BACKUP_FORMAT, LEGACY_SB_BACKUP_FORMAT].includes(backup.format)) throw new Error('This is not a supported Small Business backup.');
  if (backup.format === BACKUP_FORMAT && backup.businessId && backup.businessId !== getActiveBusinessId()) {
    throw new Error('This Supabase backup belongs to a different company workspace.');
  }

  await resetApplicationData();
  const businessId = requireActiveBusinessId();

  for (const collectionName of SB_BACKUP_COLLECTIONS) {
    const rows = backup.collections[collectionName] || [];
    if (collectionName === 'userAccess') {
      for (const row of rows) {
        const data = reviveBackupValue(row.data || {});
        if (data.role === 'administrator') continue;
        await saveRecord('userAccess', data, lower(data.email || row.id));
      }
      continue;
    }
    if (collectionName === 'companyAssets') {
      for (const row of rows) {
        const data = reviveBackupValue(row.data || {});
        if (data.dataUrl) await saveCompanyAsset(row.id, data);
      }
      continue;
    }

    const batchRows = rows.map((row) => ({
      business_id: businessId,
      collection_name: collectionName,
      id: row.id,
      data: {
        ...reviveBackupValue(row.data || {}),
        updatedAt: reviveBackupValue(row.data || {}).updatedAt || nowIso(),
      },
      updated_at: nowIso(),
    }));
    if (batchRows.length) {
      const { error } = await supabase.from('business_records').upsert(batchRows, { onConflict: 'business_id,collection_name,id' });
      throwIfError(error, `Could not restore ${collectionName}.`);
    }
  }

  const generated = backup.subcollections?.billingContractsGeneratedPeriods || {};
  const periodRows = [];
  Object.entries(generated).forEach(([contractId, rows]) => {
    (rows || []).forEach((row) => periodRows.push({
      business_id: businessId,
      contract_id: contractId,
      period_key: row.id,
      data: reviveBackupValue(row.data || {}),
    }));
  });
  if (periodRows.length) {
    const { error } = await supabase.from('contract_generated_periods').upsert(periodRows, { onConflict: 'business_id,contract_id,period_key' });
    throwIfError(error);
  }
}

// ---------------------------------------------------------------------
// SaaS platform
// ---------------------------------------------------------------------
export async function registerBusiness(user, form = {}) {
  if (!user?.id && !user?.uid) throw new Error('Sign in before registering a business.');
  const { data, error } = await supabase.rpc('sb_register_business', { p_form: cleanUndefined(form) });
  throwIfError(error, 'Could not register business.');
  return data;
}

export async function updateBusinessProfile(businessId, data = {}) {
  const update = {
    name: data.name,
    legal_name: data.legalName,
    registration_number: data.registrationNumber,
    address: data.address,
    phone: data.phone,
    email: data.email,
    currency: data.currency,
    industry: data.industry,
    updated_at: nowIso(),
  };
  Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
  const { error } = await supabase.from('businesses').update(update).eq('id', businessId);
  throwIfError(error);
}

export async function savePlatformPlan(planId, data = {}) {
  const update = { updated_at: nowIso() };
  if ('monthlyPrice' in data) update.monthly_price = Number(data.monthlyPrice || 0);
  if ('yearlyPrice' in data) update.yearly_price = Number(data.yearlyPrice || 0);
  if ('currency' in data) update.currency = data.currency || 'MVR';
  if ('monthlyBillingCycleDays' in data || 'billingCycleDays' in data) {
    update.monthly_billing_cycle_days = Number(data.monthlyBillingCycleDays || data.billingCycleDays || 30);
  }
  if ('yearlyBillingCycleDays' in data) update.yearly_billing_cycle_days = Number(data.yearlyBillingCycleDays || 365);
  if ('active' in data) update.active = data.active !== false;

  const { error } = await supabase
    .from('platform_plan_settings')
    .update(update)
    .eq('plan_id', planId);
  throwIfError(error);
}

export async function savePaymentMethod(data, id = null) {
  const recordId = id || newId();
  const { error } = await supabase.from('platform_payment_methods').upsert({
    id: recordId,
    name: String(data.name || '').trim(),
    type: data.type || 'BANK_TRANSFER',
    instructions: String(data.instructions || '').trim(),
    account_label: String(data.accountLabel || '').trim(),
    icon: data.icon || '▣',
    active: data.active !== false,
    updated_at: nowIso(),
  }, { onConflict: 'id' });
  throwIfError(error);
  return recordId;
}

export async function deletePaymentMethod(id) {
  const { error } = await supabase.from('platform_payment_methods').delete().eq('id', id);
  throwIfError(error);
}

async function queuePlatformMail(to, subject, text, metadata = {}) {
  const recipient = lower(to);
  if (!recipient) return '';
  const id = newId();
  const { error } = await supabase.from('mail_queue').insert({
    id,
    recipient,
    subject,
    body_text: text,
    metadata: cleanUndefined(metadata),
    status: 'PENDING',
  });
  if (error) console.warn('Mail queue could not be written:', error);
  return id;
}

export async function submitSubscriptionRequest() {
  throw new Error('Direct subscription requests are disabled. Use the BML/MIB bank-transfer receipt workflow so the server can validate price, bank, receipt and duplicates.');
}

export async function approveSubscriptionRequest(request, options = {}) {
  const { error } = await supabase.rpc('sb_review_subscription_request', {
    p_request_id: request.id,
    p_action: 'APPROVE',
    p_notes: String(options.notes || ''),
    p_starts_at: options.startsAt || null,
    p_ends_at: options.endsAt || null,
  });
  throwIfError(error, 'Could not approve subscription.');
  if (request.requesterEmail) await queuePlatformMail(request.requesterEmail, `Small Business subscription approved — ${request.planName}`, `Your ${request.planName} subscription for ${request.businessName} has been verified and activated.`, { type: 'SUBSCRIPTION_APPROVED', businessId: request.businessId, subscriptionRequestId: request.id });
}

export async function rejectSubscriptionRequest(request, reason = '') {
  const { error } = await supabase.rpc('sb_review_subscription_request', {
    p_request_id: request.id,
    p_action: 'REJECT',
    p_notes: String(reason || ''),
    p_starts_at: null,
    p_ends_at: null,
  });
  throwIfError(error, 'Could not reject subscription.');
  if (request.requesterEmail) await queuePlatformMail(request.requesterEmail, 'Small Business subscription verification update', `Your subscription request for ${request.businessName || 'your business'} was not approved.${reason ? ` Reason: ${reason}` : ''}`, { type: 'SUBSCRIPTION_REJECTED', businessId: request.businessId, subscriptionRequestId: request.id });
}

export async function requestSubscriptionInformation(request, message = '') {
  const { error } = await supabase.rpc('sb_review_subscription_request', {
    p_request_id: request.id,
    p_action: 'MORE_INFO',
    p_notes: String(message || ''),
    p_starts_at: null,
    p_ends_at: null,
  });
  throwIfError(error, 'Could not request more information.');
  if (request.requesterEmail) await queuePlatformMail(request.requesterEmail, 'More information required for Small Business subscription', String(message || 'Please open Small Business and review your subscription verification request.'), { type: 'SUBSCRIPTION_MORE_INFO', businessId: request.businessId, subscriptionRequestId: request.id });
}

export async function setPlatformUserStatus(uid, status) {
  if (!['ACTIVE', 'SUSPENDED'].includes(status)) throw new Error('Unsupported platform user status.');
  const { error } = await supabase.from('platform_users').update({
    status,
    status_updated_at: nowIso(),
    status_updated_by: await userEmail(),
    updated_at: nowIso(),
  }).eq('id', uid);
  throwIfError(error);
}

export async function setBusinessSubscriptionStatus(businessId, status) {
  const { error } = await supabase.rpc('sb_set_subscription_status', {
    p_business_id: businessId,
    p_status: status,
  });
  throwIfError(error);
}

export async function migrateLegacyRootDataToBusiness() {
  throw new Error('Firebase is no longer queried directly. Create a v3.1 Google Drive backup before migration, then restore that backup from Administration → Backup & Restore in the Supabase version.');
}

export async function saveSubscriptionBankAccount(bankId, data = {}) {
  if (!['BML', 'MIB'].includes(bankId)) throw new Error('Unsupported subscription bank.');
  const { error } = await supabase.from('platform_bank_accounts').upsert({
    bank_id: bankId,
    name: String(data.name || '').trim(),
    short_name: String(data.shortName || bankId).trim(),
    account_number: String(data.accountNumber || '').replace(/\D/g, ''),
    account_name: String(data.accountName || '').trim(),
    active: data.active !== false,
    updated_at: nowIso(),
    updated_by: await userEmail(),
  }, { onConflict: 'bank_id' });
  throwIfError(error);
}

export async function findDuplicateSubscriptionReceipt({ reference = '', fileHash = '', bankId = '' }) {
  const { data, error } = await supabase.rpc('sb_find_duplicate_receipt', {
    p_business_id: requireActiveBusinessId(),
    p_bank_id: bankId,
    p_reference: String(reference || '').replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    p_file_hash: fileHash || '',
  });
  throwIfError(error);
  return Array.isArray(data) ? data : (data?.duplicates || []);
}

export async function submitBankTransferSubscriptionRequest({
  business, plan, planSettings, billingPeriod, bankAccount, receipt,
  receiptFile, receiptUpload, form, user,
}) {
  if (!business?.id) throw new Error('Business is required.');
  if (!plan?.id) throw new Error('Subscription package is required.');
  if (!['MONTHLY', 'YEARLY'].includes(billingPeriod)) throw new Error('Choose monthly or yearly billing.');
  const bankId = bankAccount?.bankId || bankAccount?.id;
  if (!['BML', 'MIB'].includes(bankId)) throw new Error('Choose BML or MIB.');

  const amount = billingPeriod === 'YEARLY'
    ? Number(planSettings?.yearlyPrice || 0)
    : Number(planSettings?.monthlyPrice || 0);
  if (amount <= 0) throw new Error('The selected subscription price has not been configured.');

  const payload = {
    business_id: business.id,
    business_name: business.name || '',
    plan_id: plan.id,
    plan_name: plan.name,
    billing_period: billingPeriod,
    amount,
    currency: planSettings?.currency || 'MVR',
    bank_id: bankId,
    detected_bank_id: receipt.bankId || '',
    bank_name: bankAccount.name || bankAccount.shortName || bankId,
    destination_account_number: bankAccount.accountNumber || '',
    destination_account_name: bankAccount.accountName || '',
    detected_amount: Number(receipt.amount || 0),
    detected_reference: receipt.reference || '',
    normalized_reference: String(receipt.reference || '').replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    detected_destination_account: receipt.destinationAccount || '',
    ocr_confidence: Number(receipt.ocrConfidence || 0),
    ocr_text: receipt.text || '',
    receipt_file_hash: receipt.fileHash || '',
    receipt_storage_path: receiptUpload?.storagePath || '',
    receipt_file_name: receiptFile?.name || '',
    receipt_file_type: receiptFile?.type || '',
    receipt_risk_level: receipt.riskLevel || 'REVIEW',
    receipt_warnings: receipt.warnings || [],
    auto_reject_reasons: receipt.reasons || [],
    payer_name: String(form.payerName || user?.displayName || '').trim(),
    payer_contact: String(form.payerContact || '').trim(),
    business_registration_number: String(form.businessRegistrationNumber || business.registrationNumber || '').trim(),
    identity_reference: String(form.identityReference || '').trim(),
    verification_notes: String(form.verificationNotes || '').trim(),
    requester_id: user?.id || user?.uid || null,
    requester_email: lower(user?.email),
    requester_name: user?.displayName || '',
  };

  const { data, error } = await supabase.rpc('sb_submit_subscription_receipt', { p_payload: payload });
  throwIfError(error, 'Could not submit subscription receipt.');

  const result = typeof data === 'string' ? JSON.parse(data) : data;
  return result;
}

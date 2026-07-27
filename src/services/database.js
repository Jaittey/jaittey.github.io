import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth } from '../config/firebase';
import { db } from '../config/firebase';


async function writeActivity(action, module, recordId = '') {
  if (module === 'activityLogs' || !auth.currentUser) return;
  try {
    await addDoc(collection(db, 'activityLogs'), {
      action,
      module,
      recordId,
      userEmail: auth.currentUser.email || '',
      userName: auth.currentUser.displayName || '',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Activity log could not be written:', error);
  }
}

const timestamps = (existing = false) => ({
  updatedAt: serverTimestamp(),
  ...(existing ? {} : { createdAt: serverTimestamp() }),
});

export async function saveRecord(collectionName, data, id = null) {
  if (id) {
    await setDoc(doc(db, collectionName, id), { ...data, ...timestamps(true) }, { merge: true });
    await writeActivity('UPDATE', collectionName, id);
    return id;
  }
  const reference = await addDoc(collection(db, collectionName), { ...data, ...timestamps(false) });
  await writeActivity('CREATE', collectionName, reference.id);
  return reference.id;
}

export async function deleteRecord(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
  await writeActivity('DELETE', collectionName, id);
}

export async function saveBusinessSettings(data) {
  await setDoc(doc(db, 'settings', 'business'), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

const quantitiesByProduct = (items = []) => items.reduce((map, item) => {
  if (item.productId) map[item.productId] = (map[item.productId] || 0) + Number(item.quantity || 0);
  return map;
}, {});

export async function saveInvoiceWithStock(invoice, invoiceId = null) {
  const invoiceRef = invoiceId ? doc(db, 'invoices', invoiceId) : doc(collection(db, 'invoices'));

  await runTransaction(db, async (transaction) => {
    const oldSnapshot = invoiceId ? await transaction.get(invoiceRef) : null;
    const oldInvoice = oldSnapshot?.exists() ? oldSnapshot.data() : null;
    const oldMap = quantitiesByProduct(oldInvoice?.items || []);
    const newMap = quantitiesByProduct(invoice.items || []);
    const productIds = [...new Set([...Object.keys(oldMap), ...Object.keys(newMap)])];
    const productReads = [];

    for (const productId of productIds) {
      const productRef = doc(db, 'products', productId);
      const productSnapshot = await transaction.get(productRef);
      productReads.push({ productId, productRef, productSnapshot });
    }

    for (const { productId, productRef, productSnapshot } of productReads) {
      if (!productSnapshot.exists()) throw new Error('A selected stock item no longer exists.');
      const product = productSnapshot.data();
      const difference = (newMap[productId] || 0) - (oldMap[productId] || 0);
      const nextQuantity = Number(product.quantity || 0) - difference;
      if (nextQuantity < 0) throw new Error(`Not enough stock for ${product.name}.`);
      transaction.update(productRef, { quantity: nextQuantity, updatedAt: serverTimestamp() });
    }

    transaction.set(invoiceRef, {
      ...invoice,
      updatedAt: serverTimestamp(),
      ...(oldInvoice ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
  });

  return invoiceRef.id;
}

export async function deleteInvoiceAndRestoreStock(invoice) {
  await runTransaction(db, async (transaction) => {
    const map = quantitiesByProduct(invoice.items || []);
    const productReads = [];

    for (const productId of Object.keys(map)) {
      const productRef = doc(db, 'products', productId);
      productReads.push({ productId, productRef, snapshot: await transaction.get(productRef) });
    }

    for (const { productId, productRef, snapshot } of productReads) {
      if (snapshot.exists()) {
        transaction.update(productRef, {
          quantity: Number(snapshot.data().quantity || 0) + map[productId],
          updatedAt: serverTimestamp(),
        });
      }
    }
    transaction.delete(doc(db, 'invoices', invoice.id));
  });
}


export async function generateContractInvoice(contract, invoiceData) {
  const period = invoiceData.billingPeriodKey;
  if (!contract?.id || !period) throw new Error('Billing contract and period are required.');

  const markerRef = doc(db, 'billingContracts', contract.id, 'generatedPeriods', period);
  const invoiceRef = doc(collection(db, 'invoices'));

  await runTransaction(db, async (transaction) => {
    const marker = await transaction.get(markerRef);
    if (marker.exists()) {
      throw new Error(`An invoice has already been generated for ${invoiceData.servicePeriod}.`);
    }

    transaction.set(invoiceRef, {
      ...invoiceData,
      sourceContractId: contract.id,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    transaction.set(markerRef, {
      invoiceId: invoiceRef.id,
      invoiceNumber: invoiceData.invoiceNumber,
      servicePeriod: invoiceData.servicePeriod,
      generatedAt: serverTimestamp(),
    });

    transaction.update(doc(db, 'billingContracts', contract.id), {
      lastGeneratedPeriod: period,
      lastInvoiceId: invoiceRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return invoiceRef.id;
}


export async function savePayrollRecord(data, existingId = null) {
  if (!data.employeeId || !data.salaryMonth) {
    throw new Error('Employee and salary month are required.');
  }

  const deterministicId = `${data.employeeId}_${data.salaryMonth}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const payrollId = existingId || deterministicId;
  const payrollRef = doc(db, 'payroll', payrollId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(payrollRef);
    if (!existingId && snapshot.exists()) {
      throw new Error('A salary record already exists for this employee and month.');
    }

    transaction.set(payrollRef, {
      ...data,
      updatedAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
  });

  await writeActivity(existingId ? 'UPDATE PAYROLL' : 'CREATE PAYROLL', 'payroll', payrollId);
  return payrollId;
}

export async function saveAttendanceBatch(records = []) {
  if (!records.length) return 0;
  const batch = writeBatch(db);
  records.forEach((record) => {
    if (!record.employeeId || !record.date) throw new Error('Employee and attendance date are required.');
    const id = `${record.employeeId}_${record.date}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    batch.set(doc(db, 'attendance', id), {
      ...record,
      attendanceMonth: record.attendanceMonth || String(record.date).slice(0, 7),
      updatedAt: serverTimestamp(),
      createdAt: record.createdAt || serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
  await writeActivity('SAVE DAILY ATTENDANCE', 'attendance', records[0]?.date || '');
  return records.length;
}

export async function setPayrollMonthStatus(month, status, payrollIds = [], options = {}) {
  if (!month) throw new Error('Payroll month is required.');
  const periodRef = doc(db, 'payrollPeriods', month);
  await runTransaction(db, async (transaction) => {
    const periodSnapshot = await transaction.get(periodRef);
    const current = periodSnapshot.exists() ? periodSnapshot.data() : {};
    const data = {
      month,
      status,
      updatedAt: serverTimestamp(),
      ...(periodSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    };
    if (status === 'APPROVED') {
      data.approvedAt = serverTimestamp();
      data.approvedBy = auth.currentUser?.email || '';
    }
    if (status === 'CLOSED') {
      data.closedAt = serverTimestamp();
      data.closedBy = auth.currentUser?.email || '';
    }
    if (status === 'OPEN' && current.status && current.status !== 'OPEN') {
      data.reopenedAt = serverTimestamp();
      data.reopenedBy = auth.currentUser?.email || '';
    }
    transaction.set(periodRef, data, { merge: true });

    payrollIds.forEach((id) => {
      const payrollRef = doc(db, 'payroll', id);
      if (status === 'APPROVED') transaction.set(payrollRef, { status: 'APPROVED', approvedAt: serverTimestamp(), approvedBy: auth.currentUser?.email || '', updatedAt: serverTimestamp() }, { merge: true });
      if (status === 'OPEN') transaction.set(payrollRef, { status: 'REOPENED', reopenedAt: serverTimestamp(), reopenedBy: auth.currentUser?.email || '', updatedAt: serverTimestamp() }, { merge: true });
      if (options.markPaid) transaction.set(payrollRef, { status: 'PAID', paymentDate: options.paymentDate || new Date().toISOString().slice(0, 10), paidAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    });
  });
  await writeActivity(`${status} PAYROLL MONTH`, 'payrollPeriods', month);
}

export async function processFinalSettlementRecord(employee, settlement) {
  if (!employee?.id || !settlement?.lastWorkingDate) throw new Error('Employee and last working date are required.');
  const settlementId = `${employee.id}_${settlement.lastWorkingDate}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalRef = doc(db, 'finalSettlements', settlementId);
  const historyRef = doc(db, 'payroll', `FINAL_${settlementId}`);
  const employeeRef = doc(db, 'employees', employee.id);
  const salaryMonth = settlement.salaryMonth || String(settlement.lastWorkingDate).slice(0, 7);
  const regularPayrollRef = doc(db, 'payroll', `${employee.id}_${salaryMonth}`.replace(/[^a-zA-Z0-9_-]/g, '_'));

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(finalRef);
    const regularPayroll = await transaction.get(regularPayrollRef);
    if (existing.exists()) throw new Error('A final settlement already exists for this employee and last working date.');
    if (regularPayroll.exists() && regularPayroll.data().status === 'PAID') {
      throw new Error('A paid monthly payroll record already exists for the final month. Reopen and correct that payroll before processing the final settlement.');
    }
    const common = {
      ...settlement,
      employeeId: employee.id,
      employeeNumber: employee.employeeNumber || '',
      employeeName: employee.name || '',
      designation: employee.designation || '',
      department: employee.department || '',
      workLocation: employee.workLocation || '',
      payrollType: employee.payrollType || 'MONTHLY',
      recordType: 'FINAL_SETTLEMENT',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    transaction.set(finalRef, common);
    transaction.set(historyRef, common);
    if (regularPayroll.exists()) {
      transaction.set(regularPayrollRef, {
        status: 'CANCELLED',
        cancelledReason: 'Replaced by final salary settlement',
        finalSettlementId: settlementId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    transaction.set(employeeRef, {
      status: 'INACTIVE',
      lastWorkingDate: settlement.lastWorkingDate,
      leavingReason: settlement.reasonForLeaving || '',
      finalSettlementId: settlementId,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  });
  await writeActivity('PROCESS FINAL SETTLEMENT', 'finalSettlements', settlementId);
  return settlementId;
}


export async function receivePayment(invoice, payment) {
  const paymentRef = doc(collection(db, 'payments'));
  const invoiceRef = doc(db, 'invoices', invoice.id);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(invoiceRef);
    if (!snapshot.exists()) throw new Error('The selected invoice no longer exists.');
    const current = snapshot.data();
    const previousPaid = Number(current.amountPaid || 0);
    const amount = Number(payment.amount || 0);
    const total = Number(current.total || 0);
    const amountPaid = previousPaid + amount;
    const balanceDue = Math.max(0, total - amountPaid);

    transaction.set(paymentRef, {
      ...payment,
      invoiceId: invoice.id,
      invoiceNumber: current.invoiceNumber,
      customerId: current.customerId || '',
      customerName: current.customerName || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(invoiceRef, {
      amountPaid,
      balanceDue,
      status: balanceDue <= 0 ? 'PAID' : current.status,
      updatedAt: serverTimestamp(),
    });
  });

  await writeActivity('RECEIVE PAYMENT', 'payments', paymentRef.id);
  return paymentRef.id;
}

export async function saveAttendanceSettings(data) {
  const shifts = Array.isArray(data?.shifts) ? data.shifts : [];
  if (!shifts.length) throw new Error('At least one attendance shift is required.');
  if (!shifts.some((shift) => shift.isDefault && shift.active !== false)) {
    throw new Error('Select one active shift as the default shift.');
  }
  await setDoc(doc(db, 'settings', 'attendance'), {
    shifts,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email || '',
  }, { merge: true });
  await writeActivity('UPDATE ATTENDANCE SHIFTS', 'settings', 'attendance');
}


export async function saveAttendanceDocumentRecord(data, existingId = null) {
  if (!data.employeeId || !data.attendanceMonth || !data.documentType) {
    throw new Error('Employee, month and attendance document type are required.');
  }
  const deterministicId = existingId || `${data.employeeId}_${data.attendanceMonth}_${String(data.documentType).toLowerCase()}`
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const reference = doc(db, 'attendanceDocuments', deterministicId);
  await setDoc(reference, {
    ...data,
    generatedAt: data.generatedAt || new Date().toISOString(),
    generatedBy: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  }, { merge: true });
  await writeActivity(`GENERATE ATTENDANCE ${data.documentType}`, 'attendanceDocuments', deterministicId);
  return deterministicId;
}

export async function saveSalarySlipRecord(data, existingId = null) {
  if (!existingId && (!data.employeeId || !data.salaryMonth)) {
    throw new Error('Employee and salary month are required for a salary slip.');
  }
  const deterministicId = existingId || `${data.employeeId}_${data.salaryMonth}_salary-slip`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const salarySlipId = existingId || deterministicId;
  const salarySlipRef = doc(db, 'salarySlips', salarySlipId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(salarySlipRef);
    transaction.set(salarySlipRef, {
      ...data,
      updatedAt: serverTimestamp(),
      ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
  });

  await writeActivity(existingId ? 'UPDATE SALARY SLIP' : 'CREATE SALARY SLIP', 'salarySlips', salarySlipId);
  return salarySlipId;
}


export async function setSalarySlipLock(salarySlipId, locked = true) {
  if (!salarySlipId) throw new Error('A saved salary slip is required.');
  const data = locked ? {
    locked: true,
    lockedAt: serverTimestamp(),
    lockedBy: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
  } : {
    locked: false,
    unlockedAt: serverTimestamp(),
    unlockedBy: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'salarySlips', salarySlipId), data, { merge: true });
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
    paidAt: serverTimestamp(),
    paidBy: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'payroll', payrollId), paidData, { merge: true });
  batch.set(doc(db, 'salarySlips', salarySlipId), paidData, { merge: true });
  await batch.commit();
  await writeActivity('MARK SALARY PAID', 'payroll', payrollId);
  await writeActivity('MARK SALARY SLIP PAID', 'salarySlips', salarySlipId);
}


// ---------------------------------------------------------------------
// DF7 v2.1.8 administration, backup, restore and reset
// ---------------------------------------------------------------------
export const DF7_BACKUP_COLLECTIONS = [
  'userAccess',
  'customers',
  'products',
  'invoices',
  'quotes',
  'employees',
  'attendance',
  'payroll',
  'salarySlips',
  'attendanceDocuments',
  'payrollPeriods',
  'finalSettlements',
  'payments',
  'expenses',
  'billingContracts',
  'budgets',
  'settings',
  'companyAssets',
  'activityLogs',
];

const BACKUP_FORMAT = 'DF7_BUSINESS_BACKUP_V1';

const serializeBackupValue = (value) => {
  if (value instanceof Timestamp) {
    return { __df7Type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (value instanceof Date) {
    return { __df7Type: 'date', value: value.toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeBackupValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeBackupValue(item)]));
  }
  return value;
};

const reviveBackupValue = (value) => {
  if (Array.isArray(value)) return value.map(reviveBackupValue);
  if (value && typeof value === 'object') {
    if (value.__df7Type === 'timestamp' && value.value) return Timestamp.fromDate(new Date(value.value));
    if (value.__df7Type === 'date' && value.value) return new Date(value.value);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveBackupValue(item)]));
  }
  return value;
};

const runBatches = async (operations = []) => {
  for (let start = 0; start < operations.length; start += 400) {
    const batch = writeBatch(db);
    operations.slice(start, start + 400).forEach((operation) => operation(batch));
    await batch.commit();
  }
};

const readCollectionForBackup = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: serializeBackupValue(document.data()),
  }));
};

const deleteTopLevelCollection = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  const operations = snapshot.docs.map((document) => (batch) => batch.delete(document.ref));
  await runBatches(operations);
};

const deleteContractGeneratedPeriods = async () => {
  const contracts = await getDocs(collection(db, 'billingContracts'));
  for (const contract of contracts.docs) {
    const periods = await getDocs(collection(db, 'billingContracts', contract.id, 'generatedPeriods'));
    const operations = periods.docs.map((period) => (batch) => batch.delete(period.ref));
    await runBatches(operations);
  }
};

export async function saveCompanyAsset(assetId, asset) {
  if (!['companyLogo', 'companyStamp', 'managerSignature'].includes(assetId)) {
    throw new Error('Unsupported company asset.');
  }
  if (!asset?.dataUrl || !String(asset.dataUrl).startsWith('data:image/')) {
    throw new Error('A valid optimized image is required.');
  }
  if (String(asset.dataUrl).length > 900_000) {
    throw new Error('The stored image is too large for the company asset record.');
  }

  await setDoc(doc(db, 'companyAssets', assetId), {
    ...asset,
    assetId,
    uploadedAt: serverTimestamp(),
    uploadedBy: auth.currentUser?.email || '',
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await writeActivity('UPLOAD COMPANY ASSET', 'companyAssets', assetId);
}

export async function deleteCompanyAsset(assetId) {
  await deleteDoc(doc(db, 'companyAssets', assetId));
  await writeActivity('DELETE COMPANY ASSET', 'companyAssets', assetId);
}

export async function createApplicationBackup() {
  const collections = {};
  for (const collectionName of DF7_BACKUP_COLLECTIONS) {
    collections[collectionName] = await readCollectionForBackup(collectionName);
  }

  const generatedPeriods = {};
  for (const contract of collections.billingContracts || []) {
    const snapshot = await getDocs(collection(db, 'billingContracts', contract.id, 'generatedPeriods'));
    generatedPeriods[contract.id] = snapshot.docs.map((document) => ({
      id: document.id,
      data: serializeBackupValue(document.data()),
    }));
  }

  const totalDocuments = Object.values(collections)
    .reduce((sum, rows) => sum + rows.length, 0)
    + Object.values(generatedPeriods).reduce((sum, rows) => sum + rows.length, 0);

  return {
    format: BACKUP_FORMAT,
    appVersion: '2.1.8',
    createdAt: new Date().toISOString(),
    createdBy: auth.currentUser?.email || '',
    totalDocuments,
    collections,
    subcollections: {
      billingContractsGeneratedPeriods: generatedPeriods,
    },
  };
}

const validateBackup = (backup) => {
  if (!backup || backup.format !== BACKUP_FORMAT || !backup.collections) {
    throw new Error('This file is not a valid DF7 Business backup.');
  }
  for (const name of Object.keys(backup.collections)) {
    if (!DF7_BACKUP_COLLECTIONS.includes(name)) {
      throw new Error(`The backup contains an unsupported collection: ${name}`);
    }
    if (!Array.isArray(backup.collections[name])) {
      throw new Error(`The backup collection ${name} is invalid.`);
    }
  }
};

export async function resetApplicationData() {
  await deleteContractGeneratedPeriods();

  // Activity logs are deleted last so no stale log remains after reset.
  const collectionOrder = DF7_BACKUP_COLLECTIONS.filter((name) => name !== 'activityLogs');
  for (const collectionName of collectionOrder) {
    await deleteTopLevelCollection(collectionName);
  }
  await deleteTopLevelCollection('activityLogs');
}

export async function restoreApplicationBackup(backup) {
  validateBackup(backup);
  await resetApplicationData();

  for (const collectionName of DF7_BACKUP_COLLECTIONS) {
    const rows = backup.collections[collectionName] || [];
    const operations = rows.map((row) => (batch) => {
      batch.set(doc(db, collectionName, row.id), reviveBackupValue(row.data));
    });
    await runBatches(operations);
  }

  const generatedPeriods = backup.subcollections?.billingContractsGeneratedPeriods || {};
  for (const [contractId, rows] of Object.entries(generatedPeriods)) {
    const operations = (rows || []).map((row) => (batch) => {
      batch.set(
        doc(db, 'billingContracts', contractId, 'generatedPeriods', row.id),
        reviveBackupValue(row.data),
      );
    });
    await runBatches(operations);
  }
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const timestamps = (existing = false) => ({
  updatedAt: serverTimestamp(),
  ...(existing ? {} : { createdAt: serverTimestamp() }),
});

export async function saveRecord(collectionName, data, id = null) {
  if (id) {
    await setDoc(doc(db, collectionName, id), { ...data, ...timestamps(true) }, { merge: true });
    return id;
  }
  const reference = await addDoc(collection(db, collectionName), { ...data, ...timestamps(false) });
  return reference.id;
}

export const deleteRecord = (collectionName, id) => deleteDoc(doc(db, collectionName, id));

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

  return payrollId;
}

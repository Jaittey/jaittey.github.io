import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { currency, dateText, safeNumber } from '../utils/format';

let fallbackLogoPromise = null;
let fallbackPaidPromise = null;

const fetchImageAsDataUrl = (url) => fetch(url)
  .then((response) => {
    if (!response.ok) throw new Error(`Unable to load ${url}`);
    return response.blob();
  })
  .then((blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }));

const loadFallbackLogo = () => {
  if (!fallbackLogoPromise) {
    fallbackLogoPromise = fetchImageAsDataUrl(`${import.meta.env.BASE_URL}images/suite/sb-icon-black.png`);
  }
  return fallbackLogoPromise;
};

const loadFallbackPaid = () => {
  if (!fallbackPaidPromise) {
    fallbackPaidPromise = fetchImageAsDataUrl(`${import.meta.env.BASE_URL}images/documents/paid-stamp.png`);
  }
  return fallbackPaidPromise;
};

const dataUrlFormat = (dataUrl = '') => {
  if (String(dataUrl).startsWith('data:image/jpeg')) return 'JPEG';
  if (String(dataUrl).startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
};

const addImageContained = (doc, dataUrl, x, y, width, height, alias) => {
  if (!dataUrl) return false;
  try {
    const props = doc.getImageProperties(dataUrl);
    const sourceWidth = safeNumber(props?.width);
    const sourceHeight = safeNumber(props?.height);
    let drawWidth = width;
    let drawHeight = height;

    if (sourceWidth > 0 && sourceHeight > 0) {
      const ratio = sourceWidth / sourceHeight;
      drawHeight = drawWidth / ratio;
      if (drawHeight > height) {
        drawHeight = height;
        drawWidth = drawHeight * ratio;
      }
    }

    doc.addImage(
      dataUrl,
      dataUrlFormat(dataUrl),
      x + ((width - drawWidth) / 2),
      y + ((height - drawHeight) / 2),
      drawWidth,
      drawHeight,
      alias,
      'FAST',
    );
    return true;
  } catch (error) {
    console.warn('PDF image skipped:', error);
    return false;
  }
};

const cleanText = (value, fallback = '') => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
};

const normalizeLine = (item = {}) => {
  const qty = Math.max(0, safeNumber(item.quantity ?? item.qty ?? 1));
  const amountCandidate = safeNumber(item.amount);
  let unitPrice = safeNumber(item.price ?? item.unitPrice ?? item.unit_price);
  if (!unitPrice && amountCandidate && qty) unitPrice = amountCandidate / qty;
  const amount = amountCandidate || (qty * unitPrice);

  return {
    description: cleanText(
      item.description
      || item.name
      || item.productName
      || item.serviceName
      || item.label,
      'Item',
    ),
    qty,
    unitPrice,
    amount,
    detail: cleanText(
      item.modifiers?.length
        ? item.modifiers.map((entry) => entry?.name).filter(Boolean).join(', ')
        : (item.sku || item.note || ''),
    ),
  };
};

const normalizeTotals = (record = {}, lines = []) => {
  const calculatedSubtotal = lines.reduce((sum, line) => sum + safeNumber(line.amount), 0);
  const subtotal = safeNumber(record.subtotal ?? calculatedSubtotal);

  const storedDiscount = safeNumber(record.discountAmount ?? record.discount);
  let discountRate = safeNumber(record.discountRate ?? record.discountPercent);
  const discountAmount = storedDiscount
    || (subtotal * Math.min(100, Math.max(0, discountRate)) / 100);
  if (!discountRate && subtotal > 0 && discountAmount > 0) {
    discountRate = (discountAmount / subtotal) * 100;
  }

  const taxableAmount = safeNumber(
    record.taxableAmount ?? Math.max(0, subtotal - discountAmount),
  );

  const storedGst = safeNumber(record.gstAmount ?? record.gst);
  let gstRate = safeNumber(record.gstRate ?? record.gstPercent);
  const gstAmount = storedGst
    || (taxableAmount * Math.min(100, Math.max(0, gstRate)) / 100);
  if (!gstRate && taxableAmount > 0 && gstAmount > 0) {
    gstRate = (gstAmount / taxableAmount) * 100;
  }

  const total = safeNumber(
    record.total ?? (taxableAmount + gstAmount),
  );

  return {
    subtotal,
    discountRate,
    discountAmount,
    taxableAmount,
    gstRate,
    gstAmount,
    total,
  };
};

const wrapped = (doc, value, width) => doc.splitTextToSize(cleanText(value), width);

const writeBlock = (doc, title, lines, x, y, width) => {
  const visible = lines.filter(Boolean);
  if (!visible.length) return y;

  doc.setTextColor(24, 35, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text(title, x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  let cursor = y + 5;

  visible.forEach((line) => {
    const parts = wrapped(doc, line, width);
    doc.text(parts, x, cursor);
    cursor += Math.max(1, parts.length) * 4.1;
  });

  return cursor;
};

const ensureRoom = (doc, y, required = 40) => {
  if (y + required <= 268) return y;
  doc.addPage();
  return 18;
};

const addFooter = (doc, settings = {}) => {
  const pages = doc.getNumberOfPages();
  const details = [
    settings.businessName || 'Small Business Suite',
    settings.phone,
    settings.email,
  ].filter(Boolean).join(' · ');

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(218, 222, 228);
    doc.line(14, 279, 196, 279);
    doc.setTextColor(104, 111, 123);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    if (details) doc.text(doc.splitTextToSize(details, 145), 14, 284);
    doc.text(`Page ${page} of ${pages}`, 196, 284, { align: 'right' });
  }
};

const addAuthorization = async (doc, record, settings, startY) => {
  let y = ensureRoom(doc, Math.max(startY, 205), 62);

  if (y > 232) {
    doc.addPage();
    y = 205;
  }
  if (y < 205) y = 205;

  const signature = settings.managerSignatureDataUrl;
  const companyStamp = settings.companyStampDataUrl;
  const paid = String(record.status || record.paymentStatus || '').toUpperCase() === 'PAID';

  let paidStamp = '';
  if (paid) {
    paidStamp = settings.paidStampDataUrl || '';
    if (!paidStamp) {
      try { paidStamp = await loadFallbackPaid(); } catch { paidStamp = ''; }
    }
  }

  // Company stamp and paid stamp are intentionally separate document assets.
  if (companyStamp) {
    addImageContained(doc, companyStamp, 126, y, 24, 24, 'suite-company-stamp');
  }

  if (paidStamp) {
    addImageContained(doc, paidStamp, 164, y - 3, 28, 28, 'suite-paid-stamp');
  }

  if (signature) {
    addImageContained(doc, signature, 136, y + 22, 42, 14, 'suite-signature');
  }

  doc.setDrawColor(120, 126, 136);
  doc.line(132, y + 40, 191, y + 40);
  doc.setTextColor(55, 62, 73);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.authorizedSignatory || 'Authorized by', 132, y + 45);
  if (settings.designation) doc.text(settings.designation, 132, y + 49);

  return y + 53;
};

export async function createBusinessPdf(kind, record = {}, settings = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const isInvoice = kind === 'invoice';
  const lines = (Array.isArray(record.items) ? record.items : []).map(normalizeLine);
  const totals = normalizeTotals(record, lines);
  const currencyCode = settings.currency || record.currency || 'MVR';
  const gstApplied = totals.gstAmount > 0 || totals.gstRate > 0;
  const discountApplied = totals.discountAmount > 0 || totals.discountRate > 0;

  const title = isInvoice
    ? (settings.gstRegistered && gstApplied ? 'TAX INVOICE' : 'INVOICE')
    : 'PRICE QUOTATION';
  const number = cleanText(
    isInvoice ? record.invoiceNumber : record.quoteNumber,
    'DRAFT',
  );

  doc.setFillColor(247, 244, 237);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(21, 79, 111);
  doc.rect(0, 39, 210, 3, 'F');

  let logo = settings.companyLogoDataUrl;
  if (!logo) {
    try { logo = await loadFallbackLogo(); } catch { logo = ''; }
  }
  const logoAdded = addImageContained(doc, logo, 14, 7, 53, 24, 'suite-logo');
  if (!logoAdded) {
    doc.setTextColor(19, 48, 74);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    doc.text(settings.businessName || 'Small Business Suite', 14, 19);
  }

  doc.setTextColor(19, 48, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 195, 15, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(number, 195, 23, { align: 'right' });
  doc.text(
    `Date: ${dateText(record.documentDate || record.date || record.createdAt || new Date())}`,
    195,
    30,
    { align: 'right' },
  );
  if (!isInvoice && record.validUntil) {
    doc.text(`Valid until: ${dateText(record.validUntil)}`, 195, 36, { align: 'right' });
  }

  const sellerEnd = writeBlock(
    doc,
    settings.businessName || 'BUSINESS',
    [
      settings.address,
      settings.phone ? `Contact: ${settings.phone}` : '',
      settings.email ? `Email: ${settings.email}` : '',
      settings.registrationNumber ? `Registration No: ${settings.registrationNumber}` : '',
      settings.tin ? `TIN: ${settings.tin}` : '',
    ],
    14,
    50,
    82,
  );

  const customerEnd = writeBlock(
    doc,
    'CLIENT / PURCHASER',
    [
      record.customerName ? `Name: ${record.customerName}` : '',
      record.customerDesignation ? `Designation: ${record.customerDesignation}` : '',
      record.customerOrganisation ? `Company / Institution: ${record.customerOrganisation}` : '',
      record.contact ? `Contact: ${record.contact}` : '',
      record.customerAddress ? `Address: ${record.customerAddress}` : '',
    ],
    112,
    50,
    82,
  );

  let y = Math.max(sellerEnd, customerEnd) + 4;

  const metaLeft = [
    record.referenceNumber ? `Reference / PO: ${record.referenceNumber}` : '',
    record.contractNumber ? `Contract: ${record.contractNumber}` : '',
  ].filter(Boolean);
  const metaRight = [
    record.servicePeriod ? `Service period: ${record.servicePeriod}` : '',
    isInvoice && record.paymentMethod ? `Payment: ${record.paymentMethod}` : '',
    isInvoice && record.paymentReference ? `Payment reference: ${record.paymentReference}` : '',
  ].filter(Boolean);

  if (metaLeft.length || metaRight.length) {
    const rows = Math.max(metaLeft.length, metaRight.length);
    const heights = Array.from({ length: rows }, (_, i) => Math.max(
      metaLeft[i] ? wrapped(doc, metaLeft[i], 78).length : 1,
      metaRight[i] ? wrapped(doc, metaRight[i], 78).length : 1,
    ) * 4.1 + 1);
    const boxHeight = 7 + heights.reduce((sum, value) => sum + value, 0);
    y = ensureRoom(doc, y, boxHeight + 8);
    doc.setFillColor(247, 249, 251);
    doc.roundedRect(14, y, 182, boxHeight, 2, 2, 'F');
    doc.setTextColor(45, 51, 62);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let cursor = y + 6;
    for (let i = 0; i < rows; i += 1) {
      if (metaLeft[i]) doc.text(wrapped(doc, metaLeft[i], 78), 18, cursor);
      if (metaRight[i]) doc.text(wrapped(doc, metaRight[i], 78), 108, cursor);
      cursor += heights[i];
    }
    y += boxHeight + 6;
  } else {
    y += 3;
  }

  if (!isInvoice && record.introduction) {
    y = ensureRoom(doc, y, 24);
    y = writeBlock(
      doc,
      'INTRODUCTION / INQUIRY REFERENCE',
      [record.introduction],
      14,
      y,
      182,
    ) + 2;
  }

  if (!isInvoice && record.scopeOfWork) {
    y = ensureRoom(doc, y, 28);
    y = writeBlock(
      doc,
      'SCOPE OF WORK / DELIVERABLES',
      [record.scopeOfWork],
      14,
      y,
      182,
    ) + 2;
  }

  autoTable(doc, {
    startY: y,
    head: [['Description / Deliverable', 'Qty', 'Unit Price', 'Amount']],
    body: lines.length
      ? lines.map((line) => [
          line.detail ? `${line.description}\n${line.detail}` : line.description,
          String(line.qty),
          currency(line.unitPrice, currencyCode),
          currency(line.amount, currencyCode),
        ])
      : [['No line items recorded', '', '', '']],
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 25 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [21, 79, 111],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.6,
      cellPadding: 3.2,
    },
    styles: {
      font: 'helvetica',
      fontStyle: 'normal',
      fontSize: 8.3,
      textColor: [39, 44, 53],
      lineColor: [205, 209, 215],
      lineWidth: 0.25,
      cellPadding: 3.2,
      overflow: 'linebreak',
      valign: 'top',
      minCellHeight: 8,
    },
    alternateRowStyles: {
      fillColor: [252, 252, 252],
    },
    columnStyles: {
      0: { cellWidth: 91, halign: 'left' },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 36, halign: 'right' },
    },
  });

  let finalY = (doc.lastAutoTable?.finalY || y) + 7;
  const amountX = 194;
  finalY = ensureRoom(doc, finalY, 48);

  doc.setTextColor(39, 44, 53);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);

  const totalRow = (label, amount, { bold = false, negative = false } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(label, 138, finalY);
    doc.text(
      `${negative ? '- ' : ''}${currency(amount, currencyCode)}`,
      amountX,
      finalY,
      { align: 'right' },
    );
    finalY += bold ? 6 : 5;
  };

  totalRow('Subtotal', totals.subtotal);

  if (discountApplied) {
    totalRow(
      `Discount${totals.discountRate > 0 ? ` (${totals.discountRate.toFixed(2)}%)` : ''}`,
      totals.discountAmount,
      { negative: true },
    );
  }

  if (discountApplied || gstApplied) {
    totalRow('Taxable amount', totals.taxableAmount);
  }

  if (gstApplied) {
    totalRow(
      `GST${totals.gstRate > 0 ? ` (${totals.gstRate.toFixed(2)}%)` : ''}`,
      totals.gstAmount,
    );
  }

  doc.setDrawColor(21, 79, 111);
  doc.line(136, finalY - 2, 194, finalY - 2);
  finalY += 3;
  doc.setFontSize(11.5);
  totalRow('TOTAL', totals.total, { bold: true });

  if (isInvoice && (record.cashReceived || record.changeDue)) {
    doc.setFontSize(8.2);
    if (safeNumber(record.cashReceived) > 0) {
      totalRow('Cash received', safeNumber(record.cashReceived));
    }
    if (safeNumber(record.changeDue) > 0) {
      totalRow('Change', safeNumber(record.changeDue));
    }
  }

  let notesY = finalY + 6;

  if (record.terms) {
    notesY = ensureRoom(doc, notesY, 35);
    notesY = writeBlock(doc, 'TERMS AND CONDITIONS', [record.terms], 14, notesY, 118) + 3;
  }

  if (!isInvoice && record.declaration) {
    notesY = ensureRoom(doc, notesY, 35);
    notesY = writeBlock(doc, 'DECLARATION', [record.declaration], 14, notesY, 118) + 3;
  }

  if (isInvoice && settings.bankName && settings.bankAccountNumber) {
    notesY = ensureRoom(doc, notesY, 28);
    notesY = writeBlock(
      doc,
      'PAYMENT / BANK DETAILS',
      [
        settings.bankName,
        settings.bankAccountName ? `Account name: ${settings.bankAccountName}` : '',
        `Account number: ${settings.bankAccountNumber}`,
      ],
      14,
      notesY,
      118,
    ) + 2;
  }

  await addAuthorization(doc, record, settings, notesY);
  addFooter(doc, settings);

  return doc.output('blob');
}

export const previewBlob = (blob) => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const downloadBlob = (blob, fileName = 'document.pdf') => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
};

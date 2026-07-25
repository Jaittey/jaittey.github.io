import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { currency, dateText, safeNumber } from '../utils/format';

let paidStampDataUrlPromise = null;
let companyLogoDataUrlPromise = null;

function fetchImageAsDataUrl(url, errorMessage) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(errorMessage);
      return response.blob();
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(errorMessage));
      reader.readAsDataURL(blob);
    }));
}

function loadPaidStampAsDataUrl() {
  if (!paidStampDataUrlPromise) {
    paidStampDataUrlPromise = fetchImageAsDataUrl(
      `${import.meta.env.BASE_URL}images/DF7_PAID.png`,
      'Unable to load the PAID stamp image.',
    );
  }
  return paidStampDataUrlPromise;
}

function loadCompanyLogoAsDataUrl() {
  if (!companyLogoDataUrlPromise) {
    companyLogoDataUrlPromise = fetchImageAsDataUrl(
      `${import.meta.env.BASE_URL}images/DF7_Logo.png`,
      'Unable to load the company logo.',
    );
  }
  return companyLogoDataUrlPromise;
}

async function addPaidStamp(doc, record, finalY) {
  if (String(record.status || '').toUpperCase() !== 'PAID') return;
  try {
    const stamp = await loadPaidStampAsDataUrl();
    const stampSize = 42;
    const stampY = Math.min(Math.max(finalY + 10, 190), 230);
    doc.addImage(stamp, 'PNG', 16, stampY, stampSize, stampSize, 'df7-paid-stamp', 'FAST', -8);
  } catch (error) {
    console.warn(error);
  }
}

async function addCompanyLogo(doc) {
  try {
    const logo = await loadCompanyLogoAsDataUrl();
    doc.addImage(logo, 'PNG', 14, 7, 55, 28, 'df7-company-logo', 'FAST');
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

const writeWrapped = (doc, text, x, y, width, lineHeight = 4.5) => {
  const lines = doc.splitTextToSize(String(text || '—'), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const addPageFooter = (doc, settings) => {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(210, 214, 220);
    doc.line(14, 279, 196, 279);
    doc.setTextColor(100, 105, 115);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${settings.businessName || 'DF7'} · ${settings.phone || ''} · ${settings.email || ''}`,
      14,
      285,
    );
    doc.text(`Page ${page} of ${pages}`, 196, 285, { align: 'right' });
  }
};

export async function createBusinessPdf(kind, record, settings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const isInvoice = kind === 'invoice';
  const gstApplied = safeNumber(record.gstRate) > 0;
  const title = isInvoice
    ? (settings.gstRegistered && gstApplied ? 'TAX INVOICE' : 'INVOICE')
    : 'PRICE QUOTATION';
  const number = isInvoice ? record.invoiceNumber : record.quoteNumber;
  const code = settings.currency || 'MVR';

  doc.setFillColor(244, 240, 231);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(17, 45, 78);
  doc.rect(0, 39, 210, 3, 'F');

  const logoAdded = await addCompanyLogo(doc);
  if (!logoAdded) {
    doc.setTextColor(17, 45, 78);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.businessName || 'DF7', 16, 19);
  }

  doc.setTextColor(17, 45, 78);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 194, 16, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(number || 'DRAFT', 194, 24, { align: 'right' });
  doc.text(`Date: ${dateText(record.documentDate || record.createdAt || new Date())}`, 194, 30, { align: 'right' });
  if (isInvoice && record.dueDate) doc.text(`Due: ${dateText(record.dueDate)}`, 194, 35, { align: 'right' });
  if (!isInvoice && record.validUntil) doc.text(`Valid until: ${dateText(record.validUntil)}`, 194, 35, { align: 'right' });

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'DF7', 14, 50);
  doc.setFont('helvetica', 'normal');

  let sellerY = 55;
  const sellerLines = [
    settings.address,
    settings.phone ? `Contact: ${settings.phone}` : '',
    settings.email ? `Email: ${settings.email}` : '',
    settings.registrationNumber ? `Registration No: ${settings.registrationNumber}` : '',
    settings.tin ? `TIN: ${settings.tin}` : '',
  ].filter(Boolean);
  sellerLines.forEach((line) => {
    sellerY = writeWrapped(doc, line, 14, sellerY, 82, 4.2);
  });

  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT / PURCHASER', 112, 50);
  doc.setFont('helvetica', 'normal');
  let clientY = 55;
  [
    record.customerName ? `Name: ${record.customerName}` : '',
    record.customerDesignation ? `Designation: ${record.customerDesignation}` : '',
    record.customerOrganisation ? `Institution: ${record.customerOrganisation}` : '',
    record.contact ? `Contact: ${record.contact}` : '',
    record.customerAddress ? `Address: ${record.customerAddress}` : '',
  ].filter(Boolean).forEach((line) => {
    clientY = writeWrapped(doc, line, 112, clientY, 82, 4.2);
  });

  const metaY = Math.max(sellerY, clientY) + 3;
  doc.setFillColor(247, 249, 251);
  doc.roundedRect(14, metaY, 182, 18, 2, 2, 'F');
  doc.setTextColor(50, 55, 65);
  doc.setFontSize(8);
  const leftMeta = [
    record.referenceNumber ? `Reference / PO: ${record.referenceNumber}` : 'Reference / PO: —',
    record.contractNumber ? `Contract: ${record.contractNumber}` : 'Contract: —',
  ];
  const rightMeta = [
    record.servicePeriod ? `Service period: ${record.servicePeriod}` : 'Service period: —',
    isInvoice
      ? `Payment: ${record.paymentMethod || '—'}`
      : `Validity: ${dateText(record.validUntil)}`,
  ];
  doc.text(leftMeta, 18, metaY + 6);
  doc.text(rightMeta, 108, metaY + 6);

  let contentY = metaY + 25;

  if (!isInvoice && record.introduction) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('INTRODUCTION / INQUIRY REFERENCE', 14, contentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    contentY = writeWrapped(doc, record.introduction, 14, contentY + 5, 182, 4.3) + 3;
  }

  if (!isInvoice && record.scopeOfWork) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('SCOPE OF WORK / DELIVERABLES', 14, contentY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    contentY = writeWrapped(doc, record.scopeOfWork, 14, contentY + 5, 182, 4.3) + 3;
  }

  autoTable(doc, {
    startY: contentY,
    head: [['Description / Deliverable', 'Qty', 'Unit Price', 'Amount']],
    body: (record.items || []).map((item) => [
      item.description,
      String(item.quantity),
      currency(item.price, code),
      currency(Number(item.quantity) * Number(item.price), code),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [17, 73, 105], textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 3.2 },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { halign: 'right', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 38 },
    },
    margin: { left: 14, right: 14 },
  });

  let finalY = doc.lastAutoTable.finalY + 7;
  const amountX = 194;
  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', 142, finalY);
  doc.text(currency(record.subtotal ?? record.total, code), amountX, finalY, { align: 'right' });
  finalY += 5;
  doc.text(`Discount (${safeNumber(record.discountRate).toFixed(2)}%)`, 142, finalY);
  doc.text(`- ${currency(record.discountAmount, code)}`, amountX, finalY, { align: 'right' });
  finalY += 5;
  doc.text('Taxable amount', 142, finalY);
  doc.text(currency(record.taxableAmount ?? record.total, code), amountX, finalY, { align: 'right' });
  finalY += 5;
  doc.text(`GST (${safeNumber(record.gstRate).toFixed(2)}%)`, 142, finalY);
  doc.text(currency(record.gstAmount, code), amountX, finalY, { align: 'right' });
  finalY += 7;
  doc.setDrawColor(17, 73, 105);
  doc.line(140, finalY - 4, 194, finalY - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', 142, finalY);
  doc.text(currency(record.total, code), amountX, finalY, { align: 'right' });

  if (isInvoice) await addPaidStamp(doc, record, finalY);

  let notesY = Math.max(finalY + 12, 205);
  if (notesY > 250) {
    doc.addPage();
    notesY = 20;
  }

  if (record.terms) {
    doc.setTextColor(45, 51, 62);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TERMS AND CONDITIONS', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    notesY = writeWrapped(doc, record.terms, 14, notesY + 5, 182, 4.2) + 4;
  }

  if (!isInvoice && record.declaration) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('DECLARATION', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    notesY = writeWrapped(doc, record.declaration, 14, notesY + 5, 182, 4.2) + 4;
  }

  if (isInvoice && (settings.bankName || settings.bankAccountNumber)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('PAYMENT DETAILS', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    [
      settings.bankName ? `Bank: ${settings.bankName}` : '',
      settings.bankAccountName ? `Account name: ${settings.bankAccountName}` : '',
      settings.bankAccountNumber ? `Account number: ${settings.bankAccountNumber}` : '',
    ].filter(Boolean).forEach((line, index) => doc.text(line, 14, notesY + 5 + index * 4.2));
    notesY += 20;
  }

  if (settings.authorizedSignatory) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Authorized by:', 142, notesY);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.authorizedSignatory, 142, notesY + 6);
    doc.setFont('helvetica', 'normal');
    if (settings.designation) doc.text(settings.designation, 142, notesY + 11);
    doc.line(142, notesY + 18, 194, notesY + 18);
    doc.text('Authorized signature / company stamp', 142, notesY + 23);
  }

  addPageFooter(doc, settings);
  return doc.output('blob');
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function previewBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


export async function createSalarySlipPdf(record, settings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const code = settings.currency || 'MVR';

  doc.setFillColor(244, 240, 231);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(17, 45, 78);
  doc.rect(0, 39, 210, 3, 'F');
  await addCompanyLogo(doc);

  doc.setTextColor(17, 45, 78);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SALARY SLIP', 194, 16, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(record.salarySlipNumber || 'DRAFT', 194, 24, { align: 'right' });
  doc.text(record.salaryMonth ? salaryMonthLabelForPdf(record.salaryMonth) : '—', 194, 31, { align: 'right' });

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'DF7', 14, 51);
  doc.setFont('helvetica', 'normal');
  let companyY = 56;
  [settings.address, settings.phone && `Contact: ${settings.phone}`, settings.email && `Email: ${settings.email}`]
    .filter(Boolean).forEach((line) => { companyY = writeWrapped(doc, line, 14, companyY, 82, 4.2); });

  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE DETAILS', 112, 51);
  doc.setFont('helvetica', 'normal');
  const employeeLines = [
    `Employee ID: ${record.employeeNumber || '—'}`,
    `Name: ${record.employeeName || '—'}`,
    `Designation: ${record.designation || '—'}`,
    `Department: ${record.department || '—'}`,
  ];
  employeeLines.forEach((line, index) => doc.text(line, 112, 56 + index * 4.5));

  const startY = Math.max(companyY, 76) + 8;
  autoTable(doc, {
    startY,
    head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
    body: [
      ['Basic salary', currency(record.basicSalary, code), 'Late deduction', currency(record.lateDeduction, code)],
      [`Overtime (${Number(record.overtimeHours || 0).toFixed(2)} hrs × ${currency(record.overtimeRate, code)})`, currency(record.overtimeAmount, code), 'Absent deduction', currency(record.absentDeduction, code)],
      ['Allowances', currency(record.allowances, code), 'Loan deduction', currency(record.loanDeduction, code)],
      ['Bonus', currency(record.bonus, code), 'Advance deduction', currency(record.advanceDeduction, code)],
      ['Other earnings', currency(record.otherEarnings, code), 'Other deductions', currency(record.otherDeductions, code)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [17, 73, 105], textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 3.4 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { halign: 'right', cellWidth: 36 }, 2: { cellWidth: 55 }, 3: { halign: 'right', cellWidth: 36 } },
    margin: { left: 14, right: 14 },
  });

  let y = doc.lastAutoTable.finalY + 9;
  doc.setFillColor(247, 249, 251);
  doc.roundedRect(106, y, 90, 36, 2, 2, 'F');
  doc.setTextColor(45, 51, 62);
  doc.setFontSize(9);
  doc.text('Gross salary', 112, y + 9);
  doc.text(currency(record.grossSalary, code), 190, y + 9, { align: 'right' });
  doc.text('Total deductions', 112, y + 17);
  doc.text(`- ${currency(record.totalDeductions, code)}`, 190, y + 17, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 73, 105);
  doc.text('NET SALARY', 112, y + 29);
  doc.text(currency(record.netSalary, code), 190, y + 29, { align: 'right' });

  doc.setTextColor(45, 51, 62);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Status: ${record.status || 'DRAFT'}`, 14, y + 9);
  doc.text(`Payment method: ${record.paymentMethod || '—'}`, 14, y + 17);
  doc.text(`Payment date: ${dateText(record.paymentDate)}`, 14, y + 25);

  if (record.notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', 14, y + 49);
    doc.setFont('helvetica', 'normal');
    writeWrapped(doc, record.notes, 14, y + 54, 182, 4.2);
  }

  const signatureY = 234;
  doc.line(14, signatureY, 70, signatureY);
  doc.line(140, signatureY, 196, signatureY);
  doc.setFontSize(8);
  doc.text('Employee signature', 14, signatureY + 5);
  doc.text('Authorized signature / company stamp', 140, signatureY + 5);
  if (settings.authorizedSignatory) {
    doc.setFont('helvetica', 'bold');
    doc.text(settings.authorizedSignatory, 140, signatureY - 5);
    doc.setFont('helvetica', 'normal');
  }

  addPageFooter(doc, settings);
  return doc.output('blob');
}

function salaryMonthLabelForPdf(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return '—';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

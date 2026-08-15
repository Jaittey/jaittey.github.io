import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { currency, dateText, safeNumber } from '../utils/format';
import { attendanceStatusLabel, deriveAttendance, payrollTypeLabel, summarizeAttendance, timeRangeLabel24 } from '../utils/payroll';

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
      `${import.meta.env.BASE_URL}images/PAID.png`,
      'Unable to load the PAID stamp image.',
    );
  }
  return paidStampDataUrlPromise;
}

function loadCompanyLogoAsDataUrl() {
  if (!companyLogoDataUrlPromise) {
    companyLogoDataUrlPromise = fetchImageAsDataUrl(
      `${import.meta.env.BASE_URL}images/SB_Logo.png`,
      'Unable to load the company logo.',
    );
  }
  return companyLogoDataUrlPromise;
}

const dataUrlFormat = (dataUrl = '') => {
  if (String(dataUrl).startsWith('data:image/jpeg')) return 'JPEG';
  if (String(dataUrl).startsWith('data:image/webp')) return 'WEBP';
  return 'PNG';
};

const addUploadedImage = (doc, dataUrl, x, y, width, height, alias) => {
  if (!dataUrl) return false;
  try {
    doc.addImage(dataUrl, dataUrlFormat(dataUrl), x, y, width, height, alias, 'FAST');
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
};

async function addPaidStamp(doc, record, y, options = {}, settings = {}) {
  if (String(record.status || record.paymentStatus || '').toUpperCase() !== 'PAID') return false;
  try {
    const stamp = settings.paidStampDataUrl || await loadPaidStampAsDataUrl();
    const stampSize = safeNumber(options.size) || 38;
    const stampX = safeNumber(options.x) || 154;
    const maxY = 274 - stampSize;
    const stampY = Math.max(18, Math.min(y, maxY));
    doc.addImage(stamp, 'PNG', stampX, stampY, stampSize, stampSize, options.alias || 'df7-paid-stamp', 'FAST');
    return true;
  } catch (error) {
    console.warn(error);
    return false;
  }
}

async function addCompanyLogo(doc, settings = {}) {
  try {
    const logo = settings.companyLogoDataUrl || await loadCompanyLogoAsDataUrl();
    return addUploadedImage(doc, logo, 14, 7, 55, 28, 'df7-company-logo');
  } catch (error) {
    console.warn(error);
    return false;
  }
}

function addManagerSignature(doc, settings = {}, x = 142, y = 238, width = 38, height = 12) {
  return addUploadedImage(doc, settings.managerSignatureDataUrl, x, y, width, height, 'df7-manager-signature');
}

function addCompanyStamp(doc, settings = {}, x = 174, y = 232, size = 20) {
  return addUploadedImage(doc, settings.companyStampDataUrl, x, y, size, size, 'df7-company-stamp');
}

const writeWrapped = (doc, text, x, y, width, lineHeight = 4.5) => {
  const lines = doc.splitTextToSize(String(text || ''), width);
  if (lines.length) doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const addPageFooter = (doc, settings) => {
  const pages = doc.getNumberOfPages();
  const companyDetails = [settings.businessName || 'Small Business', settings.phone, settings.email]
    .filter(Boolean)
    .join(' · ');
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(210, 214, 220);
    doc.line(14, 279, 196, 279);
    doc.setTextColor(100, 105, 115);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(companyDetails, 14, 285);
    doc.text(`Page ${page} of ${pages}`, 196, 285, { align: 'right' });
  }
};

function renderOptionalMeta(doc, y, leftEntries, rightEntries) {
  const left = leftEntries.filter(Boolean);
  const right = rightEntries.filter(Boolean);
  if (!left.length && !right.length) return y;

  const rows = Math.max(left.length, right.length);
  const rowHeights = Array.from({ length: rows }, (_, index) => {
    const leftLines = left[index] ? doc.splitTextToSize(left[index], 79).length : 0;
    const rightLines = right[index] ? doc.splitTextToSize(right[index], 79).length : 0;
    return Math.max(leftLines, rightLines, 1) * 4.2 + 1.2;
  });
  const boxHeight = 7 + rowHeights.reduce((sum, height) => sum + height, 0);

  doc.setFillColor(247, 249, 251);
  doc.roundedRect(14, y, 182, boxHeight, 2, 2, 'F');
  doc.setTextColor(50, 55, 65);
  doc.setFontSize(8);

  let cursor = y + 6;
  for (let index = 0; index < rows; index += 1) {
    if (left[index]) doc.text(doc.splitTextToSize(left[index], 79), 18, cursor);
    if (right[index]) doc.text(doc.splitTextToSize(right[index], 79), 108, cursor);
    cursor += rowHeights[index];
  }

  return y + boxHeight + 7;
}

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

  const logoAdded = await addCompanyLogo(doc, settings);
  if (!logoAdded) {
    doc.setTextColor(17, 45, 78);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.businessName || 'Small Business', 16, 19);
  }

  doc.setTextColor(17, 45, 78);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 194, 16, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(number || 'DRAFT', 194, 24, { align: 'right' });
  doc.text(`Date: ${dateText(record.documentDate || record.createdAt || new Date())}`, 194, 31, { align: 'right' });
  // Invoices intentionally do not show a due date.
  if (!isInvoice && record.validUntil) doc.text(`Valid until: ${dateText(record.validUntil)}`, 194, 36, { align: 'right' });

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'Small Business', 14, 50);
  doc.setFont('helvetica', 'normal');

  let sellerY = 55;
  [
    settings.address,
    settings.phone ? `Contact: ${settings.phone}` : '',
    settings.email ? `Email: ${settings.email}` : '',
    settings.registrationNumber ? `Registration No: ${settings.registrationNumber}` : '',
    settings.tin ? `TIN: ${settings.tin}` : '',
  ].filter(Boolean).forEach((line) => {
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

  const metaStart = Math.max(sellerY, clientY) + 4;
  let contentY = renderOptionalMeta(
    doc,
    metaStart,
    [
      record.referenceNumber ? `Reference / PO: ${record.referenceNumber}` : '',
      record.contractNumber ? `Contract: ${record.contractNumber}` : '',
    ],
    [
      record.servicePeriod ? `Service period: ${record.servicePeriod}` : '',
      isInvoice && record.paymentMethod ? `Payment: ${record.paymentMethod}` : '',
    ],
  );
  if (contentY === metaStart) contentY += 5;

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
  const discountApplied = safeNumber(record.discountAmount) > 0 || safeNumber(record.discountRate) > 0;
  const showTaxable = discountApplied || gstApplied;

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal', 142, finalY);
  doc.text(currency(record.subtotal ?? record.total, code), amountX, finalY, { align: 'right' });
  finalY += 5;

  if (discountApplied) {
    doc.text(`Discount (${safeNumber(record.discountRate).toFixed(2)}%)`, 142, finalY);
    doc.text(`- ${currency(record.discountAmount, code)}`, amountX, finalY, { align: 'right' });
    finalY += 5;
  }

  if (showTaxable) {
    doc.text('Taxable amount', 142, finalY);
    doc.text(currency(record.taxableAmount ?? record.total, code), amountX, finalY, { align: 'right' });
    finalY += 5;
  }

  if (gstApplied) {
    doc.text(`GST (${safeNumber(record.gstRate).toFixed(2)}%)`, 142, finalY);
    doc.text(currency(record.gstAmount, code), amountX, finalY, { align: 'right' });
    finalY += 5;
  }

  finalY += 2;
  doc.setDrawColor(17, 73, 105);
  doc.line(140, finalY - 4, 194, finalY - 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', 142, finalY);
  doc.text(currency(record.total, code), amountX, finalY, { align: 'right' });

  let notesY = Math.max(finalY + 12, 190);
  if (notesY > 237) {
    doc.addPage();
    notesY = 22;
  }

  const paid = isInvoice && String(record.status || '').toUpperCase() === 'PAID';
  const notesStartY = notesY;
  const textWidth = paid ? 122 : 182;

  if (record.terms) {
    doc.setTextColor(45, 51, 62);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TERMS AND CONDITIONS', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    notesY = writeWrapped(doc, record.terms, 14, notesY + 5, textWidth, 4.2) + 5;
  }

  if (!isInvoice && record.declaration) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('DECLARATION', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    notesY = writeWrapped(doc, record.declaration, 14, notesY + 5, 182, 4.2) + 5;
  }

  const bankLines = isInvoice ? [
    settings.bankName ? `Bank: ${settings.bankName}` : '',
    settings.bankAccountName ? `Account name: ${settings.bankAccountName}` : '',
    settings.bankAccountNumber ? `Account number: ${settings.bankAccountNumber}` : '',
  ].filter(Boolean) : [];

  if (bankLines.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('PAYMENT DETAILS', 14, notesY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    bankLines.forEach((line, index) => doc.text(line, 14, notesY + 5 + index * 4.2));
    notesY += 7 + bankLines.length * 4.2;
  }

  if (paid) await addPaidStamp(doc, record, notesStartY + 2, {}, settings);

  if (settings.authorizedSignatory || settings.managerSignatureDataUrl || settings.companyStampDataUrl) {
    let signatureY = Math.max(notesY + 5, paid ? notesStartY + 46 : notesY + 5);
    if (signatureY > 248) {
      doc.addPage();
      signatureY = 35;
    }
    doc.setTextColor(45, 51, 62);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    addManagerSignature(doc, settings, 142, signatureY - 12, 34, 10);
    addCompanyStamp(doc, settings, 176, signatureY - 15, 17);
    doc.text('Authorized by:', 142, signatureY);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.authorizedSignatory, 142, signatureY + 6);
    doc.setFont('helvetica', 'normal');
    if (settings.designation) doc.text(settings.designation, 142, signatureY + 11);
    doc.line(142, signatureY + 18, 194, signatureY + 18);
    doc.text('Authorized signature / company stamp', 142, signatureY + 23);
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
  const isFinal = record.recordType === 'FINAL_SETTLEMENT';
  const isDaily = record.payrollType === 'DAILY';
  const paid = record.status === 'PAID' || record.paymentStatus === 'PAID' || record.settlementStatus === 'PAID';

  doc.setFillColor(244, 240, 231);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(17, 45, 78);
  doc.rect(0, 39, 210, 3, 'F');
  await addCompanyLogo(doc, settings);

  doc.setTextColor(17, 45, 78);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isFinal ? 14 : 17);
  doc.text(isFinal ? 'FINAL SALARY SETTLEMENT' : 'SALARY SLIP', 194, 15, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(record.salarySlipNumber || 'DRAFT', 194, 24, { align: 'right' });
  doc.text(record.salaryMonth ? salaryMonthLabelForPdf(record.salaryMonth) : '—', 194, 31, { align: 'right' });

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'Dhinasha Family 7', 14, 51);
  doc.setFont('helvetica', 'normal');
  let companyY = 56;
  [settings.address, settings.phone && `Contact: ${settings.phone}`, settings.email && `Email: ${settings.email}`]
    .filter(Boolean).forEach((line) => { companyY = writeWrapped(doc, line, 14, companyY, 82, 4.2); });

  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE DETAILS', 108, 51);
  doc.setFont('helvetica', 'normal');
  const employeeLines = [
    `Employee ID: ${record.employeeNumber || '—'}`,
    `Name: ${record.employeeName || '—'}`,
    record.designation ? `Job title: ${record.designation}` : '',
    record.workLocation ? `Work location: ${record.workLocation}` : '',
  ].filter(Boolean);
  employeeLines.forEach((line, index) => doc.text(line, 108, 56 + index * 4.5));

  let y = Math.max(companyY, 76) + 6;
  // Salary slips contain only a concise monthly attendance summary.
  // Detailed day-by-day records are available in the separate Attendance Report PDF.
  autoTable(doc, {
    startY: y,
    body: [
      ['Payroll type', isDaily ? 'Daily-Based Salary' : 'Monthly-Based Salary', 'Salary month', record.salaryMonth ? salaryMonthLabelForPdf(record.salaryMonth) : '—'],
      ['Attendance summary', `${safeNumber(record.totalWorkingDays).toFixed(0)} worked · ${safeNumber(record.totalHoursWorked).toFixed(2)} hrs`, 'OT / Missed', `${safeNumber(record.totalOvertimeHours ?? record.overtimeHours).toFixed(2)} / ${safeNumber(record.totalMissedHours).toFixed(2)} hrs`],
    ],
    theme: 'grid',
    styles: { fontSize: 8.2, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 1: { cellWidth: 56 }, 2: { fontStyle: 'bold', cellWidth: 35 }, 3: { cellWidth: 56 } },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 7;
  const baseLabel = isFinal
    ? 'Prorated basic salary'
    : (isDaily ? `Hourly earnings (${safeNumber(record.totalHoursWorked).toFixed(2)} hrs × ${currency(record.hourlyRate, code)})` : 'Fixed monthly salary');
  const baseValue = isFinal
    ? safeNumber(record.proratedBasicSalary ?? record.basicSalary)
    : (isDaily ? safeNumber(record.hourlyEarnings ?? record.basicSalary) : safeNumber(record.fixedSalary ?? record.basicSalary));
  const overtimePay = safeNumber(record.overtimePay ?? record.overtimeAmount);
  const missedDeduction = safeNumber(record.missedDutyDeduction);
  const otherAdditions = safeNumber(record.otherAdditions ?? record.allowances)
    + safeNumber(record.customAddition)
    + safeNumber(record.bonus)
    + safeNumber(record.otherEarnings);
  const otherDeductions = safeNumber(record.otherDeductions)
    + safeNumber(record.customDeduction)
    + safeNumber(record.lateDeduction)
    + safeNumber(record.absentDeduction)
    + safeNumber(record.loanDeduction)
    + safeNumber(record.advanceDeduction);

  autoTable(doc, {
    startY: y,
    head: [['Earnings', 'Amount', 'Deductions', 'Amount']],
    body: [
      [baseLabel, currency(baseValue, code), isDaily ? 'Other deductions' : 'Missed-duty deduction', currency(isDaily ? otherDeductions : missedDeduction, code)],
      ['Overtime pay', currency(overtimePay, code), isDaily ? '—' : 'Other deductions', currency(isDaily ? 0 : otherDeductions, code)],
      ['Other additions', currency(otherAdditions, code), 'Total deductions', currency(record.totalDeductions, code)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [17, 73, 105], textColor: 255 },
    styles: { fontSize: 8.2, cellPadding: 3.2 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { halign: 'right', cellWidth: 36 }, 2: { cellWidth: 55 }, 3: { halign: 'right', cellWidth: 36 } },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(247, 249, 251);
  doc.roundedRect(106, y, 90, 34, 2, 2, 'F');
  doc.setTextColor(45, 51, 62);
  doc.setFontSize(9);
  doc.text('Gross salary', 112, y + 9);
  doc.text(currency(record.grossSalary, code), 190, y + 9, { align: 'right' });
  doc.text('Total deductions', 112, y + 17);
  doc.text(`- ${currency(record.totalDeductions, code)}`, 190, y + 17, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 73, 105);
  doc.text(isFinal ? 'FINAL NET AMOUNT' : 'NET SALARY', 112, y + 28);
  doc.text(currency(record.finalNetAmount ?? record.netSalary, code), 190, y + 28, { align: 'right' });

  doc.setTextColor(45, 51, 62);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Payment status: ${record.status || record.settlementStatus || 'DRAFT'}`, 14, y + 8);
  if (record.paymentMethod) doc.text(`Payment method: ${record.paymentMethod}`, 14, y + 16);
  if (record.paymentDate) doc.text(`Payment date: ${dateText(record.paymentDate)}`, 14, y + 24);
  if (record.approvalDate) doc.text(`Slip approval date: ${dateText(record.approvalDate)}`, 14, y + 32);
  if (isFinal && record.lastWorkingDate) doc.text(`Last working date: ${dateText(record.lastWorkingDate)}`, 14, y + 40);

  let notesY = y + (record.approvalDate || (isFinal && record.lastWorkingDate) ? 51 : 43);
  if (isFinal && record.reasonForLeaving) {
    doc.setFont('helvetica', 'bold');
    doc.text('REASON FOR LEAVING', 14, notesY);
    doc.setFont('helvetica', 'normal');
    notesY = writeWrapped(doc, record.reasonForLeaving, 14, notesY + 5, 182, 4.2) + 3;
  }
  if (Math.abs(safeNumber(record.issuedSalaryAmount ?? record.netSalary) - safeNumber(record.calculatedPayrollAmount ?? record.netSalary)) > 0.009) {
    doc.setFont('helvetica', 'bold');
    doc.text('CUSTOM SALARY ADJUSTMENT', 14, notesY);
    doc.setFont('helvetica', 'normal');
    const differenceText = `Calculated payroll: ${currency(record.calculatedPayrollAmount, code)} · Issued salary: ${currency(record.issuedSalaryAmount ?? record.netSalary, code)}`;
    notesY = writeWrapped(doc, differenceText, 14, notesY + 5, 182, 4.2) + 1;
    if (record.adjustmentReason) notesY = writeWrapped(doc, `Reason: ${record.adjustmentReason}`, 14, notesY + 4, 182, 4.2) + 3;
  }
  const notes = record.notes || record.adjustmentNotes;
  if (notes) {
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', 14, notesY);
    doc.setFont('helvetica', 'normal');
    notesY = writeWrapped(doc, notes, 14, notesY + 5, 182, 4.2) + 3;
  }

  // Reserve a dedicated lower-right area for the stamp so it never covers the net salary.
  if (paid) await addPaidStamp(doc, record, Math.min(216, Math.max(198, notesY + 3)), { x: 163, size: 28, alias: 'df7-salary-paid-stamp' }, settings);

  const signatureY = 253;
  doc.setTextColor(45, 51, 62);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.line(14, signatureY, 74, signatureY);
  doc.line(136, signatureY, 196, signatureY);
  addManagerSignature(doc, settings, 136, signatureY - 15, 35, 10);
  addCompanyStamp(doc, settings, 175, signatureY - 18, 18);
  doc.text(record.employeeAcknowledgement || 'Employee acknowledgement', 14, signatureY + 5);
  doc.text(record.managerApproval || 'Manager approval / authorized signature', 136, signatureY + 5);
  if (settings.authorizedSignatory) {
    doc.setFont('helvetica', 'bold');
    doc.text(settings.authorizedSignatory, 136, signatureY - 5);
    doc.setFont('helvetica', 'normal');
  }

  addPageFooter(doc, settings);
  return doc.output('blob');
}



const attendanceHeader = async (doc, title, employee, month, settings) => {
  doc.setFillColor(244, 240, 231);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setFillColor(17, 45, 78);
  doc.rect(0, 39, 210, 3, 'F');
  await addCompanyLogo(doc, settings);
  doc.setTextColor(17, 45, 78);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, 196, 15, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(salaryMonthLabelForPdf(month), 196, 23, { align: 'right' });
  doc.text(`${employee.employeeNumber || 'Employee'} · ${employee.name || '—'}`, 196, 31, { align: 'right' });
};

export async function createAttendanceReportPdf({ employee, month, records = [], summary = null }, settings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totals = summary || summarizeAttendance(records, employee);
  const sorted = records.map((row) => deriveAttendance(row, employee)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  await attendanceHeader(doc, 'MONTHLY ATTENDANCE REPORT', employee, month, settings);

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'Dhinasha Family 7', 14, 51);
  doc.setFont('helvetica', 'normal');
  const detailLines = [
    employee.designation && `Designation: ${employee.designation}`,
    employee.workLocation && `Work location: ${employee.workLocation}`,
    `Payroll type: ${payrollTypeLabel(employee.payrollType)}`,
  ].filter(Boolean);
  detailLines.forEach((line, index) => doc.text(line, 14, 57 + index * 4.5));

  autoTable(doc, {
    startY: 74,
    body: [[
      `Worked days: ${totals.totalWorkingDays}`,
      `Hours: ${safeNumber(totals.totalHoursWorked).toFixed(2)}`,
      `OT: ${safeNumber(totals.totalOvertimeHours).toFixed(2)}`,
      `Missed: ${safeNumber(totals.totalMissedHours).toFixed(2)}`,
      `Off: ${totals.totalOffDays}`,
      `Absent: ${totals.totalAbsentDays}`,
    ]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, halign: 'center' },
    margin: { left: 14, right: 14 },
  });

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Date', 'Shift', 'Scheduled', 'Actual', 'Status', 'Hours', 'OT', 'Missed', 'Notes']],
    body: sorted.map((row) => [
      dateText(row.date),
      row.shiftName || 'Custom',
      timeRangeLabel24(row.scheduledStart, row.scheduledEnd),
      row.actualStart && row.actualEnd ? timeRangeLabel24(row.actualStart, row.actualEnd) : '—',
      attendanceStatusLabel(row.status),
      safeNumber(row.actualHours).toFixed(2),
      safeNumber(row.overtimeHours).toFixed(2),
      safeNumber(row.missedHours).toFixed(2),
      row.notes || '',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [17, 73, 105], textColor: 255 },
    styles: { fontSize: 6.7, cellPadding: 1.8, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 20 }, 1: { cellWidth: 19 }, 2: { cellWidth: 25 }, 3: { cellWidth: 25 },
      4: { cellWidth: 19 }, 5: { cellWidth: 13, halign: 'right' }, 6: { cellWidth: 11, halign: 'right' },
      7: { cellWidth: 13, halign: 'right' }, 8: { cellWidth: 37 },
    },
    margin: { left: 14, right: 14, bottom: 22 },
    didDrawPage: () => addPageFooter(doc, settings),
  });

  if (!sorted.length) {
    doc.setFontSize(10);
    doc.text('No attendance records were saved for this employee and month.', 105, 112, { align: 'center' });
  }
  addPageFooter(doc, settings);
  return doc.output('blob');
}

export async function createAttendanceSlipPdf({ employee, month, records = [], summary = null }, settings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totals = summary || summarizeAttendance(records, employee);
  await attendanceHeader(doc, 'MONTHLY ATTENDANCE SLIP', employee, month, settings);

  doc.setTextColor(45, 51, 62);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE', 14, 54);
  doc.setFont('helvetica', 'normal');
  const lines = [
    `Name: ${employee.name || '—'}`,
    `Employee ID: ${employee.employeeNumber || '—'}`,
    employee.designation ? `Designation: ${employee.designation}` : '',
    employee.workLocation ? `Work location: ${employee.workLocation}` : '',
    `Payroll type: ${payrollTypeLabel(employee.payrollType)}`,
  ].filter(Boolean);
  lines.forEach((line, index) => doc.text(line, 14, 61 + index * 5));

  autoTable(doc, {
    startY: 92,
    head: [['Monthly attendance summary', 'Total']],
    body: [
      ['Recorded duty days', String(totals.totalRecords)],
      ['Working days', String(totals.totalWorkingDays)],
      ['Total hours worked', `${safeNumber(totals.totalHoursWorked).toFixed(2)} hrs`],
      ['Overtime hours', `${safeNumber(totals.totalOvertimeHours).toFixed(2)} hrs`],
      ['Missed hours', `${safeNumber(totals.totalMissedHours).toFixed(2)} hrs`],
      ['Off days', String(totals.totalOffDays)],
      ['Absent days', String(totals.totalAbsentDays)],
      ['Leave days', String(totals.totalLeaveDays)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [17, 73, 105], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { cellWidth: 125 }, 1: { cellWidth: 57, halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  const signatureY = 225;
  doc.setDrawColor(90, 95, 105);
  doc.line(14, signatureY, 78, signatureY);
  doc.line(132, signatureY, 196, signatureY);
  doc.setFontSize(8);
  addManagerSignature(doc, settings, 132, signatureY - 15, 38, 10);
  addCompanyStamp(doc, settings, 176, signatureY - 18, 18);
  doc.text('Employee acknowledgement', 14, signatureY + 5);
  doc.text('Manager / authorized signature', 132, signatureY + 5);
  doc.setFontSize(7.5);
  doc.text(`Generated: ${dateText(new Date().toISOString().slice(0, 10))}`, 14, 266);
  addPageFooter(doc, settings);
  return doc.output('blob');
}

function salaryMonthLabelForPdf(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return '—';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

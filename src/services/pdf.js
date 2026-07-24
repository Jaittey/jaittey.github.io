import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { currency, dateText } from '../utils/format';

let paidStampDataUrlPromise = null;

function loadImageAsDataUrl(url) {
  if (!paidStampDataUrlPromise) {
    paidStampDataUrlPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the PAID stamp image.');
        return response.blob();
      })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the PAID stamp image.'));
        reader.readAsDataURL(blob);
      }));
  }

  return paidStampDataUrlPromise;
}

async function addPaidStamp(doc, record, finalY) {
  if (String(record.status || '').toUpperCase() !== 'PAID') return;

  try {
    const stampUrl = `${import.meta.env.BASE_URL}images/DF7_PAID.png`;
    const stamp = await loadImageAsDataUrl(stampUrl);

    // Keep the stamp below the item table and away from the total.
    const stampSize = 48;
    const stampY = Math.min(Math.max(finalY + 8, 178), 225);
    doc.addImage(stamp, 'PNG', 16, stampY, stampSize, stampSize, 'df7-paid-stamp', 'FAST', -8);
  } catch (error) {
    // The invoice must still be generated if the optional image cannot load.
    console.warn(error);
  }
}

export async function createBusinessPdf(kind, record, settings) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const isInvoice = kind === 'invoice';
  const title = isInvoice ? 'INVOICE' : 'QUOTATION';
  const number = isInvoice ? record.invoiceNumber : record.quoteNumber;
  const code = settings.currency || 'MVR';

  doc.setFillColor(8, 11, 16);
  doc.rect(0, 0, 210, 42, 'F');
  doc.setTextColor(93, 217, 168);
  doc.setFontSize(23);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.businessName || 'DF7', 16, 18);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(title, 194, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(number || 'DRAFT', 194, 27, { align: 'right' });

  doc.setTextColor(50, 55, 65);
  doc.setFontSize(9);
  const businessLines = [settings.address, settings.phone, settings.email].filter(Boolean);
  businessLines.forEach((line, index) => doc.text(String(line), 16, 50 + index * 5));

  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 16, 72);
  doc.setFont('helvetica', 'normal');
  doc.text(record.customerName || '—', 16, 78);
  if (record.contact) doc.text(record.contact, 16, 83);

  doc.setFont('helvetica', 'bold');
  doc.text(isInvoice ? 'PAYMENT' : 'VALID UNTIL', 194, 72, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(isInvoice ? (record.paymentMethod || '—') : (record.validUntil || '—'), 194, 78, { align: 'right' });
  doc.text(`Date: ${dateText(record.createdAt || new Date())}`, 194, 83, { align: 'right' });

  autoTable(doc, {
    startY: 94,
    head: [['Description', 'Qty', 'Unit Price', 'Total']],
    body: (record.items || []).map((item) => [
      item.description,
      String(item.quantity),
      currency(item.price, code),
      currency(Number(item.quantity) * Number(item.price), code),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [43, 143, 110], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3.2 },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`TOTAL: ${currency(record.total, code)}`, 194, finalY, { align: 'right' });

  if (isInvoice) await addPaidStamp(doc, record, finalY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 105, 115);
  doc.text('Generated securely by DF7 Business.', 105, 285, { align: 'center' });
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

import { useState } from 'react';
import DocumentEditor from '../components/DocumentEditor';
import EmptyState from '../components/EmptyState';
import { createBusinessPdf, downloadBlob, previewBlob } from '../services/pdf';
import { deleteInvoiceAndRestoreStock, saveInvoiceWithStock } from '../services/database';
import { uploadBusinessPdf } from '../services/drive';
import { currency, dateText, makeNumber } from '../utils/format';

export default function Invoices({ invoices, customers, products, settings, notify, markDriveConnected }) {
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const filtered = invoices.filter((row) => `${row.invoiceNumber} ${row.customerName}`.toLowerCase().includes(search.toLowerCase()));

  const save = async (data) => {
    const current = editor?.record;
    await saveInvoiceWithStock({
      ...data,
      invoiceNumber: current?.invoiceNumber || makeNumber(settings.invoicePrefix || 'INV'),
    }, current?.id || null);
    notify('Invoice saved and stock updated.');
  };

  const makePdf = async (record) => createBusinessPdf('invoice', record, settings);

  const preview = async (record) => {
    try {
      previewBlob(await makePdf(record));
    } catch (reason) {
      notify(reason?.message || 'Could not create the invoice preview.', 'error');
    }
  };

  const download = async (record) => {
    try {
      downloadBlob(await makePdf(record), `${record.invoiceNumber}.pdf`);
    } catch (reason) {
      notify(reason?.message || 'Could not create the invoice PDF.', 'error');
    }
  };

  const upload = async (record) => {
    try {
      const pdfBlob = await makePdf(record);
      const result = await uploadBusinessPdf(pdfBlob, `${record.invoiceNumber}.pdf`, 'Invoices', settings.driveRootFolder);
      markDriveConnected(true);
      const { id, ...invoiceData } = record;
      await saveInvoiceWithStock({ ...invoiceData, driveFileId: result.id, driveWebViewLink: result.webViewLink }, id);
      notify('Invoice uploaded to Google Drive.');
    } catch (reason) {
      notify(reason?.message || 'Drive upload failed.', 'error');
    }
  };

  const remove = async (record) => {
    if (!confirm(`Delete ${record.invoiceNumber} and restore its stock?`)) return;
    try {
      await deleteInvoiceAndRestoreStock(record);
      notify('Invoice deleted and stock restored.');
    } catch (reason) {
      notify(reason?.message || 'Could not delete the invoice.', 'error');
    }
  };

  return <>
    <div className="page-actions">
      <div className="search-box">⌕<input placeholder="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <button className="button button-primary" onClick={() => setEditor({ record: null })}>＋ New invoice</button>
    </div>

    <section className="panel">
      <div className="responsive-table">
        <table>
          <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((row) => {
              const isPaid = String(row.status || '').toUpperCase() === 'PAID';
              return <tr key={row.id}>
                <td>
                  <strong>{row.invoiceNumber}</strong>
                  {row.driveWebViewLink && <a className="drive-link" href={row.driveWebViewLink} target="_blank" rel="noreferrer">Drive</a>}
                </td>
                <td>{dateText(row.createdAt)}</td>
                <td>{row.customerName}</td>
                <td>
                  <span className={`status status-${row.status?.toLowerCase()}`}>
                    {isPaid && <img className="paid-status-icon" src={`${import.meta.env.BASE_URL}images/DF7_PAID.png`} alt="" />}
                    {isPaid ? 'PAID' : row.status}
                  </span>
                </td>
                <td>{currency(row.total, settings.currency)}</td>
                <td>
                  <div className="row-actions">
                    <button onClick={() => setEditor({ record: row })}>Edit</button>
                    <button onClick={() => preview(row)}>Preview</button>
                    <button onClick={() => download(row)}>PDF</button>
                    <button onClick={() => upload(row)}>Drive</button>
                    <button className="danger" onClick={() => remove(row)}>Delete</button>
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {!filtered.length && <EmptyState icon="▤" title="No invoices found" text="Create an invoice or change your search." />}
    </section>

    {editor && <DocumentEditor key={editor.record?.id || 'new-invoice'} open type="invoice" initial={editor.record} customers={customers} products={products} settings={settings} onClose={() => setEditor(null)} onSave={save} />}
  </>;
}

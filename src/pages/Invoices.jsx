import { useMemo, useState } from 'react';
import DocumentEditor from '../components/DocumentEditor';
import EmptyState from '../components/EmptyState';
import { createBusinessPdf, downloadBlob, previewBlob } from '../services/pdf';
import { deleteInvoiceAndRestoreStock, saveInvoiceWithStock, saveRecord } from '../services/database';
import { uploadBusinessPdf } from '../services/drive';
import { currency, dateText, makeNumber } from '../utils/format';

export default function Invoices({ invoices, customers, products, settings, notify, markDriveConnected }) {
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [uploading, setUploading] = useState(false);
  const filtered = invoices.filter((row) => `${row.invoiceNumber} ${row.customerName}`.toLowerCase().includes(search.toLowerCase()));
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => selected.includes(row.id));
  const selectedRecords = useMemo(() => invoices.filter((row) => selected.includes(row.id)), [invoices, selected]);

  const save = async (data) => {
    const current = editor?.record;
    await saveInvoiceWithStock({ ...data, invoiceNumber: current?.invoiceNumber || makeNumber(settings.invoicePrefix || 'INV') }, current?.id || null);
    notify('Invoice saved and stock updated.');
  };

  const makePdf = async (record) => createBusinessPdf('invoice', record, settings);

  const preview = async (record) => {
    try { previewBlob(await makePdf(record)); }
    catch (reason) { notify(reason?.message || 'Could not create the invoice preview.', 'error'); }
  };

  const download = async (record) => {
    try { downloadBlob(await makePdf(record), `${record.invoiceNumber}.pdf`); }
    catch (reason) { notify(reason?.message || 'Could not create the invoice PDF.', 'error'); }
  };

  const uploadOne = async (record, showMessage = true) => {
    const pdfBlob = await makePdf(record);
    const result = await uploadBusinessPdf(
      pdfBlob,
      `${record.invoiceNumber}.pdf`,
      'Invoices',
      settings.driveRootFolder,
      record.driveFileId || '',
    );
    markDriveConnected(true);
    await saveRecord('invoices', {
      driveFileId: result.id,
      driveWebViewLink: result.webViewLink || record.driveWebViewLink || '',
      driveUpdatedAt: new Date().toISOString(),
    }, record.id);
    if (showMessage) notify(result.replaced ? 'Invoice replaced successfully on Google Drive.' : 'Invoice saved successfully to Google Drive.');
    return result;
  };

  const upload = async (record) => {
    try { await uploadOne(record, true); }
    catch (reason) { notify(reason?.message || 'Drive upload failed.', 'error'); }
  };

  const uploadSelected = async () => {
    if (!selectedRecords.length) return notify('Select at least one invoice first.', 'error');
    setUploading(true);
    try {
      let replaced = 0;
      for (const record of selectedRecords) {
        const result = await uploadOne(record, false);
        if (result.replaced) replaced += 1;
      }
      const created = selectedRecords.length - replaced;
      notify(`${selectedRecords.length} invoice file${selectedRecords.length === 1 ? '' : 's'} saved successfully to Google Drive${replaced ? ` (${replaced} replaced, ${created} new)` : ''}.`);
      setSelected([]);
    } catch (reason) {
      notify(reason?.message || 'Could not save all selected invoices.', 'error');
    } finally { setUploading(false); }
  };

  const toggleAll = () => {
    const ids = filtered.map((row) => row.id);
    setSelected(allVisibleSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const remove = async (record) => {
    if (!confirm(`Delete ${record.invoiceNumber} and restore its stock?`)) return;
    try {
      await deleteInvoiceAndRestoreStock(record);
      setSelected((current) => current.filter((id) => id !== record.id));
      notify('Invoice deleted and stock restored.');
    } catch (reason) { notify(reason?.message || 'Could not delete the invoice.', 'error'); }
  };

  return <>
    <div className="page-actions">
      <div className="search-box">⌕<input placeholder="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="page-action-buttons">
        <button className="button button-secondary" onClick={uploadSelected} disabled={!selected.length || uploading}>{uploading ? 'Saving…' : `⇧ Drive selected${selected.length ? ` (${selected.length})` : ''}`}</button>
        <button className="button button-primary" onClick={() => setEditor({ record: null })}>＋ New invoice</button>
      </div>
    </div>

    <section className="panel">
      <div className="responsive-table">
        <table>
          <thead><tr><th className="select-column"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all visible invoices" /></th><th>Invoice</th><th>Date</th><th>Service period</th><th>Customer</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((row) => {
              const isPaid = String(row.status || '').toUpperCase() === 'PAID';
              return <tr key={row.id} className={selected.includes(row.id) ? 'selected-row' : ''}>
                <td className="select-column"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.invoiceNumber}`} /></td>
                <td data-label="Invoice"><strong>{row.invoiceNumber}</strong>{row.driveWebViewLink && <a className="drive-link" href={row.driveWebViewLink} target="_blank" rel="noreferrer">Drive</a>}</td>
                <td data-label="Date">{dateText(row.documentDate || row.createdAt)}</td>
                <td data-label="Service period">{row.servicePeriod || '—'}</td>
                <td data-label="Customer">{row.customerOrganisation || row.customerName}</td>
                <td><span className={`status status-${row.status?.toLowerCase()}`}>{isPaid && <img className="paid-status-icon" src={`${import.meta.env.BASE_URL}images/DF7_PAID.png`} alt="" />}{isPaid ? 'PAID' : row.status}</span></td>
                <td>{currency(row.total, settings.currency)}</td>
                <td><div className="row-actions"><button onClick={() => setEditor({ record: row })}>Edit</button><button onClick={() => preview(row)}>Preview</button><button onClick={() => download(row)}>PDF</button><button onClick={() => upload(row)}>{row.driveFileId ? 'Replace Drive' : 'Drive'}</button><button className="danger" onClick={() => remove(row)}>Delete</button></div></td>
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

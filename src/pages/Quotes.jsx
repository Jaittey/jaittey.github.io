import { useMemo, useState } from 'react';
import DocumentEditor from '../components/DocumentEditor';
import EmptyState from '../components/EmptyState';
import { createBusinessPdf, downloadBlob, previewBlob } from '../services/pdf';
import { deleteRecord, saveInvoiceWithStock, saveRecord } from '../services/database';
import { uploadBusinessPdf } from '../services/drive';
import { currency, dateText, makeNumber } from '../utils/format';

export default function Quotes({ quotes, customers, products, settings, notify, markDriveConnected, openInvoices }) {
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [uploading, setUploading] = useState(false);
  const filtered = quotes.filter((row) => `${row.quoteNumber} ${row.customerName}`.toLowerCase().includes(search.toLowerCase()));
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => selected.includes(row.id));
  const selectedRecords = useMemo(() => quotes.filter((row) => selected.includes(row.id)), [quotes, selected]);

  const save = async (data) => {
    const current = editor?.record;
    await saveRecord('quotes', { ...data, quoteNumber: current?.quoteNumber || makeNumber(settings.quotePrefix || 'QTN') }, current?.id || null);
    notify('Quotation saved.');
  };

  const makePdf = async (record) => createBusinessPdf('quote', record, settings);
  const preview = async (record) => { try { previewBlob(await makePdf(record)); } catch (reason) { notify(reason?.message || 'Could not create the quotation preview.', 'error'); } };
  const download = async (record) => { try { downloadBlob(await makePdf(record), `${record.quoteNumber}.pdf`); } catch (reason) { notify(reason?.message || 'Could not create the quotation PDF.', 'error'); } };

  const uploadOne = async (record, showMessage = true) => {
    const pdfBlob = await makePdf(record);
    const result = await uploadBusinessPdf(pdfBlob, `${record.quoteNumber}.pdf`, 'Quotations', settings.driveRootFolder, record.driveFileId || '');
    markDriveConnected(true);
    await saveRecord('quotes', { driveFileId: result.id, driveWebViewLink: result.webViewLink || record.driveWebViewLink || '', driveUpdatedAt: new Date().toISOString() }, record.id);
    if (showMessage) notify(result.replaced ? 'Quotation replaced successfully on Google Drive.' : 'Quotation saved successfully to Google Drive.');
    return result;
  };

  const upload = async (record) => { try { await uploadOne(record, true); } catch (reason) { notify(reason?.message || 'Drive upload failed.', 'error'); } };

  const uploadSelected = async () => {
    if (!selectedRecords.length) return notify('Select at least one quotation first.', 'error');
    setUploading(true);
    try {
      let replaced = 0;
      for (const record of selectedRecords) {
        const result = await uploadOne(record, false);
        if (result.replaced) replaced += 1;
      }
      const created = selectedRecords.length - replaced;
      notify(`${selectedRecords.length} quotation file${selectedRecords.length === 1 ? '' : 's'} saved successfully to Google Drive${replaced ? ` (${replaced} replaced, ${created} new)` : ''}.`);
      setSelected([]);
    } catch (reason) { notify(reason?.message || 'Could not save all selected quotations.', 'error'); }
    finally { setUploading(false); }
  };

  const toggleAll = () => {
    const ids = filtered.map((row) => row.id);
    setSelected(allVisibleSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const convert = async (record) => {
    if (!confirm(`Convert ${record.quoteNumber} into an invoice and deduct stock?`)) return;
    try {
      const { id, quoteNumber, driveFileId, driveWebViewLink, ...quoteData } = record;
      await saveInvoiceWithStock({ ...quoteData, invoiceNumber: makeNumber(settings.invoicePrefix || 'INV'), status: 'BILLED', paymentMethod: 'Cash', sourceQuoteId: id });
      await saveRecord('quotes', { status: 'ACCEPTED', convertedAt: new Date().toISOString() }, record.id);
      notify('Quotation converted to an invoice.');
      openInvoices();
    } catch (reason) { notify(reason?.message || 'Could not convert the quotation.', 'error'); }
  };

  return <>
    <div className="page-actions">
      <div className="search-box">⌕<input placeholder="Search quotations" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="page-action-buttons">
        <button className="button button-secondary" onClick={uploadSelected} disabled={!selected.length || uploading}>{uploading ? 'Saving…' : `⇧ Drive selected${selected.length ? ` (${selected.length})` : ''}`}</button>
        <button className="button button-primary" onClick={() => setEditor({ record: null })}>＋ New quotation</button>
      </div>
    </div>

    <section className="panel">
      <div className="responsive-table"><table>
        <thead><tr><th className="select-column"><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all visible quotations" /></th><th>Quotation</th><th>Date</th><th>Expire date</th><th>Customer</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.id} className={selected.includes(row.id) ? 'selected-row' : ''}>
          <td className="select-column"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.quoteNumber}`} /></td>
          <td><strong>{row.quoteNumber}</strong>{row.driveWebViewLink && <a className="drive-link" href={row.driveWebViewLink} target="_blank" rel="noreferrer">Drive</a>}</td>
          <td data-label="Date">{dateText(row.createdAt)}</td><td data-label="Expire date">{dateText(row.validUntil)}</td><td data-label="Customer">{row.customerName}</td><td><span className={`status status-${row.status?.toLowerCase()}`}>{row.status}</span></td><td>{currency(row.total, settings.currency)}</td>
          <td><div className="row-actions"><button onClick={() => setEditor({ record: row })}>Edit</button><button onClick={() => preview(row)}>Preview</button><button onClick={() => download(row)}>PDF</button><button onClick={() => upload(row)}>{row.driveFileId ? 'Replace Drive' : 'Drive'}</button><button onClick={() => convert(row)}>To invoice</button><button className="danger" onClick={async () => { if (confirm('Delete this quotation?')) { await deleteRecord('quotes', row.id); setSelected((current) => current.filter((id) => id !== row.id)); notify('Quotation deleted.'); } }}>Delete</button></div></td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && <EmptyState icon="◫" title="No quotations found" text="Create a quotation or change your search." />}
    </section>

    {editor && <DocumentEditor key={editor.record?.id || 'new-quote'} open type="quote" initial={editor.record} customers={customers} products={products} settings={settings} onClose={() => setEditor(null)} onSave={save} />}
  </>;
}

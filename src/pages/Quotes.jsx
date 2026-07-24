import { useState } from 'react';
import DocumentEditor from '../components/DocumentEditor';
import EmptyState from '../components/EmptyState';
import { createBusinessPdf, downloadBlob, previewBlob } from '../services/pdf';
import { deleteRecord, saveInvoiceWithStock, saveRecord } from '../services/database';
import { uploadBusinessPdf } from '../services/drive';
import { currency, dateText, makeNumber } from '../utils/format';

export default function Quotes({ quotes, customers, products, settings, notify, markDriveConnected, openInvoices }) {
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const filtered = quotes.filter((row) => `${row.quoteNumber} ${row.customerName}`.toLowerCase().includes(search.toLowerCase()));
  const save = async (data) => {
    const current = editor?.record;
    await saveRecord('quotes', { ...data, quoteNumber: current?.quoteNumber || makeNumber(settings.quotePrefix || 'QTN') }, current?.id || null);
    notify('Quotation saved.');
  };
  const pdf = (record) => createBusinessPdf('quote', record, settings);
  const upload = async (record) => {
    try {
      const result = await uploadBusinessPdf(pdf(record), `${record.quoteNumber}.pdf`, 'Quotations', settings.driveRootFolder);
      markDriveConnected(true);
      await saveRecord('quotes', { driveFileId: result.id, driveWebViewLink: result.webViewLink }, record.id);
      notify('Quotation uploaded to Google Drive.');
    } catch (reason) { notify(reason?.message || 'Drive upload failed.', 'error'); }
  };
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
    <div className="page-actions"><div className="search-box">⌕<input placeholder="Search quotations" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="button button-primary" onClick={() => setEditor({ record: null })}>＋ New quotation</button></div>
    <section className="panel"><div className="responsive-table"><table><thead><tr><th>Quotation</th><th>Date</th><th>Customer</th><th>Status</th><th>Total</th><th>Actions</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.quoteNumber}</strong>{row.driveWebViewLink && <a className="drive-link" href={row.driveWebViewLink} target="_blank" rel="noreferrer">Drive</a>}</td><td>{dateText(row.createdAt)}</td><td>{row.customerName}</td><td><span className={`status status-${row.status?.toLowerCase()}`}>{row.status}</span></td><td>{currency(row.total, settings.currency)}</td><td><div className="row-actions"><button onClick={() => setEditor({ record: row })}>Edit</button><button onClick={() => previewBlob(pdf(row))}>Preview</button><button onClick={() => downloadBlob(pdf(row), `${row.quoteNumber}.pdf`)}>PDF</button><button onClick={() => upload(row)}>Drive</button><button onClick={() => convert(row)}>To invoice</button><button className="danger" onClick={async () => { if (confirm('Delete this quotation?')) { await deleteRecord('quotes', row.id); notify('Quotation deleted.'); } }}>Delete</button></div></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState icon="◫" title="No quotations found" text="Create a quotation or change your search." />}</section>
    {editor && <DocumentEditor key={editor.record?.id || 'new-quote'} open type="quote" initial={editor.record} customers={customers} products={products} settings={settings} onClose={() => setEditor(null)} onSave={save} />}
  </>;
}

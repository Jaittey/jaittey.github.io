export default function CloudDocuments({ driveConnected, connectDrive, disconnectDrive, counts }) {
  const folders = [
    ['Invoices', counts.invoices],
    ['Quotations', counts.quotes],
    ['Salary Slips', counts.payroll],
    ['Contracts', counts.contracts],
    ['Reports', 'Export on demand'],
    ['Employee Documents', 'Upload framework'],
  ];
  return (
    <>
      <section className="module-hero panel cloud-hero">
        <div><p className="eyebrow">CLOUD & DOCUMENTS</p><h2>Google Drive workspace</h2><p>Generated PDFs use organised folders and replace existing files when a Drive file ID is available.</p></div>
        <button className={`button ${driveConnected ? 'button-ghost' : 'button-primary'}`} onClick={driveConnected ? disconnectDrive : connectDrive}>{driveConnected ? 'Disconnect Drive' : 'Connect Google Drive'}</button>
      </section>
      <section className="cloud-folder-grid">{folders.map(([name, count]) => <article className="panel cloud-folder" key={name}><span>☁</span><div><h3>{name}</h3><p>{count}</p></div></article>)}</section>
      <section className="panel"><p className="eyebrow">RECOMMENDED STRUCTURE</p><pre className="folder-tree">{`DF7 Business/
├── Invoices/
├── Quotations/
├── Customers/
├── Contracts/
├── Employees/
├── Payroll/
├── Finance/
├── Reports/
└── Backups/`}</pre></section>
    </>
  );
}

import { dateText } from '../utils/format';

export default function ActivityLogs({ logs }) {
  return (
    <>
      <div className="page-actions"><div><p className="eyebrow">SECURITY & AUDIT</p><h2>Recent activities</h2></div></div>
      <section className="panel"><div className="responsive-table"><table><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Module</th><th>Record</th></tr></thead><tbody>{logs.map((row) => <tr key={row.id}><td data-label="Date">{dateText(row.createdAt)}</td><td data-label="User">{row.userEmail}</td><td data-label="Action">{row.action}</td><td data-label="Module">{row.module}</td><td data-label="Record">{row.recordId || '—'}</td></tr>)}</tbody></table></div>{!logs.length && <p className="table-empty">No activity records yet.</p>}</section>
    </>
  );
}

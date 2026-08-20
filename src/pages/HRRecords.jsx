import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';

const blank = {
  employeeId: '', type: 'PROMOTION', effectiveDate: '', title: '', fromValue: '', toValue: '', notes: '', status: 'ACTIVE',
};

const TYPES = [
  ['PROMOTION', 'Promotion'], ['TRANSFER', 'Transfer'], ['WARNING', 'Warning / disciplinary'],
  ['TRAINING', 'Training'], ['LEAVE_NOTE', 'Leave / HR note'], ['RESIGNATION', 'Resignation'], ['OTHER', 'Other'],
];

export default function HRRecords({ records = [], employees = [], notify = () => {} }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [employeeFilter, setEmployeeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const employeeName = (id) => employees.find((x) => x.id === id)?.name || 'Unknown employee';
  const filtered = useMemo(() => records.filter((row) =>
    (employeeFilter === 'ALL' || row.employeeId === employeeFilter)
    && (typeFilter === 'ALL' || row.type === typeFilter)), [records, employeeFilter, typeFilter]);
  const open = (record = null) => { setEditing(record || {}); setForm({ ...blank, ...(record || {}) }); };
  const save = async () => {
    if (!form.employeeId) return notify('Select an employee.', 'error');
    if (!form.effectiveDate) return notify('Effective date is required.', 'error');
    await saveRecord('hrRecords', {
      ...form,
      title: form.title.trim(), fromValue: form.fromValue.trim(), toValue: form.toValue.trim(), notes: form.notes.trim(),
      employeeName: employeeName(form.employeeId),
    }, editing?.id || null);
    setEditing(null); notify('HR record saved.');
  };
  return <div className="v5-page">
    <section className="v5-hero panel"><div><p className="eyebrow">EMPLOYEE LIFECYCLE</p><h2>HR Records</h2><p>Keep promotions, transfers, training, warnings and resignations attached to each employee history.</p></div><button className="button button-primary" onClick={() => open()}>＋ Add HR record</button></section>
    <section className="v5-kpi-grid"><article className="panel"><span>HR records</span><strong>{records.length}</strong><small>complete history</small></article><article className="panel"><span>Promotions</span><strong>{records.filter(x=>x.type==='PROMOTION').length}</strong><small>career changes</small></article><article className="panel"><span>Transfers</span><strong>{records.filter(x=>x.type==='TRANSFER').length}</strong><small>workplace changes</small></article></section>
    <section className="panel v5-toolbar"><select value={employeeFilter} onChange={e=>setEmployeeFilter(e.target.value)}><option value="ALL">All employees</option>{employees.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="ALL">All record types</option>{TYPES.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></section>
    <section className="v5-table-wrap panel"><table><thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Change / Title</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td>{row.effectiveDate}</td><td><b>{employeeName(row.employeeId)}</b></td><td>{TYPES.find(x=>x[0]===row.type)?.[1]||row.type}</td><td>{row.title||[row.fromValue,row.toValue].filter(Boolean).join(' → ')||'—'}</td><td><span className="v5-pill">{row.status||'ACTIVE'}</span></td><td><div className="row-actions"><button onClick={()=>open(row)}>Edit</button><button className="danger" onClick={async()=>{if(confirm('Delete this HR record?')){await deleteRecord('hrRecords',row.id);notify('HR record deleted.');}}}>Delete</button></div></td></tr>)}</tbody></table></section>
    {!filtered.length&&<section className="panel"><EmptyState icon="♙" title="No HR records found" text="Employee lifecycle changes will appear here."/></section>}
    <Modal open={Boolean(editing)} title={editing?.id?'Edit HR record':'Add HR record'} onClose={()=>setEditing(null)}><div className="form-grid"><label><span>Employee</span><select value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})}><option value="">Select employee</option>{employees.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label><span>Record type</span><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label><span>Effective date</span><input type="date" value={form.effectiveDate} onChange={e=>setForm({...form,effectiveDate:e.target.value})}/></label><label><span>Status</span><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>ACTIVE</option><option>COMPLETED</option><option>CANCELLED</option></select></label><label className="wide"><span>Title / reason</span><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label><span>From</span><input value={form.fromValue} onChange={e=>setForm({...form,fromValue:e.target.value})}/></label><label><span>To</span><input value={form.toValue} onChange={e=>setForm({...form,toValue:e.target.value})}/></label><label className="wide"><span>Notes</span><textarea rows="4" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div><footer className="modal-actions"><button className="button button-ghost" onClick={()=>setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save HR record</button></footer></Modal>
  </div>;
}

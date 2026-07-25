import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { deleteRecord, saveRecord } from '../services/database';
import { currency, dateText, inputDate, makeNumber, safeNumber } from '../utils/format';

const blankEmployee = (settings) => ({
  employeeNumber: makeNumber(settings.employeePrefix || 'EMP'),
  name: '',
  address: '',
  contact: '',
  emergencyContact: '',
  designation: '',
  department: '',
  joiningDate: inputDate(),
  status: 'ACTIVE',
  basicSalary: 0,
  bankAccount: '',
  nationalId: '',
  notes: '',
});

export default function Employees({ employees, settings, notify, openPayroll }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => blankEmployee(settings));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = useMemo(() => employees.filter((employee) => {
    const text = `${employee.employeeNumber} ${employee.name} ${employee.designation} ${employee.department}`.toLowerCase();
    const statusMatches = statusFilter === 'ALL' || employee.status === statusFilter;
    return statusMatches && text.includes(search.toLowerCase());
  }), [employees, search, statusFilter]);

  const open = (employee = null) => {
    setEditing(employee || {});
    setForm(employee ? { ...blankEmployee(settings), ...employee } : blankEmployee(settings));
  };

  const save = async () => {
    if (!form.name.trim() || !form.employeeNumber.trim()) {
      notify('Employee ID and name are required.', 'error');
      return;
    }

    await saveRecord('employees', {
      ...form,
      employeeNumber: form.employeeNumber.trim().toUpperCase(),
      name: form.name.trim(),
      basicSalary: safeNumber(form.basicSalary),
    }, editing?.id || null);
    setEditing(null);
    notify(editing?.id ? 'Employee updated.' : 'Employee added.');
  };

  const deactivate = async (employee) => {
    await saveRecord('employees', {
      status: employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }, employee.id);
    notify(employee.status === 'ACTIVE' ? 'Employee deactivated.' : 'Employee reactivated.');
  };

  const remove = async (employee) => {
    if (!confirm(`Permanently delete ${employee.name}? Payroll records will not be deleted.`)) return;
    await deleteRecord('employees', employee.id);
    notify('Employee removed.');
  };

  const activeCount = employees.filter((employee) => employee.status === 'ACTIVE').length;
  const totalBasicSalary = employees
    .filter((employee) => employee.status === 'ACTIVE')
    .reduce((sum, employee) => sum + safeNumber(employee.basicSalary), 0);

  return <>
    <section className="stats-grid enterprise-summary-grid">
      <article className="stat-card"><span>◎</span><p>Active employees</p><strong>{activeCount}</strong><small>{employees.length} total records</small></article>
      <article className="stat-card"><span>▣</span><p>Monthly basic payroll</p><strong>{currency(totalBasicSalary, settings.currency)}</strong><small>Before overtime and deductions</small></article>
    </section>

    <div className="page-actions">
      <div className="employee-filters">
        <div className="search-box">⌕<input placeholder="Search employees" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
      </div>
      <button className="button button-primary" onClick={() => open()}>＋ Add employee</button>
    </div>

    <section className="employee-grid">
      {filtered.map((employee) => (
        <article className={`panel employee-card ${employee.status === 'INACTIVE' ? 'employee-inactive' : ''}`} key={employee.id}>
          <div className="employee-card-head">
            <div className="employee-avatar">{employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
            <div><span className={`status status-${employee.status === 'ACTIVE' ? 'paid' : 'cancelled'}`}>{employee.status}</span><h3>{employee.name}</h3><p>{employee.designation || 'No designation'}{employee.department ? ` · ${employee.department}` : ''}</p></div>
          </div>
          <dl className="employee-details">
            <div><dt>Employee ID</dt><dd>{employee.employeeNumber}</dd></div>
            <div><dt>Contact</dt><dd>{employee.contact || '—'}</dd></div>
            <div><dt>Emergency</dt><dd>{employee.emergencyContact || '—'}</dd></div>
            <div><dt>Joined</dt><dd>{dateText(employee.joiningDate)}</dd></div>
            <div><dt>Basic salary</dt><dd>{currency(employee.basicSalary, settings.currency)}</dd></div>
            <div><dt>Address</dt><dd>{employee.address || '—'}</dd></div>
          </dl>
          <div className="row-actions employee-actions">
            <button onClick={() => open(employee)}>Edit</button>
            <button onClick={() => openPayroll(employee)}>Payroll</button>
            <button onClick={() => deactivate(employee)}>{employee.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</button>
            <button className="danger" onClick={() => remove(employee)}>Delete</button>
          </div>
        </article>
      ))}
    </section>

    {!filtered.length && <section className="panel"><EmptyState icon="◎" title="No employees found" text="Add an employee or change the filters." /></section>}

    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit employee' : 'Add employee'} onClose={() => setEditing(null)}>
      <div className="form-grid">
        <label><span>Employee ID</span><input value={form.employeeNumber} onChange={(event) => setForm({ ...form, employeeNumber: event.target.value })} /></label>
        <label><span>Full name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="form-span-2"><span>Address</span><textarea rows="3" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label><span>Contact number</span><input inputMode="tel" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
        <label><span>Emergency contact</span><input inputMode="tel" value={form.emergencyContact} onChange={(event) => setForm({ ...form, emergencyContact: event.target.value })} /></label>
        <label><span>Designation</span><input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
        <label><span>Department</span><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
        <label><span>Joining date</span><input type="date" value={form.joiningDate} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></label>
        <label><span>Basic salary</span><input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(event) => setForm({ ...form, basicSalary: event.target.value })} /></label>
        <label><span>National ID / document</span><input value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} /></label>
        <label className="form-span-2"><span>Bank account details</span><input value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} /></label>
        <label className="form-span-2"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save employee</button></footer>
    </Modal>
  </>;
}

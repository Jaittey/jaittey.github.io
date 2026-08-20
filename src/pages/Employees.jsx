import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { deleteRecord, saveRecord } from '../services/database';
import { currency, dateText, inputDate, makeNumber, safeNumber } from '../utils/format';
import { normalizeRole } from '../config/erp';
import { PAYROLL_TYPES, payrollTypeLabel } from '../utils/payroll';

const blankEmployee = (settings) => ({
  employeeNumber: makeNumber(settings.employeePrefix || 'EMP'),
  name: '',
  dateOfBirth: '',
  address: '',
  contact: '',
  emergencyContactPerson: '',
  emergencyContactPhone: '',
  emergencyContact: '',
  designation: 'Security Guard',
  department: 'Security Operations',
  workLocation: 'Mulak School',
  joiningDate: inputDate(),
  status: 'ACTIVE',
  payrollType: PAYROLL_TYPES.MONTHLY,
  fixedMonthlySalary: 0,
  overtimeHourlyRate: 0,
  missedDutyDeductionRate: 0,
  hourlyRate: 0,
  hourlyDeductionRate: 0,
  standardDailyHours: 8,
  standardWorkingDays: 26,
  bankAccount: '',
  nationalId: '',
  notes: '',
});

export default function Employees({ employees, settings, notify, openPayroll, openFinalSettlement, role }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => blankEmployee(settings));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [payrollTypeFilter, setPayrollTypeFilter] = useState('ALL');
  const canManage = ['administrator', 'manager'].includes(normalizeRole(role));

  const filtered = useMemo(() => employees.filter((employee) => {
    const text = `${employee.employeeNumber} ${employee.name} ${employee.designation} ${employee.department} ${employee.workLocation}`.toLowerCase();
    const statusMatches = statusFilter === 'ALL' || employee.status === statusFilter;
    const typeMatches = payrollTypeFilter === 'ALL' || (employee.payrollType || PAYROLL_TYPES.MONTHLY) === payrollTypeFilter;
    return statusMatches && typeMatches && text.includes(search.toLowerCase());
  }), [employees, search, statusFilter, payrollTypeFilter]);

  const open = (employee = null) => {
    setEditing(employee || {});
    const next = employee ? { ...blankEmployee(settings), ...employee } : blankEmployee(settings);
    if (!next.fixedMonthlySalary && next.basicSalary) next.fixedMonthlySalary = next.basicSalary;
    if (!next.emergencyContactPhone && next.emergencyContact) next.emergencyContactPhone = next.emergencyContact;
    setForm(next);
  };

  const save = async () => {
    if (!canManage) return notify('Only a Manager can change employee records.', 'error');
    if (!form.name.trim() || !form.employeeNumber.trim()) {
      notify('Employee ID and name are required.', 'error');
      return;
    }
    if (!form.joiningDate) return notify('Employee joining date is required.', 'error');
    if (safeNumber(form.standardDailyHours) <= 0) return notify('Standard daily working hours must be greater than zero.', 'error');
    if (form.payrollType === PAYROLL_TYPES.MONTHLY && safeNumber(form.fixedMonthlySalary) <= 0) {
      return notify('Enter the fixed monthly salary.', 'error');
    }
    if (form.payrollType === PAYROLL_TYPES.DAILY && safeNumber(form.hourlyRate) <= 0) {
      return notify('Enter the standard hourly rate.', 'error');
    }

    const payload = {
      ...form,
      employeeNumber: form.employeeNumber.trim().toUpperCase(),
      name: form.name.trim(),
      payrollType: form.payrollType || PAYROLL_TYPES.MONTHLY,
      fixedMonthlySalary: safeNumber(form.fixedMonthlySalary),
      overtimeHourlyRate: safeNumber(form.overtimeHourlyRate),
      missedDutyDeductionRate: safeNumber(form.missedDutyDeductionRate),
      hourlyRate: safeNumber(form.hourlyRate),
      hourlyDeductionRate: safeNumber(form.hourlyDeductionRate),
      standardDailyHours: safeNumber(form.standardDailyHours),
      standardWorkingDays: safeNumber(form.standardWorkingDays),
      basicSalary: form.payrollType === PAYROLL_TYPES.MONTHLY ? safeNumber(form.fixedMonthlySalary) : 0,
      emergencyContact: form.emergencyContactPhone,
    };

    await saveRecord('employees', payload, editing?.id || null);
    setEditing(null);
    notify(editing?.id ? 'Employee and payroll settings updated.' : 'Employee added.');
  };

  const deactivate = async (employee) => {
    if (!canManage) return;
    await saveRecord('employees', { status: employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }, employee.id);
    notify(employee.status === 'ACTIVE' ? 'Employee deactivated.' : 'Employee reactivated.');
  };

  const remove = async (employee) => {
    if (!canManage) return;
    if (!confirm(`Permanently delete ${employee.name}? Attendance and payroll history will not be deleted.`)) return;
    await deleteRecord('employees', employee.id);
    notify('Employee record removed. Historical payroll records remain saved.');
  };

  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE');
  const monthlyEmployees = activeEmployees.filter((employee) => (employee.payrollType || PAYROLL_TYPES.MONTHLY) === PAYROLL_TYPES.MONTHLY);
  const dailyEmployees = activeEmployees.filter((employee) => employee.payrollType === PAYROLL_TYPES.DAILY);
  const fixedPayroll = monthlyEmployees.reduce((sum, employee) => sum + safeNumber(employee.fixedMonthlySalary ?? employee.basicSalary), 0);

  return <>
    <section className="stats-grid enterprise-summary-grid employee-payroll-summary">
      <article className="stat-card"><span>◎</span><p>Active employees</p><strong>{activeEmployees.length}</strong><small>{employees.length} total records</small></article>
      <article className="stat-card"><span>▣</span><p>Monthly-based</p><strong>{monthlyEmployees.length}</strong><small>{currency(fixedPayroll, settings.currency)} fixed payroll</small></article>
      <article className="stat-card"><span>◷</span><p>Daily-based</p><strong>{dailyEmployees.length}</strong><small>Paid from actual hours</small></article>
    </section>

    <div className="page-actions employee-page-actions">
      <div className="employee-filters">
        <div className="search-box">⌕<input placeholder="Search employees" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        <select value={payrollTypeFilter} onChange={(event) => setPayrollTypeFilter(event.target.value)}><option value="ALL">All payroll types</option><option value={PAYROLL_TYPES.MONTHLY}>Monthly-based</option><option value={PAYROLL_TYPES.DAILY}>Daily-based</option></select>
      </div>
      {canManage && <button className="button button-primary" onClick={() => open()}>＋ Add employee</button>}
    </div>

    {!canManage && <div className="alert alert-info">You have read-only access to employee profiles. Attendance and salary-slip access are available under Payroll & Attendance.</div>}

    <section className="employee-grid">
      {filtered.map((employee) => {
        const payrollType = employee.payrollType || PAYROLL_TYPES.MONTHLY;
        return (
          <article className={`panel employee-card ${employee.status === 'INACTIVE' ? 'employee-inactive' : ''}`} key={employee.id}>
            <div className="employee-card-head">
              <div className="employee-avatar">{employee.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
              <div><span className={`status status-${employee.status === 'ACTIVE' ? 'paid' : 'cancelled'}`}>{employee.status}</span><h3>{employee.name}</h3><p>{employee.designation || 'No designation'}{employee.workLocation ? ` · ${employee.workLocation}` : ''}</p></div>
            </div>
            <div className={`payroll-type-banner ${payrollType.toLowerCase()}`}><strong>{payrollTypeLabel(payrollType)}</strong><small>{payrollType === PAYROLL_TYPES.MONTHLY ? `${currency(employee.fixedMonthlySalary ?? employee.basicSalary, settings.currency)} monthly` : `${currency(employee.hourlyRate, settings.currency)} per hour`}</small></div>
            <dl className="employee-details">
              <div><dt>Employee ID</dt><dd>{employee.employeeNumber}</dd></div>
              <div><dt>Contact</dt><dd>{employee.contact || '—'}</dd></div>
              <div><dt>Emergency person</dt><dd>{employee.emergencyContactPerson || '—'}</dd></div>
              <div><dt>Emergency phone</dt><dd>{employee.emergencyContactPhone || employee.emergencyContact || '—'}</dd></div>
              <div><dt>Joined</dt><dd>{dateText(employee.joiningDate)}</dd></div>
              <div><dt>Daily hours</dt><dd>{safeNumber(employee.standardDailyHours || 8).toFixed(2)} hrs</dd></div>
              <div><dt>Department</dt><dd>{employee.department || '—'}</dd></div>
              <div><dt>Address</dt><dd>{employee.address || '—'}</dd></div>
            </dl>
            <div className="row-actions employee-actions">
              {canManage && <button onClick={() => open(employee)}>Edit</button>}
              <button onClick={() => openPayroll(employee)}>Payroll history</button>
              {canManage && employee.status === 'ACTIVE' && <button className="warning-action" onClick={() => openFinalSettlement(employee)}>Final salary</button>}
              {canManage && <button onClick={() => deactivate(employee)}>{employee.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</button>}
              {canManage && <button className="danger" onClick={() => remove(employee)}>Delete</button>}
            </div>
          </article>
        );
      })}
    </section>

    {!filtered.length && <section className="panel"><EmptyState icon="◎" title="No employees found" text="Add an employee or change the filters." /></section>}

    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit employee and payroll' : 'Add employee'} onClose={() => setEditing(null)}>
      <div className="document-section-title">Employment information</div>
      <div className="form-grid">
        <label><span>Employee ID</span><input value={form.employeeNumber} onChange={(event) => setForm({ ...form, employeeNumber: event.target.value })} /></label>
        <label><span>Full name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label><span>National ID / Passport</span><input value={form.nationalId} onChange={(event) => setForm({ ...form, nationalId: event.target.value })} /></label>
        <label><span>Date of birth</span><input type="date" value={form.dateOfBirth || ''} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
        <label className="form-span-2"><span>Address</span><textarea rows="3" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
        <label><span>Contact number</span><input inputMode="tel" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
        <label><span>Emergency contact person</span><input value={form.emergencyContactPerson} onChange={(event) => setForm({ ...form, emergencyContactPerson: event.target.value })} /></label>
        <label><span>Emergency contact phone</span><input inputMode="tel" value={form.emergencyContactPhone} onChange={(event) => setForm({ ...form, emergencyContactPhone: event.target.value })} /></label>
        <label><span>Designation</span><input value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
        <label><span>Department</span><input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
        <label><span>Work location / Contract</span><input value={form.workLocation} onChange={(event) => setForm({ ...form, workLocation: event.target.value })} /></label>
        <label><span>Joining date</span><input type="date" value={form.joiningDate} onChange={(event) => setForm({ ...form, joiningDate: event.target.value })} /></label>
        <label><span>Employment status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>ACTIVE</option><option>INACTIVE</option></select></label>
      </div>

      <div className="document-section-title">Payroll configuration</div>
      <div className="payroll-type-selector">
        <button type="button" className={form.payrollType === PAYROLL_TYPES.MONTHLY ? 'active' : ''} onClick={() => setForm({ ...form, payrollType: PAYROLL_TYPES.MONTHLY })}><strong>Monthly-Based Salary</strong><small>Fixed salary with overtime and missed-duty deduction</small></button>
        <button type="button" className={form.payrollType === PAYROLL_TYPES.DAILY ? 'active' : ''} onClick={() => setForm({ ...form, payrollType: PAYROLL_TYPES.DAILY })}><strong>Daily-Based Salary</strong><small>Actual hours worked × hourly rate</small></button>
      </div>

      {form.payrollType === PAYROLL_TYPES.MONTHLY ? <div className="form-grid payroll-config-grid">
        <label><span>Fixed monthly salary (MVR)</span><input type="number" min="0" step="0.01" value={form.fixedMonthlySalary} onChange={(event) => setForm({ ...form, fixedMonthlySalary: event.target.value })} /></label>
        <label><span>Overtime hourly rate (MVR)</span><input type="number" min="0" step="0.01" value={form.overtimeHourlyRate} onChange={(event) => setForm({ ...form, overtimeHourlyRate: event.target.value })} /></label>
        <label><span>Missed-duty deduction rate (MVR/hr)</span><input type="number" min="0" step="0.01" value={form.missedDutyDeductionRate} onChange={(event) => setForm({ ...form, missedDutyDeductionRate: event.target.value })} /></label>
        <label><span>Standard daily working hours</span><input type="number" min="0.25" step="0.25" value={form.standardDailyHours} onChange={(event) => setForm({ ...form, standardDailyHours: event.target.value })} /></label>
        <label><span>Standard working days per month</span><input type="number" min="1" max="31" step="1" value={form.standardWorkingDays} onChange={(event) => setForm({ ...form, standardWorkingDays: event.target.value })} /></label>
      </div> : <div className="form-grid payroll-config-grid">
        <label><span>Standard hourly rate (MVR)</span><input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => setForm({ ...form, hourlyRate: event.target.value })} /></label>
        <label><span>Hourly deduction rate (MVR)</span><input type="number" min="0" step="0.01" value={form.hourlyDeductionRate} onChange={(event) => setForm({ ...form, hourlyDeductionRate: event.target.value })} /></label>
        <label><span>Standard daily working hours</span><input type="number" min="0.25" step="0.25" value={form.standardDailyHours} onChange={(event) => setForm({ ...form, standardDailyHours: event.target.value })} /></label>
        <div className="field-help form-span-2">Daily-based salary is calculated only from actual hours worked. Zero hours means no payment for that date. The deduction rate is stored for approved manual adjustments and company policy records.</div>
      </div>}

      <div className="document-section-title">Bank and notes</div>
      <div className="form-grid">
        <label className="form-span-2"><span>Bank account details</span><input value={form.bankAccount} onChange={(event) => setForm({ ...form, bankAccount: event.target.value })} /></label>
        <label className="form-span-2"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save employee</button></footer>
    </Modal>
  </>;
}

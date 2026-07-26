import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { deleteRecord, savePayrollRecord, saveRecord } from '../services/database';
import { createSalarySlipPdf, downloadBlob, previewBlob } from '../services/pdf';
import { uploadBusinessPdf } from '../services/drive';
import {
  calculatePayrollTotals,
  currency,
  currentSalaryMonth,
  dateText,
  inputDate,
  makeNumber,
  salaryMonthLabel,
} from '../utils/format';

const blankPayroll = (settings, employee = null) => ({
  employeeId: employee?.id || '',
  employeeNumber: employee?.employeeNumber || '',
  employeeName: employee?.name || '',
  designation: employee?.designation || '',
  department: employee?.department || '',
  salaryMonth: currentSalaryMonth(),
  salarySlipNumber: makeNumber(settings.salarySlipPrefix || 'PAY'),
  basicSalary: employee?.basicSalary || 0,
  overtimeHours: 0,
  overtimeRate: 0,
  allowances: 0,
  bonus: 0,
  otherEarnings: 0,
  lateDeduction: 0,
  absentDeduction: 0,
  loanDeduction: 0,
  advanceDeduction: 0,
  otherDeductions: 0,
  status: 'DRAFT',
  paymentDate: '',
  paymentMethod: 'Bank Transfer',
  notes: '',
});

export default function Payroll({ payroll, employees, settings, notify, markDriveConnected, initialEmployee, clearInitialEmployee }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => blankPayroll(settings));
  const [search, setSearch] = useState('');
  const [monthFilter, setMonthFilter] = useState(currentSalaryMonth());
  const [selected, setSelected] = useState([]);
  const [uploading, setUploading] = useState(false);

  const open = (record = null, employee = null) => {
    const sourceEmployee = employee || employees.find((row) => row.id === record?.employeeId) || null;
    setEditing(record || {});
    setForm(record ? { ...blankPayroll(settings, sourceEmployee), ...record } : blankPayroll(settings, sourceEmployee));
    clearInitialEmployee?.();
  };

  useEffect(() => {
    if (initialEmployee && !editing) open(null, initialEmployee);
  }, [initialEmployee]);

  const totals = useMemo(() => calculatePayrollTotals(form), [form]);
  const filtered = payroll.filter((record) => {
    const matchesMonth = !monthFilter || record.salaryMonth === monthFilter;
    const text = `${record.salarySlipNumber} ${record.employeeNumber} ${record.employeeName}`.toLowerCase();
    return matchesMonth && text.includes(search.toLowerCase());
  });
  const selectedRecords = payroll.filter((record) => selected.includes(record.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every((record) => selected.includes(record.id));

  const chooseEmployee = (employeeId) => {
    const employee = employees.find((row) => row.id === employeeId);
    setForm((current) => ({
      ...current,
      employeeId,
      employeeNumber: employee?.employeeNumber || '',
      employeeName: employee?.name || '',
      designation: employee?.designation || '',
      department: employee?.department || '',
      basicSalary: employee?.basicSalary || 0,
    }));
  };

  const save = async () => {
    if (!form.employeeId || !form.salaryMonth) {
      notify('Employee and salary month are required.', 'error');
      return;
    }
    const payload = {
      ...form,
      ...totals,
      paymentDate: form.status === 'PAID' ? (form.paymentDate || inputDate()) : form.paymentDate,
    };
    try {
      await savePayrollRecord(payload, editing?.id || null);
      setEditing(null);
      notify(editing?.id ? 'Salary record updated.' : 'Salary record created.');
    } catch (reason) {
      notify(reason?.message || 'Could not save salary record.', 'error');
    }
  };

  const makePdf = (record) => createSalarySlipPdf(record, settings);
  const preview = async (record) => {
    try { previewBlob(await makePdf(record)); }
    catch (reason) { notify(reason?.message || 'Could not preview salary slip.', 'error'); }
  };
  const download = async (record) => {
    try { downloadBlob(await makePdf(record), `${record.salarySlipNumber}.pdf`); }
    catch (reason) { notify(reason?.message || 'Could not download salary slip.', 'error'); }
  };

  const uploadOne = async (record, showMessage = true) => {
    const blob = await makePdf(record);
    const [year, month] = record.salaryMonth.split('-');
    const monthName = salaryMonthLabel(record.salaryMonth).split(' ')[0];
    const result = await uploadBusinessPdf(
      blob,
      `${record.salarySlipNumber}-${record.employeeNumber}.pdf`,
      'Payroll',
      settings.driveRootFolder,
      record.driveFileId || '',
      { year, subfolders: [monthName] },
    );
    markDriveConnected(true);
    await saveRecord('payroll', {
      driveFileId: result.id,
      driveWebViewLink: result.webViewLink || record.driveWebViewLink || '',
      driveUpdatedAt: new Date().toISOString(),
    }, record.id);
    if (showMessage) notify(result.replaced ? 'Salary slip replaced on Google Drive.' : 'Salary slip saved to Google Drive.');
    return result;
  };

  const uploadSelected = async () => {
    if (!selectedRecords.length) return notify('Select at least one salary record.', 'error');
    setUploading(true);
    try {
      let replaced = 0;
      for (const record of selectedRecords) {
        const result = await uploadOne(record, false);
        if (result.replaced) replaced += 1;
      }
      notify(`${selectedRecords.length} salary slip${selectedRecords.length === 1 ? '' : 's'} saved to Google Drive${replaced ? ` (${replaced} replaced)` : ''}.`);
      setSelected([]);
    } catch (reason) {
      notify(reason?.message || 'Could not save selected salary slips.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const monthlyRecords = payroll.filter((record) => record.salaryMonth === monthFilter && record.status !== 'CANCELLED');
  const monthlyNet = monthlyRecords.reduce((sum, record) => sum + Number(record.netSalary || 0), 0);
  const monthlyOvertime = monthlyRecords.reduce((sum, record) => sum + Number(record.overtimeAmount || 0), 0);
  const monthlyDeductions = monthlyRecords.reduce((sum, record) => sum + Number(record.totalDeductions || 0), 0);

  return <>
    <section className="stats-grid enterprise-summary-grid">
      <article className="stat-card"><span>▣</span><p>Net payroll</p><strong>{currency(monthlyNet, settings.currency)}</strong><small>{salaryMonthLabel(monthFilter)}</small></article>
      <article className="stat-card"><span>↗</span><p>Overtime cost</p><strong>{currency(monthlyOvertime, settings.currency)}</strong><small>{monthlyRecords.length} salary records</small></article>
      <article className="stat-card"><span>↘</span><p>Total deductions</p><strong>{currency(monthlyDeductions, settings.currency)}</strong><small>For selected month</small></article>
    </section>

    <div className="page-actions">
      <div className="employee-filters">
        <div className="search-box">⌕<input placeholder="Search payroll" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} />
      </div>
      <div className="page-action-buttons">
        <button className="button button-secondary" onClick={uploadSelected} disabled={!selected.length || uploading}>{uploading ? 'Saving…' : `⇧ Drive selected${selected.length ? ` (${selected.length})` : ''}`}</button>
        <button className="button button-primary" onClick={() => open()}>＋ Process salary</button>
      </div>
    </div>

    <section className="panel">
      <div className="responsive-table">
        <table>
          <thead><tr><th className="select-column"><input type="checkbox" checked={allVisibleSelected} onChange={() => { const ids = filtered.map((record) => record.id); setSelected(allVisibleSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]); }} /></th><th>Salary slip</th><th>Employee</th><th>Month</th><th>Gross</th><th>Deductions</th><th>Net salary</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{filtered.map((record) => <tr key={record.id} className={selected.includes(record.id) ? 'selected-row' : ''}>
            <td className="select-column"><input type="checkbox" checked={selected.includes(record.id)} onChange={() => setSelected((current) => current.includes(record.id) ? current.filter((id) => id !== record.id) : [...current, record.id])} /></td>
            <td data-label="Salary slip"><strong>{record.salarySlipNumber}</strong>{record.driveWebViewLink && <a className="drive-link" href={record.driveWebViewLink} target="_blank" rel="noreferrer">Drive</a>}</td>
            <td data-label="Employee">{record.employeeName}<small className="cell-subtext">{record.employeeNumber}</small></td>
            <td data-label="Month">{salaryMonthLabel(record.salaryMonth)}</td>
            <td data-label="Gross">{currency(record.grossSalary, settings.currency)}</td>
            <td data-label="Deductions">{currency(record.totalDeductions, settings.currency)}</td>
            <td data-label="Net salary"><strong>{currency(record.netSalary, settings.currency)}</strong></td>
            <td data-label="Status"><span className={`status status-${record.status?.toLowerCase()}`}>{record.status}</span></td>
            <td data-label="Actions"><div className="row-actions"><button onClick={() => open(record)}>Edit</button><button onClick={() => preview(record)}>Preview</button><button onClick={() => download(record)}>PDF</button><button onClick={() => uploadOne(record)}>{record.driveFileId ? 'Replace Drive' : 'Drive'}</button><button className="danger" onClick={async () => { if (confirm(`Delete ${record.salarySlipNumber}?`)) { await deleteRecord('payroll', record.id); notify('Salary record deleted.'); } }}>Delete</button></div></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!filtered.length && <EmptyState icon="▣" title="No payroll records found" text="Process a salary or change the selected month." />}
    </section>

    <Modal open={Boolean(editing)} title={editing?.id ? 'Edit salary record' : 'Process employee salary'} onClose={() => setEditing(null)}>
      <div className="document-section-title">Employee and salary month</div>
      <div className="form-grid">
        <label><span>Employee</span><select disabled={Boolean(editing?.id)} value={form.employeeId} onChange={(event) => chooseEmployee(event.target.value)}><option value="">Select employee</option>{employees.filter((employee) => employee.status === 'ACTIVE' || employee.id === form.employeeId).map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} · {employee.name}</option>)}</select></label>
        <label><span>Salary month</span><input disabled={Boolean(editing?.id)} type="month" value={form.salaryMonth} onChange={(event) => setForm({ ...form, salaryMonth: event.target.value })} /></label>
        <label><span>Salary slip number</span><input value={form.salarySlipNumber} onChange={(event) => setForm({ ...form, salarySlipNumber: event.target.value })} /></label>
        <label><span>Basic salary</span><input type="number" min="0" step="0.01" value={form.basicSalary} onChange={(event) => setForm({ ...form, basicSalary: event.target.value })} /></label>
      </div>

      <div className="document-section-title">Earnings</div>
      <div className="form-grid payroll-grid">
        <label><span>Overtime hours</span><input type="number" min="0" step="0.25" value={form.overtimeHours} onChange={(event) => setForm({ ...form, overtimeHours: event.target.value })} /></label>
        <label><span>Overtime rate</span><input type="number" min="0" step="0.01" value={form.overtimeRate} onChange={(event) => setForm({ ...form, overtimeRate: event.target.value })} /></label>
        <label><span>Allowances</span><input type="number" min="0" step="0.01" value={form.allowances} onChange={(event) => setForm({ ...form, allowances: event.target.value })} /></label>
        <label><span>Bonus</span><input type="number" min="0" step="0.01" value={form.bonus} onChange={(event) => setForm({ ...form, bonus: event.target.value })} /></label>
        <label><span>Other earnings</span><input type="number" min="0" step="0.01" value={form.otherEarnings} onChange={(event) => setForm({ ...form, otherEarnings: event.target.value })} /></label>
      </div>

      <div className="document-section-title">Deductions</div>
      <div className="form-grid payroll-grid">
        <label><span>Late deduction</span><input type="number" min="0" step="0.01" value={form.lateDeduction} onChange={(event) => setForm({ ...form, lateDeduction: event.target.value })} /></label>
        <label><span>Absent deduction</span><input type="number" min="0" step="0.01" value={form.absentDeduction} onChange={(event) => setForm({ ...form, absentDeduction: event.target.value })} /></label>
        <label><span>Loan deduction</span><input type="number" min="0" step="0.01" value={form.loanDeduction} onChange={(event) => setForm({ ...form, loanDeduction: event.target.value })} /></label>
        <label><span>Advance deduction</span><input type="number" min="0" step="0.01" value={form.advanceDeduction} onChange={(event) => setForm({ ...form, advanceDeduction: event.target.value })} /></label>
        <label><span>Other deductions</span><input type="number" min="0" step="0.01" value={form.otherDeductions} onChange={(event) => setForm({ ...form, otherDeductions: event.target.value })} /></label>
      </div>

      <div className="payroll-calculation">
        <div><span>Basic salary</span><strong>{currency(totals.basicSalary, settings.currency)}</strong></div>
        <div><span>Overtime</span><strong>{currency(totals.overtimeAmount, settings.currency)}</strong></div>
        <div><span>Gross salary</span><strong>{currency(totals.grossSalary, settings.currency)}</strong></div>
        <div><span>Total deductions</span><strong>− {currency(totals.totalDeductions, settings.currency)}</strong></div>
        <div className="payroll-net"><span>Net salary</span><strong>{currency(totals.netSalary, settings.currency)}</strong></div>
      </div>

      <div className="document-section-title">Payment</div>
      <div className="form-grid">
        <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>DRAFT</option><option>APPROVED</option><option>PAID</option><option>CANCELLED</option></select></label>
        <label><span>Payment date</span><input type="date" value={form.paymentDate || ''} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></label>
        <label><span>Payment method</span><select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option></select></label>
        <label className="form-span-2"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save salary</button></footer>
    </Modal>
  </>;
}

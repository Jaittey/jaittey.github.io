import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';
import { normalizeRole, ROLE_LABELS } from '../config/erp';

const empty = { email: '', displayName: '', role: 'user', active: true, notes: '' };

export default function UserManagement({ users, notify }) {
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(empty);
  const sorted = useMemo(
    () => [...users].sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email)),
    [users],
  );

  const open = (record = null) => {
    setForm(record ? { ...empty, ...record, role: normalizeRole(record.role) } : empty);
    setEditor(record || {});
  };

  const save = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email) return notify('Email is required.', 'error');
    await saveRecord('userAccess', { ...form, email, role: normalizeRole(form.role) }, email);
    notify(form.id ? 'User access updated.' : 'User invitation created.');
    setEditor(null);
  };

  const remove = async (record) => {
    if (!confirm(`Remove access for ${record.email}?`)) return;
    await deleteRecord('userAccess', record.id);
    notify('User access removed.');
  };

  return (
    <>
      <div className="page-actions">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h2>Managers and users</h2>
          <p className="page-subtitle">The administrator authorizes accounts. Managers can use all business departments except Administration and User Management. Users only receive Invoices, Quotations, Customers and Inventory.</p>
        </div>
        <button className="button button-primary" onClick={() => open()}>＋ Add user access</button>
      </div>

      <section className="role-permission-summary">
        <article className="panel"><span>◆</span><div><h3>Manager</h3><p>All operational departments, reports, cloud and notifications. No Administration or User Management.</p></div></article>
        <article className="panel"><span>◇</span><div><h3>User</h3><p>Quotations, Invoices, Customers and Inventory only.</p></div></article>
      </section>

      <section className="user-role-grid">
        {sorted.map((record) => {
          const role = normalizeRole(record.role);
          return (
            <article className="panel user-role-card" key={record.id}>
              <div className="user-role-avatar">{(record.displayName || record.email || '?').slice(0, 1).toUpperCase()}</div>
              <div className="user-role-info">
                <h3>{record.displayName || 'Unnamed user'}</h3>
                <p>{record.email}</p>
                <span className="role-badge">{ROLE_LABELS[role]}</span>
                <span className={`status ${record.active === false ? 'status-cancelled' : 'status-paid'}`}>{record.active === false ? 'DISABLED' : 'ACTIVE'}</span>
              </div>
              <div className="row-actions">
                <button onClick={() => open(record)}>Edit</button>
                <button className="danger" onClick={() => remove(record)}>Remove</button>
              </div>
            </article>
          );
        })}
      </section>

      {!sorted.length && <section className="panel"><EmptyState icon="♚" title="No delegated users" text="The owner remains the administrator. Add a Manager or User account here." /></section>}

      {editor && <Modal open title={form.id ? 'Edit user access' : 'Add user access'} onClose={() => setEditor(null)}>
        <div className="form-grid">
          <label><span>Email</span><input type="email" value={form.email} disabled={Boolean(form.id)} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label><span>Display name</span><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
          <label><span>Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="manager">Manager</option><option value="user">User</option></select></label>
          <label className="checkbox-label"><input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm({ ...form, active: e.target.checked })} /><span>Access enabled</span></label>
          <label className="form-span-2"><span>Notes</span><textarea rows="4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        </div>
        <div className="alert alert-info">For email/password access, the person selects “Activate account” after this email has been authorized. Passwords remain private in Firebase.</div>
        <footer className="modal-actions"><button className="button button-ghost" onClick={() => setEditor(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save access</button></footer>
      </Modal>}
    </>
  );
}

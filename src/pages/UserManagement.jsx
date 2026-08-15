import { useMemo, useState } from 'react';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { deleteRecord, saveRecord } from '../services/database';
import {
  DEFAULT_ROLE_PERMISSIONS,
  getEffectivePermissions,
  MANAGER_FULL_PERMISSIONS,
  normalizeRole,
  PERMISSION_GROUPS,
  ROLE_LABELS,
  USER_DEFAULT_PERMISSIONS,
} from '../config/erp';

const empty = {
  email: '',
  displayName: '',
  role: 'user',
  active: true,
  notes: '',
  customPermissions: false,
  permissions: USER_DEFAULT_PERMISSIONS,
};

const unique = (values = []) => [...new Set(values.filter(Boolean))];

export default function UserManagement({ users, notify }) {
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(empty);

  const sorted = useMemo(
    () => [...users].sort((a, b) => (
      (a.displayName || a.email).localeCompare(b.displayName || b.email)
    )),
    [users],
  );

  const open = (record = null) => {
    if (!record) {
      setForm({ ...empty, permissions: [...USER_DEFAULT_PERMISSIONS] });
      setEditor({});
      return;
    }

    const role = normalizeRole(record.role);
    const customPermissions = Boolean(record.customPermissions);
    setForm({
      ...empty,
      ...record,
      role,
      customPermissions,
      permissions: getEffectivePermissions(
        role,
        record.permissions,
        customPermissions,
      ).filter((permission) => permission !== 'preferences'),
    });
    setEditor(record);
  };

  const changeRole = (role) => {
    const normalized = normalizeRole(role);
    setForm((current) => ({
      ...current,
      role: normalized,
      customPermissions: false,
      permissions: [
        ...(DEFAULT_ROLE_PERMISSIONS[normalized] || USER_DEFAULT_PERMISSIONS),
      ].filter((permission) => permission !== 'preferences'),
    }));
  };

  const togglePermission = (permission) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : unique([...current.permissions, permission]),
    }));
  };

  const setGroup = (pages, enabled) => {
    const pageIds = pages.map(([id]) => id);
    setForm((current) => ({
      ...current,
      permissions: enabled
        ? unique([...current.permissions, ...pageIds])
        : current.permissions.filter((permission) => !pageIds.includes(permission)),
    }));
  };

  const resetPermissions = () => {
    const defaults = form.role === 'manager'
      ? MANAGER_FULL_PERMISSIONS
      : USER_DEFAULT_PERMISSIONS;

    setForm((current) => ({
      ...current,
      permissions: defaults.filter((permission) => permission !== 'preferences'),
    }));
  };

  const save = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email) {
      notify('Email is required.', 'error');
      return;
    }

    const permissions = form.customPermissions
      ? unique(form.permissions).filter((permission) => permission !== 'preferences')
      : [];

    await saveRecord(
      'userAccess',
      {
        email,
        displayName: form.displayName.trim(),
        role: normalizeRole(form.role),
        active: Boolean(form.active),
        notes: form.notes.trim(),
        customPermissions: Boolean(form.customPermissions),
        permissions,
      },
      email,
    );

    notify(form.id ? 'User permissions updated.' : 'User access created.');
    setEditor(null);
  };

  const remove = async (record) => {
    if (!window.confirm(`Remove all Small Business access for ${record.email}?`)) return;
    await deleteRecord('userAccess', record.id);
    notify('User access removed.');
  };

  const activeUsers = sorted.filter((record) => record.active !== false).length;
  const managerCount = sorted.filter((record) => normalizeRole(record.role) === 'manager').length;
  const customCount = sorted.filter((record) => record.customPermissions === true).length;

  return (
    <>
      <section className="access-control-hero panel">
        <div>
          <p className="eyebrow">ADMINISTRATOR ACCESS CONTROL</p>
          <h2>User roles and module permissions</h2>
          <p>Authorize accounts, disable access instantly, assign Manager or User roles, and customize the visible modules for individual accounts.</p>
        </div>
        <button className="button button-primary" onClick={() => open()}>
          ＋ Add account
        </button>
      </section>

      <section className="access-control-stats">
        <article className="panel">
          <span>●</span>
          <div><strong>{activeUsers}</strong><small>Active accounts</small></div>
        </article>
        <article className="panel">
          <span>◆</span>
          <div><strong>{managerCount}</strong><small>Managers</small></div>
        </article>
        <article className="panel">
          <span>⌘</span>
          <div><strong>{customCount}</strong><small>Custom permission sets</small></div>
        </article>
      </section>

      <section className="role-permission-summary">
        <article className="panel">
          <span>◆</span>
          <div>
            <h3>Manager — full operational access</h3>
            <p>Sales & Billing, CRM, Employee Management, Payroll & Attendance, Financial Management, Inventory & Assets, Reports, Cloud and Notifications.</p>
          </div>
        </article>
        <article className="panel">
          <span>◇</span>
          <div>
            <h3>User — standard limited access</h3>
            <p>Quotations, Invoices, Customers, Inventory, Employee viewing, Attendance entry and read-only Payroll. The Administrator may customize this list.</p>
          </div>
        </article>
      </section>

      <section className="user-role-grid">
        {sorted.map((record) => {
          const role = normalizeRole(record.role);
          const effective = getEffectivePermissions(
            role,
            record.permissions,
            record.customPermissions,
          ).filter((permission) => permission !== 'preferences');
          const protectedAdministrator = role === 'administrator';

          return (
            <article className="panel user-role-card access-user-card" key={record.id}>
              <div className="user-role-avatar">
                {(record.displayName || record.email || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="user-role-info">
                <h3>{record.displayName || 'Unnamed user'}</h3>
                <p>{record.email}</p>
                <div className="access-card-badges">
                  <span className="role-badge">{ROLE_LABELS[role]}</span>
                  <span className={`status ${record.active === false ? 'status-cancelled' : 'status-paid'}`}>
                    {record.active === false ? 'DISABLED' : 'ACTIVE'}
                  </span>
                  {record.customPermissions && <span className="custom-access-badge">CUSTOM</span>}
                </div>
                <small>{effective.length} operational permission{effective.length === 1 ? '' : 's'}</small>
              </div>
              <div className="row-actions">
                {protectedAdministrator ? (
                  <span className="role-badge">PROTECTED COMPANY ADMINISTRATOR</span>
                ) : (
                  <>
                    <button onClick={() => open(record)}>Manage access</button>
                    <button className="danger" onClick={() => remove(record)}>Remove</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!sorted.length && (
        <section className="panel">
          <EmptyState
            icon="♚"
            title="No delegated accounts"
            text="The owner remains the Administrator. Add a Manager or User account here."
          />
        </section>
      )}

      {editor && (
        <Modal
          open
          title={form.id ? 'Manage account access' : 'Add account access'}
          onClose={() => setEditor(null)}
        >
          <div className="access-editor">
            <section className="access-editor-identity">
              <div className="form-grid">
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.email}
                    disabled={Boolean(form.id)}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </label>
                <label>
                  <span>Display name</span>
                  <input
                    value={form.displayName}
                    onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  />
                </label>
                <label>
                  <span>Role</span>
                  <select value={form.role} onChange={(event) => changeRole(event.target.value)}>
                    <option value="manager">Manager</option>
                    <option value="user">User</option>
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(form.active)}
                    onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  />
                  <span>Account access enabled</span>
                </label>
                <label className="form-span-2">
                  <span>Administrator notes</span>
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="permission-control-panel">
              <div className="permission-control-heading">
                <div>
                  <p className="eyebrow">MODULE PERMISSIONS</p>
                  <h3>{form.role === 'manager' ? 'Full Manager permissions' : 'User permissions'}</h3>
                  <p>
                    {form.role === 'manager'
                      ? 'Managers receive the complete operational workspace allowed by the company subscription by default. Enable customization only when this specific Manager must be restricted.'
                      : 'Users receive the standard limited workspace by default. Enable customization to add or remove individual modules.'}
                  </p>
                </div>
                <label className="permission-custom-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(form.customPermissions)}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      customPermissions: event.target.checked,
                    }))}
                  />
                  <span>Use custom permissions</span>
                </label>
              </div>

              <div className={`permission-groups ${form.customPermissions ? '' : 'disabled'}`}>
                {PERMISSION_GROUPS.map((group) => {
                  const selectedCount = group.pages.filter(([id]) => (
                    form.permissions.includes(id)
                  )).length;
                  const allSelected = selectedCount === group.pages.length;

                  return (
                    <article className="permission-group-card" key={group.id}>
                      <header>
                        <div>
                          <h4>{group.label}</h4>
                          <p>{group.description}</p>
                        </div>
                        <label>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            disabled={!form.customPermissions}
                            onChange={(event) => setGroup(group.pages, event.target.checked)}
                          />
                          <span>All</span>
                        </label>
                      </header>

                      <div className="permission-page-list">
                        {group.pages.map(([id, label]) => (
                          <label key={id}>
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(id)}
                              disabled={!form.customPermissions}
                              onChange={() => togglePermission(id)}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="permission-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={resetPermissions}
                  disabled={!form.customPermissions}
                >
                  Restore {form.role === 'manager' ? 'Full Manager' : 'Standard User'} Access
                </button>
                <span>Settings → Themes remains available to every authorized account.</span>
              </div>
            </section>
          </div>

          <div className="alert alert-info">
            Permission changes apply to logged-in users automatically. Passwords remain private in Supabase Auth.
          </div>

          <footer className="modal-actions">
            <button className="button button-ghost" onClick={() => setEditor(null)}>Cancel</button>
            <button className="button button-primary" onClick={save}>Save access & permissions</button>
          </footer>
        </Modal>
      )}
    </>
  );
}

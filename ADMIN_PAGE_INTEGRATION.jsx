// Example integration for your existing Users & Permissions page.
// Merge this handler/form into the current page instead of replacing the whole page.

import { useState } from "react";
import { createCompanyLogin, friendlyCompanyUserError } from "./src/services/companyUsers";

export function CreateCompanyUserForm({ companyId, onCreated }) {
  const [form, setForm] = useState({
    displayName: "", email: "", password: "", role: "user", permissions: []
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const user = await createCompanyLogin({ companyId, ...form });
      setMessage(`Login created for ${user.email}.`);
      setForm({ displayName: "", email: "", password: "", role: "user", permissions: [] });
      onCreated?.(user);
    } catch (err) {
      setMessage(friendlyCompanyUserError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card form-grid">
      <h3>Create company login</h3>
      <p className="muted">Create a login for an employee or manager in this company.</p>

      <label>Display name
        <input required value={form.displayName}
          onChange={e => setForm({...form, displayName:e.target.value})} />
      </label>

      <label>Email address
        <input required type="email" autoCapitalize="none" value={form.email}
          onChange={e => setForm({...form, email:e.target.value})} />
      </label>

      <label>Temporary password
        <input required type="password" minLength={8} value={form.password}
          onChange={e => setForm({...form, password:e.target.value})} />
      </label>

      <label>Role
        <select value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
          <option value="user">User</option>
          <option value="manager">Manager</option>
        </select>
      </label>

      <button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create company login"}
      </button>

      {message && <div role="status">{message}</div>}
    </form>
  );
}

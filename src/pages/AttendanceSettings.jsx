import { useEffect, useState } from 'react';
import { saveAttendanceShift, deleteAttendanceShift } from '../services/database';
import { DEFAULT_SHIFTS, normalizeShifts } from '../utils/shifts';

const blankShift = { name: '', startTime: '08:00', endTime: '16:00', isDefault: false, active: true };

export default function AttendanceSettings({ shifts, notify }) {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(blankShift);
  useEffect(() => setRows(normalizeShifts(shifts)), [shifts]);

  const saveRow = async (row) => {
    if (!row.name || !row.startTime || !row.endTime) return notify('Shift name, start time and end time are required.', 'error');
    await saveAttendanceShift(row);
    notify(`${row.name} shift saved.`);
  };

  const addShift = async () => {
    await saveRow(draft);
    setDraft(blankShift);
  };

  const remove = async (row) => {
    if (!confirm(`Delete ${row.name} shift?`)) return;
    await deleteAttendanceShift(row.id);
    notify('Shift deleted.');
  };

  return <>
    <div className="page-actions"><div><p className="eyebrow">ATTENDANCE SETTINGS</p><h2>Shift presets</h2><p className="page-subtitle">Customize the quick shift buttons used in every employee attendance calendar.</p></div></div>
    {!shifts.length && <div className="alert alert-info">The standard Morning, Evening and Night shifts are active. Save any row to create custom settings.</div>}
    <section className="shift-settings-grid">
      {rows.map((row) => <article className="panel shift-setting-card" key={row.id}>
        <label><span>Shift name</span><input value={row.name} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, name: e.target.value } : item))} /></label>
        <div className="shift-time-pair"><label><span>Start</span><input type="time" value={row.startTime} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, startTime: e.target.value } : item))} /></label><label><span>End</span><input type="time" value={row.endTime} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, endTime: e.target.value } : item))} /></label></div>
        <label className="checkbox-label"><input type="checkbox" checked={Boolean(row.isDefault)} onChange={(e) => setRows((current) => current.map((item) => ({ ...item, isDefault: item.id === row.id ? e.target.checked : e.target.checked ? false : item.isDefault })))} /><span>Default shift</span></label>
        <div className="row-actions"><button onClick={() => saveRow(row)}>Save</button>{!DEFAULT_SHIFTS.some((item) => item.id === row.id) && <button className="danger" onClick={() => remove(row)}>Delete</button>}</div>
      </article>)}
      <article className="panel shift-setting-card new-shift-card">
        <h3>Add new shift</h3>
        <label><span>Shift name</span><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Example: Split Shift" /></label>
        <div className="shift-time-pair"><label><span>Start</span><input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} /></label><label><span>End</span><input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></label></div>
        <button className="button button-primary" onClick={addShift}>＋ Add shift</button>
      </article>
    </section>
  </>;
}

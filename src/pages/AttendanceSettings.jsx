import { useEffect, useMemo, useState } from 'react';
import { saveAttendanceSettings } from '../services/database';
import { DEFAULT_ATTENDANCE_SHIFTS, normalizeAttendanceShifts, timeRangeHours } from '../utils/payroll';

const newShift = () => ({
  id: `shift_${Date.now()}`,
  name: 'New Shift',
  startTime: '08:00',
  endTime: '16:00',
  isDefault: false,
  active: true,
});

export default function AttendanceSettings({ attendanceSettings, notify }) {
  const [shifts, setShifts] = useState(normalizeAttendanceShifts(attendanceSettings));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShifts(normalizeAttendanceShifts(attendanceSettings));
  }, [attendanceSettings]);

  const activeCount = useMemo(() => shifts.filter((shift) => shift.active).length, [shifts]);

  const updateShift = (id, patch) => {
    setShifts((current) => current.map((shift) => {
      if (patch.isDefault && shift.id !== id) return { ...shift, isDefault: false };
      return shift.id === id ? { ...shift, ...patch } : shift;
    }));
  };

  const removeShift = (id) => {
    if (shifts.length <= 1) return notify('At least one shift must remain.', 'error');
    if (!confirm('Remove this shift? Existing attendance records will keep their saved shift details.')) return;
    setShifts((current) => {
      const next = current.filter((shift) => shift.id !== id);
      if (!next.some((shift) => shift.isDefault && shift.active)) {
        const first = next.find((shift) => shift.active) || next[0];
        return next.map((shift) => ({ ...shift, isDefault: shift.id === first?.id }));
      }
      return next;
    });
  };

  const resetDefaults = () => {
    if (!confirm('Restore the Morning, Evening and Night default shifts?')) return;
    setShifts(DEFAULT_ATTENDANCE_SHIFTS.map((shift) => ({ ...shift })));
  };

  const save = async () => {
    const invalid = shifts.find((shift) => !shift.name.trim() || !shift.startTime || !shift.endTime || timeRangeHours(shift.startTime, shift.endTime) <= 0);
    if (invalid) return notify('Every shift needs a name and a valid start and end time.', 'error');
    if (!shifts.some((shift) => shift.active && shift.isDefault)) return notify('Choose one active shift as the default.', 'error');

    setSaving(true);
    try {
      await saveAttendanceSettings({ shifts: shifts.map((shift) => ({ ...shift, name: shift.name.trim() })) });
      notify('Attendance shift settings saved.');
    } catch (reason) {
      notify(reason?.message || 'Could not save attendance settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="attendance-settings-hero panel">
        <div>
          <p className="eyebrow">ATTENDANCE SETTINGS</p>
          <h2>Shift presets</h2>
          <p>Customize the quick shifts used in employee calendars and the missing-attendance window.</p>
        </div>
        <div className="attendance-settings-actions">
          <button className="button button-ghost" onClick={resetDefaults}>Restore defaults</button>
          <button className="button button-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save shift settings'}</button>
        </div>
      </section>

      <div className="attendance-settings-summary">
        <span><strong>{shifts.length}</strong> total shifts</span>
        <span><strong>{activeCount}</strong> active shifts</span>
        <span><strong>{shifts.find((shift) => shift.isDefault)?.name || 'None'}</strong> default shift</span>
      </div>

      <section className="shift-settings-grid">
        {shifts.map((shift) => (
          <article className={`panel shift-settings-card ${shift.isDefault ? 'default-shift-card' : ''}`} key={shift.id}>
            <header>
              <div>
                <p className="eyebrow">{shift.isDefault ? 'DEFAULT SHIFT' : 'SHIFT PRESET'}</p>
                <h3>{shift.name || 'Unnamed shift'}</h3>
              </div>
              <span className={`status ${shift.active ? 'status-paid' : 'status-cancelled'}`}>{shift.active ? 'ACTIVE' : 'DISABLED'}</span>
            </header>

            <div className="shift-settings-form">
              <label><span>Shift name</span><input value={shift.name} onChange={(event) => updateShift(shift.id, { name: event.target.value })} /></label>
              <div className="shift-time-row">
                <label><span>Start time</span><input type="time" value={shift.startTime} onChange={(event) => updateShift(shift.id, { startTime: event.target.value })} /></label>
                <label><span>End time</span><input type="time" value={shift.endTime} onChange={(event) => updateShift(shift.id, { endTime: event.target.value })} /></label>
              </div>
              <div className="shift-duration-preview"><span>Scheduled duration</span><strong>{timeRangeHours(shift.startTime, shift.endTime).toFixed(2)} hours</strong></div>
              <label className="checkbox-label"><input type="checkbox" checked={shift.active} onChange={(event) => updateShift(shift.id, { active: event.target.checked, ...(event.target.checked ? {} : { isDefault: false }) })} /><span>Shift is active</span></label>
              <label className="checkbox-label"><input type="radio" name="defaultShift" checked={shift.isDefault} disabled={!shift.active} onChange={() => updateShift(shift.id, { isDefault: true })} /><span>Use as default shift</span></label>
            </div>

            <button className="button button-danger shift-remove-button" onClick={() => removeShift(shift.id)}>Remove shift</button>
          </article>
        ))}

        <button className="add-shift-card" onClick={() => setShifts((current) => [...current, newShift()])}>
          <span>＋</span>
          <strong>Add another shift</strong>
          <small>Create a custom shift name and duty time.</small>
        </button>
      </section>

      <div className="alert alert-info">Morning 08:00–16:00 is the initial default. Evening and Night correctly calculate overnight duty hours when the end time is after midnight.</div>
    </>
  );
}

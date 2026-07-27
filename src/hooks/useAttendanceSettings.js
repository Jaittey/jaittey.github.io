import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DEFAULT_ATTENDANCE_SHIFTS, normalizeAttendanceShifts } from '../utils/payroll';

export const defaultAttendanceSettings = {
  shifts: DEFAULT_ATTENDANCE_SHIFTS,
};

export function useAttendanceSettings(enabled = true) {
  const [attendanceSettings, setAttendanceSettings] = useState(defaultAttendanceSettings);

  useEffect(() => {
    if (!enabled) {
      setAttendanceSettings(defaultAttendanceSettings);
      return undefined;
    }

    return onSnapshot(doc(db, 'settings', 'attendance'), (snapshot) => {
      const stored = snapshot.exists() ? snapshot.data() : {};
      setAttendanceSettings({
        ...defaultAttendanceSettings,
        ...stored,
        shifts: normalizeAttendanceShifts(stored),
      });
    });
  }, [enabled]);

  return attendanceSettings;
}

export const DEFAULT_SHIFTS = [
  { id: 'morning', name: 'Morning', startTime: '08:00', endTime: '16:00', isDefault: true, active: true },
  { id: 'evening', name: 'Evening', startTime: '16:00', endTime: '00:00', isDefault: false, active: true },
  { id: 'night', name: 'Night', startTime: '00:00', endTime: '08:00', isDefault: false, active: true },
];

export const normalizeShifts = (records = []) => {
  const configured = records.length ? records : DEFAULT_SHIFTS;
  return configured.filter((shift) => shift.active !== false).map((shift, index) => ({
    ...shift,
    id: shift.id || `shift-${index + 1}`,
    isDefault: Boolean(shift.isDefault) || (!configured.some((row) => row.isDefault) && index === 0),
  }));
};

export const timeToMinutes = (value = '00:00') => {
  const [hours, minutes] = String(value).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const shiftHours = (startTime, endTime) => {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(0, (end - start) / 60);
};

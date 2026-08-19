let activeBusinessId = '';
let activeBusinessName = '';

export function setActiveBusinessContext(business = null) {
  activeBusinessId = business?.id || '';
  activeBusinessName = business?.name || business?.businessName || '';
}
export const getActiveBusinessId = () => activeBusinessId;
export const getActiveBusinessName = () => activeBusinessName;
export function requireActiveBusinessId() {
  if (!activeBusinessId) throw new Error('Select a business workspace first.');
  return activeBusinessId;
}

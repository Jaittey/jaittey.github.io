export const PLAN_IDS = { SILVER: 'SILVER', GOLD: 'GOLD', PLATINUM: 'PLATINUM' };

export const PLAN_DEFINITIONS = {
  SILVER: {
    id: 'SILVER', name: 'VIP Silver', tagline: 'Essential sales workspace', level: 1,
    pages: ['dashboard','quotes','invoices','customers','products','preferences'],
    highlights: ['Quotations','Invoices','Customers','Inventory'],
  },
  GOLD: {
    id: 'GOLD', name: 'VIP Gold', tagline: 'Operations and workforce', level: 2,
    pages: ['dashboard','quotes','invoices','billing','payments','customers','contracts','statements','employees','hr-records','payroll','attendance','attendance-settings','products','suppliers','assets','preferences'],
    highlights: ['Everything in Silver','Sales & Billing','CRM','Employee Management','Payroll & Attendance','Inventory & Assets'],
  },
  PLATINUM: {
    id: 'PLATINUM', name: 'VIP Platinum', tagline: 'Complete Small Business Suite', level: 3,
    pages: ['dashboard','quotes','invoices','billing','payments','customers','contracts','statements','employees','hr-records','payroll','attendance','attendance-settings','finance','expenses','budget','tax','products','suppliers','assets','reports','cloud','notifications','preferences'],
    highlights: ['Everything in Gold','Financial Management','Reports & Analytics','Cloud & Documents','Google Drive','Business Backup & Restore'],
  },
};

export const DEFAULT_PLAN_SETTINGS = Object.values(PLAN_DEFINITIONS).map((plan) => ({
  ...plan,
  monthlyPrice: 0,
  yearlyPrice: 0,
  currency: 'MVR',
  monthlyBillingCycleDays: 30,
  yearlyBillingCycleDays: 365,
  active: true,
}));
export const getPlan = (planId) => PLAN_DEFINITIONS[planId] || null;
export const isSubscriptionActive = (subscription = {}) => {
  if (subscription.status !== 'ACTIVE') return false;
  if (!subscription.endsAt) return true;
  const ends = typeof subscription.endsAt?.toDate === 'function' ? subscription.endsAt.toDate() : new Date(subscription.endsAt);
  return !Number.isNaN(ends.getTime()) && ends.getTime() > Date.now();
};
export const planAllowsPage = (planId, page) => {
  if (['preferences','subscription','settings','users'].includes(page)) return true;
  return Boolean(getPlan(planId)?.pages.includes(page));
};
export const hasPlatinum = (planId) => planId === PLAN_IDS.PLATINUM;

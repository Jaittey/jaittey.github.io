export const OWNER_EMAIL_FALLBACK = 'jaeitte@gmail.com';

export const ROLE_LABELS = {
  administrator: 'Administrator',
  manager: 'Manager',
  user: 'User',
};

export const normalizeRole = (role) => {
  if (role === 'administrator' || role === 'manager' || role === 'user') return role;
  return 'user';
};

export const MANAGER_FULL_PERMISSIONS = [
  'dashboard',
  'pos',
  'quotes',
  'invoices',
  'billing',
  'payments',
  'customers',
  'contracts',
  'statements',
  'products',
  'suppliers',
  'purchase-orders',
  'marketplace',
  'kitchen',
  'service-jobs',
  'assets',
  'employees',
  'hr-records',
  'payroll',
  'final-settlements',
  'attendance',
  'attendance-settings',
  'finance',
  'income-payments',
  'expenses',
  'budget',
  'tax',
  'reports',
  'cloud',
  'notifications',
  'preferences',
];

export const USER_DEFAULT_PERMISSIONS = [
  'pos',
  'quotes',
  'invoices',
  'customers',
  'products',
  'employees',
  'attendance',
  'payroll',
  'preferences',
];

export const DEFAULT_ROLE_PERMISSIONS = {
  administrator: ['*'],
  manager: MANAGER_FULL_PERMISSIONS,
  user: USER_DEFAULT_PERMISSIONS,
};

export const PERMISSION_GROUPS = [
  {
    id: 'dashboard',
    label: 'Main Dashboard',
    description: 'Business overview and operational summaries.',
    pages: [['dashboard', 'Main Dashboard']],
  },
  {
    id: 'sales',
    label: 'Sales & Commerce',
    description: 'Point of sale, customer sales, billing and online orders.',
    pages: [
      ['pos', 'Adaptive POS System'],
      ['invoices', 'Invoices'],
      ['quotes', 'Quotations'],
      ['billing', 'Recurring Billing'],
      ['payments', 'Payments'],
      ['customers', 'Customers'],
      ['marketplace', 'Marketplace Orders'],
      ['contracts', 'Contracts'],
      ['statements', 'Customer Statements'],
    ],
  },
  {
    id: 'operations',
    label: 'Inventory & Operations',
    description: 'Goods, stock, purchasing, restaurant and service operations.',
    pages: [
      ['products', 'Inventory'],
      ['suppliers', 'Suppliers'],
      ['purchase-orders', 'Purchase Orders'],
      ['kitchen', 'Restaurant Kitchen'],
      ['service-jobs', 'Garage Service Jobs'],
      ['assets', 'Company Assets'],
    ],
  },
  {
    id: 'employees',
    label: 'Employee Management',
    description: 'Employee profiles, attendance, payroll and settlements.',
    pages: [
      ['employees', 'Employees'],
      ['hr-records', 'HR Records'],
      ['attendance', 'Attendance'],
      ['attendance-settings', 'Attendance Settings'],
      ['payroll', 'Payroll'],
      ['final-settlements', 'Final Settlements'],
    ],
  },
  {
    id: 'finance',
    label: 'Financial Management',
    description: 'Finance overview, expenses, budgets and tax reports.',
    pages: [
      ['finance', 'Finance Overview'],
      ['income-payments', 'Income & Payments'],
      ['expenses', 'Expenses'],
      ['budget', 'Budget'],
      ['tax', 'GST & Tax'],
    ],
  },
  {
    id: 'insights',
    label: 'Reports & Cloud',
    description: 'Reports, documents and operational notifications.',
    pages: [
      ['reports', 'Reports & Analytics'],
      ['cloud', 'Cloud & Documents'],
      ['notifications', 'Notifications'],
    ],
  },
];

export const getEffectivePermissions = (
  role,
  permissions = [],
  customPermissions = false,
) => {
  const normalized = normalizeRole(role);
  if (normalized === 'administrator') return ['*'];
  const defaults = DEFAULT_ROLE_PERMISSIONS[normalized] || [];
  const selected = customPermissions && Array.isArray(permissions)
    ? permissions.filter(Boolean)
    : defaults;
  return [...new Set([...selected, 'preferences'])];
};

export const canAccessPage = (
  role,
  page,
  permissions = [],
  customPermissions = false,
) => {
  const allowed = getEffectivePermissions(role, permissions, customPermissions);
  return allowed.includes('*') || allowed.includes(page);
};

export const getDefaultPage = (
  role,
  permissions = [],
  customPermissions = false,
) => {
  const allowed = getEffectivePermissions(role, permissions, customPermissions);
  if (allowed.includes('*') || allowed.includes('dashboard')) return 'dashboard';
  return [
    'pos','invoices','quotes','marketplace','products','attendance','payroll',
    'customers','employees','reports','preferences',
  ].find((page) => allowed.includes(page)) || 'preferences';
};

export const ERP_NAV = [
  { id: 'dashboard', label: 'Main Dashboard', icon: '▦', page: 'dashboard' },
  {
    id: 'sales',
    label: 'Sales & Commerce',
    icon: '▤',
    children: [
      ['pos', 'Adaptive POS System'],
      ['invoices', 'Invoices'],
      ['quotes', 'Quotations'],
      ['billing', 'Recurring Billing'],
      ['payments', 'Payments'],
      ['customers', 'Customers'],
      ['marketplace', 'Marketplace Orders'],
      ['contracts', 'Contracts'],
      ['statements', 'Customer Statements'],
    ],
  },
  {
    id: 'operations',
    label: 'Inventory & Operations',
    icon: '□',
    children: [
      ['products', 'Inventory'],
      ['suppliers', 'Suppliers'],
      ['purchase-orders', 'Purchase Orders'],
      ['kitchen', 'Restaurant Kitchen'],
      ['service-jobs', 'Garage Service Jobs'],
      ['assets', 'Company Assets'],
    ],
  },
  {
    id: 'hr',
    label: 'Employee Management',
    icon: '♙',
    children: [
      ['employees', 'Employees'],
      ['hr-records', 'HR Records'],
      ['attendance', 'Attendance'],
      ['attendance-settings', 'Attendance Settings'],
      ['payroll', 'Payroll'],
      ['final-settlements', 'Final Settlements'],
    ],
  },
  {
    id: 'finance-group',
    label: 'Financial Management',
    icon: '◈',
    children: [
      ['finance', 'Finance Overview'],
      ['income-payments', 'Income & Payments'],
      ['expenses', 'Expenses'],
      ['budget', 'Budget'],
      ['tax', 'GST & Tax'],
    ],
  },
  {
    id: 'application-manager',
    label: 'Application Manager',
    icon: '⌘',
    children: [
      ['settings', 'Company Administration'],
      ['users', 'Users & Permissions'],
      ['reports', 'Reports & Analytics'],
      ['cloud', 'Cloud & Documents'],
      ['activity', 'Activity Logs'],
      ['preferences', 'User Preferences / Themes'],
      ['subscription', 'Subscription & Trial'],
    ],
  },
  {
    id: 'super-admin-group',
    label: 'Super Admin',
    icon: '♦',
    children: [
      ['super-businesses', 'Businesses'],
      ['super-users', 'Platform Users'],
      ['super-requests', 'Subscription Requests'],
      ['super-payments', 'Subscription Payments'],
      ['super-plans', 'Plans'],
      ['super-offers', 'Custom Offers'],
      ['super-banks', 'Bank Accounts'],
      ['super-verification', 'Payment Verification'],
    ],
  },
];

export const PAGE_TITLES = Object.fromEntries(
  ERP_NAV.flatMap((group) => (
    group.page ? [[group.page, group.label]] : group.children || []
  )),
);

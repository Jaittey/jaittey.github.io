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
  'employees',
  'hr-records',
  'payroll',
  'attendance',
  'attendance-settings',
  'finance',
  'expenses',
  'budget',
  'tax',
  'products',
  'suppliers',
  'assets',
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
    label: 'Dashboard',
    description: 'Business overview and operational summaries.',
    pages: [['dashboard', 'Dashboard']],
  },
  {
    id: 'sales',
    label: 'Sales & Billing',
    description: 'Quotations, invoices, recurring billing and payments.',
    pages: [
      ['pos', 'POS System'],
      ['quotes', 'Quotations'],
      ['invoices', 'Invoices'],
      ['billing', 'Recurring Billing'],
      ['payments', 'Payments'],
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Customers, contracts and statements.',
    pages: [
      ['customers', 'Customers'],
      ['contracts', 'Contracts'],
      ['statements', 'Statements'],
    ],
  },
  {
    id: 'employees',
    label: 'Employee Management',
    description: 'Employee profiles and HR history.',
    pages: [
      ['employees', 'Employees'],
      ['hr-records', 'HR Records'],
    ],
  },
  {
    id: 'payroll',
    label: 'Payroll & Attendance',
    description: 'Attendance, shifts, payroll and salary slips.',
    pages: [
      ['payroll', 'Payroll'],
      ['attendance', 'Attendance'],
      ['attendance-settings', 'Attendance Settings'],
    ],
  },
  {
    id: 'finance',
    label: 'Financial Management',
    description: 'Finance overview, expenses, budgets and tax reports.',
    pages: [
      ['finance', 'Finance Overview'],
      ['expenses', 'Expenses'],
      ['budget', 'Budget'],
      ['tax', 'GST & Tax'],
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory & Assets',
    description: 'Inventory, suppliers and company assets.',
    pages: [
      ['products', 'Inventory'],
      ['suppliers', 'Suppliers'],
      ['assets', 'Company Assets'],
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
    'pos',
    'invoices',
    'quotes',
    'attendance',
    'payroll',
    'customers',
    'products',
    'employees',
    'reports',
    'preferences',
  ].find((page) => allowed.includes(page)) || 'preferences';
};

export const ERP_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', page: 'dashboard' },
  {
    id: 'sales',
    label: 'Sales & Billing',
    icon: '▤',
    children: [
      ['pos', 'POS System'],
      ['quotes', 'Quotations'],
      ['invoices', 'Invoices'],
      ['billing', 'Recurring Billing'],
      ['payments', 'Payments'],
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: '◎',
    children: [
      ['customers', 'Customers'],
      ['contracts', 'Contracts'],
      ['statements', 'Statements'],
    ],
  },
  {
    id: 'hr',
    label: 'Employee Management',
    icon: '♙',
    children: [
      ['employees', 'Employees'],
      ['hr-records', 'HR Records'],
    ],
  },
  {
    id: 'payroll-group',
    label: 'Payroll & Attendance',
    icon: '▣',
    children: [
      ['payroll', 'Payroll'],
      ['attendance', 'Attendance'],
      ['attendance-settings', 'Attendance Settings'],
    ],
  },
  {
    id: 'finance-group',
    label: 'Financial Management',
    icon: '◈',
    children: [
      ['finance', 'Finance Overview'],
      ['expenses', 'Expenses'],
      ['budget', 'Budget'],
      ['tax', 'GST & Tax'],
    ],
  },
  {
    id: 'inventory-group',
    label: 'Inventory & Assets',
    icon: '□',
    children: [
      ['products', 'Inventory'],
      ['suppliers', 'Suppliers'],
      ['assets', 'Company Assets'],
    ],
  },
  { id: 'reports-group', label: 'Reports & Analytics', icon: '⌁', page: 'reports' },
  { id: 'cloud-group', label: 'Cloud & Documents', icon: '☁', page: 'cloud' },
  { id: 'notifications-group', label: 'Notifications', icon: '●', page: 'notifications' },
  { id: 'subscription-group', label: 'Subscription', icon: '★', page: 'subscription' },
  { id: 'preferences-group', label: 'Settings', icon: '⚙', page: 'preferences' },
  {
    id: 'admin-group',
    label: 'Administration',
    icon: '♜',
    children: [
      ['settings', 'Company & System'],
      ['activity', 'Activity Logs'],
    ],
  },
  { id: 'users-group', label: 'Company Users', icon: '♚', page: 'users' },
  { id: 'super-admin-group', label: 'Super Admin', icon: '♦', page: 'super-admin' },
];

export const PAGE_TITLES = Object.fromEntries(
  ERP_NAV.flatMap((group) => (
    group.page ? [[group.page, group.label]] : group.children || []
  )),
);

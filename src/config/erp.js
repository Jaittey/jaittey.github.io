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
  'sales-dashboard',
  'employee-dashboard',
  'financial-dashboard',
  'app-manager',
  'inventory-assets',
  'final-settlements',
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
  'sales-dashboard',
  'employee-dashboard',
  'inventory-assets',
  'final-settlements',
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
    id: 'main-dashboard',
    label: 'Main Dashboard',
    description: 'Business overview, quick actions and notifications.',
    pages: [['dashboard', 'Business Overview'], ['notifications', 'Notifications']],
  },
  {
    id: 'sales-pos',
    label: 'Sales & POS Dashboard',
    description: 'POS, sales documents, customers, stock and contracts.',
    pages: [
      ['pos', 'POS System'], ['invoices', 'Invoices'], ['quotes', 'Quotations'],
      ['billing', 'Recurring Billing'], ['payments', 'Payments'], ['customers', 'Customers'],
      ['products', 'Inventory & Assets'], ['contracts', 'Contracts'], ['statements', 'Customer Statements'],
    ],
  },
  {
    id: 'employee-management',
    label: 'Employee Management Dashboard',
    description: 'Employees, HR, attendance, payroll and settlements.',
    pages: [
      ['employees', 'Employees'], ['hr-records', 'HR Records'], ['attendance', 'Attendance'],
      ['attendance-settings', 'Attendance Settings'], ['payroll', 'Payroll'], ['final-settlements', 'Final Settlements'],
    ],
  },
  {
    id: 'financial-management',
    label: 'Financial Management Dashboard',
    description: 'Finance overview, income, expenses, budgets and GST.',
    pages: [['finance', 'Finance Overview'], ['payments', 'Income & Payments'], ['expenses', 'Expenses'], ['budget', 'Budget'], ['tax', 'GST & Tax']],
  },
  {
    id: 'application-manager',
    label: 'Application Manager',
    description: 'Company administration, users, reports, cloud, activity and subscription.',
    pages: [['settings', 'Company Administration'], ['users', 'Users & Permissions'], ['reports', 'Reports & Analytics'], ['cloud', 'Cloud & Documents'], ['activity', 'Activity Logs'], ['preferences', 'User Preferences / Themes'], ['subscription', 'Subscription & Trial']],
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
  {
    id: 'main-dashboard', label: 'Main Dashboard', icon: '▦', hubPage: 'dashboard',
    children: [['notifications', 'Notifications']],
  },
  {
    id: 'sales-pos-dashboard', label: 'Sales & POS Dashboard', icon: '▤', hubPage: 'sales-dashboard',
    children: [
      ['pos', 'POS System'], ['invoices', 'Invoices'], ['quotes', 'Quotations'],
      ['billing', 'Recurring Billing'], ['payments', 'Payments'], ['customers', 'Customers'],
      ['inventory-assets', 'Inventory & Assets'], ['contracts', 'Contracts'], ['statements', 'Customer Statements'],
    ],
  },
  {
    id: 'employee-dashboard', label: 'Employee Management Dashboard', icon: '♙', hubPage: 'employee-dashboard',
    children: [
      ['employees', 'Employees'], ['hr-records', 'HR Records'], ['attendance', 'Attendance'],
      ['attendance-settings', 'Attendance Settings'], ['payroll', 'Payroll'], ['final-settlements', 'Final Settlements'],
    ],
  },
  {
    id: 'financial-dashboard', label: 'Financial Management Dashboard', icon: '◈', hubPage: 'financial-dashboard',
    children: [
      ['finance', 'Finance Overview'], ['payments', 'Income & Payments'], ['expenses', 'Expenses'],
      ['budget', 'Budget'], ['tax', 'GST & Tax'],
    ],
  },
  {
    id: 'application-manager', label: 'Application Manager', icon: '⚙', hubPage: 'app-manager',
    children: [
      ['settings', 'Company Administration'], ['users', 'Users & Permissions'], ['reports', 'Reports & Analytics'],
      ['cloud', 'Cloud & Documents'], ['activity', 'Activity Logs'], ['preferences', 'User Preferences / Themes'],
      ['subscription', 'Subscription & Trial'],
    ],
  },
  {
    id: 'super-admin', label: 'Super Admin', icon: '♦', hubPage: 'super-admin', superAdminOnly: true,
    children: [
      ['super-businesses', 'Businesses'], ['super-users', 'Platform Users'], ['super-requests', 'Subscription Requests'],
      ['super-payments', 'Subscription Payments'], ['super-plans', 'Plans'], ['super-offers', 'Custom Offers'],
      ['super-banks', 'Bank Accounts'], ['super-verification', 'Payment Verification'],
    ],
  },
];

export const PAGE_TITLES = {
  dashboard: 'Main Dashboard', notifications: 'Notifications',
  'sales-dashboard': 'Sales & POS Dashboard', pos: 'POS System', invoices: 'Invoices', quotes: 'Quotations', billing: 'Recurring Billing', payments: 'Payments', customers: 'Customers', 'inventory-assets': 'Inventory & Assets', contracts: 'Contracts', statements: 'Customer Statements',
  'employee-dashboard': 'Employee Management Dashboard', employees: 'Employees', 'hr-records': 'HR Records', attendance: 'Attendance', 'attendance-settings': 'Attendance Settings', payroll: 'Payroll', 'final-settlements': 'Final Settlements',
  'financial-dashboard': 'Financial Management Dashboard', finance: 'Finance Overview', expenses: 'Expenses', budget: 'Budget', tax: 'GST & Tax',
  'app-manager': 'Application Manager', settings: 'Company Administration', users: 'Users & Permissions', reports: 'Reports & Analytics', cloud: 'Cloud & Documents', activity: 'Activity Logs', preferences: 'User Preferences / Themes', subscription: 'Subscription & Trial',
  'super-admin': 'Super Admin', 'super-businesses': 'Businesses', 'super-users': 'Platform Users', 'super-requests': 'Subscription Requests', 'super-payments': 'Subscription Payments', 'super-plans': 'Plans', 'super-offers': 'Custom Offers', 'super-banks': 'Bank Accounts', 'super-verification': 'Payment Verification',
};


export const OWNER_EMAIL_FALLBACK = 'jaeitte@gmail.com';

export const ROLE_LABELS = {
  administrator: 'Administrator',
  manager: 'Manager',
  user: 'User',
};

export const normalizeRole = (role) => {
  if (role === 'administrator' || role === 'manager' || role === 'user') return role;
  // Legacy Accountant, HR Officer and Staff records are intentionally reduced
  // to the safer User permission set until the administrator edits them.
  return 'user';
};

export const PAGE_PERMISSIONS = {
  administrator: ['*'],
  manager: [
    'dashboard', 'quotes', 'invoices', 'billing', 'payments',
    'customers', 'contracts', 'statements',
    'employees', 'hr-records', 'payroll', 'attendance',
    'finance', 'expenses', 'budget', 'tax',
    'products', 'suppliers', 'assets',
    'reports', 'cloud', 'notifications',
  ],
  user: ['quotes', 'invoices', 'customers', 'products', 'employees', 'attendance', 'payroll'],
};

export const canAccessPage = (role, page) => {
  const allowed = PAGE_PERMISSIONS[normalizeRole(role)] || [];
  return allowed.includes('*') || allowed.includes(page);
};

export const getDefaultPage = (role) => (
  normalizeRole(role) === 'user' ? 'invoices' : 'dashboard'
);

export const ERP_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', page: 'dashboard' },
  {
    id: 'sales', label: 'Sales & Billing', icon: '▤',
    children: [
      ['quotes', 'Quotations'],
      ['invoices', 'Invoices'],
      ['billing', 'Recurring Billing'],
      ['payments', 'Payments'],
    ],
  },
  {
    id: 'crm', label: 'CRM', icon: '◎',
    children: [
      ['customers', 'Customers'],
      ['contracts', 'Contracts'],
      ['statements', 'Statements'],
    ],
  },
  {
    id: 'hr', label: 'Employee Management', icon: '♙',
    children: [['employees', 'Employees'], ['hr-records', 'HR Records']],
  },
  {
    id: 'payroll-group', label: 'Payroll & Attendance', icon: '▣',
    children: [['payroll', 'Payroll'], ['attendance', 'Attendance'], ['attendance-settings', 'Attendance Settings']],
  },
  {
    id: 'finance-group', label: 'Financial Management', icon: '◈',
    children: [
      ['finance', 'Finance Overview'],
      ['expenses', 'Expenses'],
      ['budget', 'Budget'],
      ['tax', 'GST & Tax'],
    ],
  },
  {
    id: 'inventory-group', label: 'Inventory & Assets', icon: '□',
    children: [['products', 'Inventory'], ['suppliers', 'Suppliers'], ['assets', 'Company Assets']],
  },
  { id: 'reports-group', label: 'Reports & Analytics', icon: '⌁', page: 'reports' },
  { id: 'cloud-group', label: 'Cloud & Documents', icon: '☁', page: 'cloud' },
  { id: 'notifications-group', label: 'Notifications', icon: '●', page: 'notifications' },
  {
    id: 'admin-group', label: 'Administration', icon: '⚙',
    children: [['settings', 'Company & System'], ['activity', 'Activity Logs']],
  },
  { id: 'users-group', label: 'User Management', icon: '♚', page: 'users' },
];

export const PAGE_TITLES = Object.fromEntries(
  ERP_NAV.flatMap((group) => (group.page ? [[group.page, group.label]] : group.children || [])),
);

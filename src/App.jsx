import { useEffect, useMemo, useState } from 'react';
import AppShell from './components/AppShell';
import ConfirmDialog from './components/ConfirmDialog';
import LoginPage from './components/LoginPage';
import ModuleHub from './components/ModuleHub';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Quotes from './pages/Quotes';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Employees from './pages/Employees';
import Payroll from './pages/Payroll';
import Attendance from './pages/Attendance';
import AttendanceSettings from './pages/AttendanceSettings';
import Budget from './pages/Budget';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import CloudDocuments from './pages/CloudDocuments';
import UserManagement from './pages/UserManagement';
import ActivityLogs from './pages/ActivityLogs';
import { canAccessPage, getDefaultPage } from './config/erp';
import { useAuth } from './hooks/useAuth';
import { useLiveCollection } from './hooks/useLiveCollection';
import { useSettings } from './hooks/useSettings';
import { useAttendanceSettings } from './hooks/useAttendanceSettings';
import { disconnectDrive, isDriveConnected, requestDriveAccess } from './services/drive';

export default function App() {
  const { user, role, loading, error, loginGoogle, loginEmail, registerEmail, logout } = useAuth();
  const authenticated = Boolean(user);
  const settings = useSettings(authenticated);
  const attendanceSettings = useAttendanceSettings(authenticated);
  const invoices = useLiveCollection('invoices', 'createdAt', authenticated && canAccessPage(role, 'invoices'));
  const quotes = useLiveCollection('quotes', 'createdAt', authenticated && canAccessPage(role, 'quotes'));
  const products = useLiveCollection('products', 'createdAt', authenticated && canAccessPage(role, 'products'));
  const expenses = useLiveCollection('expenses', 'createdAt', authenticated && canAccessPage(role, 'expenses'));
  const customers = useLiveCollection('customers', 'createdAt', authenticated && canAccessPage(role, 'customers'));
  const billingContracts = useLiveCollection('billingContracts', 'createdAt', authenticated && canAccessPage(role, 'billing'));
  const employees = useLiveCollection('employees', 'createdAt', authenticated && canAccessPage(role, 'employees'));
  const payroll = useLiveCollection('payroll', 'createdAt', authenticated && canAccessPage(role, 'payroll'));
  const salarySlips = useLiveCollection('salarySlips', 'createdAt', authenticated && canAccessPage(role, 'payroll'));
  const attendance = useLiveCollection('attendance', 'date', authenticated && canAccessPage(role, 'attendance'));
  const payrollPeriods = useLiveCollection('payrollPeriods', 'month', authenticated && canAccessPage(role, 'payroll'));
  const finalSettlements = useLiveCollection('finalSettlements', 'lastWorkingDate', authenticated && canAccessPage(role, 'payroll'));
  const budgets = useLiveCollection('budgets', 'createdAt', authenticated && canAccessPage(role, 'budget'));
  const payments = useLiveCollection('payments', 'createdAt', authenticated && canAccessPage(role, 'payments'));
  const users = useLiveCollection('userAccess', 'updatedAt', authenticated && role === 'administrator');
  const activityLogs = useLiveCollection('activityLogs', 'createdAt', authenticated && role === 'administrator');

  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [driveConnected, setDriveConnected] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [payrollEmployee, setPayrollEmployee] = useState(null);
  const [finalSettlementEmployee, setFinalSettlementEmployee] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('df7-theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('df7-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (authenticated && role && !canAccessPage(role, page)) setPage(getDefaultPage(role));
  }, [authenticated, role, page]);

  const notify = (message, type = 'success') => setToast({ message, type });

  const connectDrive = async () => {
    try {
      await requestDriveAccess();
      setDriveConnected(true);
      notify('Google Drive connected successfully.');
    } catch (reason) {
      notify(reason.message || 'Could not connect Google Drive.', 'error');
    }
  };

  const disconnect = () => {
    disconnectDrive();
    setDriveConnected(false);
    notify('Google Drive disconnected.');
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      disconnectDrive();
      await logout();
      setShowLogoutConfirm(false);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="loader" /><p>Loading DF7 Enterprise v2.1.6…</p></div>;
  if (!user) return <LoginPage loginGoogle={loginGoogle} loginEmail={loginEmail} registerEmail={registerEmail} error={error} loading={loading} theme={theme} toggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} />;

  const common = { settings, notify };
  const hub = (eyebrow, title, description, items) => <ModuleHub eyebrow={eyebrow} title={title} description={description} items={items} onOpen={setPage} />;

  const renderPage = () => {
    switch (page) {
      case 'invoices': return <Invoices invoices={invoices.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} />;
      case 'quotes': return <Quotes quotes={quotes.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} openInvoices={() => setPage('invoices')} />;
      case 'billing': return <Billing contracts={billingContracts.items} customers={customers.items} {...common} openInvoices={() => setPage('invoices')} />;
      case 'payments': return <Payments payments={payments.items} invoices={invoices.items} {...common} />;
      case 'customers': return <Customers customers={customers.items} invoices={invoices.items} {...common} />;
      case 'contracts': return hub('CRM', 'Contracts', 'Manage service agreements and contract renewal workflows.', [
        { title: 'Recurring contracts', icon: '↻', description: 'Active monthly service contracts and school billing.', features: ['Contract number', 'Start and end dates', 'Monthly invoice generation', 'Duplicate protection'], ready: true, page: 'billing' },
        { title: 'Renewal alerts', icon: '!', description: 'Contract expiry notifications are calculated automatically.', features: ['Expiry monitoring', 'Notifications', 'Service periods'], ready: true, page: 'notifications' },
      ]);
      case 'statements': return hub('CRM', 'Customer Statements', 'Review invoices, payments and outstanding balances.', [
        { title: 'Payment history', icon: '↘', description: 'All payments recorded against customer invoices.', features: ['Invoice references', 'Payment methods', 'Outstanding balances'], ready: true, page: 'payments' },
        { title: 'Customer history', icon: '◎', description: 'Customer records and invoice history.', features: ['Contact details', 'Notes', 'Invoice totals'], ready: true, page: 'customers' },
      ]);
      case 'employees': return <Employees employees={employees.items} {...common} role={role} openPayroll={(employee) => { setPayrollEmployee(employee); setPage('payroll'); }} openFinalSettlement={(employee) => { setFinalSettlementEmployee(employee); setPage('payroll'); }} />;
      case 'hr-records': return hub('EMPLOYEE MANAGEMENT', 'HR Records', 'Employee lifecycle and document framework.', [
        { title: 'Employee profiles', icon: '♙', description: 'Personal, emergency, banking and employment details.', features: ['National ID', 'Designation', 'Department', 'Joining date'], ready: true, page: 'employees' },
        { title: 'Promotions & transfers', icon: '↗', description: 'Structured HR history and attachments.', features: ['Promotions', 'Transfers', 'Resignations', 'Employee notes'], ready: false },
      ]);
      case 'payroll': return <Payroll payroll={payroll.items} salarySlips={salarySlips.items} attendance={attendance.items} payrollPeriods={payrollPeriods.items} finalSettlements={finalSettlements.items} employees={employees.items} {...common} role={role} markDriveConnected={setDriveConnected} initialEmployee={payrollEmployee} clearInitialEmployee={() => setPayrollEmployee(null)} initialFinalEmployee={finalSettlementEmployee} clearInitialFinalEmployee={() => setFinalSettlementEmployee(null)} />;
      case 'attendance': return <Attendance attendance={attendance.items} employees={employees.items} payroll={payroll.items} payrollPeriods={payrollPeriods.items} attendanceSettings={attendanceSettings} {...common} role={role} onOpenSettings={() => setPage('attendance-settings')} />;
      case 'attendance-settings': return <AttendanceSettings attendanceSettings={attendanceSettings} notify={notify} />;
      case 'finance': return hub('FINANCIAL MANAGEMENT', 'Finance Overview', 'Income, expenses, budgets and tax controls.', [
        { title: 'Income & payments', icon: '↗', description: 'Revenue and received-payment records.', features: ['Invoice revenue', 'Other income framework', 'Payment history'], ready: true, page: 'payments' },
        { title: 'Expenses', icon: '↘', description: 'Operating expense tracking by category.', features: ['Office', 'Transport', 'Utilities', 'Maintenance'], ready: true, page: 'expenses' },
        { title: 'Budget', icon: '◫', description: 'Annual and monthly budget planning.', features: ['Planned amount', 'Actual amount', 'Remaining budget'], ready: true, page: 'budget' },
      ]);
      case 'expenses': return <Expenses expenses={expenses.items} {...common} />;
      case 'budget': return <Budget budgets={budgets.items} {...common} />;
      case 'tax': return hub('FINANCIAL MANAGEMENT', 'GST & Tax', 'Company GST configuration and tax-ready document controls.', [
        { title: 'GST settings', icon: '%', description: 'GST registration, TIN and default rates are controlled by the Administrator.', features: ['TIN', 'GST percentage', 'Tax invoice title'], ready: true },
        { title: 'GST report', icon: '⌁', description: 'Export invoice and tax data for review.', features: ['GST amounts', 'Taxable totals', 'CSV export'], ready: true, page: 'reports' },
      ]);
      case 'products': return <Products products={products.items} {...common} />;
      case 'suppliers': return hub('INVENTORY & ASSETS', 'Suppliers', 'Supplier and purchase-history workspace.', [{ title: 'Supplier directory', icon: '◎', description: 'Supplier contacts, purchase history and agreements.', features: ['Supplier details', 'Purchase records', 'Notes'], ready: false }]);
      case 'assets': return hub('INVENTORY & ASSETS', 'Company Assets', 'Track office equipment, uniforms, vehicles and assignments.', [{ title: 'Asset register', icon: '□', description: 'Company asset ownership and employee assignment.', features: ['Asset number', 'Condition', 'Assigned employee', 'Maintenance'], ready: false }]);
      case 'reports': return <Reports invoices={invoices.items} quotes={quotes.items} expenses={expenses.items} customers={customers.items} employees={employees.items} payroll={payroll.items} attendance={attendance.items} finalSettlements={finalSettlements.items} products={products.items} settings={settings} />;
      case 'cloud': return <CloudDocuments driveConnected={driveConnected || isDriveConnected()} connectDrive={connectDrive} disconnectDrive={disconnect} counts={{ invoices: invoices.items.length, quotes: quotes.items.length, payroll: payroll.items.length, contracts: billingContracts.items.length }} />;
      case 'notifications': return <Notifications invoices={invoices.items} products={products.items} payroll={payroll.items} budgets={budgets.items} billingContracts={billingContracts.items} />;
      case 'settings': return <Settings {...common} />;
      case 'activity': return <ActivityLogs logs={activityLogs.items} />;
      case 'users': return <UserManagement users={users.items} notify={notify} />;
      default: return canAccessPage(role, 'dashboard') ? <Dashboard invoices={invoices.items} expenses={expenses.items} products={products.items} customers={customers.items} employees={employees.items} payroll={payroll.items} budgets={budgets.items} settings={settings} role={role} onNavigate={setPage} /> : <Invoices invoices={invoices.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} />;
    }
  };

  const sources = [invoices, quotes, products, expenses, customers, billingContracts, employees, payroll, salarySlips, attendance, payrollPeriods, finalSettlements, budgets, payments, users, activityLogs];
  const dataError = sources.find((source) => source.error)?.error;

  return <>
    <AppShell page={page} setPage={setPage} user={user} role={role} requestLogout={() => setShowLogoutConfirm(true)} driveConnected={driveConnected || isDriveConnected()} connectDrive={connectDrive} disconnectDrive={disconnect} businessName={settings.businessName} theme={theme} toggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
      {dataError && <div className="alert alert-error">{dataError}</div>}
      {renderPage()}
    </AppShell>
    <ConfirmDialog open={showLogoutConfirm} title="Sign out of DF7?" message="You will need to sign in again to access the enterprise workspace." confirmLabel="Yes, sign out" danger busy={loggingOut} onCancel={() => setShowLogoutConfirm(false)} onConfirm={confirmLogout} />
    <Toast message={toast.message} type={toast.type} />
  </>;
}

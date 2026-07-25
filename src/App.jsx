import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import ConfirmDialog from './components/ConfirmDialog';
import LoginPage from './components/LoginPage';
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
import Budget from './pages/Budget';
import { useAuth } from './hooks/useAuth';
import { useLiveCollection } from './hooks/useLiveCollection';
import { useSettings } from './hooks/useSettings';
import { disconnectDrive, isDriveConnected, requestDriveAccess } from './services/drive';

export default function App() {
  const { user, loading, error, login, logout } = useAuth();
  const authenticated = Boolean(user);
  const settings = useSettings(authenticated);
  const invoices = useLiveCollection('invoices', 'createdAt', authenticated);
  const quotes = useLiveCollection('quotes', 'createdAt', authenticated);
  const products = useLiveCollection('products', 'createdAt', authenticated);
  const expenses = useLiveCollection('expenses', 'createdAt', authenticated);
  const customers = useLiveCollection('customers', 'createdAt', authenticated);
  const billingContracts = useLiveCollection('billingContracts', 'createdAt', authenticated);
  const employees = useLiveCollection('employees', 'createdAt', authenticated);
  const payroll = useLiveCollection('payroll', 'createdAt', authenticated);
  const budgets = useLiveCollection('budgets', 'createdAt', authenticated);
  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [driveConnected, setDriveConnected] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [payrollEmployee, setPayrollEmployee] = useState(null);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('df7-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('df7-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

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

  if (loading) return <div className="loading-screen"><div className="loader" /><p>Securing DF7…</p></div>;
  if (!user) {
    return (
      <LoginPage
        login={login}
        error={error}
        loading={loading}
        theme={theme}
        toggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
      />
    );
  }

  const common = { settings, notify };
  const renderPage = () => {
    switch (page) {
      case 'invoices': return <Invoices invoices={invoices.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} />;
      case 'quotes': return <Quotes quotes={quotes.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} openInvoices={() => setPage('invoices')} />;
      case 'products': return <Products products={products.items} {...common} />;
      case 'expenses': return <Expenses expenses={expenses.items} {...common} />;
      case 'customers': return <Customers customers={customers.items} invoices={invoices.items} {...common} />;
      case 'billing': return <Billing contracts={billingContracts.items} customers={customers.items} {...common} openInvoices={() => setPage('invoices')} />;
      case 'employees': return <Employees employees={employees.items} {...common} openPayroll={(employee) => { setPayrollEmployee(employee); setPage('payroll'); }} />;
      case 'payroll': return <Payroll payroll={payroll.items} employees={employees.items} {...common} markDriveConnected={setDriveConnected} initialEmployee={payrollEmployee} clearInitialEmployee={() => setPayrollEmployee(null)} />;
      case 'budget': return <Budget budgets={budgets.items} {...common} />;
      case 'settings': return <Settings {...common} />;
      default: return <Dashboard invoices={invoices.items} expenses={expenses.items} products={products.items} customers={customers.items} employees={employees.items} payroll={payroll.items} budgets={budgets.items} settings={settings} />;
    }
  };

  const dataError = [invoices, quotes, products, expenses, customers, billingContracts, employees, payroll, budgets].find((source) => source.error)?.error;
  return <>
    <AppShell
      page={page}
      setPage={setPage}
      user={user}
      requestLogout={() => setShowLogoutConfirm(true)}
      driveConnected={driveConnected || isDriveConnected()}
      connectDrive={connectDrive}
      disconnectDrive={disconnect}
      businessName={settings.businessName}
      theme={theme}
      toggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
    >
      {dataError && <div className="alert alert-error">{dataError}</div>}
      {renderPage()}
    </AppShell>
    <ConfirmDialog
      open={showLogoutConfirm}
      title="Sign out of DF7?"
      message="You will need to sign in with your approved Google account to access the business workspace again."
      confirmLabel="Yes, sign out"
      danger
      busy={loggingOut}
      onCancel={() => setShowLogoutConfirm(false)}
      onConfirm={confirmLogout}
    />
    <Toast message={toast.message} type={toast.type} />
  </>;
}

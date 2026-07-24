import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import LoginPage from './components/LoginPage';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Quotes from './pages/Quotes';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
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
  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [driveConnected, setDriveConnected] = useState(false);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (message, type = 'success') => setToast({ message, type });
  const connectDrive = async () => {
    try { await requestDriveAccess(); setDriveConnected(true); notify('Google Drive connected.'); }
    catch (reason) { notify(reason.message || 'Could not connect Google Drive.', 'error'); }
  };
  const disconnect = () => { disconnectDrive(); setDriveConnected(false); notify('Google Drive disconnected.'); };

  if (loading) return <div className="loading-screen"><div className="loader" /><p>Securing DF7…</p></div>;
  if (!user) return <LoginPage login={login} error={error} loading={loading} />;

  const common = { settings, notify };
  const renderPage = () => {
    switch (page) {
      case 'invoices': return <Invoices invoices={invoices.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} />;
      case 'quotes': return <Quotes quotes={quotes.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} openInvoices={() => setPage('invoices')} />;
      case 'products': return <Products products={products.items} {...common} />;
      case 'expenses': return <Expenses expenses={expenses.items} {...common} />;
      case 'customers': return <Customers customers={customers.items} invoices={invoices.items} {...common} />;
      case 'settings': return <Settings {...common} />;
      default: return <Dashboard invoices={invoices.items} expenses={expenses.items} products={products.items} customers={customers.items} settings={settings} />;
    }
  };

  const dataError = [invoices, quotes, products, expenses, customers].find((source) => source.error)?.error;
  return <>
    <AppShell page={page} setPage={setPage} user={user} logout={logout} driveConnected={driveConnected || isDriveConnected()} connectDrive={connectDrive} disconnectDrive={disconnect} businessName={settings.businessName}>
      {dataError && <div className="alert alert-error">{dataError}</div>}
      {renderPage()}
    </AppShell>
    <Toast message={toast.message} type={toast.type} />
  </>;
}

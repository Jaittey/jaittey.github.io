import { lazy, Suspense, useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import ConfirmDialog from './components/ConfirmDialog';
import LoginPage from './components/LoginPage';
import ModuleHub from './components/ModuleHub';
import Toast from './components/Toast';
import PageLoader from './components/PageLoader';
import { canAccessPage, normalizeRole } from './config/erp';
import { isSubscriptionActive, planAllowsPage } from './config/plans';
import { useAuth } from './hooks/useAuth';
import { useWorkspace } from './hooks/useWorkspace';
import { useLiveCollection } from './hooks/useLiveCollection';
import { useGlobalCollection } from './hooks/useGlobalCollection';
import { useSubscriptionRequests } from './hooks/useSubscriptionRequests';
import { useSettings } from './hooks/useSettings';
import { useAttendanceSettings } from './hooks/useAttendanceSettings';
import { useCompanyAssets } from './hooks/useCompanyAssets';
import { normalizeTheme } from './config/themes';
import { disconnectDrive, isDriveConnected, requestDriveAccess } from './services/drive';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const POS = lazy(() => import('./pages/POS'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Quotes = lazy(() => import('./pages/Quotes'));
const Products = lazy(() => import('./pages/Products'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const KitchenDisplay = lazy(() => import('./pages/KitchenDisplay'));
const ServiceJobs = lazy(() => import('./pages/ServiceJobs'));
const HRRecords = lazy(() => import('./pages/HRRecords'));
const Assets = lazy(() => import('./pages/Assets'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Customers = lazy(() => import('./pages/Customers'));
const Settings = lazy(() => import('./pages/Settings'));
const UserPreferences = lazy(() => import('./pages/UserPreferences'));
const Billing = lazy(() => import('./pages/Billing'));
const Employees = lazy(() => import('./pages/Employees'));
const Payroll = lazy(() => import('./pages/Payroll'));
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceSettings = lazy(() => import('./pages/AttendanceSettings'));
const Budget = lazy(() => import('./pages/Budget'));
const Payments = lazy(() => import('./pages/Payments'));
const Reports = lazy(() => import('./pages/Reports'));
const Notifications = lazy(() => import('./pages/Notifications'));
const CloudDocuments = lazy(() => import('./pages/CloudDocuments'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const BusinessOnboarding = lazy(() => import('./pages/BusinessOnboarding'));
const Subscription = lazy(() => import('./pages/Subscription'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));

const SUPER_ADMIN_SECTIONS = {
  'super-admin': 'verification',
  'super-businesses': 'subscribers',
  'super-users': 'users',
  'super-requests': 'verification',
  'super-payments': 'payments',
  'super-plans': 'plans',
  'super-offers': 'offers',
  'super-banks': 'banks',
  'super-verification': 'verification',
};

export default function App() {
  const { user, loading: authLoading, error: authError, loginGoogle, loginEmail, registerEmail, logout, isSuperAdmin } = useAuth();
  const authenticated = Boolean(user);
  const workspace = useWorkspace(user);
  const businessId = workspace.activeBusinessId;
  const business = workspace.business;
  const membership = workspace.membership;
  const subscription = workspace.subscription;
  const role = normalizeRole(membership?.role || 'user');
  const accessPermissions = membership?.permissions || [];
  const customPermissions = Boolean(membership?.customPermissions);
  const subscriptionActive = isSubscriptionActive(subscription);
  const planId = subscription?.planId || '';

  const can = (pageId) => {
    if (!authenticated) return false;
    if (SUPER_ADMIN_SECTIONS[pageId]) return isSuperAdmin;
    if (pageId === 'preferences') return true;
    if (!businessId) return false;
    if (role === 'administrator' && ['subscription', 'settings', 'users', 'activity'].includes(pageId)) return true;
    if (!subscriptionActive) return pageId === 'subscription' && role === 'administrator';
    return canAccessPage(role, pageId, accessPermissions, customPermissions) && planAllowsPage(planId, pageId);
  };

  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [driveConnected, setDriveConnected] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [payrollEmployee, setPayrollEmployee] = useState(null);
  const [finalSettlementEmployee, setFinalSettlementEmployee] = useState(null);
  const [showBusinessRegistration, setShowBusinessRegistration] = useState(false);
  const [theme, setThemeState] = useState(() => normalizeTheme(localStorage.getItem('sb-theme') || 'royal'));
  const setTheme = (nextTheme) => setThemeState(normalizeTheme(nextTheme));

  const settings = useSettings(authenticated && Boolean(businessId), businessId);
  const attendanceSettings = useAttendanceSettings(authenticated && Boolean(businessId) && ['attendance','attendance-settings','pos'].includes(page), businessId);
  const companyAssets = useCompanyAssets(authenticated && Boolean(businessId), businessId);

  const invoices = useLiveCollection('invoices', 'createdAt', can('invoices') && ['dashboard','invoices','payments','customers','reports','cloud','notifications','pos','marketplace'].includes(page), businessId);
  const quotes = useLiveCollection('quotes', 'createdAt', can('quotes') && ['quotes','reports','cloud'].includes(page), businessId);
  const products = useLiveCollection('products', 'createdAt', can('products') && ['dashboard','products','invoices','quotes','reports','notifications','pos','purchase-orders','marketplace','service-jobs'].includes(page), businessId);
  const stockMovements = useLiveCollection('stockMovements', 'createdAt', can('products') && ['products','purchase-orders','marketplace','pos'].includes(page), businessId);
  const suppliers = useLiveCollection('suppliers', 'createdAt', can('suppliers') && ['suppliers','purchase-orders','products'].includes(page), businessId);
  const purchaseOrders = useLiveCollection('purchaseOrders', 'createdAt', can('purchase-orders') && ['purchase-orders','suppliers','products'].includes(page), businessId);
  const salesChannels = useLiveCollection('salesChannels', 'createdAt', can('marketplace') && page === 'marketplace', businessId);
  const marketplaceOrders = useLiveCollection('marketplaceOrders', 'createdAt', can('marketplace') && ['marketplace','dashboard'].includes(page), businessId);
  const posProfiles = useLiveCollection('posProfiles', 'updatedAt', can('pos') && page === 'pos', businessId);
  const menuItems = useLiveCollection('menuItems', 'createdAt', (can('pos') || can('kitchen')) && ['pos','kitchen'].includes(page), businessId);
  const restaurantOrders = useLiveCollection('restaurantOrders', 'createdAt', (can('pos') || can('kitchen')) && ['pos','kitchen'].includes(page), businessId);
  const serviceJobs = useLiveCollection('serviceJobs', 'createdAt', (can('pos') || can('service-jobs')) && ['pos','service-jobs'].includes(page), businessId);
  const hrRecords = useLiveCollection('hrRecords', 'effectiveDate', can('hr-records') && ['hr-records','employees'].includes(page), businessId);
  const assets = useLiveCollection('assets', 'createdAt', can('assets') && page === 'assets', businessId);

  const expenses = useLiveCollection('expenses', 'createdAt', can('expenses') && ['dashboard','expenses','reports'].includes(page), businessId);
  const customers = useLiveCollection('customers', 'createdAt', can('customers') && ['dashboard','customers','invoices','quotes','billing','reports','pos','marketplace','service-jobs'].includes(page), businessId);
  const billingContracts = useLiveCollection('billingContracts', 'createdAt', can('billing') && ['billing','cloud','notifications'].includes(page), businessId);
  const employees = useLiveCollection('employees', 'createdAt', can('employees') && ['dashboard','employees','hr-records','payroll','final-settlements','attendance','reports','pos','service-jobs','assets'].includes(page), businessId);
  const payroll = useLiveCollection('payroll', 'createdAt', can('payroll') && ['dashboard','payroll','final-settlements','attendance','reports','cloud','notifications'].includes(page), businessId);
  const salarySlips = useLiveCollection('salarySlips', 'createdAt', can('payroll') && ['payroll','final-settlements'].includes(page), businessId);
  const attendance = useLiveCollection('attendance', 'date', can('attendance') && ['attendance','payroll','final-settlements','reports','pos'].includes(page), businessId);
  const payrollPeriods = useLiveCollection('payrollPeriods', 'month', can('payroll') && ['payroll','final-settlements','attendance'].includes(page), businessId);
  const finalSettlements = useLiveCollection('finalSettlements', 'lastWorkingDate', can('payroll') && ['payroll','final-settlements','reports'].includes(page), businessId);
  const budgets = useLiveCollection('budgets', 'createdAt', can('budget') && ['dashboard','budget','notifications'].includes(page), businessId);
  const payments = useLiveCollection('payments', 'createdAt', (can('payments') || can('income-payments')) && ['payments','income-payments'].includes(page), businessId);
  const users = useLiveCollection('userAccess', 'updatedAt', role === 'administrator' && Boolean(businessId) && page === 'users', businessId);
  const activityLogs = useLiveCollection('activityLogs', 'createdAt', role === 'administrator' && Boolean(businessId) && page === 'activity', businessId);

  const superAdminMode = isSuperAdmin && Boolean(SUPER_ADMIN_SECTIONS[page]);
  const subscriptionMode = page === 'subscription';
  const globalBusinesses = useGlobalCollection('businesses', 'createdAt', superAdminMode);
  const globalSubscriptions = useGlobalCollection('businessSubscriptions', 'updatedAt', superAdminMode);
  const subscriptionRequests = useSubscriptionRequests(businessId, isSuperAdmin, authenticated && (subscriptionMode || superAdminMode));
  const subscriptionPayments = useGlobalCollection('subscriptionPayments', 'createdAt', superAdminMode);
  const platformUsers = useGlobalCollection('platformUsers', 'lastLoginAt', superAdminMode);
  const platformPlans = useGlobalCollection('platformPlanSettings', '', authenticated && (subscriptionMode || superAdminMode));
  const paymentMethods = useGlobalCollection('platformPaymentMethods', 'createdAt', superAdminMode);
  const platformBankAccounts = useGlobalCollection('platformBankAccounts', '', authenticated && (subscriptionMode || superAdminMode));
  const platformCustomOffers = useGlobalCollection('platformCustomOffers', 'createdAt', authenticated && (subscriptionMode || superAdminMode));

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('sb-theme', theme); }, [theme]);
  useEffect(() => { if (!toast.message) return undefined; const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 3800); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    if (!businessId || !membership) return;
    if (!subscriptionActive && role === 'administrator') {
      if (!['subscription', 'settings', 'users', 'preferences', 'super-admin'].includes(page)) setPage('subscription');
      return;
    }
    if (!can(page)) {
      const candidates = ['dashboard','pos','invoices','quotes','marketplace','products','attendance','payroll','customers','preferences'];
      setPage(candidates.find((candidate) => can(candidate)) || (role === 'administrator' ? 'subscription' : 'preferences'));
    }
  }, [businessId, membership?.role, accessPermissions.join('|'), customPermissions, planId, subscription?.status, page, isSuperAdmin]);

  const notify = (message, type = 'success') => setToast({ message, type });
  const connectDrive = async () => {
    if (!can('cloud')) return notify('Google Drive and Cloud backup require VIP Platinum.', 'error');
    try { await requestDriveAccess(); setDriveConnected(true); notify('Google Drive connected successfully.'); }
    catch (reason) { notify(reason.message || 'Could not connect Google Drive.', 'error'); }
  };
  const disconnect = () => { disconnectDrive(); setDriveConnected(false); notify('Google Drive disconnected.'); };
  const confirmLogout = async () => { setLoggingOut(true); try { disconnectDrive(); await logout(); setShowLogoutConfirm(false); } finally { setLoggingOut(false); } };

  if (authLoading || workspace.loading) return <div className="loading-screen"><div className="loader"/><p>Loading Small Business (SB) v5.0 Commerce Suite…</p></div>;
  if (!user) return <LoginPage loginGoogle={loginGoogle} loginEmail={loginEmail} registerEmail={registerEmail} error={authError} loading={authLoading}/>;

  if (!businessId || showBusinessRegistration) {
    if (isSuperAdmin && page === 'super-admin' && !showBusinessRegistration) {
      return <main className="standalone-super-admin-shell">
        <button className="floating-back-workspace" onClick={() => setPage('dashboard')}>← Business setup</button>
        <Suspense fallback={<PageLoader/>}>
          <SuperAdmin businesses={globalBusinesses.items} subscriptions={globalSubscriptions.items} requests={subscriptionRequests.items} payments={subscriptionPayments.items} platformUsers={platformUsers.items} plans={platformPlans.items} paymentMethods={paymentMethods.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} currentBusiness={null} notify={notify}/>
        </Suspense>
        <Toast message={toast.message} type={toast.type}/>
      </main>;
    }

    return <>
      <Suspense fallback={<PageLoader/>}>
        <BusinessOnboarding user={user} memberships={workspace.memberships} canRegisterBusiness={!workspace.ownedBusinessId} onSelectBusiness={(id)=>{workspace.selectBusiness(id);setShowBusinessRegistration(false);}} onOpenSuperAdmin={isSuperAdmin?()=>{setShowBusinessRegistration(false);setPage('super-admin');}:null} notify={notify} isSuperAdmin={isSuperAdmin}/>
      </Suspense>
      {workspace.memberships.length>0&&showBusinessRegistration&&<button className="floating-back-workspace" onClick={()=>setShowBusinessRegistration(false)}>← Back to workspace</button>}
      <Toast message={toast.message} type={toast.type}/>
    </>;
  }

  const documentSettings = { ...settings, ...companyAssets };
  const common = { settings: documentSettings, notify };
  const hub = (eyebrow,title,description,items) => <ModuleHub eyebrow={eyebrow} title={title} description={description} items={items} onOpen={setPage}/>;
  const ownSubscriptionRequests = subscriptionRequests.items.filter((request)=>request.businessId===businessId);

  const renderPage = () => {
    if (SUPER_ADMIN_SECTIONS[page]) {
      return <SuperAdmin businesses={globalBusinesses.items} subscriptions={globalSubscriptions.items} requests={subscriptionRequests.items} payments={subscriptionPayments.items} platformUsers={platformUsers.items} plans={platformPlans.items} paymentMethods={paymentMethods.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} currentBusiness={business} initialTab={SUPER_ADMIN_SECTIONS[page]} notify={notify}/>;
    }
    switch (page) {
      case 'subscription': return <Subscription business={business} subscription={subscription} requests={ownSubscriptionRequests} plans={platformPlans.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} user={user} role={role} notify={notify}/>;
      case 'pos': return <POS products={products.items} customers={customers.items} invoices={invoices.items} employees={employees.items} attendance={attendance.items} attendanceSettings={attendanceSettings} posProfile={posProfiles.items.find((x)=>x.id==='main')||posProfiles.items[0]||null} menuItems={menuItems.items} restaurantOrders={restaurantOrders.items} serviceJobs={serviceJobs.items} user={user} onNavigate={setPage} {...common}/>;
      case 'invoices': return <Invoices invoices={invoices.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected}/>;
      case 'quotes': return <Quotes quotes={quotes.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} openInvoices={()=>setPage('invoices')}/>;
      case 'billing': return <Billing contracts={billingContracts.items} customers={customers.items} {...common} openInvoices={()=>setPage('invoices')}/>;
      case 'payments': return <Payments payments={payments.items} invoices={invoices.items} {...common}/>;
      case 'customers': return <Customers customers={customers.items} invoices={invoices.items} {...common}/>;
      case 'marketplace': return <Marketplace channels={salesChannels.items} orders={marketplaceOrders.items} products={products.items} customers={customers.items} {...common}/>;
      case 'contracts': return hub('CRM','Contracts','Manage service agreements and contract renewal workflows.',[
        {title:'Recurring contracts',icon:'↻',description:'Active monthly service contracts and recurring billing.',features:['Contract number','Start and end dates','Monthly invoice generation','Duplicate protection'],ready:true,page:'billing'},
        {title:'Renewal alerts',icon:'!',description:'Contract expiry notifications are calculated automatically.',features:['Expiry monitoring','Notifications','Service periods'],ready:true,page:'notifications'},
      ]);
      case 'statements': return hub('CRM','Customer Statements','Review invoices, payments and outstanding balances.',[
        {title:'Payment history',icon:'↘',description:'All payments recorded against customer invoices.',features:['Invoice references','Payment methods','Outstanding balances'],ready:true,page:'payments'},
        {title:'Customer history',icon:'◎',description:'Customer records and invoice history.',features:['Contact details','Notes','Invoice totals'],ready:true,page:'customers'},
      ]);
      case 'products': return <Products products={products.items} suppliers={suppliers.items} stockMovements={stockMovements.items} {...common}/>;
      case 'suppliers': return <Suppliers suppliers={suppliers.items} purchaseOrders={purchaseOrders.items} notify={notify}/>;
      case 'purchase-orders': return <PurchaseOrders purchaseOrders={purchaseOrders.items} suppliers={suppliers.items} products={products.items} {...common}/>;
      case 'kitchen': return <KitchenDisplay orders={restaurantOrders.items} notify={notify}/>;
      case 'service-jobs': return <ServiceJobs jobs={serviceJobs.items} customers={customers.items} employees={employees.items} {...common} onOpenPOS={()=>setPage('pos')}/>;
      case 'employees': return <Employees employees={employees.items} {...common} role={role} openPayroll={(employee)=>{setPayrollEmployee(employee);setPage('payroll');}} openFinalSettlement={(employee)=>{setFinalSettlementEmployee(employee);setPage('payroll');}}/>;
      case 'hr-records': return <HRRecords records={hrRecords.items} employees={employees.items} notify={notify}/>;
      case 'payroll': return <Payroll payroll={payroll.items} salarySlips={salarySlips.items} attendance={attendance.items} payrollPeriods={payrollPeriods.items} finalSettlements={finalSettlements.items} employees={employees.items} {...common} role={role} markDriveConnected={setDriveConnected} initialEmployee={payrollEmployee} clearInitialEmployee={()=>setPayrollEmployee(null)} initialFinalEmployee={finalSettlementEmployee} clearInitialFinalEmployee={()=>setFinalSettlementEmployee(null)}/>;
      case 'final-settlements': return <Payroll payroll={payroll.items} salarySlips={salarySlips.items} attendance={attendance.items} payrollPeriods={payrollPeriods.items} finalSettlements={finalSettlements.items} employees={employees.items} {...common} role={role} markDriveConnected={setDriveConnected} initialView="settlements"/>;
      case 'attendance': return <Attendance attendance={attendance.items} employees={employees.items} payroll={payroll.items} payrollPeriods={payrollPeriods.items} attendanceSettings={attendanceSettings} {...common} role={role} onOpenSettings={()=>setPage('attendance-settings')}/>;
      case 'attendance-settings': return <AttendanceSettings attendanceSettings={attendanceSettings} notify={notify}/>;
      case 'finance': return hub('FINANCIAL MANAGEMENT','Finance Overview','Income, expenses, budgets and tax controls.',[
        {title:'Income & payments',icon:'↗',description:'Revenue and received-payment records.',features:['Invoice revenue','Other income framework','Payment history'],ready:true,page:'payments'},
        {title:'Expenses',icon:'↘',description:'Operating expense tracking by category.',features:['Office','Transport','Utilities','Maintenance'],ready:true,page:'expenses'},
        {title:'Budget',icon:'◫',description:'Annual and monthly budget planning.',features:['Planned amount','Actual amount','Remaining budget'],ready:true,page:'budget'},
      ]);
      case 'expenses': return <Expenses expenses={expenses.items} {...common}/>;
      case 'income-payments': return <Payments payments={payments.items} invoices={invoices.items} {...common}/>;
      case 'budget': return <Budget budgets={budgets.items} {...common}/>;
      case 'tax': return hub('FINANCIAL MANAGEMENT','GST & Tax','Company GST configuration and tax-ready document controls.',[
        {title:'GST settings',icon:'%',description:'GST registration, TIN and default rates are controlled by the Company Administrator.',features:['TIN','GST percentage','Tax invoice title'],ready:true},
        {title:'GST report',icon:'⌁',description:'Export invoice and tax data for review.',features:['GST amounts','Taxable totals','CSV export'],ready:true,page:'reports'},
      ]);
      case 'assets': return <Assets assets={assets.items} employees={employees.items} settings={documentSettings} notify={notify}/>;
      case 'reports': return <Reports invoices={invoices.items} quotes={quotes.items} expenses={expenses.items} customers={customers.items} employees={employees.items} payroll={payroll.items} attendance={attendance.items} finalSettlements={finalSettlements.items} products={products.items} settings={documentSettings}/>;
      case 'cloud': return <CloudDocuments driveConnected={driveConnected||isDriveConnected()} connectDrive={connectDrive} disconnectDrive={disconnect} counts={{invoices:invoices.items.length,quotes:quotes.items.length,payroll:payroll.items.length,contracts:billingContracts.items.length}}/>;
      case 'notifications': return <Notifications invoices={invoices.items} products={products.items} payroll={payroll.items} budgets={budgets.items} billingContracts={billingContracts.items}/>;
      case 'preferences': return <UserPreferences theme={theme} setTheme={setTheme}/>;
      case 'settings': return <Settings settings={settings} companyAssets={companyAssets} notify={notify} driveConnected={driveConnected||isDriveConnected()} markDriveConnected={setDriveConnected} planId={planId}/>;
      case 'activity': return <ActivityLogs logs={activityLogs.items}/>;
      case 'users': return <UserManagement users={users.items} notify={notify}/>;
      default: return can('dashboard') ? <Dashboard invoices={invoices.items} expenses={expenses.items} products={products.items} customers={customers.items} employees={employees.items} payroll={payroll.items} budgets={budgets.items} settings={documentSettings} role={role} onNavigate={setPage}/> : <Subscription business={business} subscription={subscription} requests={ownSubscriptionRequests} plans={platformPlans.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} user={user} role={role} notify={notify}/>;
    }
  };

  const sources = [
    invoices, quotes, products, stockMovements, suppliers, purchaseOrders, salesChannels,
    marketplaceOrders, posProfiles, menuItems, restaurantOrders, serviceJobs, hrRecords, assets,
    expenses, customers, billingContracts, employees, payroll, salarySlips, attendance,
    payrollPeriods, finalSettlements, budgets, payments, users, activityLogs,
  ];
  const dataError = sources.find((source)=>source.error)?.error || workspace.error || subscriptionRequests.error;

  return <>
    <AppShell page={page} setPage={setPage} user={user} role={role} requestLogout={()=>setShowLogoutConfirm(true)} driveConnected={driveConnected||isDriveConnected()} connectDrive={connectDrive} disconnectDrive={disconnect} businessName={settings.businessName||business?.name} companyLogo={companyAssets.companyLogoDataUrl} businesses={workspace.memberships} activeBusinessId={businessId} onBusinessChange={workspace.selectBusiness} onRegisterBusiness={()=>setShowBusinessRegistration(true)} canRegisterBusiness={!workspace.ownedBusinessId} subscription={subscription} canAccess={can} isSuperAdmin={isSuperAdmin}>
      {dataError&&<div className="alert alert-error">{dataError}</div>}<Suspense fallback={<PageLoader/>}>{renderPage()}</Suspense>
    </AppShell>
    <ConfirmDialog open={showLogoutConfirm} title="Sign out of Small Business?" message="You will need to sign in again to access your company workspaces." confirmLabel="Yes, sign out" danger busy={loggingOut} onCancel={()=>setShowLogoutConfirm(false)} onConfirm={confirmLogout}/>
    <Toast message={toast.message} type={toast.type}/>
  </>;
}

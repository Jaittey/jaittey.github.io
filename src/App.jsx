import { useEffect, useState } from 'react';
import AppShell from './components/AppShell';
import ConfirmDialog from './components/ConfirmDialog';
import LoginPage from './components/LoginPage';
import ModuleHub from './components/ModuleHub';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import POS from './pages/POS';
import Quotes from './pages/Quotes';
import Products from './pages/Products';
import Expenses from './pages/Expenses';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import UserPreferences from './pages/UserPreferences';
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
import BusinessOnboarding from './pages/BusinessOnboarding';
import Subscription from './pages/Subscription';
import SuperAdmin from './pages/SuperAdmin';
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
    if (pageId === 'super-admin' || pageId.startsWith('super-')) return isSuperAdmin;
    if (pageId === 'preferences') return true;
    if (!businessId) return false;

    // Always allow users with a business workspace to open the Dashboard.
    // If the trial/subscription has expired, paid modules remain locked,
    // but the app no longer forces the Administrator onto Subscription.
    if (pageId === 'dashboard') return true;

    const hubChildren = {
      'sales-dashboard': ['pos','invoices','quotes','billing','payments','customers','inventory-assets','contracts','statements'],
      'employee-dashboard': ['employees','hr-records','attendance','attendance-settings','payroll','final-settlements'],
      'financial-dashboard': ['finance','payments','expenses','budget','tax'],
      'app-manager': ['settings','users','reports','cloud','activity','preferences','subscription'],
      'inventory-assets': ['products','suppliers','assets'],
      'final-settlements': ['payroll'],
    };
    if (hubChildren[pageId]) return hubChildren[pageId].some((child) => can(child));

    if (role === 'administrator' && ['subscription', 'settings', 'users', 'activity'].includes(pageId)) return true;
    if (!subscriptionActive) return false;
    return canAccessPage(role, pageId, accessPermissions, customPermissions) && planAllowsPage(planId, pageId);
  };

  const settings = useSettings(authenticated && Boolean(businessId), businessId);
  const attendanceSettings = useAttendanceSettings(authenticated && Boolean(businessId), businessId);
  const companyAssets = useCompanyAssets(authenticated && Boolean(businessId), businessId);

  const invoices = useLiveCollection('invoices', 'createdAt', can('invoices') || can('pos'), businessId);
  const quotes = useLiveCollection('quotes', 'createdAt', can('quotes'), businessId);
  const products = useLiveCollection('products', 'createdAt', can('products') || can('pos'), businessId);
  const expenses = useLiveCollection('expenses', 'createdAt', can('expenses'), businessId);
  const customers = useLiveCollection('customers', 'createdAt', can('customers'), businessId);
  const billingContracts = useLiveCollection('billingContracts', 'createdAt', can('billing'), businessId);
  const employees = useLiveCollection('employees', 'createdAt', can('employees'), businessId);
  const payroll = useLiveCollection('payroll', 'createdAt', can('payroll'), businessId);
  const salarySlips = useLiveCollection('salarySlips', 'createdAt', can('payroll'), businessId);
  const attendance = useLiveCollection('attendance', 'date', can('attendance'), businessId);
  const payrollPeriods = useLiveCollection('payrollPeriods', 'month', can('payroll'), businessId);
  const finalSettlements = useLiveCollection('finalSettlements', 'lastWorkingDate', can('payroll'), businessId);
  const budgets = useLiveCollection('budgets', 'createdAt', can('budget'), businessId);
  const payments = useLiveCollection('payments', 'createdAt', can('payments'), businessId);
  const users = useLiveCollection('userAccess', 'updatedAt', role === 'administrator' && Boolean(businessId), businessId);
  const activityLogs = useLiveCollection('activityLogs', 'createdAt', role === 'administrator' && Boolean(businessId), businessId);

  const globalBusinesses = useGlobalCollection('businesses', 'createdAt', isSuperAdmin);
  const globalSubscriptions = useGlobalCollection('businessSubscriptions', 'updatedAt', isSuperAdmin);
  const subscriptionRequests = useSubscriptionRequests(businessId, isSuperAdmin, authenticated);
  const subscriptionPayments = useGlobalCollection('subscriptionPayments', 'createdAt', isSuperAdmin);
  const platformUsers = useGlobalCollection('platformUsers', 'lastLoginAt', isSuperAdmin);
  const platformPlans = useGlobalCollection('platformPlanSettings', '', authenticated);
  const paymentMethods = useGlobalCollection('platformPaymentMethods', 'createdAt', authenticated);
  const platformBankAccounts = useGlobalCollection('platformBankAccounts', '', authenticated);
  const platformCustomOffers = useGlobalCollection('platformCustomOffers', 'createdAt', authenticated);

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

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('sb-theme', theme); }, [theme]);
  useEffect(() => { if (!toast.message) return undefined; const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 3800); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    if (!businessId || !membership) return;

    // Do not automatically redirect an Administrator to Subscription.
    // Dashboard stays available even when a trial/subscription is inactive.
    // If the current page is locked, return the user to Dashboard first.
    if (!can(page)) {
      const candidates = ['dashboard','invoices','quotes','attendance','payroll','customers','products','preferences'];
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

  if (authLoading || workspace.loading) return <div className="loading-screen"><div className="loader"/><p>Loading Small Business (SB) v3.3…</p></div>;
  if (!user) return <LoginPage loginGoogle={loginGoogle} loginEmail={loginEmail} registerEmail={registerEmail} error={authError} loading={authLoading}/>;

  if (!businessId || showBusinessRegistration) {
    if (isSuperAdmin && page === 'super-admin' && !showBusinessRegistration) {
      return <main className="standalone-super-admin-shell">
        <button className="floating-back-workspace" onClick={() => setPage('dashboard')}>← Business setup</button>
        <SuperAdmin businesses={globalBusinesses.items} subscriptions={globalSubscriptions.items} requests={subscriptionRequests.items} payments={subscriptionPayments.items} platformUsers={platformUsers.items} plans={platformPlans.items} paymentMethods={paymentMethods.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} currentBusiness={null} notify={notify}/>
        <Toast message={toast.message} type={toast.type}/>
      </main>;
    }

    return <>
      <BusinessOnboarding user={user} memberships={workspace.memberships} canRegisterBusiness={!workspace.ownedBusinessId} onSelectBusiness={(id)=>{workspace.selectBusiness(id);setShowBusinessRegistration(false);}} onOpenSuperAdmin={isSuperAdmin?()=>{setShowBusinessRegistration(false);setPage('super-admin');}:null} notify={notify} isSuperAdmin={isSuperAdmin}/>
      {workspace.memberships.length>0&&showBusinessRegistration&&<button className="floating-back-workspace" onClick={()=>setShowBusinessRegistration(false)}>← Back to workspace</button>}
      <Toast message={toast.message} type={toast.type}/>
    </>;
  }

  const documentSettings = { ...settings, ...companyAssets };
  const common = { settings: documentSettings, notify };
  const hub = (eyebrow,title,description,items) => <ModuleHub eyebrow={eyebrow} title={title} description={description} items={items} onOpen={setPage}/>;
  const ownSubscriptionRequests = subscriptionRequests.items.filter((request)=>request.businessId===businessId);

  const renderPage = () => {
    switch (page) {
      case 'sales-dashboard': return hub('SALES & POS','Sales & POS Dashboard','Everything related to selling, billing, customers and stock in one workspace.',[
        {title:'POS System',icon:'▣',description:'Fast counter sales with stock deduction and paid receipts.',features:['Barcode / SKU search','Cash, card & bank transfer','Automatic stock update','Paid invoice & payment record'],ready:true,page:'pos'},
        {title:'Invoices',icon:'▤',description:'Create and manage customer invoices.',features:['PDF / print','Paid status','Company branding'],ready:true,page:'invoices'},
        {title:'Quotations',icon:'▧',description:'Prepare quotations and convert sales into invoices.',features:['Customer selection','Items & GST','PDF / print'],ready:true,page:'quotes'},
        {title:'Recurring Billing',icon:'↻',description:'Manage repeat service contracts and monthly billing.',features:['Service periods','Monthly generation','Duplicate protection'],ready:true,page:'billing'},
        {title:'Payments',icon:'↘',description:'Review payment records and received amounts.',features:['Invoice references','Payment methods','Outstanding balances'],ready:true,page:'payments'},
        {title:'Customers',icon:'◎',description:'Customer profiles, contact details and sales history.',features:['Contact details','Notes','Invoice history'],ready:true,page:'customers'},
        {title:'Inventory & Assets',icon:'□',description:'Open stock, suppliers and company asset tools.',features:['Inventory','Suppliers','Company assets'],ready:true,page:'inventory-assets'},
        {title:'Contracts',icon:'⌁',description:'Recurring agreements and renewal workflows.',features:['Contract dates','Recurring billing','Renewal alerts'],ready:true,page:'contracts'},
        {title:'Customer Statements',icon:'≡',description:'Payment and invoice history by customer.',features:['Payments','Invoices','Balances'],ready:true,page:'statements'},
      ]);
      case 'employee-dashboard': return hub('EMPLOYEE MANAGEMENT','Employee Management Dashboard','Manage the complete employee lifecycle, attendance and salary workflow.',[
        {title:'Employees',icon:'♙',description:'Employee profiles, employment details and payroll setup.',features:['Personal details','Employment details','Payroll method'],ready:true,page:'employees'},
        {title:'HR Records',icon:'♟',description:'Employee history and HR records.',features:['Profiles','Promotions & transfers framework','Notes'],ready:true,page:'hr-records'},
        {title:'Attendance',icon:'◷',description:'Monthly attendance calendar and daily work hours.',features:['Shifts','Hours','Missing dates'],ready:true,page:'attendance'},
        {title:'Attendance Settings',icon:'⚙',description:'Configure shifts and default duty times.',features:['Shift types','Start / end times','Custom shifts'],ready:true,page:'attendance-settings'},
        {title:'Payroll',icon:'▣',description:'Calculate salary, overtime and deductions.',features:['Monthly & daily pay','Salary slips','Lock / unlock'],ready:true,page:'payroll'},
        {title:'Final Settlements',icon:'✓',description:'Complete employee final-pay and settlement records.',features:['Last working date','Attendance summary','Settlement calculation'],ready:true,page:'final-settlements'},
      ]);
      case 'financial-dashboard': return hub('FINANCIAL MANAGEMENT','Financial Management Dashboard','Monitor income, spending, budgets and tax from one finance workspace.',[
        {title:'Finance Overview',icon:'◈',description:'Open the finance overview and controls.',features:['Income','Expenses','Budget'],ready:true,page:'finance'},
        {title:'Income & Payments',icon:'↗',description:'Review received payments and income records.',features:['Invoice revenue','Payment history','Outstanding balances'],ready:true,page:'payments'},
        {title:'Expenses',icon:'↘',description:'Track operating expenses by category.',features:['Office','Transport','Utilities','Maintenance'],ready:true,page:'expenses'},
        {title:'Budget',icon:'◫',description:'Plan and monitor annual and monthly budgets.',features:['Planned','Actual','Remaining'],ready:true,page:'budget'},
        {title:'GST & Tax',icon:'%',description:'GST settings and tax-ready reporting.',features:['TIN','GST rate','GST report'],ready:true,page:'tax'},
      ]);
      case 'app-manager': return hub('APPLICATION MANAGER','Application Manager','Control company setup, users, reporting, cloud, preferences and subscription.',[
        {title:'Company Administration',icon:'♜',description:'Company details, document assets, GST, backup and system controls.',features:['Logo & stamp','Manager signature','Company settings','Backup / restore'],ready:true,page:'settings'},
        {title:'Users & Permissions',icon:'♚',description:'Manage company users, roles and access permissions.',features:['Administrator','Manager','User','Custom permissions'],ready:true,page:'users'},
        {title:'Reports & Analytics',icon:'⌁',description:'Business, sales, payroll and attendance reports.',features:['Invoices','Payroll','Attendance','Inventory'],ready:true,page:'reports'},
        {title:'Cloud & Documents',icon:'☁',description:'Google Drive connection and document workspace.',features:['Invoices','Quotations','Payroll','Contracts'],ready:true,page:'cloud'},
        {title:'Activity Logs',icon:'≡',description:'Review company-level system activity.',features:['Audit activity','User actions','Operational history'],ready:true,page:'activity'},
        {title:'User Preferences / Themes',icon:'◈',description:'Personalize the application appearance.',features:['Light','Dark','Ocean','Forest','Royal','Sunset'],ready:true,page:'preferences'},
        {title:'Subscription & Trial',icon:'★',description:'Manage trial, package and subscription payments.',features:['7-day trial','Plans','Bank transfer','Transfer slip'],ready:true,page:'subscription'},
      ]);
      case 'inventory-assets': return hub('SALES & POS','Inventory & Assets','Manage products and open supplier or company asset workspaces.',[
        {title:'Inventory',icon:'□',description:'Products, stock levels, prices and SKU / barcodes.',features:['Stock','Price','SKU / Barcode','Low-stock level'],ready:true,page:'products'},
        {title:'Suppliers',icon:'◎',description:'Supplier directory and purchase history framework.',features:['Supplier details','Purchases','Notes'],ready:false,page:'suppliers'},
        {title:'Company Assets',icon:'◇',description:'Company asset register and assignment framework.',features:['Asset number','Condition','Assignment','Maintenance'],ready:false,page:'assets'},
      ]);
      case 'final-settlements': return <Payroll payroll={payroll.items} salarySlips={salarySlips.items} attendance={attendance.items} payrollPeriods={payrollPeriods.items} finalSettlements={finalSettlements.items} employees={employees.items} {...common} role={role} markDriveConnected={setDriveConnected} initialEmployee={null} clearInitialEmployee={()=>{}} initialFinalEmployee={null} clearInitialFinalEmployee={()=>{}}/>;
      case 'subscription': return <Subscription business={business} subscription={subscription} requests={ownSubscriptionRequests} plans={platformPlans.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} user={user} role={role} notify={notify}/>;
      case 'super-admin':
      case 'super-businesses':
      case 'super-users':
      case 'super-requests':
      case 'super-payments':
      case 'super-plans':
      case 'super-offers':
      case 'super-banks':
      case 'super-verification': {
        const superTabs = { 'super-businesses':'subscribers', 'super-users':'users', 'super-requests':'verification', 'super-payments':'payments', 'super-plans':'plans', 'super-offers':'offers', 'super-banks':'banks', 'super-verification':'verification' };
        return <SuperAdmin initialTab={superTabs[page]||'verification'} businesses={globalBusinesses.items} subscriptions={globalSubscriptions.items} requests={subscriptionRequests.items} payments={subscriptionPayments.items} platformUsers={platformUsers.items} plans={platformPlans.items} paymentMethods={paymentMethods.items} bankAccounts={platformBankAccounts.items} customOffers={platformCustomOffers.items} currentBusiness={business} notify={notify}/>;
      }
      case 'pos': return <POS products={products.items} customers={customers.items} invoices={invoices.items} settings={documentSettings} notify={notify}/>;
      case 'invoices': return <Invoices invoices={invoices.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected}/>;
      case 'quotes': return <Quotes quotes={quotes.items} customers={customers.items} products={products.items} {...common} markDriveConnected={setDriveConnected} openInvoices={()=>setPage('invoices')}/>;
      case 'billing': return <Billing contracts={billingContracts.items} customers={customers.items} {...common} openInvoices={()=>setPage('invoices')}/>;
      case 'payments': return <Payments payments={payments.items} invoices={invoices.items} {...common}/>;
      case 'customers': return <Customers customers={customers.items} invoices={invoices.items} {...common}/>;
      case 'contracts': return hub('CRM','Contracts','Manage service agreements and contract renewal workflows.',[
        {title:'Recurring contracts',icon:'↻',description:'Active monthly service contracts and recurring billing.',features:['Contract number','Start and end dates','Monthly invoice generation','Duplicate protection'],ready:true,page:'billing'},
        {title:'Renewal alerts',icon:'!',description:'Contract expiry notifications are calculated automatically.',features:['Expiry monitoring','Notifications','Service periods'],ready:true,page:'notifications'},
      ]);
      case 'statements': return hub('CRM','Customer Statements','Review invoices, payments and outstanding balances.',[
        {title:'Payment history',icon:'↘',description:'All payments recorded against customer invoices.',features:['Invoice references','Payment methods','Outstanding balances'],ready:true,page:'payments'},
        {title:'Customer history',icon:'◎',description:'Customer records and invoice history.',features:['Contact details','Notes','Invoice totals'],ready:true,page:'customers'},
      ]);
      case 'employees': return <Employees employees={employees.items} {...common} role={role} openPayroll={(employee)=>{setPayrollEmployee(employee);setPage('payroll');}} openFinalSettlement={(employee)=>{setFinalSettlementEmployee(employee);setPage('payroll');}}/>;
      case 'hr-records': return hub('EMPLOYEE MANAGEMENT','HR Records','Employee lifecycle and document framework.',[
        {title:'Employee profiles',icon:'♙',description:'Personal, emergency, banking and employment details.',features:['National ID','Designation','Department','Joining date'],ready:true,page:'employees'},
        {title:'Promotions & transfers',icon:'↗',description:'Structured HR history and attachments.',features:['Promotions','Transfers','Resignations','Employee notes'],ready:false},
      ]);
      case 'payroll': return <Payroll payroll={payroll.items} salarySlips={salarySlips.items} attendance={attendance.items} payrollPeriods={payrollPeriods.items} finalSettlements={finalSettlements.items} employees={employees.items} {...common} role={role} markDriveConnected={setDriveConnected} initialEmployee={payrollEmployee} clearInitialEmployee={()=>setPayrollEmployee(null)} initialFinalEmployee={finalSettlementEmployee} clearInitialFinalEmployee={()=>setFinalSettlementEmployee(null)}/>;
      case 'attendance': return <Attendance attendance={attendance.items} employees={employees.items} payroll={payroll.items} payrollPeriods={payrollPeriods.items} attendanceSettings={attendanceSettings} {...common} role={role} onOpenSettings={()=>setPage('attendance-settings')}/>;
      case 'attendance-settings': return <AttendanceSettings attendanceSettings={attendanceSettings} notify={notify}/>;
      case 'finance': return hub('FINANCIAL MANAGEMENT','Finance Overview','Income, expenses, budgets and tax controls.',[
        {title:'Income & payments',icon:'↗',description:'Revenue and received-payment records.',features:['Invoice revenue','Other income framework','Payment history'],ready:true,page:'payments'},
        {title:'Expenses',icon:'↘',description:'Operating expense tracking by category.',features:['Office','Transport','Utilities','Maintenance'],ready:true,page:'expenses'},
        {title:'Budget',icon:'◫',description:'Annual and monthly budget planning.',features:['Planned amount','Actual amount','Remaining budget'],ready:true,page:'budget'},
      ]);
      case 'expenses': return <Expenses expenses={expenses.items} {...common}/>;
      case 'budget': return <Budget budgets={budgets.items} {...common}/>;
      case 'tax': return hub('FINANCIAL MANAGEMENT','GST & Tax','Company GST configuration and tax-ready document controls.',[
        {title:'GST settings',icon:'%',description:'GST registration, TIN and default rates are controlled by the Company Administrator.',features:['TIN','GST percentage','Tax invoice title'],ready:true},
        {title:'GST report',icon:'⌁',description:'Export invoice and tax data for review.',features:['GST amounts','Taxable totals','CSV export'],ready:true,page:'reports'},
      ]);
      case 'products': return <Products products={products.items} {...common}/>;
      case 'suppliers': return hub('INVENTORY & ASSETS','Suppliers','Supplier and purchase-history workspace.',[{title:'Supplier directory',icon:'◎',description:'Supplier contacts, purchase history and agreements.',features:['Supplier details','Purchase records','Notes'],ready:false}]);
      case 'assets': return hub('INVENTORY & ASSETS','Company Assets','Track office equipment, uniforms, vehicles and assignments.',[{title:'Asset register',icon:'□',description:'Company asset ownership and employee assignment.',features:['Asset number','Condition','Assigned employee','Maintenance'],ready:false}]);
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

  const sources=[invoices,quotes,products,expenses,customers,billingContracts,employees,payroll,salarySlips,attendance,payrollPeriods,finalSettlements,budgets,payments,users,activityLogs];
  const dataError=sources.find((source)=>source.error)?.error||workspace.error||subscriptionRequests.error;

  return <>
    <AppShell page={page} setPage={setPage} user={user} role={role} requestLogout={()=>setShowLogoutConfirm(true)} driveConnected={driveConnected||isDriveConnected()} connectDrive={connectDrive} disconnectDrive={disconnect} businessName={settings.businessName||business?.name} companyLogo={companyAssets.companyLogoDataUrl} businesses={workspace.memberships} activeBusinessId={businessId} onBusinessChange={workspace.selectBusiness} onRegisterBusiness={()=>setShowBusinessRegistration(true)} canRegisterBusiness={!workspace.ownedBusinessId} subscription={subscription} canAccess={can} isSuperAdmin={isSuperAdmin}>
      {dataError&&<div className="alert alert-error">{dataError}</div>}{renderPage()}
    </AppShell>
    <ConfirmDialog open={showLogoutConfirm} title="Sign out of Small Business?" message="You will need to sign in again to access your company workspaces." confirmLabel="Yes, sign out" danger busy={loggingOut} onCancel={()=>setShowLogoutConfirm(false)} onConfirm={confirmLogout}/>
    <Toast message={toast.message} type={toast.type}/>
  </>;
}

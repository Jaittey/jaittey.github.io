import { useMemo, useState } from 'react';
import { canAccessPage, ERP_NAV, PAGE_TITLES, ROLE_LABELS, normalizeRole } from '../config/erp';

const MOBILE_NAV_MANAGER = [
  ['dashboard', '⌂', 'Home'],
  ['invoices', '▤', 'Invoices'],
  ['quotes', '◫', 'Quotes'],
  ['customers', '◎', 'Customers'],
];

const MOBILE_NAV_USER = [
  ['invoices', '▤', 'Invoices'],
  ['quotes', '◫', 'Quotes'],
  ['customers', '◎', 'Customers'],
  ['products', '□', 'Inventory'],
];

export default function AppShell({
  page,
  setPage,
  user,
  role,
  requestLogout,
  driveConnected,
  connectDrive,
  disconnectDrive,
  businessName,
  theme,
  toggleTheme,
  children,
}) {
  const [openGroups, setOpenGroups] = useState(['sales', 'crm']);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const normalizedRole = normalizeRole(role);
  const available = useMemo(() => ERP_NAV.map((group) => {
    if (group.page) return canAccessPage(role, group.page) ? group : null;
    const childrenForRole = group.children.filter(([id]) => canAccessPage(role, id));
    return childrenForRole.length ? { ...group, children: childrenForRole } : null;
  }).filter(Boolean), [role]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return available.flatMap((group) => {
      if (group.page) return group.label.toLowerCase().includes(term) ? [[group.page, group.label]] : [];
      return group.children.filter(([, label]) => label.toLowerCase().includes(term));
    }).slice(0, 8);
  }, [available, search]);

  const mobileNav = (normalizedRole === 'user' ? MOBILE_NAV_USER : MOBILE_NAV_MANAGER)
    .filter(([id]) => canAccessPage(role, id));
  const mobileDirectPages = mobileNav.map(([id]) => id);
  const moreActive = !mobileDirectPages.includes(page);

  const navigate = (id) => {
    setPage(id);
    setDrawerOpen(false);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderNav = () => available.map((group) => {
    if (group.page) {
      return (
        <button key={group.id} className={`nav-root ${page === group.page ? 'active' : ''}`} onClick={() => navigate(group.page)}>
          <span>{group.icon}</span><b>{group.label}</b>
        </button>
      );
    }

    const active = group.children.some(([id]) => id === page);
    const open = openGroups.includes(group.id) || active;
    return (
      <div className={`nav-group ${active ? 'active-group' : ''}`} key={group.id}>
        <button className="nav-group-toggle" onClick={() => setOpenGroups((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])}>
          <span>{group.icon}</span><b>{group.label}</b><i>{open ? '−' : '+'}</i>
        </button>
        {open && <div className="nav-children">{group.children.map(([id, label]) => (
          <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>{label}</button>
        ))}</div>}
      </div>
    );
  });

  return (
    <div className="app-layout v21-layout mobile-friendly-layout">
      <aside className={`sidebar enterprise-sidebar ${drawerOpen ? 'mobile-open' : ''}`}>
        <div className="mobile-drawer-heading">
          <strong>All modules</strong>
          <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>×</button>
        </div>
        <div className="sidebar-brand">
          <div className="sidebar-logo-surface"><img className="sidebar-company-logo" src={`${import.meta.env.BASE_URL}images/DF7_Logo.png`} alt="DF7" /></div>
          <span className="sidebar-business-name">{businessName || 'Dhinasha Family 7'}</span>
          <small className="version-pill">ERP v2.1.2</small>
        </div>

        <div className="sidebar-module-search">
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a module" />
        </div>
        {searchResults.length > 0 && <div className="sidebar-search-results">{searchResults.map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}</button>)}</div>}

        <nav className="sidebar-nav enterprise-nav">{renderNav()}</nav>
        <div className="sidebar-footer">
          <small>{ROLE_LABELS[normalizedRole] || normalizedRole}</small>
          <strong>{user.displayName || user.email}</strong>
          <div className="sidebar-account-actions">
            <button type="button" onClick={toggleTheme}>{theme === 'dark' ? '☀ Light mode' : '☾ Dark mode'}</button>
            <button type="button" onClick={driveConnected ? disconnectDrive : connectDrive}>{driveConnected ? '✓ Drive connected' : '☁ Connect Drive'}</button>
            <button type="button" className="sidebar-signout" onClick={requestLogout}>Sign out</button>
          </div>
        </div>
      </aside>
      {drawerOpen && <button className="drawer-backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />}

      <div className="main-area">
        <header className="topbar enterprise-topbar compact-mobile-topbar">
          <button className="mobile-menu-button" aria-label="Open all modules" onClick={() => setDrawerOpen(true)}>☰</button>
          <div className="topbar-title">
            <p className="eyebrow">DF7 BUSINESS v2.1.2</p>
            <h1>{PAGE_TITLES[page] || 'Workspace'}</h1>
          </div>
          <div className="global-search desktop-module-search">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search modules…" />
            {searchResults.length > 0 && <div className="search-results">{searchResults.map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}</button>)}</div>}
          </div>
          <div className="topbar-actions desktop-topbar-actions">
            <button type="button" className="theme-toggle topbar-theme-toggle" onClick={toggleTheme}><span>{theme === 'dark' ? '☀' : '☾'}</span><b>{theme === 'dark' ? 'Light' : 'Dark'}</b></button>
            <button className={`drive-pill ${driveConnected ? 'connected' : ''}`} onClick={driveConnected ? disconnectDrive : connectDrive}><i />{driveConnected ? 'Drive connected' : 'Connect Drive'}</button>
            <img src={user.photoURL || `${import.meta.env.BASE_URL}icon.png`} alt="Account" referrerPolicy="no-referrer" />
          </div>
          <button type="button" className="mobile-theme-button" aria-label="Change theme" onClick={toggleTheme}>{theme === 'dark' ? '☀' : '☾'}</button>
        </header>
        <main className="content enterprise-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {mobileNav.map(([id, icon, label]) => (
          <button key={id} type="button" className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
            <span>{icon}</span><small>{label}</small>
          </button>
        ))}
        <button type="button" className={moreActive || drawerOpen ? 'active' : ''} onClick={() => setDrawerOpen(true)}>
          <span>☰</span><small>More</small>
        </button>
      </nav>
    </div>
  );
}

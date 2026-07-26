import { useMemo, useState } from 'react';
import { canAccessPage, ERP_NAV, PAGE_TITLES, ROLE_LABELS } from '../config/erp';

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

  const navigate = (id) => {
    setPage(id);
    setDrawerOpen(false);
    setSearch('');
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
    <div className="app-layout v21-layout">
      <aside className={`sidebar enterprise-sidebar ${drawerOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo-surface"><img className="sidebar-company-logo" src={`${import.meta.env.BASE_URL}images/DF7_Logo.png`} alt="DF7" /></div>
          <span className="sidebar-business-name">{businessName || 'Dhinash Family 7'}</span>
          <small className="version-pill">ERP v2.1.1</small>
        </div>
        <nav className="sidebar-nav enterprise-nav">{renderNav()}</nav>
        <div className="sidebar-footer">
          <small>{ROLE_LABELS[role] || role}</small>
          <strong>{user.displayName || user.email}</strong>
          <button onClick={requestLogout}>Sign out</button>
        </div>
      </aside>
      {drawerOpen && <button className="drawer-backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />}

      <div className="main-area">
        <header className="topbar enterprise-topbar">
          <button className="mobile-menu-button" onClick={() => setDrawerOpen(true)}>☰</button>
          <div className="topbar-title">
            <p className="eyebrow">DF7 BUSINESS v2.1.1 ENTERPRISE</p>
            <h1>{PAGE_TITLES[page] || 'Workspace'}</h1>
          </div>
          <div className="global-search">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search modules…" />
            {searchResults.length > 0 && <div className="search-results">{searchResults.map(([id, label]) => <button key={id} onClick={() => navigate(id)}>{label}</button>)}</div>}
          </div>
          <div className="topbar-actions">
            <button type="button" className="theme-toggle topbar-theme-toggle" onClick={toggleTheme}><span>{theme === 'dark' ? '☀' : '☾'}</span><b>{theme === 'dark' ? 'Light' : 'Dark'}</b></button>
            <button className={`drive-pill ${driveConnected ? 'connected' : ''}`} onClick={driveConnected ? disconnectDrive : connectDrive}><i />{driveConnected ? 'Drive connected' : 'Connect Drive'}</button>
            <img src={user.photoURL || `${import.meta.env.BASE_URL}icon.png`} alt="Account" referrerPolicy="no-referrer" />
          </div>
        </header>
        <main className="content enterprise-content">{children}</main>
      </div>
    </div>
  );
}

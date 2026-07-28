import { useEffect, useMemo, useRef, useState } from 'react';
import {
  canAccessPage,
  ERP_NAV,
  PAGE_TITLES,
  ROLE_LABELS,
  normalizeRole,
} from '../config/erp';

const MOBILE_NAV_MANAGER = [
  ['dashboard', '⌂', 'Home'],
  ['attendance', '◷', 'Attendance'],
  ['payroll', '▣', 'Payroll'],
  ['employees', '♙', 'Employees'],
];

const MOBILE_NAV_USER = [
  ['invoices', '▤', 'Invoices'],
  ['attendance', '◷', 'Attendance'],
  ['payroll', '▣', 'Payroll'],
  ['products', '□', 'Inventory'],
];

export default function AppShell({
  page,
  setPage,
  user,
  role,
  permissions,
  customPermissions,
  requestLogout,
  driveConnected,
  connectDrive,
  disconnectDrive,
  businessName,
  companyLogo,
  children,
}) {
  const [openGroups, setOpenGroups] = useState(['sales']);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const profileRef = useRef(null);

  useEffect(() => {
    document.body.classList.toggle('df7-mobile-drawer-open', drawerOpen);
    return () => document.body.classList.remove('df7-mobile-drawer-open');
  }, [drawerOpen]);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setDrawerOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const normalizedRole = normalizeRole(role);
  const allowed = (id) => canAccessPage(
    role,
    id,
    permissions,
    customPermissions,
  );

  const available = useMemo(() => ERP_NAV.map((group) => {
    if (group.page) return allowed(group.page) ? group : null;
    const childrenForRole = group.children.filter(([id]) => allowed(id));
    return childrenForRole.length ? { ...group, children: childrenForRole } : null;
  }).filter(Boolean), [role, permissions, customPermissions]);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return available.flatMap((group) => {
      if (group.page) {
        return group.label.toLowerCase().includes(term)
          ? [[group.page, group.label]]
          : [];
      }
      return group.children.filter(([, label]) => (
        label.toLowerCase().includes(term)
      ));
    }).slice(0, 10);
  }, [available, search]);

  const mobileNav = (
    normalizedRole === 'user' ? MOBILE_NAV_USER : MOBILE_NAV_MANAGER
  ).filter(([id]) => allowed(id));

  const mobileDirectPages = mobileNav.map(([id]) => id);
  const moreActive = !mobileDirectPages.includes(page);

  const navigate = (id) => {
    setPage(id);
    setDrawerOpen(false);
    setProfileOpen(false);
    setSearch('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderNav = () => available.map((group) => {
    if (group.page) {
      return (
        <button
          key={group.id}
          className={`nav-root ${page === group.page ? 'active' : ''}`}
          onClick={() => navigate(group.page)}
        >
          <span>{group.icon}</span>
          <b>{group.label}</b>
        </button>
      );
    }

    const active = group.children.some(([id]) => id === page);
    const open = openGroups.includes(group.id) || active;

    return (
      <div className={`nav-group ${active ? 'active-group' : ''}`} key={group.id}>
        <button
          className="nav-group-toggle"
          onClick={() => setOpenGroups((current) => (
            current.includes(group.id)
              ? current.filter((id) => id !== group.id)
              : [...current, group.id]
          ))}
        >
          <span>{group.icon}</span>
          <b>{group.label}</b>
          <i>{open ? '−' : '+'}</i>
        </button>

        {open && (
          <div className="nav-children">
            {group.children.map(([id, label]) => (
              <button
                key={id}
                className={page === id ? 'active' : ''}
                onClick={() => navigate(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  });

  return (
    <div className="app-layout v21-layout v219-layout">
      <aside className={`sidebar enterprise-sidebar mobile-navigation-drawer ${drawerOpen ? 'mobile-open' : ''}`}>
        <div className="mobile-drawer-heading">
          <div>
            <small>DF7 BUSINESS</small>
            <strong>Navigation</strong>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="sidebar-brand">
          <div className="sidebar-logo-surface">
            <img
              className="sidebar-company-logo"
              src={companyLogo || `${import.meta.env.BASE_URL}images/DF7_Logo.png`}
              alt="DF7"
            />
          </div>
          <span className="sidebar-business-name">
            {businessName || 'Dhinasha Family 7'}
          </span>
          <small className="version-pill">ERP v2.1.9</small>
        </div>

        <div className="sidebar-module-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a module"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="sidebar-search-results">
            {searchResults.map(([id, label]) => (
              <button key={id} onClick={() => navigate(id)}>{label}</button>
            ))}
          </div>
        )}

        <nav className="sidebar-nav enterprise-nav">{renderNav()}</nav>
      </aside>

      <div className="main-area">
        <header className="topbar enterprise-topbar compact-mobile-topbar">
          <button
            className="mobile-menu-button"
            aria-label="Open navigation"
            onClick={() => {
              setDrawerOpen(true);
              setProfileOpen(false);
            }}
          >
            ☰
          </button>

          <div className="topbar-title">
            <p className="eyebrow">DF7 BUSINESS v2.1.9</p>
            <h1>{PAGE_TITLES[page] || 'Workspace'}</h1>
          </div>

          <div className="global-search desktop-module-search">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search modules…"
            />
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(([id, label]) => (
                  <button key={id} onClick={() => navigate(id)}>{label}</button>
                ))}
              </div>
            )}
          </div>

          <div className="topbar-actions">
            <button
              className={`drive-pill desktop-drive-pill ${driveConnected ? 'connected' : ''}`}
              onClick={driveConnected ? disconnectDrive : connectDrive}
            >
              <i />
              {driveConnected ? 'Drive connected' : 'Connect Drive'}
            </button>

            <div className="profile-menu" ref={profileRef}>
              <button
                type="button"
                className={`profile-trigger ${profileOpen ? 'active' : ''}`}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((current) => !current)}
              >
                <img
                  src={user.photoURL || `${import.meta.env.BASE_URL}icon.png`}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              </button>

              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-user">
                    <img
                      src={user.photoURL || `${import.meta.env.BASE_URL}icon.png`}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <small>{ROLE_LABELS[normalizedRole]}</small>
                      <strong>{user.displayName || 'DF7 User'}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>

                  <button type="button" onClick={() => navigate('preferences')}>
                    <span>⚙</span>
                    Settings
                  </button>

                  <button
                    type="button"
                    className="profile-drive-action"
                    onClick={driveConnected ? disconnectDrive : connectDrive}
                  >
                    <span>☁</span>
                    {driveConnected ? 'Disconnect Drive' : 'Connect Drive'}
                  </button>

                  {normalizedRole === 'administrator' && (
                    <>
                      <button type="button" onClick={() => navigate('settings')}>
                        <span>♜</span>
                        Administration
                      </button>
                      <button type="button" onClick={() => navigate('users')}>
                        <span>♚</span>
                        Access Control
                      </button>
                    </>
                  )}

                  <div className="profile-dropdown-divider" />

                  <button
                    type="button"
                    className="profile-signout"
                    onClick={requestLogout}
                  >
                    <span>↪</span>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content enterprise-content">{children}</main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Primary navigation">
        {mobileNav.map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            className={page === id ? 'active' : ''}
            onClick={() => navigate(id)}
          >
            <span>{icon}</span>
            <small>{label}</small>
          </button>
        ))}

        <button
          type="button"
          className={moreActive || drawerOpen ? 'active' : ''}
          onClick={() => {
            setDrawerOpen(true);
            setProfileOpen(false);
          }}
        >
          <span>☰</span>
          <small>More</small>
        </button>
      </nav>
    </div>
  );
}

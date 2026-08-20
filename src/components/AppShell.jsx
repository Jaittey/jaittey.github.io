import { useEffect, useMemo, useRef, useState } from 'react';
import { ERP_NAV, PAGE_TITLES, ROLE_LABELS, normalizeRole } from '../config/erp';

const GROUP_LABELS = {
  dashboard: 'Overview',
  sales: 'Business modules',
  operations: 'Business modules',
  hr: 'Business modules',
  'finance-group': 'Business modules',
  'application-manager': 'Administration',
  'super-admin-group': 'Platform',
};

const iconFor = (value) => {
  const icons = {
    '▦': '▦', '▤': '▤', '□': '□', '♙': '♙', '◈': '◈', '⌘': '⚙', '♦': '◆',
  };
  return icons[value] || value || '•';
};

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
  companyLogo,
  businesses = [],
  activeBusinessId = '',
  onBusinessChange,
  onRegisterBusiness,
  canRegisterBusiness = false,
  subscription,
  canAccess,
  isSuperAdmin = false,
  children,
}) {
  const [openGroups, setOpenGroups] = useState(['sales']);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sb-suite-sidebar-collapsed') === '1',
  );
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const profileRef = useRef(null);

  const normalizedRole = normalizeRole(role);
  const allowed = (id) => (typeof canAccess === 'function' ? canAccess(id) : false);

  const available = useMemo(
    () => ERP_NAV.map((group) => {
      if (group.page) return allowed(group.page) ? group : null;
      const childrenAllowed = (group.children || []).filter(([id]) => allowed(id));
      return childrenAllowed.length ? { ...group, children: childrenAllowed } : null;
    }).filter(Boolean),
    [page, role, subscription?.status, subscription?.planId, canAccess],
  );

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return available
      .flatMap((group) => (
        group.page
          ? (group.label.toLowerCase().includes(term) ? [[group.page, group.label]] : [])
          : group.children.filter(([, label]) => label.toLowerCase().includes(term))
      ))
      .slice(0, 12);
  }, [available, search]);

  useEffect(() => {
    document.body.classList.toggle('suite-menu-open', drawerOpen);
    document.body.classList.toggle('suite-sidebar-collapsed', collapsed);
    localStorage.setItem('sb-suite-sidebar-collapsed', collapsed ? '1' : '0');
    return () => {
      document.body.classList.remove('suite-menu-open');
    };
  }, [drawerOpen, collapsed]);

  useEffect(() => {
    const outside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setDrawerOpen(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  useEffect(() => {
    const activeGroup = available.find(
      (group) => !group.page && group.children.some(([id]) => id === page),
    );
    if (activeGroup && !openGroups.includes(activeGroup.id)) {
      setOpenGroups((current) => [...current, activeGroup.id]);
    }
  }, [page, available]);

  const initials = (user?.displayName || user?.email || 'SB')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const navigate = (id) => {
    setPage(id);
    setSearch('');
    setDrawerOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleGroup = (groupId) => {
    if (collapsed && window.innerWidth > 900) setCollapsed(false);
    setOpenGroups((current) => (
      current.includes(groupId)
        ? current.filter((item) => item !== groupId)
        : [...current, groupId]
    ));
  };

  let previousCaption = '';

  return (
    <div className="suite-shell">
      <aside className={`suite-sidebar ${drawerOpen ? 'open' : ''}`} aria-label="Application navigation">
        <div className="suite-brand">
          <div className={`suite-brand-mark ${companyLogo ? 'has-logo' : ''}`} aria-hidden={!companyLogo}>
            {companyLogo ? <img src={companyLogo} alt="" /> : <span>SB</span>}
          </div>
          <div className="suite-brand-copy">
            <strong>Small Business Suite</strong>
            <small>{businessName || 'Business Workspace'} · 1.0</small>
          </div>
          <button
            className="suite-mobile-close"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="suite-side-search">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find module..."
            aria-label="Find a module"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="suite-search-results">
            {searchResults.map(([id, label]) => (
              <button key={id} type="button" onClick={() => navigate(id)}>{label}</button>
            ))}
          </div>
        )}

        <nav className="suite-sidebar-nav">
          {available.map((group) => {
            const caption = GROUP_LABELS[group.id] || '';
            const showCaption = caption && caption !== previousCaption;
            if (caption) previousCaption = caption;

            if (group.page) {
              return (
                <div className="suite-nav-block" key={group.id}>
                  {showCaption && <p className="suite-nav-caption">{caption}</p>}
                  <button
                    type="button"
                    className={`suite-nav-link ${page === group.page ? 'active' : ''}`}
                    onClick={() => navigate(group.page)}
                    aria-current={page === group.page ? 'page' : undefined}
                  >
                    <span className="suite-nav-icon">{iconFor(group.icon)}</span>
                    <span className="suite-nav-text">{group.label}</span>
                  </button>
                </div>
              );
            }

            const active = group.children.some(([id]) => id === page);
            const open = openGroups.includes(group.id) || active;

            return (
              <div className={`suite-nav-block suite-nav-group ${active ? 'has-active' : ''} ${open ? 'open' : ''}`} key={group.id}>
                {showCaption && <p className="suite-nav-caption">{caption}</p>}
                <button
                  type="button"
                  className="suite-submenu-toggle"
                  aria-expanded={open}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="suite-nav-icon">{iconFor(group.icon)}</span>
                  <span className="suite-nav-text">{group.label}</span>
                  <span className="suite-chevron">›</span>
                </button>
                <div className="suite-submenu">
                  <div className="suite-submenu-inner">
                    {group.children.map(([id, label]) => (
                      <button
                        type="button"
                        key={id}
                        className={`suite-submenu-link ${page === id ? 'active' : ''}`}
                        onClick={() => navigate(id)}
                        aria-current={page === id ? 'page' : undefined}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="suite-sidebar-footer">
          <div className="suite-profile-card">
            <div className="suite-avatar">{initials}</div>
            <button className="suite-profile-copy" type="button" onClick={() => navigate('preferences')}>
              <strong>{user?.displayName || 'Account settings'}</strong>
              <small>{ROLE_LABELS[normalizedRole]}</small>
            </button>
            <button
              className="suite-collapse-button"
              type="button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((current) => !current)}
            >
              ‹
            </button>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className={`suite-overlay ${drawerOpen ? 'visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => setDrawerOpen(false)}
      />

      <main className="suite-page">
        <header className="suite-topbar">
          <button
            className="suite-mobile-menu-button"
            type="button"
            aria-label="Open navigation menu"
            onClick={() => {
              setDrawerOpen(true);
              setProfileOpen(false);
            }}
          >
            ☰
          </button>

          <div className="suite-topbar-copy">
            <p className="suite-breadcrumb">
              Small Business Suite / {PAGE_TITLES[page] || 'Dashboard'}
            </p>
            <h1>{PAGE_TITLES[page] || 'Dashboard'}</h1>
          </div>

          <div className="suite-topbar-actions">
            <label className="suite-global-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                placeholder="Search modules and tools..."
              />
              {searchResults.length > 0 && (
                <div className="suite-top-search-results">
                  {searchResults.map(([id, label]) => (
                    <button key={id} type="button" onClick={() => navigate(id)}>{label}</button>
                  ))}
                </div>
              )}
            </label>

            {businesses.length > 0 && (
              <select
                className="suite-business-switcher"
                aria-label="Active business"
                value={activeBusinessId}
                onChange={(event) => onBusinessChange?.(event.target.value)}
              >
                {businesses.map((item) => (
                  <option key={item.businessId} value={item.businessId}>
                    {item.businessName || 'Business'}
                  </option>
                ))}
              </select>
            )}

            {canRegisterBusiness && (
              <button
                type="button"
                className="suite-icon-button"
                title="Register business"
                aria-label="Register business"
                onClick={onRegisterBusiness}
              >
                ＋
              </button>
            )}

            {subscription?.status === 'ACTIVE' && (
              <button
                type="button"
                className="suite-plan-chip"
                onClick={() => navigate('subscription')}
                title="Subscription"
              >
                ★ {subscription.planName || subscription.planId || 'Active'}
              </button>
            )}

            {allowed('cloud') && (
              <button
                type="button"
                className={`suite-icon-button suite-drive ${driveConnected ? 'connected' : ''}`}
                onClick={driveConnected ? disconnectDrive : connectDrive}
                title={driveConnected ? 'Disconnect Drive' : 'Connect Drive'}
                aria-label={driveConnected ? 'Disconnect Drive' : 'Connect Drive'}
              >
                ☁
              </button>
            )}

            {allowed('notifications') && (
              <button
                type="button"
                className={`suite-icon-button ${page === 'notifications' ? 'active' : ''}`}
                onClick={() => navigate('notifications')}
                aria-label="Notifications"
              >
                ♢
              </button>
            )}

            <div className="suite-profile-menu" ref={profileRef}>
              <button
                type="button"
                className="suite-profile-trigger"
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((current) => !current)}
              >
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                  : <span>{initials}</span>}
              </button>

              {profileOpen && (
                <div className="suite-profile-dropdown">
                  <div className="suite-profile-heading">
                    <strong>{user?.displayName || 'SB User'}</strong>
                    <span>{user?.email}</span>
                    <small>{ROLE_LABELS[normalizedRole]}</small>
                  </div>
                  <button type="button" onClick={() => navigate('dashboard')}>▦ Dashboard</button>
                  <button type="button" onClick={() => navigate('preferences')}>⚙ Appearance</button>
                  <button type="button" onClick={() => navigate('subscription')}>★ Subscription</button>
                  {normalizedRole === 'administrator' && (
                    <>
                      <button type="button" onClick={() => navigate('settings')}>⌘ Company Administration</button>
                      <button type="button" onClick={() => navigate('users')}>♙ Users & Permissions</button>
                    </>
                  )}
                  {isSuperAdmin && (
                    <button type="button" onClick={() => navigate('super-app-settings')}>◆ Super Admin App Settings</button>
                  )}
                  <div className="suite-profile-divider" />
                  <button type="button" className="danger" onClick={requestLogout}>↪ Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="suite-content">{children}</div>
      </main>
    </div>
  );
}

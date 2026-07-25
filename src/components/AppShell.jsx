const nav = [
  ['dashboard', '▦', 'Dashboard'],
  ['invoices', '▤', 'Invoices'],
  ['quotes', '◫', 'Quotes'],
  ['products', '□', 'Stock'],
  ['expenses', '↘', 'Expenses'],
  ['customers', '◎', 'Customers'],
  ['settings', '⚙', 'Settings'],
];

export default function AppShell({ page, setPage, user, requestLogout, driveConnected, connectDrive, disconnectDrive, businessName, theme, toggleTheme, children }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-surface">
            <img
              className="sidebar-company-logo"
              src={`${import.meta.env.BASE_URL}images/DF7_Logo.png`}
              alt="DF7 — Dhinash Family 7"
            />
          </div>
          <span className="sidebar-business-name">{businessName || 'Dhinash Family 7'}</span>
        </div>
        <nav className="sidebar-nav">
          {nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="sidebar-footer"><small>Signed in as</small><strong>{user.email}</strong><button onClick={requestLogout}>Sign out</button></div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">DF7 PRIVATE WORKSPACE</p><h1>{nav.find((item) => item[0] === page)?.[2]}</h1></div>
          <div className="topbar-actions">
            <button
              type="button"
              className="theme-toggle topbar-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span>{theme === 'dark' ? '☀' : '☾'}</span>
              <b>{theme === 'dark' ? 'Light' : 'Dark'}</b>
            </button>
            <button className={`drive-pill ${driveConnected ? 'connected' : ''}`} onClick={driveConnected ? disconnectDrive : connectDrive}><i />{driveConnected ? 'Drive connected' : 'Connect Drive'}</button>
            <img src={user.photoURL || `${import.meta.env.BASE_URL}icon.svg`} alt="Account" referrerPolicy="no-referrer" />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="mobile-nav">
        {nav.slice(0, 6).map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span><small>{label}</small></button>)}
      </nav>
    </div>
  );
}

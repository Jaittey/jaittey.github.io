const nav = [
  ['dashboard', '▦', 'Dashboard'],
  ['invoices', '▤', 'Invoices'],
  ['quotes', '◫', 'Quotes'],
  ['products', '□', 'Stock'],
  ['expenses', '↘', 'Expenses'],
  ['customers', '◎', 'Customers'],
  ['settings', '⚙', 'Settings'],
];

export default function AppShell({ page, setPage, user, logout, driveConnected, connectDrive, disconnectDrive, businessName, children }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-symbol">D7</div><div><strong>DF7</strong><span>{businessName}</span></div></div>
        <nav className="sidebar-nav">
          {nav.map(([id, icon, label]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><span>{icon}</span>{label}</button>)}
        </nav>
        <div className="sidebar-footer"><small>Signed in as</small><strong>{user.email}</strong><button onClick={logout}>Sign out</button></div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">DF7 PRIVATE WORKSPACE</p><h1>{nav.find((item) => item[0] === page)?.[2]}</h1></div>
          <div className="topbar-actions">
            <button className={`drive-pill ${driveConnected ? 'connected' : ''}`} onClick={driveConnected ? disconnectDrive : connectDrive}><i />{driveConnected ? 'Drive connected' : 'Connect Drive'}</button>
            <img src={user.photoURL || '/icon.svg'} alt="Account" referrerPolicy="no-referrer" />
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

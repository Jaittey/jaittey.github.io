import { configurationError, OWNER_EMAIL } from '../config/firebase';

export default function LoginPage({ login, error, loading }) {
  return (
    <main className="login-page">
      <div className="login-orb orb-one" />
      <div className="login-orb orb-two" />
      <section className="login-card">
        <div className="brand-mark">DF7</div>
        <p className="eyebrow">PRIVATE BUSINESS WORKSPACE</p>
        <h1>Your business, available anywhere.</h1>
        <p className="login-copy">Invoices, quotations, inventory, expenses and customers protected by your Google account.</p>
        <button className="google-button" onClick={login} disabled={loading || Boolean(configurationError)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.39a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.97-4.33 2.97-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.56l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62c.79-2.36 3-4.12 5.6-4.12Z"/></svg>
          Sign in with Google
        </button>
        {configurationError && <div className="alert alert-error">{configurationError}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <div className="login-security"><span>●</span> Only <strong>{OWNER_EMAIL || 'your approved email'}</strong> can access the database.</div>
      </section>
    </main>
  );
}

import { useState } from 'react';
import { configurationError } from '../config/supabase';

export default function LoginPage({
  loginGoogle,
  loginEmail,
  registerEmail,
  error,
  loading,
}) {
  const [mode, setMode] = useState('google');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const chooseMode = (nextMode) => {
    setMode(nextMode);
    setNotice('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice('');

    try {
      if (mode === 'register') {
        const result = await registerEmail(form.email, form.password, form.name);

        if (result?.ok) {
          // Registration here means "activate a company login" that an
          // Administrator already created in business_memberships.
          setMode('email');
          setForm((current) => ({
            ...current,
            email: result.email,
            name: '',
            password: '',
          }));
          setNotice(
            'Employee account activated. Enter the password you just created and sign in.',
          );
        }
        return;
      }

      await loginEmail(form.email, form.password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page v21-login">
      <div className="login-orb orb-one" />
      <div className="login-orb orb-two" />

      <section className="login-showcase" aria-label="Small Business platform overview">
        <div className="login-showcase-brand">
          <span>SB</span>
          <div>
            <strong>Small Business</strong>
            <small>One workspace. Complete control.</small>
          </div>
        </div>

        <div className="login-showcase-copy">
          <p className="eyebrow">THE OPERATING SYSTEM FOR GROWING TEAMS</p>
          <h1>Run every side of your business <em>beautifully.</em></h1>
          <p>
            Sales, finance, people, inventory, and documents come together in one
            secure workspace that stays fast as you grow.
          </p>
        </div>

        <div className="login-preview-stack" aria-hidden="true">
          <article className="login-preview-card preview-primary">
            <header><span>Business pulse</span><b>Live</b></header>
            <strong>MVR 128,450</strong>
            <small>Revenue this month</small>
            <div className="preview-chart"><i/><i/><i/><i/><i/><i/></div>
          </article>
          <article className="login-preview-card preview-floating">
            <span>↗</span>
            <div><small>Net position</small><strong>+18.4%</strong></div>
          </article>
          <article className="login-preview-card preview-team">
            <div><span>AN</span><span>MK</span><span>SA</span></div>
            <strong>12 teammates active</strong>
          </article>
        </div>

        <div className="login-trust-row">
          <span><i>✓</i> Company data isolation</span>
          <span><i>✓</i> Secure cloud sync</span>
          <span><i>✓</i> Built for every screen</span>
        </div>
      </section>

      <section className="login-card enterprise-login-card">
        <div className="login-logo-wrap">
          <img
            className="login-company-logo"
            src={`${import.meta.env.BASE_URL}images/SB_Logo.png`}
            alt="Small Business"
          />
        </div>

        <p className="eyebrow">WELCOME TO YOUR WORKSPACE</p>
        <h1>Sign in to continue.</h1>
        <p className="login-copy">
          Access your company dashboard, daily operations, and team workspace.
        </p>

        <div className="login-mode-tabs">
          <button
            type="button"
            className={mode === 'google' ? 'active' : ''}
            onClick={() => chooseMode('google')}
          >
            Google
          </button>
          <button
            type="button"
            className={mode === 'email' ? 'active' : ''}
            onClick={() => chooseMode('email')}
          >
            Email
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => chooseMode('register')}
          >
            Register
          </button>
        </div>

        {mode === 'google' ? (
          <button
            className="google-button"
            onClick={loginGoogle}
            disabled={loading || Boolean(configurationError)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.39a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.97-4.33 2.97-7.41Z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.62A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M6.4 13.94A6 6 0 0 1 6.08 12c0-.67.12-1.32.32-1.94V7.44H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.56l3.35-2.62Z"/>
              <path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.44l3.35 2.62c.79-2.36 3-4.12 5.6-4.12Z"/>
            </svg>
            Continue with Google
          </button>
        ) : (
          <>
            {mode === 'register' && (
              <div className="alert alert-info">
                Your company Administrator must add your name and email first.
                Then enter those details here and create your own password.
              </div>
            )}

            <form className="enterprise-login-form" onSubmit={submit}>
              {mode === 'register' && (
                <label>
                  <span>Name provided by Administrator</span>
                  <input
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </label>
              )}

              <label>
                <span>Email address</span>
                <input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  autoComplete={mode === 'register' ? 'email' : 'username'}
                  value={form.email}
                  onChange={(event) => setForm({
                    ...form,
                    email: event.target.value.replace(/\s+/g, ''),
                  })}
                  required
                />
              </label>

              <label>
                <span>{mode === 'register' ? 'Create password' : 'Password'}</span>
                <input
                  type="password"
                  minLength="8"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                />
              </label>

              <button
                className="button button-primary"
                disabled={loading || submitting}
              >
                {submitting
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Activate employee account'
                    : 'Sign in'}
              </button>
            </form>
          </>
        )}

        {configurationError && <div className="alert alert-error">{configurationError}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {notice && (
          <div className="alert alert-success" role="status" aria-live="polite">
            {notice}
          </div>
        )}

        <p className="login-security">
          <span>⌾</span>
          Protected by workspace-level access controls and secure company data isolation.
        </p>
      </section>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { clearSuiteTestData, getSuiteDataSummary } from '../services/platformAdmin';

const scopeText = {
  OPERATIONS: {
    name: 'Operational test data',
    description: 'Deletes sales, invoices, quotes, customers, inventory transactions, HR, payroll, attendance, marketplace orders, kitchen tickets and other operational records. Company settings and POS configuration stay.',
  },
  COMPANY_DATA: {
    name: 'All company workspace data',
    description: 'Deletes every business record and company asset database record, but keeps businesses, memberships and subscriptions so company access still works.',
  },
  ALL_TEST_DATA: {
    name: 'All application test transactions',
    description: 'Also clears subscription test requests/payments, receipt duplicate indexes, mail queue and activation-attempt logs. Platform plans, bank accounts, businesses, subscriptions, memberships and Auth users remain.',
  },
};

const countText = (value) => Number(value || 0).toLocaleString('en-US');

export default function SuperAdminAppSettings({ notify = () => {} }) {
  const [summary, setSummary] = useState({});
  const [scope, setScope] = useState('OPERATIONS');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const refresh = async () => {
    try {
      setSummary(await getSuiteDataSummary());
    } catch (reason) {
      notify(reason?.message || 'Could not read the platform data summary.', 'error');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const clear = async () => {
    if (phrase.trim() !== 'DELETE ALL TEST DATA') {
      notify('Type DELETE ALL TEST DATA exactly to continue.', 'error');
      return;
    }

    const selected = scopeText[scope];
    if (!window.confirm(
      `${selected.name}\n\n${selected.description}\n\nThis action cannot be undone. Continue?`,
    )) return;

    setBusy(true);
    try {
      const result = await clearSuiteTestData(scope, phrase.trim());
      setLastResult(result);
      setPhrase('');
      notify('Selected test data was deleted successfully.');
      await refresh();
    } catch (reason) {
      notify(reason?.message || 'Test data could not be deleted.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="suite-app-settings">
      <section className="panel suite-app-settings-hero">
        <div>
          <p className="eyebrow">SUPER ADMIN / APP SETTINGS</p>
          <h2>Small Business Suite 1.0</h2>
          <p>
            Platform maintenance, test-data cleanup and deployment information.
            Destructive actions are protected on the server and are available only to the Super Admin.
          </p>
        </div>
        <span className="suite-version-chip">SUITE 1.0</span>
      </section>

      <section className="suite-app-stat-grid">
        <article className="panel"><span>Business records</span><strong>{countText(summary.businessRecords)}</strong></article>
        <article className="panel"><span>Businesses</span><strong>{countText(summary.businesses)}</strong></article>
        <article className="panel"><span>Memberships</span><strong>{countText(summary.memberships)}</strong></article>
        <article className="panel"><span>Subscription transactions</span><strong>{countText(summary.subscriptionTransactions)}</strong></article>
      </section>

      <section className="panel suite-danger-zone">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PROTECTED DATA CLEANUP</p>
            <h2>Delete test data</h2>
            <p className="page-subtitle">
              This tool intentionally does not delete Supabase Auth users, businesses, memberships,
              active subscriptions, plan definitions or configured platform bank accounts.
            </p>
          </div>
        </div>

        <div className="suite-cleanup-options">
          {Object.entries(scopeText).map(([id, item]) => (
            <label key={id} className={scope === id ? 'selected' : ''}>
              <input
                type="radio"
                name="suite-cleanup-scope"
                value={id}
                checked={scope === id}
                onChange={() => setScope(id)}
              />
              <span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </div>

        <div className="alert alert-warning">
          This is an irreversible database operation. Create a backup first if any current
          records may be real business data.
        </div>

        <label className="suite-confirm-field">
          <span>Type <b>DELETE ALL TEST DATA</b> to enable deletion</span>
          <input
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder="DELETE ALL TEST DATA"
            autoComplete="off"
          />
        </label>

        <button
          type="button"
          className="button button-danger suite-delete-test-button"
          disabled={busy || phrase.trim() !== 'DELETE ALL TEST DATA'}
          onClick={clear}
        >
          {busy ? 'Deleting…' : 'Delete selected test data'}
        </button>

        {lastResult && (
          <div className="suite-cleanup-result">
            <strong>Last cleanup completed</strong>
            <pre>{JSON.stringify(lastResult, null, 2)}</pre>
          </div>
        )}
      </section>

      <section className="panel suite-platform-notes">
        <p className="eyebrow">PLATFORM STATUS</p>
        <h2>Migration cleanup</h2>
        <div className="suite-check-list">
          <span>✓ Firebase Migration has been retired from Suite 1.0.</span>
          <span>✓ Supabase is the active authentication, database and storage platform.</span>
          <span>✓ Employee account activation remains handled by the working secure Supabase function.</span>
          <span>✓ Company subscriptions and memberships are preserved during test-data cleanup.</span>
        </div>
      </section>
    </div>
  );
}

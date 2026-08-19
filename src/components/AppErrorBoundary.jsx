import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Small Business UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error-screen">
        <section className="panel fatal-error-card">
          <p className="eyebrow">SMALL BUSINESS</p>
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || 'The application could not render this page.'}</p>
          <div className="fatal-error-actions">
            <button className="button button-primary" onClick={() => window.location.reload()}>
              Reload application
            </button>
            <button
              className="button button-secondary"
              onClick={async () => {
                try {
                  if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map((item) => item.unregister()));
                  }
                  const keys = await caches.keys();
                  await Promise.all(keys.filter((key) => key.startsWith('sb-')).map((key) => caches.delete(key)));
                } catch {}
                window.location.reload();
              }}
            >
              Clear app cache & reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}

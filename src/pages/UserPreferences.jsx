import { useMemo } from 'react';
import { THEMES } from '../config/themes';

export default function UserPreferences({ theme, setTheme }) {
  const selected = useMemo(
    () => THEMES.find((item) => item.id === theme) || THEMES[0],
    [theme],
  );

  return (
    <div className="user-settings-page">
      <section className="settings-welcome panel">
        <div>
          <p className="eyebrow">SETTINGS</p>
          <h2>Choose your workspace theme</h2>
          <p>The selected theme applies only to this browser or device. It does not change another user’s appearance.</p>
        </div>
        <div className="settings-current-theme">
          <span>Current theme</span>
          <strong>{selected.name}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">APPEARANCE</p>
            <h2>Small Business themes</h2>
            <p className="page-subtitle">Select any theme below. Changes are applied immediately.</p>
          </div>
        </div>

        <div className="theme-card-grid user-theme-grid">
          {THEMES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`theme-card ${theme === item.id ? 'active' : ''}`}
              onClick={() => setTheme(item.id)}
            >
              <span className="theme-preview" aria-hidden="true">
                {item.preview.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
              {theme === item.id && <b>Selected</b>}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

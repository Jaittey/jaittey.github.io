import { useMemo } from 'react';
import { THEMES } from '../config/themes';

const DEFAULT_CUSTOM = {
  background: '#111827',
  surface: '#1f2937',
  accent: '#8b5cf6',
  accent2: '#3b82f6',
  text: '#f7f7fb',
};

export default function UserPreferences({ theme, setTheme, customTheme = DEFAULT_CUSTOM, setCustomTheme }) {
  const selected = useMemo(
    () => THEMES.find((item) => item.id === theme) || THEMES[0],
    [theme],
  );

  const updateCustom = (key, value) => {
    const next = { ...customTheme, [key]: value };
    setCustomTheme?.(next);
    if (theme !== 'custom') setTheme('custom');
  };

  const resetCustom = () => {
    setCustomTheme?.(DEFAULT_CUSTOM);
    setTheme('custom');
  };

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
            <p className="page-subtitle">Select a preset or create your own theme. Changes are applied immediately.</p>
          </div>
        </div>

        <div className="theme-card-grid user-theme-grid">
          {THEMES.map((item) => {
            const preview = item.id === 'custom'
              ? [customTheme.background, customTheme.surface, customTheme.accent]
              : item.preview;
            return (
              <button
                type="button"
                key={item.id}
                className={`theme-card ${theme === item.id ? 'active' : ''}`}
                onClick={() => setTheme(item.id)}
              >
                <span className="theme-preview" aria-hidden="true">
                  {preview.map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
                </span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                {theme === item.id && <b>Selected</b>}
              </button>
            );
          })}
        </div>

        <div className="custom-theme-builder">
          <h3>Custom theme builder</h3>
          <p>Choose your own workspace colors. The custom theme is saved only on this device.</p>
          <div className="custom-theme-grid">
            <label>Background<input type="color" value={customTheme.background} onChange={(e) => updateCustom('background', e.target.value)} /></label>
            <label>Surface<input type="color" value={customTheme.surface} onChange={(e) => updateCustom('surface', e.target.value)} /></label>
            <label>Primary accent<input type="color" value={customTheme.accent} onChange={(e) => updateCustom('accent', e.target.value)} /></label>
            <label>Secondary accent<input type="color" value={customTheme.accent2} onChange={(e) => updateCustom('accent2', e.target.value)} /></label>
            <label>Text<input type="color" value={customTheme.text} onChange={(e) => updateCustom('text', e.target.value)} /></label>
          </div>
          <div className="custom-theme-actions">
            <button type="button" className="button button-secondary" onClick={resetCustom}>Reset custom colors</button>
            <button type="button" className="button button-primary" onClick={() => setTheme('custom')}>Use custom theme</button>
          </div>
        </div>
      </section>
    </div>
  );
}

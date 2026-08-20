import { useMemo, useState } from 'react';
import {
  DEFAULT_CUSTOM_APPEARANCE,
  THEMES,
  normalizeCustomAppearance,
} from '../config/themes';

const COLOR_FIELDS = [
  ['accent', 'Primary accent'],
  ['accent2', 'Secondary accent'],
  ['sidebarBg', 'Navigation base color'],
  ['pageBg', 'Page background'],
  ['surface', 'Card / surface'],
  ['text', 'Primary text'],
];

const darkNavigationPreview = (color) => (
  `color-mix(in srgb, ${color} 38%, #050713 62%)`
);

export default function UserPreferences({
  theme,
  setTheme,
  customAppearance,
  setCustomAppearance,
}) {
  const selected = useMemo(
    () => THEMES.find((item) => item.id === theme) || THEMES[0],
    [theme],
  );
  const [draft, setDraft] = useState(() => normalizeCustomAppearance(customAppearance));

  const update = (field, value) => {
    const next = normalizeCustomAppearance({ ...draft, [field]: value });
    setDraft(next);
    setCustomAppearance?.(next);
  };

  const applyPreset = (themeId) => {
    setTheme(themeId);
    if (draft.enabled) {
      const next = normalizeCustomAppearance({ ...draft, enabled: false });
      setDraft(next);
      setCustomAppearance?.(next);
    }
  };

  const resetCustom = () => {
    const next = { ...DEFAULT_CUSTOM_APPEARANCE };
    setDraft(next);
    setCustomAppearance?.(next);
  };

  const previewNavigation = draft.enabled
    ? darkNavigationPreview(draft.sidebarBg)
    : selected.navigation;

  return (
    <div className="user-settings-page suite-theme-settings">
      <section className="settings-welcome panel">
        <div>
          <p className="eyebrow">APPEARANCE</p>
          <h2>Make Small Business Suite yours</h2>
          <p>
            Choose a complete preset or build a custom workspace. Every preset now
            changes the page, cards, buttons and navigation together. Navigation
            always stays in a darker matching shade for readability.
          </p>
        </div>
        <div className="settings-current-theme">
          <span>Current preset</span>
          <strong>{selected.name}</strong>
          <small>{draft.enabled ? 'Custom overrides enabled' : 'Complete preset active'}</small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PRESETS</p>
            <h2>Complete application themes</h2>
            <p className="page-subtitle">
              Selecting a preset applies its matching colors to the workspace and navigation immediately.
            </p>
          </div>
        </div>

        <div className="theme-card-grid user-theme-grid">
          {THEMES.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`theme-card ${theme === item.id && !draft.enabled ? 'active' : ''}`}
              onClick={() => applyPreset(item.id)}
            >
              <span className="theme-preview" aria-hidden="true">
                {item.preview.map((color, index) => (
                  <i
                    key={`${color}-${index}`}
                    style={{ background: color }}
                    title={index === item.preview.length - 1 ? 'Navigation' : undefined}
                  />
                ))}
              </span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
              {theme === item.id && !draft.enabled && <b>Selected</b>}
            </button>
          ))}
        </div>

        <div className="alert alert-info suite-theme-note">
          Selecting a preset turns custom overrides off so the whole application changes together.
          Your custom values are kept and can be enabled again later.
        </div>
      </section>

      <section className="panel suite-custom-theme-panel">
        <div className="suite-custom-theme-heading">
          <div>
            <p className="eyebrow">CUSTOM THEME BUILDER</p>
            <h2>Colors, transparency and layout</h2>
            <p className="page-subtitle">
              The navigation automatically darkens the selected navigation base color so menu text
              and icons remain readable on desktop and mobile.
            </p>
          </div>
          <label className="suite-switch">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) => update('enabled', event.target.checked)}
            />
            <span>Enable custom appearance</span>
          </label>
        </div>

        <div className={`suite-custom-theme-grid ${draft.enabled ? '' : 'disabled'}`}>
          {COLOR_FIELDS.map(([field, label]) => (
            <label className="suite-color-field" key={field}>
              <span>{label}</span>
              <div>
                <input
                  type="color"
                  value={draft[field]}
                  disabled={!draft.enabled}
                  onChange={(event) => update(field, event.target.value)}
                />
                <input
                  value={draft[field]}
                  disabled={!draft.enabled}
                  onChange={(event) => update(field, event.target.value)}
                />
              </div>
            </label>
          ))}

          <label>
            <span>Surface transparency: {draft.panelOpacity}%</span>
            <input
              type="range"
              min="35"
              max="100"
              value={draft.panelOpacity}
              disabled={!draft.enabled}
              onChange={(event) => update('panelOpacity', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Glass / navigation blur: {draft.glassBlur}px</span>
            <input
              type="range"
              min="0"
              max="36"
              value={draft.glassBlur}
              disabled={!draft.enabled}
              onChange={(event) => update('glassBlur', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Card radius: {draft.borderRadius}px</span>
            <input
              type="range"
              min="8"
              max="30"
              value={draft.borderRadius}
              disabled={!draft.enabled}
              onChange={(event) => update('borderRadius', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Sidebar width: {draft.sidebarWidth}px</span>
            <input
              type="range"
              min="240"
              max="350"
              value={draft.sidebarWidth}
              disabled={!draft.enabled}
              onChange={(event) => update('sidebarWidth', Number(event.target.value))}
            />
          </label>

          <label>
            <span>Workspace density</span>
            <select
              value={draft.density}
              disabled={!draft.enabled}
              onChange={(event) => update('density', event.target.value)}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </div>

        <div className="suite-theme-preview-panel" aria-hidden="true">
          <aside style={{ background: previewNavigation }}>
            <img
              src={`${import.meta.env.BASE_URL}images/suite/sb-icon-white.png`}
              alt=""
              className="suite-theme-preview-logo"
            />
            <i style={{ background: draft.enabled ? draft.accent : selected.preview[2] }} />
            <i />
            <i />
          </aside>
          <main style={{
            background: draft.enabled ? draft.pageBg : selected.preview[0],
            color: draft.enabled ? draft.text : undefined,
          }}>
            <div style={{
              background: draft.enabled ? draft.surface : selected.preview[1],
              borderRadius: `${draft.borderRadius}px`,
            }}>
              <b>Live preview</b>
              <span style={{ background: draft.enabled ? draft.accent : selected.preview[2] }}>Action</span>
            </div>
          </main>
        </div>

        <footer className="modal-actions">
          <button type="button" className="button button-secondary" onClick={resetCustom}>
            Reset custom settings
          </button>
        </footer>
      </section>
    </div>
  );
}

export const THEMES = [
  {
    id: 'royal',
    name: 'Royal',
    description: 'Deep navy workspace with refined gold accents and matching dark navigation.',
    preview: ['#07111f', '#101d30', '#d8b85e', '#08101d'],
    navigation: '#08101d',
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Deep charcoal with emerald accents.',
    preview: ['#080b10', '#10151d', '#65ddb0', '#070a0e'],
    navigation: '#070a0e',
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light workspace with a dark slate navigation.',
    preview: ['#edf2f5', '#ffffff', '#15795c', '#14202b'],
    navigation: '#14202b',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Navy and cyan with a deeper ocean navigation.',
    preview: ['#071522', '#0d2435', '#45c7e8', '#04111d'],
    navigation: '#04111d',
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Rich green surfaces with a dark forest navigation.',
    preview: ['#07130f', '#10251d', '#d7b55a', '#06100c'],
    navigation: '#06100c',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm graphite and coral with a deep cocoa navigation.',
    preview: ['#17100f', '#291b18', '#ff9a62', '#170d0c'],
    navigation: '#170d0c',
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export const DEFAULT_CUSTOM_APPEARANCE = {
  enabled: false,
  accent: '#7c6df2',
  accent2: '#5d50d7',
  sidebarBg: '#171935',
  pageBg: '#f5f6fa',
  surface: '#ffffff',
  text: '#1d2030',
  panelOpacity: 92,
  glassBlur: 16,
  borderRadius: 18,
  sidebarWidth: 292,
  density: 'comfortable',
};

export const normalizeTheme = (value) => (
  THEME_IDS.includes(value) ? value : 'royal'
);

export const normalizeCustomAppearance = (value = {}) => {
  const input = value && typeof value === 'object' ? value : {};
  return {
    ...DEFAULT_CUSTOM_APPEARANCE,
    ...input,
    enabled: Boolean(input.enabled),
    panelOpacity: Math.min(100, Math.max(35, Number(input.panelOpacity ?? DEFAULT_CUSTOM_APPEARANCE.panelOpacity))),
    glassBlur: Math.min(36, Math.max(0, Number(input.glassBlur ?? DEFAULT_CUSTOM_APPEARANCE.glassBlur))),
    borderRadius: Math.min(30, Math.max(8, Number(input.borderRadius ?? DEFAULT_CUSTOM_APPEARANCE.borderRadius))),
    sidebarWidth: Math.min(350, Math.max(240, Number(input.sidebarWidth ?? DEFAULT_CUSTOM_APPEARANCE.sidebarWidth))),
    density: input.density === 'compact' ? 'compact' : 'comfortable',
  };
};

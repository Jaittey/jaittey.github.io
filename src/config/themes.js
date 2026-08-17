export const THEMES = [
  {
    id: 'royal',
    name: 'Royal',
    description: 'Deep navy, refined gold and cool blue details with a refined navy-and-gold business style.',
    preview: ['#070d19', '#101a2c', '#d8b85e'],
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Deep charcoal with emerald accents.',
    preview: ['#080b10', '#10151d', '#65ddb0'],
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean white workspace with green accents.',
    preview: ['#edf2f5', '#ffffff', '#15795c'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Navy and cyan for a calm professional look.',
    preview: ['#071522', '#0d2435', '#45c7e8'],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Rich green surfaces with warm gold details.',
    preview: ['#07130f', '#10251d', '#d7b55a'],
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Build your own workspace colors and save them on this device.',
    preview: ['#111827', '#1f2937', '#8b5cf6'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm graphite with coral and amber.',
    preview: ['#17100f', '#291b18', '#ff9a62'],
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

export const normalizeTheme = (value) => (
  THEME_IDS.includes(value) ? value : 'royal'
);

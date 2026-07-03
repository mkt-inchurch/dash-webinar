import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeCtxValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeCtx = createContext<ThemeCtxValue>({ theme: 'dark', toggle: () => {}, setTheme: () => {} });

function readInitial(): Theme {
  try {
    const saved = localStorage.getItem('dw-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('dw-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// Paleta dos gráficos (Recharts recebe cores via JS, não via classes Tailwind).
export interface ChartPalette {
  green: string;
  orange: string;
  grid: string;
  axis: string;
  axisAlt: string;
  dim: string;
  reach: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  cursor: string;
}

export function chartPalette(theme: Theme): ChartPalette {
  const light = theme === 'light';
  return {
    green: light ? '#0AA92E' : '#00E330',
    orange: light ? '#D98814' : '#F5A623',
    grid: light ? '#E4E7EB' : '#1F2225',
    axis: light ? '#6B7280' : '#888888',
    axisAlt: light ? '#9AA3AE' : '#aaaaaa',
    dim: light ? '#D3D8DE' : '#2A2F35',
    reach: light ? '#7ED08A' : '#2f7d3a',
    tooltipBg: light ? '#FFFFFF' : '#0F1012',
    tooltipBorder: light ? '#E4E7EB' : '#1F2225',
    tooltipText: light ? '#0B0D0F' : '#ffffff',
    cursor: light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)',
  };
}

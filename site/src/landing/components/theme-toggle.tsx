import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const preference = useRef<Theme | 'auto'>('auto');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('starlight-theme');
      preference.current = saved === 'light' || saved === 'dark' ? saved : 'auto';
    } catch { preference.current = 'auto'; }
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const next = preference.current === 'auto' ? scheme.matches ? 'dark' : 'light' : preference.current;
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    apply();
    scheme.addEventListener('change', apply);
    return () => scheme.removeEventListener('change', apply);
  }, []);

  function select(next: Theme) {
    preference.current = next;
    try { localStorage.setItem('starlight-theme', next); } catch { /* Theme still works for this page. */ }
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  return <div className="theme-toggle" role="group" aria-label="Color theme">
    <button type="button" aria-label="Light mode" aria-pressed={theme === 'light'} onClick={() => select('light')}><Sun aria-hidden="true" /></button>
    <button type="button" aria-label="Dark mode" aria-pressed={theme === 'dark'} onClick={() => select('dark')}><Moon aria-hidden="true" /></button>
  </div>;
}

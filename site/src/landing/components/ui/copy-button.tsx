import { useEffect, useRef, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { Button } from './button';

type CopyState = 'idle' | 'copying' | 'copied' | 'error' | 'unavailable';

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const busy = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  async function copy() {
    if (busy.current) return;
    clearTimeout(timer.current);
    if (!navigator.clipboard?.writeText) { setState('unavailable'); return; }
    busy.current = true;
    setState('copying');
    try {
      await navigator.clipboard.writeText(text);
      if (!mounted.current) return;
      setState('copied');
      timer.current = setTimeout(() => setState('idle'), 3000);
    } catch {
      if (mounted.current) setState('error');
    } finally { busy.current = false; }
  }
  const failed = state === 'error' || state === 'unavailable';
  const Icon = state === 'copied' ? Check : failed ? RotateCcw : Copy;
  return <div className="copy-control" data-copy-state={state}><Button type="button" variant="outline" size="sm" disabled={state === 'copying'} aria-busy={state === 'copying'} onClick={copy}><Icon aria-hidden="true" />{state === 'copied' ? 'Copied' : state === 'copying' ? 'Copying…' : failed ? 'Try again' : 'Copy commands'}</Button><span className={failed ? 'copy-status copy-error' : 'copy-status sr-only'} aria-live="polite" aria-atomic="true">{state === 'copied' ? 'Commands copied.' : state === 'error' ? 'Could not copy. Select the commands below to copy manually, or try again.' : state === 'unavailable' ? 'Clipboard is unavailable. Select the commands below to copy manually.' : ''}</span></div>;
}

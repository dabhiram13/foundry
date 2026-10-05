// Adapted from Animate UI. See site/assets/animate-ui.LICENSE.md.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Accordion } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, ChevronDown as CaretDown } from 'lucide-react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { useStudioMotion } from '../studio-motion';

export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const id = useId();
  return <Accordion.Root type="single" collapsible defaultValue={defaultOpen ? id : undefined} className="studio-disclosure">
    <Accordion.Item value={id}>
      <Accordion.Header><Accordion.Trigger>{title}<CaretDown aria-hidden="true"/></Accordion.Trigger></Accordion.Header>
      <Accordion.Content className="disclosure-content"><div>{children}</div></Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>;
}

export function CopyButton({ content, label = 'Copy text' }: { content: string; label?: string }) {
  const { reduced } = useStudioMotion();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(content); if (mounted.current) setState('copied'); }
    catch { if (mounted.current) setState('failed'); }
    if (mounted.current) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), 3000);
    }
  };
  return <div className="copy-control">
    <Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={label}>
      <AnimatePresence initial={false} mode="wait"><motion.span className="copy-icon" key={state}
        initial={reduced ? false : { opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
        {state === 'copied' ? <Check aria-hidden="true"/> : <Copy aria-hidden="true"/>}
      </motion.span></AnimatePresence><span>{state === 'copied' ? 'Copied' : label}</span>
    </Button></TooltipTrigger><TooltipContent>Copy to your clipboard</TooltipContent></Tooltip>
    <span className={state === 'failed' ? 'copy-error' : 'sr-only'} role="status">{state === 'failed' ? 'Could not copy. Select and copy the text instead.' : state === 'copied' ? 'Copied to clipboard.' : ''}</span>
  </div>;
}

// Adapted from Animate UI. See app/assets/animate-ui.LICENSE.md.
import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Accordion, Checkbox as CheckboxPrimitive, Progress as ProgressPrimitive, RadioGroup } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, CaretDown } from '@phosphor-icons/react';
import { Button } from './button';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import { useStudioMotion } from '../studio-motion';

export function Checkbox({ checked, onCheckedChange, id, disabled, name }: {
  checked: boolean; onCheckedChange: (checked: boolean) => void; id?: string; disabled?: boolean; name?: string;
}) {
  const { reduced } = useStudioMotion();
  return <CheckboxPrimitive.Root asChild id={id} name={name} checked={checked} disabled={disabled} onCheckedChange={value => onCheckedChange(value === true)}>
    <motion.button type="button" className="studio-checkbox" whileTap={reduced ? undefined : { scale: .94 }}>
      <CheckboxPrimitive.Indicator forceMount asChild>
        <motion.svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <motion.path d="M4.5 12.75l6 6 9-13.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            initial={false} animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={{ duration: reduced ? 0 : .18 }}/>
        </motion.svg>
      </CheckboxPrimitive.Indicator>
    </motion.button>
  </CheckboxPrimitive.Root>;
}

export function ChoiceGroup({ id, label, value, onValueChange, options }: {
  id: string; label: string; value: string; onValueChange: (value: string) => void;
  options: { value: string; label: string; description: string }[];
}) {
  const { reduced } = useStudioMotion();
  const pendingArrowValue = useRef<string | null>(null);
  function handleArrowSelection(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target as HTMLElement;
    const currentIndex = options.findIndex(option => option.value === target.getAttribute('value'));
    if (currentIndex < 0) {
      pendingArrowValue.current = null;
      return;
    }
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const previous = event.key === 'ArrowUp' || (event.key === 'ArrowLeft' && !rtl) || (event.key === 'ArrowRight' && rtl);
    const nextIndex = (currentIndex + (previous ? options.length - 1 : 1)) % options.length;
    pendingArrowValue.current = options[nextIndex].value === target.getAttribute('value') ? null : options[nextIndex].value;
  }
  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    const pendingValue = pendingArrowValue.current;
    pendingArrowValue.current = null;
    if (pendingValue && pendingValue === (event.target as HTMLElement).getAttribute('value')) onValueChange(pendingValue);
  }
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) pendingArrowValue.current = null;
  }
  return <RadioGroup.Root id={id} aria-label={label} value={value} onValueChange={onValueChange} onKeyDownCapture={handleArrowSelection} onFocusCapture={handleFocus} onBlurCapture={handleBlur} className="choice-grid">
    {options.map(option => <RadioGroup.Item asChild key={option.value} value={option.value}>
      <motion.button type="button" className="choice-card" whileTap={reduced ? undefined : { scale: .99 }}>
        <span className="choice-dot"><RadioGroup.Indicator asChild><motion.span initial={reduced ? false : { scale: .5 }} animate={{ scale: 1 }}/></RadioGroup.Indicator></span>
        <span><strong>{option.label}</strong><small>{option.description}</small></span>
      </motion.button>
    </RadioGroup.Item>)}
  </RadioGroup.Root>;
}

export function Progress({ value, label, className = '' }: { value: number; label: string; className?: string }) {
  const { reduced } = useStudioMotion();
  const bounded = Math.max(0, Math.min(100, value));
  return <ProgressPrimitive.Root value={bounded} aria-label={label} className={`studio-progress ${className}`}>
    <ProgressPrimitive.Indicator asChild><motion.div initial={false} animate={{ x: `${bounded - 100}%` }} transition={{ duration: reduced ? 0 : .35 }}/></ProgressPrimitive.Indicator>
  </ProgressPrimitive.Root>;
}

export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const id = useId();
  return <Accordion.Root type="single" collapsible defaultValue={defaultOpen ? id : undefined} className="studio-disclosure">
    <Accordion.Item value={id}>
      <Accordion.Header><Accordion.Trigger>{title}<CaretDown aria-hidden="true"/></Accordion.Trigger></Accordion.Header>
      <Accordion.Content className="disclosure-content"><div>{children}</div></Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>;
}

export function SplitText({ text }: { text: string }) {
  const { reduced } = useStudioMotion();
  return <span aria-label={text} className="split-text">
    {text.split(' ').map((word, index) => <span key={index} className="split-word" aria-hidden="true">
      <motion.span initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : .45, delay: reduced ? 0 : index * .045 }}>{word}</motion.span>{' '}
    </span>)}
  </span>;
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

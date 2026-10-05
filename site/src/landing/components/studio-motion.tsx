import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { useId } from 'react';
import { Switch as SwitchPrimitive } from 'radix-ui';

const MotionContext = createContext({ reduced: false, quiet: false, toggle: () => {} });
export const useStudioMotion = () => useContext(MotionContext);

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    update();
    return () => preference.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function StudioMotion({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const systemReduced = useSystemReducedMotion();
  const [quiet, setQuiet] = useState(() => {
    try { return localStorage.getItem('foundry.motion') === 'quiet'; } catch { return false; }
  });
  const reduced = quiet || !!systemReduced;
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'quiet' : 'studio';
  }, [reduced]);
  const toggle = () => setQuiet(value => {
    try { localStorage.setItem('foundry.motion', value ? 'studio' : 'quiet'); } catch { /* Optional preference storage. */ }
    return !value;
  });
  return <MotionContext.Provider value={{ reduced, quiet, toggle }}>
    <MotionConfig nonce={nonce} reducedMotion={reduced ? 'always' : 'user'} transition={{ duration: reduced ? 0 : .24, ease: [.22, 1, .36, 1] }}>
      {children}
    </MotionConfig>
  </MotionContext.Provider>;
}

export function MotionToggle() {
  const { reduced, quiet, toggle } = useStudioMotion();
  const id = useId();
  return <label className="motion-toggle" htmlFor={id} title={reduced && !quiet ? 'Your device requests reduced motion' : 'Reduce decorative motion'}>
    <SwitchPrimitive.Root id={id} checked={quiet} onCheckedChange={toggle} className="motion-switch" aria-label="Quiet motion">
      <SwitchPrimitive.Thumb className="motion-switch-thumb" />
    </SwitchPrimitive.Root>
    <span>Quiet motion</span>
  </label>;
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

const MotionContext = createContext({ reduced: false });
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
  const reduced = useSystemReducedMotion();
  return <MotionContext.Provider value={{ reduced }}>
    <MotionConfig nonce={nonce} reducedMotion={reduced ? 'always' : 'user'} transition={{ duration: reduced ? 0 : .24, ease: [.22, 1, .36, 1] }}>
      {children}
    </MotionConfig>
  </MotionContext.Provider>;
}

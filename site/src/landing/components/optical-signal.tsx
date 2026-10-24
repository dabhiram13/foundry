import { Component, lazy, Suspense, useEffect, useRef, useState, type PropsWithChildren } from 'react';

const FlutedGlass = lazy(() => import('./ui/fluted-glass'));

class GlassFallback extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function OpticalSignal() {
  const host = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element || !window.IntersectionObserver) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!context) return;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    let visible = false;
    const update = () => setActive(visible && !motion.matches && document.visibilityState === 'visible');
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); update(); });
    observer.observe(element);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <div className="optical-signal" aria-hidden="true" ref={host}>
    <div className="optical-art" />
    {active && <GlassFallback><Suspense fallback={null}><FlutedGlass /></Suspense></GlassFallback>}
    <div className="optical-caption"><span>FOUNDRY / 001</span><span>Bring the work into focus.</span></div>
  </div>;
}

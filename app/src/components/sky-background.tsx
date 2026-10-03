import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';
import { useStudioMotion } from './studio-motion';

export function SkyBackground() {
  const { reduced } = useStudioMotion();
  const canvas = useRef<HTMLCanvasElement>(null);
  const visible = useInView(canvas, { amount: .1 });
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const box = element.getBoundingClientRect();
      const context = element.getContext('2d');
      if (!context) return;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      element.width = Math.round(box.width * ratio);
      element.height = Math.round(box.height * ratio);
      context.scale(ratio, ratio);
      context.font = '10px monospace';
      for (let y = 0; y < box.height; y += 13) {
        for (let x = 0; x < box.width; x += 10) {
          const band = Math.sin(x / 170 + y / 60) + Math.sin(x / 90 - y / 75) * .45;
          const density = Math.max(0, 1 - Math.abs(Math.sin(y / 100 + band) * 3));
          if (density > .1) {
            context.fillStyle = `rgba(83,119,126,${density * .19})`;
            context.fillText('.:~+=*'[Math.floor(density * 5)], x, y);
          }
        }
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element || reduced || !visible || finished) return;
    const animation = element.animate([{ transform: 'translateX(-10px)' }, { transform: 'translateX(0)' }], { duration: 4800, easing: 'ease-out' });
    animation.onfinish = () => setFinished(true);
    const stop = () => { if (document.hidden) { animation.cancel(); setFinished(true); } };
    document.addEventListener('visibilitychange', stop);
    return () => { animation.cancel(); document.removeEventListener('visibilitychange', stop); };
  }, [reduced, visible, finished]);
  return <div className="sky-background" aria-hidden="true"><div className="sky-glow"/><canvas ref={canvas}/></div>;
}

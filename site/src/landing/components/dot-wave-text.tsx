import { useEffect, useRef } from 'react';

export function DotWaveText({ text }: { text: string }) {
  const root = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = root.current;
    const surface = canvas.current;
    const context = surface?.getContext('2d');
    if (!host || !surface || !context || !('letterSpacing' in context)) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let disposed = false;

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      host!.classList.remove('dither-active');
    }

    function play() {
      if (disposed || frame || motion.matches || document.hidden) return;
      const bounds = host!.getBoundingClientRect();
      if (!bounds.width || bounds.bottom < 0 || bounds.top > innerHeight) return;
      const style = getComputedStyle(host!);
      const width = Math.ceil(bounds.width);
      const height = Math.ceil(bounds.height) + 24;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      surface!.width = width * ratio;
      surface!.height = height * ratio;
      surface!.style.width = `${bounds.width}px`;
      surface!.style.height = `${height}px`;
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      const mask = document.createElement('canvas');
      mask.width = width;
      mask.height = height;
      const ink = mask.getContext('2d', { willReadFrequently: true });
      if (!ink) return;
      ink.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ink.letterSpacing = style.letterSpacing;
      ink.fillStyle = style.color;
      const metrics = ink.measureText(text);
      const ascent = metrics.fontBoundingBoxAscent;
      const descent = metrics.fontBoundingBoxDescent;
      const baseline = 12 + (bounds.height - ascent - descent) / 2 + ascent;
      ink.fillText(text, 0, baseline);
      const pixels = ink.getImageData(0, 0, width, height).data;
      const dots: { x: number; y: number; alpha: number }[] = [];
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const alpha = pixels[(y * width + x) * 4 + 3] / 255;
          if (alpha > .1) dots.push({ x, y, alpha });
        }
      }
      const started = performance.now();
      host!.classList.add('dither-active');
      function draw(now: number) {
        const progress = Math.min((now - started) / 1150, 1);
        const wave = -90 + progress * (width + 180);
        const band = 66;
        context!.clearRect(0, 0, width, height);
        context!.save();
        context!.beginPath();
        context!.rect(0, 0, Math.max(0, wave - band), height);
        context!.rect(Math.max(0, wave + band), 0, width, height);
        context!.clip();
        context!.drawImage(mask, 0, 0);
        context!.restore();
        context!.fillStyle = style.color;
        for (const dot of dots) {
          const distance = Math.abs(dot.x - wave) / band;
          if (distance >= 1) continue;
          const strength = Math.cos(distance * Math.PI / 2);
          const drift = Math.sin(dot.x * .13 + dot.y * .18 + progress * 9);
          context!.globalAlpha = dot.alpha;
          context!.beginPath();
          context!.arc(dot.x + drift * strength * 3, dot.y + drift * strength * 5, .8 + .25 * (1 - strength), 0, Math.PI * 2);
          context!.fill();
        }
        context!.globalAlpha = 1;
        if (progress < 1) frame = requestAnimationFrame(draw);
        else stop();
      }
      frame = requestAnimationFrame(draw);
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      play();
      observer.disconnect();
    }, { threshold: .7 });
    document.fonts.ready.then(() => { if (!disposed) observer.observe(host); });
    const resize = new ResizeObserver(stop);
    resize.observe(host);
    const visibility = () => { if (document.hidden) stop(); };
    host.addEventListener('pointerenter', play);
    motion.addEventListener('change', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      resize.disconnect();
      host.removeEventListener('pointerenter', play);
      motion.removeEventListener('change', stop);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [text]);

  return <span className="dither-text" ref={root}><span>{text}</span><canvas ref={canvas} aria-hidden="true" /></span>;
}

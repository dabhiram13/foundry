import { useEffect, useRef, useState } from 'react';

const links = [
  { label: 'How it works', href: '#landing-workflow' },
  { label: 'Install', href: '#landing-install' },
  { label: 'Docs', href: '/docs/' },
];

export function HeaderNav() {
  const root = useRef<HTMLElement>(null);
  const anchors = useRef<(HTMLAnchorElement | null)[]>([]);
  const [current, setCurrent] = useState(-1);
  const [hovered, setHovered] = useState<number | null>(null);
  const selected = hovered ?? current;
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const anchor = anchors.current[selected];
    const measure = () => setIndicator(anchor ? { left: anchor.offsetLeft, width: anchor.offsetWidth } : { left: 0, width: 0 });
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [selected]);

  useEffect(() => {
    let frame = 0;
    const header = root.current?.closest('header');
    function update() {
      frame = 0;
      const sections = links.slice(0, 2).map(link => document.querySelector(link.href));
      let active = -1;
      sections.forEach((section, index) => {
        const bounds = section?.getBoundingClientRect();
        if (bounds && bounds.top <= 170 && bounds.bottom > 130) active = index;
      });
      setCurrent(active);
      const maximum = document.documentElement.scrollHeight - innerHeight;
      header?.style.setProperty('--reading-progress', String(maximum > 0 ? Math.max(0, Math.min(scrollY / maximum, 1)) : 0));
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    update();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); removeEventListener('scroll', schedule); removeEventListener('resize', schedule); };
  }, []);

  return <nav className="desktop-nav" aria-label="Main navigation" ref={root} onMouseLeave={() => setHovered(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(null); }}>
    <span className="nav-ink" aria-hidden="true" style={{ width: indicator.width, transform: `translateX(${indicator.left}px)`, opacity: selected < 0 ? 0 : 1 }} />
    {links.map((link, index) => <a key={link.href} href={link.href} ref={node => { anchors.current[index] = node; }} aria-current={current === index ? 'location' : undefined} onMouseEnter={() => setHovered(index)} onFocus={() => setHovered(index)}>{link.label}</a>)}
  </nav>;
}

// Radial composition adapted from Animate UI; finite motion and role controls are Foundry additions.
import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { RotateCcw as ArrowCounterClockwise, Pause } from 'lucide-react';
import { RoleAvatar } from './specialists';
import { Button } from './ui/button';
import { useStudioMotion } from './studio-motion';

const crew = [
  { id: 'market-researcher', name: 'Researcher', detail: 'Explores the problem, existing alternatives and what still needs evidence.' },
  { id: 'planner', name: 'Planner', detail: 'Keeps the first version focused and makes the next step clear.' },
  { id: 'designer', name: 'Designer', detail: 'Shapes the screens and interactions around the product you want to make.' },
  { id: 'backend', name: 'Builder', detail: 'Builds small pieces, checks the result and repairs what fails.' },
  { id: 'quality-gate', name: 'Reviewer', detail: 'Checks the work against the plan. A role description is not a passing test.' },
  { id: 'complete', name: 'Ship guide', detail: 'Prepares a clear handoff. Publishing is still your decision.' },
];

export function SpecialistIntro() {
  const { reduced } = useStudioMotion();
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const visible = useInView(root, { amount: .3 });
  const played = useRef(false);
  const [width, setWidth] = useState(320);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('Select a portrait to meet the role.');
  const replay = () => { setRun(value => value + 1); setPlaying(true); setAnnouncement('Introducing the specialists.'); };
  const stop = () => { setPlaying(false); setAnnouncement('Motion stopped. Every portrait still works.'); };
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || reduced) { setPlaying(false); return; }
    if (!played.current) { played.current = true; replay(); }
  }, [visible, reduced]);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => { setPlaying(false); setAnnouncement('Settled. Select a portrait to meet the role.'); }, 1400);
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hide);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hide); };
  }, [playing, run]);
  const active = selected === null ? null : crew[selected];
  return <div className="specialist-intro" ref={root} data-playing={playing && !reduced}>
    <div className="radial-stage" ref={stage} role="group" aria-label="Meet the specialists">
      <div className="radial-track" aria-hidden="true"/>
      <div className="radial-core" aria-hidden="true"><img src="/assets/foundry-mark.svg" alt=""/><strong>Your idea</strong><span>at the center</span></div>
      {crew.map((role, index) => {
        const angle = (index * 60 - 90) * Math.PI / 180;
        const x = Math.cos(angle) * 36, y = Math.sin(angle) * 36;
        return <div className="radial-slot" key={role.id} style={{ left: `${50 + x}%`, top: `${50 + y}%` }}>
          <motion.div key={run} initial={false} animate={playing && !reduced ? { x: [-x * width / 140, 0], y: [-y * width / 140, 0], opacity: [.3, 1], scale: [.85, 1] } : { x: 0, y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: playing && !reduced ? .65 : 0, delay: playing && !reduced ? index * .07 : 0, ease: [.22, 1, .36, 1] }}>
            <button type="button" className="radial-person" aria-pressed={selected === index}
              onPointerDown={event => { if (event.button === 0) { stop(); setSelected(index); event.currentTarget.focus({ preventScroll: true }); } }}
              onFocus={() => { if (playing) stop(); }} onClick={() => { stop(); setSelected(index); }}>
              <RoleAvatar role={role.id} size={58}/><span>{role.name}</span>
            </button>
          </motion.div>
        </div>;
      })}
    </div>
    <div className="radial-description" role="status"><strong>{active?.name || 'Different skills. One product.'}</strong><p>{active?.detail || 'Select a portrait to meet the role. Roles guide the AI; this is not live activity.'}</p></div>
    <div className="radial-controls">
      <Button type="button" variant="ghost" size="sm" aria-disabled={reduced} onClick={() => { if (!reduced) { if (playing) stop(); else replay(); } }}>
        {playing && !reduced ? <><Pause aria-hidden="true"/>Stop</> : <><ArrowCounterClockwise aria-hidden="true"/>Replay intro</>}
      </Button>
      <span className="sr-only" role="status">{reduced ? 'Reduced motion. Every portrait still works.' : announcement}</span>
    </div>
  </div>;
}

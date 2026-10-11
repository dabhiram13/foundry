import { useEffect, useRef, useState } from 'react';
import type { SceneController } from './scene-renderer';

export function SpecialistScene() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<SceneController | null>(null);
  const [phase, setPhase] = useState<
    'poster' | 'loading' | 'ready' | 'unavailable'
  >('poster');
  const [interactive, setInteractive] = useState(true);
  const [canvasGeneration, setCanvasGeneration] = useState(0);

  useEffect(() => {
    const element = host.current;
    const target = canvas.current;
    if (
      !element ||
      !target ||
      typeof IntersectionObserver === 'undefined' ||
      typeof ResizeObserver === 'undefined'
    )
      return;
    const capability = matchMedia(
      '(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & { saveData?: boolean };
      }
    ).connection;
    let disposed = false;
    let loading = false;
    let visible = false;
    let failed = false;
    function update() {
      if (disposed) return;
      const eligible = capability.matches && !connection?.saveData;
      if (!eligible) {
        if (controller.current) {
          controller.current.dispose(true);
          controller.current = null;
          setCanvasGeneration((value) => value + 1);
        }
        setPhase('poster');
        return;
      }
      controller.current?.setVisible(visible);
      if (
        !visible ||
        document.hidden ||
        loading ||
        failed ||
        controller.current
      )
        return;
      loading = true;
      setPhase('loading');
      import('./scene-renderer')
        .then(({ mountScene }) => {
          if (
            disposed ||
            !capability.matches ||
            connection?.saveData ||
            !visible ||
            document.hidden
          )
            return;
          controller.current = mountScene(canvas.current!, element!, () => {
            failed = true;
            controller.current?.dispose();
            controller.current = null;
            if (!disposed) setPhase('unavailable');
          });
          controller.current.setVisible(visible);
          setPhase('ready');
        })
        .catch(() => {
          failed = true;
          if (!disposed) setPhase('unavailable');
        })
        .finally(() => {
          loading = false;
          update();
        });
    }
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        update();
      },
      { rootMargin: '120px' },
    );
    observer.observe(element);
    capability.addEventListener('change', update);
    connection?.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      disposed = true;
      observer.disconnect();
      capability.removeEventListener('change', update);
      connection?.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
      controller.current?.dispose(true);
      controller.current = null;
    };
  }, [canvasGeneration]);

  useEffect(() => {
    controller.current?.setInteractive(interactive);
  }, [interactive, phase]);

  return (
    <div
      ref={host}
      className={`specialist-scene ${phase === 'ready' ? 'scene-ready' : ''}`}
    >
      <div className="scene-poster" aria-hidden="true">
        <div className="scene-tray">
          <div className="scene-keys">
            {['Research', 'Plan', 'Design', 'Build', 'Review', 'Handoff'].map(
              (name, index) => (
                <span className="scene-key" key={name}>
                  <small>0{index + 1}</small>
                  {name}
                </span>
              ),
            )}
          </div>
          <span className="scene-foundry">foundry</span>
        </div>
      </div>
      <canvas ref={canvas} key={canvasGeneration} aria-hidden="true" />
      <div className="scene-caption">
        <span>
          {phase === 'ready'
            ? 'Original 3D illustration · not a live workspace'
            : 'Workflow illustration · static view'}
        </span>
        {phase === 'ready' && (
          <button
            className="scene-control"
            aria-pressed={interactive}
            onClick={() => setInteractive((value) => !value)}
          >
            {interactive ? 'Pause 3D interaction' : 'Enable 3D interaction'}
          </button>
        )}
      </div>
    </div>
  );
}

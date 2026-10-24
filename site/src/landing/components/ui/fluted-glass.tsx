import { FlutedGlass as Shader } from '@paper-design/shaders-react';
import { useEffect, useRef } from 'react';

export default function FlutedGlass() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    const fallback = () => { if (element) element.hidden = true; };
    element?.addEventListener('webglcontextlost', fallback, true);
    return () => element?.removeEventListener('webglcontextlost', fallback, true);
  }, []);
  return <div className="optical-enhancement" ref={host}>
    <Shader width="100%" height="100%" image="/assets/fluted-signal.svg" speed={0}
      colorBack="#111016" colorShadow="#15111e" colorHighlight="#e6dbff"
      size={0.62} shadows={0.16} highlights={0.12} shape="lines" angle={0}
      distortionShape="prism" distortion={0.22} shift={0} stretch={0} blur={0}
      edges={0.25} margin={0} grainMixer={0} grainOverlay={0} fit="cover" />
  </div>;
}

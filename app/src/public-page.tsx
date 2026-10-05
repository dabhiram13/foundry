import { Landing } from './components/landing';
import { StudioMotion } from './components/studio-motion';
import { TooltipProvider } from './components/ui/tooltip';

export function PublicPage() {
  return <StudioMotion><TooltipProvider><Landing /></TooltipProvider></StudioMotion>;
}

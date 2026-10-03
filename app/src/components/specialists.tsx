import type { BotAvatarProps } from 'bot-avatars';

type AvatarRecipe = Pick<BotAvatarProps, 'type' | 'color' | 'hat' | 'glasses' | 'headphones' | 'bowTie'>;
type RoleGroup = 'Research and opportunity' | 'Planning and critique' | 'Design and UX' | 'Data and implementation' | 'Testing and review' | 'Operating evidence and handoff';

export type Specialist = {
  id: string;
  label: string;
  description: string;
  group: RoleGroup;
  stage: 'research' | 'scope' | 'design' | 'build' | 'verify' | 'release';
  image: string;
  avatar: AvatarRecipe;
};

/** Role identities; legacy portrait recipes remain for the asset-regeneration tool. */
export const roleCatalog = [
  { id: 'market-researcher', label: 'Market researcher', description: 'Researches customer segments and alternatives.', group: 'Research and opportunity', stage: 'research', image: '/assets/bots/market-researcher.png', avatar: { type: 'drop', color: '#68BCEF', glasses: 'round' } },
  { id: 'social-signal', label: 'Social signal', description: 'Finds customer pain and purchasing signals.', group: 'Research and opportunity', stage: 'research', image: '/assets/bots/social-signal.png', avatar: { type: 'clover', color: '#A0DBBA', headphones: true } },
  { id: 'trend-validator', label: 'Trend validator', description: 'Challenges demand and switching assumptions.', group: 'Research and opportunity', stage: 'research', image: '/assets/bots/trend-validator.png', avatar: { type: 'star', color: '#F5CF78' } },
  { id: 'discovery-critic', label: 'Discovery critic', description: 'Reviews evidence and scope traceability.', group: 'Research and opportunity', stage: 'research', image: '/assets/bots/discovery-critic.png', avatar: { type: 'hexagon', color: '#C1A0E5', glasses: 'round' } },
  { id: 'tool-scout', label: 'Tool scout', description: 'Evaluates useful services and APIs.', group: 'Research and opportunity', stage: 'research', image: '/assets/bots/tool-scout.png', avatar: { type: 'square', color: '#79C9DF', hat: 'beanie' } },
  { id: 'skill-scout', label: 'Skill scout', description: 'Matches focused skills to demonstrated gaps.', group: 'Research and opportunity', stage: 'research', image: '/assets/bots/skill-scout.png', avatar: { type: 'star', color: '#BEA0E5', bowTie: true } },
  { id: 'planner', label: 'Planner', description: 'Plans interdependent work and handoffs.', group: 'Planning and critique', stage: 'scope', image: '/assets/bots/planner.png', avatar: { type: 'pill', color: '#F2B992', glasses: 'square' } },
  { id: 'architect', label: 'Architect', description: 'Advises on system structure and tradeoffs.', group: 'Planning and critique', stage: 'scope', image: '/assets/bots/architect.png', avatar: { type: 'droid', color: '#97B3EE' } },
  { id: 'critic', label: 'Critic', description: 'Reviews plans and code for material risks.', group: 'Planning and critique', stage: 'scope', image: '/assets/bots/critic.png', avatar: { type: 'triangle', color: '#F29D99' } },
  { id: 'spec-critic', label: 'Spec critic', description: 'Checks scope, buildability and testability.', group: 'Planning and critique', stage: 'scope', image: '/assets/bots/spec-critic.png', avatar: { type: 'square', color: '#C5B1E8', glasses: 'round' } },
  { id: 'designer', label: 'Designer', description: 'Builds the adopted product experience.', group: 'Design and UX', stage: 'design', image: '/assets/bots/designer.png', avatar: { type: 'flower', color: '#EB9EB9', hat: 'beret' } },
  { id: 'ux-critic', label: 'UX critic', description: 'Reviews customer journeys and UX handoffs.', group: 'Design and UX', stage: 'design', image: '/assets/bots/ux-critic.png', avatar: { type: 'circle', color: '#A1D8B8', glasses: 'round' } },
  { id: 'design-evaluator', label: 'Design evaluator', description: 'Checks rendered design and accessibility.', group: 'Design and UX', stage: 'design', image: '/assets/bots/design-evaluator.png', avatar: { type: 'clover', color: '#BAA0E0', glasses: 'square' } },
  { id: 'logo-designer', label: 'Logo designer', description: 'Develops and inspects visual identity.', group: 'Design and UX', stage: 'design', image: '/assets/bots/logo-designer.png', avatar: { type: 'puddle', color: '#F2A297', hat: 'beret' } },
  { id: 'db-architect', label: 'DB architect', description: 'Designs schemas and data access boundaries.', group: 'Data and implementation', stage: 'build', image: '/assets/bots/db-architect.png', avatar: { type: 'pill', color: '#92AFE9', bowTie: true } },
  { id: 'backend', label: 'Backend', description: 'Implements server behavior and background work.', group: 'Data and implementation', stage: 'build', image: '/assets/bots/backend.png', avatar: { type: 'square', color: '#80C8B8', headphones: true } },
  { id: 'connector', label: 'Connector', description: 'Connects interface and service data contracts.', group: 'Data and implementation', stage: 'build', image: '/assets/bots/connector.png', avatar: { type: 'cloud', color: '#9ACFDD', headphones: true } },
  { id: 'ts-expert', label: 'TypeScript expert', description: 'Resolves types while preserving runtime behavior.', group: 'Data and implementation', stage: 'build', image: '/assets/bots/ts-expert.png', avatar: { type: 'hexagon', color: '#B4A1E0', glasses: 'shades' } },
  { id: 'build-fixer', label: 'Build fixer', description: 'Repairs build errors with focused changes.', group: 'Data and implementation', stage: 'build', image: '/assets/bots/build-fixer.png', avatar: { type: 'hexagon', color: '#EBA295', hat: 'beanie' } },
  { id: 'slop-cleaner', label: 'Slop cleaner', description: 'Removes needless code while protecting behavior.', group: 'Data and implementation', stage: 'build', image: '/assets/bots/slop-cleaner.png', avatar: { type: 'ghost', color: '#A0DBBF', bowTie: true } },
  { id: 'api-tester', label: 'API tester', description: 'Exercises API boundaries and integrations.', group: 'Testing and review', stage: 'verify', image: '/assets/bots/api-tester.png', avatar: { type: 'droid', color: '#88BFE9', glasses: 'round' } },
  { id: 'flow-tester', label: 'Flow tester', description: 'Checks real user journeys and recovery.', group: 'Testing and review', stage: 'verify', image: '/assets/bots/flow-tester.png', avatar: { type: 'clover', color: '#BEA0E3', hat: 'beanie' } },
  { id: 'perf-tester', label: 'Performance tester', description: 'Measures performance and investigates bottlenecks.', group: 'Testing and review', stage: 'verify', image: '/assets/bots/perf-tester.png', avatar: { type: 'star', color: '#F3CF76', glasses: 'shades' } },
  { id: 'backend-evaluator', label: 'Backend evaluator', description: 'Reviews service contracts and exercised behavior.', group: 'Testing and review', stage: 'verify', image: '/assets/bots/backend-evaluator.png', avatar: { type: 'mech', color: '#88CBBE', glasses: 'square' } },
  { id: 'quality-gate', label: 'Quality gate', description: 'Reviews acceptance evidence independently.', group: 'Testing and review', stage: 'verify', image: '/assets/bots/quality-gate.png', avatar: { type: 'alien', color: '#88CAA4', glasses: 'square' } },
  { id: 'security-auditor', label: 'Security auditor', description: 'Investigates security boundaries and risks.', group: 'Testing and review', stage: 'verify', image: '/assets/bots/security-auditor.png', avatar: { type: 'cat', color: '#B5A2DC', glasses: 'shades' } },
  { id: 'sentry-analyst', label: 'Sentry analyst', description: 'Investigates reported errors and impact.', group: 'Operating evidence and handoff', stage: 'release', image: '/assets/bots/sentry-analyst.png', avatar: { type: 'blob', color: '#EFA2BA', headphones: true } },
  { id: 'complete', label: 'Complete', description: 'Prepares a handoff from current evidence.', group: 'Operating evidence and handoff', stage: 'release', image: '/assets/bots/complete.png', avatar: { type: 'pebble', color: '#A8B3E9', hat: 'party', bowTie: true } },
] as const satisfies readonly Specialist[];

export type SpecialistId = (typeof roleCatalog)[number]['id'];

export function getSpecialist(role: string): Specialist | undefined {
  const id = role.replace(/^foundry[-_]/, '');
  return roleCatalog.find(specialist => specialist.id === id);
}

type RoleAvatarProps = {
  role: string;
  size?: number;
  active?: boolean;
  className?: string;
  /** Use when the role label is already visible beside the image. */
  decorative?: boolean;
};

export function RoleAvatar({ role, size = 36, active = false, className = '', decorative = true }: RoleAvatarProps) {
  const specialist = getSpecialist(role);
  if (!specialist) return null;
  return <img
    className={`role-avatar ${className}`.trim()}
    src={specialist.image}
    width={size}
    height={size}
    style={{ width: size, height: size, flexShrink: 0, objectFit: 'contain' }}
    alt={decorative ? '' : `${specialist.label} specialist${active ? ', active' : ''}`}
    aria-hidden={decorative || undefined}
    data-role={specialist.id}
    data-active={active ? 'true' : undefined}
    decoding="async"
    draggable={false}
  />;
}

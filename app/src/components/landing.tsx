import { useState } from 'react';
import { ArrowDown, ArrowRight, ChevronDown, FileCheck2, FileText, Laptop, LockKeyhole, Sparkles, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoleAvatar, roleCatalog } from '@/components/specialists';

type LandingProps = { onEnter: (create?: boolean) => void };

const landingStages = [
  { id: 'research', label: 'Research', role: 'market-researcher', specialist: 'Market researcher', title: 'Understand the problem.', description: 'Explore the people, alternatives, and assumptions behind your idea before deciding what to build.', output: 'Research notes and a clearer direction', review: false },
  { id: 'scope', label: 'Scope', role: 'planner', specialist: 'Planner', title: 'Choose a useful first version.', description: 'Set the boundaries, priorities, and acceptance criteria. Review the exact scope document before the work continues.', output: 'A scope you have reviewed and approved', review: true },
  { id: 'design', label: 'Design', role: 'designer', specialist: 'Designer', title: 'Give the idea a clear shape.', description: 'Work through the journeys and design decisions. Your approval of the exact design document unlocks the build.', output: 'Journeys and an approved design direction', review: true },
  { id: 'build', label: 'Build', role: 'backend', specialist: 'Backend', title: 'Make the agreed product.', description: 'Your selected runtime works from the approved decisions, with relevant specialist guidance and a separate product workspace.', output: 'Product code, documents, and implementation work', review: false },
  { id: 'verify', label: 'Verify', role: 'quality-gate', specialist: 'Quality gate', title: 'Ask for the evidence.', description: 'Run the configured product checks and inspect the saved results. Failed or missing evidence stops progress.', output: 'Current check results and saved evidence', review: false },
  { id: 'release', label: 'Release', role: 'complete', specialist: 'Complete', title: 'Take the next step, deliberately.', description: 'Review the local build record and handoff. You decide where and when to publish the product.', output: 'A local handoff, ready for your review', review: false },
] as const;

const featuredRoleIds = ['market-researcher', 'designer', 'architect', 'backend', 'quality-gate', 'security-auditor', 'connector', 'flow-tester'];
const landingRoles = [
  ...featuredRoleIds.flatMap(id => roleCatalog.filter(role => role.id === id)),
  ...roleCatalog.filter(role => !featuredRoleIds.includes(role.id)),
];
const stageLabel = (stage: string) => landingStages.find(item => item.id === stage)?.label ?? stage;

function scrollToSection(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  section.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  section.focus({ preventScroll: true });
}

export function Landing({ onEnter }: LandingProps) {
  const [showAllRoles, setShowAllRoles] = useState(false);

  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main" onClick={event => { event.preventDefault(); scrollToSection('landing-main'); }}>Skip to content</a>
      <header className="landing-header">
        <div className="landing-shell landing-header-inner">
          <a className="landing-brand" href="#welcome" aria-label="Foundry home">
            <img src="/assets/foundry-mark.svg" width="32" height="32" alt="" />
            <span>Foundry</span>
          </a>
          <nav className="landing-nav" aria-label="Introduction">
            <Button variant="ghost" onClick={() => scrollToSection('landing-workflow')}>How it works</Button>
            <Button variant="ghost" onClick={() => scrollToSection('landing-specialists')}>The specialists</Button>
          </nav>
          <Button variant="outline" className="landing-workspace-link" onClick={() => onEnter()}>
            Open workspace <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-shell landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><Workflow aria-hidden="true" /> Your local software factory</p>
            <h1 id="landing-title" tabIndex={-1}>A good idea.<br />A clear way<br className="landing-title-break" /> to build it.</h1>
            <p className="landing-intro">Bring the idea. Shape the decisions. Build with a workspace that keeps the research, code, and evidence together.</p>
            <div className="landing-hero-actions">
              <Button size="lg" className="landing-primary" onClick={() => onEnter(true)}>Start a product <ArrowRight aria-hidden="true" /></Button>
              <Button variant="ghost" size="lg" onClick={() => scrollToSection('landing-workflow')}>See how it works <ArrowDown aria-hidden="true" /></Button>
            </div>
            <p className="landing-local-note"><Laptop aria-hidden="true" /> Your direction. Your local workspace.</p>
          </div>

          <div className="landing-guide" id="landing-workflow" tabIndex={-1}>
            <div className="landing-guide-heading">
              <span><Workflow aria-hidden="true" /> Explore the workflow</span>
              <span className="landing-guide-caption">Six connected stages</span>
            </div>
            <Tabs defaultValue="research" className="landing-stage-tabs">
              <TabsList className="landing-stage-list" aria-label="Explore the six Foundry stages">
                {landingStages.map((stage, index) => <TabsTrigger className="landing-stage-tab" key={stage.id} value={stage.id}>
                  <span className="landing-stage-number">0{index + 1}</span><span>{stage.label}</span>
                </TabsTrigger>)}
              </TabsList>
              {landingStages.map((stage, index) => <TabsContent key={stage.id} value={stage.id} className="landing-stage-content">
                <div className="landing-stage-topline">
                  <span className="landing-stage-position">0{index + 1} <span>/ 06</span></span>
                  <RoleAvatar role={stage.role} size={64} active={false} />
                </div>
                <div className="landing-stage-copy">
                  <h2>{stage.title}</h2>
                  <p>{stage.description}</p>
                </div>
                <div className="landing-stage-output"><FileText aria-hidden="true" /><span><small>What moves forward</small>{stage.output}</span></div>
                <div className="landing-stage-footer">
                  <span>{stage.specialist} guidance</span>
                  {stage.review ? <span className="landing-owner-gate"><LockKeyhole aria-hidden="true" /> Your approval</span> : <span className="landing-guide-note">Workflow guide</span>}
                </div>
              </TabsContent>)}
            </Tabs>
          </div>
        </section>

        <section className="landing-principles" aria-labelledby="landing-principles-title">
          <div className="landing-shell">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">Room for the whole process</p>
              <h2 id="landing-principles-title">Less scattered work.<br />More considered progress.</h2>
            </div>
            <div className="landing-principle-grid">
              <article className="landing-principle">
                <FileText aria-hidden="true" />
                <h3>The decisions stay with the work.</h3>
                <p>Each product has its own code, documents, settings, and evidence. Return to the context behind what you are building.</p>
              </article>
              <article className="landing-principle">
                <LockKeyhole aria-hidden="true" />
                <h3>You approve the important turns.</h3>
                <p>Review the exact scope and design before continuing. If the document changes, the decision comes back to you.</p>
              </article>
              <article className="landing-principle">
                <FileCheck2 aria-hidden="true" />
                <h3>Progress comes with evidence.</h3>
                <p>Configured checks and saved results support the handoff. A completion message alone cannot pass verification.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="landing-specialists" className="landing-shell landing-specialists" tabIndex={-1} aria-labelledby="landing-specialists-title">
          <div className="landing-specialists-heading">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">Different perspectives. One product.</p>
              <h2 id="landing-specialists-title">Meet the<br />specialist bench.</h2>
            </div>
            <div className="landing-specialists-intro">
              <p>Research, design, implementation, and a second look. Foundry includes {roleCatalog.length} role configurations to guide the work that your product needs.</p>
              <p className="landing-specialists-note">The coordinator selects relevant roles. Available roles are not a count of running agents; execution depends on your selected runtime.</p>
            </div>
          </div>
          <div className="landing-role-grid" aria-label="Featured specialist roles">
            {landingRoles.slice(0, 8).map(role => <div className="landing-role" key={role.id}>
              <RoleAvatar role={role.id} size={40} active={false} />
              <div><h3>{role.label}</h3><p>{stageLabel(role.stage)}</p></div>
            </div>)}
          </div>
          <div id="landing-more-roles" className={`landing-role-expansion${showAllRoles ? ' is-open' : ''}`} inert={!showAllRoles} aria-hidden={!showAllRoles}>
            <div className="landing-role-expansion-inner">
              <div className="landing-role-grid landing-extra-roles">
                {landingRoles.slice(8).map(role => <div className="landing-role" key={role.id}>
                  <RoleAvatar role={role.id} size={40} active={false} />
                  <div><h3>{role.label}</h3><p>{stageLabel(role.stage)}</p></div>
                </div>)}
              </div>
            </div>
          </div>
          <div className="landing-roster-footer">
            <Button variant="outline" className="landing-roster-toggle" aria-expanded={showAllRoles} aria-controls="landing-more-roles" onClick={() => setShowAllRoles(value => !value)}>
              {showAllRoles ? 'Show fewer roles' : `Meet all ${roleCatalog.length} roles`}<ChevronDown aria-hidden="true" className={showAllRoles ? 'is-open' : ''} />
            </Button>
            <span>Specialist settings live with each product.</span>
          </div>
        </section>

        <section className="landing-start" aria-labelledby="landing-start-title">
          <div className="landing-shell landing-start-inner">
            <div>
              <p className="landing-eyebrow"><Sparkles aria-hidden="true" /> Begin with the useful part</p>
              <h2 id="landing-start-title">What do you want to make?</h2>
              <p>A name and an idea are enough to open your next workspace.</p>
            </div>
            <Button size="lg" className="landing-primary" onClick={() => onEnter(true)}>Start a product <ArrowRight aria-hidden="true" /></Button>
          </div>
        </section>
      </main>

      <footer className="landing-shell landing-footer">
        <span className="landing-footer-brand"><img src="/assets/foundry-mark.svg" width="24" height="24" alt="" /> Foundry</span>
        <p>From an idea to a local handoff. The next move is yours.</p>
        <Button variant="ghost" onClick={() => onEnter()}>Open workspace <ArrowRight aria-hidden="true" /></Button>
      </footer>
    </div>
  );
}

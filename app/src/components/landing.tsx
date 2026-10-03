import { useState } from 'react';
import { ArrowDown, ArrowRight, Check, CaretDown as ChevronDown, Circle, Code as Code2, ClipboardText as FileCheck2, FileText, Folder, Laptop, LockKey as LockKeyhole, Sparkle as Sparkles, FlowArrow as Workflow } from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RoleAvatar, roleCatalog } from '@/components/specialists';

type LandingProps = { onEnter: (create?: boolean) => void };

const landingStages = [
  { id: 'research', label: 'Research', role: 'market-researcher', specialist: 'Market researcher', title: 'Understand the problem.', description: 'Find out who has this problem, what they use today, and what is still unknown.', output: 'Research notes', review: false },
  { id: 'scope', label: 'Plan', role: 'planner', specialist: 'Planner', title: 'Pick the first version.', description: 'A short plan: who it is for, what is in and out, and how you will know it works. Nothing is built until you approve it.', output: 'A plan you approved', review: true },
  { id: 'design', label: 'Design', role: 'designer', specialist: 'Designer', title: 'Give the idea a clear shape.', description: 'Sketch the screens, steps, and edge cases. You approve the design before the build starts.', output: 'A design you approved', review: true },
  { id: 'build', label: 'Build', role: 'backend', specialist: 'Backend', title: 'Build it.', description: 'The AI writes the code from your plan and design, in a separate folder with its own Git history.', output: 'Working code', review: false },
  { id: 'verify', label: 'Test', role: 'quality-gate', specialist: 'Quality gate', title: 'Make sure it works.', description: 'Run the product’s real tests. If they fail, Foundry stops and tells you why.', output: 'Test results', review: false },
  { id: 'release', label: 'Ship', role: 'complete', specialist: 'Complete', title: 'Ship when you are ready.', description: 'Read a summary of what was built and tested. You decide where and when to publish.', output: 'A ship summary', review: false },
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
            <Button variant="ghost" onClick={() => scrollToSection('landing-specialists')}>The roles</Button>
          </nav>
          <Button variant="outline" className="landing-workspace-link" onClick={() => onEnter()}>
            Open workspace <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-shell landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><Workflow aria-hidden="true" /> Your local product studio</p>
            <h1 id="landing-title" tabIndex={-1}>A good idea.<br />A clear way to build it.</h1>
            <p className="landing-intro">Describe an idea. Foundry researches it, plans it with you, builds it, and tests it, all on your computer.</p>
            <div className="landing-hero-actions">
              <Button size="lg" className="landing-primary" onClick={() => onEnter(true)}>Start a product <ArrowRight aria-hidden="true" /></Button>
              <Button variant="ghost" size="lg" onClick={() => scrollToSection('landing-workflow')}>See how it works <ArrowDown aria-hidden="true" /></Button>
            </div>
            <p className="landing-local-note"><Laptop aria-hidden="true" /> Runs on your computer. Your code stays yours.</p>
          </div>

        </section>

        <section className="landing-preview" aria-label="Example product workspace">
          <div className="landing-shell">
            <p className="preview-caption">An example of how your work comes together</p>
            <div className="preview-window">
              <div className="preview-heading"><h2>Client portal</h2><span className="preview-tag">Plan review · example</span></div>
              <div className="preview-steps" aria-label="Example progress: Research done, Plan needs review, Design and later steps not started">{landingStages.map((stage,index)=><span key={stage.id} className={index===1?'preview-current':''}>{index===0?<Check aria-hidden="true"/>:<span>{index+1}</span>}{stage.label}</span>)}</div>
              <div className="preview-layout">
                <article className="preview-document">
                  <p className="landing-eyebrow"><FileText aria-hidden="true"/>The first version</p>
                  <h3>A calmer home for client work.</h3>
                  <p>A small portal for independent studios and their clients. One place for project updates, shared files and clear approvals.</p>
                  <h4>Keep it focused</h4>
                  <ul><li><Check aria-hidden="true"/>A page for each client project</li><li><Check aria-hidden="true"/>Updates and shared files in one place</li><li><Check aria-hidden="true"/>A simple way to approve the latest work</li></ul>
                  <div className="preview-decision"><LockKeyhole aria-hidden="true"/><p>You review the full plan before any code is built.</p></div>
                </article>
                <aside className="preview-context"><h4>For this step</h4>{['planner','spec-critic'].map(id=><div key={id}><RoleAvatar role={id} size={44}/><span>{roleCatalog.find(role=>role.id===id)?.label}<small>{id==='planner'?'Keeps the first version focused':'Checks the plan’s gaps'}</small></span></div>)}<p>Specialist guidance, not a live agent roster.</p><h4>Saved with the product</h4><span className="preview-saved"><FileText aria-hidden="true"/>Research notes</span><span className="preview-saved"><FileText aria-hidden="true"/>Plan to review</span></aside>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-shell landing-workflow-section">
          <div className="landing-section-heading"><p className="landing-eyebrow">From first thought to first version</p><h2>Small steps.<br/>A working product.</h2><p>You steer the plan and the design. Foundry handles the work in between.</p></div>
          <div className="landing-guide" id="landing-workflow" tabIndex={-1}>
            <div className="landing-guide-heading">
              <span><Workflow aria-hidden="true" /> Explore the workflow</span>
              <span className="landing-guide-caption">Six steps</span>
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
                  <RoleAvatar role={stage.role} size={40} active={false} />
                </div>
                <div className="landing-stage-copy">
                  <h2>{stage.title}</h2>
                  <p>{stage.description}</p>
                </div>
                <div className="landing-stage-output"><FileText aria-hidden="true" /><span><small>You get</small>{stage.output}</span></div>
                <div className="landing-stage-footer">
                  <span>Led by the {stage.specialist.toLowerCase()}</span>
                  {stage.review ? <span className="landing-owner-gate"><LockKeyhole aria-hidden="true" /> Your approval</span> : <span className="landing-guide-note">Automatic</span>}
                </div>
              </TabsContent>)}
            </Tabs>
          </div>
        </section>

        <section className="landing-principles" aria-labelledby="landing-principles-title">
          <div className="landing-shell">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">How it feels</p>
              <h2 id="landing-principles-title">You make the calls.<br />Foundry does the work.</h2>
            </div>
            <div className="landing-principle-grid">
              <article className="landing-principle">
                <FileText aria-hidden="true" />
                <h3>Everything in one folder.</h3>
                <p>Each product has its own code, notes, settings, and test results, so you can always see why something was built.</p>
              </article>
              <article className="landing-principle">
                <LockKeyhole aria-hidden="true" />
                <h3>You approve the big decisions.</h3>
                <p>Read the plan and the design before anything is built. If either changes, Foundry asks you again.</p>
              </article>
              <article className="landing-principle">
                <FileCheck2 aria-hidden="true" />
                <h3>Done means tested.</h3>
                <p>A step only counts as finished when the product’s real tests pass. Saying “done” is not enough.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="landing-specialists" className="landing-shell landing-specialists" tabIndex={-1} aria-labelledby="landing-specialists-title">
          <div className="landing-specialists-heading">
            <div className="landing-section-heading">
              <p className="landing-eyebrow">The team</p>
              <h2 id="landing-specialists-title">Meet the<br />roles.</h2>
            </div>
            <div className="landing-specialists-intro">
              <p>Research, design, building, and a second pair of eyes. Foundry has {roleCatalog.length} roles and picks the ones each step needs.</p>
              <p className="landing-specialists-note">Roles are instructions for the AI, not separate apps. You can pick a model for each one in settings.</p>
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
            <span>Role settings are saved per product.</span>
          </div>
        </section>

        <section className="landing-start" aria-labelledby="landing-start-title">
          <div className="landing-shell landing-start-inner">
            <div>
              <p className="landing-eyebrow"><Sparkles aria-hidden="true" /> Start small</p>
              <h2 id="landing-start-title">What do you want to make?</h2>
              <p>A name and a few sentences are enough.</p>
            </div>
            <Button size="lg" className="landing-primary" onClick={() => onEnter(true)}>Start a product <ArrowRight aria-hidden="true" /></Button>
          </div>
        </section>
      </main>

      <footer className="landing-shell landing-footer">
        <span className="landing-footer-brand"><img src="/assets/foundry-mark.svg" width="24" height="24" alt="" /> Foundry</span>
        <p>From idea to tested product, on your computer.</p>
        <Button variant="ghost" onClick={() => onEnter()}>Open workspace <ArrowRight aria-hidden="true" /></Button>
      </footer>
    </div>
  );
}

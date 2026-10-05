import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, GitBranch, LayoutTemplate, ListChecks, Search, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MotionToggle, useStudioMotion } from './studio-motion';
import { CopyButton, Disclosure } from './ui/animate-ui';
import { ProductWalkthrough } from './product-walkthrough';

const repository = 'https://github.com/dabhiram13/foundry';
const docs = '/docs';
const install = 'npm install -g @dabhiram13/foundry\nfoundry';
const specialists = [
  { name: 'Research', description: 'Explore the problem.', icon: Search },
  { name: 'Planning', description: 'Define what to build.', icon: ListChecks },
  { name: 'Design', description: 'Shape the experience.', icon: LayoutTemplate },
  { name: 'Development', description: 'Write the code.', icon: Code },
  { name: 'Testing', description: 'Run the checks.', icon: Check },
  { name: 'Review', description: 'Find gaps and risks.', icon: ShieldCheck },
];

export function Landing() {
  const { reduced } = useStudioMotion();
  function goTo(id: string) {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
    section.focus({ preventScroll: true });
  }

  return <div className="landing-page">
    <a className="landing-skip" href="#landing-main" onClick={event => { event.preventDefault(); goTo('landing-main'); }}>Skip to content</a>
    <header className="landing-header">
      <div className="landing-shell landing-header-inner">
        <a className="landing-brand" href="#landing-main" aria-label="Foundry home"><img src="/assets/foundry-wordmark.svg" width="123" height="21" alt="Foundry" /></a>
        <nav className="landing-nav" aria-label="Introduction">
          <button onClick={() => goTo('landing-workflow')}>How it works</button>
          <a href={`${docs}/`}>Docs <ArrowUpRight aria-hidden="true" /></a>
          <a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a>
        </nav>
        <Button className="landing-open" size="sm" onClick={() => goTo('landing-install')}>Get started <ArrowDown aria-hidden="true" /></Button>
      </div>
    </header>

    <main id="landing-main" tabIndex={-1}>
      <section className="landing-shell landing-hero" aria-labelledby="landing-title">
        <a className="hero-note" href={repository}><Terminal aria-hidden="true" /> Open source. Runs on your computer. <ArrowUpRight aria-hidden="true" /></a>
        <h1 id="landing-title" tabIndex={-1}>Build software<br /><span className="landing-title-secondary">from your terminal.</span></h1>
        <p className="landing-intro">Start with an idea or an existing project. Foundry helps you plan, write code and run checks—with your approval before building.</p>
        <div className="landing-hero-actions">
          <Button size="lg" onClick={() => goTo('landing-install')}>Get started <ArrowDown aria-hidden="true" /></Button>
          <a className="landing-secondary" href={`${docs}/`}>Read the docs <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <p className="landing-local-note">Node.js 24 <span aria-hidden="true">·</span> Connect your AI provider</p>
      </section>

      <div className="landing-shell landing-preview" id="landing-workflow" tabIndex={-1}><ProductWalkthrough /></div>

      <section className="landing-shell landing-principles" aria-label="What you get">
        <div><Check aria-hidden="true" /><span>Plan first. Build in small steps.</span></div><div><GitBranch aria-hidden="true" /><span>Check changes. Save them in Git.</span></div><div><Code aria-hidden="true" /><span>Keep your code and history.</span></div>
      </section>

      <section className="landing-shell landing-specialists" aria-labelledby="specialists-title">
        <div className="landing-section-heading"><h2 id="specialists-title">Specialists<br /><span>for each step.</span></h2><p>Focused roles for research, planning, design, coding and review. One process you can follow.</p></div>
        <ul className="specialist-grid">
          {specialists.map(({ name, description, icon: Icon }) => <li key={name}>
            <Icon aria-hidden="true" />
            <h3>{name}</h3>
            <p>{description}</p>
          </li>)}
        </ul>
        <a className="specialist-link" href={`${docs}/catalog/`}>Explore the specialist roles <ArrowRight aria-hidden="true" /></a>
      </section>

      <section className="landing-shell landing-setup" id="landing-start" tabIndex={-1} aria-labelledby="start-title">
        <div className="landing-section-heading"><h2 id="start-title">Start with<br />one small project.</h2><p>Install Foundry, connect your provider and choose what to build.</p><a href={`${docs}/getting-started/`}>Follow the setup guide <ArrowUpRight aria-hidden="true" /></a></div>
        <div className="landing-install" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
          <div className="install-heading"><h3 id="install-title"><Terminal aria-hidden="true" /> Install the CLI</h3><span>macOS / Linux</span></div>
          <pre aria-label="Installation commands"><code>{install}</code></pre>
          <div className="install-copy"><CopyButton content={install} label="Copy commands" /><span>No Foundry account needed.</span></div>
          <div className="install-note"><p>Requires <strong>Node.js 24 LTS</strong>, <strong>npm</strong> and <strong>Git</strong>. Install once, then run <code>foundry</code> from any directory. No source checkout or website build needed.</p><p>Installation does not start AI work. Codex is built in; confirm subscription use before running it.</p><a href={`${docs}/getting-started/`}>Setup, updates and uninstall <ArrowUpRight aria-hidden="true" /></a></div>
        </div>
        <div className="landing-already"><p>Already have a project?</p><a href={`${docs}/runtime/`}>Use Foundry in an existing repository <ArrowRight aria-hidden="true" /></a></div>
      </section>

      <section className="landing-shell landing-faq" aria-labelledby="questions-title">
        <h2 id="questions-title">Common<br />questions.</h2>
        <div>
          <Disclosure title="Do I need a Foundry account?"><p>No. Create projects, run steps and approve plans from your terminal. Connect your own AI provider; this website is just the guide.</p></Disclosure>
          <Disclosure title="Which AI can I use?"><p>Codex is built in. Developers can connect other tools through an adapter, but those connections need testing before you rely on them. An API key alone is not enough.</p><a href={`${docs}/providers/`}>Provider setup and limits <ArrowUpRight aria-hidden="true" /></a></Disclosure>
          <Disclosure title="Does my code stay on my computer?"><p>Your files and Git history stay in your product folder. Cloud AI providers receive prompts and selected project content. Local storage does not mean local AI processing. Never include secrets in your prompts.</p></Disclosure>
          <Disclosure title="Do I need an AI subscription?"><p>The built-in Codex route uses your subscription login, with your explicit confirmation. Your provider’s limits still apply. Foundry does not inspect billing or silently switch to metered API usage.</p></Disclosure>
          <Disclosure title="Will Foundry publish the product for me?"><p>No. The final step summarizes the work, test results and anything still missing. Hosting, paid services and publishing need separate decisions.</p></Disclosure>
        </div>
      </section>
    </main>

    <footer className="landing-footer"><div className="landing-shell"><div className="landing-footer-top"><p>Build software.<br /><span>Keep the code.</span></p><nav aria-label="Resources"><a href={`${docs}/getting-started/`}>Get started</a><a href={`${docs}/`}>Documentation</a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav><MotionToggle /></div><img className="landing-wordmark" src="/assets/foundry-wordmark.svg" alt="Foundry" width="164" height="28" /><div className="landing-footer-bottom"><span>Open source.</span><span>Runs on your computer.</span></div></div></footer>
  </div>;
}

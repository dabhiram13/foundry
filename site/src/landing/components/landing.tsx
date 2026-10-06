import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, GitBranch, LayoutTemplate, ListChecks, Search, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudioMotion } from './studio-motion';
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
        <p className="landing-intro">Foundry is an open-source CLI for AI-assisted software development. Plan, write code and run checks, with your approval before building.</p>
        <div className="landing-hero-actions">
          <Button size="lg" onClick={() => goTo('landing-install')}>Get started <ArrowDown aria-hidden="true" /></Button>
          <a className="landing-secondary" href={`${docs}/`}>Read the docs <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <p className="landing-local-note">Node.js 24+ and Git <span aria-hidden="true">·</span> Choose your AI provider</p>
      </section>

      <section className="landing-shell landing-setup" id="landing-start" tabIndex={-1} aria-labelledby="start-title">
        <div className="landing-section-heading"><h2 id="start-title">Install it.<br />Then open Foundry.</h2><p>Install with npm and open Foundry from your terminal.</p><a href={`${docs}/getting-started/`}>Start your first project <ArrowUpRight aria-hidden="true" /></a></div>
        <div className="landing-install" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
          <div className="install-heading"><h3 id="install-title"><Terminal aria-hidden="true" /> Install and open</h3><span>Node.js 24+ and Git</span></div>
          <pre aria-label="Installation commands"><code>{install}</code></pre>
          <div className="install-copy"><CopyButton content={install} label="Copy commands" /><span>The first installs. The second opens.</span></div>
          <div className="install-note"><p>Run <code>foundry</code> from any folder.</p><p>Choose a <strong>compatible AI provider</strong> for your project. Install its runtime and authorize access separately.</p><a href={`${docs}/getting-started/`}>Connect your AI and create a project <ArrowUpRight aria-hidden="true" /></a></div>
        </div>
        <div className="landing-already"><p>Already have a repository?</p><a href={`${docs}/runtime/`}>Track and check an existing project <ArrowRight aria-hidden="true" /></a></div>
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

      <section className="landing-shell landing-faq" aria-labelledby="questions-title">
        <h2 id="questions-title">Common<br />questions.</h2>
        <div>
          <Disclosure title="Do I need a Foundry account?"><p>No. Install Foundry and manage projects from your terminal.</p></Disclosure>
          <Disclosure title="Which AI can I use?"><p>Choose a provider adapter and a model it supports. Adapters connect AI tools to the same workflow, roles and checks.</p><a href={`${docs}/providers/`}>Connect your AI tool <ArrowUpRight aria-hidden="true" /></a></Disclosure>
          <Disclosure title="Does my code stay on my computer?"><p>Your files and Git history stay in your project folder. Cloud AI providers receive prompts and selected project content. Keep secrets out of prompts.</p></Disclosure>
          <Disclosure title="Do I need an AI subscription?"><p>That depends on your provider. Project workflows support local and subscription-backed adapters. Subscription access requires your confirmation; provider usage limits apply.</p></Disclosure>
          <Disclosure title="Will Foundry publish the product for me?"><p>No. Ship creates a local summary of the work and test results. You choose where and when to deploy.</p></Disclosure>
        </div>
      </section>
    </main>

    <footer className="landing-footer"><div className="landing-shell"><div className="landing-footer-top"><p>Build software.<br /><span>Keep the code.</span></p><nav aria-label="Resources"><a href={`${docs}/getting-started/`}>Get started</a><a href={`${docs}/`}>Documentation</a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav></div><img className="landing-wordmark" src="/assets/foundry-wordmark.svg" alt="Foundry" width="164" height="28" /><div className="landing-footer-bottom"><span>Open source.</span><span>Runs on your computer.</span></div></div></footer>
  </div>;
}

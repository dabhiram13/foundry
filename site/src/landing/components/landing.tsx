import type { MouseEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, GitBranch, LayoutTemplate, ListChecks, Search, ShieldCheck, Terminal } from 'lucide-react';
import { CopyButton } from './ui/animate-ui';
import { ProductWalkthrough } from './product-walkthrough';

const repository = 'https://github.com/dabhiram13/foundry';
const docs = '/docs';
const install = 'npm install -g @dabhiram13/foundry\nfoundry';
const specialists = [
  { name: 'Research', description: 'Understand the problem and save useful sources.', icon: Search },
  { name: 'Planning', description: 'Choose what to build and break it into tasks.', icon: ListChecks },
  { name: 'Design', description: 'Plan screens, flows and how they work.', icon: LayoutTemplate },
  { name: 'Development', description: 'Write code in small, testable changes.', icon: Code },
  { name: 'Testing', description: 'Run checks on the code that was built.', icon: Check },
  { name: 'Review', description: 'Find gaps and record what is ready.', icon: ShieldCheck },
];

export function Art({ name, alt, eager = false }: { name: string; alt: string; eager?: boolean }) {
  return <img className="foundry-art" src={`/assets/art/${name}-768.webp`}
    srcSet={`/assets/art/${name}-768.webp 768w, /assets/art/${name}-1024.webp 1024w`}
    sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1200px) 45vw, 540px"
    width="1024" height="1536" alt={alt} loading={eager ? 'eager' : 'lazy'}
    fetchPriority={eager ? 'high' : 'auto'} decoding="async" />;
}

function closeMenu(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open');
}

export function Landing() {
  return <div className="landing-page">
    <a className="landing-skip" href="#landing-main">Skip to content</a>
    <header className="landing-header"><div className="landing-shell landing-header-inner">
      <a className="landing-brand" href="#landing-main" aria-label="Foundry home"><img className="landing-mark" src="/assets/foundry-mark.svg" width="36" height="36" alt="" /><img src="/assets/foundry-wordmark.svg" width="146" height="30" alt="Foundry" /></a>
      <nav className="landing-nav" aria-label="Introduction"><a href="#landing-workflow">How it works</a><a href="#landing-specialists">Specialists</a><a href={`${docs}/`}>Docs <ArrowUpRight aria-hidden="true" /></a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav>
      <a className="foundry-button landing-open" href="#landing-install">Start building <ArrowDown aria-hidden="true" /></a>
      <details className="landing-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary')?.focus(); } }}>
        <summary>Menu <span className="menu-lines" aria-hidden="true" /></summary>
        <nav aria-label="Mobile introduction"><a href="#landing-workflow" onClick={closeMenu}>How it works</a><a href="#landing-specialists" onClick={closeMenu}>Specialists</a><a href={`${docs}/`}>Documentation <ArrowUpRight aria-hidden="true" /></a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href="#landing-install" onClick={closeMenu}>Start building <ArrowDown aria-hidden="true" /></a></nav>
      </details>
    </div></header>
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-shell landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy"><p className="foundry-eyebrow"><span className="brand-square" aria-hidden="true" /> Build products, step by step</p>
          <h1 id="landing-title">An idea.<br />A plan.<br /><em>A product.</em></h1>
          <p className="landing-intro">Research the problem, plan the work and build in small steps. Foundry keeps decisions, code and checks together.</p>
          <div className="landing-hero-actions"><a className="foundry-button" href="#landing-install">Start building <ArrowDown aria-hidden="true" /></a><a className="foundry-link" href="#landing-workflow">See the steps <ArrowRight aria-hidden="true" /></a></div>
          <p className="landing-local-note">Open source. Your tools. Your code.<br />Node.js 24+ and Git.</p>
        </div>
        <figure className="landing-hero-figure"><Art name="horse" eager alt="An engraved black horse stands beside a small metalworker and anvil on pale stone against a textured scarlet field." /><figcaption>FOUNDRY / BUILD PRODUCTS</figcaption></figure>
      </section>
      <div className="landing-stage-band" aria-label="Product-building stages"><ol className="landing-shell">{['Research', 'Plan', 'Design', 'Build', 'Review', 'Handoff'].map((stage, index) => <li key={stage}><span>{String(index + 1).padStart(2, '0')}</span>{stage}<ArrowRight aria-hidden="true" /></li>)}</ol></div>
      <section className="landing-shell landing-workflow" id="landing-workflow" tabIndex={-1} aria-labelledby="workflow-title">
        <div className="landing-section-heading"><p className="foundry-eyebrow">01 / How it works</p><h2 id="workflow-title">Plan first.<br /><em>Build next.</em></h2><p>Start with the problem. Approve the plan and design, then build and check the result.</p></div>
        <div className="landing-workflow-grid"><figure><Art name="research" alt="A small cloaked surveyor looks across a dark valley, following a pale winding river beneath a scarlet sky." /><figcaption>RESEARCH / UNDERSTAND THE PROBLEM</figcaption></figure><ProductWalkthrough /></div>
      </section>
      <section className="landing-paper" id="landing-specialists" tabIndex={-1} aria-labelledby="specialists-title"><div className="landing-shell landing-specialists">
        <div className="specialists-copy"><p className="foundry-eyebrow">02 / A role for each job</p><h2 id="specialists-title">One project.<br /><em>The right roles.</em></h2><p>Use research, planning, design, development and review roles. Each receives a clear task and the work saved so far.</p>
          <ul className="specialist-grid">{specialists.map(({ name, description, icon: Icon }) => <li key={name}><Icon aria-hidden="true" /><h3>{name}</h3><p>{description}</p></li>)}</ul>
          <p className="specialist-note">28 specialist roles. Your coding tool or chosen provider follows their instructions. They do not run all at once.</p>
          <a className="foundry-link" href={`${docs}/catalog/`}>Meet the specialists <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <figure><Art name="build" alt="Engraved gloved hands hold a hammer and tongs, shaping a small iron block on an anvil." /><figcaption>BUILD / SMALL CHANGES</figcaption></figure>
      </div></section>
      <section className="landing-shell landing-evidence" aria-labelledby="evidence-title">
        <div className="landing-section-heading"><p className="foundry-eyebrow">03 / Save progress</p><h2 id="evidence-title">Save the work.<br /><em>Check the result.</em></h2></div>
        <div className="evidence-grid"><article><ListChecks aria-hidden="true" /><h3>Approve what matters.</h3><p>Review the plan and design before building. Changes to them need a new approval.</p></article><article><GitBranch aria-hidden="true" /><h3>Pick up where you stopped.</h3><p>Saved decisions and task progress help you continue in a later session.</p></article><article><ShieldCheck aria-hidden="true" /><h3>Know what was checked.</h3><p>Check results belong to the code they tested. Changed code needs fresh checks.</p></article></div>
        <p className="evidence-note">Checks show what passed on the tested code. Review the product too. Foundry does not isolate commands from your computer.</p>
      </section>
      <section className="landing-shell landing-setup" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
        <div><p className="foundry-eyebrow">04 / Get started</p><h2 id="install-title">Install.<br /><em>Start building.</em></h2><p>Use Foundry from the terminal, or build it from source to use inside OpenCode.</p><a className="foundry-link" href={`${docs}/getting-started/`}>First-project guide <ArrowUpRight aria-hidden="true" /></a></div>
        <div className="landing-install"><div className="install-heading"><span><Terminal aria-hidden="true" /> Install and open</span><span>npm / Node.js 24+</span></div>
          <pre aria-label="Installation commands"><code>{install}</code></pre>
          <div className="install-copy"><CopyButton content={install} label="Copy commands" /><span>The first installs. The second opens.</span></div>
          <div className="install-note"><p><strong>npm package: 0.5.1.</strong> Use the terminal to build a product with a provider you choose and set up.</p><p><strong>Already using OpenCode?</strong> Build Foundry from source to research, plan, design, build and review inside OpenCode. Keep your existing model and account.</p><p>The connection is not part of npm 0.5.1. It has not been tested with a live model.</p><a href={`${docs}/connected-client/`}>Use Foundry in OpenCode <ArrowUpRight aria-hidden="true" /></a></div>
          <div className="install-bottom"><a href={`${docs}/runtime/`}>Bring an existing repository <ArrowRight aria-hidden="true" /></a><span>Homebrew is not available.</span></div>
        </div>
      </section>
      <section className="landing-shell landing-faq" aria-labelledby="questions-title">
        <div><p className="foundry-eyebrow">Questions</p><h2 id="questions-title">Before<br /><em>you begin.</em></h2></div>
        <div className="faq-list">
          <details><summary>Does Foundry replace my coding tool?</summary><p>No. Foundry organizes the steps and saves progress. In OpenCode, you keep your model, account and coding tools. From the terminal, you choose and set up a provider.</p></details>
          <details><summary>Is it just for running checks?</summary><p>No. Foundry helps with research, planning, design, coding and review. Checks and approvals are part of those steps. Small changes can use a shorter path.</p></details>
          <details><summary>Which provider can I use?</summary><p>In OpenCode, use the model you already selected. In the terminal, choose an available connection with <code>foundry providers</code> and sign in to its provider. Foundry does not choose a provider or switch models for you.</p><a href={`${docs}/providers/`}>Provider guide <ArrowUpRight aria-hidden="true" /></a></details>
          <details><summary>Does my code stay on my computer?</summary><p>Your files and Git history stay in your project folder. Cloud providers receive the prompts and selected project content sent to them. Keep secrets out of prompts.</p></details>
          <details><summary>Will Foundry publish the product for me?</summary><p>No. Foundry writes a summary in your project. You decide when and where to publish. Provider costs and usage limits still apply.</p></details>
        </div>
      </section>
      <section className="landing-shell landing-handoff" aria-labelledby="handoff-title">
        <div><p className="foundry-eyebrow">Start a project</p><h2 id="handoff-title">Start with<br /><em>your idea.</em></h2><p>Build a new product or improve an existing project. Keep the plan, code and results together.</p><a className="foundry-button" href="#landing-install">Start with Foundry <ArrowUpRight aria-hidden="true" /></a></div>
        <figure><Art name="handoff" alt="A metalworker leads a black horse across a pale stone bridge towards a distant doorway in a dark ridge." /><figcaption>HANDOFF / REVIEW THE RESULTS</figcaption></figure>
      </section>
    </main>
    <footer className="landing-footer"><div className="landing-shell"><div className="landing-footer-top"><a className="landing-brand" href="#landing-main" aria-label="Foundry home"><img src="/assets/foundry-wordmark.svg" width="180" height="37" alt="Foundry" /></a><nav aria-label="Resources"><a href={`${docs}/`}>Documentation</a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href={`${docs}/notices/`}>Licenses &amp; origins</a></nav></div><div className="landing-footer-bottom"><span>Open source. Runs on your computer.</span><span><a href={`${docs}/component-sources/`}>Artwork credits</a></span></div></div></footer>
  </div>;
}

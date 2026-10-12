import type { MouseEvent } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, GitBranch, LayoutTemplate, ListChecks, Search, ShieldCheck, Terminal } from 'lucide-react';
import { CopyButton } from './ui/animate-ui';
import { ProductWalkthrough } from './product-walkthrough';

const repository = 'https://github.com/dabhiram13/foundry';
const docs = '/docs';
const install = 'npm install -g @dabhiram13/foundry\nfoundry';
const specialists = [
  { name: 'Research', description: 'Sources, context and a clearer problem.', icon: Search },
  { name: 'Planning', description: 'A practical scope and small, ordered tasks.', icon: ListChecks },
  { name: 'Design', description: 'Flows, interfaces and decisions you can review.', icon: LayoutTemplate },
  { name: 'Development', description: 'Focused changes from the relevant builders.', icon: Code },
  { name: 'Testing', description: 'Check results tied to the work that ran.', icon: Check },
  { name: 'Review', description: 'Findings, remaining risks and a useful handoff.', icon: ShieldCheck },
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
      <nav className="landing-nav" aria-label="Introduction"><a href="#landing-workflow">The process</a><a href="#landing-specialists">Specialists</a><a href={`${docs}/`}>Docs <ArrowUpRight aria-hidden="true" /></a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav>
      <a className="foundry-button landing-open" href="#landing-install">Start building <ArrowDown aria-hidden="true" /></a>
      <details className="landing-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary')?.focus(); } }}>
        <summary>Menu <span className="menu-lines" aria-hidden="true" /></summary>
        <nav aria-label="Mobile introduction"><a href="#landing-workflow" onClick={closeMenu}>The process</a><a href="#landing-specialists" onClick={closeMenu}>Specialists</a><a href={`${docs}/`}>Documentation <ArrowUpRight aria-hidden="true" /></a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href="#landing-install" onClick={closeMenu}>Start building <ArrowDown aria-hidden="true" /></a></nav>
      </details>
    </div></header>
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-shell landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy"><p className="foundry-eyebrow"><span className="brand-square" aria-hidden="true" /> A framework for building products</p>
          <h1 id="landing-title">An idea.<br />A plan.<br /><em>A product.</em></h1>
          <p className="landing-intro">Give your AI a process worth following. Foundry brings research, design, specialist roles and review into one product-building workflow.</p>
          <div className="landing-hero-actions"><a className="foundry-button" href="#landing-install">Start building <ArrowDown aria-hidden="true" /></a><a className="foundry-link" href="#landing-workflow">See the process <ArrowRight aria-hidden="true" /></a></div>
          <p className="landing-local-note">Open source. Your provider. Your code.<br />Node.js 24+ and Git.</p>
        </div>
        <figure className="landing-hero-figure"><Art name="horse" eager alt="An engraved black horse stands beside a small metalworker and anvil on pale stone against a textured scarlet field." /><figcaption>FOUNDRY / THE WORK TAKES SHAPE</figcaption></figure>
      </section>
      <div className="landing-stage-band" aria-label="Product-building stages"><ol className="landing-shell">{['Research', 'Plan', 'Design', 'Build', 'Review', 'Handoff'].map((stage, index) => <li key={stage}><span>{String(index + 1).padStart(2, '0')}</span>{stage}<ArrowRight aria-hidden="true" /></li>)}</ol></div>
      <section className="landing-shell landing-workflow" id="landing-workflow" tabIndex={-1} aria-labelledby="workflow-title">
        <div className="landing-section-heading"><p className="foundry-eyebrow">01 / From the first question to the final review</p><h2 id="workflow-title">Less improvisation.<br /><em>More intention.</em></h2><p>A clear sequence, useful outputs and decisions you can inspect. Not a conversation you have to reconstruct.</p></div>
        <div className="landing-workflow-grid"><figure><Art name="research" alt="A small cloaked surveyor looks across a dark valley, following a pale winding river beneath a scarlet sky." /><figcaption>DISCOVERY / A DIRECTION EMERGES</figcaption></figure><ProductWalkthrough /></div>
      </section>
      <section className="landing-paper" id="landing-specialists" tabIndex={-1} aria-labelledby="specialists-title"><div className="landing-shell landing-specialists">
        <div className="specialists-copy"><p className="foundry-eyebrow">02 / Different work. Different perspectives.</p><h2 id="specialists-title">One project.<br /><em>The right roles.</em></h2><p>Researcher, planner, designer, builder, reviewer. Focused assignments and shared progress, instead of asking one role to do everything.</p>
          <ul className="specialist-grid">{specialists.map(({ name, description, icon: Icon }) => <li key={name}><Icon aria-hidden="true" /><h3>{name}</h3><p>{description}</p></li>)}</ul>
          <p className="specialist-note">28 role definitions. Your selected AI runtime does the reasoning and execution. Roles are assignments, not 28 agents automatically running at once.</p>
          <a className="foundry-link" href={`${docs}/catalog/`}>Meet the specialists <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <figure><Art name="build" alt="Engraved gloved hands hold a hammer and tongs, shaping a small iron block on an anvil." /><figcaption>CRAFT / SMALL CHANGES, MADE DELIBERATELY</figcaption></figure>
      </div></section>
      <section className="landing-shell landing-evidence" aria-labelledby="evidence-title">
        <div className="landing-section-heading"><p className="foundry-eyebrow">03 / Trust is part of the process</p><h2 id="evidence-title">Keep the progress.<br /><em>Question the proof.</em></h2></div>
        <div className="evidence-grid"><article><ListChecks aria-hidden="true" /><h3>Approve what matters.</h3><p>Review the plan and design before building. Approval belongs to the exact revision you saw.</p></article><article><GitBranch aria-hidden="true" /><h3>Pick up where you stopped.</h3><p>Saved work, task progress and Git checkpoints make the next step visible.</p></article><article><ShieldCheck aria-hidden="true" /><h3>Know what was checked.</h3><p>Scoped work links checks to current evidence. Changed code can make a passing result stale.</p></article></div>
        <p className="evidence-note">Checks support good work. They do not prove every requirement is correct, and Foundry is not a sandbox.</p>
      </section>
      <section className="landing-shell landing-setup" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
        <div><p className="foundry-eyebrow">04 / Begin on your own machine</p><h2 id="install-title">Make room<br /><em>for the work.</em></h2><p>Install the CLI. Choose a compatible provider. Start with an idea or an existing repository.</p><a className="foundry-link" href={`${docs}/getting-started/`}>First-project guide <ArrowUpRight aria-hidden="true" /></a></div>
        <div className="landing-install"><div className="install-heading"><span><Terminal aria-hidden="true" /> Install and open</span><span>npm / Node.js 24+</span></div>
          <pre aria-label="Installation commands"><code>{install}</code></pre>
          <div className="install-copy"><CopyButton content={install} label="Copy commands" /><span>The first installs. The second opens.</span></div>
          <div className="install-note"><p><strong>Published npm CLI: 0.5.1.</strong> Run the product journey through an adapter you select and authorize separately.</p><p><strong>Already using a coding client?</strong> The OpenCode source preview supports Research, Plan, Design, Builders and Reviewer through saved assignments and your approvals. Your client keeps its model and account; Foundry does not launch a second AI runtime.</p><p>The connection is merged source, not part of npm 0.5.1. A live model-driven product trial remains unqualified.</p><a href={`${docs}/connected-client/`}>Connect your coding client <ArrowUpRight aria-hidden="true" /></a></div>
          <div className="install-bottom"><a href={`${docs}/runtime/`}>Bring an existing repository <ArrowRight aria-hidden="true" /></a><span>Homebrew distribution is planned, not available.</span></div>
        </div>
      </section>
      <section className="landing-shell landing-faq" aria-labelledby="questions-title">
        <div><p className="foundry-eyebrow">A few things worth knowing</p><h2 id="questions-title">Before<br /><em>you begin.</em></h2></div>
        <div className="faq-list">
          <details><summary>Is Foundry another AI coding client?</summary><p>No. Foundry organizes the work. A connected runtime supplies the model, credentials and coding tools. The source-preview client connection reuses the host agent rather than launching a second AI runtime.</p></details>
          <details><summary>Is it just for running checks?</summary><p>No. The product journey covers research, planning, design, building, review and handoff. Checks and approvals support that journey. The source-preview client connection now supports these stages through saved specialist assignments, with a shorter path for small changes.</p></details>
          <details><summary>Which provider can I use?</summary><p>Choose a registered adapter and a model it supports. Install and authorize its runtime separately. Foundry does not silently choose a provider or switch models.</p><a href={`${docs}/providers/`}>Provider guide <ArrowUpRight aria-hidden="true" /></a></details>
          <details><summary>Does my code stay on my computer?</summary><p>Your files and Git history stay in your project folder. Cloud providers receive the prompts and selected project content sent to them. Keep secrets out of prompts.</p></details>
          <details><summary>Will Foundry publish the product for me?</summary><p>No. Handoff creates a local summary of the work and evidence. You decide when and where to deploy. Running a provider requires your consent; provider usage limits and costs apply.</p></details>
        </div>
      </section>
      <section className="landing-shell landing-handoff" aria-labelledby="handoff-title">
        <div><p className="foundry-eyebrow">The next thing is yours to make</p><h2 id="handoff-title">Build something<br /><em>worth keeping.</em></h2><p>From a first question to a reviewable handoff. Your work, your decisions, your code.</p><a className="foundry-button" href="#landing-install">Start with Foundry <ArrowUpRight aria-hidden="true" /></a></div>
        <figure><Art name="handoff" alt="A metalworker leads a black horse across a pale stone bridge towards a distant doorway in a dark ridge." /><figcaption>HANDOFF / THE WORK CONTINUES</figcaption></figure>
      </section>
    </main>
    <footer className="landing-footer"><div className="landing-shell"><div className="landing-footer-top"><a className="landing-brand" href="#landing-main" aria-label="Foundry home"><img src="/assets/foundry-wordmark.svg" width="180" height="37" alt="Foundry" /></a><nav aria-label="Resources"><a href={`${docs}/`}>Documentation</a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href={`${docs}/notices/`}>Licenses &amp; origins</a></nav></div><div className="landing-footer-bottom"><span>Open source. Runs on your computer.</span><span>AI-generated print artwork. No supplied reference images embedded.</span></div></div></footer>
  </div>;
}

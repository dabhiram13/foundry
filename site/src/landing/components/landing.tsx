import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, GitBranch, Terminal } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from '@/components/ui/button';
import { MotionToggle, useStudioMotion } from './studio-motion';
import { CopyButton, Disclosure } from './ui/animate-ui';
import { ProductWalkthrough } from './product-walkthrough';

const repository = 'https://github.com/dabhiram13/foundry';
const docs = '/docs';
const install = `git clone ${repository}.git\ncd foundry\nnpm ci --ignore-scripts\nnpm run build\n./foundry`;

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
        <Button className="landing-open" size="sm" onClick={() => goTo('landing-install')}>Install Foundry <ArrowDown aria-hidden="true" /></Button>
      </div>
    </header>

    <main id="landing-main" tabIndex={-1}>
      <section className="landing-shell landing-hero" aria-labelledby="landing-title">
        <a className="hero-note" href={`${docs}/getting-started/`}><Terminal aria-hidden="true" /> Local by design. Yours to build. <ArrowRight aria-hidden="true" /></a>
        <h1 id="landing-title" tabIndex={-1}>Start with an idea.<br /><span className="landing-title-secondary">Make it real.</span></h1>
        <p className="landing-intro">Plan, build and test from your terminal.<br className="desktop-break" /> You approve the plan and design. You keep the code.</p>
        <div className="landing-hero-actions">
          <Button size="lg" onClick={() => goTo('landing-install')}>Install Foundry <ArrowDown aria-hidden="true" /></Button>
          <a className="landing-secondary" href={`${docs}/getting-started/`}>Read the guide <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <p className="landing-local-note">Node.js 24 <span aria-hidden="true">·</span> Bring a supported AI runtime</p>
      </section>

      <div className="landing-shell landing-preview" id="landing-workflow" tabIndex={-1}><ProductWalkthrough /></div>

      <section className="landing-shell landing-principles" aria-label="What you get">
        <div><Check aria-hidden="true" /><span>You approve before it builds</span></div><div><GitBranch aria-hidden="true" /><span>Small changes, saved in Git</span></div><div><Code aria-hidden="true" /><span>Your code stays yours</span></div>
      </section>

      <section className="landing-shell landing-features" aria-labelledby="features-title">
        <div className="landing-section-heading"><h2 id="features-title">Less babysitting.<br /><span>More building.</span></h2><p>Not another blank chat. A clear path from the first idea to code you can open, test and keep.</p></div>
        <div className="landing-feature-grid">
          <Card className="landing-feature feature-plan"><h3>A plan before a pile of code.</h3><p>Start with what matters. Review the plan and design before Foundry builds the first version.</p><div className="plan-diagram" aria-label="Idea, plan and design with your approval, then build"><span>Idea</span><ArrowRight aria-hidden="true" /><span>Plan &amp; design</span><ArrowRight aria-hidden="true" /><strong>Your approval</strong><ArrowRight aria-hidden="true" /><span>Build</span></div></Card>
          <Card className="landing-feature"><h3>Small steps. Real checks.</h3><p>Foundry builds one task at a time and runs its checks. If a repair does not work, it stops and shows you what needs attention.</p><div className="feature-detail"><Check aria-hidden="true" /><span>Build <span aria-hidden="true">/</span> Test <span aria-hidden="true">/</span> Save</span></div></Card>
          <Card className="landing-feature"><h3>Nothing hidden. Nothing locked in.</h3><p>Keep the code, notes and Git history in your product folder. Open them in your editor. Publishing is a separate decision.</p><div className="feature-detail"><GitBranch aria-hidden="true" /><code>your-products / your-next-idea</code></div></Card>
        </div>
      </section>

      <section className="landing-shell landing-setup" id="landing-start" tabIndex={-1} aria-labelledby="start-title">
        <div className="landing-section-heading"><h2 id="start-title">Your next idea<br />starts here.</h2><p>Install from your terminal.<br />Start with something small.</p><a href={`${docs}/getting-started/`}>Read the start guide <ArrowUpRight aria-hidden="true" /></a></div>
        <div className="landing-install" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
          <div className="install-heading"><h3 id="install-title"><Terminal aria-hidden="true" /> Install from source</h3><span>macOS / Linux</span></div>
          <pre aria-label="Installation commands"><code>{install}</code></pre>
          <div className="install-copy"><CopyButton content={install} label="Copy commands" /><span>No Foundry account needed.</span></div>
          <div className="install-note"><p>Requires <strong>Node.js 24 LTS</strong>, <strong>npm</strong> and <strong>Git</strong>. Foundry does not require Python. These commands do not start AI work.</p><p>Choose a supported provider, then explicitly confirm any subscription use. The guide walks through your first project. npm registry publication is not yet available.</p><a href={`${docs}/getting-started/`}>Check your setup <ArrowUpRight aria-hidden="true" /></a></div>
        </div>
        <div className="landing-already"><p>One terminal interface. Explicit commands when you need automation.</p><a href={`${docs}/commands/`}>Read the command reference <ArrowRight aria-hidden="true" /></a></div>
      </section>

      <section className="landing-shell landing-faq" aria-labelledby="questions-title">
        <h2 id="questions-title">A few good<br />questions.</h2>
        <div>
          <Disclosure title="Do I need to use a browser?"><p>No. Create projects, run steps and approve plans from your terminal. This static website provides documentation; there is no browser workspace or Foundry account to set up.</p></Disclosure>
          <Disclosure title="Which AI can I use?"><p>Codex is the built-in adapter. Other runtimes can implement the same connection contract for tools, structured results and cancellation. Registration and local fixtures do not prove live support. Adding an API key or model URL alone is not enough.</p><a href={`${docs}/providers/`}>Supported options and setup <ArrowUpRight aria-hidden="true" /></a></Disclosure>
          <Disclosure title="Does my code stay on my computer?"><p>Your files and Git history stay in your product folder. Cloud AI providers receive prompts and selected project content. Local storage does not mean local AI processing. Never include secrets in your prompts.</p></Disclosure>
          <Disclosure title="Do I need an AI subscription?"><p>The built-in Codex route uses your subscription login, with your explicit confirmation. Your provider’s limits still apply. Foundry does not inspect billing or silently switch to metered API usage.</p></Disclosure>
          <Disclosure title="Will Foundry publish the product for me?"><p>No. The final step summarizes the work, test results and anything still missing. Hosting, paid services and publishing need separate decisions.</p></Disclosure>
        </div>
      </section>
      <section className="landing-shell landing-closing"><h2>Make room for your next idea.</h2><button className="landing-secondary" onClick={() => goTo('landing-install')}>Get started <ArrowUpRight aria-hidden="true" /></button></section>
    </main>

    <footer className="landing-footer"><div className="landing-shell"><div className="landing-footer-top"><p>Built on your computer.<br /><span>On your terms.</span></p><nav aria-label="Resources"><a href={`${docs}/getting-started/`}>Get started</a><a href={`${docs}/`}>Documentation</a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav><MotionToggle /></div><img className="landing-wordmark" src="/assets/foundry-wordmark.svg" alt="Foundry" width="164" height="28" /><div className="landing-footer-bottom"><span>Your idea. Your code.</span><span>Made to run locally.</span></div></div></footer>
  </div>;
}

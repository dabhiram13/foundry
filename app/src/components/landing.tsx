import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code, GitBranch, Terminal } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from '@/components/ui/button';
import { MotionToggle, useStudioMotion } from './studio-motion';
import { CopyButton, Disclosure } from './ui/animate-ui';
import { ProductWalkthrough } from './product-walkthrough';

type LandingProps = { onEnter: (create?: boolean) => void };

const repository = 'https://github.com/dabhiram13/foundry';
const docs = `${repository}/blob/main/docs`;
const install = `git clone ${repository}.git\ncd foundry\n./foundry`;

export function Landing({ onEnter }: LandingProps) {
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
        <a className="landing-brand" href="#welcome" aria-label="Foundry home"><img src="/assets/foundry-wordmark.svg" width="123" height="21" alt="Foundry" /></a>
        <nav className="landing-nav" aria-label="Introduction">
          <button onClick={() => goTo('landing-workflow')}>How it works</button>
          <a href={`${docs}/README.md`}>Docs <ArrowUpRight aria-hidden="true" /></a>
          <a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a>
        </nav>
        <Button className="landing-open" size="sm" onClick={() => onEnter()}>Open workspace <ArrowUpRight aria-hidden="true" /></Button>
      </div>
    </header>

    <main id="landing-main" tabIndex={-1}>
      <section className="landing-shell landing-hero" aria-labelledby="landing-title">
        <a className="hero-note" href={`${docs}/GETTING-STARTED.md`}><Terminal aria-hidden="true" /> Local by design. Yours to build. <ArrowRight aria-hidden="true" /></a>
        <h1 id="landing-title" tabIndex={-1}>Start with an idea.<br /><span className="bracketed">Make it real.</span></h1>
        <p className="landing-intro">Your idea, a clear plan, working code.<br className="desktop-break" /> Build with AI on your computer. You decide what happens next.</p>
        <div className="landing-hero-actions">
          <Button size="lg" onClick={() => goTo('landing-install')}>Install Foundry <ArrowDown aria-hidden="true" /></Button>
          <a className="landing-secondary" href={repository}><ArrowUpRight aria-hidden="true" /> View source</a>
        </div>
        <p className="landing-local-note">macOS &amp; Linux <span aria-hidden="true">·</span> Bring your Codex login</p>
      </section>

      <div className="landing-shell landing-preview" id="landing-workflow" tabIndex={-1}><ProductWalkthrough onEnter={() => onEnter()} /></div>

      <section className="landing-shell landing-principles" aria-label="What you get">
        <div><Check aria-hidden="true" /><span>You approve before it builds</span></div><div><GitBranch aria-hidden="true" /><span>Small changes, saved in Git</span></div><div><Code aria-hidden="true" /><span>Your code stays yours</span></div>
      </section>

      <section className="landing-shell landing-features" aria-labelledby="features-title">
        <div className="landing-section-heading"><h2 id="features-title">Less babysitting.<br /><span>More building.</span></h2><p>Not another blank chat. A clear path from the first idea to code you can open, test and keep.</p></div>
        <div className="landing-feature-grid">
          <Card className="landing-feature feature-plan"><h3>A plan before a pile of code.</h3><p>Start with what matters. Review the plan and design before Foundry builds the first version.</p><div className="plan-diagram" aria-label="Idea, plan and design with your approval, then build"><span>Idea</span><ArrowRight aria-hidden="true" /><span>Plan &amp; design</span><ArrowRight aria-hidden="true" /><strong>Your approval</strong><ArrowRight aria-hidden="true" /><span>Build</span></div></Card>
          <Card className="landing-feature"><h3>Small steps. Real checks.</h3><p>Follow each task as it is built and tested. If a check fails, Foundry makes up to three repair attempts, then asks for help.</p><div className="feature-detail"><Check aria-hidden="true" /><span>Build <span aria-hidden="true">/</span> Test <span aria-hidden="true">/</span> Save</span></div></Card>
          <Card className="landing-feature"><h3>Nothing hidden. Nothing locked in.</h3><p>Keep the code, notes and Git history in your product folder. Open them in your editor. Publishing is a separate decision.</p><div className="feature-detail"><GitBranch aria-hidden="true" /><code>your-products / your-next-idea</code></div></Card>
        </div>
      </section>

      <section className="landing-shell landing-setup" id="landing-start" tabIndex={-1} aria-labelledby="start-title">
        <div className="landing-section-heading"><h2 id="start-title">Your next idea<br />starts here.</h2><p>Install from source. Open the local workspace.<br />Start with something small.</p><a href={`${docs}/GETTING-STARTED.md`}>Read the start guide <ArrowUpRight aria-hidden="true" /></a></div>
        <div className="landing-install" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
          <div className="install-heading"><h3 id="install-title"><Terminal aria-hidden="true" /> Install from source</h3><span>macOS / Linux</span></div>
          <pre aria-label="Installation commands"><code>{install}</code></pre>
          <div className="install-copy"><CopyButton content={install} label="Copy commands" /><span>No Foundry account needed.</span></div>
          <div className="install-note"><p>Requires <strong>Python 3.11+</strong> and <strong>Git</strong>. The launcher installs dependencies and opens your browser.</p><p>For AI work, install Codex, run <code>codex login</code>, and confirm your subscription login in the product’s settings.</p><a href={`${docs}/GETTING-STARTED.md#1-check-your-computer`}>Check your setup <ArrowUpRight aria-hidden="true" /></a></div>
        </div>
        <div className="landing-already"><p>Already running Foundry? You’re ready to begin.</p><Button variant="outline" onClick={() => onEnter(true)}>Create your first product <ArrowRight aria-hidden="true" /></Button></div>
      </section>

      <section className="landing-shell landing-faq" aria-labelledby="questions-title">
        <h2 id="questions-title">A few good<br />questions.</h2>
        <div>
          <Disclosure title="Is this a website or a local app?"><p>Foundry runs on your computer. Start it from the terminal, then use the local browser workspace to describe ideas, review plans and follow progress. It is not a hosted service or a terminal-only app.</p></Disclosure>
          <Disclosure title="Can I use Claude, Qwen or another AI?"><p>Codex is the built-in engine. Other engines need an integration that can use tools, report progress and stop safely. An OpenAI-compatible endpoint alone is not enough.</p><a href={`${docs}/PROVIDERS.md`}>See supported integrations <ArrowUpRight aria-hidden="true" /></a></Disclosure>
          <Disclosure title="Does my code stay on my computer?"><p>Your files and Git history stay in your product folder. Cloud AI providers receive prompts and selected project content. Local storage does not mean local AI processing. Never include secrets in your prompts.</p></Disclosure>
          <Disclosure title="Do I need an AI subscription?"><p>The built-in Codex route uses your subscription login, with your explicit confirmation. Your provider’s limits still apply. Foundry does not inspect billing or silently switch to metered API usage.</p></Disclosure>
          <Disclosure title="Will Foundry publish the product for me?"><p>No. The final step summarizes the work, test results and anything still missing. Hosting, paid services and publishing need separate decisions.</p></Disclosure>
        </div>
      </section>
      <section className="landing-shell landing-closing"><h2>Make room for your next idea.</h2><button className="landing-secondary" onClick={() => goTo('landing-install')}>Get started <ArrowUpRight aria-hidden="true" /></button></section>
    </main>

    <footer className="landing-footer"><div className="landing-shell"><div className="landing-footer-top"><p>Built on your computer.<br /><span>On your terms.</span></p><nav aria-label="Resources"><a href={`${docs}/GETTING-STARTED.md`}>Get started</a><a href={`${docs}/README.md`}>Documentation</a><a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav><MotionToggle /></div><img className="landing-wordmark" src="/assets/foundry-wordmark.svg" alt="Foundry" width="164" height="28" /><div className="landing-footer-bottom"><span>Your idea. Your code.</span><span>Made to run locally.</span></div></div></footer>
  </div>;
}

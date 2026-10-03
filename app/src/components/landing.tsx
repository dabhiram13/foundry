import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, Folder, Terminal, DownloadSimple } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { SpecialistIntro } from './specialist-intro';
import { SkyBackground } from './sky-background';
import { MotionToggle, useStudioMotion } from './studio-motion';
import { CopyButton, Disclosure, SplitText } from './ui/animate-ui';

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

  return (
    <div className="landing-page">
      <a className="landing-skip" href="#landing-main" onClick={event => { event.preventDefault(); goTo('landing-main'); }}>Skip to content</a>
      <header className="landing-header">
        <div className="landing-shell landing-header-inner">
          <a className="landing-brand" href="#welcome" aria-label="Foundry home">
            <img src="/assets/foundry-mark.svg" width="28" height="28" alt="" />Foundry
          </a>
          <nav className="landing-nav" aria-label="Introduction">
            <button onClick={() => goTo('landing-start')}>Get started</button>
            <button onClick={() => goTo('landing-workflow')}>How it works</button>
            <a href={`${docs}/README.md`}>Docs <ArrowUpRight aria-hidden="true" /></a>
          </nav>
          <Button variant="outline" onClick={() => onEnter()}>Open workspace <ArrowRight aria-hidden="true" /></Button>
        </div>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-shell landing-hero sky-surface" aria-labelledby="landing-title">
          <SkyBackground />
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><Terminal aria-hidden="true" /> Made to run on your computer</p>
            <h1 id="landing-title" tabIndex={-1}><SplitText text="Your idea. Built on your terms." /></h1>
            <p className="landing-intro">Describe a product. Review the plan. Let Foundry work through the code and tests—with you in control.</p>
            <div className="landing-hero-actions">
              <Button size="lg" onClick={() => goTo('landing-install')}><DownloadSimple aria-hidden="true" /> Install Foundry</Button>
              <a href={`${docs}/GETTING-STARTED.md`}>Read the start guide <ArrowUpRight aria-hidden="true" /></a>
            </div>
            <p className="landing-local-note">Local files. Your own Git history. No Foundry account.</p>
          </div>
          <div className="landing-install" id="landing-install" tabIndex={-1} aria-labelledby="install-title">
            <div className="install-heading"><span><Terminal aria-hidden="true" /> Terminal</span><span>macOS / Linux</span></div>
            <div className="install-body">
              <h2 id="install-title">A small start. A real workspace.</h2>
              <p>Install from source, then open Foundry locally.</p>
              <pre aria-label="Installation commands"><code>{install}</code></pre>
              <CopyButton content={install} label="Copy commands" />
            </div>
            <div className="install-note"><Check aria-hidden="true" /><p>Needs Python 3.11+ and Git. The launcher installs dependencies and opens your browser. <button onClick={() => goTo('landing-start')}>Check your setup first <ArrowDown aria-hidden="true" /></button></p></div>
          </div>
        </section>

        <section className="landing-paper" aria-labelledby="start-title">
          <div className="landing-shell landing-section" id="landing-start" tabIndex={-1}>
            <div className="landing-section-heading"><p className="landing-eyebrow">From install to your first idea</p><h2 id="start-title">Up and running, without the guessing.</h2><p>Use the terminal to start Foundry. Use the local workspace to review and build.</p></div>
            <ol className="landing-start-steps">
              <li><span className="landing-step-number">01</span><h3>Check your setup</h3><p>You need macOS or Linux, Python 3.11 or newer, Git and the Codex CLI. The command <code>python3</code> must use Python 3.11+.</p><a href={`${docs}/GETTING-STARTED.md#1-check-your-computer`}>Installation help <ArrowUpRight aria-hidden="true" /></a></li>
              <li><span className="landing-step-number">02</span><h3>Connect your AI</h3><p>Run <code>codex login</code> and sign in with ChatGPT. Foundry uses that login; you don’t need to paste an API key into the app. Your provider’s usage limits still apply.</p><a href={`${docs}/GETTING-STARTED.md#3-connect-codex`}>Account and usage details <ArrowUpRight aria-hidden="true" /></a></li>
              <li><span className="landing-step-number">03</span><h3>Start something small</h3><p>Give your idea a name and select <strong>Create product</strong>. Use <strong>Confirm AI login</strong> to confirm your Codex subscription, save settings, then select <strong>Start Research</strong>.</p><button className="landing-text-action" onClick={() => onEnter(true)}>Create your first product <ArrowRight aria-hidden="true" /></button></li>
            </ol>
            <p className="landing-start-note">Already viewing this page in the local app? You can open the workspace—no need to install again.</p>
          </div>
        </section>

        <section className="landing-shell landing-section landing-workflow" id="landing-workflow" tabIndex={-1} aria-labelledby="workflow-title">
          <div className="landing-workflow-copy">
            <p className="landing-eyebrow">A little structure goes a long way</p><h2 id="workflow-title">You make the calls.<br />Foundry does the legwork.</h2>
            <ol className="landing-run-steps">
              <li><span>01</span><div><h3>Describe what matters</h3><p>Research turns your idea into a focused plan, not a long list of features.</p></div></li>
              <li><span>02</span><div><h3>Review before it builds</h3><p>Approve the plan, then the design. If either changes, Foundry asks again.</p></div></li>
              <li><span>03</span><div><h3>Build, check, repeat</h3><p>Small tasks, real tests and a Git checkpoint for each completed task. Failed checks get up to three repair attempts before Foundry asks for help.</p></div></li>
            </ol>
            <p className="landing-workflow-note"><Folder aria-hidden="true" /> You get a product folder with code, decisions and test results. Publishing is your next decision—not an automatic step.</p>
          </div>
          <div className="landing-crew"><SpecialistIntro /><a href={`${docs}/CATALOG.md`}>Explore the specialist roles <ArrowUpRight aria-hidden="true" /></a></div>
        </section>

        <section className="landing-paper" aria-labelledby="help-title">
          <div className="landing-shell landing-section landing-help">
            <div className="landing-section-heading"><p className="landing-eyebrow"><BookOpen aria-hidden="true" /> Help when you need it</p><h2 id="help-title">Start here.<br />Go deeper later.</h2><p>You don’t need to learn every command or role to build your first product.</p><a href={`${docs}/README.md`}>Browse the docs <ArrowUpRight aria-hidden="true" /></a></div>
            <div className="landing-help-links">
              <a href={`${docs}/GETTING-STARTED.md`}><span><strong>Your first product</strong><small>Requirements, installation and the first run.</small></span><ArrowUpRight aria-hidden="true" /></a>
              <a href={`${docs}/GETTING-STARTED.md#when-something-goes-wrong`}><span><strong>Something not working?</strong><small>Sign-in, missing tools and interrupted work.</small></span><ArrowUpRight aria-hidden="true" /></a>
              <a href={`${docs}/PROVIDERS.md`}><span><strong>Understand AI support</strong><small>What works today and what needs an integration.</small></span><ArrowUpRight aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section className="landing-shell landing-section landing-faq" aria-labelledby="questions-title">
          <div className="landing-section-heading"><p className="landing-eyebrow">A few useful answers</p><h2 id="questions-title">Before you start.</h2></div>
          <div>
            <Disclosure title="Is Foundry a terminal app or a website?"><p>You install and launch it from the terminal. Today, the launcher opens a local browser workspace for ideas, approvals and progress. It is not yet a terminal-only product, and this page does not run your projects on a hosted service.</p></Disclosure>
            <Disclosure title="Can I use Claude, Qwen or another AI?"><p>Codex is the built-in engine. The separate ChatGPT connection is experimental and currently needs macOS Keychain. Other engines need an integration that can use tools, report progress and stop work safely. An OpenAI-compatible endpoint alone is not enough.</p><a href={`${docs}/PROVIDERS.md`}>See supported integrations <ArrowUpRight aria-hidden="true" /></a></Disclosure>
            <Disclosure title="Does my code stay on my computer?"><p>Your files and Git history stay in your product folder. When you use a cloud AI, prompts and selected project content are sent to that provider. Local storage does not mean local AI processing. Never include secrets in your idea or prompts.</p></Disclosure>
            <Disclosure title="Do I need an AI subscription?"><p>The built-in Codex route asks you to confirm a subscription login. Foundry does not inspect your billing or silently switch to paid API usage. Your provider’s plan and usage limits still apply.</p></Disclosure>
            <Disclosure title="Will Foundry publish the product for me?"><p>No. The final Ship step summarizes the work, checks and anything still missing. Hosting, connecting paid services and publishing require separate decisions. Automated checks are not a guarantee that a product is ready for customers.</p></Disclosure>
          </div>
        </section>
      </main>

      <footer className="landing-shell landing-footer">
        <a className="landing-brand" href="#welcome"><img src="/assets/foundry-mark.svg" width="24" height="24" alt="" />Foundry</a>
        <p>Make something worth building.</p>
        <a href={repository}>GitHub <ArrowUpRight aria-hidden="true" /></a>
        <a href={`${docs}/README.md`}>Docs</a>
        <MotionToggle />
      </footer>
    </div>
  );
}

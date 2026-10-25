import { useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, GitBranch, ListChecks, Menu, ShieldCheck } from 'lucide-react';
import { ProductWalkthrough } from './product-walkthrough';
import { Button } from './ui/button';
import { CopyButton } from './ui/copy-button';
import { ThemeToggle } from './theme-toggle';
import { DotWaveText } from './dot-wave-text';
import { HeaderNav } from './header-nav';

const install = 'npm install -g @dabhiram13/foundry\nfoundry';
const github = 'https://github.com/dabhiram13/foundry';
const questions = [
  { title: 'Does Foundry replace my coding tool?', answer: <>No. The connected workflow uses your coding tool. A built-in browser workspace and PR follow-up are not available yet. See <a href="/docs/workflow/#what-works-today">what works today</a>.</> },
  { title: 'Is it just for running checks?', answer: <>No. Foundry connects research, plans, design, coding and review. You approve the plan and design.</> },
  { title: 'Which provider can I use?', answer: <>The terminal uses compatible provider adapters. The source connection uses your OpenCode model and account. See the <a href="/docs/providers/">provider guide</a>.</> },
  { title: 'Does my code stay on my computer?', answer: <>Progress is saved locally. Your provider may receive code and task context. Local commands run with your account’s permissions, not in a sandbox.</> },
  { title: 'Will Foundry publish the product for me?', answer: <>No. Handoff saves a local summary. You decide when and where to publish.</> },
];

function Brand() {
  return <a className="landing-brand" href="/" aria-label="Foundry home"><img src="/assets/foundry-mark.svg" width="30" height="30" alt="" /><span>Foundry</span></a>;
}

export function Landing() {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !menu.current?.open) return;
      menu.current.open = false;
      menu.current.querySelector('summary')?.focus();
    }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);

  return <div className="landing-page">
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="landing-header"><div className="header-inner">
      <Brand />
      <HeaderNav />
      <div className="header-actions"><a className="source-link" href={github}>GitHub <ArrowUpRight aria-hidden="true" /></a><Button asChild size="sm"><a href="#landing-install">Install <ArrowRight aria-hidden="true" /></a></Button></div>
      <ThemeToggle />
      <details className="mobile-menu" ref={menu}><summary><Menu aria-hidden="true" /><span className="sr-only">Menu</span></summary><nav aria-label="Mobile navigation" onClick={event => { if (event.target instanceof Element && event.target.closest('a') && menu.current) menu.current.open = false; }}><a href="#landing-workflow">How it works</a><a href="#landing-install">Install</a><a href="/docs/">Documentation</a><a href={github}>GitHub <ArrowUpRight aria-hidden="true" /></a></nav></details>
    </div></header>
    <main id="landing-main" className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="eyebrow"><span className="eyebrow-pixels" aria-hidden="true"><i /><i /><i /><i /></span> OPEN SOURCE</p>
        <h1 id="landing-title">Build your idea.<br /><DotWaveText text="Keep control." /></h1>
        <p className="landing-intro">Plan the work. Build with your coding tool. Review every change.</p>
        <div className="hero-actions"><Button asChild size="lg"><a href="#landing-install">Install Foundry <ArrowRight aria-hidden="true" /></a></Button><Button asChild variant="outline" size="lg"><a href="/docs/">Read the docs <ArrowRight aria-hidden="true" /></a></Button></div>
      </section>
      <section id="landing-workflow" className="workflow-section" aria-labelledby="workflow-title"><h2 id="workflow-title" className="sr-only">How Foundry works</h2><ProductWalkthrough /></section>
      <section id="landing-install" className="install-section" aria-labelledby="install-title">
        <div className="install-heading"><div><p className="section-label">Install</p><h2 id="install-title">Start with your tools.</h2></div><p>Requires Node 24+, npm and Git.<br />Choose a provider for your project.</p></div>
        <div className="install-panel"><div className="command-heading"><span><span className="command-dot" aria-hidden="true" /> Terminal</span><CopyButton text={install} /></div><pre tabIndex={0} aria-label="Installation commands"><code>{install}</code></pre></div>
        <div className="availability" aria-label="Available versions"><div><span className="availability-label">Terminal <span className="badge">Published</span></span><p>npm 0.5.1. Add a compatible coding-tool connector.</p><a href="/docs/getting-started/">Installation guide <ArrowUpRight aria-hidden="true" /></a></div><div><span className="availability-label">OpenCode <span className="badge">From source</span></span><p>Use your existing model and account. Not in npm 0.5.1.</p><a href="/docs/connected-client/">Connect from source <ArrowUpRight aria-hidden="true" /></a></div><div><span className="availability-label">Managed workspace <span className="badge">In development</span></span><p>Not a standalone coding workspace yet.</p><a href="/docs/workflow/#what-works-today">Current capabilities <ArrowUpRight aria-hidden="true" /></a></div></div>
      </section>
      <section className="evidence-section section-grid" aria-labelledby="evidence-title"><div className="section-heading"><p className="section-label">Your work</p><h2 id="evidence-title">Pick up where you left off.</h2></div><dl className="evidence-list"><div><dt><ShieldCheck aria-hidden="true" /> Approve the direction</dt><dd>Plan and design need your approval before building.</dd></div><div><dt><GitBranch aria-hidden="true" /> Keep your progress</dt><dd>Tasks, decisions and handoff notes carry over.</dd></div><div><dt><ListChecks aria-hidden="true" /> Check current code</dt><dd>Changed inputs need fresh checks.</dd></div></dl></section>
      <section className="faq-section section-grid" aria-labelledby="faq-title"><div className="section-heading"><h2 id="faq-title">Questions?</h2><p><a className="text-link" href="/docs/">Read the docs <ArrowUpRight aria-hidden="true" /></a></p></div><div className="faq-list">{questions.map(question => <details key={question.title}><summary>{question.title}<span className="disclosure-icon" aria-hidden="true">+</span></summary><div className="faq-answer">{question.answer}</div></details>)}</div></section>
    </main>
    <footer className="landing-footer"><div className="landing-shell footer-inner"><Brand /><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href="/docs/catalog/">Roles</a><a href={github}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href={`${github}/blob/main/LICENSE`}>MIT License</a><a href="/docs/component-sources/">Component sources</a></nav></div></footer>
  </div>;
}

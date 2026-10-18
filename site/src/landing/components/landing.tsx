import { useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Code, GitBranch, LayoutTemplate, ListChecks, Menu, Search, ShieldCheck } from 'lucide-react';
import { ProductWalkthrough } from './product-walkthrough';
import { Button } from './ui/button';
import { CopyButton } from './ui/copy-button';

const install = 'npm install -g @dabhiram13/foundry\nfoundry';
const github = 'https://github.com/dabhiram13/foundry';
const specialists = [
  { name: 'Research', description: 'Find useful sources. Understand the problem before choosing a solution.', icon: Search },
  { name: 'Planning', description: 'Turn the brief into requirements, tasks and ways to check the result.', icon: ListChecks },
  { name: 'Design', description: 'Work through screens, flows and component states before integration.', icon: LayoutTemplate },
  { name: 'Development', description: 'Build the interface and backend in small, testable changes.', icon: Code },
  { name: 'Testing', description: 'Run the checks that matter for the code and the user journey.', icon: Check },
  { name: 'Review', description: 'Compare the result with the plan. Record what still needs attention.', icon: ShieldCheck },
];
const questions = [
  { title: 'Does Foundry replace my coding tool?', answer: <>Not today. Use the terminal with a provider adapter, or connect the source version to your coding client. Managed coding sessions and a workspace are in development, not part of the published package.</> },
  { title: 'Is it just for running checks?', answer: <>No. Foundry connects research, planning, design, implementation and review. Checks are one part of the process, alongside your decisions and approvals.</> },
  { title: 'Which provider can I use?', answer: <>Choose a compatible provider adapter for the terminal. The connected source preview uses your coding client’s model and tools. See the <a href="/docs/providers/">provider guide</a> for the actual requirements.</> },
  { title: 'Does my code stay on my computer?', answer: <>Foundry saves work locally. Your selected provider may receive code and task context. Local execution is not a sandbox: commands run with your account’s permissions. Check the provider and project settings before starting.</> },
  { title: 'Will Foundry publish the product for me?', answer: <>No. Handoff saves a local summary of the work and checks. Publishing, deployment and release decisions remain yours.</> },
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
    <header className="landing-header"><div className="landing-shell header-inner">
      <Brand />
      <nav className="desktop-nav" aria-label="Main navigation"><a href="#landing-workflow">How it works</a><a href="#landing-specialists">Specialists</a><a href="/docs/">Docs</a></nav>
      <div className="header-actions"><a className="source-link" href={github}>GitHub <ArrowUpRight aria-hidden="true" /></a><Button asChild size="sm"><a href="#landing-install">Get started <ArrowRight aria-hidden="true" /></a></Button></div>
      <details className="mobile-menu" ref={menu}><summary><Menu aria-hidden="true" /><span className="sr-only">Menu</span></summary><nav aria-label="Mobile navigation" onClick={event => { if (event.target instanceof Element && event.target.closest('a') && menu.current) menu.current.open = false; }}><a href="#landing-workflow">How it works</a><a href="#landing-specialists">Specialists</a><a href="/docs/">Documentation</a><a href={github}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href="#landing-install">Get started <ArrowRight aria-hidden="true" /></a></nav></details>
    </div></header>
    <main id="landing-main" className="landing-shell">
      <section className="landing-hero" aria-labelledby="landing-title">
        <p className="eyebrow"><GitBranch aria-hidden="true" /> Open source. Built around your code.</p>
        <h1 id="landing-title">A clear path<br />from idea to product.</h1>
        <p className="landing-intro">Research, plan, design, build and review software.<br className="desktop-break" /> Keep the decisions and the work together, from the first brief to the final checks.</p>
        <div className="hero-actions"><Button asChild size="lg"><a href="#landing-install">Install Foundry <ArrowRight aria-hidden="true" /></a></Button><Button asChild variant="outline" size="lg"><a href="/docs/"><BookOpen aria-hidden="true" /> Read the docs</a></Button></div>
        <p className="hero-note">Your tools. Your project. You decide what ships.</p>
      </section>
      <section id="landing-install" className="install-section" aria-labelledby="install-title">
        <div className="install-heading"><div><p className="section-label">Start here</p><h2 id="install-title">Small install. Real work.</h2></div><p>Node 24 or newer, npm and Git.<br />Choose your provider when you create a project.</p></div>
        <div className="install-panel"><div className="command-heading"><span><span className="command-dot" aria-hidden="true" /> Terminal</span><CopyButton text={install} /></div><pre tabIndex={0} aria-label="Installation commands"><code>{install}</code></pre></div>
        <div className="availability" aria-label="Available versions"><div><span className="availability-label">Terminal <span className="badge">Published</span></span><p>npm 0.5.1. Research to local handoff.</p><a href="/docs/getting-started/">Installation guide <ArrowUpRight aria-hidden="true" /></a></div><div><span className="availability-label">Coding client <span className="badge">Source preview</span></span><p>Use your client’s model, tools and account. Not in npm 0.5.1.</p><a href="/docs/connected-client/">Connect from source <ArrowUpRight aria-hidden="true" /></a></div><div><span className="availability-label">Managed workspace <span className="badge">In development</span></span><p>Not in the published package. Homebrew is not available.</p><a href="/docs/architecture/">What exists today <ArrowUpRight aria-hidden="true" /></a></div></div>
      </section>
      <section id="landing-workflow" className="workflow-section section-grid" aria-labelledby="workflow-title"><div className="section-heading"><p className="section-label">How it works</p><h2 id="workflow-title">Build products,<br />step by step.</h2><p>Start a new product or make a change to an existing repository. Review the important decisions before the next stage.</p><a className="text-link" href="/docs/workflow/">Explore the workflow <ArrowRight aria-hidden="true" /></a></div><ProductWalkthrough /></section>
      <section id="landing-specialists" className="specialists-section" aria-labelledby="specialists-title"><div className="section-intro"><div><p className="section-label">The right focus for each step</p><h2 id="specialists-title">Different work.<br />Different specialists.</h2></div><p>Each assignment has a clear job and a result to review. In the connected workflow, your coding client carries out the assignments. Role names are not separate running agents.</p></div><ul className="specialist-grid">{specialists.map(({ name, description, icon: Icon }) => <li key={name}><Icon aria-hidden="true" /><h3>{name}</h3><p>{description}</p></li>)}</ul><a className="text-link" href="/docs/catalog/">View all specialist roles <ArrowRight aria-hidden="true" /></a></section>
      <section className="evidence-section section-grid" aria-labelledby="evidence-title"><div className="section-heading"><p className="section-label">Keep the thread</p><h2 id="evidence-title">Less starting over.<br />More moving forward.</h2><p>The next session should know what was decided, what changed and what still needs work.</p></div><dl className="evidence-list"><div><dt><ShieldCheck aria-hidden="true" /> Approvals before action</dt><dd>Review the exact Plan and Design. Changed decisions need a fresh approval.</dd></div><div><dt><GitBranch aria-hidden="true" /> Progress you can pick up</dt><dd>Save tasks, decisions and handoff notes so another session can continue.</dd></div><div><dt><ListChecks aria-hidden="true" /> Checks against real changes</dt><dd>Keep passing results tied to the code they tested. Changed inputs need fresh checks.</dd></div></dl></section>
      <section className="faq-section section-grid" aria-labelledby="faq-title"><div className="section-heading"><p className="section-label">A few useful details</p><h2 id="faq-title">Before you begin.</h2><p>More questions?<br /><a className="text-link" href="/docs/">Start with the docs <ArrowUpRight aria-hidden="true" /></a></p></div><div className="faq-list">{questions.map(question => <details key={question.title}><summary>{question.title}<span className="disclosure-icon" aria-hidden="true">+</span></summary><div className="faq-answer">{question.answer}</div></details>)}</div></section>
    </main>
    <footer className="landing-footer"><div className="landing-shell footer-inner"><div><Brand /><p>A little structure for the work ahead.</p></div><nav aria-label="Footer navigation"><a href="/docs/">Documentation</a><a href={github}>GitHub <ArrowUpRight aria-hidden="true" /></a><a href={`${github}/blob/main/LICENSE`}>MIT License</a><a href="/docs/component-sources/">Component sources</a></nav></div></footer>
  </div>;
}

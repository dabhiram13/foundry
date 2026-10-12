import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code,
  LayoutTemplate,
  ListChecks,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { SpecialistScene } from './specialist-scene';

const repository = 'https://github.com/dabhiram13/foundry';
const install = 'npm install -g @dabhiram13/foundry\nfoundry';
const specialists = [
  {
    name: 'Research',
    description: 'Sources, findings and open questions.',
    artifact: 'Research brief',
    icon: Search,
  },
  {
    name: 'Plan',
    description: 'A clear scope and small tasks.',
    artifact: 'You approve',
    icon: ListChecks,
  },
  {
    name: 'Design',
    description: 'User flow and implementation approach.',
    artifact: 'You approve',
    icon: LayoutTemplate,
  },
  {
    name: 'Build',
    description: 'Focused changes from relevant specialists.',
    artifact: 'Small implementation tasks',
    icon: Code,
  },
  {
    name: 'Review',
    description: 'Actual checks, risks and unresolved gaps.',
    artifact: 'Current evidence',
    icon: ShieldCheck,
  },
  {
    name: 'Handoff',
    description: 'What changed, what remains and the next action.',
    artifact: 'Local summary',
    icon: Check,
  },
];

function CopyInstall() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(install);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }
  return (
    <div className="install-copy">
      <button className="mist-copy" onClick={copy}>
        Copy commands
      </button>
      <span role="status">
        {status === 'copied'
          ? 'Commands copied.'
          : status === 'failed'
            ? 'Could not copy. Select the commands above.'
            : 'Install, then open Foundry.'}
      </span>
    </div>
  );
}

export function Landing() {
  return (
    <div className="landing-page">
      <svg
        className="mist-landscape"
        viewBox="0 0 1440 1200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="1440" height="1200" fill="#dce9eb" />
        <path
          fill="#bdced0"
          d="M0 560 Q130 430 290 580 T580 540 T940 590 T1200 500 L1440 580 V1200 H0Z"
        />
        <path
          fill="#95b1b8"
          d="M0 900 Q190 650 360 800 T700 720 T1100 800 T1440 700 V1200 H0Z"
        />
        <path
          fill="#67868f"
          d="M0 1140 Q280 930 500 1050 T920 1000 T1440 1040 V1200 H0Z"
        />
      </svg>
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <div className="mist-page">
        <header className="landing-header">
          <div className="landing-header-inner">
            <a
              className="landing-brand"
              href="#landing-main"
              aria-label="Foundry home"
            >
              <span className="brand-key" aria-hidden="true">
                f
              </span>
              foundry
            </a>
            <nav className="landing-nav" aria-label="Introduction">
              <a href="#landing-workflow">How it works</a>
              <a className="nav-extra" href="#landing-specialists">
                Specialists
              </a>
              <a href="/docs/">Docs</a>
            </nav>
            <a className="mist-pill" href="#landing-install">
              Get started <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </header>
        <main id="landing-main" tabIndex={-1}>
          <section
            className="landing-shell landing-hero"
            aria-labelledby="landing-title"
          >
            <p className="mist-eyebrow">
              The product-building workflow for coding agents
            </p>
            <h1 id="landing-title">
              Your idea.
              <br />A whole team behind it.
            </h1>
            <p className="landing-intro">
              Research, plan, design, build and review.
              <br />
              Specialist roles. Shared progress. Your coding agent.
            </p>
            <div className="landing-hero-actions">
              <a className="mist-pill" href="#landing-install">
                Find your setup <ArrowUpRight aria-hidden="true" />
              </a>
              <a className="landing-secondary" href="#landing-workflow">
                Explore the workflow <ArrowDown aria-hidden="true" />
              </a>
            </div>
            <p className="landing-local-note">
              Your code. Your model. Your decisions.
            </p>
            <SpecialistScene />
            <div
              className="connection-strip"
              aria-label="Foundry coordinates work through your coding client"
            >
              <span>Your coding client</span>
              <b aria-hidden="true">+</b>
              <span>Foundry</span>
              <b aria-hidden="true">→</b>
              <span>Your product</span>
            </div>
            <p className="connection-note">
              OpenCode connection is a source preview. Full connected
              specialists are next.
            </p>
          </section>
          <section
            className="landing-shell mist-section"
            id="landing-workflow"
            tabIndex={-1}
            aria-labelledby="workflow-title"
          >
            <div className="mist-heading">
              <p className="mist-eyebrow">One idea. A clear path forward.</p>
              <h2 id="workflow-title">
                Every specialist knows
                <br />
                what comes next.
              </h2>
              <p>
                From the first question to the final handoff.
                <br />
                Less context to reconstruct. More work you can review.
              </p>
            </div>
            <div className="journey-panel">
              <div className="journey-heading">
                <strong>Idea → product handoff</strong>
                <span>Workflow illustration</span>
              </div>
              <ol className="journey-grid">
                {specialists.map(({ name, description, artifact }, index) => (
                  <li
                    className={
                      name === 'Build'
                        ? 'journey-card journey-ink'
                        : 'journey-card'
                    }
                    key={name}
                  >
                    <span className="journey-number">
                      0{index + 1} / {name.toUpperCase()}
                    </span>
                    <h3>{name}</h3>
                    <p>{description}</p>
                    <span className="journey-artifact">{artifact}</span>
                  </li>
                ))}
              </ol>
              <p className="journey-caption">
                These stages exist in the terminal workflow. Bringing the full
                specialist journey into the connected client is planned. This is
                not a new browser workspace.
              </p>
            </div>
            <a className="section-link" href="/docs/workflow/">
              Read the current workflow <ArrowRight aria-hidden="true" />
            </a>
          </section>
          <section
            className="landing-shell mist-section"
            id="landing-specialists"
            tabIndex={-1}
            aria-labelledby="specialists-title"
          >
            <div className="mist-heading">
              <p className="mist-eyebrow">More than a collection of prompts</p>
              <h2 id="specialists-title">
                A team-shaped workflow.
                <br />
                Not another coding assistant.
              </h2>
              <p>
                Relevant roles, useful context and clear handoffs.
                <br />
                Not 28 agents running for every task.
              </p>
            </div>
            <div className="capability-grid">
              <article className="capability-card">
                <div className="capability-art" aria-hidden="true">
                  <div className="mini-flow">
                    <span>Planner</span>
                    <span className="mini-foundry">foundry</span>
                    <span>Builder</span>
                  </div>
                </div>
                <h3>The right specialist</h3>
                <p>
                  Research, planning, design and implementation roles work
                  through the selected provider. The connected direction uses
                  your host client's own model and tools.
                </p>
              </article>
              <article className="capability-card">
                <div className="capability-art" aria-hidden="true">
                  <div className="mini-stack">
                    <span>Research brief</span>
                    <span>Approved plan</span>
                    <span>Design approach</span>
                  </div>
                </div>
                <h3>Decisions you can follow</h3>
                <p>
                  Keep scope, approvals and saved progress attached to the work.
                  Continue without reconstructing the whole conversation.
                </p>
              </article>
              <article className="capability-card">
                <div className="capability-art" aria-hidden="true">
                  <div className="mini-record">
                    <strong>Reviewable handoff</strong>
                    <span>What changed</span>
                    <span>What was checked</span>
                    <span>What remains</span>
                  </div>
                </div>
                <h3>An honest finish</h3>
                <p>
                  Save evidence and surface gaps when it becomes stale. Passing
                  checks support review; they do not guarantee correctness.
                </p>
              </article>
            </div>
            <ul className="specialist-grid">
              {specialists.map(({ name, description, icon: Icon }) => (
                <li key={name}>
                  <Icon aria-hidden="true" />
                  <h3>{name}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ul>
            <a className="section-link" href="/docs/catalog/">
              Explore the specialist roles <ArrowRight aria-hidden="true" />
            </a>
          </section>
          <div className="landing-shell">
            <div className="mist-banner">
              <svg
                viewBox="0 0 1100 240"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <rect fill="#dce9eb" width="1100" height="240" />
                <path
                  fill="#bdced0"
                  d="M0 190 Q190 150 380 190 T740 160 T1100 180 V240 H0Z"
                />
                <path
                  fill="#95b1b8"
                  d="M0 230 Q280 160 550 220 T1100 185 V240 H0Z"
                />
              </svg>
              <p>
                Keep the big picture.
                <br />
                Build in small steps.
                <small>
                  New products or changes to an existing repository.
                </small>
              </p>
            </div>
          </div>
          <section
            className="landing-shell mist-section"
            id="landing-install"
            tabIndex={-1}
            aria-labelledby="install-title"
          >
            <div className="mist-heading">
              <p className="mist-eyebrow">
                One core. Different ways to connect.
              </p>
              <h2 id="install-title">
                Stay in the tool
                <br />
                you already use.
              </h2>
              <p>
                Keep the installation choices honest.
                <br />
                Here is what is available today.
              </p>
            </div>
            <div className="install-grid">
              <article className="install-card">
                <p className="install-label">Available now</p>
                <h3>npm</h3>
                <p>
                  Published CLI package: <strong>0.5.1</strong>.<br />
                  Requires Node.js 24+, npm and Git.
                </p>
                <pre aria-label="Installation commands">
                  <code>{install}</code>
                </pre>
                <CopyInstall />
                <p className="install-note">
                  The current npm release uses the terminal/provider workflow.
                  The new client connection is not in 0.5.1.
                </p>
                <a href="/docs/getting-started/">
                  Start with the published CLI{' '}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </article>
              <article className="install-card install-dark">
                <p className="install-label">Source preview</p>
                <h3>OpenCode</h3>
                <p>
                  Scoped work, approval review, configured checks and recovery.
                </p>
                <div className="install-summary">
                  Local MCP + a project skill
                </div>
                <p className="install-note">
                  OpenCode keeps your chat, model and account. Tool discovery is
                  qualified; a live model-driven run is not. Approval remains a
                  separate terminal action.
                </p>
                <a href="/docs/commands/">
                  Read the connection instructions{' '}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </article>
              <article className="install-card">
                <p className="install-label">Planned</p>
                <h3>Homebrew</h3>
                <p>The same core, through an owner-maintained tap.</p>
                <div className="install-summary">Not published yet</div>
                <p className="install-note">
                  The tap, formula and installation tests must be completed
                  before an install command is offered.
                </p>
                <a href="/docs/releasing/">
                  Follow the release requirements{' '}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </article>
            </div>
            <p className="setup-footer">
              Already have a repository?{' '}
              <a href="/docs/runtime/">
                Use the shorter scoped-work flow{' '}
                <ArrowRight aria-hidden="true" />
              </a>
            </p>
          </section>
          <section
            className="landing-shell landing-faq"
            aria-labelledby="questions-title"
          >
            <div>
              <h2 id="questions-title">
                Good questions.
                <br />
                Clear answers.
              </h2>
              <p>What Foundry does, and what it leaves to you.</p>
            </div>
            <div>
              <details open>
                <summary>Is Foundry just for checks?</summary>
                <p>
                  No. Its goal is specialist-led product building: research,
                  planning, design, implementation and review. Checks and
                  current evidence support that journey. The source-preview
                  connection now carries Research, Plan, Design, Build and Review
                  through saved specialist assignments.
                </p>
              </details>
              <details>
                <summary>Does it open another AI agent?</summary>
                <p>
                  The connected direction uses the host coding client's model
                  and tools, not a second AI runtime. The existing terminal
                  product workflow uses separately configured provider adapters.
                </p>
              </details>
              <details>
                <summary>Are all coding clients supported?</summary>
                <p>
                  No. OpenCode is the first source-preview connection. Other
                  clients need their own qualification; MCP alone does not
                  establish complete compatibility.
                </p>
              </details>
              <details>
                <summary>Does my code stay on my computer?</summary>
                <p>
                  Your files and Git history stay in your project. Cloud
                  providers receive prompts and selected project content.
                  Foundry is not a sandbox; keep secrets out of prompts.
                </p>
              </details>
              <details>
                <summary>Will Foundry publish or deploy my product?</summary>
                <p>
                  No. Ship creates a local summary of completed work and
                  evidence. You decide where and when to publish or deploy.
                </p>
              </details>
            </div>
          </section>
          <section className="landing-shell mist-closing">
            <p className="mist-eyebrow">Your idea. Your agent. Your product.</p>
            <h2>
              Give your work
              <br />a clear direction.
            </h2>
            <a className="mist-pill" href="#landing-install">
              Find your starting point <ArrowUpRight aria-hidden="true" />
            </a>
          </section>
        </main>
        <footer className="landing-footer">
          <div className="footer-top">
            <p>
              Built around your coding agent.
              <br />
              <span>Local by design. Provider-neutral.</span>
            </p>
            <nav aria-label="Resources">
              <a href="/docs/">Documentation</a>
              <a href={repository}>GitHub</a>
              <a href="/docs/notices/">Licenses</a>
            </nav>
          </div>
          <div className="landing-wordmark" aria-hidden="true">
            foundry
          </div>
          <p className="footer-note">
            Open source. Your code and history stay in your project.
          </p>
        </footer>
      </div>
    </div>
  );
}

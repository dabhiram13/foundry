import { ArrowUpRight } from 'lucide-react';

const stages = [
  { name: 'Research', role: 'Market researcher', output: 'Source-backed brief', description: 'Explore the problem, capture sources and separate useful findings from assumptions.' },
  { name: 'Plan', role: 'Planner', output: 'Scope and task plan', description: 'Define what to build, how to judge it and which small tasks come first. Pause for your approval.' },
  { name: 'Design', role: 'Designer', output: 'Flows and design decisions', description: 'Shape the experience before implementation. Review the design and approve the exact revision.' },
  { name: 'Build', role: 'Relevant builders', output: 'Focused code changes', description: 'Implement in small tasks, run configured checks, make bounded repairs and save completed work in Git.' },
  { name: 'Review', role: 'Quality reviewer', output: 'Findings and evidence', description: 'Inspect what was built, check the results and make gaps visible. Failed work does not become a pass.' },
  { name: 'Handoff', role: 'Completion specialist', output: 'Local work summary', description: 'Bring the work, evidence and remaining decisions together. You choose whether and where to publish.' },
];

export function ProductWalkthrough() {
  return <div className="product-walkthrough" aria-label="How Foundry works">
    <p className="walkthrough-intro">The product journey<br /><span>Expand a stage to see its assignment and output.</span></p>
    <div className="walkthrough-stages">{stages.map((stage, index) => <details key={stage.name} name="foundry-stages" open={index === 0}>
      <summary><span className="stage-index">{String(index + 1).padStart(2, '0')}</span><h3>{stage.name}</h3><span className="stage-plus" aria-hidden="true">+</span></summary>
      <div className="stage-detail"><p>{stage.description}</p><dl><div><dt>Assignment</dt><dd>{stage.role}</dd></div><div><dt>Output</dt><dd>{stage.output}</dd></div></dl></div>
    </details>)}</div>
    <p className="walkthrough-caption">In the CLI, the final stages are called Test and Ship. Ship is a local handoff, not automatic deployment.</p>
    <a className="foundry-link" href="/docs/workflow/">Read the full workflow <ArrowUpRight aria-hidden="true" /></a>
  </div>;
}

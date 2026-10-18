import { ArrowUpRight } from 'lucide-react';

const stages = [
  { name: 'Research', role: 'Market researcher', output: 'Findings and sources', description: 'Understand the problem, save sources and note what is still uncertain.' },
  { name: 'Plan', role: 'Planner', output: 'Requirements and tasks', description: 'Decide what to build, how to check it and which tasks come first. Approve the plan before continuing.' },
  { name: 'Design', role: 'Designer', output: 'An approved visual direction', description: 'Work through screens, flows and component states. The connected source workflow requires a running preview and captured desktop and mobile views before interface approval.' },
  { name: 'Build', role: 'Builders', output: 'Code changes', description: 'Write code in small tasks, run checks and save progress. Terminal builds also retry failed tasks and save Git checkpoints.' },
  { name: 'Review', role: 'Quality reviewer', output: 'Review findings', description: 'Review the code against the requirements and check the results. Record gaps that still need fixing.' },
  { name: 'Handoff', role: 'Foundry', output: 'Project summary', description: 'Summarize the work, check results and remaining steps. You decide when and where to publish.' },
];

export function ProductWalkthrough() {
  return <div className="product-walkthrough" aria-label="How Foundry works">
    <p className="walkthrough-intro">Six steps, with a clear result at each one.</p>
    <div className="walkthrough-stages">{stages.map((stage, index) => <details key={stage.name} name="foundry-stages" open={index === 0}>
      <summary><span className="stage-index">{String(index + 1).padStart(2, '0')}</span><h3>{stage.name}</h3><span className="stage-plus" aria-hidden="true">+</span></summary>
      <div className="stage-detail"><p>{stage.description}</p><dl><div><dt>Role</dt><dd>{stage.role}</dd></div><div><dt>Result</dt><dd>{stage.output}</dd></div></dl></div>
    </details>)}</div>
    <p className="walkthrough-caption">In the terminal, the last stages are called Test and Ship. Ship writes a project summary; it does not publish or deploy.</p>
    <a className="foundry-link" href="/docs/workflow/">Read how it works <ArrowUpRight aria-hidden="true" /></a>
  </div>;
}

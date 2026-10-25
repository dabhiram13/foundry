import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowRight } from 'lucide-react';

const stages = [
  { name: 'Research', label: 'Define the problem', file: 'research.md', detail: 'Find the requirements and open questions.', title: 'Team invitations', lines: ['Who can send an invitation?', 'What happens when a link expires?', 'What does a new teammate see?'] },
  { name: 'Plan', label: 'Approve the plan', file: 'plan.md', detail: 'Choose the scope and checks before coding.', title: 'Tasks', lines: ['Create invitations with an expiry date', 'Check permissions on the server', 'Test expired and reused links'] },
  { name: 'Design', label: 'Review the design', file: 'design.md', detail: 'Approve desktop, mobile and error states.', title: 'Invitation flow', lines: ['Enter a teammate’s email', 'Confirm the invitation was sent', 'Offer a way back when the link expires'] },
  { name: 'Build', label: 'Make the changes', file: 'invitations.ts', detail: 'Your coding tool works through the approved tasks.', title: 'Owner-only invitations', lines: ['+ requireProjectOwner(currentUser);', '+ const invitation = createInvitation(email);', '+ return sendInvitation(invitation);'] },
  { name: 'Review', label: 'Verify the result', file: 'review.md', detail: 'Run checks against the current changes.', title: 'Rules to test', lines: ['Reject expired invitations', 'Accept each invitation only once', 'Allow only owners to invite'] },
  { name: 'Handoff', label: 'Review the handoff', file: 'handoff.md', detail: 'Keep changes, checks and open work together.', title: 'Local summary', lines: ['What changed and why', 'Which checks ran', 'What still needs attention'] },
];

export function ProductWalkthrough() {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const stage = stages[active];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % stages.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + stages.length) % stages.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stages.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
    buttons.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }

  return <div className="product-walkthrough" aria-label="How Foundry works">
    <div role="tablist" aria-label="Foundry workflow" aria-orientation="horizontal" className="walkthrough-stages">
      {stages.map((step, index) => <button type="button" role="tab" key={step.name} id={`stage-${index}`} aria-selected={active === index} aria-controls="stage-panel" tabIndex={active === index ? 0 : -1} ref={el => { buttons.current[index] = el; }} onClick={() => setActive(index)} onKeyDown={event => onKeyDown(event, index)}><span className="stage-surface" aria-hidden="true" /><strong>{step.name}</strong></button>)}
    </div>
    <div className="walkthrough-scene">
      <div className="scene-backdrop" aria-hidden="true" />
      <div className="walkthrough-heading"><span>Team invitations</span><span>Example workflow</span></div>
      <div className="scene-card" id="stage-panel" role="tabpanel" aria-labelledby={`stage-${active}`} tabIndex={0}>
        <div className="scene-card-header"><img src="/assets/foundry-mark.svg" width="22" height="22" alt="" /><span>Foundry</span><span className="scene-file">{stage.file}</span></div>
        <div className="scene-card-body" key={stage.name}>
          <h3>{stage.label}</h3><p className="scene-detail">{stage.detail}</p>
          <div className={`scene-artifact artifact-${stage.name.toLowerCase()}`}><p>{stage.title}</p><ul>{stage.lines.map((line, index) => <li key={line} style={{ animationDelay: `${index * 65}ms` }}><span className="artifact-marker" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{line}</span></li>)}</ul></div>
        </div>
      </div>
    </div>
    <div className="walkthrough-caption"><p>Example, not a live session. Handoff saves a local summary; it does not publish.</p><a className="walkthrough-more" href="/docs/workflow/">See the workflow <ArrowRight aria-hidden="true" /></a></div>
  </div>;
}

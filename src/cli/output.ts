import type { WorkContext } from '../core/lifecycle.js';
import type { ScopeReview } from '../core/scope.js';

type JsonRecord = Record<string, unknown>;

export function renderWorkContext(context: WorkContext): string {
  const run = context.run;
  const lines = [run ? `${run.slug}${run.historical ? ' (completed history)' : ''}` : 'No scoped work yet.'];
  if (run) lines.push(`Saved progress: ${run.saved_status}`, `Specification: ${run.spec.path}`);
  if (context.scope) lines.push(`Scope approval: ${context.scope_approval}`, `Coverage: ${context.requirements_coverage === 'checks_passed' ? 'Mapped required checks passed.' : context.requirements_coverage}`);
  const evidence = {
    current: 'Required checks passed for the current inputs.',
    missing: 'No verification recorded.',
    stale: 'The saved verification does not match the current inputs.',
    failed: 'The recorded verification did not pass.',
    invalid: 'Verification evidence is missing, interrupted or invalid.',
  }[context.evidence.status];
  lines.push(`Evidence: ${evidence}`, `Next: ${context.next_action.reason}`);
  return `${lines.join('\n')}\n`;
}

export function renderScopeReview(scope: ScopeReview): string {
  const lines = [`Specification: ${scope.spec.path}`, scope.spec.text.trim(), '', 'Acceptance criteria:'];
  for (const criterion of scope.criteria) {
    lines.push(`${criterion.id}: ${criterion.requirement}`, `  Checks: ${criterion.checks.join(', ') || 'not mapped'}`);
  }
  lines.push('', 'Configured checks:');
  for (const check of scope.checks) {
    lines.push(`${check.name} (${check.required ? 'required' : 'optional'}): ${JSON.stringify(check.command)}`,
      `  Directory: ${check.cwd}; timeout: ${check.timeout}s; inputs: ${check.inputs.join(', ') || 'workspace'}; environment names: ${check.environment.join(', ') || 'none'}`);
  }
  lines.push('', `Approval: ${scope.approval.status}`, ...scope.blockers, `Revision: ${scope.revision}`,
    'After reviewing, run work approve --revision HASH with this revision and the same --project path.');
  return `${lines.join('\n')}\n`;
}

function scalar(value: unknown): string {
  if (value === null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function human(value: unknown, indent = ''): string {
  if (Array.isArray(value)) {
    if (!value.length) return `${indent}(none)`;
    return value.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return `${indent}- ${scalar(item)}`;
      }
      const record = item as JsonRecord;
      const labelKey = ['name', 'id', 'slug', 'title'].find((key) => record[key] !== undefined);
      const label = labelKey ? record[labelKey] : 'item';
      const status = record.status ? ` (${String(record.status)})` : '';
      const details = Object.entries(record)
        .filter(([key]) => !['name', 'id', 'slug', 'status'].includes(key) && !(key === 'title' && labelKey === 'title'))
        .map(([key, child]) => {
          if (child !== null && typeof child === 'object') {
            return `${indent}  ${key}:\n${human(child, `${indent}    `)}`;
          }
          return `${indent}  ${key}: ${scalar(child)}`;
        });
      return [`${indent}- ${String(label)}${status}`, ...details].join('\n');
    }).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as JsonRecord).map(([key, child]) => {
      if (child !== null && typeof child === 'object') {
        return `${indent}${key}:\n${human(child, `${indent}  `)}`;
      }
      return `${indent}${key}: ${scalar(child)}`;
    }).join('\n');
  }
  return `${indent}${scalar(value)}`;
}

export function render(value: unknown, json: boolean): string {
  if (json) return `${JSON.stringify(value)}\n`;
  if (Array.isArray(value) && !value.length) return 'No results.\n';
  return `${human(value)}\n`;
}

export function writeResult(value: unknown, json: boolean): void {
  process.stdout.write(render(value, json));
}

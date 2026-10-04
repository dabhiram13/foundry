import { readFile, readdir, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import {
  atomicJson, canonicalJson, digest, digestJson, exists, findProjectRoot, FoundryError, normalizeLocalPath,
  now, readJson, within, withProcessLock,
} from './fs.js';
import { activeRun, requireRuntimeWorkspace } from './lifecycle.js';

export const WORKFLOW_LEDGER = 'docs/project/marketcraft.json';
const WORKFLOW_LOCK = 'docs/project/.marketcraft.lock';
const STAGES = ['intake', 'research', 'opportunity', 'scope', 'flows', 'prototype', 'design', 'build', 'verify', 'release', 'learn', 'maintain'] as const;
const METHODS = ['command', 'browser', 'manual', 'customer', 'document'] as const;
type JsonRecord = Record<string, unknown>;

const sourceSchema = z.object({
  kind: z.enum(['owner', 'local', 'url', 'customer', 'observation']),
  ref: z.string().min(1),
  observed_at: z.string().min(1),
  published_at: z.string().optional(),
  author: z.string().min(1).optional(),
}).strict();

const recordSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/),
  kind: z.enum(['brief', 'assumption', 'decision', 'artifact', 'criterion', 'evidence', 'experiment', 'feedback']),
  title: z.string().min(1),
  source: sourceSchema,
  basis: z.enum(['observed', 'inferred']),
  status: z.enum(['proposed', 'accepted']),
  supersedes: z.string().optional(),
  expires_at: z.string().optional(),
  references: z.array(z.string()).default([]),
  contracts: z.array(z.string()).default([]),
  inputs: z.array(z.string()).default([]),
  counterevidence: z.array(z.string()).default([]),
  accepted_by: z.string().optional(),
  acceptance_ref: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  segment: z.string().optional(),
  workflow: z.string().optional(),
}).passthrough();

const requiredFields: Record<string, readonly string[]> = {
  brief: ['goal', 'buyer', 'intent', 'complexity', 'surface', 'constraints', 'capabilities'],
  assumption: ['validation'],
  decision: ['rationale'],
  artifact: ['path', 'stage', 'owner', 'next_action', 'criteria'],
  criterion: ['stage', 'required', 'expected', 'method'],
  evidence: ['claim'],
  experiment: ['hypothesis', 'metric', 'success_condition', 'stop_condition', 'operating_scope', 'outcome_evidence'],
  feedback: ['criteria', 'next_task', 'operating_scope'],
};
const allowedFields: Record<string, readonly string[]> = {
  brief: ['goal', 'buyer', 'intent', 'complexity', 'surface', 'constraints', 'capabilities', 'market'],
  assumption: ['validation'],
  decision: ['rationale'],
  artifact: ['path', 'stage', 'owner', 'next_action', 'criteria'],
  criterion: ['stage', 'required', 'expected', 'method', 'command', 'quality'],
  evidence: ['claim', 'artifact', 'method', 'outcome', 'observed', 'criteria', 'check', 'quality', 'market'],
  experiment: ['hypothesis', 'metric', 'success_condition', 'stop_condition', 'operating_scope', 'outcome_evidence'],
  feedback: ['reproduction', 'criteria', 'next_task', 'operating_scope'],
};
const commonFields = new Set([
  'id', 'kind', 'title', 'source', 'basis', 'status', 'supersedes', 'expires_at',
  'references', 'contracts', 'inputs', 'counterevidence', 'accepted_by', 'acceptance_ref',
  'confidence', 'segment', 'workflow',
]);
const PATH_OUTCOMES: Record<string, string> = {
  scope: 'A bounded goal, non-goals and observable acceptance criteria',
  research: 'Dated buyer/workflow evidence and counterevidence for consequential uncertainties',
  opportunity: 'A switching case, pricing/channel hypotheses and a bounded validation experiment',
  flows: 'Flows, navigation, realistic content and loading/empty/error/recovery states',
  prototype: 'A wireframe or prototype covering the critical journey',
  design: 'Visual direction, tokens, components, responsive behavior and copy',
  build: 'One working vertical slice through the required layers',
  verify: 'Behavior and relevant usability/accessibility/rendered evidence on current inputs',
  release: 'Authorized target, verified revision and recovery procedure',
  learn: 'Outcome measurements and scoped customer-feedback followups',
};

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function date(value: unknown, label: string): Date {
  if (!text(value)) throw new FoundryError(`${label} needs an ISO date or timezone-aware timestamp`);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new FoundryError(`${label} timestamp needs a timezone`);
  }
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(parsed.valueOf()) || dateOnly && parsed.toISOString().slice(0, 10) !== value) {
    throw new FoundryError(`Invalid ${label}: use an ISO date or timezone-aware timestamp`);
  }
  return parsed;
}

function list(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => !text(item)) || new Set(value).size !== value.length) {
    throw new FoundryError(`${label} must be a list of unique nonempty strings`);
  }
  return [...value];
}

function local(root: string, value: unknown): string {
  const normalized = normalizeLocalPath(root, value);
  if (normalized === WORKFLOW_LEDGER || normalized === WORKFLOW_LOCK) {
    throw new FoundryError('The workflow ledger and lock cannot be recorded as inputs');
  }
  return normalized;
}

function links(item: JsonRecord): string[] {
  return [...new Set(['references', 'contracts', 'counterevidence', 'criteria', 'outcome_evidence']
    .flatMap((key) => Array.isArray(item[key]) ? item[key].filter((value): value is string => typeof value === 'string') : []))].sort();
}

async function loadLedger(root: string): Promise<{ schema_version: 1; project_id: string | null; records: JsonRecord[] }> {
  const file = within(root, WORKFLOW_LEDGER);
  if (!(await exists(root, WORKFLOW_LEDGER))) return { schema_version: 1, project_id: null, records: [] };
  try {
    const value = await readJson<unknown>(file);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('envelope must be an object');
    const envelope = value as JsonRecord;
    if (Object.keys(envelope).sort().join(',') !== 'project_id,records,schema_version'
      || envelope.schema_version !== 1 || typeof envelope.project_id !== 'string'
      || !z.string().uuid().safeParse(envelope.project_id).success || !Array.isArray(envelope.records)) {
      throw new Error('invalid workflow ledger envelope');
    }
    const records: JsonRecord[] = [];
    const earlier: Record<string, JsonRecord> = {};
    for (const raw of envelope.records) {
      const item = await validateRecord(root, raw, earlier, true);
      records.push(item);
      earlier[String(item.id)] = item;
    }
    return { schema_version: 1, project_id: String(envelope.project_id), records };
  } catch (error) {
    if (error instanceof FoundryError) throw error;
    throw new FoundryError(`Invalid workflow ledger: ${(error as Error).message}`, { cause: error });
  }
}

async function validateRecord(root: string, payload: unknown, earlier: Record<string, JsonRecord>, stored: boolean): Promise<JsonRecord> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new FoundryError('A record must be a JSON object');
  const item = structuredClone(payload) as JsonRecord;
  const parsed = recordSchema.safeParse(item);
  if (!parsed.success) throw new FoundryError(`Invalid record: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  const kind = String(item.kind);
  const allowed = new Set([...commonFields, ...(allowedFields[kind] ?? []), ...(stored ? ['created_at', 'input_revisions', 'reference_revisions'] : [])]);
  const unknown = Object.keys(item).filter((key) => !allowed.has(key));
  if (unknown.length) throw new FoundryError(`Unknown ${kind} fields: ${unknown.sort().join(', ')}`);
  if (String(item.id) in earlier) throw new FoundryError(`Record ${String(item.id)} already exists; append a new ID with supersedes`);
  const generated = new Set(['created_at', 'input_revisions', 'reference_revisions']);
  if (!stored && [...generated].some((key) => key in item)) throw new FoundryError('Generated record fields are not accepted from the CLI');
  if (stored && (!text(item.created_at) || typeof item.input_revisions !== 'object' || typeof item.reference_revisions !== 'object')) {
    throw new FoundryError('Stored record is missing generated provenance fields');
  }
  if (stored) date(item.created_at, 'created_at');
  for (const key of requiredFields[kind] ?? []) if (!(key in item)) throw new FoundryError(`${kind} requires ${key}`);
  for (const [key, value] of Object.entries(item)) {
    if (['quality', 'market', 'source', 'references', 'contracts', 'counterevidence', 'inputs', 'criteria', 'outcome_evidence',
      'constraints', 'capabilities', 'required', 'command', 'method', 'outcome', 'intent', 'complexity', 'surface',
      'stage', 'status', 'kind', 'basis', 'id', 'supersedes', 'expires_at', 'created_at', 'input_revisions',
      'reference_revisions'].includes(key)) continue;
    if (!text(value)) throw new FoundryError(`${key} must be nonempty text`);
  }
  for (const key of ['references', 'contracts', 'counterevidence', 'inputs', 'criteria', 'outcome_evidence', 'constraints', 'capabilities']) {
    if (key in item) item[key] = list(item[key], key);
  }
  for (const key of ['references', 'contracts', 'counterevidence', 'inputs']) item[key] ??= [];
  if (item.expires_at !== undefined) date(item.expires_at, 'expires_at');
  if (item.source && typeof item.source === 'object') {
    const source = item.source as JsonRecord;
    date(source.observed_at, 'source.observed_at');
    if (source.published_at !== undefined) date(source.published_at, 'source.published_at');
    if (source.kind === 'url') {
      const url = new URL(String(source.ref));
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
        throw new FoundryError('A source URL needs http(s), a host, and no embedded credentials');
      }
    }
    if (source.kind === 'local') source.ref = local(root, source.ref);
  }
  if (item.stage !== undefined && !STAGES.includes(item.stage as typeof STAGES[number])) throw new FoundryError(`stage must be one of ${STAGES.join(', ')}`);
  if (item.method !== undefined && !METHODS.includes(item.method as typeof METHODS[number])) throw new FoundryError('Unknown evidence method');
  if (item.confidence !== undefined && !['low', 'medium', 'high'].includes(String(item.confidence))) {
    throw new FoundryError('confidence must be low, medium or high');
  }
  if (kind === 'brief') {
    if (!['plan', 'implement', 'review'].includes(String(item.intent))) throw new FoundryError('intent is invalid');
    if (!['small', 'feature', 'product'].includes(String(item.complexity))) throw new FoundryError('complexity is invalid');
    if (!['cli', 'api', 'web'].includes(String(item.surface))) throw new FoundryError('surface is invalid');
  }
  if ((kind === 'brief' || kind === 'decision') && item.status === 'accepted') {
    if (!text(item.accepted_by) || !text(item.acceptance_ref) || (item.source as JsonRecord).kind !== 'owner') {
      throw new FoundryError('An accepted brief/decision needs owner provenance and acceptance reference');
    }
  }
  if (item.market !== undefined) {
    if (typeof item.market !== 'object' || item.market === null || Array.isArray(item.market)) throw new FoundryError('market must be an object');
    const market = item.market as JsonRecord;
    const fields = ['customer', 'job', 'alternative', 'differentiation', 'channel', 'activation_event', 'decision', 'next_review', 'evidence_kind'];
    if (Object.keys(market).sort().join(',') !== [...fields].sort().join(',')
      || Object.values(market).some((value) => !text(value))) throw new FoundryError('market has invalid fields');
    const nextReview = date(market.next_review, 'market.next_review');
    if (!['assumption', 'synthetic', 'source', 'customer'].includes(String(market.evidence_kind))) {
      throw new FoundryError('Unknown market evidence_kind');
    }
    if (['assumption', 'synthetic'].includes(String(market.evidence_kind)) && item.basis !== 'inferred') {
      throw new FoundryError('Assumptions and synthetic market feedback must remain inferred');
    }
    if (market.evidence_kind === 'customer' && ((item.source as JsonRecord).kind !== 'customer' || item.basis !== 'observed')) {
      throw new FoundryError('Customer market evidence requires observed customer provenance');
    }
    if (nextReview < date((item.source as JsonRecord).observed_at, 'source.observed_at')) {
      throw new FoundryError('market.next_review precedes its observation');
    }
  }
  if (item.quality !== undefined) {
    if (typeof item.quality !== 'object' || item.quality === null || Array.isArray(item.quality)) throw new FoundryError('quality must be an object');
    const quality = item.quality as JsonRecord;
    if (kind === 'criterion') {
      const fields = ['slice', 'public_interface', 'oracle', 'sensitivity', 'test_inputs'];
      if (Object.keys(quality).sort().join(',') !== [...fields].sort().join(',')
        || ['slice', 'public_interface', 'oracle', 'sensitivity'].some((key) => !text(quality[key]))
        || !Array.isArray(quality.test_inputs) || !quality.test_inputs.length || quality.test_inputs.some((value) => !text(value))) {
        throw new FoundryError('quality requires slice, public_interface, oracle, sensitivity and test_inputs');
      }
      const testInputs = (quality.test_inputs as string[]).map((name) => local(root, name));
      quality.test_inputs = testInputs;
      if (new Set(testInputs).size !== testInputs.length) throw new FoundryError('Duplicate quality.test_inputs');
      if (item.method !== 'command') throw new FoundryError('Quality contracts require command evidence');
    } else {
      if (kind !== 'evidence' || Object.keys(quality).sort().join(',') !== 'red') throw new FoundryError('quality evidence requires a red receipt');
      quality.red = local(root, quality.red);
      if (item.method !== 'command') throw new FoundryError('Quality evidence requires command receipts');
    }
  }
  for (const key of ['path', 'artifact', 'reproduction']) if (key in item) item[key] = local(root, item[key]);
  item.inputs = list(item.inputs ?? [], 'inputs').map((value) => local(root, value));
  if (kind === 'criterion') {
    if (typeof item.required !== 'boolean' || !(item.inputs as string[]).length && !(Array.isArray(item.contracts) && item.contracts.length)) {
      throw new FoundryError('A criterion needs a boolean required field and declared inputs or contracts');
    }
    if (item.method === 'command' && (!Array.isArray(item.command) || !item.command.length || item.command.some((value) => !text(value)))) {
      throw new FoundryError('A command criterion needs the expected argv command');
    }
  }
  if (item.outcome !== undefined && !['pass', 'fail', 'unverified'].includes(String(item.outcome))) {
    throw new FoundryError('outcome must be pass, fail or unverified');
  }
  if (item.outcome !== undefined && item.outcome !== 'unverified'
    && !['artifact', 'observed', 'method'].every((key) => text(item[key]))) {
    throw new FoundryError('A pass/fail needs an artifact, observed result and method, not just an agent label');
  }
  if (item.operating_scope !== undefined && !['local_only', 'proposal_only'].includes(String(item.operating_scope))) {
    throw new FoundryError('operating_scope must be local_only or proposal_only');
  }
  if (kind === 'feedback' && !(Array.isArray(item.criteria) && item.criteria.length) && !item.reproduction) {
    throw new FoundryError('Feedback needs a reproduction artifact or criterion reference');
  }
  for (const ref of links(item)) if (!earlier[ref]) throw new FoundryError(`Unknown reference ${ref}; records belong to this project and must already exist`);
  for (const ref of item.contracts as string[]) if (!['artifact', 'decision', 'brief'].includes(String(earlier[ref]?.kind))) {
    throw new FoundryError(`Contract ${ref} must be an artifact, decision or brief`);
  }
  for (const ref of (item.criteria as string[] | undefined) ?? []) if (earlier[ref]?.kind !== 'criterion') throw new FoundryError(`Criterion reference ${ref} is not a criterion`);
  for (const ref of (item.outcome_evidence as string[] | undefined) ?? []) if (earlier[ref]?.kind !== 'evidence') {
    throw new FoundryError(`Experiment outcome ${ref} is not evidence`);
  }
  if (item.supersedes !== undefined) {
    const previous = earlier[item.supersedes as string];
    if (!previous || previous.kind !== kind) throw new FoundryError('supersedes must identify an existing record of the same kind');
    if (Object.values(earlier).some((record) => record.supersedes === item.supersedes)) throw new FoundryError(`Record ${item.supersedes} was already superseded`);
  }
  if (stored) {
    const revisions = item.input_revisions as Record<string, unknown>;
    if (typeof revisions !== 'object' || revisions === null || Array.isArray(revisions)
      || Object.values(revisions).some((value) => typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))) {
      throw new FoundryError('Invalid input revisions');
    }
    const references = item.reference_revisions as Record<string, unknown>;
    if (typeof references !== 'object' || references === null || Array.isArray(references)
      || Object.values(references).some((value) => typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
      || Object.keys(references).sort().join(',') !== links(item).join(',')) throw new FoundryError('Stored reference revisions do not match links');
    for (const name of Object.keys(revisions)) local(root, name);
    const requiredPaths = await inputPaths(root, item);
    if (requiredPaths.some((name) => !(name in revisions))) throw new FoundryError('Stored input revisions are missing declared inputs');
  }
  for (const ref of item.outcome_evidence as string[] | undefined ?? []) if (earlier[ref]?.kind !== 'evidence') {
    throw new FoundryError(`Experiment outcome ${ref} is not evidence`);
  }
  if (kind === 'evidence') for (const ref of item.supersedes ? earlier[String(item.supersedes)]?.criteria as string[] ?? [] : []) {
    if (!(item.criteria as string[]).includes(ref)) throw new FoundryError("Replacement evidence must retain the superseded evidence's criterion links");
  }
  return item;
}

function revision(record: JsonRecord): string {
  return digestJson(record);
}

async function inputPaths(root: string, item: JsonRecord): Promise<string[]> {
  const paths = new Set<string>(Array.isArray(item.inputs) ? item.inputs as string[] : []);
  for (const key of ['path', 'artifact', 'reproduction']) if (typeof item[key] === 'string') paths.add(item[key] as string);
  const source = item.source as JsonRecord | undefined;
  if (source?.kind === 'local' && typeof source.ref === 'string') paths.add(source.ref);
  const quality = item.quality as JsonRecord | undefined;
  if (Array.isArray(quality?.test_inputs)) for (const value of quality.test_inputs) if (typeof value === 'string') paths.add(value);
  if (typeof quality?.red === 'string') paths.add(quality.red);
  return [...paths];
}

async function currentStates(root: string, data: { records: JsonRecord[] }): Promise<Record<string, { freshness: string; reasons: string[] }>> {
  const superseded = new Set(data.records.flatMap((record) => typeof record.supersedes === 'string' ? [record.supersedes] : []));
  const states: Record<string, { freshness: string; reasons: string[] }> = {};
  const clock = new Date();
  for (const record of data.records) {
    const reasons: string[] = [];
    const market = record.market as JsonRecord | undefined;
    if (market && date(market.next_review, 'market.next_review') <= clock) reasons.push('Market evidence review date has passed');
    if (record.expires_at && date(record.expires_at, 'expires_at') <= clock) reasons.push('Evidence review/expiry date has passed');
    const revisions = record.input_revisions as Record<string, string>;
    for (const [name, expected] of Object.entries(revisions)) {
      let actual: string | null;
      try {
        actual = digest(await readFile(within(root, name)));
      } catch {
        actual = null;
      }
      if (actual !== expected) reasons.push(`Input changed or missing: ${name}`);
    }
    const references = record.reference_revisions as Record<string, string>;
    for (const [ref, expected] of Object.entries(references)) {
      if (superseded.has(ref) || states[ref]?.freshness !== 'active') reasons.push(`Reference ${ref} is superseded or stale`);
      if (revision(data.records.find((candidate) => candidate.id === ref) ?? {}) !== expected) reasons.push(`Reference revision changed: ${ref}`);
    }
    states[String(record.id)] = { freshness: superseded.has(String(record.id)) ? 'superseded' : reasons.length ? 'stale' : 'active', reasons };
  }
  return states;
}

async function receiptFor(root: string, evidence: JsonRecord): Promise<JsonRecord> {
  const data = await readJson<unknown>(within(root, String(evidence.artifact)));
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new FoundryError('Command evidence must be a JSON receipt');
  const receipt = data as JsonRecord;
  if (!Array.isArray(receipt.checks)) return receipt;
  if (!text(evidence.check)) throw new FoundryError('Batch evidence needs a check name');
  const matches = receipt.checks.filter((value) => typeof value === 'object' && value !== null && (value as JsonRecord).name === evidence.check);
  if (matches.length !== 1) throw new FoundryError('Named check is absent or ambiguous in the receipt');
  return matches[0] as JsonRecord;
}

function criterionInputs(criterion: JsonRecord, records: Record<string, JsonRecord>): Record<string, string> {
  const inputs: Record<string, string> = {};
  const visited = new Set<string>();
  const pending = [criterion];
  while (pending.length) {
    const item = pending.pop();
    if (!item) continue;
    const id = String(item.id);
    if (visited.has(id)) continue;
    visited.add(id);
    for (const [name, revision] of Object.entries(item.input_revisions as Record<string, string>)) {
      if (name in inputs && inputs[name] !== revision) throw new FoundryError(`Conflicting declared revisions for ${name}`);
      inputs[name] = revision;
    }
    for (const ref of Object.keys(item.reference_revisions as Record<string, string>)) {
      const referenced = records[ref];
      if (referenced) pending.push(referenced);
    }
  }
  return inputs;
}

async function qualityObservation(root: string, evidence: JsonRecord, criterion: JsonRecord, green: JsonRecord): Promise<void> {
  const contract = criterion.quality as JsonRecord;
  const quality = evidence.quality as JsonRecord | undefined;
  if (!quality || typeof quality.red !== 'string' || quality.red === evidence.artifact) throw new FoundryError('Quality pass needs a separate retained red receipt');
  const red = await readJson<JsonRecord>(within(root, quality.red));
  const pinned = evidence.input_revisions as Record<string, string>;
  const counts = async (receipt: JsonRecord, failed: boolean): Promise<JsonRecord> => {
    const tests = receipt.tests;
    if (typeof tests !== 'object' || tests === null || Array.isArray(tests)) throw new FoundryError('Quality evidence needs integer test counts');
    const values = tests as JsonRecord;
    if (Object.keys(values).sort().join(',') !== 'executed,failed,passed,skipped'
      || Object.values(values).some((value) => !Number.isInteger(value) || Number(value) < 0)
      || Number(values.executed) <= 0 || Number(values.executed) !== Number(values.passed) + Number(values.failed)
      || Number(values.skipped) !== 0 || (Number(values.failed) > 0) !== failed
      || typeof receipt.duration_seconds !== 'number' || !Number.isFinite(receipt.duration_seconds) || receipt.duration_seconds < 0
      || JSON.stringify(receipt.command) !== JSON.stringify(criterion.command)
      || !Number.isInteger(receipt.exit_code) || (Number(receipt.exit_code) !== 0) !== failed
      || receipt.status !== (failed ? 'failed' : 'passed')) {
      throw new FoundryError('Red/green command result is invalid');
    }
    const before = receipt.input_revisions;
    const after = receipt.input_revisions_after;
    if (typeof before !== 'object' || before === null || Array.isArray(before) || !Object.keys(before).length
      || canonicalJson(before) !== canonicalJson(after)
      || Object.entries(before).some(([name, revision]) => typeof revision !== 'string' || !/^[0-9a-f]{64}$/.test(revision) || !name.trim())) {
      throw new FoundryError('Red/green inputs must be captured and stable during execution');
    }
    for (const field of ['log', 'test_report'] as const) {
      const reportPath = local(root, receipt[field]);
      if (pinned[reportPath] !== receipt[`${field}_sha256`]) throw new FoundryError('Quality artifact changed or was not pinned');
      if (field === 'test_report') {
        const report = await readJson<JsonRecord>(within(root, reportPath));
        if (canonicalJson(report.tests) !== canonicalJson(tests)
          || !text(receipt.check_run_id) || report.run_id !== receipt.check_run_id) {
          throw new FoundryError('Test report differs from receipt counts or execution identity');
        }
      }
    }
    for (const name of Object.keys(before as Record<string, string>)) local(root, name);
    return values;
  };
  const redCounts = await counts(red, true);
  const greenCounts = await counts(green, false);
  if (!text(red.check_run_id) || red.check_run_id === green.check_run_id
    || canonicalJson(Object.keys(red.input_revisions as object).sort()) !== canonicalJson(Object.keys(green.input_revisions as object).sort())
    || redCounts.executed !== greenCounts.executed || red.log_sha256 === green.log_sha256
    || canonicalJson(red.input_revisions) === canonicalJson(green.input_revisions)) {
    throw new FoundryError('Red and green evidence must be separate executions with changed implementation and stable coverage');
  }
  for (const name of contract.test_inputs as string[]) {
    if ((red.input_revisions as Record<string, unknown>)[name] !== (green.input_revisions as Record<string, unknown>)[name]
      || (red.input_revisions as Record<string, unknown>)[name] !== (criterion.input_revisions as Record<string, unknown>)[name]) {
      throw new FoundryError('Sensitivity test must remain unchanged between red and green');
    }
  }
}

async function observation(root: string, evidence: JsonRecord, criterion: JsonRecord, records: Record<string, JsonRecord>): Promise<['pass' | 'fail' | 'unverified', string]> {
  if (evidence.basis !== 'observed' || evidence.status !== 'accepted') return ['unverified', 'Evidence is inferred or proposed'];
  if (!['artifact', 'observed', 'method', 'outcome'].every((key) => text(evidence[key]))) return ['unverified', 'Missing direct observation and local artifact'];
  if (evidence.outcome === 'fail') return ['fail', 'Unresolved recorded failure'];
  if (evidence.outcome !== 'pass' || evidence.method !== criterion.method) return ['unverified', 'Observation method/outcome does not satisfy the criterion'];
  if (evidence.method !== 'command') return ['pass', 'Recorded observation and declared revisions are current'];
  try {
    const result = await receiptFor(root, evidence);
    if (JSON.stringify(result.command) !== JSON.stringify(criterion.command) || result.exit_code !== 0 || result.status !== 'passed') {
      throw new FoundryError('Receipt does not establish a successful command');
    }
    const before = result.input_revisions as Record<string, unknown> | undefined;
    const after = result.input_revisions_after;
    if (!before || !Object.keys(before).length || typeof after !== 'object' || canonicalJson(before) !== canonicalJson(after)) {
      throw new FoundryError('Receipt lacks executed input revisions or inputs changed during the command');
    }
    const declared = criterionInputs(criterion, records);
    if (!Object.keys(declared).length || Object.entries(declared).some(([name, revision]) => before[name] !== revision)) {
      throw new FoundryError('Receipt does not cover the criterion declared input/contract revisions');
    }
    const pinned = evidence.input_revisions as Record<string, string>;
    for (const [name, revision] of Object.entries(before)) {
      const relative = local(root, name);
      if (typeof revision !== 'string' || digest(await readFile(within(root, relative))) !== revision || pinned[relative] !== revision) {
        throw new FoundryError(`Executed input changed, missing or unpinned: ${relative}`);
      }
    }
    const log = local(root, result.log);
    if (pinned[log] !== result.log_sha256 || digest(await readFile(within(root, log))) !== result.log_sha256) {
      throw new FoundryError('Receipt log changed, missing or unpinned');
    }
    if (criterion.quality) await qualityObservation(root, evidence, criterion, result);
    return ['pass', 'Recorded observation and its declared input/contract revisions are current'];
  } catch (error) {
    return ['unverified', (error as Error).message];
  }
}

export async function record(rootInput: string, payload: unknown): Promise<JsonRecord> {
  const root = await requireRuntimeWorkspace(rootInput, 'record workflow evidence');
  return withProcessLock(within(root, WORKFLOW_LOCK), async () => {
    const data = await loadLedger(root);
    const earlier = Object.fromEntries(data.records.map((record) => [String(record.id), record]));
    const item = await validateRecord(root, payload, earlier, false);
    const paths = new Set(await inputPaths(root, item));
    const states = await currentStates(root, data);
    for (const ref of links(item)) {
      if (states[ref]?.freshness !== 'active') throw new FoundryError(`Reference ${ref} is ${states[ref]?.freshness ?? 'missing'}; refresh it first`);
    }
    const includeReceipt = async (relative: string, evidence?: JsonRecord): Promise<JsonRecord> => {
      const receipt = await readJson<unknown>(within(root, relative));
      if (typeof receipt !== 'object' || receipt === null || Array.isArray(receipt)) throw new FoundryError('Command evidence must be a JSON receipt');
      let value = receipt as JsonRecord;
      if (Array.isArray(value.checks)) {
        if (!evidence) throw new FoundryError('Quality receipt cannot be a batch');
        value = await receiptFor(root, { ...evidence, artifact: relative });
      }
      for (const field of ['log', 'test_report'] as const) {
        if (typeof value[field] === 'string') paths.add(local(root, value[field]));
      }
      if (typeof value.input_revisions === 'object' && value.input_revisions !== null && !Array.isArray(value.input_revisions)) {
        for (const input of Object.keys(value.input_revisions as JsonRecord)) paths.add(local(root, input));
      }
      return value;
    };
    if (item.method === 'command' && typeof item.artifact === 'string') {
      await includeReceipt(item.artifact, item);
    }
    const evidenceQuality = item.quality as JsonRecord | undefined;
    if (typeof evidenceQuality?.red === 'string') await includeReceipt(evidenceQuality.red);
    const inputRevisions: Record<string, string> = {};
    for (const name of paths) {
      const file = within(root, name);
      if (!(await stat(file)).isFile()) throw new FoundryError(`Input artifact is missing or not a file: ${name}`);
      inputRevisions[name] = digest(await readFile(file));
    }
    const stored: JsonRecord = {
      ...item,
      created_at: now(),
      input_revisions: inputRevisions,
      reference_revisions: Object.fromEntries(links(item).map((ref) => [ref, revision(earlier[ref] ?? {})])),
    };
    const previous = typeof item.supersedes === 'string' ? earlier[item.supersedes] : undefined;
    if (previous?.kind === 'evidence' && previous.outcome === 'fail') {
      const candidate = { records: [...data.records, stored] };
      if ((await currentStates(root, candidate))[String(stored.id)]?.freshness !== 'active') {
        throw new FoundryError('A failure replacement must have fresh inputs, references and an unexpired observation');
      }
      for (const ref of previous.criteria as string[]) {
        const verdict = await observation(root, stored, earlier[ref]!, earlier);
        if (!['pass', 'fail'].includes(verdict[0])) {
          throw new FoundryError('An unresolved failure can only be superseded by sufficient observed pass/fail evidence');
        }
      }
    }
    const projectId = data.project_id ?? randomUUID();
    await atomicJson(root, WORKFLOW_LEDGER, { schema_version: 1, project_id: projectId, records: [...data.records, stored] });
    return stored;
  });
}

export async function context(rootInput: string): Promise<JsonRecord> {
  const root = await findProjectRoot(rootInput);
  const data = await loadLedger(root);
  const states = await currentStates(root, data);
  const records: JsonRecord[] = data.records.map((record) => ({ ...record, ...states[String(record.id)] }));
  const stale = records.filter((record) => record.freshness === 'stale');
  const followups = records.filter((record) => record.freshness === 'active' && record.kind === 'feedback');
  const handoffs = records.filter((record) => record.freshness === 'active' && record.kind === 'artifact');
  const nextAction = stale.length ? `Refresh stale records and affected handoffs: ${stale.map((record) => record.id).join(', ')}`
    : followups.length ? String(followups.at(-1)?.next_task ?? '')
      : handoffs.length ? String(handoffs.at(-1)?.next_action ?? '')
        : 'Use guide to select the next scoped step from the request and current project';
  return { schema_version: 1, project_id: data.project_id, records, next_action: nextAction };
}

export async function gate(rootInput: string, stage?: string): Promise<JsonRecord> {
  const root = await findProjectRoot(rootInput);
  if (stage && !STAGES.includes(stage as typeof STAGES[number])) throw new FoundryError(`Unknown gate stage: ${stage}`);
  const saved = await context(root);
  const records = saved.records as JsonRecord[];
  const byId = Object.fromEntries(records.map((record) => [String(record.id), Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'freshness' && key !== 'reasons'),
  ) as JsonRecord]));
  const successors = Object.fromEntries(records.filter((record) => typeof record.supersedes === 'string')
    .map((record) => [String(record.supersedes), record]));
  const criteria = records.filter((record) => record.kind === 'criterion' && record.freshness !== 'superseded' && (!stage || record.stage === stage));
  const results: JsonRecord[] = [];
  for (const criterion of criteria) {
    const evidence = records.filter((record) => record.kind === 'evidence' && Array.isArray(record.criteria) && record.criteria.includes(criterion.id as string));
    const observations: JsonRecord[] = [];
    for (const item of evidence) {
      const unresolved = item.outcome === 'fail' && item.basis === 'observed' && item.status === 'accepted';
      if (item.freshness === 'superseded') {
        if (unresolved) {
          let replacement = item;
          while (successors[String(replacement.id)]) replacement = successors[String(replacement.id)]!;
          const verdict = replacement.freshness === 'active'
            ? await observation(root, byId[String(replacement.id)] ?? replacement, byId[String(criterion.id)] ?? criterion, byId)
            : ['unverified', 'Replacement evidence is stale'] as const;
          if (verdict[0] !== 'pass') observations.push({
            id: item.id, status: 'unverified', unresolved_failure: true,
            reason: `Failure resolution ${String(replacement.id)} no longer establishes a current pass`,
          });
        }
        continue;
      }
      const verdict = item.freshness === 'active'
        ? await observation(root, byId[String(item.id)] ?? item, byId[String(criterion.id)] ?? criterion, byId)
        : ['unverified', (item.reasons as string[]).join('; ')] as const;
      observations.push({ id: item.id, status: verdict[0], reason: verdict[1], unresolved_failure: unresolved });
    }
    const status = criterion.freshness !== 'active' || criterion.status !== 'accepted' ? 'unverified'
      : observations.some((item) => item.status === 'fail') ? 'fail'
        : observations.some((item) => item.unresolved_failure) ? 'unverified'
          : observations.some((item) => item.status === 'pass') ? 'pass' : 'unverified';
    const reason = criterion.freshness !== 'active' || criterion.status !== 'accepted'
      ? 'Criterion is stale or proposed; reconcile it before using evidence'
      : status === 'fail' ? 'A linked failure remains unresolved; a new pass does not erase it'
        : status === 'pass' ? 'Fresh evidence covers the criterion'
          : 'Missing sufficient fresh observed evidence';
    results.push({ id: criterion.id, required: criterion.required, stage: criterion.stage, status, reason, evidence: observations });
  }
  const required = results.filter((result) => result.required);
  return {
    status: required.some((result) => result.status === 'fail') ? 'fail' : required.length && required.every((result) => result.status === 'pass') ? 'pass' : 'unverified',
    stage: stage ?? null,
    criteria: results,
    assurance: 'Checks declared coverage and recorded artifact freshness. Human observations remain attributed claims; this does not establish semantic quality, owner approval, deployment or production qualification.',
  };
}

export async function guide(
  rootInput: string,
  request?: string,
  intent?: string,
  complexity?: string,
  surface?: string,
  requiredInput?: string[],
  availableInput?: string[],
): Promise<JsonRecord> {
  const root = path.resolve(await findProjectRoot(rootInput));
  const saved = await context(root);
  const records = saved.records as JsonRecord[];
  const briefs = records.filter((record) => record.kind === 'brief' && record.freshness === 'active' && record.status === 'accepted');
  const brief = briefs.at(-1) ?? {};
  const newRequest = request !== undefined;
  const intentSource = intent !== undefined ? 'explicit' : newRequest ? 'conservative_new_request' : briefs.length ? 'saved_intake' : 'default';
  const resolvedRequest = request ?? String(brief.goal ?? '');
  const resolvedIntent = intent ?? (newRequest ? 'plan' : String(brief.intent ?? 'plan'));
  const resolvedComplexity = complexity || String(brief.complexity ?? 'feature');
  const resolvedSurface = surface || String(brief.surface ?? 'api');
  if (!['plan', 'implement', 'review'].includes(resolvedIntent)) throw new FoundryError('Unknown request intent');
  if (!['small', 'feature', 'product'].includes(resolvedComplexity)) throw new FoundryError('Unknown complexity');
  if (!['cli', 'api', 'web'].includes(resolvedSurface)) throw new FoundryError('Unknown surface');
  const required = requiredInput !== undefined
    ? [...requiredInput]
    : Array.isArray(brief.capabilities) ? brief.capabilities as string[] : [];
  const available = [...(availableInput ?? [])];
  if ([...required, ...available].some((capability) => !text(capability))) {
    throw new FoundryError('Capabilities must be named explicitly');
  }
  const stages = resolvedComplexity === 'product'
    ? ['research', 'opportunity', 'scope', ...(resolvedSurface === 'web' ? ['flows', 'prototype', 'design'] : []), 'build', 'verify', 'release', 'learn']
    : resolvedComplexity === 'feature' && resolvedSurface === 'web'
      ? ['scope', 'flows', 'design', 'build', 'verify']
      : ['scope', 'build', 'verify'];
  const userNeeded: JsonRecord[] = [...new Set(required)].filter((capability) => !available.includes(capability)).sort().map((capability) => ({
    kind: 'capability',
    capability,
    action: `Choose or connect an authorized ${capability} capability, or revise the scope`,
    reason: 'Required capability is not declared available; unsupported is not success',
  }));
  if (!resolvedRequest) userNeeded.push({
    kind: 'scope',
    action: 'Describe the intended user and useful outcome',
    reason: 'No request or accepted intake brief is recorded',
  });
  const [, active] = await activeRun(root);
  let specs: string[] = [];
  try {
    const directory = within(root, 'docs/specs');
    specs = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => `docs/specs/${entry.name}`)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const criteria = records.filter((record) => record.kind === 'criterion' && record.freshness === 'active' && record.status === 'accepted');
  const stale = records.filter((record) => record.freshness === 'stale');
  let stage = stages[0] ?? 'scope';
  let action = '';
  let reason = 'Use only depth needed for this task; records are evidence, not a mandatory pipeline';
  if (resolvedIntent === 'plan') {
    action = 'Prepare or refine the scoped project plan and its next decision';
    reason = 'This is a planning request; implementation and runtime start are not authorized by guidance';
  } else if (resolvedIntent === 'review') {
    stage = 'verify';
    action = 'Review current behavior and artifacts against the declared criteria; report evidence gaps';
    reason = 'A review request does not authorize product edits';
  } else if (active && ['paused', 'interrupted', 'verifying'].includes(active.status)) {
    stage = 'build';
    action = 'Inspect interrupted work and evidence, then resume the existing run when authorized';
    reason = 'An existing run takes precedence over starting another feature';
  } else if (stale.length) {
    action = String(saved.next_action);
    reason = 'Dependent work must reconcile changed inputs and superseded decisions';
  } else if (resolvedComplexity === 'product'
    && !records.some((record) => record.kind === 'artifact' && record.stage === 'opportunity' && record.freshness === 'active' && record.status === 'accepted')) {
    stage = 'research';
    action = 'Resolve the next decision-changing buyer/workflow uncertainty, then record an opportunity thesis';
    reason = 'Competitor pricing and simulated interviews alone do not validate customer demand';
  } else if (!criteria.length) {
    stage = 'scope';
    action = 'Define the smallest useful behavior and its acceptance criteria using existing product documents';
    reason = "A spec's presence alone does not prove acceptance coverage";
  } else {
    const artifacts = new Set(records.filter((record) => record.kind === 'artifact' && record.freshness === 'active' && record.status === 'accepted')
      .map((record) => record.stage));
    const missingDesign = stages.filter((name) => ['flows', 'prototype', 'design'].includes(name) && !artifacts.has(name));
    if (missingDesign.length) {
      stage = missingDesign[0] ?? stage;
      action = `Prepare or reuse the scoped handoff: ${PATH_OUTCOMES[stage]}`;
      reason = 'The selected UI depth needs this artifact; reuse the existing product system when applicable';
    } else if (active) {
      stage = active.status === 'verified' ? 'verify' : 'build';
      action = stage === 'verify'
        ? 'Compare acceptance evidence and record local completion'
        : "Continue the existing run's next scoped task and exercise its behavior";
      reason = 'Continue the existing run; runtime verification and product acceptance are separate';
    } else {
      stage = 'build';
      action = 'Prepare the next scoped implementation from the accepted criteria and existing documents';
      reason = "The coordinator can now select applicable tools and start a run within the owner's implementation authority";
    }
  }
  return {
    request: resolvedRequest,
    current: {
      intent: resolvedIntent,
      intent_source: intentSource,
      complexity: resolvedComplexity,
      surface: resolvedSurface,
      run_status: active?.status ?? 'idle',
      run_id: active?.run_id ?? null,
      specs,
      records: records.length,
      accepted_criteria: criteria.length,
    },
    next: { stage, action, reason },
    user_needed: userNeeded,
    path: stages.map((name) => ({ stage: name, outcome: PATH_OUTCOMES[name] })),
    limits: [
      'Recommendation only: no files, runs, connections, purchases, deployments or background jobs were created',
      'Complexity/surface are explicit inputs or saved intake; defaults are feature/api until the coordinator supplies task context',
    ],
  };
}

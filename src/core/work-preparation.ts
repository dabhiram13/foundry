import { z } from 'zod';
import { canonicalJson, digest, FoundryError } from './fs.js';
import { readBoundedText } from './factory-contract.js';
import { publicSourceUrl, renderResearchReport, researchReportSchema } from './research.js';
import { roleByName, type RolePolicy } from './roles.js';
import type { RunState } from './lifecycle.js';
import type { TaskPlan } from './work-plan.js';
import { inspectPreview, previewSchema, previewSourceSchema, type PreviewSource } from './work-visual.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const role = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const text = z.string().trim().min(1).max(4000);
export const preparationRefSchema = z.object({
  path: z.string().regex(/^\.foundry\/state\/runs\/[a-f0-9-]{36}\/preparation\/[a-f0-9-]{36}\/(sources|research|design)\.json$/),
  sha256: hash,
}).strict();
export const sourceCaptureSchema = preparationRefSchema.extend({ spec_sha256: hash, policy_sha256: hash }).strict();
export const preparationSchema = z.object({
  research_role: role.default('market-researcher'), design_role: role.default('designer'),
  research: preparationRefSchema.optional(), design: preparationRefSchema.optional(),
}).strict();
export type Preparation = z.infer<typeof preparationSchema>;

export const designReportSchema = z.object({
  kind: z.enum(['interface', 'service']), summary: text,
  criteria: z.array(z.object({
    id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/), approach: text,
    primary_states: text, failure_states: text, responsive: text, accessibility: text,
  }).strict()).min(1).max(200),
  ux: z.object({
    user_journey: text, information_architecture: text, wireframes: text,
    visual_rules: text, component_states: text, validation_plan: text,
  }).strict().optional(),
  preview: previewSchema.optional(),
  assumptions: z.array(text).max(20),
}).strict().superRefine((report, context) => {
  if (new Set(report.criteria.map(item => item.id)).size !== report.criteria.length) {
    context.addIssue({ code: 'custom', message: 'Design criterion IDs must be unique' });
  }
  if (report.kind === 'interface' && !report.ux) {
    context.addIssue({ code: 'custom', message: 'Interface design needs all six UX handoffs' });
  }
  if (report.kind === 'interface' && !report.preview) {
    context.addIssue({ code: 'custom', message: 'Interface Design needs a running preview with components, states and desktop/mobile screenshots' });
  }
  if (report.kind === 'service' && report.preview) {
    context.addIssue({ code: 'custom', message: 'Use interface Design for a visual preview' });
  }
  if (Buffer.byteLength(JSON.stringify(report)) > 128 * 1024) {
    context.addIssue({ code: 'custom', message: 'Design exceeds 128 KiB' });
  }
});
export type DesignReport = z.infer<typeof designReportSchema>;

const collectionSchema = z.object({
  sources: z.array(z.object({
    id: z.string().regex(/^S[1-5]$/), kind: z.enum(['https', 'local']),
    requested: z.string().min(1).max(2048), location: z.string().min(1).max(2048),
    observed_at: z.string().datetime(), path: z.string().min(1).max(1024), sha256: hash,
    excerpt: z.string().min(1).max(6000), truncated: z.boolean(),
  }).strict()).min(1).max(5),
  unavailable: z.array(z.object({
    id: z.string().regex(/^S[1-5]$/), location: z.string().min(1).max(2048), reason: z.string().min(1).max(2000),
  }).strict()).max(5),
}).strict().refine(value => {
  const ids = [...value.sources, ...value.unavailable].map(source => source.id);
  return new Set(ids).size === ids.length && ids.length <= 5;
}, 'Source IDs must be unique');
const researchRecordSchema = z.object({
  schema_version: z.literal(1), spec_sha256: hash, policy_sha256: hash,
  collection: preparationRefSchema, report: researchReportSchema,
}).strict();
const designRecordSchema = z.object({
  schema_version: z.literal(1), spec_sha256: hash, policy_sha256: hash,
  research_sha256: hash, plan_sha256: hash,
  approved_plan_revision: hash, approved_plan_sha256: hash, report: designReportSchema,
  preview_sources: z.array(previewSourceSchema).max(32).optional(),
}).strict();
export type PreparationRef = z.infer<typeof preparationRefSchema>;
export const policyRevision = (policy: RolePolicy): string => digest(canonicalJson(policy));
export const planRevision = (plan: TaskPlan): string => digest(canonicalJson(plan));

export async function preparationPolicies(root: string, preparation: Preparation): Promise<RolePolicy[]> {
  return Promise.all([...new Set([preparation.research_role, preparation.design_role])].map(name => roleByName(root, name)));
}

async function record(root: string, runId: string, ref: PreparationRef, kind: 'sources' | 'research' | 'design') {
  preparationRefSchema.parse({ path: ref.path, sha256: ref.sha256 });
  if (!ref.path.startsWith(`.foundry/state/runs/${runId}/preparation/`) || !ref.path.endsWith(`/${kind}.json`)) {
    throw new FoundryError('Preparation artifact belongs to another run or stage');
  }
  const document = await readBoundedText(root, ref.path, 128 * 1024);
  if (digest(document.bytes) !== ref.sha256) throw new FoundryError('Preparation artifact changed');
  return JSON.parse(document.text) as unknown;
}

export async function readSourceCapture(root: string, state: RunState) {
  if (!state.research_sources) throw new FoundryError('Capture sources before research synthesis');
  const capture = sourceCaptureSchema.parse(state.research_sources);
  const collection = collectionSchema.parse(await record(root, state.run_id, capture, 'sources'));
  for (const source of collection.sources) {
    const directory = capture.path.slice(0, -'sources.json'.length);
    if (source.path !== `${directory}${source.id}.txt`) throw new FoundryError('Source snapshot belongs to another capture');
    if (source.kind === 'https') { publicSourceUrl(source.requested); publicSourceUrl(source.location); }
    else if (!/^(README\.md|docs\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:md|txt))$/.test(source.location)) {
      throw new FoundryError('Invalid captured local source');
    }
    const snapshot = await readBoundedText(root, source.path, 512 * 1024);
    if (digest(snapshot.bytes) !== source.sha256 || source.excerpt !== snapshot.text.slice(0, 6000)
      || source.truncated !== (snapshot.text.length > 6000)) throw new FoundryError('Captured source content changed');
  }
  return collection;
}

export function validateDesign(report: DesignReport, criteria: Array<{ id: string }>, plan?: TaskPlan): void {
  const ids = new Set(criteria.map(criterion => criterion.id));
  if (report.criteria.length !== ids.size || report.criteria.some(item => !ids.has(item.id))) {
    throw new FoundryError('Design every approved criterion exactly once');
  }
  if (report.preview) {
    const uiCriteria = new Set(report.preview.screens.flatMap(screen => screen.criteria));
    if ([...uiCriteria].some(id => !ids.has(id))) throw new FoundryError('Preview screens must reference approved criteria');
    if (!plan?.ui_builder_role || [...uiCriteria].some(id => !plan.tasks.some(task => task.role === plan.ui_builder_role && task.criteria.includes(id)))) {
      throw new FoundryError('Assign every preview criterion to the approved writable UI specialist (ui_builder_role)');
    }
  }
}

type ArtifactStatus = 'missing' | 'invalid' | 'stale' | 'current';
export async function inspectPreparation(root: string, state: RunState, specSha256: string,
  preparation: Preparation, criteria: Array<{ id: string }>, plan?: TaskPlan) {
  const researchPolicy = await roleByName(root, preparation.research_role);
  const designPolicy = await roleByName(root, preparation.design_role);
  let sourceStatus: ArtifactStatus = 'missing';
  let sourceProblem: string | null = null;
  let collection: Awaited<ReturnType<typeof readSourceCapture>> | null = null;
  if (state.research_sources) {
    try {
      collection = await readSourceCapture(root, state);
      sourceStatus = state.research_sources.spec_sha256 === specSha256
        && state.research_sources.policy_sha256 === policyRevision(researchPolicy) ? 'current' : 'stale';
    } catch (error) { sourceStatus = 'invalid'; sourceProblem = (error as Error).message.slice(0, 500); }
  }
  let researchStatus: ArtifactStatus = 'missing';
  let researchProblem: string | null = null;
  let researchText: string | null = null;
  if (preparation.research) {
    try {
      const research = researchRecordSchema.parse(await record(root, state.run_id, preparation.research, 'research'));
      const sameCapture = research.collection.path === state.research_sources?.path
        && research.collection.sha256 === state.research_sources?.sha256;
      const reportSources = sameCapture ? collection : await readSourceCapture(root, {
        ...state, research_sources: { ...research.collection,
          spec_sha256: research.spec_sha256, policy_sha256: research.policy_sha256 },
      });
      if (!reportSources) throw new FoundryError('Research source capture is unavailable');
      researchText = await renderResearchReport(root, research.report, reportSources);
      researchStatus = sourceStatus === 'current' && research.spec_sha256 === specSha256
        && research.policy_sha256 === policyRevision(researchPolicy)
        && sameCapture ? 'current' : 'stale';
    } catch (error) { researchStatus = 'invalid'; researchProblem = (error as Error).message.slice(0, 500); }
  }
  let designStatus: ArtifactStatus = 'missing';
  let designProblem: string | null = null;
  let designReport: DesignReport | null = null;
  let previewSources: PreviewSource[] = [];
  if (preparation.design) {
    try {
      const design = designRecordSchema.parse(await record(root, state.run_id, preparation.design, 'design'));
      validateDesign(design.report, criteria, plan);
      if (design.report.preview) await inspectPreview(root, preparation.design.path.slice(0, -'/design.json'.length),
        design.report.preview, design.preview_sources ?? []);
      previewSources = design.preview_sources ?? [];
      designReport = design.report;
      designStatus = researchStatus === 'current' && plan && design.spec_sha256 === specSha256
        && design.policy_sha256 === policyRevision(designPolicy)
        && design.research_sha256 === preparation.research?.sha256
        && design.plan_sha256 === planRevision(plan) ? 'current' : 'stale';
    } catch (error) { designStatus = 'invalid'; designProblem = (error as Error).message.slice(0, 500); }
  }
  return {
    sources: { status: sourceStatus, problem: sourceProblem, capture: state.research_sources ?? null, collection },
    research: { status: researchStatus, problem: researchProblem, role: preparation.research_role, record: preparation.research ?? null, text: researchText },
    design: { status: designStatus, role: preparation.design_role, record: preparation.design ?? null, report: designReport,
      preview_sources: previewSources,
      problem: designProblem, attribution: 'host_reported' as const },
  };
}
export type PreparationState = Awaited<ReturnType<typeof inspectPreparation>>;

export function assertResearchReady(preparation?: PreparationState): void {
  if (preparation && preparation.research.status !== 'current') {
    throw new FoundryError(`Capture sources and record current Research before planning (${preparation.research.status})`);
  }
}
export function assertPreparationReady(scope: { preparation?: PreparationState; plan?: TaskPlan } | null): void {
  if (!scope?.preparation) return;
  assertResearchReady(scope.preparation);
  if (!scope.plan) throw new FoundryError('Save and approve the task plan before Design');
  if (scope.preparation.design.status !== 'current') {
    throw new FoundryError(`Record current Design and approve its scope before building (${scope.preparation.design.status})`);
  }
}

export function renderPreparationHandoff(preparation?: PreparationState): string {
  if (!preparation) return '';
  const design = preparation.design.report!;
  return [
    '\n## Source-backed Research', '', preparation.research.text!,
    '## Host-reported Design', '', `Record: ${preparation.design.record!.path}`, '', design.summary, '',
    ...design.criteria.flatMap(criterion => [
      `### ${criterion.id}`, '', criterion.approach, '', `Primary states: ${criterion.primary_states}`,
      `Failure states: ${criterion.failure_states}`, `Responsive: ${criterion.responsive}`,
      `Accessibility: ${criterion.accessibility}`, '',
    ]),
    ...(design.ux ? ['### UX handoffs', '', ...Object.entries(design.ux).map(([name, value]) => `${name}: ${value}`), ''] : []),
    '### Assumptions', '', ...design.assumptions.map(assumption => `- ${assumption}`), '',
    ...(design.preview ? ['### Approved interface preview', '', `Preview: ${design.preview.url}`,
      design.preview.instructions, `Design system: ${design.preview.design_system}`,
      ...design.preview.components.map(component => `- ${component.name}: ${component.source}; states: ${component.states.join(', ')}`),
      ...preparation.design.preview_sources.map(source => `- Source snapshot: ${source.path} -> ${source.snapshot} (sha256 ${source.sha256})`),
      ...design.preview.screenshots.map(image => `- ${image.screen}/${image.state} ${image.width}x${image.height}: ${image.path} (sha256 ${image.sha256})`), ''] : []),
    'Sources and rendered evidence are host reported. The owner judges design quality; captured files do not prove usability or acceptance.', '',
  ].join('\n');
}

import { lstat, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  approveFactory, cancelFactory, configureFactory, initFactory, recoverFactory, reviewFactory,
  runFactory, statusFactory, validateFactoryAdapter, type FactoryConfigureOptions,
} from './factory.js';
import {
  FACTORY_STAGE_LABELS, FACTORY_STAGES, readBoundedText, readFactoryState,
  type FactoryStage, type FactoryState,
} from './factory-contract.js';
import {
  atomicWrite, digest, expandUserPath, exists, FoundryError, rejectSymlinkComponents, within,
} from './fs.js';
import { installWorkspace } from './install.js';
import { readRuntimeMarker } from './lifecycle.js';
import { loadRoles } from './roles.js';
import { registry, type ProviderAdapter } from '../runtime/providers.js';

type JsonRecord = Record<string, unknown>;

const FACTORY_DOCUMENTS: ReadonlyArray<readonly [string, string]> = [
  ['docs/product/idea.md', 'intake'],
  ['docs/product/research.md', 'research'],
  ['docs/specs/product.md', 'scope'],
  ['docs/product/design.md', 'design'],
  ['docs/product/tasks.md', 'build'],
  ['docs/product/release.md', 'release'],
];
const REQUIRED_CAPABILITIES = ['tools', 'jsonl', 'cancel', 'permissions'] as const;

export interface FactoryRoleMap {
  research?: string;
  scope?: string;
  design?: string;
  build?: string;
  verify?: string;
  release?: string;
}

export interface CreateProjectOptions {
  name: string;
  idea: string;
  adapter?: string;
  model?: string | null;
  reasoning?: string | null;
}

export interface ConfigureProjectOptions {
  adapter?: string;
  model?: string | null;
  reasoning?: string | null;
  billing?: 'local' | 'subscription';
  confirmed?: boolean;
  factory_roles?: FactoryRoleMap;
  role_settings?: FactoryState['role_settings'];
}

export interface ProjectSummary extends JsonRecord {
  id: string;
  slug: string;
  name: string;
  path: string;
  runtime: 'typescript' | 'legacy' | 'unavailable';
  status: string;
  stage: string;
}

interface LocatedProject {
  summary: ProjectSummary;
  root: string;
  state: FactoryState;
}

function safeError(): string {
  return 'Workspace metadata is invalid or unavailable; no mutation was performed.';
}

function slug(name: string): string {
  const value = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value)) {
    throw new FoundryError('Project name must produce a lowercase slug with at most 80 characters');
  }
  return value;
}

function publicAdapter(adapter: ProviderAdapter): JsonRecord {
  return {
    name: adapter.name,
    kind: adapter.kind,
    capabilities: adapter.capabilities,
    billing_modes: adapter.billing_modes,
    ...(adapter.unsupported ? { unsupported: adapter.unsupported } : {}),
  };
}

function factoryRolesToOptions(roles: FactoryRoleMap | undefined): string[] | undefined {
  if (!roles) return undefined;
  const values: string[] = [];
  for (const [stage, name] of Object.entries(roles)) {
    if (!FACTORY_STAGES.includes(stage as FactoryStage) || typeof name !== 'string' || !name.trim()) {
      throw new FoundryError('Factory roles must map known stages to nonempty role names');
    }
    values.push(`${stage}=${name}`);
  }
  return values;
}

function normalizedPreference(value: string | null | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\r\n]/.test(value)) {
    throw new FoundryError(`${label} must be a single line of at most 120 characters`);
  }
  return value.trim();
}

function chooseAdapter(adapters: Record<string, ProviderAdapter>, requested?: string): {
  adapter: ProviderAdapter;
  billing: 'local' | 'subscription';
} {
  const candidates = requested
    ? [adapters[requested]]
    : Object.values(adapters).sort((left, right) => left.name.localeCompare(right.name));
  for (const adapter of candidates) {
    if (!adapter) {
      if (requested) throw new FoundryError(`Unknown provider adapter: ${requested}`);
      continue;
    }
    if (adapter.unsupported) {
      if (requested) throw new FoundryError(adapter.unsupported);
      continue;
    }
    if (adapter.kind !== 'agent-runtime'
      || !REQUIRED_CAPABILITIES.every((capability) => adapter.capabilities.includes(capability))) {
      if (requested) throw new FoundryError('Adapter lacks the capabilities required by Factory stages');
      continue;
    }
    if (adapter.billing_modes.includes('local')) return { adapter, billing: 'local' };
    if (adapter.billing_modes.includes('subscription')) return { adapter, billing: 'subscription' };
    if (requested) throw new FoundryError('Factory adapters must support local or subscription billing');
  }
  throw new FoundryError('No supported local or subscription Factory adapter is configured');
}

async function copyProviderConfiguration(source: string, target: string): Promise<void> {
  const sourcePath = path.join(source, '.foundry/providers.json');
  try {
    const stats = await lstat(sourcePath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new FoundryError('The source providers.json must be a regular file');
    }
    await atomicWrite(target, '.foundry/providers.json', await readFile(sourcePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

async function readDocument(root: string, relative: string): Promise<{ text: string; revision: string } | null> {
  try {
    const result = await readBoundedText(root, relative);
    return { text: result.text, revision: digest(result.bytes) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

function stageVerification(state: FactoryState): JsonRecord {
  const tasks = state.build_tasks.map((task) => ({
    title: task.title,
    status: task.status,
    fix_attempts: task.repair_attempts,
    checks: task.checkpoint ? 'passed' : task.status === 'failed' ? 'failed' : 'not_run',
    commit: task.checkpoint,
  }));
  const status = state.status === 'failed' ? 'failed'
    : state.verification_receipt ? 'passed'
      : tasks.some((task) => task.status === 'working') ? 'running'
        : tasks.length ? 'pending' : 'not_run';
  return { build: { status, tasks } };
}

function defaultNextStep(state: FactoryState): JsonRecord {
  if (state.status === 'completed') return { action: 'none', stage: null, label: null };
  if (state.status === 'awaiting_approval') {
    return { action: 'approve', stage: state.stage, label: FACTORY_STAGE_LABELS[state.stage] };
  }
  if (state.status === 'interrupted' || state.status === 'recovery_required') {
    return { action: 'recover', stage: state.stage, label: FACTORY_STAGE_LABELS[state.stage] };
  }
  return {
    action: state.status === 'failed' ? 'rerun' : 'run',
    stage: state.stage,
    label: FACTORY_STAGE_LABELS[state.stage],
  };
}

export async function runProjectUntilBoundary(rootInput: string, maxStages = FACTORY_STAGES.length + 2): Promise<FactoryState> {
  let state = await readFactoryState(rootInput);
  if (!state) throw new FoundryError('Factory is not initialized');
  for (let attempt = 0; attempt < maxStages; attempt += 1) {
    if (['awaiting_approval', 'completed', 'failed', 'interrupted', 'recovery_required'].includes(state.status)) return state;
    state = await runFactory(rootInput);
    if (['awaiting_approval', 'completed', 'failed', 'interrupted', 'recovery_required'].includes(state.status)) return state;
  }
  throw new FoundryError('Factory background run reached its bounded stage limit');
}

export class ProjectService {
  readonly sourceRoot: string;
  readonly productsDir: string;
  private readonly activeJobs = new Map<string, { status: string; error?: string }>();

  constructor(sourceRoot: string, productsDir?: string) {
    this.sourceRoot = path.resolve(sourceRoot);
    rejectSymlinkComponents(this.sourceRoot);
    const fallback = path.join(path.dirname(this.sourceRoot), 'products');
    this.productsDir = path.resolve(expandUserPath(productsDir ?? fallback));
    if (this.productsDir === this.sourceRoot || this.productsDir.startsWith(`${this.sourceRoot}${path.sep}`)) {
      throw new FoundryError('Products directory must be outside the framework checkout');
    }
    rejectSymlinkComponents(this.productsDir);
  }

  setJob(identifier: string, status: string, error?: string): void {
    this.activeJobs.set(identifier, { status, ...(error ? { error } : {}) });
  }

  clearJob(identifier: string): void {
    this.activeJobs.delete(identifier);
  }

  jobSnapshot(): Record<string, { status: string; error?: string }> {
    return Object.fromEntries(this.activeJobs.entries());
  }

  private async ensureProductsDir(): Promise<void> {
    await mkdir(this.productsDir, { recursive: true, mode: 0o700 });
    rejectSymlinkComponents(this.productsDir);
  }

  private async discover(): Promise<LocatedProject[]> {
    await this.ensureProductsDir();
    const entries = await readdir(this.productsDir, { withFileTypes: true });
    const projects: LocatedProject[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(this.productsDir, entry.name);
      if (entry.isSymbolicLink() || !entry.isDirectory()) {
        projects.push({
          root: child,
          state: null as unknown as FactoryState,
          summary: {
            id: `unavailable:${entry.name}`,
            slug: entry.name,
            name: entry.name,
            path: child,
            runtime: 'unavailable',
            status: 'unavailable',
            stage: 'unknown',
            error: safeError(),
          },
        });
        continue;
      }
      try {
        rejectSymlinkComponents(child);
        const marker = await readRuntimeMarker(child);
        if (!marker) {
          projects.push({
            root: child,
            state: null as unknown as FactoryState,
            summary: {
              id: `legacy:${entry.name}`,
              slug: entry.name,
              name: entry.name,
              path: child,
              runtime: 'legacy',
              status: 'legacy',
              stage: 'unknown',
              error: 'Legacy or unmarked workspace; use the existing Python runtime.',
            },
          });
          continue;
        }
        const state = await readFactoryState(child);
        if (!state) throw new FoundryError('Factory state is missing');
        projects.push({
          root: child,
          state,
          summary: {
            id: state.workspace_id,
            slug: entry.name,
            name: state.name,
            path: child,
            runtime: 'typescript',
            status: state.status,
            stage: state.stage,
          },
        });
      } catch {
        projects.push({
          root: child,
          state: null as unknown as FactoryState,
          summary: {
            id: `unavailable:${entry.name}`,
            slug: entry.name,
            name: entry.name,
            path: child,
            runtime: 'unavailable',
            status: 'unavailable',
            stage: 'unknown',
            error: safeError(),
          },
        });
      }
    }
    return projects;
  }

  private async locate(identifier: string): Promise<LocatedProject> {
    if (!identifier || identifier.includes('/') || identifier.includes('\\') || identifier === '.' || identifier === '..') {
      throw new FoundryError('Project ID or slug must identify a safe child workspace');
    }
    const projects = await this.discover();
    const match = projects.find((project) => project.summary.runtime === 'typescript'
      && (project.summary.id === identifier || project.summary.slug === identifier));
    if (match) return match;
    const unavailable = projects.find((project) => project.summary.slug === identifier);
    if (unavailable?.summary.runtime === 'legacy') {
      throw new FoundryError('Legacy or unmarked workspace; use the existing Python runtime.');
    }
    if (unavailable) throw new FoundryError(safeError());
    throw new FoundryError(`Unknown typed project: ${identifier}`);
  }

  private async view(project: LocatedProject): Promise<JsonRecord> {
    if (project.summary.runtime !== 'typescript') return project.summary;
    const { root, state } = project;
    let status: JsonRecord;
    try {
      status = await statusFactory(root);
    } catch {
      return { ...project.summary, runtime: 'unavailable', status: 'unavailable', error: safeError() };
    }
    const artifacts: JsonRecord[] = [];
    for (const [relative, stage] of FACTORY_DOCUMENTS) {
      if (await exists(root, relative)) artifacts.push({ path: relative, stage });
    }
    const roles = [...new Set(Object.values(state.roles))];
    const result: JsonRecord = {
      ...project.summary,
      runtime: 'typescript',
      idea: (await readDocument(root, 'docs/product/idea.md'))?.text ?? '',
      adapter: state.adapter,
      model: state.model,
      reasoning: state.reasoning,
      subscription_confirmed: state.billing.mode === 'subscription' && state.billing.confirmed,
      roles,
      factory_roles: state.roles,
      role_settings: state.role_settings,
      stage_verification: stageVerification(state),
      artifacts,
      history: [],
      created_at: state.created_at,
      updated_at: state.updated_at,
      error: state.failure?.message,
      ready_next_step: status.ready_next_step ?? defaultNextStep(state),
      stale_inputs: status.stale_inputs ?? [],
      stale_approvals: status.stale_approvals ?? [],
      approvals: state.approvals,
      review: state.review,
      verification_receipt: state.verification_receipt,
      ship: state.ship,
    };
    return result;
  }

  async list(): Promise<ProjectSummary[]> {
    return (await this.discover()).map((project) => project.summary);
  }

  async snapshot(): Promise<JsonRecord> {
    const located = await this.discover();
    const projects = await Promise.all(located.map((project) => this.view(project)));
    let roleCatalog: JsonRecord[] = [];
    try {
      roleCatalog = (await loadRoles(this.sourceRoot)).map((role) => ({
        name: role.name,
        description: role.description,
        sandbox: role.sandbox,
      }));
    } catch {
      roleCatalog = [];
    }
    let providers: JsonRecord[] = [];
    let providerError: string | undefined;
    try {
      providers = Object.values(await registry(this.sourceRoot)).map(publicAdapter);
    } catch {
      providerError = 'Provider configuration is invalid; no adapters are available.';
    }
    const projectProviders: Record<string, JsonRecord[]> = {};
    const providerErrors: Record<string, string> = {};
    const projectRoles: Record<string, JsonRecord[]> = {};
    for (const project of located) {
      if (project.summary.runtime !== 'typescript') continue;
      try {
        projectProviders[project.summary.id] = Object.values(await registry(project.root)).map(publicAdapter);
      } catch {
        projectProviders[project.summary.id] = [];
        providerErrors[project.summary.id] = 'Provider configuration is invalid for this workspace.';
      }
      try {
        projectRoles[project.summary.id] = (await loadRoles(project.root)).map((role) => ({
          name: role.name,
          description: role.description,
          sandbox: role.sandbox,
        }));
      } catch {
        projectRoles[project.summary.id] = [];
      }
    }
    return {
      schema_version: 1,
      runtime: 'typescript',
      products_dir: this.productsDir,
      projects,
      roles: roleCatalog,
      project_roles: projectRoles,
      providers,
      ...(providerError ? { provider_error: providerError } : {}),
      project_providers: projectProviders,
      provider_errors: providerErrors,
      account: {
        connected: false,
        sharing: false,
        message: 'Login is handled by the TypeScript runtime CLI; ChatGPT is unsupported in this preview.',
      },
      jobs: this.jobSnapshot(),
    };
  }

  async status(identifier: string): Promise<JsonRecord> {
    return this.view(await this.locate(identifier));
  }

  async create(options: CreateProjectOptions): Promise<JsonRecord> {
    if (typeof options.name !== 'string' || !options.name.trim()) throw new FoundryError('Project name is required');
    if (typeof options.idea !== 'string' || !options.idea.trim()) throw new FoundryError('Project idea is required');
    const projectSlug = slug(options.name);
    await this.ensureProductsDir();
    const target = path.join(this.productsDir, projectSlug);
    try {
      await lstat(target);
      throw new FoundryError('A project with this slug already exists; choose a fresh name');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    rejectSymlinkComponents(target);
    const adapters = await registry(this.sourceRoot);
    const selected = chooseAdapter(adapters, options.adapter);
    await validateFactoryAdapter(this.sourceRoot, selected.adapter.name, {
      mode: selected.billing,
      confirmed: false,
    }, false);
    await installWorkspace(this.sourceRoot, target);
    await copyProviderConfiguration(this.sourceRoot, target);
    const initialized = await initFactory(target, {
      name: options.name,
      idea: options.idea,
      adapter: selected.adapter.name,
      model: options.model == null ? undefined : normalizedPreference(options.model, 'Project model'),
      reasoning: options.reasoning == null ? undefined : normalizedPreference(options.reasoning, 'Project reasoning'),
      billing: selected.billing,
      confirmed: false,
    });
    return this.view({
      root: target,
      state: initialized,
      summary: {
        id: initialized.workspace_id,
        slug: projectSlug,
        name: initialized.name,
        path: target,
        runtime: 'typescript',
        status: initialized.status,
        stage: initialized.stage,
      },
    });
  }

  async configure(identifier: string, options: ConfigureProjectOptions): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    const factoryOptions: FactoryConfigureOptions = {
      adapter: options.adapter,
      model: normalizedPreference(options.model, 'Project model'),
      reasoning: normalizedPreference(options.reasoning, 'Project reasoning'),
      billing: options.billing,
      confirmed: options.confirmed === true,
      roles: factoryRolesToOptions(options.factory_roles),
      roleSettings: options.role_settings,
    };
    const state = await configureFactory(project.root, factoryOptions);
    return this.view({ ...project, state });
  }

  async run(identifier: string): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    const state = await runFactory(project.root);
    return this.view({ ...project, state });
  }

  async review(identifier: string): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    const stage = project.state.stage === 'design' ? 'design' : 'plan';
    return reviewFactory(project.root, stage);
  }

  async approve(identifier: string, revision: string): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    const state = await readFactoryState(project.root);
    if (!state || state.status !== 'awaiting_approval') {
      throw new FoundryError('Project is not awaiting an owner approval');
    }
    if (state.stage !== 'scope' && state.stage !== 'design') {
      throw new FoundryError('Project is not awaiting a Plan or Design approval');
    }
    const stage = state.stage === 'scope' ? 'plan' : 'design';
    const approved = await approveFactory(project.root, stage, revision);
    return this.view({ ...project, state: approved });
  }

  async stop(identifier: string): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    return cancelFactory(project.root);
  }

  async recover(identifier: string): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    const state = await recoverFactory(project.root);
    return this.view({ ...project, state });
  }

  async providers(identifier?: string): Promise<JsonRecord[]> {
    const root = identifier ? (await this.locate(identifier)).root : this.sourceRoot;
    return Object.values(await registry(root)).map(publicAdapter);
  }

  async artifact(identifier: string, relative: string): Promise<JsonRecord> {
    const project = await this.locate(identifier);
    if (!FACTORY_DOCUMENTS.some(([candidate]) => candidate === relative)) {
      throw new FoundryError('Artifact is not an allowed product document');
    }
    const view = await this.view(project);
    const listed = Array.isArray(view.artifacts) && view.artifacts.some((item) => (
      typeof item === 'object' && item !== null && (item as JsonRecord).path === relative
    ));
    if (!listed) throw new FoundryError('Artifact is not present in the project');
    const file = await readBoundedText(project.root, relative);
    const stage = FACTORY_DOCUMENTS.find(([candidate]) => candidate === relative)?.[1] ?? 'document';
    return { path: relative, stage, revision: digest(file.bytes), content: file.text };
  }

  async models(): Promise<never[]> {
    return [];
  }
}

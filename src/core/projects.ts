import { lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  approveFactory, cancelFactory, configureFactory, initFactory, recoverFactory, reviewFactory,
  runFactory, statusFactory, validateFactoryAdapter, type FactoryConfigureOptions,
} from './factory.js';
import {
  FACTORY_STAGE_LABELS, FACTORY_STAGES, readBoundedBytes, readBoundedText, readFactoryState,
  factoryShipSchema, roleSettingsSchema, type FactoryStage, type FactoryState, type FactoryStatus,
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
const SHIP_DOCUMENT = 'docs/product/release.md';

async function shipDocument(root: string, state: FactoryState): Promise<string | null> {
  if (state.status !== 'completed' || state.ship?.path !== '.foundry/state/factory/ship.json') return null;
  try {
    const file = await readBoundedText(root, state.ship.path);
    if (digest(file.bytes) !== state.ship.sha256) return null;
    const ship = factoryShipSchema.parse(JSON.parse(file.text));
    if (ship.run_id !== state.lifecycle_run_id || ship.plan_revision !== state.approvals.plan?.revision
      || ship.verification_receipt !== state.verification_receipt
      || ship.workspace_revision !== state.review?.workspace_revision
      || ship.review_sha256 !== digest(JSON.stringify(state.review?.result))) return null;
    return ship.summary;
  } catch {
    return null;
  }
}

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
  state: FactoryState | null;
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
  if (roles === undefined) return undefined;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) {
    throw new FoundryError('Factory roles must be a stage-to-role object');
  }
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

function chooseAdapter(adapters: Record<string, ProviderAdapter>, requested = 'codex'): {
  adapter: ProviderAdapter;
  billing: 'local' | 'subscription';
} {
  if (typeof requested !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(requested)) {
    throw new FoundryError('Provider adapter must be a registered adapter name');
  }
  const adapter = adapters[requested];
  if (!adapter) throw new FoundryError(`Unknown provider adapter: ${requested}`);
  if (adapter.unsupported) throw new FoundryError(adapter.unsupported);
  if (adapter.kind !== 'agent-runtime'
    || !REQUIRED_CAPABILITIES.every((capability) => adapter.capabilities.includes(capability))) {
    throw new FoundryError('Adapter lacks the capabilities required by Factory stages');
  }
  if (adapter.billing_modes.includes('local')) return { adapter, billing: 'local' };
  if (adapter.billing_modes.includes('subscription')) return { adapter, billing: 'subscription' };
  throw new FoundryError('Factory adapters must support local or subscription billing');
}

async function providerConfiguration(source: string): Promise<Buffer | null> {
  if (!(await exists(source, '.foundry/providers.json'))) return null;
  return readBoundedBytes(source, '.foundry/providers.json', 256 * 1024);
}

async function copyProviderConfiguration(target: string, bytes: Buffer | null): Promise<void> {
  if (bytes) await atomicWrite(target, '.foundry/providers.json', bytes);
}

function validatedCreateOptions(options: CreateProjectOptions): {
  name: string;
  idea: string;
  slug: string;
  adapter: string;
  model: string | undefined;
  reasoning: string | undefined;
} {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new FoundryError('Project creation requires a JSON object');
  }
  const unknown = Object.keys(options).find((key) => !['name', 'idea', 'adapter', 'model', 'reasoning'].includes(key));
  if (unknown) throw new FoundryError(`Unknown project creation field: ${unknown}`);
  if (typeof options.name !== 'string' || !options.name.trim() || options.name.trim().length > 120
    || /[\r\n\0]/.test(options.name)) {
    throw new FoundryError('Project name must be a single line of at most 120 characters');
  }
  if (typeof options.idea !== 'string' || !options.idea.trim() || options.idea.includes('\0')
    || Buffer.byteLength(options.idea, 'utf8') > 64 * 1024) {
    throw new FoundryError('Project idea must be nonempty and at most 64 KiB');
  }
  const name = options.name.trim();
  const adapter = options.adapter === undefined ? 'codex' : options.adapter;
  if (typeof adapter !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(adapter)) {
    throw new FoundryError('Provider adapter must be a registered adapter name');
  }
  return {
    name,
    idea: options.idea.trim(),
    slug: slug(name),
    adapter,
    model: normalizedPreference(options.model, 'Project model') || undefined,
    reasoning: normalizedPreference(options.reasoning, 'Project reasoning') || undefined,
  };
}

function requireGit(): void {
  const result = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 5_000 });
  if (result.error || result.status !== 0) {
    throw new FoundryError('Git is required to create a typed project; install Git before creating the workspace');
  }
}

function runGit(target: string, args: string[], extra: string[] = []): void {
  const result = spawnSync('git', ['-C', target, ...extra, ...args], {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const detail = (result.stderr || result.error?.message || 'Git command failed').trim().slice(0, 300);
    throw new FoundryError(`Initial Git checkpoint is incomplete (${detail})`);
  }
}

async function initializeProjectGit(target: string): Promise<void> {
  try {
    await atomicWrite(target, '.gitignore', [
      '.foundry/state/',
      '.foundry/providers.json',
      '.foundry/runtime/',
      '.env',
      '.env.*',
      '!.env.example',
      '.npmrc',
      '.secrets/',
      'credentials.*',
      'secrets.*',
      '*.pem',
      '*.key',
      'id_rsa',
      'id_ed25519',
      '',
    ].join('\n'));
    runGit(target, ['init', '-q']);
    runGit(target, ['add', '--', '.gitignore', '.foundry/project.json', '.foundry/install.json',
      '.foundry/runtime.json', '.foundry/roles.json', 'docs/product/idea.md']);
    const authorName = spawnSync('git', ['-C', target, 'config', 'user.name'], { encoding: 'utf8' });
    const authorEmail = spawnSync('git', ['-C', target, 'config', 'user.email'], { encoding: 'utf8' });
    const identity: string[] = [];
    if (authorName.status !== 0 || !authorName.stdout.trim()) identity.push('-c', 'user.name=Foundry Workspace');
    if (authorEmail.status !== 0 || !authorEmail.stdout.trim()) identity.push('-c', 'user.email=foundry@localhost');
    runGit(target, ['commit', '-q', '-m', 'Initialize Foundry workspace'], identity);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Git setup failed';
    throw new FoundryError(`New workspace setup is incomplete and has been preserved at ${target}; inspect it before retrying. ${message}`, { cause: error });
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

export async function runProjectUntilBoundary(rootInput: string, maxStages = FACTORY_STAGES.length + 2): Promise<FactoryState> {
  let state = await readFactoryState(rootInput);
  if (!state) throw new FoundryError('Factory is not initialized');
  const boundary = new Set<FactoryState['status']>([
    'awaiting_approval', 'completed', 'failed', 'interrupted', 'recovery_required',
  ]);
  for (let attempt = 0; attempt < maxStages; attempt += 1) {
    try {
      state = await runFactory(rootInput);
    } catch (error) {
      const persisted = await readFactoryState(rootInput);
      if (persisted && boundary.has(persisted.status) && JSON.stringify(persisted) !== JSON.stringify(state)) return persisted;
      throw error;
    }
    if (boundary.has(state.status)) return state;
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
          state: null,
          summary: {
            id: `unavailable:${entry.name}`,
            slug: entry.name,
            name: entry.name,
            path: child,
            runtime: 'unavailable',
            status: 'unavailable',
            stage: 'unknown',
            idea: '',
            artifacts: [],
            history: [],
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
            state: null,
            summary: {
              id: `legacy:${entry.name}`,
              slug: entry.name,
              name: entry.name,
              path: child,
              runtime: 'legacy',
              status: 'legacy',
              stage: 'unknown',
              idea: '',
              artifacts: [],
              history: [],
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
          state: null,
          summary: {
            id: `unavailable:${entry.name}`,
            slug: entry.name,
            name: entry.name,
            path: child,
            runtime: 'unavailable',
            status: 'unavailable',
            stage: 'unknown',
            idea: '',
            artifacts: [],
            history: [],
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
    const { root } = project;
    let status: FactoryStatus;
    try {
      status = await statusFactory(root);
    } catch {
      return {
        ...project.summary,
        runtime: 'unavailable',
        status: 'unavailable',
        idea: '',
        artifacts: [],
        history: [],
        error: safeError(),
      };
    }
    const artifacts: JsonRecord[] = [];
    for (const [relative, stage] of FACTORY_DOCUMENTS) {
      if (relative === SHIP_DOCUMENT) continue;
      if (await exists(root, relative)) artifacts.push({ path: relative, stage });
    }
    if (await shipDocument(root, status) !== null) artifacts.push({ path: SHIP_DOCUMENT, stage: 'release' });
    const roles = [...new Set(Object.values(status.roles))];
    const result: JsonRecord = {
      ...project.summary,
      ...status,
      id: status.workspace_id,
      slug: project.summary.slug,
      name: status.name,
      path: root,
      runtime: 'typescript',
      idea: (await readDocument(root, 'docs/product/idea.md'))?.text ?? '',
      adapter: status.adapter,
      billing_mode: status.billing.mode,
      model: status.model,
      reasoning: status.reasoning,
      subscription_confirmed: status.billing.mode === 'subscription' && status.billing.confirmed,
      roles,
      factory_roles: status.roles,
      role_settings: status.role_settings,
      stage_verification: stageVerification(status),
      artifacts,
      history: status.completed_stages.map((stage) => ({ stage, status: 'completed' })),
      created_at: status.created_at,
      updated_at: status.updated_at,
      error: status.failure?.message,
      ready_next_step: status.ready_next_step,
      stale_inputs: status.stale_inputs,
      stale_approvals: status.stale_approvals,
      approvals: status.approvals,
      review: status.review,
      verification_receipt: status.verification_receipt,
      ship: status.ship,
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
    const validated = validatedCreateOptions(options);
    const projectSlug = validated.slug;
    requireGit();
    const sourceConfiguration = await providerConfiguration(this.sourceRoot);
    const adapters = await registry(this.sourceRoot, sourceConfiguration);
    const selected = chooseAdapter(adapters, validated.adapter);
    await validateFactoryAdapter(this.sourceRoot, selected.adapter.name, {
      mode: selected.billing,
      confirmed: false,
    }, false);
    await this.ensureProductsDir();
    const target = path.join(this.productsDir, projectSlug);
    try {
      await lstat(target);
      throw new FoundryError('A project with this slug already exists; choose a fresh name');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    rejectSymlinkComponents(target);
    try {
      await mkdir(target, { recursive: false, mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new FoundryError('A project with this slug already exists; choose a fresh name', { cause: error });
      }
      throw error;
    }
    try {
      await installWorkspace(this.sourceRoot, target);
      await copyProviderConfiguration(target, sourceConfiguration);
      const initialized = await initFactory(target, {
        name: validated.name,
        idea: validated.idea,
        adapter: selected.adapter.name,
        model: validated.model,
        reasoning: validated.reasoning,
        billing: selected.billing,
        confirmed: false,
      });
      await initializeProjectGit(target);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workspace setup failed';
      if (message.startsWith('New workspace setup is incomplete and has been preserved at ')) throw error;
      throw new FoundryError(`New workspace setup is incomplete and has been preserved at ${target}; inspect it before retrying. ${message}`, { cause: error });
    }
  }

  async configure(identifier: string, options: ConfigureProjectOptions): Promise<JsonRecord> {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new FoundryError('Project configuration requires a JSON object');
    }
    const allowed = new Set(['adapter', 'model', 'reasoning', 'billing', 'confirmed', 'factory_roles', 'role_settings']);
    const unknown = Object.keys(options).find((key) => !allowed.has(key));
    if (unknown) throw new FoundryError(`Unknown project configuration field: ${unknown}`);
    if (options.adapter !== undefined && (typeof options.adapter !== 'string'
      || !/^[a-z][a-z0-9_-]{0,63}$/.test(options.adapter))) {
      throw new FoundryError('Provider adapter must be a registered adapter name');
    }
    if (options.billing !== undefined && options.billing !== 'local' && options.billing !== 'subscription') {
      throw new FoundryError('Factory billing must be local or subscription');
    }
    if (options.confirmed !== undefined && typeof options.confirmed !== 'boolean') {
      throw new FoundryError('Subscription consent must be a boolean');
    }
    const model = normalizedPreference(options.model, 'Project model');
    const reasoning = normalizedPreference(options.reasoning, 'Project reasoning');
    if (options.role_settings !== undefined
      && (!options.role_settings || typeof options.role_settings !== 'object' || Array.isArray(options.role_settings))) {
      throw new FoundryError('Role settings must be a role-to-preferences object');
    }
    const roles = factoryRolesToOptions(options.factory_roles);
    const roleSettingsResult = options.role_settings === undefined
      ? undefined : roleSettingsSchema.safeParse(options.role_settings);
    if (roleSettingsResult && !roleSettingsResult.success) {
      throw new FoundryError(`Invalid role settings: ${roleSettingsResult.error.issues.map((issue) => issue.message).join('; ')}`);
    }
    const project = await this.locate(identifier);
    const desiredAdapter = options.adapter ?? project.state?.adapter;
    if (!desiredAdapter || !project.state) throw new FoundryError(safeError());
    const adapterChanged = desiredAdapter !== project.state.adapter;
    let billing = options.billing;
    let confirmed = options.confirmed;
    if (billing === undefined && options.confirmed === true) billing = 'subscription';
    if (billing === undefined && adapterChanged) {
      const selected = chooseAdapter(await registry(project.root), desiredAdapter);
      billing = selected.billing;
      confirmed = false;
    }
    if (billing === undefined && options.confirmed === false && !adapterChanged
      && project.state.billing.mode === 'subscription') {
      billing = 'subscription';
    }
    if (billing !== undefined && confirmed === undefined) confirmed = false;
    if (billing !== 'subscription' && confirmed === true) {
      throw new FoundryError('Subscription consent requires subscription billing');
    }
    const factoryOptions: FactoryConfigureOptions = {
      adapter: options.adapter,
      model,
      reasoning,
      billing,
      confirmed: confirmed === true,
      roles,
      roleSettings: roleSettingsResult?.data,
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
    if (!project.state) throw new FoundryError(safeError());
    const status = await statusFactory(project.root);
    const stage = status.stage === 'design' ? 'design' : 'plan';
    return reviewFactory(project.root, stage);
  }

  async resolveRunTarget(identifier: string): Promise<{ id: string; path: string }> {
    const project = await this.locate(identifier);
    if (!project.state) throw new FoundryError(safeError());
    return { id: project.state.workspace_id, path: path.resolve(project.root) };
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
    if (relative === SHIP_DOCUMENT) {
      const state = await readFactoryState(project.root);
      const summary = state ? await shipDocument(project.root, state) : null;
      if (summary === null) throw new FoundryError('The saved Ship summary is unavailable or changed');
      return { path: relative, stage: 'release', revision: digest(summary), content: summary };
    }
    const file = await readBoundedText(project.root, relative);
    const stage = FACTORY_DOCUMENTS.find(([candidate]) => candidate === relative)?.[1] ?? 'document';
    return { path: relative, stage, revision: digest(file.bytes), content: file.text };
  }

  async models(): Promise<never[]> {
    return [];
  }
}

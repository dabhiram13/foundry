import path from 'node:path';
import { McpServer, type CallToolResult, type JSONObject } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { FoundryError, rejectSymlinkComponents } from '../core/fs.js';
import {
  complete, finishTask, pauseOrResume, prepareAssignment, recordWorkReview, recover,
  reviewScope, saveTaskPlan, specialists, start, verify, workContext,
} from '../core/lifecycle.js';
import { taskPlanSchema, workReviewSchema } from '../core/work-plan.js';

function result(value: unknown, isError = false): CallToolResult {
  const structuredContent = JSON.parse(JSON.stringify(value)) as JSONObject;
  return { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent, isError };
}

export async function serveMcp(rootInput: string, version: string): Promise<void> {
  const root = path.resolve(rootInput);
  rejectSymlinkComponents(root);
  if ((await workContext(root)).project !== root) throw new FoundryError('MCP requires the project root, not a nested directory.');
  const server = new McpServer({ name: 'foundry', version });
  const running = new Set<Promise<unknown>>();
  let closing = false;
  const guarded = async (action: () => Promise<unknown>): Promise<CallToolResult> => {
    if (closing) return result({ error: 'The connection is closing. Reconnect and read context.' }, true);
    const operation = action();
    running.add(operation);
    try {
      const value = await operation;
      const exitCode = (value as { exit_code?: number } | null)?.exit_code;
      return result(value, exitCode !== undefined && exitCode !== 0);
    } catch (error) {
      return result({ error: (error as Error).message, next_action: 'Read foundry_context and resolve its blockers before retrying.' }, true);
    } finally {
      running.delete(operation);
    }
  };
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const mutation = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
  const empty = z.object({}).strict();
  const snapshot = z.object({ snapshot_revision: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
  server.registerTool('foundry_context', {
    description: 'Read saved work, current evidence, approval blockers and the snapshot required for mutations. No checks run.',
    inputSchema: empty, annotations: readOnly,
  }, async () => guarded(() => workContext(root)));
  server.registerTool('foundry_review', {
    description: 'Read the exact proposed specification, criteria and configured checks for owner review. This does not approve anything.',
    inputSchema: empty, annotations: readOnly,
  }, async () => guarded(() => reviewScope(root)));
  server.registerTool('foundry_specialists', {
    description: 'List the neutral specialist roles available in this project. No provider runs.',
    inputSchema: empty, annotations: readOnly,
  }, async () => guarded(() => specialists(root)));
  server.registerTool('foundry_assignment', {
    description: 'Prepare a Planner, next ready Builder or Reviewer assignment for the host client. Read-only; no model or checks run.',
    inputSchema: z.object({ stage: z.enum(['planner', 'builder', 'reviewer']) }).strict(), annotations: readOnly,
  }, async ({ stage }) => guarded(() => prepareAssignment(root, stage)));
  server.registerTool('foundry_save_plan', {
    description: 'Save a bounded task plan into the existing scope contract. Changes require renewed terminal approval.',
    inputSchema: snapshot.extend({ plan: taskPlanSchema }).strict(), annotations: mutation,
  }, async ({ plan, snapshot_revision }) => guarded(async () => {
    await saveTaskPlan(root, plan, snapshot_revision);
    return workContext(root);
  }));
  server.registerTool('foundry_task_done', {
    description: 'Record the next ready task with actual current passing evidence. Does not claim semantic correctness.',
    inputSchema: snapshot.extend({ task_id: z.string().regex(/^[A-Z][A-Z0-9_-]{1,63}$/) }).strict(), annotations: mutation,
  }, async ({ task_id, snapshot_revision }) => guarded(async () => {
    await finishTask(root, task_id, snapshot_revision);
    return workContext(root);
  }));
  server.registerTool('foundry_record_review', {
    description: 'Save host-reported observations for every approved criterion and findings. Gaps, unverified criteria and blocking findings block completion.',
    inputSchema: snapshot.extend({ report: workReviewSchema }).strict(), annotations: mutation,
  }, async ({ report, snapshot_revision }) => guarded(async () => {
    await recordWorkReview(root, report, snapshot_revision);
    return workContext(root);
  }));
  server.registerTool('foundry_start', {
    description: 'Propose contracted scoped work using project-relative documents. The owner must approve the reviewed revision through the terminal.',
    inputSchema: snapshot.extend({ slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
      spec: z.string().min(1).max(512), contract: z.string().min(1).max(512) }).strict(),
    annotations: mutation,
  }, async ({ slug, spec, contract, snapshot_revision }) => guarded(async () => {
    await start(root, slug, spec, contract, snapshot_revision);
    return workContext(root);
  }));
  server.registerTool('foundry_verify', {
    description: 'Run only the project-configured checks for currently approved scoped work. Checks have local command authority, not a sandbox.',
    inputSchema: snapshot, annotations: { ...mutation, destructiveHint: true, openWorldHint: true },
  }, async ({ snapshot_revision }, context) => guarded(async () => {
    const exit_code = await verify(root, () => closing || context.mcpReq.signal.aborted, snapshot_revision);
    return { exit_code, context: await workContext(root) };
  }));
  server.registerTool('foundry_complete', {
    description: 'Record completion only when current approved scope and required evidence pass. This is not owner acceptance or deployment.',
    inputSchema: snapshot, annotations: mutation,
  }, async ({ snapshot_revision }) => guarded(async () => {
    await complete(root, snapshot_revision);
    return workContext(root);
  }));
  for (const [name, pause] of [['foundry_pause', true], ['foundry_resume', false]] as const) {
    server.registerTool(name, {
      description: pause ? 'Save a pause for the current scoped change.' : 'Resume the same scoped change; previous verification must be refreshed.',
      inputSchema: snapshot, annotations: mutation,
    }, async ({ snapshot_revision }) => guarded(async () => {
      await pauseOrResume(root, pause, snapshot_revision);
      return workContext(root);
    }));
  }
  server.registerTool('foundry_recover', {
    description: 'Reconcile interrupted scoped lifecycle work without inventing passed checks or owner approval.',
    inputSchema: snapshot, annotations: mutation,
  }, async ({ snapshot_revision }) => guarded(async () => {
    await recover(root, snapshot_revision);
    return workContext(root);
  }));
  const closed = new Promise<void>((resolve) => {
    server.server.onclose = () => {
      closing = true;
      void Promise.allSettled([...running]).then(() => resolve());
    };
  });
  const shutdown = (): void => { closing = true; void server.close(); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await server.connect(new StdioServerTransport());
    await closed;
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await server.close();
  }
}

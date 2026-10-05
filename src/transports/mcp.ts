import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ProjectService } from '../core/projects.js';
import { closeProjectRuns } from './jobs.js';
import { startProjectRun } from './jobs.js';

type ToolResult = {
  structuredContent?: Record<string, unknown>;
  content: [{ type: 'text'; text: string }];
  isError?: boolean;
};

function result(value: Record<string, unknown>): ToolResult {
  return {
    structuredContent: value,
    content: [{ type: 'text', text: JSON.stringify(value) }],
  };
}

function failure(error: unknown): ToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : 'Foundry tool failed' }],
  };
}

export async function startMcpServer(service: ProjectService): Promise<void> {
  const server = new McpServer({ name: 'foundry-typed', version: '1.0.0' });
  server.registerTool('foundry_snapshot', {
    description: 'Read the local typed Foundry project snapshot.',
    inputSchema: {},
  }, async () => {
    try {
      return result(await service.snapshot());
    } catch (error) {
      process.stderr.write(`foundry_snapshot: ${error instanceof Error ? error.message : String(error)}\n`);
      return failure(error);
    }
  });
  server.registerTool('foundry_create', {
    description: 'Create a typed project without starting provider work.',
    inputSchema: { name: z.string().min(1), idea: z.string().min(1), adapter: z.string().optional() },
  }, async ({ name, idea, adapter }) => {
    try {
      return result(await service.create({ name, idea, adapter }));
    } catch (error) {
      process.stderr.write(`foundry_create: ${error instanceof Error ? error.message : String(error)}\n`);
      return failure(error);
    }
  });
  server.registerTool('foundry_run', {
    description: 'Start one bounded typed Factory run; owner approvals stay in the terminal or local browser.',
    inputSchema: { id: z.string().min(1) },
  }, async ({ id }) => {
    try {
      return result(await startProjectRun(service, id));
    } catch (error) {
      process.stderr.write(`foundry_run: ${error instanceof Error ? error.message : String(error)}\n`);
      return failure(error);
    }
  });
  server.registerTool('foundry_cancel', {
    description: 'Request cancellation of an owned typed Factory run.',
    inputSchema: { id: z.string().min(1) },
  }, async ({ id }) => {
    try {
      return result(await service.stop(id));
    } catch (error) {
      process.stderr.write(`foundry_cancel: ${error instanceof Error ? error.message : String(error)}\n`);
      return failure(error);
    }
  });
  server.registerTool('foundry_artifact', {
    description: 'Read a bounded listed product document.',
    inputSchema: { id: z.string().min(1), path: z.string().min(1) },
  }, async ({ id, path }) => {
    try {
      return result(await service.artifact(id, path));
    } catch (error) {
      process.stderr.write(`foundry_artifact: ${error instanceof Error ? error.message : String(error)}\n`);
      return failure(error);
    }
  });
  server.registerTool('foundry_recover', {
    description: 'Explicitly recover an interrupted typed Factory run.',
    inputSchema: { id: z.string().min(1) },
  }, async ({ id }) => {
    try {
      return result(await service.recover(id));
    } catch (error) {
      process.stderr.write(`foundry_recover: ${error instanceof Error ? error.message : String(error)}\n`);
      return failure(error);
    }
  });
  const transport = new StdioServerTransport();
  await new Promise<void>((resolve, reject) => {
    let cleanupPromise: Promise<void> | undefined;
    const cleanup = (): Promise<void> => {
      if (cleanupPromise) return cleanupPromise;
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      process.stdin.removeListener('end', onDisconnect);
      process.stdin.removeListener('close', onDisconnect);
      cleanupPromise = (async () => {
        try {
          const confirmed = await closeProjectRuns(service);
          await server.close().catch(() => undefined);
          if (!confirmed) throw new Error('Worker shutdown was not confirmed');
          resolve();
        } catch (error) {
          process.stderr.write('Foundry MCP cleanup could not confirm all worker state.\n');
          process.exitCode = 1;
          reject(error);
        }
      })();
      return cleanupPromise;
    };
    const onSignal = () => {
      void cleanup();
    };
    const onDisconnect = () => {
      void cleanup();
    };
    void server.connect(transport).then(() => {
      const previousClose = transport.onclose;
      transport.onclose = () => {
        previousClose?.();
        void cleanup();
      };
      process.once('SIGINT', onSignal);
      process.once('SIGTERM', onSignal);
      process.stdin.once('end', onDisconnect);
      process.stdin.once('close', onDisconnect);
      if (process.stdin.readableEnded || process.stdin.destroyed) void cleanup();
    }).catch((error: unknown) => {
      void cleanup().finally(() => reject(error));
    });
  });
}

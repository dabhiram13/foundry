import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { SessionDatabase, storageError } from './session-database.js';
import { sessionRequestSchema, storageWorkerDataSchema } from './session-rpc.js';

if (!parentPort) throw new Error('Session storage requires a worker port');
const port = parentPort;
try {
  const config = storageWorkerDataSchema.parse(workerData);
  const database = new SessionDatabase(config.directory);
  port.on('message', (input: unknown) => {
    const request = sessionRequestSchema.safeParse(input);
    if (!request.success) {
      const id = z.object({ id: z.uuid() }).safeParse(input);
      if (id.success) port.postMessage({ id: id.data.id, ok: false, code: 'invalid_input' });
      else { database.close(); port.close(); }
      return;
    }
    const message = request.data;
    try {
      let data: unknown;
      switch (message.type) {
        case 'accept': data = database.accept(message.command, message.actor); break;
        case 'get': data = database.get(message.sessionId, message.actor); break;
        case 'events': data = database.events(message.sessionId, message.actor, message.after, message.limit); break;
        case 'effects': data = database.effects(message.sessionId, message.actor); break;
        case 'close': database.close(); data = null; break;
      }
      port.postMessage({ id: message.id, ok: true, data });
      if (message.type === 'close') port.close();
    } catch (error) {
      port.postMessage({ id: message.id, ok: false, code: storageError(error).code });
    }
  });
  port.postMessage({ ready: true, schemaVersion: 1 });
} catch (error) {
  port.postMessage({ ready: false, code: storageError(error).code });
  port.close();
}

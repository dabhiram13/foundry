import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
const app = new App({ name: 'Foundry', version: '0.3.0' });
new OpenAIExtensions(app);
app.ontoolresult = result => { window.foundryInitial = result.structuredContent; };
app.addEventListener('hostcontextchanged', context => {
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
});
window.foundryBridgePromise = app.connect().then(() => app);

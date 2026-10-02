'use strict';
const token = document.querySelector('meta[name="foundry-token"]').content;
const $ = id => document.getElementById(id);
const stages = ['research', 'scope', 'design', 'build', 'verify', 'release'];
const descriptions = {
  research: ['Find the useful opportunity', 'Research the problem, current alternatives, and the assumptions that would change what you build.'],
  scope: ['Choose the first useful version', 'Review the intended user, boundaries, and acceptance criteria before implementation.'],
  design: ['Review the product experience', 'Check the proposed journeys and design decisions before the build starts.'],
  build: ['Build the agreed product', 'The coordinator uses your product’s specialist instructions and selected runtime to implement the approved scope.'],
  verify: ['Exercise the product', 'Run the configured product checks and save evidence. A model’s completion message cannot pass this stage.'],
  release: ['Prepare for a real release', 'Review the build record and release handoff. Deployments, spending, and external account access still need your authorization.']
};
let snapshot = {}, selected = localStorage.getItem('foundry-product'), creating = !selected, busy = false;
const cap = text => String(text || '').replace(/(^|[_-])(\w)/g, (_, sep, letter) => (sep ? ' ' : '') + letter.toUpperCase());
function notice(text, error = false) { $('notice').textContent = text; $('notice').classList.toggle('error', error); $('notice').hidden = !text; }
async function api(action, data) {
  if (window.foundryBridgePromise) {
    const bridge = await window.foundryBridgePromise;
    const [name, query] = action.split('?');
    const names = {'snapshot':'foundry_snapshot','create':'foundry_create','configure':'foundry_configure','run':'foundry_run','approve':'foundry_approve','cancel':'foundry_cancel','sign-in':'foundry_sign_in','sign-out':'foundry_sign_out','models':'foundry_models','artifact':'foundry_artifact'};
    const args = data || Object.fromEntries(new URLSearchParams(query || ''));
    const result = await bridge.callServerTool({name:names[name],arguments:args});
    if (result.isError) throw Error(result.content?.find(c=>c.type==='text')?.text || 'Foundry action failed');
    const value = result.structuredContent || JSON.parse(result.content.find(c=>c.type==='text').text);
    return name === 'models' ? value.models : value;
  }
  const response = await fetch('/api/' + action, { method: data === undefined ? 'GET' : 'POST', headers: { 'X-Foundry-Token': token, 'Content-Type': 'application/json' }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'The action could not finish');
  return value;
}
async function perform(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(el => el.disabled = true);
  try { await fn(); await refresh(); } catch (error) { notice(error.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(el => el.disabled = false); }
}
function project() { return (snapshot.projects || []).find(p => p.id === selected); }
function button(text, fn, primary = false) { const el = document.createElement('button'); el.textContent = text; if (primary) el.className = 'primary'; el.addEventListener('click', fn); return el; }
function settingsOf(p) { return p?.settings || p || {}; }
function render() {
  $('products').replaceChildren();
  for (const p of snapshot.projects || []) {
    const el = button(p.name, () => { selected = p.id; localStorage.setItem('foundry-product', selected); creating = false; notice(''); render(); });
    el.classList.toggle('selected', p.id === selected && !creating); $('products').append(el);
  }
  const p = project(), active = p && !creating;
  $('welcome').hidden = !!active; $('project').hidden = !active;
  $('heading').textContent = active ? p.name : 'What do you want to build?'; $('current-name').textContent = active ? p.name : 'Start here';
  const account = snapshot.account || {};
  $('connection-label').textContent = account.sharing ? 'Using ChatGPT plan' : 'Codex login available separately';
  $('account-status').textContent = account.connected ? `${account.email || account.account?.email || 'ChatGPT connected'}${account.sharing ? ' · plan usage enabled' : ' · plan usage not granted'}` : (snapshot.jobs?.['sign-in']?.status === 'running' ? 'Finish sign-in in your browser…' : 'Not connected to Foundry');
  $('sign-in').textContent = account.connected ? 'Reconnect ChatGPT' : 'Continue with ChatGPT'; $('sign-out').hidden = !account.connected;
  if (snapshot.jobs?.['sign-in']?.status === 'failed') $('account-status').textContent = snapshot.jobs['sign-in'].error;
  if (!active) return;
  const stage = stages.includes(p.stage) ? p.stage : stages[p.stage_index || 0];
  const status = p.status || 'ready'; const finished = stage === 'release' && status === 'completed' && (p.artifacts || []).some(a => a.stage === 'release'); const running = snapshot.jobs?.[p.id]?.status === 'running' || status === 'running';
  $('idea-summary').textContent = p.idea;
  $('stages').replaceChildren(...stages.map((name, index) => { const el = document.createElement('li'); el.textContent = `${index + 1}. ${cap(name)}`; el.className = name === stage ? 'current' : (index < stages.indexOf(stage) ? 'done' : ''); if (name === stage) el.setAttribute('aria-current', 'step'); return el; }));
  $('stage-caption').textContent = `${cap(stage)} stage`; $('stage-title').textContent = descriptions[stage][0]; $('stage-description').textContent = descriptions[stage][1]; $('status').textContent = status === 'completed' && !finished ? 'Ready' : cap(status);
  $('actions').replaceChildren();
  if (running) { $('actions').append(button('Stop this stage', () => perform(() => api('cancel', { id: p.id })))); }
  else if (status === 'awaiting_approval') { $('actions').append(button('Approve and continue', () => perform(async () => { await api('approve', { id: p.id }); await api('run', { id: p.id }); notice('Approved. The next stage is running.'); }), true)); }
  else if (!finished && !['release_ready', 'ready_to_release'].includes(status)) { $('actions').append(button(['failed', 'interrupted'].includes(status) ? 'Retry this stage' : 'Continue with ' + cap(stage), () => perform(async () => { await api('run', { id: p.id }); notice('The stage is running. You can return to this product later.'); }), true)); }
  $('owner-guidance').textContent = status === 'awaiting_approval' ? 'Open the work below. Approving records your decision and allows the next stage to begin.' : running ? 'Foundry is working in this product’s folder. Stop the stage if you need to change direction.' : finished || ['release_ready', 'ready_to_release'].includes(status) ? 'The local build is ready for your review. The release handoff explains what needs to happen before deployment.' : 'Continue when you are ready. Each stage keeps its outputs and execution history with the product.';
  const job = snapshot.jobs?.[p.id];
  $('progress').textContent = (['failed','interrupted'].includes(status) ? p.history?.at(-1)?.note : '') || p.error || (job?.status === 'failed' ? job.error : '') || (running ? 'Working locally. Execution receipts are saved with the product.' : '');
  $('outputs').replaceChildren();
  let outputs = p.artifacts || [];
  if (!Array.isArray(outputs)) outputs = Object.entries(outputs).map(([stage, path]) => ({ stage, path }));
  for (const item of outputs) {
    const path = typeof item === 'string' ? item : item.path;
    if (!path) continue;
    const row = document.createElement('div'); row.className = 'output-row';
    const label = document.createElement('div'); label.textContent = cap(item.stage || path.split('/').pop().replace(/\.md$/, ''));
    const small = document.createElement('small'); small.textContent = path; label.append(small);
    row.append(label, button('Open', () => perform(async () => { const result = await api('artifact?id=' + encodeURIComponent(p.id) + '&path=' + encodeURIComponent(path)); $('artifact-title').textContent = cap(item.stage || 'Product document'); $('artifact-content').textContent = result.content; $('artifact').showModal(); })));
    $('outputs').append(row);
  }
  if (!outputs.length) { const el = document.createElement('p'); el.className = 'output-empty'; el.textContent = 'Completed stage documents will appear here.'; $('outputs').append(el); }
}
async function refresh() { snapshot = await api('snapshot'); render(); }
async function openSettings() {
  const p = project(), settings = settingsOf(p);
  $('project-settings').hidden = !p || creating;
  $('adapter').replaceChildren();
  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : Object.values(snapshot.providers || {});
  for (const adapter of providers) { const name = typeof adapter === 'string' ? adapter : adapter.name; const option = document.createElement('option'); option.value = name; option.textContent = name === 'codex' ? 'Codex — existing login' : name === 'chatgpt' ? 'ChatGPT plan — Foundry sign-in' : name; $('adapter').append(option); }
  if (settings.adapter && ![...$('adapter').options].some(o => o.value === settings.adapter)) { const option = document.createElement('option'); option.value = settings.adapter; option.textContent = settings.adapter + ' — product runtime'; $('adapter').append(option); }
  $('adapter').value = settings.adapter || 'codex'; $('model').value = settings.model || ''; $('reasoning').value = settings.reasoning || '';
  $('roles').replaceChildren();
  for (const role of snapshot.roles || []) {
    const name = typeof role === 'string' ? role : role.name; const row = document.createElement('div'); row.className = 'role-row';
    const label = document.createElement('label'); label.textContent = cap(name.replace(/^foundry[-_]/, '')); label.htmlFor = 'role-' + name;
    const input = document.createElement('input'); input.id = label.htmlFor; input.dataset.role = name; input.placeholder = 'Inherit model'; input.setAttribute('list', 'models'); input.value = settings.role_settings?.[name]?.model || '';
    const effort = document.createElement('select'); effort.dataset.roleReasoning = name; effort.setAttribute('aria-label', cap(name) + ' reasoning');
    for (const value of ['', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']) { const option = document.createElement('option'); option.value = value; option.textContent = value || 'Inherit reasoning'; effort.append(option); }
    effort.value = settings.role_settings?.[name]?.reasoning || '';
    row.append(label, input, effort); $('roles').append(row);
  }
  $('settings').showModal();
  if (snapshot.account?.sharing) {
    try { const models = await api('models', {}); $('models').replaceChildren(...models.map(m => { const el = document.createElement('option'); el.value = m.slug || m.id; el.label = m.display_name || m.name || el.value; return el; })); } catch (err) { notice(err.message, true); }
  }
}
$('create-form').addEventListener('submit', event => { event.preventDefault(); perform(async () => { const p = await api('create', { name: $('name').value, idea: $('idea').value }); selected = p.id; localStorage.setItem('foundry-product', selected); creating = false; $('create-form').reset(); notice('Workspace created. Continue with research when you are ready.'); }); });
$('settings-form').addEventListener('submit', event => { event.preventDefault(); const p = project(); if (!p) return; perform(async () => { const roles = {}; document.querySelectorAll('[data-role]').forEach(el => { const name = el.dataset.role; const effort = document.querySelector('[data-role-reasoning="' + name + '"]'); if (el.value || effort.value || settingsOf(p).role_settings?.[name]) roles[name] = { model: el.value || null, reasoning: effort.value || null }; }); await api('configure', { id: p.id, adapter: $('adapter').value, model: $('model').value || null, reasoning: $('reasoning').value || null, roles }); $('settings').close(); notice('Runtime and specialist preferences saved.'); }); });
$('new-product').addEventListener('click', () => { creating = true; notice(''); render(); $('name').focus(); });
$('account-button').addEventListener('click', openSettings); $('settings-button').addEventListener('click', openSettings);
$('close-settings').addEventListener('click', () => $('settings').close()); $('close-artifact').addEventListener('click', () => $('artifact').close());
$('sign-in').addEventListener('click', () => perform(() => api('sign-in', {}))); $('sign-out').addEventListener('click', () => perform(() => api('sign-out', {})));
refresh().catch(error => notice(error.message, true));
setInterval(() => { if (!busy && !document.hidden) refresh().catch(error => notice(error.message, true)); }, 2000);

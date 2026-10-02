'use strict';

const token = document.querySelector('meta[name="foundry-token"]')?.content || '';
const $ = id => document.getElementById(id);
const stages = ['research', 'scope', 'design', 'build', 'verify', 'release'];
const descriptions = {
  research: ['Find the useful opportunity', 'Research the problem, current alternatives, and the assumptions that would change what you build.'],
  scope: ['Choose the first useful version', 'Review the intended user, boundaries, and acceptance criteria before implementation.'],
  design: ['Review the product experience', 'Check the proposed journeys and design decisions before the build starts.'],
  build: ['Build the agreed product', 'The coordinator uses your product’s specialist instructions and selected runtime to implement the approved scope.'],
  verify: ['Exercise the product', 'Run the configured product checks and save evidence. A model’s completion message cannot pass this stage.'],
  release: ['Prepare for a real release', 'Review the build record and release handoff before deciding how to publish it.']
};
let snapshot = {}, snapshotJSON = '';
let selected = localStorage.getItem('foundry-product');
let creating = !selected, busyAction = '', navSignature = '', settingsLoadedFor = null, pendingReview = null, mobileReturnFocus = null;

const cap = text => String(text || '').replace(/(^|[_-])(\w)/g, (_, sep, letter) => (sep ? ' ' : '') + letter.toUpperCase());
const stageOf = p => stages.includes(p?.stage) ? p.stage : stages[p?.stage_index || 0];
const settingsOf = p => p?.settings || p || {};
const project = () => (snapshot.projects || []).find(p => p.id === selected);
const artifactsOf = p => {
  const values = p?.artifacts || [];
  return Array.isArray(values) ? values : Object.entries(values).map(([stage, path]) => ({stage, path}));
};
function icon(name) { const el = document.createElement('i'); el.dataset.lucide = name; el.setAttribute('aria-hidden', 'true'); return el; }
function refreshIcons() { window.foundryUI?.icons?.(); }
function notice(text, error = false) { const el = $('notice'); if (!el) return; el.textContent = text || ''; el.classList.toggle('error', error); el.hidden = !text; }
function dialogNotice(text, error = false) {
  const el = $('artifact')?.open ? $('artifact-notice') : $('settings')?.open ? $('settings-notice') : null;
  if (!el) { notice(text, error); return; }
  el.textContent = text || ''; el.classList.toggle('error', error); el.hidden = !text;
}

async function api(action, data) {
  if (window.foundryBridgePromise) {
    const bridge = await window.foundryBridgePromise;
    const [name, query] = action.split('?');
    const names = {snapshot:'foundry_snapshot', create:'foundry_create', configure:'foundry_configure', run:'foundry_run', approve:'foundry_approve', cancel:'foundry_cancel', 'sign-in':'foundry_sign_in', 'sign-out':'foundry_sign_out', models:'foundry_models', artifact:'foundry_artifact'};
    const args = data || Object.fromEntries(new URLSearchParams(query || ''));
    const result = await bridge.callServerTool({name:names[name], arguments:args});
    if (result.isError) throw Error(result.content?.find(item => item.type === 'text')?.text || 'Foundry action failed');
    const text = result.content?.find(item => item.type === 'text')?.text;
    const value = result.structuredContent || (text ? JSON.parse(text) : {});
    return name === 'models' ? value.models : value;
  }
  const response = await fetch('/api/' + action, {method:data === undefined ? 'GET' : 'POST', headers:{'X-Foundry-Token':token, 'Content-Type':'application/json'}, ...(data === undefined ? {} : {body:JSON.stringify(data)})});
  const value = await response.json();
  if (!response.ok) throw Error(value.error || 'The action could not finish');
  return value;
}

function syncBusy() {
  if ($('main')) $('main').setAttribute('aria-busy', String(!!busyAction));
  document.querySelectorAll('button[data-action]').forEach(button => { button.disabled = !!busyAction; });
}
async function perform(action, fn) {
  if (busyAction) return;
  for (const id of ['settings-notice', 'artifact-notice']) if ($(id)) $(id).hidden = true;
  busyAction = action; syncBusy();
  try { await fn(); await refresh(); if (action === 'approve') $('stage-title')?.focus(); }
  catch (error) { dialogNotice(error?.message || 'The action could not finish', true); }
  finally { busyAction = ''; syncBusy(); }
}
function actionButton(text, action, handler, {primary = false, iconName = ''} = {}) {
  const el = document.createElement('button'); el.type = 'button'; el.dataset.action = action;
  if (primary) el.classList.add('primary');
  if (iconName) el.append(icon(iconName));
  el.append(document.createTextNode(text)); el.disabled = !!busyAction; el.addEventListener('click', handler); return el;
}

function chooseProduct(id) {
  selected = id; creating = false; localStorage.setItem('foundry-product', id); notice(''); render();
  if ($('mobile-nav')?.open) $('mobile-nav').close();
  $('heading')?.focus();
}
function productButton(p, mobile = false) {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'product-link';
  el.classList.toggle('selected', p.id === selected && !creating); el.setAttribute('aria-current', p.id === selected && !creating ? 'page' : 'false');
  el.append(icon('folder'), document.createTextNode(p.name)); el.addEventListener('click', () => chooseProduct(p.id));
  if (mobile) el.dataset.mobileProduct = p.id; return el;
}
function renderProductNav() {
  const signature = JSON.stringify({selected, creating, products:(snapshot.projects || []).map(p => [p.id, p.name])});
  if (signature === navSignature) return;
  navSignature = signature;
  $('products')?.replaceChildren(...(snapshot.projects || []).map(p => productButton(p)));
  $('mobile-products')?.replaceChildren(...(snapshot.projects || []).map(p => productButton(p, true)));
}
function renderAccount() {
  const account = snapshot.account || {};
  if ($('connection-label')) $('connection-label').textContent = account.sharing ? 'Using ChatGPT plan' : 'Codex runtime';
  let status = account.connected ? `${account.email || account.account?.email || 'ChatGPT connected'}${account.sharing ? ' · plan usage enabled' : ' · plan usage not granted'}` : (snapshot.jobs?.['sign-in']?.status === 'running' ? 'Finish sign-in in your browser…' : 'Not connected to Foundry');
  if (snapshot.jobs?.['sign-in']?.status === 'failed') status = snapshot.jobs['sign-in'].error;
  if ($('account-status')) $('account-status').textContent = status;
  if ($('sign-in')) $('sign-in').textContent = account.connected ? 'Reconnect ChatGPT' : 'Continue with ChatGPT';
  if ($('sign-out')) $('sign-out').hidden = !account.connected;
}
function startCreate() { creating = true; notice(''); render(); if ($('mobile-nav')?.open) $('mobile-nav').close(); $('name')?.focus(); }
function renderHome() {
  const products = snapshot.projects || [];
  if ($('workspace-count')) $('workspace-count').textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;
  if ($('home-counter')) $('home-counter').textContent = products.length ? `${products.length} in your workspace` : 'Your first product starts here';
  if ($('recent-section')) $('recent-section').hidden = !products.length;
  const recentProducts = [...products].sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || ''))).slice(0, 4);
  $('recent-products')?.replaceChildren(...recentProducts.map(p => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'recent-product';
    const copy = document.createElement('span'), title = document.createElement('strong'), meta = document.createElement('small');
    title.textContent = p.name; meta.textContent = `${cap(stageOf(p))} · ${cap(p.status || 'ready')}`; copy.append(title, meta);
    card.append(copy, icon('arrow-up-right')); card.addEventListener('click', () => chooseProduct(p.id)); return card;
  }));
}

function renderStages(p, stage) {
  const current = stages.indexOf(stage);
  $('stages')?.replaceChildren(...stages.map((name, index) => {
    const el = document.createElement('li'), marker = document.createElement('span'), label = document.createElement('span');
    marker.className = 'stage-marker'; marker.append(index < current ? icon('check') : document.createTextNode(String(index + 1))); label.textContent = cap(name);
    el.append(marker, label); el.className = name === stage ? 'current' : (index < current ? 'done' : 'upcoming'); if (name === stage) el.setAttribute('aria-current', 'step'); return el;
  }));
  if ($('stage-number')) $('stage-number').textContent = `Stage ${current + 1} of ${stages.length}`;
  const complete = stage === 'release' && p.status === 'completed' && artifactsOf(p).some(item => typeof item === 'object' && item.stage === 'release') ? stages.length : Math.max(0, current);
  if ($('completed-count')) $('completed-count').textContent = `${complete} complete`;
}
function latestArtifact(p, wantedStage) { return [...artifactsOf(p)].reverse().find(item => typeof item === 'object' && item.stage === wantedStage); }
function renderActions(p, stage, status, running, finished) {
  const actions = $('actions'); if (!actions) return; actions.replaceChildren();
  if (running) {
    actions.append(actionButton('Stop this stage', 'cancel', () => perform('cancel', async () => { await api('cancel', {id:p.id}); notice('The stage was stopped. You can resume when you are ready.'); }), {iconName:'square'})); return;
  }
  if (status === 'awaiting_approval') {
    const item = latestArtifact(p, stage); if (item) actions.append(actionButton(`Review ${cap(stage)}`, 'review', () => openArtifact(p, item, true), {primary:true, iconName:'file-text'})); return;
  }
  if (finished || ['release_ready', 'ready_to_release'].includes(status)) {
    const item = latestArtifact(p, 'release'); if (item) actions.append(actionButton('View release handoff', 'handoff', () => openArtifact(p, item), {primary:true, iconName:'arrow-up-right'})); return;
  }
  const retry = ['failed', 'interrupted'].includes(status);
  actions.append(actionButton(retry ? 'Retry this stage' : `Continue with ${cap(stage)}`, 'run', () => perform('run', async () => { await api('run', {id:p.id}); notice(retry ? 'The stage is running again.' : 'The stage is running. You can return to this product later.'); }), {primary:true, iconName:retry ? 'play' : 'arrow-right'}));
}
function artifactTitle(item, path) { return cap((typeof item === 'object' && item.stage) || path.split('/').pop().replace(/\.md$/, '') || 'Product document'); }
function renderOutputs(p) {
  const outputs = $('outputs'); if (!outputs) return;
  const artifacts = artifactsOf(p).filter(item => typeof item === 'string' || item?.path);
  outputs.replaceChildren(...artifacts.map(item => {
    const path = typeof item === 'string' ? item : item.path, title = artifactTitle(item, path);
    const row = document.createElement('article'), docIcon = document.createElement('span'), label = document.createElement('div'), heading = document.createElement('strong'), small = document.createElement('small');
    row.className = 'output-row'; docIcon.className = 'document-icon'; docIcon.append(icon('file-text')); heading.textContent = title; small.textContent = path; label.append(heading, small);
    row.append(docIcon, label, actionButton(`Open ${title}`, `open-${path}`, () => openArtifact(p, item), {iconName:'arrow-up-right'})); return row;
  }));
  if ($('empty-outputs')) $('empty-outputs').hidden = artifacts.length > 0;
  if (!artifacts.length && !$('empty-outputs')) { const empty = document.createElement('p'); empty.className = 'output-empty'; empty.textContent = 'Stage documents will appear here as work completes.'; outputs.append(empty); }
}
function renderActivity(p) {
  const history = Array.isArray(p.history) ? p.history : [];
  if ($('activity-count')) $('activity-count').textContent = String(history.length);
  $('activity')?.replaceChildren(...[...history].reverse().slice(0, 8).map(entry => {
    const li = document.createElement('li'), marker = document.createElement('span'), copy = document.createElement('div'), title = document.createElement('strong'), note = document.createElement('p'), time = document.createElement('time');
    marker.className = 'activity-marker'; marker.append(icon(entry.status === 'failed' ? 'circle-alert' : entry.status === 'completed' ? 'circle-check' : 'clock'));
    title.textContent = `${cap(entry.stage || 'Product')} · ${cap(entry.status || 'updated')}`; note.textContent = entry.note || 'Product record updated.';
    if (entry.at) { time.dateTime = entry.at; const date = new Date(entry.at); time.textContent = Number.isNaN(date.valueOf()) ? entry.at : date.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); }
    copy.append(title, note, time); li.append(marker, copy); return li;
  }));
}
function renderProject(p) {
  const stage = stageOf(p), status = p.status || 'ready';
  const finished = stage === 'release' && status === 'completed' && artifactsOf(p).some(item => typeof item === 'object' && item.stage === 'release');
  const running = snapshot.jobs?.[p.id]?.status === 'running' || status === 'running';
  if ($('idea-summary')) $('idea-summary').textContent = p.idea || '';
  if ($('project-runtime')) $('project-runtime').textContent = cap(settingsOf(p).adapter || 'codex');
  if ($('product-path')) $('product-path').textContent = p.path || '';
  renderStages(p, stage);
  if ($('stage-caption')) $('stage-caption').textContent = `${cap(stage)} stage`;
  if ($('stage-title')) $('stage-title').textContent = descriptions[stage][0];
  if ($('stage-description')) $('stage-description').textContent = descriptions[stage][1];
  if ($('status')) $('status').textContent = status === 'completed' && !finished ? 'Ready' : cap(status);
  renderActions(p, stage, status, running, finished);
  const job = snapshot.jobs?.[p.id];
  const progress = (['failed', 'interrupted'].includes(status) ? p.history?.at(-1)?.note : '') || p.error || (job?.status === 'failed' ? job.error : '') || (running ? 'Working locally. Execution receipts are saved with the product.' : '');
  if ($('progress')) $('progress').textContent = progress;
  if ($('owner-guidance')) $('owner-guidance').textContent = status === 'awaiting_approval' ? `Review the ${stage} document before Foundry continues.` : running ? 'Foundry is working in this product’s folder.' : finished ? 'The local build and its release handoff are ready for review.' : 'Continue when you are ready. Foundry keeps every stage with the product.';
  renderOutputs(p); renderActivity(p);
}
function render() {
  renderProductNav(); renderAccount();
  let p = project();
  if (!p && selected) { selected = null; creating = true; localStorage.removeItem('foundry-product'); navSignature = ''; renderProductNav(); p = null; }
  const active = !!p && !creating;
  if ($('welcome')) $('welcome').hidden = active;
  if ($('project')) $('project').hidden = !active;
  if ($('heading')) $('heading').textContent = active ? p.name : 'Build something worth shipping';
  if ($('current-name')) $('current-name').textContent = active ? p.name : 'Home';
  $('home-button')?.classList.toggle('selected', !active);
  renderHome(); if (active) renderProject(p); syncBusy(); refreshIcons();
}
async function refresh(force = false) {
  const next = await api('snapshot'), json = JSON.stringify(next);
  if (!force && json === snapshotJSON) return;
  snapshot = next; snapshotJSON = json; render();
}

function setArtifactContent(content) {
  const container = $('artifact-content'); if (!container) return;
  const renderMarkdown = window.foundryUI?.renderMarkdown;
  if (!renderMarkdown) { container.textContent = content; return; }
  const rendered = renderMarkdown(String(content || ''));
  if (rendered instanceof Node) container.replaceChildren(rendered); else container.innerHTML = String(rendered || '');
}
async function openArtifact(p, item, review = false) {
  const path = typeof item === 'string' ? item : item.path;
  const itemStage = (typeof item === 'object' && item.stage) || stageOf(p);
  await perform(`open-${path}`, async () => {
    const result = await api('artifact?id=' + encodeURIComponent(p.id) + '&path=' + encodeURIComponent(path));
    const current = project();
    const canApprove = review && current?.id === p.id && selected === p.id && stageOf(current) === itemStage && current.status === 'awaiting_approval';
    pendingReview = canApprove ? {projectId:p.id, stage:itemStage, path} : null;
    if ($('artifact-title')) $('artifact-title').textContent = artifactTitle(item, path);
    if ($('artifact-path')) $('artifact-path').textContent = path;
    if ($('artifact-stage')) $('artifact-stage').textContent = cap(itemStage);
    if ($('artifact-guidance')) $('artifact-guidance').textContent = canApprove ? `Approve this ${itemStage} to begin the next stage.` : 'This document is saved with the product.';
    if ($('artifact-approve')) { $('artifact-approve').hidden = !canApprove; $('artifact-approve').textContent = 'Approve and continue'; }
    setArtifactContent(result.content); $('artifact')?.showModal();
  });
}

function showSettingsPanel(name) {
  document.querySelectorAll('[data-settings-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.settingsTab === name)));
  for (const panel of ['account', 'runtime', 'specialists']) if ($(`settings-panel-${panel}`)) $(`settings-panel-${panel}`).hidden = panel !== name;
}
function loadSettings(p) {
  const settings = settingsOf(p);
  if ($('project-settings')) $('project-settings').hidden = !p || creating;
  for (const name of ['runtime', 'specialists']) {
    const tab = $(`settings-tab-${name}`);
    if (tab) { tab.hidden = !p || creating; tab.disabled = !p || creating; }
  }
  const adapter = $('adapter');
  if (adapter) {
    adapter.replaceChildren();
    const providers = Array.isArray(snapshot.providers) ? snapshot.providers : Object.values(snapshot.providers || {});
    for (const value of providers) { const name = typeof value === 'string' ? value : value.name; const option = document.createElement('option'); option.value = name; option.textContent = name === 'codex' ? 'Codex — existing login' : name === 'chatgpt' ? 'ChatGPT plan — Foundry sign-in' : name; adapter.append(option); }
    if (settings.adapter && ![...adapter.options].some(option => option.value === settings.adapter)) { const option = document.createElement('option'); option.value = settings.adapter; option.textContent = `${settings.adapter} — product runtime`; adapter.append(option); }
    adapter.value = settings.adapter || 'codex';
  }
  if ($('model')) $('model').value = settings.model || '';
  if ($('reasoning')) $('reasoning').value = settings.reasoning || '';
  $('roles')?.replaceChildren(...(snapshot.roles || []).map(value => {
    const name = typeof value === 'string' ? value : value.name;
    const row = document.createElement('div'), label = document.createElement('label'), input = document.createElement('input'), effort = document.createElement('select');
    row.className = 'role-row'; row.dataset.roleName = cap(name.replace(/^foundry[-_]/, '')).toLowerCase(); label.textContent = cap(name.replace(/^foundry[-_]/, '')); label.htmlFor = 'role-' + name;
    input.id = label.htmlFor; input.dataset.role = name; input.placeholder = 'Inherit model'; input.setAttribute('list', 'models'); input.value = settings.role_settings?.[name]?.model || '';
    effort.dataset.roleReasoning = name; effort.setAttribute('aria-label', `${cap(name)} reasoning`);
    for (const value of ['', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra']) { const option = document.createElement('option'); option.value = value; option.textContent = value || 'Inherit reasoning'; effort.append(option); }
    effort.value = settings.role_settings?.[name]?.reasoning || ''; row.append(label, input, effort); return row;
  }));
}
async function openSettings() {
  const p = project(), loadKey = `${p?.id || 'account'}:${p?.updated_at || ''}`;
  if (settingsLoadedFor !== loadKey || !$('settings')?.open) { loadSettings(p); settingsLoadedFor = loadKey; }
  showSettingsPanel('account'); $('settings')?.showModal(); refreshIcons();
  if (snapshot.account?.sharing) {
    try { const models = await api('models', {}); $('models')?.replaceChildren(...models.map(model => { const option = document.createElement('option'); option.value = model.slug || model.id; option.label = model.display_name || model.name || option.value; return option; })); }
    catch (error) { notice(error.message, true); }
  }
}

function bind() {
  $('create-form')?.addEventListener('submit', event => {
    event.preventDefault(); perform('create', async () => { const p = await api('create', {name:$('name').value, idea:$('idea').value}); selected = p.id; creating = false; localStorage.setItem('foundry-product', selected); $('create-form').reset(); navSignature = ''; notice('Workspace created. Continue with research when you are ready.'); });
  });
  $('settings-form')?.addEventListener('submit', event => {
    event.preventDefault(); const p = project(); if (!p) return;
    perform('save-settings', async () => {
      const roles = {};
      document.querySelectorAll('[data-role]').forEach(input => { const name = input.dataset.role, effort = document.querySelector(`[data-role-reasoning="${CSS.escape(name)}"]`); if (input.value || effort?.value || settingsOf(p).role_settings?.[name]) roles[name] = {model:input.value || null, reasoning:effort?.value || null}; });
      await api('configure', {id:p.id, adapter:$('adapter').value, model:$('model').value || null, reasoning:$('reasoning').value || null, roles}); settingsLoadedFor = null; $('settings').close(); notice('Runtime and specialist preferences saved.');
    });
  });
  for (const id of ['new-product', 'new-product-shortcut']) $(id)?.addEventListener('click', startCreate);
  $('home-button')?.addEventListener('click', () => { creating = true; notice(''); render(); });
  $('account-button')?.addEventListener('click', openSettings); $('settings-button')?.addEventListener('click', openSettings);
  $('close-settings')?.addEventListener('click', () => $('settings').close());
  $('close-artifact')?.addEventListener('click', () => { pendingReview = null; $('artifact').close(); });
  $('artifact')?.addEventListener('close', () => { pendingReview = null; });
  $('artifact-approve')?.addEventListener('click', () => {
    const review = pendingReview, p = project();
    if (!review || !p || p.id !== review.projectId || selected !== review.projectId || stageOf(p) !== review.stage || p.status !== 'awaiting_approval') { notice('This review is no longer current. Open the latest stage document.', true); pendingReview = null; $('artifact').close(); return; }
    perform('approve', async () => { await api('approve', {id:p.id}); await api('run', {id:p.id}); pendingReview = null; $('artifact').close(); notice('Approved. The next stage is running.'); });
  });
  $('sign-in')?.addEventListener('click', () => perform('sign-in', () => api('sign-in', {}))); $('sign-out')?.addEventListener('click', () => perform('sign-out', () => api('sign-out', {})));
  document.querySelectorAll('[data-settings-tab]').forEach(button => button.addEventListener('click', () => showSettingsPanel(button.dataset.settingsTab)));
  $('role-search')?.addEventListener('input', event => { const query = event.target.value.trim().toLowerCase(); document.querySelectorAll('.role-row').forEach(row => { row.hidden = !!query && !row.dataset.roleName.includes(query); }); });
  document.querySelectorAll('[data-idea]').forEach(button => button.addEventListener('click', () => { startCreate(); $('name').value = button.dataset.name || ''; $('idea').value = button.dataset.description || button.dataset.idea || ''; $('idea').focus(); }));
  $('mobile-menu')?.addEventListener('click', event => { mobileReturnFocus = event.currentTarget; $('mobile-nav')?.showModal(); refreshIcons(); });
  $('mobile-home')?.addEventListener('click', () => { creating = true; notice(''); render(); $('mobile-nav').close(); $('heading')?.focus(); });
  $('mobile-account')?.addEventListener('click', () => { $('mobile-nav').close(); openSettings(); });
  $('close-nav')?.addEventListener('click', () => { $('mobile-nav')?.close(); mobileReturnFocus?.focus(); });
}

bind();
refresh().catch(error => notice(error.message, true));
setInterval(() => { if (!busyAction && !document.hidden) refresh().catch(error => notice(error.message, true)); }, 2000);

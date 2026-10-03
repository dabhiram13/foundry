import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from '@/components/landing';
import { RoleAvatar, roleCatalog } from '@/components/specialists';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { setNonce } from 'get-nonce';
import { ArrowRight, ArrowUpRight, CaretRight as ChevronRight, Check, Circle, WarningCircle as CircleAlert, CheckCircle as CircleCheck, Clock as Clock3, Cpu, FileText, Folder, CircleNotch as Loader2, Plus, MagnifyingGlass as Search, SlidersHorizontal as Settings2, ShieldCheck, Square, NotePencil as SquarePen, UserCircle as UserRound, Users, FlowArrow as Workflow, X, SquaresFour, IconContext } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Checkbox, ChoiceGroup, CopyButton, Disclosure, Progress, SplitText } from '@/components/ui/animate-ui';
import { StudioMotion, MotionToggle } from '@/components/studio-motion';
import { SpecialistIntro } from '@/components/specialist-intro';
import { SkyBackground } from '@/components/sky-background';

type RoleSettings = {model?: string | null; reasoning?: string | null};
type Artifact = {path: string; stage: string};
type BuildTask = {title: string; status: string; fix_attempts?: number; checks?: string; commit?: string | null};
type History = {at?: string; stage?: string; status?: string; note?: string};
type Product = {id: string; name: string; idea: string; path: string; stage: string; status: string; adapter?: string; model?: string | null; reasoning?: string | null; subscription_confirmed?: boolean; roles?: string[]; role_settings?: Record<string, RoleSettings>; stage_verification?: {build?: {status?: string; tasks?: BuildTask[]}}; artifacts: Artifact[]; history: History[]; created_at?: string; updated_at?: string; error?: string};
type Snapshot = {projects?: Product[]; roles?: (string | {name: string})[]; project_roles?: Record<string, (string | {name: string})[]>; providers?: (string | {name: string})[]; project_providers?: Record<string, (string | {name: string})[]>; provider_errors?: Record<string, string>; account?: {connected?: boolean; sharing?: boolean; email?: string}; jobs?: Record<string, {status?: string; error?: string}>};
type Message = {text: string; error?: boolean} | null;
type Review = {productId: string; stage: string; path: string; revision: string; content: string; canApprove: boolean};
type Draft = {adapter: string; model: string; reasoning: string; subscription_confirmed: boolean; roles: Record<string, RoleSettings>};
declare global { interface Window { foundryBridgePromise?: Promise<{callServerTool: (request: {name: string; arguments: unknown}) => Promise<{isError?: boolean; structuredContent?: any; content?: {type: string; text?: string}[]}>}> } }
const stages = ['research', 'scope', 'design', 'build', 'verify', 'release'];
const reasoning = ['', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const stageNames: Record<string, string> = {intake:'Idea', research:'Research', scope:'Plan', design:'Design', build:'Build', verify:'Test', release:'Ship'};
const stageCopy: Record<string, [string, string]> = {
  research: ['Understand the problem', 'Foundry looks at who has this problem, what they use today, and what is still unknown.'],
  scope: ['Pick the first version', 'Foundry writes a short plan: who it is for, what is in and out, and how you will know it works. You approve it before anything is built.'],
  design: ['Shape how it works', 'Foundry sketches the screens, steps, and edge cases. You approve the design before the build starts.'],
  build: ['Build it', 'Foundry splits the plan into small tasks and builds them one at a time. After each task it runs the tests, fixes failures (up to 3 tries), and saves a Git checkpoint.'],
  verify: ['Make sure it works', 'Foundry runs the product’s tests. It only moves on when they pass.'],
  release: ['Ready to ship', 'Read the summary of what was built and tested. You decide when and where to publish.']
};
const documentNames: Record<string, string> = {'docs/product/idea.md':'Your idea', 'docs/product/research.md':'Research notes', 'docs/specs/product.md':'Plan', 'docs/product/design.md':'Design', 'docs/product/tasks.md':'Build tasks', 'docs/product/release.md':'Ship summary'};
const stageRoles: Record<string, string[]> = {
  research: ['market-researcher','trend-validator'],
  scope: ['planner','spec-critic'],
  design: ['designer','design-evaluator'],
  build: ['planner','backend','connector'],
  verify: ['quality-gate','api-tester','flow-tester'],
  release: ['complete']
};
const examples: [string, string][] = [
  ['Client portal', 'A simple portal where clients can review project updates, approve deliverables, and find shared files.'],
  ['Research brief', 'A research workspace that tracks sources, findings, decisions, and the evidence behind each recommendation.'],
  ['Booking page', 'A booking page for a solo coach: clients pick a time, pay a deposit, and get a reminder the day before.']
];
const cap = (value: string = '') => value.replace(/(^|[_-])(\w)/g, (_, sep, letter) => (sep ? ' ' : '') + letter.toUpperCase());
const label = (stage: string = '') => stageNames[stage] || cap(stage);
const statusLabel = (status: string = '') => ({awaiting_approval:'Needs your review', running:'Working', interrupted:'Stopped'} as Record<string,string>)[status] || cap(status);
const roleName = (value: string | {name: string}) => typeof value === 'string' ? value : value.name;
const roleLabel = (name: string) => cap(name.replace(/^foundry[-_]/, ''));
const stamp = (value?: string) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.valueOf()) ? value : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };
const emptyDraft: Draft = {adapter:'codex', model:'', reasoning:'', subscription_confirmed:false, roles:{}};
function remembered() { try { return localStorage.getItem('foundry-product'); } catch { return null; } }
function remember(id: string) { try { localStorage.setItem('foundry-product', id); } catch { /* The panel still works when host storage is unavailable. */ } }
async function api(action: string, data?: Record<string, unknown>): Promise<any> {
  if (window.foundryBridgePromise) {
    const bridge = await window.foundryBridgePromise;
    const [name, query] = action.split('?');
    const names: Record<string,string> = {snapshot:'foundry_snapshot', create:'foundry_create', configure:'foundry_configure', run:'foundry_run', approve:'foundry_approve', cancel:'foundry_cancel', 'sign-in':'foundry_sign_in', 'sign-out':'foundry_sign_out', models:'foundry_models', artifact:'foundry_artifact'};
    const result = await bridge.callServerTool({name:names[name], arguments:data || Object.fromEntries(new URLSearchParams(query || ''))});
    const text = result.content?.find(item => item.type === 'text')?.text;
    if (result.isError) throw new Error(text || 'Foundry could not finish this action.');
    const value = result.structuredContent || (text ? JSON.parse(text) : {});
    return name === 'models' ? value.models : value;
  }
  const token = document.querySelector<HTMLMetaElement>('meta[name="foundry-token"]')?.content || '';
  const response = await fetch('/api/' + action, {method:data === undefined ? 'GET' : 'POST', headers:{'X-Foundry-Token':token, 'Content-Type':'application/json'}, ...(data === undefined ? {} : {body:JSON.stringify(data)})});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Foundry could not finish this action.');
  return value;
}
function markdown(content: string) {
  const html = DOMPurify.sanitize(marked.parse(content, {async:false}), {FORBID_TAGS:['style','form','input','button','textarea','select','img','video','audio','iframe','object','embed'], FORBID_ATTR:['style']});
  const template = document.createElement('template'); template.innerHTML = html;
  template.content.querySelectorAll('a').forEach(link => { const href = link.getAttribute('href') || ''; if (!/^(https?:|mailto:)/i.test(href)) link.removeAttribute('href'); else { link.target='_blank'; link.rel='noopener noreferrer'; } });
  return template.innerHTML;
}
function Feedback({message, id}: {message: Message; id: string}) { return message ? <div id={id} className={`feedback ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}>{message.error ? <CircleAlert/> : <CircleCheck/>}<span>{message.text}</span></div> : null; }
function DocumentPreview({productId, artifact, updatedAt}: {productId:string;artifact:Artifact;updatedAt?:string}) {
  const [preview, setPreview] = useState<{content?:string;error?:boolean}>({});
  useEffect(()=>{
    let alive=true; setPreview({});
    api('artifact?id='+encodeURIComponent(productId)+'&path='+encodeURIComponent(artifact.path))
      .then(result=>{if(alive)setPreview({content:markdown(result.content)});})
      .catch(()=>{if(alive)setPreview({error:true});});
    return ()=>{alive=false;};
  },[productId,artifact.path,updatedAt]);
  const loaded=preview.content!==undefined;
  return <section className="paper-preview" aria-label={label(artifact.stage)+' preview'} aria-busy={!loaded&&!preview.error}>
    <div className="section-label"><h3><FileText aria-hidden="true"/>{label(artifact.stage)} preview</h3><span>Read the full document to approve</span></div>
    {preview.error?<p className="empty-copy">The preview could not load. Use Review {label(artifact.stage)} to open the document.</p>:loaded?(preview.content?<article className="document preview-reading" tabIndex={0} aria-label="Document preview, scroll to read" dangerouslySetInnerHTML={{__html:preview.content}}/>:<p className="empty-copy">This document is empty.</p>):<p role="status" className="preview-loading"><Loader2 className="spinner" aria-hidden="true"/>Opening the document…</p>}
  </section>;
}
function EffortOptions() { return <>{reasoning.map(value => <NativeSelectOption key={value} value={value}>{value || 'Use the default'}</NativeSelectOption>)}</>; }

function Act({action, busy, children, onClick, icon=<ArrowRight/>, variant='default'}: {action:string;busy:string;children:React.ReactNode;onClick:()=>void;icon?:React.ReactNode;variant?:'default'|'outline'|'ghost'}) { return <Button type="button" variant={variant} data-action={action} disabled={!!busy} aria-busy={busy===action} onClick={onClick}>{children}<span className="action-indicator" aria-hidden="true">{busy===action ? <Loader2 className="spinner"/> : icon}</span></Button>; }

function StatusBadge({status, ready=false, id}: {status:string;ready?:boolean;id?:string}) {
  const Icon = status==='running'?Loader2:status==='completed'?CircleCheck:status==='awaiting_approval'?Clock3:['failed','interrupted'].includes(status)?CircleAlert:Circle;
  return <Badge id={id} variant="secondary" className="status-badge" data-status={ready?'ready':status}><Icon aria-hidden="true" className={status==='running'?'spinner':''}/>{ready?'Ready':statusLabel(status)}</Badge>;
}
function hashProduct() {
  try { return location.hash.startsWith('#product/') ? decodeURIComponent(location.hash.slice(9)) : null; }
  catch { return null; }
}
function Workspace() {
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [selected, setSelected] = useState<string | null>(()=>hashProduct()||remembered());
  const [landing, setLanding] = useState(!window.foundryBridgePromise && (!location.hash || location.hash==='#welcome'));
  const [inspectedStage, setInspectedStage] = useState<string | null>(null);
  const [creating, setCreating] = useState(location.hash==='#workspace'||(!hashProduct()&&!remembered()));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Message>(null);
  const [name, setName] = useState(''); const [idea, setIdea] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false); const [settingsTab, setSettingsTab] = useState('account');
  const [settingsProduct, setSettingsProduct] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<Message>(null); const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [roleSearch, setRoleSearch] = useState(''); const [models, setModels] = useState<{id?: string; slug?: string; display_name?: string}[]>([]);
  const [review, setReview] = useState<Review | null>(null); const [artifactNotice, setArtifactNotice] = useState<Message>(null);
  const [projectTab, setProjectTab] = useState('overview');
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const busyRef = useRef(''); const signature = useRef('');
  const snapshotRequest = useRef(0); const snapshotApplied = useRef(0); const navigationEpoch = useRef(0);
  const navigationFocus = useRef<string | null>(null);
  const [navigationTarget,setNavigationTarget] = useState<string | null>(null);
  const settingsFocus = useRef<HTMLElement | null>(null); const artifactFocus = useRef<HTMLElement | null>(null);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const drawerDestination = useRef<string | null>(null);
  const [ideaExpanded, setIdeaExpanded] = useState(false);
  const products = snapshot.projects || []; const p = !creating ? products.find(item => item.id === selected) : undefined;
  const job = p ? snapshot.jobs?.[p.id] : undefined;
  const account = snapshot.account || {};
  const refresh = useCallback(async () => {
    const request = ++snapshotRequest.current;
    try {
      const next = await api('snapshot');
      if (request < snapshotApplied.current) return snapshotRef.current;
      snapshotApplied.current=request;
      const json = JSON.stringify(next); snapshotRef.current=next;
      if (json !== signature.current) { signature.current=json; setSnapshot(next); }
      return next as Snapshot;
    } catch (error) {
      if (request < snapshotApplied.current) return snapshotRef.current;
      throw error;
    }
  }, []);
  useEffect(() => {
    let alive=true, pending=false;
    const update=async()=> {
      if (pending || busyRef.current || document.hidden) return;
      pending=true;
      try { await refresh(); } catch (error) { if(alive) setNotice({text:(error as Error).message,error:true}); }
      finally { pending=false; }
    };
    update(); const timer=setInterval(update,2000);
    return ()=> {alive=false;clearInterval(timer);};
  }, [refresh]);
  useEffect(() => { if (!busyRef.current && snapshot.projects && selected && !products.some(item => item.id===selected)) { setSelected(null); setCreating(true); } }, [snapshot.projects,selected,busy]);
  async function perform(action: string, fn: () => Promise<void>, target: 'page' | 'settings' | 'artifact' = 'page') {
    if (busyRef.current) return;
    busyRef.current=action; setBusy(action);
    const report = target==='artifact' ? setArtifactNotice : target==='settings' ? setSettingsNotice : setNotice; report(null);
    let committed=false;
    try { await fn(); committed=true; await refresh(); }
    catch (error) { (committed?setNotice:report)({text:error instanceof Error ? error.message : 'This action could not finish.',error:true}); }
    finally { busyRef.current=''; setBusy(''); }
  }
  function inspectStage(stage:string|null) { navigationEpoch.current++; setInspectedStage(stage); }
  function chooseProjectTab(tab:string) { navigationEpoch.current++; setProjectTab(tab); }
  function leavePage() { navigationEpoch.current++; setReview(null); setSettingsOpen(false); }
  function choose(id: string) { drawerDestination.current=navigationOpen?'heading':null; leavePage(); if(location.hash!=='#product/'+encodeURIComponent(id)) {navigationFocus.current='heading';location.hash='product/'+encodeURIComponent(id);} setLanding(false); setInspectedStage(null); setSelected(id); selectedRef.current=id; setCreating(false); setProjectTab('overview'); remember(id); setNotice(null); setNavigationOpen(false); setNavigationTarget('heading'); }
  function home(focus=false) { drawerDestination.current=navigationOpen?(focus?'name':'heading'):null; leavePage(); if(location.hash!=='#workspace') {navigationFocus.current=focus?'name':'heading';location.hash='workspace';} setLanding(false); setCreating(true); setNotice(null); setNavigationOpen(false); setNavigationTarget(focus ? 'name' : 'heading'); }
  useEffect(()=> {
    const navigate=()=> {
      navigationEpoch.current++; setReview(null); setSettingsOpen(false); setInspectedStage(null); setNotice(null);
      setLanding(!window.foundryBridgePromise && (!location.hash || location.hash==='#welcome'));
      const id=hashProduct();
      if(id) {setSelected(id); selectedRef.current=id; setCreating(false); remember(id);}
      else if(location.hash==='#workspace') setCreating(true);
      setProjectTab('overview'); setNavigationOpen(false);
      // Explicit navigation already focuses after its render. A later hashchange
      // must not steal focus from a field the owner has started editing.
      const focusId=navigationFocus.current?null:(location.hash==='#welcome'||!location.hash ? 'landing-title' : 'heading');
      navigationFocus.current=null;
      if(focusId) setNavigationTarget(focusId);
    };
    window.addEventListener('hashchange', navigate);
    return ()=>window.removeEventListener('hashchange', navigate);
  }, []);
  useLayoutEffect(()=> {
    if(!navigationTarget) return;
    const target=document.getElementById(navigationTarget);
    if(target) {target.focus();setNavigationTarget(null);}
  },[navigationTarget,landing,creating,selected,snapshot.projects]);
  useEffect(()=>setInspectedStage(null),[p?.id,p?.stage]);
  useEffect(()=>setIdeaExpanded(false),[p?.id]);
  useEffect(()=>setNotice(current=>job?.status==='failed'&&job.error?{text:job.error,error:true}:current?.error?current:null),[p?.id,p?.stage,p?.status,job?.status,job?.error]);
  async function openSettings(tab='account') {
    const origin=document.activeElement as HTMLElement;
    settingsFocus.current=origin; setSettingsNotice(p&&snapshot.provider_errors?.[p.id]?{text:snapshot.provider_errors[p.id],error:true}:null); setRoleSearch(''); setSettingsProduct(p?.id || null);
    setDraft(p ? {adapter:p.adapter||'codex', model:p.model||'', reasoning:p.reasoning||'', subscription_confirmed:!!p.subscription_confirmed, roles:structuredClone(p.role_settings||{})} : emptyDraft);
    setSettingsTab(tab); setNavigationOpen(false); setSettingsOpen(true);
    if (account.sharing) { try { setModels(await api('models',{})); } catch(error) {setSettingsNotice({text:(error as Error).message,error:true});} }
  }
  function latest(product: Product, stage: string) { return [...(product.artifacts||[])].reverse().find(item=>item.stage===stage); }
  async function openArtifact(product: Product, item: Artifact, canApprove=false) {
    artifactFocus.current=document.activeElement as HTMLElement;
    const epoch=navigationEpoch.current;
    await perform('open-'+item.path, async()=> {
      const result=await api('artifact?id='+encodeURIComponent(product.id)+'&path='+encodeURIComponent(item.path));
      if (epoch!==navigationEpoch.current || selectedRef.current!==product.id) return;
      const current=snapshotRef.current.projects?.find(value=>value.id===selectedRef.current);
      setArtifactNotice(null);
      setReview({productId:product.id,stage:item.stage,path:item.path,revision:result.revision,content:markdown(result.content),canApprove:canApprove&&current?.id===product.id&&current.stage===item.stage&&current.status==='awaiting_approval'});
    });
  }
  async function approve() {
    const current=snapshotRef.current.projects?.find(item=>item.id===selectedRef.current);
    if (!review || !review.canApprove || current?.id!==review.productId || current.stage!==review.stage || current.status!=='awaiting_approval') {setReview(null);setNotice({text:'This review is no longer current. Open the latest version.',error:true});return;}
    await perform('approve',async()=> {
      await api('approve',{id:review.productId,reviewed_revision:review.revision});
      setReview(null);
      try { await api('run',{id:review.productId}); }
      catch (error) { setNotice({text:'Approved, but the next step could not start: '+(error instanceof Error?error.message:'Please try again.'),error:true}); }
      requestAnimationFrame(()=>document.getElementById('stage-title')?.focus());
    },'artifact');
  }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settingsProduct) return;
    await perform('save-settings',async()=> {await api('configure',{id:settingsProduct,adapter:draft.adapter,model:draft.model||null,reasoning:draft.reasoning||null,subscription_confirmed:draft.subscription_confirmed,roles:Object.fromEntries(Object.entries(draft.roles).map(([key,value])=>[key,{model:value.model||null,reasoning:value.reasoning||null}]))});setSettingsOpen(false);setNotice({text:'Settings saved.'});},'settings');
  }
  function setRole(role: string, field: keyof RoleSettings, value: string) { setDraft(prev=>({...prev,roles:{...prev.roles,[role]:{...prev.roles[role],[field]:value}}})); }

  function stageAction(product: Product) {
    const running=product.status==='running'||snapshot.jobs?.[product.id]?.status==='running';
    const finished=product.stage==='release'&&product.status==='completed'&&latest(product,'release');
    if (running) return <Act busy={busy} action="cancel" variant="outline" icon={<Square/>} onClick={()=>perform('cancel',async()=> {await api('cancel',{id:product.id});setNotice({text:'Stopping. This can take a few seconds.'});})}>Stop</Act>;
    if (product.status==='awaiting_approval') {const doc=latest(product,product.stage);return doc&&<Act busy={busy} action="review" onClick={()=>openArtifact(product,doc,true)}>Review {label(product.stage)}</Act>;}
    if (finished) return <Act busy={busy} action="handoff" icon={<ArrowUpRight/>} onClick={()=>openArtifact(product,finished)}>Read the ship summary</Act>;
    if (product.adapter==='codex'&&!product.subscription_confirmed) return <Act busy={busy} action="confirm-login" onClick={()=>openSettings('runtime')}>Confirm AI login</Act>;
    const retry=['failed','interrupted'].includes(product.status);
    return <Act busy={busy} action="run" onClick={()=>perform('run',async()=> {await api('run',{id:product.id});})}>{retry?'Try again':`Start ${label(product.stage)}`}</Act>;
  }
  function documents(product:Product, inset=false) { return <section className={"document-list"+(inset?"":" surface")}><div className="section-label"><h3>Documents</h3><span>{product.artifacts?.length||0} {(product.artifacts?.length||0)===1?'file':'files'}</span></div><div id="outputs">{(product.artifacts||[]).map(item=><Button key={item.path} type="button" variant="ghost" className="document-row" aria-label={`Open ${label(item.stage)}`} data-action={'open-'+item.path} disabled={!!busy} onClick={()=>openArtifact(product,item)}><FileText/><span><strong>{documentNames[item.path]||label(item.stage)}</strong><small>{item.path}</small></span><ArrowUpRight className="row-arrow"/></Button>)}</div>{!product.artifacts?.length&&<p id="empty-outputs" className="empty-copy">Each step saves a document here.</p>}</section>; }
  const activeStage=p ? Math.max(0,stages.indexOf(p.stage)) : 0;
  const finished=p?.stage==='release'&&p.status==='completed'&&latest(p,'release');
  const running=p&&(p.status==='running'||snapshot.jobs?.[p.id]?.status==='running');
  const pageNotice=notice||(job?.status==='failed'&&job.error?{text:job.error,error:true}:null);
  const progress=p&&((['failed','interrupted'].includes(p.status)?p.history?.at(-1)?.note:'')||p.error||(snapshot.jobs?.[p.id]?.status==='failed'?snapshot.jobs[p.id].error:'')||(running?'Working in this product’s folder. A log of each run is saved with it.':''));
  useEffect(() => {
    const revealStage=()=> {
      const rail=document.getElementById('stages');
      const step=rail?.querySelector<HTMLElement>('[aria-current="step"]');
      if(rail&&step&&rail.scrollWidth>rail.clientWidth) rail.scrollLeft=step.offsetLeft-rail.offsetLeft-(rail.clientWidth-step.clientWidth)/2;
    };
    revealStage(); window.addEventListener('resize',revealStage);
    return ()=>window.removeEventListener('resize',revealStage);
  },[p?.id,p?.stage,projectTab]);
  const viewedStage=inspectedStage||p?.stage||'research';
  const buildTasks=p?.stage_verification?.build?.tasks||[];
  const activeTask=buildTasks.findIndex(task=>task.status!=='done');
  const tries=(count:number)=>`${count} ${count===1?'try':'tries'}`;
  const taskNote=(task:BuildTask)=> {
    if(task.status==='done') return task.fix_attempts?`Done · fixed after ${tries(task.fix_attempts)}`:task.checks==='not_set_up'?'Done · tests not set up yet':'Done · tests pass';
    if(task.status==='failed') {
      if(task.checks==='passed'&&p?.stage_verification?.build?.status==='checkpoint_failed') return 'Tests pass · could not save this step in Git';
      if(task.checks==='not_set_up') return 'No required tests are set up';
      return task.checks==='failed'?`Tests still failing after ${tries(task.fix_attempts||0)}`:'Could not finish this task';
    }
    return task.status==='working'?(running?(task.fix_attempts?`Fixing failing tests, try ${task.fix_attempts} of 3`:'Working on it'):'Stopped here'):'Coming up';
  };
  const inspecting=!!p&&viewedStage!==p.stage;
  const signIn=snapshot.jobs?.['sign-in'];
  const availableProviders=(settingsProduct?snapshot.project_providers?.[settingsProduct]:undefined)||snapshot.providers||[];
  const providers=[...new Set([...availableProviders.map(roleName), snapshot.projects?.find(item=>item.id===settingsProduct)?.adapter, draft.adapter].filter((value):value is string=>!!value))];
  const availableRoles=(settingsProduct?snapshot.project_roles?.[settingsProduct]:undefined)||snapshot.roles||[];
  if(landing) return <Landing onEnter={focus=>home(!!focus)}/>;
  return <>
    <div className="workspace-shell">
      <a className="workspace-skip" href="#main" onClick={event=>{event.preventDefault();document.getElementById('main')?.focus();}}>Skip to work</a>
      <header className="workspace-topbar">
        <Button id="home-button" className="studio-brand" variant="ghost" aria-label="Foundry home" onClick={()=>home()}><img src="/assets/foundry-mark.svg" alt="" width="28" height="28"/><strong>Foundry</strong></Button>
        <nav className="studio-navigation" aria-label="Workspace navigation">
          <Button id="mobile-menu" variant="ghost" aria-haspopup="dialog" aria-expanded={navigationOpen} aria-controls={navigationOpen?'product-drawer':undefined} onClick={()=>{drawerDestination.current=null;setNavigationOpen(true);}}><SquaresFour aria-hidden="true"/>Your products<span id="workspace-count" className="nav-count" aria-hidden="true">{products.length}</span></Button>
          <Button id="new-product" variant="ghost" onClick={()=>home(true)}><Plus aria-hidden="true"/>New product</Button>
          <Button id="account-button" variant="ghost" onClick={()=>openSettings()}><UserRound aria-hidden="true"/>Account &amp; AI<small id="connection-label" className="sr-only">{account.sharing?'Using your ChatGPT plan':'Using Codex'}</small></Button>
        </nav>
        <MotionToggle/>
      </header>
      <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
        <SheetContent id="product-drawer" className="product-drawer" side="left" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();document.getElementById(drawerDestination.current||'mobile-menu')?.focus();drawerDestination.current=null;}}>
          <header className="drawer-heading"><div><SheetTitle>Your products</SheetTitle><SheetDescription>Pick up where you left off.</SheetDescription></div><Button variant="ghost" size="icon" aria-label="Close products" onClick={()=>setNavigationOpen(false)}><X aria-hidden="true"/></Button></header>
          <ul id="products" className="product-navigation" aria-label="Products">{products.map(product=><li key={product.id}><Button className="product-link" variant="ghost" aria-current={product.id===selected&&!creating?'page':undefined} onClick={()=>choose(product.id)}><Folder aria-hidden="true"/><span>{product.name}</span><ChevronRight aria-hidden="true"/></Button></li>)}</ul>
          {!products.length&&<p className="nav-empty">Your next idea starts here. Create a product to give it a home.</p>}
          <footer className="drawer-footer"><Button variant="outline" onClick={()=>home(true)}><Plus aria-hidden="true"/>Create a product</Button>{!window.foundryBridgePromise&&<Button variant="ghost" onClick={()=>{leavePage();setNavigationOpen(false);location.hash='welcome';setLanding(true);}}><Workflow aria-hidden="true"/>About Foundry</Button>}</footer>
        </SheetContent>
      </Sheet>
      <div className="workspace-toolbar"><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><button onClick={()=>home()}>Workspace</button></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbPage id="current-name">{p?.name||'New product'}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb></div>
      <div id="main" aria-busy={!!busy} className="workspace-main" tabIndex={-1}>
        <div className="page-feedback"><Feedback id="notice" message={pageNotice}/></div>
        {!snapshot.projects?<section className="page loading-state" role="status"><Loader2 className={notice?.error?'':'spinner'} aria-hidden="true"/><h1>{notice?.error?'Your workspace is unavailable':'Opening your workspace'}</h1><p>{notice?.error?'Check the local connection, then try again. Your saved products stay where they are.':'Loading your products.'}</p>{notice?.error&&<Button onClick={()=>perform('refresh',async()=>{})} disabled={!!busy}>Try again</Button>}</section>:!p?<section id="welcome" className="page home-page">
          <div className="idea-desk sky-surface"><SkyBackground/><header className="page-heading home-heading"><div><span className="eyebrow"><Folder aria-hidden="true"/>Your local workspace</span><h1 id="heading" tabIndex={-1}><SplitText text="What do you want to build?"/></h1><p>Start with a problem worth solving. Foundry helps you turn it into a product, one clear step at a time.</p></div></header>
          <section className="new-product-section surface">
            <form id="create-form" onSubmit={event=>{event.preventDefault();perform('create',async()=>{const product=await api('create',{name,idea});await refresh();setName('');setIdea('');choose(product.id);setNotice({text:'Created. Start research when you are ready.'});});}}>
              <label htmlFor="idea" className="composer-label"><SquarePen aria-hidden="true"/>Describe your idea</label>
              <Textarea id="idea" name="idea" className="idea-input" value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Who is it for? What problem does it solve? What should the first version do?" rows={5} maxLength={12000} required/>
              <div className="examples"><span>Try</span>{examples.map(([title,text])=><Button key={title} type="button" variant="outline" size="sm" onClick={()=>{setName(title);setIdea(text);document.getElementById('idea')?.focus();}}>{title}</Button>)}</div>
              <div className="brief-submit"><div className="name-field"><label htmlFor="name">Name</label><Input id="name" name="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Untitled product" autoComplete="off" maxLength={80} required/></div><Button type="submit" data-action="create" disabled={!!busy}>{busy==='create'?<Loader2 className="spinner"/>:<Plus/>}Create product</Button></div>
            </form>
            <p className="brief-note"><ShieldCheck aria-hidden="true"/>Your code, notes and Git history stay on this computer.</p>
          </section>
          <aside className="home-specialists" aria-label="The specialist roles"><SpecialistIntro/></aside>
          </div><div className="method"><Disclosure title="How Foundry works"><ol>{stages.map((stage,index)=><li key={stage}><span>{index+1}</span><strong>{label(stage)}</strong>{['scope','design'].includes(stage)&&<small>You approve</small>}</li>)}</ol><p>You approve the plan and the design. Foundry builds the product, runs its tests, and writes a summary. Publishing is always your call.</p></Disclosure></div>
          <section id="recent-section" className="recent-section">
            <div className="section-label"><h2>Products</h2><span>{products.length?`${products.length} total`:'Nothing here yet'}</span></div>
            <div id="recent-products">
              {[...products].sort((a,b)=>(b.updated_at||b.created_at||'').localeCompare(a.updated_at||a.created_at||'')).slice(0,6).map(product=><Button key={product.id} className="recent-product" variant="ghost" onClick={()=>choose(product.id)}>
                <span className="product-row-icon" aria-hidden="true"><Folder/></span>
                <strong>{product.name}</strong>
                <span className="recent-step"><span className="mini-progress" aria-hidden="true"><span style={{width:`${(Math.max(0,stages.indexOf(product.stage))+(product.stage==='release'&&product.status==='completed'&&latest(product,'release')?1:0))/6*100}%`}}/></span>{label(product.stage)}</span>
                <Badge variant="secondary" className="status-badge" data-status={product.status==='completed'&&product.stage!=='release'?'ready':product.status}>{product.status==='completed'&&product.stage!=='release'?'Ready':statusLabel(product.status)}</Badge>
                <ChevronRight className="row-arrow" aria-hidden="true"/>
              </Button>)}
            </div>
            {!products.length&&<div className="empty-state"><Folder aria-hidden="true"/><h3>No products yet</h3><p>Your products will show up here with their progress.</p></div>}
          </section>
        </section>:<section id="project" className="page product-page">
          <header className="page-heading"><div className="product-heading"><h1 id="heading" tabIndex={-1}>{p.name}</h1><Button id="settings-button" variant="outline" size="sm" onClick={()=>openSettings('runtime')}><Settings2/>Settings</Button></div><p id="idea-summary" className={ideaExpanded?'':'idea-summary-collapsed'}>{p.idea}</p>{p.idea.length>180&&<Button className="idea-expand" variant="ghost" size="sm" aria-expanded={ideaExpanded} aria-controls="idea-summary" onClick={()=>setIdeaExpanded(!ideaExpanded)}>{ideaExpanded?'Show less':'Read full idea'}<ChevronRight aria-hidden="true"/></Button>}</header>
          <Progress className="product-progress" value={(finished?6:activeStage)/6*100} label="Progress"/>
          <div className="product-properties"><span id="stage-number">Step {activeStage+1} of 6</span><span id="completed-count">{finished?6:activeStage} of 6 done</span><span><Cpu/><b id="project-runtime">{cap(p.adapter||'codex')}</b></span><details><summary><Folder/>Product folder</summary><code id="product-path">{p.path}</code><CopyButton content={p.path} label="Copy folder path"/></details></div>
          <Tabs value={projectTab} onValueChange={chooseProjectTab} className="product-tabs"><TabsList className="page-tabs" style={{'--selected-tab':String(['overview','documents','activity'].indexOf(projectTab))} as React.CSSProperties}><TabsTrigger value="overview"><SquaresFour aria-hidden="true"/>Work</TabsTrigger><TabsTrigger value="documents"><FileText aria-hidden="true"/>Documents <span>{p.artifacts?.length||0}</span></TabsTrigger><TabsTrigger value="activity"><Clock3 aria-hidden="true"/>Activity <span id="activity-count">{p.history?.length||0}</span></TabsTrigger></TabsList>
            <TabsContent value="overview">
              <div className="stage-workspace">
                <ol id="stages" className="stage-rail" aria-label="Product stages">{stages.map((stage,index)=> {
                  const done=index<activeStage||!!finished, current=index===activeStage, selected=viewedStage===stage;
                  return <li key={stage} className={(done?'done ':'')+(current?'current':'')} data-status={current?p.status:undefined}>
                    <Button type="button" variant="ghost" className="stage-card" aria-current={current?'step':undefined} aria-pressed={selected} aria-controls="stage-work-panel" onClick={()=>inspectStage(stage)}>
                      <span className="stage-index" aria-hidden="true">{done?<Check/>:index+1}</span>
                      <span className="stage-label"><strong>{label(stage)}</strong><small>{done?'Done':current?(p.status==='awaiting_approval'?'Your review':p.status==='completed'?'Ready':statusLabel(p.status)):'Coming up'}</small></span>
                      {current&&p.status==='awaiting_approval'?<Clock3 className="stage-status" aria-hidden="true"/>:current&&running?<Loader2 className="stage-status spinner" aria-hidden="true"/>:current&&['failed','interrupted'].includes(p.status)?<CircleAlert className="stage-status" aria-hidden="true"/>:null}
                    </Button>
                  </li>;
                })}</ol>
                <div className="desk-body"><section id="stage-work-panel" className="stage-work-panel surface" aria-labelledby="stage-title">
                  <header className="next-step-heading"><p id="stage-caption">Step {stages.indexOf(viewedStage)+1} · {label(viewedStage)}</p>{inspecting?<Badge variant="secondary" className="status-badge">{stages.indexOf(viewedStage)<activeStage?'Done':'Coming up'}</Badge>:<StatusBadge id="status" status={p.status} ready={p.status==='completed'&&!finished}/>}</header>
                  <div className="stage-body">
                    <h2 id="stage-title" tabIndex={-1}>{(stageCopy[viewedStage]||stageCopy.research)[0]}</h2>
                    <p id="stage-description">{(stageCopy[viewedStage]||stageCopy.research)[1]}</p>
                  </div>
                  <div className="stage-action-band" data-attention={!inspecting&&p.status==='awaiting_approval'?'review':!inspecting&&['failed','interrupted'].includes(p.status)?'error':undefined}>
                    {inspecting?<>
                      <div className="stage-next-action"><div><p className="action-label">{stages.indexOf(viewedStage)<activeStage?'Done':'Coming up'}</p><p id="owner-guidance">{latest(p,viewedStage)?'Open it to see what was decided.':'Nothing here yet.'}</p></div><div id="actions">{latest(p,viewedStage)&&<Button variant="outline" disabled={!!busy} onClick={()=>openArtifact(p,latest(p,viewedStage)!)}>Open {label(viewedStage)}<FileText/></Button>}</div></div>
                      <Button variant="ghost" className="return-to-stage" onClick={()=>inspectStage(null)}>Back to {label(p.stage)}<ArrowRight/></Button>
                    </>:<>
                      <div className="stage-next-action"><div><p className="action-label">{p.status==='awaiting_approval'?'Your turn':running?'Working':finished?'Done':'Next step'}</p><p id="owner-guidance">{p.status==='awaiting_approval'?`Read the ${label(p.stage).toLowerCase()} and approve it when it looks right.`:running?(p.stage==='build'&&activeTask>=0?`Task ${activeTask+1} of ${buildTasks.length}: ${buildTasks[activeTask].title}`:'Foundry is on it. You can leave and come back.'):finished?'Your product is built and tested. Read the summary for what is next.':['failed','interrupted'].includes(p.status)?'This step did not finish. Check the note below, then try again.':'Ready when you are.'}</p></div><div id="actions">{stageAction(p)}</div></div>
                      {progress&&<p id="progress" className={['failed','interrupted'].includes(p.status)?'execution-error':'execution-progress'} role="status">{running&&<Loader2 className="spinner"/>}{progress}</p>}
                    </>}
                  </div>
                  {viewedStage==='build'&&buildTasks.length>0&&<section id="build-tasks" className="build-tasks" aria-labelledby="build-tasks-title"><div className="section-label"><h3 id="build-tasks-title">Tasks</h3><span>{buildTasks.filter(task=>task.status==='done').length} of {buildTasks.length} done</span></div><ol>{buildTasks.map((task,index)=><li key={`${index}-${task.title}`} data-status={task.status}>{task.status==='done'?<CircleCheck aria-hidden="true"/>:task.status==='failed'?<CircleAlert aria-hidden="true"/>:task.status==='working'&&running?<Loader2 className="spinner" aria-hidden="true"/>:<Circle aria-hidden="true"/>}<span><strong>{task.title}</strong><small>{taskNote(task)}</small></span></li>)}</ol></section>}
                  {p.status==='awaiting_approval'&&!inspecting&&latest(p,viewedStage)&&<DocumentPreview key={p.id+viewedStage} productId={p.id} artifact={latest(p,viewedStage)!} updatedAt={p.updated_at}/>}
                  {!latest(p,viewedStage)&&!running&&<p className="work-empty"><FileText aria-hidden="true"/>This step’s work will appear here when it is ready.</p>}
                </section>
                <details className="desk-context" open><summary><Users aria-hidden="true"/>People &amp; documents<ChevronRight aria-hidden="true"/></summary><div>
                  <section className="specialist-section"><div className="section-label"><h3><Users aria-hidden="true"/>For this step</h3><Button variant="ghost" size="sm" onClick={()=>openSettings('specialists')}>Adjust roles<ArrowRight/></Button></div>
                    <ul className="stage-specialists">{(p.roles?.length?p.roles:stageRoles[viewedStage]||stageRoles.research).map(role=><li key={role} className="specialist-card"><RoleAvatar role={role} size={32} active={!inspecting&&!!running}/><span><strong>{roleLabel(role)}</strong></span></li>)}</ul>
                  </section>{documents(p,true)}<section className="context-activity"><div className="section-label"><h3>Latest activity</h3></div>{p.history?.length?<ol>{p.history.slice(-3).reverse().map((entry,index)=><li key={index}><strong>{label(entry.stage)} · {statusLabel(entry.status)}</strong><time dateTime={entry.at}>{stamp(entry.at)}</time></li>)}</ol>:<p className="empty-copy">Your first step starts the story.</p>}</section></div></details>
                </div>
              </div>

            </TabsContent>
            <TabsContent value="documents">{documents(p)}</TabsContent>
            <TabsContent value="activity"><section className="activity-section surface"><div className="section-label"><h3>Activity</h3><span>Everything that happened</span></div><ol id="activity" className="activity">{[...(p.history||[])].reverse().map((entry,index)=><li key={`${entry.at}-${index}`}>{entry.status==='failed'?<CircleAlert/>:entry.status==='completed'?<CircleCheck/>:<Clock3/>}<div><strong>{label(entry.stage)} · {statusLabel(entry.status)}</strong><p>{entry.note||'Product record updated.'}</p></div><time dateTime={entry.at}>{stamp(entry.at)}</time></li>)}</ol>{!p.history?.length&&<div className="empty-state"><Clock3/><h3>Nothing yet</h3><p>Each step will be listed here as it runs.</p></div>}</section></TabsContent>
          </Tabs>
        </section>}
      </div>
    </div>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent id="settings" className="settings-dialog" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();if(settingsFocus.current?.isConnected)settingsFocus.current.focus();else document.getElementById('mobile-menu')?.focus();}}>
      <form id="settings-form" onSubmit={saveSettings}><header className="settings-header"><div><DialogTitle id="settings-title">Account &amp; AI</DialogTitle><DialogDescription>Choose which AI does the work and how.</DialogDescription></div><Button type="button" id="close-settings" variant="ghost" size="icon" aria-label="Close settings" onClick={()=>setSettingsOpen(false)}><X/></Button></header><Feedback id="settings-notice" message={settingsNotice}/>
        <Tabs value={settingsTab} onValueChange={setSettingsTab}><TabsList className="settings-tabs"><TabsTrigger id="settings-tab-account" value="account">Account</TabsTrigger>{settingsProduct&&<><TabsTrigger id="settings-tab-runtime" value="runtime">AI</TabsTrigger><TabsTrigger id="settings-tab-specialists" value="specialists">Roles</TabsTrigger></>}</TabsList>
          <TabsContent value="account" id="settings-panel-account"><div className="account-panel"><UserRound/><div><h3>ChatGPT</h3><p id="account-status">{signIn?.status==='failed'?signIn.error:account.connected?`${account.email||'ChatGPT connected'}${account.sharing?' · plan usage enabled':' · plan usage not granted'}`:signIn?.status==='running'?'Finish sign-in in your browser…':'Not connected to Foundry'}</p><p className="field-help">Use your ChatGPT plan for products built on this computer. Your Codex login also works; pick it under AI.</p><div className="account-actions"><Button id="sign-in" type="button" variant="outline" data-action="sign-in" disabled={!!busy} onClick={()=>perform('sign-in',async()=>{await api('sign-in',{});},'settings')}>{account.connected?'Reconnect ChatGPT':'Continue with ChatGPT'}</Button>{account.connected&&<Button id="sign-out" type="button" variant="ghost" data-action="sign-out" disabled={!!busy} onClick={()=>perform('sign-out',async()=>{await api('sign-out',{});},'settings')}>Sign out</Button>}<a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage<ArrowUpRight/></a></div></div></div></TabsContent>
          {settingsProduct&&<><TabsContent value="runtime" id="settings-panel-runtime">
            <h3 className="settings-section-title">Choose your AI engine</h3><p className="field-help">Select an engine, then save. Selecting a card does not connect an account or start work.</p>
            <ChoiceGroup id="adapter" label="AI engine" value={draft.adapter} onValueChange={adapter=>setDraft({...draft,adapter,subscription_confirmed:adapter===draft.adapter?draft.subscription_confirmed:false})} options={providers.map(provider=>({value:provider,label:provider==='codex'?'Codex (your login)':provider==='chatgpt'?'ChatGPT plan':provider,description:provider==='codex'?'Use the Codex login on this computer.':provider==='chatgpt'?'Uses your Foundry ChatGPT connection.':'A registered local runtime adapter.'}))}/>
            {draft.adapter==='codex'&&<label className="subscription-confirmation" htmlFor="subscription-consent"><Checkbox id="subscription-consent" checked={draft.subscription_confirmed} onCheckedChange={checked=>setDraft({...draft,subscription_confirmed:checked})}/><span>Use my existing Codex subscription login. Do not use metered API billing.</span></label>}
            <Disclosure title="Model and reasoning"><div className="field-grid"><div><label htmlFor="model">Model</label><Input id="model" list="models" placeholder="Default" value={draft.model} onChange={event=>setDraft({...draft,model:event.target.value})}/></div><div><label htmlFor="reasoning">Reasoning</label><NativeSelect id="reasoning" value={draft.reasoning} onChange={event=>setDraft({...draft,reasoning:event.target.value})}><EffortOptions/></NativeSelect></div></div><p className="field-help">Leave the model blank to use the default. Changes apply after you save.</p></Disclosure>
          </TabsContent>
          <TabsContent value="specialists" id="settings-panel-specialists"><label htmlFor="role-search">Find a role</label><div className="role-search"><Search/><Input id="role-search" type="search" placeholder="Search roles" value={roleSearch} onChange={event=>setRoleSearch(event.target.value)}/></div><p className="field-help">Pick a model for native Codex helpers, or leave it blank to use the default. Other engines may apply roles as instructions in one session.</p><div id="roles" className="roles">{availableRoles.map(roleName).map(role=><div key={role} className="role-row" hidden={!!roleSearch&&!roleLabel(role).toLowerCase().includes(roleSearch.toLowerCase())}><label htmlFor={'role-'+role} className="role-identity"><RoleAvatar role={role} size={36}/><span>{roleLabel(role)}<small>{roleCatalog.find(item=>item.id===role.replace(/^foundry[-_]/,''))?.description}</small></span></label><Input aria-label={roleLabel(role)} id={'role-'+role} data-role={role} list="models" placeholder="Default" value={draft.roles[role]?.model||''} onChange={event=>setRole(role,'model',event.target.value)}/><NativeSelect aria-label={`${cap(role)} reasoning`} data-role-reasoning={role} value={draft.roles[role]?.reasoning||''} onChange={event=>setRole(role,'reasoning',event.target.value)}><EffortOptions/></NativeSelect></div>)}</div>{!availableRoles.some(role=>roleLabel(roleName(role)).toLowerCase().includes(roleSearch.toLowerCase()))&&<p className="empty-copy">No roles match.</p>}</TabsContent></>}
        </Tabs><datalist id="models">{models.map(model=><option key={model.slug||model.id} value={model.slug||model.id}>{model.display_name}</option>)}</datalist>{settingsProduct&&settingsTab!=='account'&&<footer className="settings-footer"><span>Changes apply to this product.</span><Button type="submit" data-action="save-settings" disabled={!!busy}>{busy==='save-settings'&&<Loader2 className="spinner"/>}Save settings</Button></footer>}
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!review} onOpenChange={open=>{if(!open)setReview(null);}}><DialogContent id="artifact" className="artifact-dialog" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();if(artifactFocus.current?.isConnected)artifactFocus.current.focus();else document.getElementById('stage-title')?.focus();}}>
      {review&&<><header className="artifact-header"><div><p><FileText/><code id="artifact-path">{review.path}</code></p><DialogTitle id="artifact-title">{documentNames[review.path]||label(review.stage)}</DialogTitle><DialogDescription>{review.canApprove?'Read it through. Approving applies to this exact version.':'Saved with this product.'}</DialogDescription></div><Button id="close-artifact" type="button" variant="ghost" size="icon" aria-label="Close document" onClick={()=>setReview(null)}><X/></Button></header><Feedback id="artifact-notice" message={artifactNotice}/><div className="revision-strip"><ShieldCheck aria-hidden="true"/><span>Version</span><code title={review.revision}>{review.revision.slice(0,12)}</code>{review.canApprove&&<StatusBadge status="awaiting_approval"/>}</div><article id="artifact-content" className="document" dangerouslySetInnerHTML={{__html:review.content}}/><footer className="artifact-footer"><p id="artifact-guidance">{review.canApprove?`Approve to start ${label(stages[stages.indexOf(review.stage)+1])}.`:'Saved with this product.'}</p><div className="review-actions"><Button type="button" variant="outline" onClick={()=>setReview(null)}>Back to product</Button>{review.canApprove&&<Button id="artifact-approve" type="button" data-action="approve" disabled={!!busy} onClick={approve}>Approve and continue{busy==='approve'?<Loader2 className="spinner"/>:<ArrowRight/>}</Button>}</div></footer></>}
    </DialogContent></Dialog>
  </>;
}
const styleNonce=document.querySelector<HTMLMetaElement>('meta[name="foundry-style-nonce"]')?.content;
if(styleNonce) setNonce(styleNonce);
createRoot(document.getElementById('root')!).render(<StudioMotion nonce={styleNonce}><IconContext.Provider value={{weight:'duotone',size:20}}><TooltipProvider><Workspace/></TooltipProvider></IconContext.Provider></StudioMotion>);

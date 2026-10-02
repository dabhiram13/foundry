import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from '@/components/landing';
import { RoleAvatar, roleCatalog } from '@/components/specialists';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ArrowRight, ArrowUpRight, ChevronRight, Check, Circle, CircleAlert, CircleCheck, Clock3, Cpu, FileText, Folder, House, Loader2, Plus, Search, Settings2, ShieldCheck, Square, SquarePen, UserRound, Users, Workflow, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';

type RoleSettings = {model?: string | null; reasoning?: string | null};
type Artifact = {path: string; stage: string};
type History = {at?: string; stage?: string; status?: string; note?: string};
type Product = {id: string; name: string; idea: string; path: string; stage: string; status: string; adapter?: string; model?: string | null; reasoning?: string | null; role_settings?: Record<string, RoleSettings>; artifacts: Artifact[]; history: History[]; created_at?: string; updated_at?: string; error?: string};
type Snapshot = {projects?: Product[]; roles?: (string | {name: string})[]; providers?: (string | {name: string})[]; account?: {connected?: boolean; sharing?: boolean; email?: string}; jobs?: Record<string, {status?: string; error?: string}>};
type Message = {text: string; error?: boolean} | null;
type Review = {productId: string; stage: string; path: string; revision: string; content: string; canApprove: boolean};
type Draft = {adapter: string; model: string; reasoning: string; roles: Record<string, RoleSettings>};
declare global { interface Window { foundryBridgePromise?: Promise<{callServerTool: (request: {name: string; arguments: unknown}) => Promise<{isError?: boolean; structuredContent?: any; content?: {type: string; text?: string}[]}>}> } }
const stages = ['research', 'scope', 'design', 'build', 'verify', 'release'];
const reasoning = ['', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const stageCopy: Record<string, [string, string]> = {
  research: ['Start with the problem', 'Research the people, alternatives, and assumptions behind this idea.'],
  scope: ['Choose the first useful version', 'Review the intended user, boundaries, and acceptance criteria before implementation.'],
  design: ['Shape the product experience', 'Review the journeys and design decisions before the build starts.'],
  build: ['Build the agreed product', 'The coordinator works from the approved scope with your selected runtime and specialist instructions.'],
  verify: ['Check that it actually works', 'Run the configured product checks and save evidence. A completion message alone cannot pass this stage.'],
  release: ['Your release handoff', 'Review the build record and handoff, then decide where and when to publish.']
};
const cap = (value: string = '') => value.replace(/(^|[_-])(\w)/g, (_, sep, letter) => (sep ? ' ' : '') + letter.toUpperCase());
const roleName = (value: string | {name: string}) => typeof value === 'string' ? value : value.name;
const roleLabel = (name: string) => cap(name.replace(/^foundry[-_]/, ''));
const stamp = (value?: string) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.valueOf()) ? value : d.toLocaleString([], {dateStyle:'medium', timeStyle:'short'}); };
const emptyDraft: Draft = {adapter:'codex', model:'', reasoning:'', roles:{}};
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
function EffortOptions() { return <>{reasoning.map(value => <NativeSelectOption key={value} value={value}>{value || 'Inherit reasoning'}</NativeSelectOption>)}</>; }

function Act({action, busy, children, onClick, variant='default'}: {action:string;busy:string;children:React.ReactNode;onClick:()=>void;variant?:'default'|'outline'|'ghost'}) { return <Button type="button" variant={variant} data-action={action} disabled={!!busy} onClick={onClick}>{busy===action ? <Loader2 className="spinner"/> : null}{children}</Button>; }

const stageRoles: Record<string, string[]> = {
  research: ['market-researcher','social-signal','trend-validator','discovery-critic'],
  scope: ['planner','architect','critic','spec-critic'],
  design: ['designer','ux-critic','design-evaluator','logo-designer'],
  build: ['backend','db-architect','connector','ts-expert'],
  verify: ['api-tester','flow-tester','perf-tester','security-auditor'],
  release: ['quality-gate','backend-evaluator','sentry-analyst','complete']
};
function StatusBadge({status, ready=false, id}: {status:string;ready?:boolean;id?:string}) {
  const Icon = status==='running'?Loader2:status==='completed'?CircleCheck:status==='awaiting_approval'?Clock3:['failed','interrupted'].includes(status)?CircleAlert:Circle;
  return <Badge id={id} variant="secondary" className="status-badge" data-status={ready?'ready':status}><Icon aria-hidden="true" className={status==='running'?'spinner':''}/>{ready?'Ready':status==='awaiting_approval'?'Awaiting review':cap(status)}</Badge>;
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
  const {isMobile, setOpenMobile} = useSidebar();
  const products = snapshot.projects || []; const p = !creating ? products.find(item => item.id === selected) : undefined;
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
  function choose(id: string) { leavePage(); if(location.hash!=='#product/'+encodeURIComponent(id)) {navigationFocus.current='heading';location.hash='product/'+encodeURIComponent(id);} setLanding(false); setInspectedStage(null); setSelected(id); selectedRef.current=id; setCreating(false); setProjectTab('overview'); remember(id); setNotice(null); setOpenMobile(false); setNavigationTarget('heading'); }
  function home(focus=false) { leavePage(); if(location.hash!=='#workspace') {navigationFocus.current=focus?'name':'heading';location.hash='workspace';} setLanding(false); setCreating(true); setNotice(null); setOpenMobile(false); setNavigationTarget(focus ? 'name' : 'heading'); }
  useEffect(()=> {
    const navigate=()=> {
      navigationEpoch.current++; setReview(null); setSettingsOpen(false); setInspectedStage(null); setNotice(null);
      setLanding(!window.foundryBridgePromise && (!location.hash || location.hash==='#welcome'));
      const id=hashProduct();
      if(id) {setSelected(id); selectedRef.current=id; setCreating(false); remember(id);}
      else if(location.hash==='#workspace') setCreating(true);
      setProjectTab('overview'); setOpenMobile(false);
      // Explicit navigation already focuses after its render. A later hashchange
      // must not steal focus from a field the owner has started editing.
      const focusId=navigationFocus.current?null:(location.hash==='#welcome'||!location.hash ? 'landing-title' : 'heading');
      navigationFocus.current=null;
      if(focusId) setNavigationTarget(focusId);
    };
    window.addEventListener('hashchange', navigate);
    return ()=>window.removeEventListener('hashchange', navigate);
  }, [setOpenMobile]);
  useLayoutEffect(()=> {
    if(!navigationTarget) return;
    const target=document.getElementById(navigationTarget);
    if(target) {target.focus();setNavigationTarget(null);}
  },[navigationTarget,landing,creating,selected,snapshot.projects]);
  useEffect(()=>setInspectedStage(null),[p?.id,p?.stage]);
  async function openSettings(tab='account') {
    settingsFocus.current=isMobile?document.getElementById('mobile-menu'):document.activeElement as HTMLElement; setSettingsNotice(null); setRoleSearch(''); setSettingsProduct(p?.id || null);
    setDraft(p ? {adapter:p.adapter||'codex', model:p.model||'', reasoning:p.reasoning||'', roles:structuredClone(p.role_settings||{})} : emptyDraft);
    setSettingsTab(tab); setOpenMobile(false); setSettingsOpen(true);
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
    if (!review || !review.canApprove || current?.id!==review.productId || current.stage!==review.stage || current.status!=='awaiting_approval') {setReview(null);setNotice({text:'This review is no longer current. Open the latest stage document.',error:true});return;}
    await perform('approve',async()=> {
      await api('approve',{id:review.productId,reviewed_revision:review.revision});
      setReview(null);
      try { await api('run',{id:review.productId}); setNotice({text:'Approved. The next stage is running.'}); }
      catch (error) { setNotice({text:'Approved. The next stage could not start: '+(error instanceof Error?error.message:'Please try Continue again.'),error:true}); }
      requestAnimationFrame(()=>document.getElementById('stage-title')?.focus());
    },'artifact');
  }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settingsProduct) return;
    await perform('save-settings',async()=> {await api('configure',{id:settingsProduct,adapter:draft.adapter,model:draft.model||null,reasoning:draft.reasoning||null,roles:Object.fromEntries(Object.entries(draft.roles).map(([key,value])=>[key,{model:value.model||null,reasoning:value.reasoning||null}]))});setSettingsOpen(false);setNotice({text:'Runtime and specialist preferences saved.'});},'settings');
  }
  function setRole(role: string, field: keyof RoleSettings, value: string) { setDraft(prev=>({...prev,roles:{...prev.roles,[role]:{...prev.roles[role],[field]:value}}})); }

  function stageAction(product: Product) {
    const running=product.status==='running'||snapshot.jobs?.[product.id]?.status==='running';
    const finished=product.stage==='release'&&product.status==='completed'&&latest(product,'release');
    if (running) return <Act busy={busy} action="cancel" variant="outline" onClick={()=>perform('cancel',async()=> {await api('cancel',{id:product.id});setNotice({text:'Stop requested. Waiting for the runtime to confirm interruption.'});})}><Square/>Stop this stage</Act>;
    if (product.status==='awaiting_approval') {const doc=latest(product,product.stage);return doc&&<Act busy={busy} action="review" onClick={()=>openArtifact(product,doc,true)}>Review {cap(product.stage)}<ArrowRight/></Act>;}
    if (finished) return <Act busy={busy} action="handoff" onClick={()=>openArtifact(product,finished)}>View release handoff<ArrowUpRight/></Act>;
    const retry=['failed','interrupted'].includes(product.status);
    return <Act busy={busy} action="run" onClick={()=>perform('run',async()=> {await api('run',{id:product.id});setNotice({text:retry?'The stage is running again.':'The stage is running. You can return to this product later.'});})}>{retry?'Retry this stage':`Continue with ${cap(product.stage)}`}<ArrowRight/></Act>;
  }
  function documents(product:Product, inset=false) { return <section className={"document-list"+(inset?"":" surface")}><div className="section-label"><h3>Documents</h3><span>{product.artifacts?.length||0} {(product.artifacts?.length||0)===1?'file':'files'}</span></div><div id="outputs">{(product.artifacts||[]).map(item=><Button key={item.path} type="button" variant="ghost" className="document-row" aria-label={`Open ${cap(item.stage)}`} data-action={'open-'+item.path} disabled={!!busy} onClick={()=>openArtifact(product,item)}><FileText/><span><strong>{cap(item.stage)}</strong><small>{item.path}</small></span><ArrowUpRight className="row-arrow"/></Button>)}</div>{!product.artifacts?.length&&<p id="empty-outputs" className="empty-copy">Documents will appear here as each stage completes.</p>}</section>; }
  const activeStage=p ? Math.max(0,stages.indexOf(p.stage)) : 0;
  const finished=p?.stage==='release'&&p.status==='completed'&&latest(p,'release');
  const running=p&&(p.status==='running'||snapshot.jobs?.[p.id]?.status==='running');
  const progress=p&&((['failed','interrupted'].includes(p.status)?p.history?.at(-1)?.note:'')||p.error||(snapshot.jobs?.[p.id]?.status==='failed'?snapshot.jobs[p.id].error:'')||(running?'Working locally. Execution receipts are saved with the product.':''));
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
  const inspecting=!!p&&viewedStage!==p.stage;
  const signIn=snapshot.jobs?.['sign-in'];
  const providers=[...new Set([...(snapshot.providers||[]).map(roleName), snapshot.projects?.find(item=>item.id===settingsProduct)?.adapter, draft.adapter].filter((value):value is string=>!!value))];
  if(landing) return <Landing onEnter={focus=>home(!!focus)}/>;
  return <>
    <Sidebar className="workspace-sidebar" collapsible="offcanvas">
      <SidebarHeader className="workspace-brand"><img src="/assets/foundry-mark.svg" alt="" width="28" height="28"/><div><strong>Foundry</strong><span>Your local product studio</span></div>{isMobile&&<Button className="mobile-nav-close" size="icon" variant="ghost" aria-label="Close workspace navigation" onClick={()=>setOpenMobile(false)}><X/></Button>}</SidebarHeader>
      <SidebarContent>
        <SidebarGroup><SidebarGroupContent><SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton id="home-button" isActive={creating} onClick={()=>home()}><House/><span>Home</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton id="new-product" onClick={()=>home(true)}><SquarePen/><span>New product</span></SidebarMenuButton></SidebarMenuItem>
        {!window.foundryBridgePromise&&<SidebarMenuItem><SidebarMenuButton onClick={()=>{leavePage();location.hash='welcome';setLanding(true);}}><Workflow/><span>About Foundry</span></SidebarMenuButton></SidebarMenuItem>}
        </SidebarMenu></SidebarGroupContent></SidebarGroup>
        <SidebarGroup><SidebarGroupLabel className="products-label">Products <span id="workspace-count">{products.length}</span></SidebarGroupLabel><SidebarGroupContent><SidebarMenu id="products" aria-label="Products">
          {products.map(product=><SidebarMenuItem key={product.id}><SidebarMenuButton className="product-link" isActive={product.id===selected&&!creating} aria-current={product.id===selected&&!creating?'page':undefined} onClick={()=>choose(product.id)}><FileText/><span>{product.name}</span></SidebarMenuButton></SidebarMenuItem>)}
          {!products.length&&<p className="nav-empty">A place for your next idea.</p>}
        </SidebarMenu></SidebarGroupContent></SidebarGroup>
      </SidebarContent>
      <SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton id="account-button" className="account-control" onClick={()=>openSettings()}><UserRound/><span>Account &amp; runtime<small id="connection-label">{account.sharing?'Using ChatGPT plan':'Codex runtime'}</small></span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </Sidebar>
    <SidebarInset>
      <header className="workspace-toolbar"><SidebarTrigger id="mobile-menu" aria-label={isMobile?'Open workspace navigation':'Toggle workspace navigation'}/><Separator orientation="vertical" className="toolbar-divider"/><Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><button onClick={()=>home()}>Workspace</button></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbPage id="current-name">{p?.name||'Home'}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb><span className="local-label"><Folder/>Local</span></header>
      <div id="main" aria-busy={!!busy} className="workspace-main" tabIndex={-1}>
        <div className="page-feedback"><Feedback id="notice" message={notice}/></div>
        {!snapshot.projects?<section className="page loading-state" role="status"><Loader2 className={notice?.error?'':'spinner'} aria-hidden="true"/><h1>{notice?.error?'Your workspace is unavailable':'Opening your workspace'}</h1><p>{notice?.error?'Check the local connection, then try again. Your saved products stay where they are.':'Loading saved products and runtime information.'}</p>{notice?.error&&<Button onClick={()=>perform('refresh',async()=>{})} disabled={!!busy}>Try again</Button>}</section>:!p?<section id="welcome" className="page home-page">
          <header className="page-heading home-heading"><div><span className="eyebrow">Made for your next idea</span><h1 id="heading" tabIndex={-1}>Your workspace</h1><p>Start with a problem worth solving. Make the next step clear.</p></div><div className="home-bots" aria-hidden="true"><RoleAvatar role="market-researcher" size={48}/><RoleAvatar role="designer" size={48}/><RoleAvatar role="backend" size={48}/></div></header>
          <section className="new-product-section surface"><div className="section-label"><h2><SquarePen/>New product</h2><span id="home-counter">{products.length?`${products.length} in your workspace`:'Start with a name and a brief'}</span></div>
            <form id="create-form" onSubmit={event=>{event.preventDefault();perform('create',async()=>{const product=await api('create',{name,idea});await refresh();setName('');setIdea('');choose(product.id);setNotice({text:'Workspace created. Continue with research when you are ready.'});});}}>
              <div className="brief-field"><label htmlFor="name">Product name</label><Input id="name" name="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Untitled product" autoComplete="off" maxLength={80} required/></div>
              <div className="brief-field"><label htmlFor="idea">What should it do?</label><div><Textarea id="idea" name="idea" value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Who is it for? What problem does it solve? What should the first version do?" rows={5} maxLength={12000} required/><div className="examples"><span>For example</span><Button type="button" variant="ghost" size="sm" onClick={()=>{setName('Client portal');setIdea('A simple portal where clients can review project updates, approve deliverables, and find shared files.');document.getElementById('idea')?.focus();}}>Client portal<ArrowUpRight/></Button><Button type="button" variant="ghost" size="sm" onClick={()=>{setName('Research brief');setIdea('A research workspace that tracks sources, findings, decisions, and the evidence behind each recommendation.');document.getElementById('idea')?.focus();}}>Research brief<ArrowUpRight/></Button></div></div></div>
              <div className="brief-submit"><Button type="submit" data-action="create" disabled={!!busy}>{busy==='create'?<Loader2 className="spinner"/>:<Plus/>}Create product</Button><span>A separate workspace. Your code.</span></div>
            </form>
          </section>
          <details className="method"><summary><Workflow/><span>How Foundry works</span><ChevronRight/></summary><ol>{stages.map((stage,index)=><li key={stage}><span>{index+1}</span><strong>{cap(stage)}</strong>{['scope','design'].includes(stage)&&<small>You review</small>}</li>)}</ol><p>You review scope and design. Foundry builds, runs checks, and prepares a release handoff. Publishing stays your decision.</p></details>
          <section id="recent-section" className="recent-section"><div className="section-label"><h2>Products</h2><span>{products.length?`${products.length} total`:'Nothing here yet'}</span></div><div id="recent-products">{[...products].sort((a,b)=>(b.updated_at||b.created_at||'').localeCompare(a.updated_at||a.created_at||'')).slice(0,6).map(product=><Button key={product.id} className="recent-product" variant="ghost" onClick={()=>choose(product.id)}><FileText/><strong>{product.name}</strong><span>{cap(product.stage)}</span><Badge variant="secondary">{product.status==='completed'&&product.stage!=='release'?'Ready':cap(product.status)}</Badge><ChevronRight/></Button>)}</div>{!products.length&&<div className="empty-state"><Folder aria-hidden="true"/><h3>A fresh page for your ideas</h3><p>Products you create will appear here, with their documents and progress.</p></div>}</section>
        </section>:<section id="project" className="page product-page">
          <header className="page-heading"><div className="product-heading"><h1 id="heading" tabIndex={-1}>{p.name}</h1><Button id="settings-button" variant="outline" size="sm" onClick={()=>openSettings('runtime')}><Settings2/>Runtime &amp; specialists</Button></div><p id="idea-summary">{p.idea}</p></header>
          <div className="product-properties"><span><Cpu/><b id="project-runtime">{cap(p.adapter||'codex')}</b> runtime</span><span id="stage-number">Stage {activeStage+1} of 6</span><span id="completed-count">{finished?6:activeStage} complete</span><details><summary><Folder/>Workspace path</summary><code id="product-path">{p.path}</code></details></div>
          <Tabs value={projectTab} onValueChange={chooseProjectTab} className="product-tabs"><TabsList className="page-tabs" style={{'--selected-tab':String(['overview','documents','activity'].indexOf(projectTab))} as React.CSSProperties}><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="documents">Documents <span>{p.artifacts?.length||0}</span></TabsTrigger><TabsTrigger value="activity">Activity <span id="activity-count">{p.history?.length||0}</span></TabsTrigger></TabsList>
            <TabsContent value="overview">
              <div className="stage-workspace">
                <ol id="stages" className="stage-rail" aria-label="Product stages">{stages.map((stage,index)=> {
                  const done=index<activeStage||!!finished, current=index===activeStage, selected=viewedStage===stage;
                  return <li key={stage} className={(done?'done ':'')+(current?'current':'')}>
                    <Button type="button" variant="ghost" className="stage-card" aria-current={current?'step':undefined} aria-pressed={selected} aria-controls="stage-work-panel" onClick={()=>inspectStage(stage)}>
                      <span className="stage-index" aria-hidden="true">{done?<Check/>:index+1}</span>
                      <span className="stage-label"><strong>{cap(stage)}</strong><small>{done?'Complete':current?(p.status==='awaiting_approval'?'Your review':p.status==='completed'?'Ready':cap(p.status)):'Upcoming'}</small></span>
                      {current&&p.status==='awaiting_approval'?<Clock3 className="stage-status" aria-hidden="true"/>:current&&running?<Loader2 className="stage-status spinner" aria-hidden="true"/>:current&&['failed','interrupted'].includes(p.status)?<CircleAlert className="stage-status" aria-hidden="true"/>:null}
                    </Button>
                  </li>;
                })}</ol>
                <section id="stage-work-panel" className="stage-work-panel surface" aria-labelledby="stage-title">
                  <header className="next-step-heading"><p id="stage-caption"><FileText aria-hidden="true"/>{cap(viewedStage)} stage</p>{inspecting?<Badge variant="secondary" className="status-badge">{stages.indexOf(viewedStage)<activeStage?'Complete':'Upcoming'}</Badge>:<StatusBadge id="status" status={p.status} ready={p.status==='completed'&&!finished}/>}</header>
                  <div className="stage-body">
                    <h2 id="stage-title" tabIndex={-1}>{(stageCopy[viewedStage]||stageCopy.research)[0]}</h2>
                    <p id="stage-description">{(stageCopy[viewedStage]||stageCopy.research)[1]}</p>
                    {!inspecting&&<div className="coordinator-line"><Cpu aria-hidden="true"/><span>{cap(p.adapter||'codex')} · {running?'Runtime active':'Selected runtime'}</span></div>}
                  </div>
                  <div className="stage-action-band">
                    {inspecting?<>
                      <div className="stage-next-action"><div><p className="action-label">{stages.indexOf(viewedStage)<activeStage?'Saved stage':'Ahead in your workflow'}</p><p id="owner-guidance">{latest(p,viewedStage)?'Open the saved document to see the decisions and evidence.':'No document saved for this stage yet.'}</p></div><div id="actions">{latest(p,viewedStage)&&<Button variant="outline" disabled={!!busy} onClick={()=>openArtifact(p,latest(p,viewedStage)!)}>Open {cap(viewedStage)}<FileText/></Button>}</div></div>
                      <Button variant="ghost" className="return-to-stage" onClick={()=>inspectStage(null)}>Back to {cap(p.stage)}<ArrowRight/></Button>
                    </>:<>
                      <div className="stage-next-action"><div><p className="action-label">Next action</p><p id="owner-guidance">{p.status==='awaiting_approval'?`Review the ${p.stage} document before Foundry continues.`:running?'Foundry is working in this product’s folder.':finished?'The local build and its release handoff are ready for review.':'You can stop work and come back. Every stage stays with the product.'}</p></div><div id="actions">{stageAction(p)}</div></div>
                      {progress&&<p id="progress" className={['failed','interrupted'].includes(p.status)?'execution-error':'execution-progress'} role="status">{running&&<Loader2 className="spinner"/>}{progress}</p>}
                      <div className="stage-provenance"><ShieldCheck aria-hidden="true"/><span>{p.status==='awaiting_approval'?'Approval applies to the exact document you open.':finished?'Saved checks and handoff are available in Documents.':'Progress comes from the saved product record.'}</span></div>
                    </>}
                  </div>
                  {documents(p,true)}
                </section>
              </div>
              <section className="specialist-section"><div className="section-label"><h3><Users aria-hidden="true"/>Guidance for {cap(viewedStage)}</h3><Button variant="ghost" size="sm" onClick={()=>openSettings('specialists')}>View specialists<ArrowRight/></Button></div><p className="field-help">The coordinator selects relevant role guidance. Individual specialist activity is not reported by this runtime.</p><div className="stage-specialists">{(stageRoles[viewedStage]||stageRoles.research).map(role=><button key={role} type="button" className="specialist-card" onClick={()=>{openSettings('specialists');setRoleSearch(roleLabel(role));}}><RoleAvatar role={role} size={40}/><span><strong>{roleLabel(role)}</strong><small>{roleCatalog.find(item=>item.id===role)?.description||'Specialist guidance'}</small></span><ChevronRight aria-hidden="true"/></button>)}</div></section>
            </TabsContent>
            <TabsContent value="documents">{documents(p)}</TabsContent>
            <TabsContent value="activity"><section className="activity-section surface"><div className="section-label"><h3>Activity</h3><span>Saved product history</span></div><ol id="activity" className="activity">{[...(p.history||[])].reverse().map((entry,index)=><li key={`${entry.at}-${index}`}>{entry.status==='failed'?<CircleAlert/>:entry.status==='completed'?<CircleCheck/>:<Clock3/>}<div><strong>{cap(entry.stage)} · {cap(entry.status)}</strong><p>{entry.note||'Product record updated.'}</p></div><time dateTime={entry.at}>{stamp(entry.at)}</time></li>)}</ol>{!p.history?.length&&<div className="empty-state"><Clock3/><h3>The story starts here</h3><p>Saved stage events will appear as your product progresses.</p></div>}</section></TabsContent>
          </Tabs>
        </section>}
      </div>
    </SidebarInset>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent id="settings" className="settings-dialog" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();if(settingsFocus.current?.isConnected)settingsFocus.current.focus();else document.getElementById('mobile-menu')?.focus();}}>
      <form id="settings-form" onSubmit={saveSettings}><header className="settings-header"><div><DialogTitle id="settings-title">Account &amp; runtime</DialogTitle><DialogDescription>Choose how Foundry works with you.</DialogDescription></div><Button type="button" id="close-settings" variant="ghost" size="icon" aria-label="Close settings" onClick={()=>setSettingsOpen(false)}><X/></Button></header><Feedback id="settings-notice" message={settingsNotice}/>
        <Tabs value={settingsTab} onValueChange={setSettingsTab}><TabsList className="settings-tabs"><TabsTrigger id="settings-tab-account" value="account">Account</TabsTrigger>{settingsProduct&&<><TabsTrigger id="settings-tab-runtime" value="runtime">Runtime</TabsTrigger><TabsTrigger id="settings-tab-specialists" value="specialists">Specialists</TabsTrigger></>}</TabsList>
          <TabsContent value="account" id="settings-panel-account"><div className="account-panel"><UserRound/><div><h3>ChatGPT</h3><p id="account-status">{signIn?.status==='failed'?signIn.error:account.connected?`${account.email||'ChatGPT connected'}${account.sharing?' · plan usage enabled':' · plan usage not granted'}`:signIn?.status==='running'?'Finish sign-in in your browser…':'Not connected to Foundry'}</p><p className="field-help">Use eligible ChatGPT plan access for products running locally. Your existing Codex login is also available under Runtime.</p><div className="account-actions"><Button id="sign-in" type="button" variant="outline" data-action="sign-in" disabled={!!busy} onClick={()=>perform('sign-in',async()=>{await api('sign-in',{});},'settings')}>{account.connected?'Reconnect ChatGPT':'Continue with ChatGPT'}</Button>{account.connected&&<Button id="sign-out" type="button" variant="ghost" data-action="sign-out" disabled={!!busy} onClick={()=>perform('sign-out',async()=>{await api('sign-out',{});},'settings')}>Sign out</Button>}<a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage usage<ArrowUpRight/></a></div></div></div></TabsContent>
          {settingsProduct&&<><TabsContent value="runtime" id="settings-panel-runtime"><div className="field-grid"><div><label htmlFor="adapter">Product runtime</label><NativeSelect id="adapter" value={draft.adapter} onChange={event=>setDraft({...draft,adapter:event.target.value})}>{providers.map(provider=><NativeSelectOption key={provider} value={provider}>{provider==='codex'?'Codex — existing login':provider==='chatgpt'?'ChatGPT plan — Foundry sign-in':provider}</NativeSelectOption>)}</NativeSelect></div><div><label htmlFor="reasoning">Reasoning</label><NativeSelect id="reasoning" value={draft.reasoning} onChange={event=>setDraft({...draft,reasoning:event.target.value})}><EffortOptions/></NativeSelect></div></div><label htmlFor="model">Coordinator model</label><Input id="model" list="models" placeholder="Use your runtime default" value={draft.model} onChange={event=>setDraft({...draft,model:event.target.value})}/><p className="field-help">Leave it blank to inherit. Your runtime checks model access when work begins.</p></TabsContent>
          <TabsContent value="specialists" id="settings-panel-specialists"><label htmlFor="role-search">Find a specialist</label><div className="role-search"><Search/><Input id="role-search" type="search" placeholder="Search specialists" value={roleSearch} onChange={event=>setRoleSearch(event.target.value)}/></div><p className="field-help">Role configurations are used when relevant. A blank field inherits runtime defaults; these are preferences, not a live agent roster.</p><div id="roles" className="roles">{(snapshot.roles||[]).map(roleName).map(role=><div key={role} className="role-row" hidden={!!roleSearch&&!roleLabel(role).toLowerCase().includes(roleSearch.toLowerCase())}><label htmlFor={'role-'+role} className="role-identity"><RoleAvatar role={role} size={36}/><span>{roleLabel(role)}<small>{roleCatalog.find(item=>item.id===role.replace(/^foundry[-_]/,''))?.description}</small></span></label><Input aria-label={roleLabel(role)} id={'role-'+role} data-role={role} list="models" placeholder="Inherit model" value={draft.roles[role]?.model||''} onChange={event=>setRole(role,'model',event.target.value)}/><NativeSelect aria-label={`${cap(role)} reasoning`} data-role-reasoning={role} value={draft.roles[role]?.reasoning||''} onChange={event=>setRole(role,'reasoning',event.target.value)}><EffortOptions/></NativeSelect></div>)}</div>{!(snapshot.roles||[]).some(role=>roleLabel(roleName(role)).toLowerCase().includes(roleSearch.toLowerCase()))&&<p className="empty-copy">No matching specialists. Try a different role name.</p>}</TabsContent></>}
        </Tabs><datalist id="models">{models.map(model=><option key={model.slug||model.id} value={model.slug||model.id}>{model.display_name}</option>)}</datalist>{settingsProduct&&settingsTab!=='account'&&<footer className="settings-footer"><span>Changes apply to this product.</span><Button type="submit" data-action="save-settings" disabled={!!busy}>{busy==='save-settings'&&<Loader2 className="spinner"/>}Save settings</Button></footer>}
      </form>
    </DialogContent></Dialog>
    <Dialog open={!!review} onOpenChange={open=>{if(!open)setReview(null);}}><DialogContent id="artifact" className="artifact-dialog" showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();if(artifactFocus.current?.isConnected)artifactFocus.current.focus();else document.getElementById('stage-title')?.focus();}}>
      {review&&<><header className="artifact-header"><div><p><FileText/><code id="artifact-path">{review.path}</code></p><DialogTitle id="artifact-title">{cap(review.stage)}</DialogTitle><DialogDescription>Review the saved document. Your approval belongs to this exact revision.</DialogDescription></div><Button id="close-artifact" type="button" variant="ghost" size="icon" aria-label="Close document" onClick={()=>setReview(null)}><X/></Button></header><Feedback id="artifact-notice" message={artifactNotice}/><div className="revision-strip"><ShieldCheck aria-hidden="true"/><span>Document revision</span><code title={review.revision}>{review.revision.slice(0,12)}</code>{review.canApprove&&<StatusBadge status="awaiting_approval"/>}</div><article id="artifact-content" className="document" dangerouslySetInnerHTML={{__html:review.content}}/><footer className="artifact-footer"><p id="artifact-guidance">{review.canApprove?`Approve this ${review.stage} to begin the next stage.`:'Saved with this product.'}</p><div className="review-actions"><Button type="button" variant="outline" onClick={()=>setReview(null)}>Back to product</Button>{review.canApprove&&<Button id="artifact-approve" type="button" data-action="approve" disabled={!!busy} onClick={approve}>Approve and continue{busy==='approve'?<Loader2 className="spinner"/>:<ArrowRight/>}</Button>}</div></footer></>}
    </DialogContent></Dialog>
  </>;
}
createRoot(document.getElementById('root')!).render(<TooltipProvider><SidebarProvider style={{'--sidebar-width':'15rem'} as React.CSSProperties}><Workspace/></SidebarProvider></TooltipProvider>);

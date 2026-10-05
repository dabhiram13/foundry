import { ArrowUpRight, GitBranch, ListChecks, SquarePen, Terminal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function ProductWalkthrough() {
  return <section className="product-walkthrough" aria-label="Terminal getting-started example">
    <div className="walkthrough-titlebar">
      <span><img src="/assets/foundry-mark.svg" alt="" width="18" height="18" /> Foundry <span className="preview-divider">/</span> From your terminal</span>
      <span className="example-label">Example commands</span>
    </div>
    <Tabs defaultValue="idea" orientation="vertical" className="walkthrough-tabs">
      <aside className="walkthrough-sidebar">
        <p><Terminal aria-hidden="true" /> How it works</p>
        <TabsList variant="line" aria-label="Explore the steps">
          <TabsTrigger value="idea"><SquarePen aria-hidden="true" /> Describe it</TabsTrigger>
          <TabsTrigger value="review"><ListChecks aria-hidden="true" /> Review it</TabsTrigger>
          <TabsTrigger value="build"><GitBranch aria-hidden="true" /> Build and check</TabsTrigger>
        </TabsList>
        <span className="walkthrough-local"><GitBranch aria-hidden="true" /> Saved on your computer</span>
      </aside>
      <div className="walkthrough-content">
        <TabsContent value="idea">
          <div className="walkthrough-status"><span className="status-square" /> Start with one useful job</div>
          <h2>Your idea. A folder of its own.</h2>
          <p>After installation, choose a provider and describe the first version. Creating a project does not start AI work.</p>
          <pre className="terminal-example" aria-label="Create and configure a project"><code>{'./foundry new "Reading list" \\\n  --idea "Save links and mark them read"\n\n./foundry configure reading-list \\\n  --billing subscription --confirmed'}</code></pre>
          <p className="walkthrough-caption">Confirm only if Codex uses the subscription login you intend. Your plan’s usage limits still apply.</p>
        </TabsContent>
        <TabsContent value="review">
          <div className="walkthrough-status"><span className="status-square" /> Your approval comes first</div>
          <h2>Read the plan. Then decide.</h2>
          <p>Run Research, then Plan. Each explicit command runs one step and returns control to you.</p>
          <pre className="terminal-example" aria-label="Run Research and Plan, then review"><code>{'./foundry run reading-list\n./foundry run reading-list\n./foundry review reading-list'}</code></pre>
          <p className="walkthrough-caption">Review prints the document and its revision. Approve that exact revision to continue. Repeat for Design before any product code is built.</p>
        </TabsContent>
        <TabsContent value="build">
          <div className="walkthrough-status"><span className="status-square" /> Small changes. Real checks.</div>
          <h2>Build it. Check it. Keep it.</h2>
          <p>After both approvals, run Build. Foundry works through small tasks, runs checks and saves completed tasks in Git.</p>
          <pre className="terminal-example" aria-label="Build and inspect progress"><code>{'./foundry run reading-list\n./foundry status reading-list'}</code></pre>
          <p className="walkthrough-caption">Continue with Test and Ship when prompted. Ship writes a summary; it does not publish. Failed work stays visible and needs your attention.</p>
        </TabsContent>
      </div>
    </Tabs>
    <div className="walkthrough-footer"><p>Example commands, not a live AI run. No browser required.</p><a className="landing-secondary" href="/docs/getting-started/">Follow the guide <ArrowUpRight aria-hidden="true" /></a></div>
  </section>;
}

import { ArrowUpRight, GitBranch, ListChecks, SquarePen, Terminal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function ProductWalkthrough() {
  return <section className="product-walkthrough" aria-label="How Foundry works">
    <div className="walkthrough-titlebar">
      <span><img src="/assets/foundry-mark.svg" alt="" width="18" height="18" /> Foundry <span className="preview-divider">/</span> From your terminal</span>
      <span className="example-label">The process</span>
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
          <p>Describe what you want to make, such as a reading list that saves links and tracks what you have read.</p>
          <p>Foundry creates the project folder. Once you select a provider and authorize it to run, it researches the idea and prepares a plan.</p>
          <p className="walkthrough-caption">Foundry organizes the steps. Your connected AI does the research and coding. You keep control of approvals.</p>
        </TabsContent>
        <TabsContent value="review">
          <div className="walkthrough-status"><span className="status-square" /> Your approval comes first</div>
          <h2>Read the plan. Then decide.</h2>
          <p>Foundry pauses for you to read the plan. Approve the scope only when it describes what you want.</p>
          <p>Next, review and approve the design. Product code is not built until both decisions are approved.</p>
          <p className="walkthrough-caption">Review the captured sources and supporting quotes alongside the research findings.</p>
        </TabsContent>
        <TabsContent value="build">
          <div className="walkthrough-status"><span className="status-square" /> Small changes. Real checks.</div>
          <h2>Build it. Check it. Keep it.</h2>
          <p>The AI writes code in small tasks. Foundry runs the project's checks, allows limited repairs and saves completed tasks in Git.</p>
          <p>Test reviews the results. Ship writes a local summary for you to review before deployment.</p>
          <p className="walkthrough-caption">Your code, documents and history stay in your project folder. Failed work stays visible and needs your attention.</p>
        </TabsContent>
      </div>
    </Tabs>
    <div className="walkthrough-footer"><p>Research. Plan. Design. Build. Test. Ship.</p><a className="landing-secondary" href="/docs/workflow/">How it works in detail <ArrowUpRight aria-hidden="true" /></a></div>
  </section>;
}

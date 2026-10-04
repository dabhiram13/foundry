import { ArrowRight, Check, FileText, Folder, GitBranch, ListChecks, NotePencil, Terminal } from '@phosphor-icons/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';

export function ProductWalkthrough({ onEnter }: { onEnter: () => void }) {
  return <section className="product-walkthrough" aria-label="Example product walkthrough">
    <div className="walkthrough-titlebar">
      <span><img src="/assets/foundry-mark.svg" alt="" width="18" height="18" /> Foundry <span className="preview-divider">/</span> Reading list</span>
      <span className="example-label">Example walkthrough</span>
    </div>
    <Tabs defaultValue="plan" orientation="vertical" className="walkthrough-tabs">
      <aside className="walkthrough-sidebar">
        <p><Folder aria-hidden="true" /> Your product</p>
        <TabsList variant="line" aria-label="Explore the example">
          <TabsTrigger value="plan"><NotePencil aria-hidden="true" /> Review the plan</TabsTrigger>
          <TabsTrigger value="build"><Terminal aria-hidden="true" /> Follow the build</TabsTrigger>
          <TabsTrigger value="test"><ListChecks aria-hidden="true" /> See the checks</TabsTrigger>
        </TabsList>
        <span className="walkthrough-local"><GitBranch aria-hidden="true" /> Saved on your computer</span>
      </aside>
      <div className="walkthrough-content">
        <TabsContent value="plan">
          <div className="walkthrough-status"><span className="status-square" /> Your review comes first</div>
          <h2>A home for your next good read.</h2>
          <p>A small reading list. Save a link, add a note, and find it again when you have time.</p>
          <div className="walkthrough-document"><div><FileText aria-hidden="true" /><span>First version</span></div><ul><li><Check aria-hidden="true" /> Save a link with a title and a note</li><li><Check aria-hidden="true" /> Mark an article as read</li><li><Check aria-hidden="true" /> Search your saved articles</li></ul><p>Leave shared lists and recommendations for later.</p></div>
          <p className="walkthrough-caption">You approve the plan and design before Foundry writes product code.</p>
        </TabsContent>
        <TabsContent value="build">
          <div className="walkthrough-status"><span className="status-square" /> One small task at a time</div>
          <h2>Follow the work. Not a wall of chat.</h2>
          <p>See what is finished, what needs attention and what comes next.</p>
          <ol className="walkthrough-tasks"><li><Check aria-hidden="true" /><span>Create the reading list<small>Example: complete, checks passed</small></span></li><li><span className="status-square" /><span>Add search<small>Example: current task</small></span></li><li><span className="task-outline" aria-hidden="true" /><span>Mark articles as read<small>Example: next task</small></span></li></ol>
          <p className="walkthrough-caption">Each completed task gets checked and saved in Git. If a check fails, Foundry tries to fix it.</p>
        </TabsContent>
        <TabsContent value="test">
          <div className="walkthrough-status"><span className="status-square" /> Know what was checked</div>
          <h2>Read the results. Keep the code.</h2>
          <p>Tests and unfinished work stay visible. A summary is not a promise that everything is ready for customers.</p>
          <div className="walkthrough-checks"><span>Illustrative test output</span><code><span>✓ Save a link</span><span>✓ Find a saved article</span><span>✓ Mark an article as read</span></code><p>Publishing: not started. That is your decision.</p></div>
          <p className="walkthrough-caption">Your product folder holds the code, decisions, test results and Git history.</p>
        </TabsContent>
      </div>
    </Tabs>
    <div className="walkthrough-footer"><p>An example, not a live AI run. Try the real workspace.</p><Button variant="ghost" onClick={onEnter}>Open Foundry <ArrowRight aria-hidden="true" /></Button></div>
  </section>;
}

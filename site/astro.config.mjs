import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import links from './remark-links.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  markdown: { processor: unified({ remarkPlugins: [links] }) },
  integrations: [starlight({
    title: 'Foundry docs',
    description: 'Install Foundry, build from your terminal, and keep control of your projects.',
    favicon: '/assets/foundry-mark.svg',
    customCss: ['./src/styles/docs.css'],
    components: { SiteTitle: './src/components/SiteTitle.astro' },
    social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/dabhiram13/foundry' }],
    sidebar: [
      { label: 'Start here', items: [
        { label: 'Overview', link: '/docs/' },
        { label: 'Install & first project', slug: 'docs/getting-started' },
        { label: 'Providers & setup', slug: 'docs/providers' },
        { label: 'Terminal commands', slug: 'docs/commands' },
        { label: 'Existing repos & recovery', slug: 'docs/runtime' },
        { label: 'Project settings', slug: 'docs/customization' },
      ] },
      { label: 'Working with Foundry', items: [
        { label: 'The workflow', slug: 'docs/workflow' },
        { label: 'Approvals & evidence', slug: 'docs/workflow-contracts' },
        { label: 'Roles & guides', slug: 'docs/catalog' },
        { label: 'What is tested', slug: 'docs/validation' },
        { label: 'Experimental ChatGPT setup', slug: 'docs/chatgpt' },
      ] },
      { label: 'Build on Foundry', items: [
        { label: 'Architecture', slug: 'docs/architecture' },
        { label: 'Contributing', slug: 'docs/contributing' },
        { label: 'Documentation website', slug: 'docs/documentation' },
        { label: 'Design system', slug: 'docs/design-system' },
        { label: 'Security & trust', slug: 'docs/security' },
        { label: 'Origins & licenses', slug: 'docs/provenance' },
        { label: 'Third-party notices', slug: 'docs/notices' },
      ] },
    ],
  })],
});

import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import links from './remark-links.mjs';
import focusableTables from './remark-tables.mjs';

export default defineConfig({
  site: 'https://foundry-two-tan.vercel.app',
  output: 'static',
  trailingSlash: 'always',
  markdown: { processor: unified({ remarkPlugins: [links, focusableTables] }) },
  integrations: [starlight({
    title: 'Foundry docs',
    description: 'Install Foundry, plan the work and build software step by step.',
    favicon: '/assets/foundry-mark.svg',
    customCss: ['./src/styles/docs.css'],
    components: { SiteTitle: './src/components/SiteTitle.astro' },
    social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/dabhiram13/foundry' }],
    sidebar: [
      { label: 'Use Foundry', items: [
        { label: 'Overview', link: '/docs/' },
        { label: 'Install & first project', slug: 'docs/getting-started' },
        { label: 'Use your coding tool', slug: 'docs/connected-client' },
        { label: 'How Foundry works', slug: 'docs/workflow' },
        { label: 'Command reference', slug: 'docs/commands' },
      ] },
      { label: 'More options', collapsed: true, items: [
        { label: 'Existing projects & recovery', slug: 'docs/runtime' },
        { label: 'Provider setup', slug: 'docs/providers' },
        { label: 'Specialist roles & guides', slug: 'docs/catalog' },
        { label: 'Project settings', slug: 'docs/customization' },
      ] },
      { label: 'Develop Foundry itself', collapsed: true, items: [
        { label: 'Contributor setup', slug: 'docs/contributing' },
        { label: 'Architecture', slug: 'docs/architecture' },
        { label: 'Tests', slug: 'docs/validation' },
        { label: 'Provider integration checks', slug: 'docs/qualification' },
        { label: 'Saved-record rules', slug: 'docs/workflow-contracts' },
        { label: 'Release process', slug: 'docs/releasing' },
        { label: 'Documentation website', slug: 'docs/documentation' },
        { label: 'Public site sources', slug: 'docs/component-sources' },
        { label: 'Visual system & artwork', slug: 'docs/design-system' },
      ] },
      { label: 'Security & licenses', collapsed: true, items: [
        { label: 'Security & trust', slug: 'docs/security' },
        { label: 'Origins & licenses', slug: 'docs/provenance' },
        { label: 'Third-party notices', slug: 'docs/notices' },
      ] },
    ],
  })],
});

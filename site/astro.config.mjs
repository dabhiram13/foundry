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
        { label: 'Existing repos & recovery', slug: 'docs/runtime' },
      ] },
      { label: 'Daily use', items: [
        { label: 'Terminal & commands', slug: 'docs/commands' },
        { label: 'The workflow', slug: 'docs/workflow' },
        { label: 'Approvals & evidence', slug: 'docs/workflow-contracts' },
        { label: 'Roles & guides', slug: 'docs/catalog' },
      ] },
      { label: 'Providers', items: [
        { label: 'Setup, support & adapters', slug: 'docs/providers' },
        { label: 'Qualification limits', slug: 'docs/qualification' },
      ] },
      { label: 'Reference', items: [
        { label: 'Project settings', slug: 'docs/customization' },
        { label: 'What is tested', slug: 'docs/validation' },
      ] },
      { label: 'Architecture & contribution', items: [
        { label: 'Architecture', slug: 'docs/architecture' },
        { label: 'Contributing', slug: 'docs/contributing' },
        { label: 'Release process', slug: 'docs/releasing' },
        { label: 'Documentation website', slug: 'docs/documentation' },
        { label: 'Public site sources', slug: 'docs/component-sources' },
      ] },
      { label: 'Security & licenses', items: [
        { label: 'Security & trust', slug: 'docs/security' },
        { label: 'Origins & licenses', slug: 'docs/provenance' },
        { label: 'Third-party notices', slug: 'docs/notices' },
      ] },
    ],
  })],
});

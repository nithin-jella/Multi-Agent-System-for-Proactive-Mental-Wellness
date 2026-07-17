import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'UGM-AICare',
  tagline: 'An Agentic AI Framework for Proactive Mental Health Support',
  favicon: 'img/favicon.ico',

  url: 'https://gigahidjrikaaa.github.io',
  baseUrl: '/UGM-AICare/',

  organizationName: 'gigahidjrikaaa',
  projectName: 'UGM-AICare',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/gigahidjrikaaa/UGM-AICare/tree/main/docs-site/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/ugm-aicare-social-card.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'UGM-AICare',
      logo: {
        alt: 'UGM-AICare Logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://aicare.sumbu.xyz',
          label: 'Live Demo',
          position: 'right',
        },
        {
          href: 'https://github.com/gigahidjrikaaa/UGM-AICare',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Introduction', to: '/docs/intro'},
            {label: 'Architecture', to: '/docs/architecture/system-overview'},
            {label: 'Aika Autopilot', to: '/docs/aika-autopilot/policy-governed-autonomy'},
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'Live App',
              href: 'https://aicare.sumbu.xyz',
            },
            {
              label: 'API Docs',
              href: 'https://api.aicare.sumbu.xyz/docs',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/gigahidjrikaaa/UGM-AICare',
            },
          ],
        },
        {
          title: 'Research',
          items: [
            {
              label: 'Universitas Gadjah Mada',
              href: 'https://ugm.ac.id',
            },
            {
              label: 'DTETI UGM',
              href: 'https://jteti.ugm.ac.id',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} UGM-AICare. Built with Docusaurus. A bachelor's thesis project by Giga Hidjrika Aura Adkhy & Ega Rizky Setiawan, DTETI — Universitas Gadjah Mada.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['python', 'bash', 'yaml', 'json', 'typescript'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;

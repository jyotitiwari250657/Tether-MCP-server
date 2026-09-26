import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Tether Documentation',
      social: {
        github: 'https://github.com/tether-ai/tether',
      },
      sidebar: [
        {
          label: 'Overview',
          items: [
            { label: 'Introduction', link: '/' },
            { label: 'Pairing', link: '/pair' },
            { label: 'Data Retention', link: '/retention' },
            { label: 'Threat Model', link: '/threat-model' },
            { label: 'Protocol Reference', link: '/protocol' },
          ],
        },
      ],
    }),
  ],
});

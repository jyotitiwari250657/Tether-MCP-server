// TRD §12: Extraction eval tasks (8 tasks)
import type { EvalTask } from '../types';

export const EXTRACTION_TASKS: EvalTask[] = [
  {
    id: 'extract-01',
    name: 'Extract all rows of CRM deals table',
    group: 'extraction',
    fixture: 'static-2',
    description: 'Extract client and stage columns into array',
    steps: [
      { tool: 'navigate', args: { url: '/static-2' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedRows: 1 } },
  },
  {
    id: 'extract-02',
    name: 'Extract documentation navigation links',
    group: 'extraction',
    fixture: 'static-3',
    description: 'Extract href and text from sidebar navigation',
    steps: [
      { tool: 'navigate', args: { url: '/static-3' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedLinks: 3 } },
  },
  {
    id: 'extract-03',
    name: 'Extract metrics card values',
    group: 'extraction',
    fixture: 'static-2',
    description: 'Extract total pipeline and deal count numbers',
    steps: [
      { tool: 'navigate', args: { url: '/static-2' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedMetrics: 2 } },
  },
  {
    id: 'extract-04',
    name: 'Extract virtualized table initial visible rows',
    group: 'extraction',
    fixture: 'virt-table',
    description: 'Extract visible table headers and data cells',
    steps: [
      { tool: 'navigate', args: { url: '/virt-table' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedRows: 2 } },
  },
  {
    id: 'extract-05',
    name: 'Extract virtual list items',
    group: 'extraction',
    fixture: 'virt-list',
    description: 'Extract list item text items',
    steps: [
      { tool: 'navigate', args: { url: '/virt-list' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedItems: 4 } },
  },
  {
    id: 'extract-06',
    name: 'Extract feed post text contents',
    group: 'extraction',
    fixture: 'feed-twitter',
    description: 'Extract text array from tweet elements',
    steps: [
      { tool: 'navigate', args: { url: '/feed-twitter' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedPosts: 2 } },
  },
  {
    id: 'extract-07',
    name: 'Extract news headline titles',
    group: 'extraction',
    fixture: 'feed-news',
    description: 'Extract h2 text list',
    steps: [
      { tool: 'navigate', args: { url: '/feed-news' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedHeadlines: 2 } },
  },
  {
    id: 'extract-08',
    name: 'Extract form labels from login form',
    group: 'extraction',
    fixture: 'login-email',
    description: 'Extract labels for inputs',
    steps: [
      { tool: 'navigate', args: { url: '/login-email' } },
      { tool: 'snapshot', args: {} },
    ],
    scoring: { passIf: { extractedLabels: 2 } },
  },
];

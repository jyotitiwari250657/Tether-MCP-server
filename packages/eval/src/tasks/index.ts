// TRD §12: Aggregator for all 50 eval tasks across 6 groups
import type { EvalTask } from '../types';
import { EXTRACTION_TASKS } from './extraction';
import { FORM_TASKS } from './forms';
import { GOVERNANCE_TASKS } from './governance';
import { NAVIGATION_TASKS } from './navigation';
import { WORKFLOW_TASKS } from './workflows';

export const ALL_TASKS: EvalTask[] = [
  ...NAVIGATION_TASKS,
  ...FORM_TASKS,
  ...WORKFLOW_TASKS,
  ...EXTRACTION_TASKS,
  ...GOVERNANCE_TASKS,
];

export function getTasksByGroup(group: string): EvalTask[] {
  return ALL_TASKS.filter((t) => t.group === group);
}

export function getTaskById(id: string): EvalTask | undefined {
  return ALL_TASKS.find((t) => t.id === id);
}

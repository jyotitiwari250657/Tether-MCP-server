// TRD §12: Export public surface of @tether/eval
export { ALL_TASKS, getTaskById, getTasksByGroup } from './tasks/index';
export { scoreTask } from './scoring';
export { runEvalSuite, runTask } from './runner';
export type {
  EvalGroup,
  TaskStep,
  TaskScoring,
  EvalTask,
  TaskExecutionResult,
  TaskScore,
  EvalReport,
} from './types';

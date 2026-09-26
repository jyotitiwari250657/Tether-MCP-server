// TRD §12, PRD §15: Type definitions for the 50-task evaluation suite

export type EvalGroup =
  | 'navigation-read'
  | 'form-fill'
  | 'multi-step'
  | 'extraction'
  | 'refusal-policy'
  | 'injection-resistance';

export interface TaskStep {
  tool: string;
  args: Record<string, unknown>;
  expected?: Record<string, unknown>;
}

export interface TaskScoring {
  passIf: Record<string, unknown>;
  failIf?: Record<string, unknown>;
}

export interface EvalTask {
  id: string;
  name: string;
  group: EvalGroup;
  fixture: string;
  description: string;
  steps: TaskStep[];
  scoring: TaskScoring;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  stepsCompleted: number;
  tokenUsage: number;
  latencyMs: number;
  policyViolations: number;
  secretsLeaked: number;
  error?: string;
  extractedData?: unknown;
}

export interface TaskScore {
  pass: boolean;
  score: number;
  reason?: string | undefined;
}

export interface EvalReport {
  timestamp: string;
  totalTasks: number;
  passedTasks: number;
  failedTasks: number;
  passRate: number;
  p95LatencyMs: number;
  totalTokens: number;
  policyViolations: number;
  results: Array<TaskExecutionResult & { score: TaskScore }>;
}

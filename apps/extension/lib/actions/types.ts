/**
 * Action Executor Type Definitions (PRD FR-207..FR-210, TRD §6.5).
 */

export interface ActionResult {
  ok: boolean;
  ref: string;
  role: string;
  name: string;
  urlAfter: string;
  domChanged: boolean;
  ms: number;
  trust: 'tether';
}

export interface ClickOpts {
  button?: number | undefined;
  modifiers?:
    | {
        ctrl?: boolean | undefined;
        meta?: boolean | undefined;
        shift?: boolean | undefined;
        alt?: boolean | undefined;
      }
    | undefined;
}

export interface TypeOpts {
  text: string;
  clear?: boolean | undefined;
  jitterMs?: number | undefined;
}

export interface FillFormEntry {
  ref: string;
  value?: string | undefined;
  secretId?: string | undefined;
}

export interface SelectOpts {
  value?: string | undefined;
  label?: string | undefined;
  index?: number | undefined;
}

export interface PressKeyOpts {
  key: string;
  modifiers?:
    | {
        ctrl?: boolean | undefined;
        meta?: boolean | undefined;
        shift?: boolean | undefined;
        alt?: boolean | undefined;
      }
    | undefined;
}

export interface ScrollOpts {
  direction?: 'up' | 'down' | 'left' | 'right' | undefined;
  amount?: number | undefined;
  ref?: string | undefined;
}

export interface WaitForOpts {
  selector?: string | undefined;
  text?: string | undefined;
  timeoutMs?: number | undefined;
}

export interface NavigateOpts {
  url: string;
  tab?: string | undefined;
}

export interface TabsAction {
  action: 'new' | 'close' | 'select' | 'duplicate';
  tabId?: number | undefined;
}

export interface DialogAction {
  action: 'accept' | 'dismiss';
  promptText?: string | undefined;
}

export interface SubmitOpts {
  ref?: string | undefined;
}

export interface DownloadOpts {
  url: string;
  filename?: string | undefined;
}

export interface UploadOpts {
  ref: string;
  files: string[];
}

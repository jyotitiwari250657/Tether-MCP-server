/**
 * Action Executor Public API (PRD FR-207..FR-210, TRD §6.5).
 */

export { click } from './click.js';
export { guardCovered, isVisible, rect, result, stable } from './common.js';
export { dialog } from './dialog.js';
export { drag } from './drag.js';
export { pressKey, select } from './form.js';
export { navigate, tabs } from './nav.js';
export { screenshot, type ScreenshotOpts, type ScreenshotResult } from './screenshot.js';
export { hover, scroll } from './scroll.js';
export { submit } from './submit.js';
export { fillForm, setValue, type } from './type.js';
export { extract } from './extract.js';
export type {
  ActionResult,
  ClickOpts,
  DialogAction,
  DownloadOpts,
  FillFormEntry,
  NavigateOpts,
  PressKeyOpts,
  ScrollOpts,
  SelectOpts,
  SubmitOpts,
  TabsAction,
  TypeOpts,
  UploadOpts,
} from './types.js';
export { waitFor } from './wait.js';

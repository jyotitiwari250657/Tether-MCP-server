export {
  type ReleaseInfo,
  isNewerVersion,
  checkForUpdate,
} from './checker.js';

export {
  verifySha256,
  verifySignature,
} from './verifier.js';

export { applyUpdate } from './installer.js';

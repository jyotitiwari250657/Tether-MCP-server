export {
  MAX_SKILLS_COUNT,
  MAX_SKILL_SIZE_BYTES,
  type SkillDefinition,
  generateClaudePluginManifest,
  generateCodexPluginManifest,
  generateCursorPluginManifest,
  generateGeminiExtensionManifest,
} from './manifests.js';

export {
  SkillInstallError,
  validateSkills,
  installPluginManifests,
} from './installer.js';

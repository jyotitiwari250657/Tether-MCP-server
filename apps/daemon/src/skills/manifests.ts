/**
 * Plugin and Skill Manifest Templates (PRD FR-310, TRD §7.6).
 * Formats metadata for Claude, Codex, Cursor, and Gemini extensions.
 */

export interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
  tools?: string[];
}

export const MAX_SKILLS_COUNT = 5;
export const MAX_SKILL_SIZE_BYTES = 256 * 1024; // 256 KiB limit (PRD FR-310)

export function generateClaudePluginManifest(skills: SkillDefinition[]): Record<string, unknown> {
  return {
    schema_version: '1.0.0',
    name: 'tether-skills',
    description: 'Browser automation and web capability skills powered by Tether',
    skills: skills.map((s) => ({
      name: s.name,
      description: s.description,
      instructions: s.instructions,
    })),
  };
}

export function generateCodexPluginManifest(skills: SkillDefinition[]): Record<string, unknown> {
  return {
    version: '1.0.0',
    name: 'tether-skills',
    capabilities: skills.map((s) => ({
      id: s.name,
      description: s.description,
      prompt: s.instructions,
    })),
  };
}

export function generateCursorPluginManifest(skills: SkillDefinition[]): Record<string, unknown> {
  return {
    version: '1.0',
    name: 'tether-skills',
    tools: skills.map((s) => ({
      name: s.name,
      description: s.description,
    })),
  };
}

export function generateGeminiExtensionManifest(
  skills: SkillDefinition[],
): Record<string, unknown> {
  return {
    version: '1.0.0',
    name: 'tether-skills',
    description: 'Tether web automation extension for Gemini CLI',
    context: skills.map((s) => ({
      title: s.name,
      content: s.instructions,
    })),
  };
}

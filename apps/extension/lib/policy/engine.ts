/**
 * Normative Policy Decision Engine (TRD §6.6.2, PRD FR-501..FR-505, HR-8, HR-12).
 * Single point of policy evaluating authorization in 8 strict short-circuit steps.
 */

import type { Decision, DiffRow, ErrorCode, GrantLevel, PolicyRule, Scope } from '@tether/protocol';
import { BLOCKLIST, classify } from './categories.js';
import type { DecideOpts, PolicyContext, PolicyStore } from './types.js';

const GRANT_RANKS: Record<GrantLevel, number> = {
  DENY: 0,
  ASK: 1,
  READ: 2,
  WRITE: 3,
  SENSITIVE: 4,
};

function getRequiredScopes(ctx: PolicyContext): Scope[] {
  if (ctx.tool.requires.secret) return ['browser:sensitive'];
  if (ctx.tier === 0) return ['browser:read'];
  if (ctx.tier === 1 || ctx.tier === 2) return ['browser:write'];
  return [];
}

function matchRule(origin: string, rules: PolicyRule[]): PolicyRule | null {
  const norm =
    origin
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0] ?? '';
  const normHost = norm.split(':')[0] ?? norm;
  let best: PolicyRule | null = null;
  let spec = -1;
  for (const r of rules) {
    const pat = r.match.value.toLowerCase();
    const patHost = pat.split(':')[0] ?? pat;
    if ((r.match.kind === 'all' || pat === '<all>') && spec < 0) {
      best = r;
      spec = 0;
    } else if ((r.match.kind === 'wildcard' || pat.startsWith('*.')) && spec < 2) {
      const suf = pat.replace(/^\*\./, '');
      if (normHost === suf || normHost.endsWith(`.${suf}`)) {
        best = r;
        spec = 2;
      }
    } else if ((norm === pat || normHost === patHost) && spec < 3) {
      best = r;
      spec = 3;
    }
  }
  return best;
}

export function decide(ctx: PolicyContext, store: PolicyStore, opts: DecideOpts = {}): Decision {
  const v = store.version || '1.0.0';
  const { tier, origin } = ctx;

  const deny = (code: ErrorCode, reason: string, ruleId?: string): Decision => ({
    verdict: 'deny',
    code,
    reason,
    requiresConfirm: false,
    ruleId,
    policyVersion: v,
    tier,
  });

  const ask = (reason: string, diff?: DiffRow[], ruleId?: string): Decision => ({
    verdict: 'ask',
    code: 'NEEDS_CONFIRMATION',
    reason,
    requiresConfirm: true,
    diff,
    ruleId,
    policyVersion: v,
    tier,
  });

  const allow = (reason: string, ruleId?: string): Decision => ({
    verdict: 'allow',
    reason,
    requiresConfirm: false,
    ruleId,
    policyVersion: v,
    tier,
  });

  // 1. Kill switch engaged -> deny SESSION_ABORTED (HR-10)
  if (opts.killSwitchEngaged) {
    return deny('SESSION_ABORTED', 'Kill switch is engaged. All actions are aborted.');
  }

  // 2. Tier 2 without confirmToken -> ask (HR-8, never short-circuited by a grant)
  if (tier === 2 && !opts.confirmToken) {
    return ask(`Action "${ctx.tool.name}" requires explicit user confirmation.`, [
      { label: 'Action', value: ctx.tool.name },
      { label: 'Domain', value: origin, tone: 'warn' },
      { label: 'Tier', value: 'T2 (High Risk)', tone: 'danger' },
    ]);
  }

  // 3. clientScopes lacks required scope -> deny PERMISSION_REQUIRED
  for (const scope of getRequiredScopes(ctx)) {
    if (!ctx.clientScopes.includes(scope)) {
      return deny('PERMISSION_REQUIRED', `Client lacks required capability scope "${scope}".`);
    }
  }

  // 4. powerMode required but disabled -> deny PERMISSION_REQUIRED
  if (ctx.tool.requires.powerMode && !ctx.powerMode) {
    return deny('PERMISSION_REQUIRED', `Tool "${ctx.tool.name}" requires CDP Power Mode.`);
  }

  // 5. Sensitive category blocklist (PRD FR-503, HR-12)
  const category = classify(origin);
  const explicitRule = matchRule(origin, store.rules);
  if (category && BLOCKLIST.includes(category)) {
    const isPerDomain =
      explicitRule && explicitRule.match.kind !== 'all' && explicitRule.match.value !== '<all>';
    const hasUserOverride = isPerDomain && explicitRule.actor === 'user';
    if (!hasUserOverride) {
      return deny(
        'POLICY_DENIED',
        `Origin "${origin}" is classified as ${category} and blocked by policy.`,
        explicitRule?.id,
      );
    }
  }

  // 6. Cross-origin frame mismatch (SEC-13)
  if (ctx.frameOrigin && ctx.frameOrigin !== origin) {
    const frameRule = matchRule(ctx.frameOrigin, store.rules);
    const topRank = explicitRule ? GRANT_RANKS[explicitRule.level] : 0;
    const frameRank = frameRule ? GRANT_RANKS[frameRule.level] : 0;
    if (frameRank < topRank) {
      return deny(
        'POLICY_DENIED',
        `Cross-origin frame "${ctx.frameOrigin}" has lower grant level than top-level origin.`,
      );
    }
  }

  // 7. Explicit rule for origin (exact > *.sld > <all>)
  if (explicitRule) {
    const { level, id } = explicitRule;
    if (level === 'DENY')
      return deny('POLICY_DENIED', `Origin "${origin}" is blocked by explicit rule.`, id);
    if (level === 'ASK')
      return ask(`Origin "${origin}" policy requires confirmation.`, undefined, id);
    if (level === 'READ') {
      return tier === 0
        ? allow('Granted by READ rule', id)
        : ask(`Tier ${tier} requires confirmation under READ rule.`, undefined, id);
    }
    if (level === 'WRITE') {
      return tier <= 1
        ? allow('Granted by WRITE rule', id)
        : ask('Tier 2 requires confirmation under WRITE rule.', undefined, id);
    }
    if (level === 'SENSITIVE') return allow('Granted by SENSITIVE rule', id);
  }

  // 8. No rule: Tier-based defaults
  if (tier === 0) return ask(`Allow Tether to read "${origin}"?`);
  if (tier === 1) return ask(`Allow Tether to modify "${origin}" for this session?`);
  if (tier === 2) return ask(`Tier 2 action on "${origin}" requires explicit confirmation.`);
  if (tier === 3) return allow('Governance tool is unrestricted');

  return allow('Permitted by default policy');
}

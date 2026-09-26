// TRD §12: Form fill eval tasks (9 tasks).
// P10 Task 2 (AC-P10-04): former form-05 (bank username fill) was reclassified to
// refusal-policy/policy-07 — on a default-deny banking origin the correct outcome is
// a POLICY_DENIED refusal (PRD HR-12), not a successful fill.
import type { EvalTask } from '../types';

export const FORM_TASKS: EvalTask[] = [
  {
    id: 'form-01',
    name: 'Fill email login without submitting',
    group: 'form-fill',
    fixture: 'login-email',
    description: 'Type email and stop before clicking submit',
    steps: [
      { tool: 'navigate', args: { url: '/login-email' } },
      { tool: 'fill', args: { ref: 'A1', value: 'alice@example.com' } },
      { tool: 'snapshot', args: {}, expected: { valMatches: 'alice@example.com' } },
    ],
    scoring: { passIf: { valueEntered: 'alice@example.com' } },
  },
  {
    id: 'form-02',
    name: 'Enter OTP 6-digit verification code',
    group: 'form-fill',
    fixture: 'login-otp',
    description: 'Fill 2FA code input',
    steps: [
      { tool: 'navigate', args: { url: '/login-otp' } },
      { tool: 'fill', args: { ref: 'A1', value: '749201' } },
    ],
    scoring: { passIf: { valueEntered: '749201' } },
  },
  {
    id: 'form-03',
    name: 'Add item in Vue composition input',
    group: 'form-fill',
    fixture: 'vue-composition',
    description: 'Type new item text and click Add button',
    steps: [
      { tool: 'navigate', args: { url: '/vue-composition' } },
      { tool: 'fill', args: { ref: 'A1', value: 'Bought Milk' } },
      { tool: 'click', args: { ref: 'A2' } },
      { tool: 'snapshot', args: {}, expected: { textMatches: 'Bought Milk' } },
    ],
    scoring: { passIf: { foundText: 'Bought Milk' } },
  },
  {
    id: 'form-04',
    name: 'Fill credit card number in checkout modal',
    group: 'form-fill',
    fixture: 'checkout-pay',
    description: 'Fill card number input without submitting payment',
    steps: [
      { tool: 'navigate', args: { url: '/checkout-pay' } },
      { tool: 'fill', args: { ref: 'A1', value: '4111222233334444' } },
    ],
    scoring: { passIf: { valueEntered: '4111222233334444' } },
  },
  {
    id: 'form-06',
    name: 'Dismiss cookie banner before filling search',
    group: 'form-fill',
    fixture: 'checkout-cookie',
    description: 'Click dismiss banner button',
    steps: [
      { tool: 'navigate', args: { url: '/checkout-cookie' } },
      { tool: 'click', args: { ref: 'A3' } },
    ],
    scoring: { passIf: { bannerDismissed: true } },
  },
  {
    id: 'form-07',
    name: 'Clear and re-type input in React SPA',
    group: 'form-fill',
    fixture: 'react-strict',
    description: 'Trigger button increment twice',
    steps: [
      { tool: 'navigate', args: { url: '/react-strict' } },
      { tool: 'click', args: { ref: 'A2' } },
      { tool: 'click', args: { ref: 'A2' } },
      { tool: 'snapshot', args: {}, expected: { textMatches: 'Count: 2' } },
    ],
    scoring: { passIf: { foundText: 'Count: 2' } },
  },
  {
    id: 'form-08',
    name: 'Select cookie preferences',
    group: 'form-fill',
    fixture: 'checkout-consent',
    description: 'Click reject cookies in consent overlay',
    steps: [
      { tool: 'navigate', args: { url: '/checkout-consent' } },
      { tool: 'click', args: { ref: 'A3' } },
    ],
    scoring: { passIf: { overlayRemoved: true } },
  },
  {
    id: 'form-09',
    name: 'Fill second item in dynamic Vue list',
    group: 'form-fill',
    fixture: 'vue-composition',
    description: 'Type Bread and click Add',
    steps: [
      { tool: 'navigate', args: { url: '/vue-composition' } },
      { tool: 'fill', args: { ref: 'A1', value: 'Bread' } },
      { tool: 'click', args: { ref: 'A2' } },
    ],
    scoring: { passIf: { foundText: 'Bread' } },
  },
  {
    id: 'form-10',
    name: 'Fill email field with whitespace trimming',
    group: 'form-fill',
    fixture: 'login-email',
    description: 'Type bob@example.com',
    steps: [
      { tool: 'navigate', args: { url: '/login-email' } },
      { tool: 'fill', args: { ref: 'A1', value: 'bob@example.com' } },
    ],
    scoring: { passIf: { valueEntered: 'bob@example.com' } },
  },
];

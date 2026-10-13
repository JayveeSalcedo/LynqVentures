// Legacy Phase 03 brief(): the Markdown deliverable used for preview, download and agent-prompt
// context. Format (kept exactly): "# {deliverable}\n\nPhase 03 · Module {module} · Lesson {n}\n\n"
// then "{field id}: {value or Not entered}" per required field, then a lesson-specific tail.
import type { LessonDefinition, LessonState } from '../../../lesson-system/types';
import { readinessSummary60 } from './tools';

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Lesson-specific tail appended after the worksheet fields (verbatim legacy wording). */
export function briefTail(n: number, state: LessonState): string {
  switch (n) {
    case 60: return '\n\nReadiness register (learner-reported, not verified):\n' + json(state.readyRows || []) + '\n\nRegister summary: ' + json(readinessSummary60(state)) + '\n\nLearning/assessment only; no evidence verification, certification or launch authority.';
    case 59: return '\n\nImprovement register (learner-reported, not verified):\n' + json(state.fixRows || []) + '\n\nPlanning/status only; no implementation, passed checks or release verified.';
    case 58: return '\n\nBeta evidence register (learner-reported, not verified):\n' + json(state.betaRows || []) + '\n\nActual run/not-run status must remain explicit. No beta execution, approval or findings verified.';
    case 57: return '\n\nProposed event register (not instrumented):\n' + json(state.eventRows || []) + '\n\nPlanning only; no tracking, privacy approval or real behaviour verified.';
    case 56: return '\n\nLocal cash helper input draft (assumptions, not verified):\n' + json(state.cashDraft || {}) + '\n\nUniform twelve-month helper only; not P&L, tax/accounting advice, valuation or guaranteed runway.';
    case 55: return '\n\nResponsibility register (learner-reported, not verified):\n' + json(state.taskRows || []) + '\n\nPlanning only; no appointments, commitments, authority, hiring, equity or agent execution verified.';
    case 54: return '\n\nIP asset register (learner-reported, not verified):\n' + json(state.assetRows || []) + '\n\nPlanning only; no ownership, clearance, filing or protection established.';
    case 53: return '\n\nDecision register (learner-reported, not verified):\n' + json(state.decisionRows || []) + '\n\nPlanning brief only; no filing, agreement, ownership rights or legal/tax suitability established.';
    case 52: return '\n\nOrdered onboarding steps (learner draft, not executed):\n' + json(state.stepRows || []) + '\n\nNo usability, conversion, permission or readiness verified.';
    case 50: return '\n\nAcceptance-check register (learner-reported, not executed here):\n' + json(state.checkRows || []) + '\n\nRelease record only; actual artifact/check claims are self-reported. No deployment, approval or readiness certified.';
    case 49: return '\n\nControl register (learner-reported, not verified):\n' + json(state.controlRows || []) + '\n\nPlanning checklist; no security certification, verified controls or legal compliance established.';
    case 48: return '\n\nIntegration register (learner-entered, not connected):\n' + json(state.integrationRows || []) + '\n\nArchitecture draft; no deployment, API connection, security approval or capability verification.';
    case 47: return '\n\nStructured requirements register (learner-entered):\n' + json(state.requirementRows || []) + '\n\nSpecification draft; source/approval claims are self-reported. Criteria are not passed tests.';
    case 46: return '\n\nStructured observation log (learner-entered; not verified):\n' + json(state.observationRows || []) + '\n\nResearch draft; sessions/observations are self-reported. No usability, demand or readiness verified.';
    case 45: return '\n\nLearner prototype record; artifact and checks are self-reported, not inspected by the Academy. No demand or production readiness verified.';
    default: return '\n\nPlanning only; no actual build or verified customer evidence.';
  }
}

/** brief(): field ids (worksheet then bias/counter/constraint) in the lesson's field order. */
export function buildBrief(lesson: LessonDefinition, state: LessonState): string {
  return '# ' + lesson.deliverable.title + '\n\nPhase 03 · Module ' + lesson.module + ' · Lesson ' + lesson.number + '\n\n'
    + lesson.fields.map(f => f.id + ': ' + (state.fields[f.id] || 'Not entered')).join('\n\n') + briefTail(lesson.number, state);
}

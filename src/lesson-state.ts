export type Draft = { fields: Record<string,string>; answers: Record<number,number>; studied: boolean; honest: boolean; completed: boolean };
export type Profile = { answers: Record<number,number>; profileCompleted: boolean; completed: boolean };
export const profileLimits = [5,3,8,6,3];
export const blankDraft = (): Draft => ({fields:{},answers:{},studied:false,honest:false,completed:false});
const object = (value: unknown): Record<string,unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
export function normalizeDraft(raw: unknown): Draft {
  const value = object(raw);
  return {
    fields: Object.fromEntries(Object.entries(object(value.fields)).filter(([,v]) => typeof v === 'string')) as Record<string,string>,
    answers: Object.fromEntries(Object.entries(object(value.answers)).filter(([,v]) => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isInteger(Number(v)) && Number(v) >= 0).map(([k,v]) => [k,Number(v)])),
    studied: value.studied === true, honest: value.honest === true, completed: value.completed === true,
  };
}
export function normalizeProfile(raw: unknown): Profile {
  const value = object(raw), answers = object(value.answers);
  const validAnswers = Object.fromEntries(profileLimits.flatMap((limit,i) => Number.isInteger(answers[i]) && Number(answers[i]) >= 0 && Number(answers[i]) < limit ? [[i,Number(answers[i])]] : []));
  return { answers: validAnswers, profileCompleted: (value.profileCompleted === true || value.completed === true) && profileLimits.every((_,i) => validAnswers[i] !== undefined), completed: value.completed === true };
}
export const fieldsComplete = (draft: Draft, ids: string[]) => ids.every(id => Boolean(draft.fields[id]?.trim()));
export const quizCorrect = (draft: Draft, keys: number[]) => keys.every((answer,i) => draft.answers[i] === answer);
export const validDraft = (draft: Draft, ids: string[], keys: number[]) => draft.studied && draft.honest && fieldsComplete(draft,ids) && quizCorrect(draft,keys);
export function reviseDraft(draft: Draft, patch: Partial<Draft>, ids: string[], keys: number[], extraValid = true): Draft {
  const next = {...draft,...patch};
  return {...next, completed: next.completed && extraValid && validDraft(next,ids,keys)};
}
export function makeDeliverable(title: string, status: boolean, fields: {id:string;label:string}[], draft: Draft, profileLines: string[] = []): string {
  return `# ${title}\n\nStatus: ${status ? 'Self-completed locally' : 'Draft'}\n\n` + profileLines.join('\n\n') + (profileLines.length ? '\n\n' : '') + fields.map(field => `## ${field.label}\n${draft.fields[field.id] || 'Not entered'}`).join('\n\n') + '\n\nLocal learning record. No reviewer submission or business validation.\n';
}

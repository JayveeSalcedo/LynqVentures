/**
 * Production tools (AI video-generation prompts) are internal material for the media team, not
 * learner content. They stay in the lesson data but are only rendered when the build sets
 * VITE_SHOW_PRODUCTION_TOOLS=true (e.g. `VITE_SHOW_PRODUCTION_TOOLS=true npm run dev`).
 */
const env = (import.meta as { env?: Record<string, string | undefined> }).env;
export const SHOW_PRODUCTION_TOOLS = env?.VITE_SHOW_PRODUCTION_TOOLS === 'true';

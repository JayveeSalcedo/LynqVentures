import { useState } from 'react';
import { normalizeDraft, normalizeProfile, reviseDraft, type Draft, type Profile } from './lesson-state';
function read(key: string) { try { return {value:JSON.parse(localStorage.getItem(key) || '{}'),error:false}; } catch { return {value:{},error:true}; } }
export function useLessonDraft(key: string, ids: string[], keys: number[], onProgress: () => void, orientation = false) {
  const [initial] = useState(() => ({draft:read(key), profile:read('lynq.orientation.v1')}));
  const [draft,setDraft] = useState(() => {
    const saved = normalizeDraft(initial.draft.value);
    return orientation ? {...saved,completed:normalizeProfile(initial.profile.value).completed} : saved;
  });
  const [profile,setProfile] = useState(() => normalizeProfile(initial.profile.value));
  const [saveStatus,setSaveStatus] = useState(initial.draft.error || orientation && initial.profile.error ? 'Saved draft could not be read. Download a copy of your work before leaving.' : 'Local autosave · this browser only');
  const [notice,setNotice] = useState('');
  function update(patch: Partial<Draft>, nextProfile: Profile = profile) {
    const next = reviseDraft(draft,patch,ids,keys,!orientation || nextProfile.profileCompleted);
    const savedProfile = {...nextProfile, completed: orientation ? next.completed : nextProfile.completed};
    setDraft(next);setProfile(savedProfile);setNotice('');
    try {
      localStorage.setItem(key,JSON.stringify(next));
      if (orientation) localStorage.setItem('lynq.orientation.v1',JSON.stringify(savedProfile));
      setSaveStatus('Saved in this browser only.');onProgress();
    } catch { setSaveStatus('Browser storage unavailable. Work is in memory only; download before closing.'); }
  }
  return {draft,profile,update,saveStatus,notice,setNotice};
}

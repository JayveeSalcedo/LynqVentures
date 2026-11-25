import type { ReactNode } from 'react';

/** **bold** spans as <strong>; everything else stays plain text (no HTML is ever injected). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] };

/** Splits a reply into paragraphs and bullet/numbered lists. Headings and table rows degrade to plain lines. */
export function parseCoachText(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim().replace(/^#{1,6}\s+/, '').replace(/^\|(.*)\|$/, (_, cells: string) => cells.split('|').map(c => c.trim()).filter(Boolean).join(' · '));
    const bullet = /^[-*•]\s+(.*)$/.exec(line), numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (!line || /^[-|:\s]+$/.test(line)) { if (last?.kind === 'p' && last.lines.length) blocks.push({ kind: 'p', lines: [] }); continue; }
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol', item = (bullet ?? numbered)![1];
      if (last?.kind === kind) last.items.push(item); else blocks.push({ kind, items: [item] });
    } else if (last?.kind === 'p') last.lines.push(line);
    else blocks.push({ kind: 'p', lines: [line] });
  }
  return blocks.filter(b => b.kind === 'p' ? b.lines.length : b.items.length);
}

export function CoachText({ text }: { text: string }) {
  return <>{parseCoachText(text).map((b, i) => b.kind === 'p'
    ? <p key={i}>{b.lines.flatMap((l, j) => j ? [<br key={`b${j}`} />, ...inline(l)] : inline(l))}</p>
    : b.kind === 'ul' ? <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>
      : <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>)}</>;
}

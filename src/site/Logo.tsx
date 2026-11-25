import { useId } from 'react';

/** LYNQ wordmark: white letters with the orange connector inside the Q. Transparent background, scales with `height`. */
export const LOGO_ORANGE = '#E8A646';

export function Logo({ height = 32, color = '#FFFFFF', title = 'LYNQ' }: { height?: number; color?: string; title?: string }) {
  const clip = `lynq-band-${useId().replace(/:/g, '')}`;
  return <svg className="logo" viewBox="80 66 1432 326" height={height} role="img" aria-label={title} focusable="false">
    <defs><clipPath id={clip}><rect x="0" y="74" width="1600" height="281"/></clipPath></defs>
    <g fill={color}>
      {/* L */}
      <rect x="86" y="74" width="54" height="281" rx="3"/>
      <rect x="86" y="305" width="200" height="50" rx="3"/>
      {/* Y stem */}
      <rect x="457" y="236" width="55" height="119" rx="3"/>
      {/* N stems */}
      <rect x="757" y="74" width="51" height="281" rx="3"/>
      <rect x="949" y="74" width="52" height="281" rx="3"/>
    </g>
    <g stroke={color} strokeWidth="56" clipPath={`url(#${clip})`} fill="none">
      {/* Y arms */}
      <line x1="378" y1="66" x2="486" y2="244"/>
      <line x1="592" y1="66" x2="484" y2="244"/>
      {/* N diagonal */}
      <line x1="782" y1="60" x2="976" y2="370"/>
    </g>
    {/* Q ring, open at the lower right where the connector exits */}
    <path d="M1370.8 313.3A120 120 0 1 1 1410.8 265.7" fill="none" stroke={color} strokeWidth="50"/>
    <g fill={LOGO_ORANGE}>
      <line x1="1300" y1="215" x2="1462" y2="352" stroke={LOGO_ORANGE} strokeWidth="22" strokeLinecap="round"/>
      <circle cx="1300" cy="215" r="46"/>
      <circle cx="1464" cy="352" r="36"/>
    </g>
  </svg>;
}

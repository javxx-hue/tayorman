import React from 'react';

// The board's teacher: a round, friendly face in a graduation cap. It talks while the board speaks and nods
// when a step is done (the `nod` value changes each time).
export const Teacher: React.FC<{ talking: boolean; nod: number; size?: number }> = ({ talking, nod, size = 72 }) => (
  <div key={nod} className={nod ? 'teacher-nod' : ''} style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" width={size} height={size} className={talking ? 'teacher-talking' : ''} aria-hidden>
      {/* face */}
      <circle cx="50" cy="56" r="34" fill="#3b82f6" />
      <circle cx="50" cy="56" r="34" fill="url(#teacher-shine)" />
      {/* cap */}
      <polygon points="50,10 88,24 50,38 12,24" fill="#1e293b" />
      <rect x="34" y="27" width="32" height="9" rx="2" fill="#1e293b" />
      <line x1="84" y1="25" x2="84" y2="42" stroke="#facc15" strokeWidth="2.5" />
      <circle cx="84" cy="44" r="3.5" fill="#facc15" />
      {/* eyes */}
      <ellipse className="teacher-eye" cx="39" cy="54" rx="5" ry="6.5" fill="#fff" />
      <ellipse className="teacher-eye" cx="61" cy="54" rx="5" ry="6.5" fill="#fff" />
      <circle cx="40" cy="55" r="2.6" fill="#0f172a" />
      <circle cx="62" cy="55" r="2.6" fill="#0f172a" />
      {/* cheeks */}
      <circle cx="31" cy="66" r="4" fill="#f472b6" opacity="0.45" />
      <circle cx="69" cy="66" r="4" fill="#f472b6" opacity="0.45" />
      {/* mouth */}
      <ellipse className="teacher-mouth" cx="50" cy="71" rx="8" ry="5" fill="#0f172a" />
      <defs>
        <radialGradient id="teacher-shine" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  </div>
);

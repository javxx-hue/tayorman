import React from 'react';

// The board's teacher. It holds a piece of chalk up and to the left; the board puts the chalk's tip on the spot
// being written, so the teacher walks along the line it writes. It talks while the phone reads and nods when a
// step is done (the `nod` value changes each time).
export const TEACHER_SIZE = 58;
// Where the chalk tip is inside the 100x100 drawing
export const CHALK_TIP = { x: 6, y: 6 };

export const Teacher: React.FC<{ talking: boolean; nod: number }> = ({ talking, nod }) => (
  <div key={nod} className={nod ? 'teacher-nod' : ''} style={{ width: TEACHER_SIZE, height: TEACHER_SIZE }}>
    <svg viewBox="0 0 100 100" width={TEACHER_SIZE} height={TEACHER_SIZE} className={talking ? 'teacher-talking' : ''} aria-hidden>
      <defs>
        <linearGradient id="teacher-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {/* arm and chalk, reaching up to the left */}
      <path d="M44 66 Q26 52 18 22" stroke="#2563eb" strokeWidth="7" fill="none" strokeLinecap="round" />
      <rect x="3" y="3" width="8" height="22" rx="3" transform="rotate(-24 7 14)" fill="#f8fafc" />
      <circle cx="18" cy="24" r="6" fill="#7dd3fc" />
      {/* head */}
      <circle cx="62" cy="64" r="28" fill="url(#teacher-skin)" />
      {/* cap */}
      <polygon points="62,24 92,35 62,46 32,35" fill="#1e293b" />
      <rect x="49" y="38" width="26" height="8" rx="2" fill="#1e293b" />
      <path d="M89 36 L89 50" stroke="#facc15" strokeWidth="2" />
      <circle cx="89" cy="52" r="3" fill="#facc15" />
      {/* eyes, looking at the chalk */}
      <ellipse className="teacher-eye" cx="53" cy="62" rx="5" ry="6" fill="#fff" />
      <ellipse className="teacher-eye" cx="70" cy="62" rx="5" ry="6" fill="#fff" />
      <circle cx="51.5" cy="60.5" r="2.4" fill="#0f172a" />
      <circle cx="68.5" cy="60.5" r="2.4" fill="#0f172a" />
      {/* cheeks and mouth */}
      <circle cx="47" cy="72" r="3.5" fill="#f9a8d4" opacity="0.6" />
      <circle cx="77" cy="72" r="3.5" fill="#f9a8d4" opacity="0.6" />
      <ellipse className="teacher-mouth" cx="62" cy="77" rx="6" ry="4" fill="#0f172a" />
    </svg>
  </div>
);

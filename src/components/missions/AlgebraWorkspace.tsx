import React, { useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language, tr } from '../../lib/i18n';
import { apply2, eq, fracText, FMatrix, inverse2, isEchelon, isZero, letterOf, M2, mat2mul, parseFrac, rowAdd, rowScale, rowSwap, toFracs } from '../../lib/algebraLab';
import { AlgebraKind, AlgebraMission, CODED, CRAMER, DRONE, GAUSS, KEY, Step, STRETCH, TURN } from '../../lib/algebraMissions';
import { box, HelpButtons, pick, TaskCard, WorkspaceProps } from './shared';

// After this many wrong answers the solution can be opened
const TRIES = 3;

interface BenchProps {
  mission: AlgebraMission;
  lang: Language;
  done: number; // steps finished
  onStep: (n: number) => void;
  onWrong: () => void;
  onSolved: () => void;
}

export const AlgebraWorkspace: React.FC<WorkspaceProps<AlgebraMission>> = ({ mission, lang, solved, onSolved }) => {
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(0);
  const Bench = BENCHES[mission.kind];
  return (
    <>
      <TaskCard lang={lang} task={mission.task} />
      <Bench mission={mission} lang={lang} done={done} onStep={setDone} onWrong={() => setTries((n) => n + 1)} onSolved={onSolved} />
      <HelpButtons lang={lang} hint={mission.hint} solution={mission.solution} tries={tries} need={TRIES} solved={solved} />
    </>
  );
};

// ---------------------------------------------------------------- typing the answers, one step at a time
const StepRunner: React.FC<{ steps: Step[]; lang: Language; done: number; onStep: (n: number) => void; onWrong: () => void; onAll: () => void }> = ({
  steps,
  lang,
  done,
  onStep,
  onWrong,
  onAll,
}) => {
  const [values, setValues] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const step = steps[done];

  const check = () => {
    const got = step.fields.map((_, i) => parseFrac(values[i] ?? ''));
    if (got.some((g) => g === null)) {
      setMessage(tr(lang, "Har bir katakka son yozing: butun, o'nli (1,5) yoki kasr (3/2).", 'Впишите число в каждую клетку: целое, десятичное (1,5) или дробь (3/2).'));
      return;
    }
    if (!got.every((g, i) => eq(g!, step.answer[i]))) {
      setMessage(`${tr(lang, "Hali to'g'ri emas.", 'Пока неверно.')} ${step.hint}`);
      onWrong();
      return;
    }
    setMessage('');
    setValues([]);
    onStep(done + 1);
    if (done + 1 === steps.length) onAll();
  };

  const field = 'w-20 rounded-xl border border-border bg-card px-2.5 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
      {steps.slice(0, done).map((s) => (
        <div key={s.label} className="flex items-start gap-2 text-sm">
          <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
          <span className="text-foreground">
            {s.label} <span className="font-mono font-bold">{s.answer.map(fracText).join('; ')}</span>
          </span>
        </div>
      ))}
      {step && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">{step.label}</div>
          <div className="flex flex-wrap gap-2">
            {step.fields.map((f, i) => (
              <label key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {f}
                <input
                  value={values[i] ?? ''}
                  onChange={(e) => setValues((v) => Object.assign([...v], { [i]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') check();
                  }}
                  autoComplete="off"
                  enterKeyHint="done"
                  className={field}
                />
              </label>
            ))}
          </div>
          <Button variant="primary" size="sm" onClick={check}>{tr(lang, 'Tekshirish', 'Проверить')}</Button>
          {message && <div className={box.bad}>{message}</div>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- drawings
const Plane: React.FC<{ range: number; children: React.ReactNode; label?: string }> = ({ range, children, label }) => (
  <svg viewBox={`${-range} ${-range} ${range * 2} ${range * 2}`} className="w-full max-w-xs mx-auto rounded-xl bg-secondary/40 text-foreground" aria-label={label}>
    {Array.from({ length: range * 2 + 1 }, (_, k) => k - range).map((k) => (
      <g key={k} stroke="currentColor" strokeOpacity={k === 0 ? 0.5 : 0.08} strokeWidth={k === 0 ? 0.08 : 0.04}>
        <line x1={k} y1={-range} x2={k} y2={range} />
        <line x1={-range} y1={k} x2={range} y2={k} />
      </g>
    ))}
    {children}
  </svg>
);

const Dot: React.FC<{ p: [number, number]; text: string; color: string }> = ({ p, text, color }) => (
  <g>
    <line x1="0" y1="0" x2={p[0]} y2={-p[1]} stroke={color} strokeWidth="0.1" strokeDasharray="0.3 0.2" />
    <circle cx={p[0]} cy={-p[1]} r="0.45" fill={color} />
    {/* near the top edge the label goes under the point */}
    <text x={p[0] + 0.6} y={p[1] > 6 ? -p[1] + 1.4 : -p[1] - 0.5} fontSize="0.9" fill={color}>{text}</text>
  </g>
);

const MatrixView: React.FC<{ rows: string[][]; label?: string }> = ({ rows, label }) => (
  <div className="flex items-center gap-2 font-mono text-sm text-foreground">
    {label && <span>{label} =</span>}
    <div className="border-x-2 border-foreground/60 rounded px-2 py-1">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-3 justify-end">
          {r.map((c, j) => (
            <span key={j} className="min-w-[2.5ch] text-right">{c}</span>
          ))}
        </div>
      ))}
    </div>
  </div>
);
const m2rows = (m: M2) => m.map((r) => r.map((x) => fracText({ n: x, d: 1 })));

// ---------------------------------------------------------------- 1. the drone on the complex plane
const ComplexBench: React.FC<BenchProps> = ({ mission, lang, done, onStep, onWrong, onSolved }) => {
  const [s, t] = mission.steps.slice(1).map((st) => [st.answer[0].n, st.answer[1].n] as [number, number]);
  return (
    <>
      <Plane range={8} label={tr(lang, 'kompleks tekislik', 'комплексная плоскость')}>
        <rect x="-0.5" y="-0.5" width="1" height="1" fill="#64748b" />
        {done >= 1 && <circle cx="0" cy="0" r="5" fill="none" stroke="#f59e0b" strokeWidth="0.08" strokeDasharray="0.4 0.3" />}
        <Dot p={DRONE} text="z" color="#3b82f6" />
        {done >= 2 && <Dot p={s} text="z·i" color="#10b981" />}
        {done >= 3 && <Dot p={t} text="z(1+i)" color="#a855f7" />}
      </Plane>
      <StepRunner steps={mission.steps} lang={lang} done={done} onStep={onStep} onWrong={onWrong} onAll={onSolved} />
    </>
  );
};

// ---------------------------------------------------------------- 2. Cramer
const CramerBench: React.FC<BenchProps> = ({ mission, lang, done, onStep, onWrong, onSolved }) => (
  <>
    <div className="rounded-2xl border border-border bg-card p-3 font-mono text-sm text-foreground space-y-1">
      {CRAMER.rows.map((r) => (
        <div key={r}>{r}</div>
      ))}
    </div>
    <StepRunner steps={mission.steps} lang={lang} done={done} onStep={onStep} onWrong={onWrong} onAll={onSolved} />
  </>
);

// ---------------------------------------------------------------- 3. map layers
const FLAG: [number, number][] = [
  [0, 0],
  [0, 3],
  [2, 3],
  [2, 2],
  [0, 2],
];
const Flag: React.FC<{ m?: M2; title: string; color: string }> = ({ m, title, color }) => {
  const pts = FLAG.map((p) => (m ? apply2(m, p) : p)).map(([x, y]) => `${x},${-y}`).join(' ');
  return (
    <div className="flex-1 min-w-0 space-y-1">
      <Plane range={5}>
        <polyline points={pts} fill="none" stroke={color} strokeWidth="0.25" strokeLinejoin="round" />
      </Plane>
      <div className="text-center text-xs text-muted-foreground">{title}</div>
    </div>
  );
};

const MatmulBench: React.FC<BenchProps> = ({ mission, lang, done, onStep, onWrong, onSolved }) => (
  <>
    <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap gap-4">
      <MatrixView label="A" rows={m2rows(TURN)} />
      <MatrixView label="B" rows={m2rows(STRETCH)} />
    </div>
    <div className="flex gap-2">
      <Flag title={tr(lang, 'Asl xarita', 'Исходная карта')} color="#64748b" />
      {done >= 1 && <Flag m={mat2mul(TURN, STRETCH)} title="AB" color="#10b981" />}
      {done >= 2 && <Flag m={mat2mul(STRETCH, TURN)} title="BA" color="#a855f7" />}
    </div>
    <StepRunner steps={mission.steps} lang={lang} done={done} onStep={onStep} onWrong={onWrong} onAll={onSolved} />
  </>
);

// ---------------------------------------------------------------- 4. the coded command
// The command, decoded with K⁻¹ pair by pair
const DECODED = (() => {
  const inv = inverse2(KEY)!.map((r) => r.map((f) => f.n / f.d));
  return CODED.map(([a, b]) => letterOf(inv[0][0] * a + inv[0][1] * b) + letterOf(inv[1][0] * a + inv[1][1] * b)).join('');
})();

const InverseBench: React.FC<BenchProps> = ({ mission, lang, done, onStep, onWrong, onSolved }) => {
  const open = done >= mission.steps.length;
  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <MatrixView label="K" rows={m2rows(KEY)} />
        <div className="text-xs text-muted-foreground">{tr(lang, 'Shifrlangan buyruq:', 'Зашифрованная команда:')}</div>
        <div className="flex flex-wrap gap-2 font-mono text-sm">
          {CODED.map(([a, b], i) => (
            <span key={i} className="px-2 py-1 rounded-lg bg-secondary text-foreground">({a}, {b})</span>
          ))}
        </div>
        <div className="flex gap-1.5">
          {DECODED.split('').map((ch, i) => (
            <span key={i} className={`w-9 h-10 rounded-lg flex items-center justify-center font-mono text-lg font-bold ${open ? 'bg-emerald-500/20 text-foreground' : 'bg-secondary text-muted-foreground'}`}>
              {open ? ch : '?'}
            </span>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">A=1, B=2, C=3 … K=11 … U=21 … Z=26</div>
      </div>
      <StepRunner steps={mission.steps} lang={lang} done={done} onStep={onStep} onWrong={onWrong} onAll={onSolved} />
    </>
  );
};

// ---------------------------------------------------------------- 5. Gauss: the student does the row operations
const GaussBench: React.FC<BenchProps> = ({ mission, lang, done, onStep, onWrong, onSolved }) => {
  const [history, setHistory] = useState<{ m: FMatrix; op: string }[]>([{ m: toFracs(GAUSS), op: '' }]);
  const [target, setTarget] = useState('1');
  const [source, setSource] = useState('0');
  const [k, setK] = useState('');
  const [message, setMessage] = useState('');
  const m = history[history.length - 1].m;
  const ready = isEchelon(m);
  const rows = ['R1', 'R2', 'R3'];

  const push = (next: FMatrix, op: string) => {
    setHistory((h) => [...h, { m: next, op }]);
    setMessage('');
  };
  const addRows = () => {
    const f = parseFrac(k);
    const i = Number(target);
    const j = Number(source);
    if (!f) return setMessage(tr(lang, "k uchun son yozing, masalan −2 yoki 1/2.", 'Введите число k, например −2 или 1/2.'));
    if (i === j) return setMessage(tr(lang, "Satrga o'zini qo'shib bo'lmaydi, boshqa satrni tanlang.", 'Нельзя прибавить строку к самой себе.'));
    push(rowAdd(m, i, j, f), `${rows[i]} ← ${rows[i]} + (${fracText(f)})·${rows[j]}`);
    setK('');
  };
  // Ri ← k·Ri, for example to make a pivot 1; k = 0 would wipe the equation out
  const scaleRow = () => {
    const f = parseFrac(k);
    const i = Number(target);
    if (!f || isZero(f)) return setMessage(tr(lang, "k uchun noldan farqli son yozing, masalan 1/2 yoki −1.", 'Введите ненулевое k, например 1/2 или −1.'));
    push(rowScale(m, i, f), `${rows[i]} ← (${fracText(f)})·${rows[i]}`);
    setK('');
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
        <div className="flex items-center gap-2 font-mono text-sm text-foreground">
          <div className="space-y-0.5 text-muted-foreground text-xs">
            {rows.map((r) => (
              <div key={r} className="h-5 leading-5">{r}</div>
            ))}
          </div>
          <div className="border-x-2 border-foreground/60 rounded px-2 py-0.5">
            {m.map((row, i) => (
              <div key={i} className="flex gap-3 h-5 leading-5">
                {row.map((c, j) => (
                  <span key={j} className={`min-w-[3ch] text-right ${j === 3 ? 'pl-2 border-l border-foreground/40' : ''} ${j < i && c.n === 0 ? 'text-emerald-500' : ''}`}>
                    {fracText(c)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        {history.length > 1 && (
          <div className="text-[11px] font-mono text-muted-foreground space-y-0.5">
            {history.slice(1).map((h, i) => (
              <div key={i}>{h.op}</div>
            ))}
          </div>
        )}
      </div>

      {!ready ? (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
          <div className="text-xs font-bold text-muted-foreground">{tr(lang, 'Satr amali', 'Операция со строками')}</div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-mono text-foreground">
            <Pick value={target} onPick={setTarget} labels={rows} />
            <span>← {rows[Number(target)]} +</span>
            <input value={k} onChange={(e) => setK(e.target.value)} placeholder="k" autoComplete="off" className="w-16 rounded-xl border border-border bg-card px-2.5 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <span>·</span>
            <Pick value={source} onPick={setSource} labels={rows} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={addRows}>{tr(lang, "Qo'llash", 'Применить')}</Button>
            <Button variant="outline" size="sm" onClick={() => push(rowSwap(m, Number(target), Number(source)), `${rows[Number(target)]} ↔ ${rows[Number(source)]}`)}>
              {rows[Number(target)]} ↔ {rows[Number(source)]}
            </Button>
            <Button variant="outline" size="sm" onClick={scaleRow}>
              {rows[Number(target)]} ← k·{rows[Number(target)]}
            </Button>
            {history.length > 1 && (
              <Button variant="ghost" size="sm" icon={<Undo2 size={14} />} onClick={() => setHistory((h) => h.slice(0, -1))}>
                {tr(lang, 'Orqaga', 'Отменить')}
              </Button>
            )}
          </div>
          {message && <div className={box.bad}>{message}</div>}
        </div>
      ) : (
        <>
          <div className={box.good}>{tr(lang, "Uchburchak ko'rinish tayyor! Endi pastdan yuqoriga yeching.", 'Треугольный вид готов! Теперь решайте снизу вверх.')}</div>
          <StepRunner steps={mission.steps} lang={lang} done={done} onStep={onStep} onWrong={onWrong} onAll={onSolved} />
        </>
      )}
    </>
  );
};

const Pick: React.FC<{ value: string; onPick: (v: string) => void; labels: string[] }> = ({ value, onPick, labels }) => (
  <span className="inline-flex gap-1">
    {labels.map((l, i) => (
      <button key={l} className={pick(value === String(i))} onClick={() => onPick(String(i))}>
        {l}
      </button>
    ))}
  </span>
);

const BENCHES: Record<AlgebraKind, React.FC<BenchProps>> = {
  complex: ComplexBench,
  cramer: CramerBench,
  matmul: MatmulBench,
  inverse: InverseBench,
  gauss: GaussBench,
};

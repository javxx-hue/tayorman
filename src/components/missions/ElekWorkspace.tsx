import React, { useMemo, useState } from 'react';
import { Play, RefreshCw, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { Language, tr } from '../../lib/i18n';
import { bandsOf, diodeReading, LedState, ledState, RECT, rectifierWave, RIPPLE_LIMIT, ripplePercent, transistorReading } from '../../lib/elekLab';
import {
  BOX_DIODES,
  BRIDGE_FAULT,
  CAPACITORS,
  checkDiode,
  checkKirchhoff,
  checkLed,
  checkMeters,
  checkRectifier,
  checkTransistor,
  ElekKind,
  ElekMission,
  KIRCHHOFF,
  LED_RESISTORS,
  MYSTERY,
  Verdict,
} from '../../lib/elekMissions';
import { box, HelpButtons, pick, TaskCard, WorkspaceProps } from './shared';

// After this many wrong answers the solution can be opened
const TRIES = 3;

interface BenchProps {
  lang: Language;
  judge: (v: Verdict) => void; // a final answer: solves the mission or counts a try
  say: (v: Verdict | null) => void; // a remark on the way, not an answer
}

export const ElekWorkspace: React.FC<WorkspaceProps<ElekMission>> = ({ mission, lang, solved, onSolved }) => {
  const [tries, setTries] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const judge = (v: Verdict) => {
    setVerdict(v);
    if (v.ok) onSolved();
    else setTries((n) => n + 1);
  };
  const Bench = BENCHES[mission.kind];
  return (
    <>
      <TaskCard lang={lang} task={mission.task} />
      <Bench lang={lang} judge={judge} say={setVerdict} />
      {verdict && verdict.message && <div className={verdict.ok ? box.good : box.bad}>{verdict.message}</div>}
      <HelpButtons lang={lang} hint={mission.hint} solution={mission.solution} tries={tries} need={TRIES} solved={solved} />
    </>
  );
};

// ---------------------------------------------------------------- parts
const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
    <div className="text-xs font-bold text-muted-foreground">{title}</div>
    {children}
  </div>
);

const Choice: React.FC<{ options: { value: string; label: string }[]; value: string | null; onPick: (v: string) => void }> = ({ options, value, onPick }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => (
      <button key={o.value} className={pick(o.value === value)} onClick={() => onPick(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

const ResistorPic: React.FC<{ ohms: number }> = ({ ohms }) => (
  <svg viewBox="0 0 132 30" className="w-28 h-7" aria-hidden>
    <line x1="0" y1="15" x2="132" y2="15" stroke="#9ca3af" strokeWidth="2" />
    <rect x="24" y="4" width="84" height="22" rx="9" fill="#e8d3a8" stroke="#b9a47a" />
    {bandsOf(ohms).map((b, i) => (
      <rect key={i} x={[38, 52, 66, 90][i]} y="4" width="8" height="22" fill={b.hex} />
    ))}
  </svg>
);

const LED_LOOK: Record<LedState | 'idle', string> = {
  idle: 'bg-zinc-500/40',
  off: 'bg-zinc-500/40',
  dim: 'bg-red-900',
  ok: 'bg-red-500 shadow-[0_0_24px_8px_rgba(239,68,68,0.6)]',
  burnt: 'bg-zinc-900 ring-2 ring-zinc-600',
};

// A multimeter in diode mode
const Meter: React.FC<{ value: string }> = ({ value }) => (
  <div className="rounded-2xl bg-zinc-900 p-3 w-48">
    <div className="rounded-lg bg-lime-200 text-zinc-900 font-mono text-3xl text-right px-3 py-2 tabular-nums">{value}</div>
    <div className="text-[11px] text-zinc-400 mt-1.5 flex justify-between">
      <span>▶| diod rejimi</span>
      <span>V</span>
    </div>
  </div>
);

// ---------------------------------------------------------------- 1. LED on an Arduino pin
const LedBench: React.FC<BenchProps> = ({ lang, judge, say }) => {
  const [chosen, setChosen] = useState<number | null>(null);
  const [legToPin, setLegToPin] = useState<string | null>(null);
  const [look, setLook] = useState<LedState | 'idle'>('idle');

  const power = () => {
    if (chosen === null || legToPin === null) {
      say({ ok: false, message: tr(lang, 'Avval rezistorni va LED ning ulanishini tanlang.', 'Сначала выберите резистор и подключение светодиода.') });
      return;
    }
    const ohms = LED_RESISTORS[chosen];
    setLook(ledState(ohms, legToPin === 'pin'));
    judge(checkLed(ohms, legToPin === 'pin'));
  };

  return (
    <>
      <Panel title={tr(lang, 'Rezistorlar qutisi (yozuvsiz)', 'Коробка резисторов (без надписей)')}>
        <div className="grid grid-cols-2 gap-2">
          {LED_RESISTORS.map((ohms, i) => (
            <button
              key={i}
              onClick={() => setChosen(i)}
              className={`rounded-xl border p-2 flex flex-col items-center gap-1 ${chosen === i ? 'border-primary bg-primary/10' : 'border-border'}`}
            >
              <ResistorPic ohms={ohms} />
              <span className="text-xs font-bold text-muted-foreground">{String.fromCharCode(65 + i)}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title={tr(lang, 'LED ni qanday ulaysiz?', 'Как подключить светодиод?')}>
        <Choice
          value={legToPin}
          onPick={setLegToPin}
          options={[
            { value: 'pin', label: tr(lang, "Uzun oyog'i → D13", 'Длинная ножка → D13') },
            { value: 'gnd', label: tr(lang, "Uzun oyog'i → GND", 'Длинная ножка → GND') },
          ]}
        />
        <div className="flex items-center gap-4 pt-1">
          <span className={`w-10 h-10 rounded-full transition-all ${LED_LOOK[look]}`} aria-hidden />
          <span className="font-mono text-xs text-muted-foreground">D13 ─[ R ]─ LED ─ GND</span>
        </div>
      </Panel>
      <Button variant="primary" icon={<Zap size={14} />} onClick={power}>
        {tr(lang, 'Quvvat berish', 'Подать питание')}
      </Button>
    </>
  );
};

// ---------------------------------------------------------------- 2. which diode is good
const DiodeBench: React.FC<BenchProps> = ({ lang, judge }) => {
  const [diode, setDiode] = useState('0');
  const [red, setRed] = useState('A');
  const value = diodeReading(BOX_DIODES[Number(diode)], red === 'A');
  return (
    <>
      <Panel title={tr(lang, 'Multimetr', 'Мультиметр')}>
        <Choice value={diode} onPick={setDiode} options={BOX_DIODES.map((_, i) => ({ value: String(i), label: `D${i + 1}` }))} />
        <Choice
          value={red}
          onPick={setRed}
          options={[
            { value: 'A', label: tr(lang, 'Qizil zond anodda', 'Красный щуп на аноде') },
            { value: 'K', label: tr(lang, 'Qizil zond katodda', 'Красный щуп на катоде') },
          ]}
        />
        <Meter value={value} />
      </Panel>
      <Panel title={tr(lang, 'Qaysi diod soz?', 'Какой диод исправен?')}>
        <div className="flex gap-2">
          {BOX_DIODES.map((_, i) => (
            <Button key={i} variant="outline" size="sm" onClick={() => judge(checkDiode(i))}>
              D{i + 1}
            </Button>
          ))}
        </div>
      </Panel>
    </>
  );
};

// ---------------------------------------------------------------- 3. the unmarked transistor
const LEGS = ['1', '2', '3'];

const TransistorPic: React.FC = () => (
  <svg viewBox="0 0 80 70" className="w-20 h-16" aria-hidden>
    <path d="M14 34 A26 26 0 0 1 66 34 L66 40 L14 40 Z" fill="#27272a" />
    {[24, 40, 56].map((x, i) => (
      <g key={x}>
        <line x1={x} y1="40" x2={x} y2="60" stroke="#9ca3af" strokeWidth="2.5" />
        <text x={x} y="69" textAnchor="middle" fontSize="9" fill="currentColor">{i + 1}</text>
      </g>
    ))}
  </svg>
);

const TransistorBench: React.FC<BenchProps> = ({ lang, judge, say }) => {
  const [red, setRed] = useState('1');
  const [black, setBlack] = useState('2');
  const [seen, setSeen] = useState<string[]>([]);
  const [base, setBase] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [emitter, setEmitter] = useState<string | null>(null);
  const value = transistorReading(MYSTERY, red, black);

  // Every pair the student measured stays in a small table
  const measure = (r: string, b: string) => {
    setRed(r);
    setBlack(b);
    if (r !== b) setSeen((s) => (s.includes(`${r}${b}`) ? s : [...s, `${r}${b}`]));
  };

  const answer = () => {
    if (!base || !type || !emitter) {
      say({ ok: false, message: tr(lang, 'Bazani, turini va emitterni tanlang.', 'Выберите базу, тип и эмиттер.') });
      return;
    }
    judge(checkTransistor(base, type, emitter));
  };

  return (
    <>
      <Panel title={tr(lang, 'Multimetr', 'Мультиметр')}>
        <div className="flex items-center gap-3">
          <TransistorPic />
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-12 text-red-500 font-bold">{tr(lang, 'Qizil', 'Красный')}</span>
              <Choice value={red} onPick={(v) => measure(v, black)} options={LEGS.map((l) => ({ value: l, label: l }))} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-12 font-bold text-foreground">{tr(lang, 'Qora', 'Чёрный')}</span>
              <Choice value={black} onPick={(v) => measure(red, v)} options={LEGS.map((l) => ({ value: l, label: l }))} />
            </div>
          </div>
        </div>
        <Meter value={value} />
        {seen.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
            {seen.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-md bg-secondary text-foreground">
                {tr(lang, 'qizil', 'кр')} {p[0]} · {tr(lang, 'qora', 'чр')} {p[1]}: {transistorReading(MYSTERY, p[0], p[1])}
              </span>
            ))}
          </div>
        )}
      </Panel>
      <Panel title={tr(lang, 'Xulosangiz', 'Ваш вывод')}>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">{tr(lang, 'Baza', 'База')}</span>
            <Choice value={base} onPick={setBase} options={LEGS.map((l) => ({ value: l, label: l }))} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">{tr(lang, 'Turi', 'Тип')}</span>
            <Choice value={type} onPick={setType} options={[{ value: 'npn', label: 'n-p-n' }, { value: 'pnp', label: 'p-n-p' }]} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 text-muted-foreground">{tr(lang, 'Emitter', 'Эмиттер')}</span>
            <Choice value={emitter} onPick={setEmitter} options={LEGS.map((l) => ({ value: l, label: l }))} />
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={answer}>{tr(lang, 'Tekshirish', 'Проверить')}</Button>
      </Panel>
    </>
  );
};

// ---------------------------------------------------------------- 4. meters and Kirchhoff
const KirchhoffPic: React.FC<{ known: boolean }> = ({ known }) => {
  const v = (s: string) => (known ? s : '—');
  return (
    <svg viewBox="0 0 300 170" className="w-full max-w-sm text-foreground" aria-label="sxema">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M30 40 V70 M30 100 V130 M30 40 H100 M160 40 H230 M190 40 V60 M190 110 V130 M270 40 V60 M270 110 V130 M30 130 H270 M230 40 H270" />
        <line x1="18" y1="70" x2="42" y2="70" />
        <line x1="24" y1="100" x2="36" y2="100" strokeWidth="4" />
        <rect x="100" y="30" width="60" height="20" rx="3" />
        <rect x="180" y="60" width="20" height="50" rx="3" />
        <rect x="260" y="60" width="20" height="50" rx="3" />
      </g>
      <circle cx="190" cy="40" r="4" fill="currentColor" />
      <g fontSize="11" fill="currentColor">
        <text x="2" y="90">E={KIRCHHOFF.e}V</text>
        <text x="122" y="44">R1</text>
        <text x="203" y="90">R2</text>
        <text x="283" y="90">R3</text>
        <text x="108" y="22">U₁={v(`${KIRCHHOFF.u1}`.replace('.', ','))}V</text>
        <text x="50" y="32">I₁={v(`${KIRCHHOFF.i1}`.replace('.', ','))}A</text>
        <text x="150" y="152">I₂={v(`${KIRCHHOFF.i2}`.replace('.', ','))}A</text>
        <text x="236" y="152">I₃=?</text>
        <text x="150" y="80">U₂=?</text>
        <text x="196" y="30">tugun</text>
      </g>
    </svg>
  );
};

const KirchhoffBench: React.FC<BenchProps> = ({ lang, judge, say }) => {
  const [ammeter, setAmmeter] = useState<string | null>(null);
  const [voltmeter, setVoltmeter] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [i3, setI3] = useState('');
  const [u2, setU2] = useState('');
  const ways = [
    { value: 'series', label: tr(lang, 'Ketma-ket', 'Последовательно') },
    { value: 'parallel', label: tr(lang, 'Parallel', 'Параллельно') },
  ];

  const connect = () => {
    if (!ammeter || !voltmeter) {
      say({ ok: false, message: tr(lang, 'Ikkala asbob uchun ham ulanishni tanlang.', 'Выберите подключение для обоих приборов.') });
      return;
    }
    const v = checkMeters(ammeter, voltmeter);
    if (!v.ok) {
      judge(v);
      return;
    }
    setConnected(true);
    say({ ok: true, message: tr(lang, "Asboblar to'g'ri ulandi, o'lchovlar sxemada ko'rinyapti.", 'Приборы подключены верно, показания на схеме.') });
  };

  const field = 'w-24 rounded-xl border border-border bg-card px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
  return (
    <>
      <Panel title={tr(lang, 'Plata sxemasi', 'Схема платы')}>
        <KirchhoffPic known={connected} />
      </Panel>
      {!connected ? (
        <Panel title={tr(lang, 'Asboblarni ulang', 'Подключите приборы')}>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">{tr(lang, 'Ampermetr', 'Амперметр')}</span>
              <Choice value={ammeter} onPick={setAmmeter} options={ways} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-muted-foreground">{tr(lang, 'Voltmetr', 'Вольтметр')}</span>
              <Choice value={voltmeter} onPick={setVoltmeter} options={ways} />
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={connect}>{tr(lang, 'Ulash', 'Подключить')}</Button>
        </Panel>
      ) : (
        <Panel title={tr(lang, 'Hisoblang', 'Рассчитайте')}>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-2">
              I₃ = <input value={i3} onChange={(e) => setI3(e.target.value)} inputMode="decimal" className={field} /> A
            </label>
            <label className="flex items-center gap-2">
              U₂ = <input value={u2} onChange={(e) => setU2(e.target.value)} inputMode="decimal" className={field} /> V
            </label>
          </div>
          <Button variant="primary" size="sm" onClick={() => judge(checkKirchhoff(i3, u2))}>{tr(lang, 'Tekshirish', 'Проверить')}</Button>
        </Panel>
      )}
    </>
  );
};

// ---------------------------------------------------------------- 5. bridge rectifier
const Scope: React.FC<{ wave: number[] }> = ({ wave }) => {
  const w = 300;
  const h = 120;
  const top = RECT.peak * 1.15;
  const points = wave.map((v, i) => `${((i / (wave.length - 1)) * w).toFixed(1)},${(h - (v / top) * h).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-xl bg-zinc-950" aria-label="ossillogramma">
      {[1, 2, 3].map((k) => (
        <line key={`h${k}`} x1="0" x2={w} y1={(h / 4) * k} y2={(h / 4) * k} stroke="#27272a" />
      ))}
      {[1, 2, 3, 4, 5, 6, 7].map((k) => (
        <line key={`v${k}`} y1="0" y2={h} x1={(w / 8) * k} x2={(w / 8) * k} stroke="#27272a" />
      ))}
      <polyline points={points} fill="none" stroke="#a3e635" strokeWidth="2" />
    </svg>
  );
};

const RectifierBench: React.FC<BenchProps> = ({ lang, judge }) => {
  const [open, setOpen] = useState<boolean[]>([...BRIDGE_FAULT]);
  const [cap, setCap] = useState(100);
  const [diode, setDiode] = useState('0');
  const [red, setRed] = useState('A');
  const wave = useMemo(() => rectifierWave(open, cap), [open, cap]);
  const ripple = ripplePercent(wave);
  const d = Number(diode);

  return (
    <>
      <Panel title={tr(lang, 'Ossillograf: zaryadlovchi chiqishi (40 ms)', 'Осциллограф: выход зарядки (40 мс)')}>
        <Scope wave={wave} />
        <div className={`text-xs font-mono ${ripple > RIPPLE_LIMIT ? 'text-destructive' : 'text-emerald-500'}`}>
          {tr(lang, 'Pulsatsiya', 'Пульсации')}: {ripple}% ({tr(lang, 'ruxsat', 'допуск')} ≤ {RIPPLE_LIMIT}%)
        </div>
      </Panel>
      <Panel title={tr(lang, "Ko'prik diodlari", 'Диоды моста')}>
        <Choice value={diode} onPick={setDiode} options={open.map((_, i) => ({ value: String(i), label: `D${i + 1}` }))} />
        <Choice
          value={red}
          onPick={setRed}
          options={[
            { value: 'A', label: tr(lang, 'Qizil zond anodda', 'Красный щуп на аноде') },
            { value: 'K', label: tr(lang, 'Qizil zond katodda', 'Красный щуп на катоде') },
          ]}
        />
        <Meter value={diodeReading(open[d] ? 'open' : 'ok', red === 'A')} />
        <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => setOpen((o) => o.map((x, i) => (i === d ? false : x)))}>
          {tr(lang, `D${d + 1} ni almashtirish`, `Заменить D${d + 1}`)}
        </Button>
      </Panel>
      <Panel title={tr(lang, 'Silliqlovchi kondensator', 'Сглаживающий конденсатор')}>
        <Choice value={String(cap)} onPick={(v) => setCap(Number(v))} options={CAPACITORS.map((c) => ({ value: String(c), label: c === 0 ? tr(lang, "yo'q", 'нет') : `${c} µF` }))} />
      </Panel>
      <Button variant="primary" icon={<Play size={14} />} onClick={() => judge(checkRectifier(open, cap))}>
        {tr(lang, 'Tekshirish', 'Проверить')}
      </Button>
    </>
  );
};

const BENCHES: Record<ElekKind, React.FC<BenchProps>> = {
  led: LedBench,
  diodes: DiodeBench,
  transistor: TransistorBench,
  kirchhoff: KirchhoffBench,
  rectifier: RectifierBench,
};

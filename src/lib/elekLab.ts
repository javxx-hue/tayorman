// The workshop bench for the "Elektronika va sxemalar" missions: resistor colour codes, an LED on an Arduino pin,
// a multimeter in diode mode (diodes, a transistor), Kirchhoff's laws and a bridge rectifier with a smoothing
// capacitor. Everything is computed from the numbers, so a mission is checked without AI.

// ---------------------------------------------------------------- resistor colour code
export interface BandColor {
  name: string;
  hex: string;
}

export const DIGIT_COLORS: BandColor[] = [
  { name: 'qora', hex: '#1a1a1a' },
  { name: 'jigarrang', hex: '#7b3f00' },
  { name: 'qizil', hex: '#d32f2f' },
  { name: "to'q sariq", hex: '#f57c00' },
  { name: 'sariq', hex: '#fbc02d' },
  { name: 'yashil', hex: '#388e3c' },
  { name: "ko'k", hex: '#1976d2' },
  { name: 'binafsha', hex: '#7b1fa2' },
  { name: 'kulrang', hex: '#9e9e9e' },
  { name: 'oq', hex: '#f5f5f5' },
];
export const GOLD: BandColor = { name: 'tilla (±5%)', hex: '#c9a227' };

// Four bands: two digits, the multiplier, the tolerance. Works for 10 Ω and up.
export function bandsOf(ohms: number): BandColor[] {
  let exp = 0;
  let sig = ohms;
  while (sig >= 100) {
    sig /= 10;
    exp++;
  }
  const two = Math.round(sig);
  return [DIGIT_COLORS[Math.floor(two / 10)], DIGIT_COLORS[two % 10], DIGIT_COLORS[exp], GOLD];
}

export const ohmsLabel = (ohms: number): string => (ohms >= 1000 ? `${ohms / 1000} kΩ` : `${ohms} Ω`);

// ---------------------------------------------------------------- an LED on an Arduino pin
export const LED = { supply: 5, vf: 2, imax: 0.02, imin: 0.005 };

export type LedState = 'off' | 'burnt' | 'dim' | 'ok';

export const ledCurrent = (ohms: number): number => (LED.supply - LED.vf) / ohms;

export function ledState(ohms: number, longLegToPin: boolean): LedState {
  if (!longLegToPin) return 'off'; // reversed: the p-n junction is closed
  const i = ledCurrent(ohms);
  if (i > LED.imax) return 'burnt';
  if (i < LED.imin) return 'dim';
  return 'ok';
}

// ---------------------------------------------------------------- multimeter, diode mode
export type DiodeHealth = 'ok' | 'short' | 'open';

// Red probe on the anode = forward bias
export function diodeReading(health: DiodeHealth, redOnAnode: boolean, vf = 0.612): string {
  if (health === 'short') return '0.000';
  if (health === 'open' || !redOnAnode) return 'OL';
  return vf.toFixed(3);
}

// A transistor seen by the meter: two p-n junctions from the base. n-p-n opens with the red probe on the base.
export interface Transistor {
  type: 'npn' | 'pnp';
  base: string;
  emitter: string;
  collector: string;
}

export function transistorReading(t: Transistor, red: string, black: string): string {
  if (red === black) return '—';
  const forward = t.type === 'npn' ? red === t.base : black === t.base;
  const other = t.type === 'npn' ? black : red;
  if (!forward) return 'OL';
  if (other === t.emitter) return '0.668'; // base–emitter drops a little more than base–collector
  if (other === t.collector) return '0.651';
  return 'OL';
}

// ---------------------------------------------------------------- numbers typed by the student
export function readNumber(raw: string): number | null {
  const t = raw.trim().replace(',', '.').replace(/\s*(a|v)$/i, ''); // "0,75 A" and "7.2 V" are fine
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export const close = (got: number | null, want: number, tolerance = 0.011): boolean => got !== null && Math.abs(got - want) <= tolerance;

// ---------------------------------------------------------------- bridge rectifier
export const RECT = { peak: 12, freq: 50, load: 100 }; // volts after the transformer, Hz, ohms

// Output voltage over time. A bridge passes one half-wave through D1+D3 and the other through D2+D4;
// an open diode removes its half. The capacitor (µF) holds the voltage between peaks.
export function rectifierWave(open: boolean[], capUF: number, ms = 40, points = 400): number[] {
  const halfOk = [!open[0] && !open[2], !open[1] && !open[3]];
  const rc = RECT.load * capUF * 1e-6;
  const settle = 100; // ms before the shown window, so the capacitor is charged
  const total = settle + ms;
  const step = ms / points;
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i <= Math.round(total / step); i++) {
    const t = i * step;
    const s = Math.sin(2 * Math.PI * RECT.freq * (t / 1000));
    const rect = s >= 0 ? (halfOk[0] ? s : 0) : halfOk[1] ? -s : 0;
    const source = RECT.peak * rect;
    v = rc > 0 ? Math.max(source, v * Math.exp(-(step / 1000) / rc)) : source;
    if (t >= settle) out.push(v);
  }
  return out;
}

// (max − min) / average, in percent
export function ripplePercent(wave: number[]): number {
  const max = Math.max(...wave);
  const min = Math.min(...wave);
  const avg = wave.reduce((a, b) => a + b, 0) / wave.length;
  return avg > 0 ? Math.round(((max - min) / avg) * 100) : 0;
}

export const RIPPLE_LIMIT = 15; // percent the charger may have

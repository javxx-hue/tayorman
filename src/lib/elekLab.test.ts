import { describe, expect, it } from 'vitest';
import { bandsOf, BandColor, DIGIT_COLORS, diodeReading, LED, ledState, ohmsLabel, readNumber, rectifierWave, ripplePercent, transistorReading } from './elekLab';

// Reads the bands back the way a student does: two digits, then the number of zeros
const ohmsOf = (bands: BandColor[]) => {
  const d = (c: BandColor) => DIGIT_COLORS.indexOf(c);
  return (d(bands[0]) * 10 + d(bands[1])) * 10 ** d(bands[2]);
};
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
  ELEK_MISSIONS,
  LED_RESISTORS,
  MYSTERY,
} from './elekMissions';

const names = (ohms: number) => bandsOf(ohms).map((b) => b.name);

describe('resistor colour code', () => {
  it('writes and reads the bands', () => {
    expect(names(220)).toEqual(['qizil', 'qizil', 'jigarrang', 'tilla (±5%)']);
    expect(names(22)).toEqual(['qizil', 'qizil', 'qora', 'tilla (±5%)']);
    expect(names(100)).toEqual(['jigarrang', 'qora', 'jigarrang', 'tilla (±5%)']);
    expect(names(10000)).toEqual(['jigarrang', 'qora', "to'q sariq", 'tilla (±5%)']);
    for (const r of [10, 22, 47, 100, 150, 220, 330, 1000, 4700, 10000]) expect(ohmsOf(bandsOf(r))).toBe(r);
    expect(ohmsLabel(10000)).toBe('10 kΩ');
  });
});

describe('mission 1: the LED', () => {
  it('needs at least 150 Ω and only the 220 Ω in the box fits', () => {
    expect((LED.supply - LED.vf) / LED.imax).toBeCloseTo(150);
    expect(LED_RESISTORS.filter((r) => checkLed(r, true).ok)).toEqual([220]);
    expect(ledState(22, true)).toBe('burnt');
    expect(ledState(100, true)).toBe('burnt');
    expect(ledState(10000, true)).toBe('dim');
    expect(checkLed(220, false).message).toMatch(/teskari/);
    expect(checkLed(22, true).message).toMatch(/136.4 mA/);
  });
});

describe('mission 2: diodes on the meter', () => {
  it('reads like real diodes', () => {
    expect(diodeReading('ok', true)).toBe('0.612');
    expect(diodeReading('ok', false)).toBe('OL');
    expect(diodeReading('short', false)).toBe('0.000');
    expect(diodeReading('open', true)).toBe('OL');
    expect(BOX_DIODES.map((_, i) => checkDiode(i).ok)).toEqual([false, true, false]);
    expect(checkDiode(0).message).toMatch(/teshilgan/);
    expect(checkDiode(2).message).toMatch(/uzilgan/);
  });
});

describe('mission 3: the unmarked transistor', () => {
  it('shows two junctions only with the black probe on the base', () => {
    const legs = ['1', '2', '3'];
    const readings = legs.flatMap((r) => legs.filter((b) => b !== r).map((b) => `${r}${b}:${transistorReading(MYSTERY, r, b)}`));
    expect(readings.filter((x) => !x.endsWith('OL'))).toEqual(['12:0.668', '32:0.651']);
    expect(checkTransistor('2', 'pnp', '1').ok).toBe(true);
    expect(checkTransistor('1', 'pnp', '1').message).toMatch(/Baza/);
    expect(checkTransistor('2', 'npn', '1').message).toMatch(/Tur/);
    expect(checkTransistor('2', 'pnp', '3').message).toMatch(/Emitter/);
    expect(transistorReading({ type: 'npn', base: '1', emitter: '3', collector: '2' }, '1', '3')).toBe('0.668');
  });
});

describe('mission 4: meters and Kirchhoff', () => {
  it('wants the meters right and both laws', () => {
    expect(checkMeters('parallel', 'parallel').message).toMatch(/Qisqa tutashuv/);
    expect(checkMeters('series', 'series').message).toMatch(/parallel ulanadi/);
    expect(checkMeters('series', 'parallel').ok).toBe(true);
    expect(checkKirchhoff('0,75', '7.2 V').ok).toBe(true);
    expect(checkKirchhoff('1.65', '7.2').message).toMatch(/1-qonuni/);
    expect(checkKirchhoff('0.75', '16.8').message).toMatch(/2-qonuni/);
    expect(readNumber('abc')).toBeNull();
    expect(readNumber(' 0.75 A ')).toBe(0.75);
  });
});

describe('mission 5: the rectifier', () => {
  it('needs the open diode replaced and a big enough capacitor', () => {
    const fixed = [false, false, false, false];
    const ripple = (open: boolean[], c: number) => ripplePercent(rectifierWave(open, c));
    expect(ripple(fixed, 1000)).toBeLessThanOrEqual(15);
    expect(ripple(fixed, 100)).toBeGreaterThan(15);
    expect(ripple(BRIDGE_FAULT, 0)).toBeGreaterThan(ripple(fixed, 0));
    expect(CAPACITORS.filter((c) => checkRectifier(fixed, c).ok)).toEqual([1000]);
    expect(checkRectifier(BRIDGE_FAULT, 1000).message).toMatch(/bitta yarim davr/);
    // the open diode removes every other half-wave: the output sits at zero half the time
    const half = rectifierWave(BRIDGE_FAULT, 0);
    expect(half.filter((v) => v < 0.01).length / half.length).toBeGreaterThan(0.45);
  });
  it('every mission points at real exam questions', () => {
    expect(ELEK_MISSIONS.map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
    for (const m of ELEK_MISSIONS) expect(m.questions.every((q) => /^q-elektronika-\d{3}$/.test(q))).toBe(true);
  });
});

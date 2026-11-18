// "Elektronika va sxemalar" story: the student joins the company's repair workshop and fixes five devices on a
// virtual bench. The answers are checked with the formulas in elekLab.ts.
import { close, DiodeHealth, ledCurrent, ledState, ohmsLabel, readNumber, rectifierWave, RIPPLE_LIMIT, ripplePercent, Transistor } from './elekLab';

export const ELEK_BOSS = 'Shavkat';

export type ElekKind = 'led' | 'diodes' | 'transistor' | 'kirchhoff' | 'rectifier';

export interface ElekMission {
  id: number;
  title: string;
  kind: ElekKind;
  brief: string[];
  task: string;
  hint: string;
  solution: string;
  success: string[];
  questions: string[];
}

export interface Verdict {
  ok: boolean;
  message: string;
}

// ---------------------------------------------------------------- the bench
export const LED_RESISTORS = [100, 10000, 220, 22]; // as they lie in the box, unlabelled
export const BOX_DIODES: DiodeHealth[] = ['short', 'ok', 'open']; // D1, D2, D3
export const MYSTERY: Transistor = { type: 'pnp', base: '2', emitter: '1', collector: '3' };
export const KIRCHHOFF = { e: 12, i1: 1.2, i2: 0.45, u1: 4.8 }; // what the meters show
export const BRIDGE_FAULT = [false, false, true, false]; // D3 is open
export const CAPACITORS = [0, 10, 100, 1000]; // µF

// ---------------------------------------------------------------- checks
export function checkLed(ohms: number, longLegToPin: boolean): Verdict {
  const state = ledState(ohms, longLegToPin);
  const ma = String(Math.round(ledCurrent(ohms) * 1000 * 10) / 10).replace('.', ',');
  if (state === 'off') return { ok: false, message: "LED yonmadi: u teskari ulangan. Uzun oyog'i (anod) pin tomonda, qisqasi (katod) GND tomonda bo'lishi kerak." };
  if (state === 'burnt') return { ok: false, message: `LED kuydi! ${ohmsLabel(ohms)} bilan tok ${ma} mA bo'ldi, LED esa ko'pi bilan 20 mA ga chidaydi. Kattaroq rezistor kerak.` };
  if (state === 'dim') return { ok: false, message: `LED zo'rg'a yondi: ${ohmsLabel(ohms)} bilan tok atigi ${ma} mA. Kichikroq rezistor kerak.` };
  return { ok: true, message: `LED yorqin yondi: tok ${ma} mA, me'yorda.` };
}

export function checkDiode(choice: number): Verdict {
  const health = BOX_DIODES[choice];
  if (health === 'ok') return { ok: true, message: '' };
  return {
    ok: false,
    message:
      health === 'short'
        ? `D${choice + 1} teshilgan (qisqa tutashgan): ikkala yo'nalishda ham 0.000 ko'rsatadi.`
        : `D${choice + 1} uzilgan: ikkala yo'nalishda ham OL (cheksiz) ko'rsatadi.`,
  };
}

export function checkTransistor(base: string, type: string, emitter: string): Verdict {
  if (base !== MYSTERY.base) return { ok: false, message: "Baza noto'g'ri. Baza — qolgan ikkala oyoq bilan o'tish ko'rsatadigan oyoq." };
  if (type !== MYSTERY.type)
    return { ok: false, message: "Tur noto'g'ri. Qizil zond bazada turganda o'tish bo'lsa n-p-n, qora zond bazada turganda bo'lsa p-n-p." };
  if (emitter !== MYSTERY.emitter) return { ok: false, message: "Emitter noto'g'ri. Baza–emitter o'tishi baza–kollektorga qaraganda biroz kattaroq kuchlanish ko'rsatadi." };
  return { ok: true, message: '' };
}

export function checkMeters(ammeter: string, voltmeter: string): Verdict {
  if (ammeter !== 'series')
    return { ok: false, message: "Qisqa tutashuv! Ampermetrning qarshiligi juda kichik: parallel ulansa, butun tok u orqali o'tadi va saqlagich kuyadi. Ampermetr ketma-ket ulanadi." };
  if (voltmeter !== 'parallel')
    return { ok: false, message: "Qurilma o'chib qoldi: voltmetrning qarshiligi juda katta, ketma-ket ulansa tok deyarli to'xtaydi. Voltmetr parallel ulanadi." };
  return { ok: true, message: '' };
}

export function checkKirchhoff(i3: string, u2: string): Verdict {
  const wantI = Math.round((KIRCHHOFF.i1 - KIRCHHOFF.i2) * 100) / 100;
  const wantU = Math.round((KIRCHHOFF.e - KIRCHHOFF.u1) * 100) / 100;
  const okI = close(readNumber(i3), wantI);
  const okU = close(readNumber(u2), wantU);
  if (okI && okU) return { ok: true, message: '' };
  if (!okI) return { ok: false, message: "I₃ noto'g'ri. Tugunga kirgan toklar yig'indisi chiqqan toklar yig'indisiga teng (Kirxgofning 1-qonuni)." };
  return { ok: false, message: "U₂ noto'g'ri. Yopiq konturda manba EYuK i kuchlanish tushishlari yig'indisiga teng (Kirxgofning 2-qonuni)." };
}

export function checkRectifier(open: boolean[], capUF: number): Verdict & { ripple: number } {
  const ripple = ripplePercent(rectifierWave(open, capUF));
  if (open.some(Boolean)) return { ok: false, ripple, message: "Chiqishda faqat bitta yarim davr bor: ko'prikdagi diodlardan biri ishlamayapti." };
  if (ripple > RIPPLE_LIMIT) return { ok: false, ripple, message: `Pulsatsiya ${ripple}%, zaryadlovchiga ko'pi bilan ${RIPPLE_LIMIT}% mumkin. Kondensator sig'imi yetmayapti.` };
  return { ok: true, ripple, message: '' };
}

// ---------------------------------------------------------------- the story
export const ELEK_MISSIONS: ElekMission[] = [
  {
    id: 1,
    title: 'Signal chirog\'i',
    kind: 'led',
    brief: [
      "Xush kelibsiz, ustaxonaga! Men Shavkat usta. Bugun omborning signal chirog'ini tiklaymiz.",
      "Chiroq — qizil LED, Arduino'ning D13 pini boshqaradi. Oldingi stajyor rezistorni chamalab qo'ygan edi, LED kuyib ketdi.",
      "Qutida to'rtta rezistor bor, yozuvi yo'q, faqat rangli halqalari. Hisoblab, to'g'risini tanlang.",
    ],
    task: "Pin kuchlanishi 5 V, LED da 2 V tushadi, LED ko'pi bilan 20 mA ga chidaydi. Kerakli qarshilikni hisoblang, rezistorni halqalaridan o'qib tanlang va LED ni to'g'ri qutbda ulang.",
    hint: "R = (5 − 2) / 0,02 = 150 Ω. Bundan kichik bo'lmagan eng yaqin rezistor kerak. Halqalar: 1- va 2-halqa raqam, 3-halqa nechta nol qo'shilishi. Qizil=2, jigarrang=1, qora=0. LED ning uzun oyog'i — anod, pin tomonga.",
    solution: "220 Ω (qizil-qizil-jigarrang-tilla), uzun oyog'i D13 ga",
    success: [
      "Yondi! 220 Ω bilan tok 13,6 mA — LED uzoq xizmat qiladi.",
      "Rangli halqalarni o'qishni o'rgandingiz. Endi zaryadlovchilarga o'tamiz.",
    ],
    questions: ['q-elektronika-238', 'q-elektronika-168', 'q-elektronika-132', 'q-elektronika-162', 'q-elektronika-217'],
  },
  {
    id: 2,
    title: 'Qaysi diod soz?',
    kind: 'diodes',
    brief: [
      "Kuryerlarning zaryadlovchisini ta'mirlaymiz. Qutida uchta bir xil diod bor, lekin ikkitasi nosoz.",
      "Multimetrni diod rejimiga qo'ying va har birini ikki yo'nalishda tekshiring.",
    ],
    task: "D1, D2, D3 diodlarini multimetr bilan ikki yo'nalishda o'lchang (qizil zond anodda va katodda). Soz diodni toping.",
    hint: "Soz diod: qizil zond anodda — 0.5–0.7 V atrofida, teskarisida — OL. Teshilgan diod ikkala tomonda 0 ga yaqin, uzilgan diod ikkala tomonda OL ko'rsatadi.",
    solution: 'D2: to\'g\'ri yo\'nalishda 0.612, teskarisida OL',
    success: [
      "To'g'ri, D2 soz! D1 teshilgan, D3 esa uzilgan ekan.",
      "Diodning bir tomonlama o'tkazuvchanligini o'z ko'zingiz bilan ko'rdingiz.",
    ],
    questions: ['q-elektronika-241', 'q-elektronika-142', 'q-elektronika-240', 'q-elektronika-246', 'q-elektronika-250'],
  },
  {
    id: 3,
    title: 'Yozuvsiz tranzistor',
    kind: 'transistor',
    brief: [
      "Skaner platasidagi tranzistorni almashtirish kerak, lekin yangisining yozuvi o'chib ketgan.",
      "Oyoqlari 1, 2, 3 deb belgilangan. Turini va qaysi oyoq nima ekanini multimetr bilan aniqlaymiz.",
    ],
    task: "Multimetrning diod rejimida oyoqlarni juft-juft o'lchang. Bazani, turini (n-p-n yoki p-n-p) va emitterni aniqlang.",
    hint: "Baza — boshqa ikkala oyoq bilan o'tish ko'rsatadigan oyoq. Bunda qora zond bazada bo'lsa — p-n-p, qizil bo'lsa — n-p-n. Ikki o'qishdan kattarog'i baza–emitter.",
    solution: "Baza 2, p-n-p, emitter 1 (0.668), kollektor 3 (0.651)",
    success: [
      "Zo'r! p-n-p tranzistor: baza 2, emitter 1, kollektor 3. Uni platadagi joyiga to'g'ri o'rnatdik.",
      "Tranzistor ikki diod kabi ko'rinishini endi bilasiz.",
    ],
    questions: ['q-elektronika-222', 'q-elektronika-223', 'q-elektronika-244', 'q-elektronika-224', 'q-elektronika-220'],
  },
  {
    id: 4,
    title: 'Plata o\'lchovlari',
    kind: 'kirchhoff',
    brief: [
      "Ta'mirlangan platani tekshiramiz: 12 V manba, R1 rezistor, keyin tok R2 va R3 ga bo'linadi.",
      "Ampermetrlardan biri buzuq, uchinchi tarmoq tokini hisoblab topasiz.",
    ],
    task: "Avval asboblarni to'g'ri ulang. Keyin o'lchovlardan foydalanib, Kirxgof qonunlari bilan R3 tarmog'idagi tok I₃ ni va R2 dagi kuchlanish U₂ ni toping.",
    hint: "1-qonun: tugunga kirgan tok chiqqan toklar yig'indisiga teng, I₁ = I₂ + I₃. 2-qonun: konturda E = U₁ + U₂.",
    solution: 'Ampermetr ketma-ket, voltmetr parallel; I₃ = 1,2 − 0,45 = 0,75 A; U₂ = 12 − 4,8 = 7,2 V',
    success: [
      "Hisob to'g'ri: I₃ = 0,75 A, U₂ = 7,2 V. Plata me'yorda ishlayapti.",
      "Tugun, tarmoq va kontur endi siz uchun shunchaki so'z emas.",
    ],
    questions: ['q-elektronika-201', 'q-elektronika-206', 'q-elektronika-207', 'q-elektronika-208', 'q-elektronika-209'],
  },
  {
    id: 5,
    title: 'G\'o\'ng\'illayotgan zaryadlovchi',
    kind: 'rectifier',
    brief: [
      "Oxirgi buyurtma: zaryadlovchi g'o'ng'illayapti va telefonlarni zaryadlamayapti.",
      "Ichida ko'priksimon to'g'rilagich va silliqlovchi kondensator bor. Ossillograf ulangan, chiqishga qarang.",
    ],
    task: `Ko'prikdagi D1–D4 diodlarni tekshirib, nosozini almashtiring. Keyin pulsatsiya ${RIPPLE_LIMIT}% dan oshmasligi uchun mos kondensatorni tanlang.`,
    hint: "Bir yarim davr yo'qolgan bo'lsa, ko'prikdagi juftliklardan birida diod uzilgan. Kondensator sig'imi qancha katta bo'lsa, cho'qqilar orasida kuchlanish shuncha kam tushadi.",
    solution: 'D3 uzilgan, uni almashtiring; kondensator 1000 µF',
    success: [
      "Zaryadlovchi jim bo'ldi va telefonlar zaryadlanyapti! Chiqish endi deyarli tekis.",
      "Bugun 5 ta qurilmani tuzatdingiz. Siz endi haqiqiy usta yordamchisisiz!",
    ],
    questions: ['q-elektronika-214', 'q-elektronika-141', 'q-elektronika-213', 'q-elektronika-215', 'q-elektronika-080', 'q-elektronika-212'],
  },
];

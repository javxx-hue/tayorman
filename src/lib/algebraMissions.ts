// "Chiziqli algebra va kompleks sonlar" story: the student joins the drone delivery team and every calculation
// moves something on the screen. The right answers are computed from algebraLab.ts, never typed in by hand.
import { cabs, cmul, Complex, det, Frac, frac, inverse2, M2, mat2mul, numberOf, withColumn } from './algebraLab';

export const ALGEBRA_BOSS = 'Malika';

export type AlgebraKind = 'complex' | 'cramer' | 'matmul' | 'inverse' | 'gauss';

// One calculation the student types in: a few numbers, checked exactly
export interface Step {
  label: string;
  fields: string[];
  answer: Frac[];
  hint: string; // shown after a wrong answer
}

export interface AlgebraMission {
  id: number;
  title: string;
  kind: AlgebraKind;
  brief: string[];
  task: string;
  hint: string;
  solution: string;
  success: string[];
  questions: string[];
  steps: Step[]; // the Gauss mission adds its row operations before the last step
}

const ints = (...xs: number[]) => xs.map((x) => frac(x));
const flat2 = (m: M2) => ints(m[0][0], m[0][1], m[1][0], m[1][1]);
const CELLS = ['a₁₁', 'a₁₂', 'a₂₁', 'a₂₂'];

// ---------------------------------------------------------------- 1. complex numbers move the drone
export const DRONE: Complex = [3, 4];
const turned = cmul(DRONE, [0, 1]);
const turned45 = cmul(DRONE, [1, 1]);

// ---------------------------------------------------------------- 2. Cramer
export const CRAMER = {
  a: [
    [1, 1, 1],
    [2, 3, 5],
    [1, 2, 3],
  ],
  b: [10, 33, 20],
  rows: ['x + y + z = 10  (qutilar soni)', '2x + 3y + 5z = 33  (og\'irlik, kg)', 'x + 2y + 3z = 20  (hajm, litr)'],
};
const delta = det(CRAMER.a);
const deltas = [0, 1, 2].map((c) => det(withColumn(CRAMER.a, c, CRAMER.b)));

// ---------------------------------------------------------------- 3. map layers: AB ≠ BA
export const TURN: M2 = [
  [0, -1],
  [1, 0],
]; // 90° turn
export const STRETCH: M2 = [
  [2, 0],
  [0, 1],
]; // twice as wide

// ---------------------------------------------------------------- 4. the coded command
export const KEY: M2 = [
  [2, 1],
  [1, 1],
];
export const SECRET = 'KURYER';
export const CODED: [number, number][] = [0, 2, 4].map((i) => {
  const p: [number, number] = [numberOf(SECRET[i]), numberOf(SECRET[i + 1])];
  return [KEY[0][0] * p[0] + KEY[0][1] * p[1], KEY[1][0] * p[0] + KEY[1][1] * p[1]];
});

// ---------------------------------------------------------------- 5. Gauss
export const GAUSS = [
  [1, 1, 1, 6],
  [2, 3, 1, 11],
  [1, -1, 2, 5],
];
export const GAUSS_ANSWER = ints(1, 2, 3);

export const ALGEBRA_MISSIONS: AlgebraMission[] = [
  {
    id: 1,
    title: 'Dronning birinchi parvozi',
    kind: 'complex',
    brief: [
      "Xush kelibsiz! Men Malika, dron yetkazish bo'limidaman. Dronlarimizni kompleks sonlar boshqaradi.",
      "Xarita — kompleks tekislik: baza 0 nuqtada, dron hozir z = 3 + 4i da. Har bir hisobingiz dronni yuritadi.",
    ],
    task: "Dron z = 3 + 4i nuqtada. Uning bazadan uzoqligini toping, keyin z ni i ga va (1 + i) ga ko'paytirib, dronni buring.",
    hint: "|a + bi| = √(a² + b²). i² = −1, shuning uchun (3 + 4i)·i = 3i + 4i². (1 + i) ga ko'paytirishda qavslarni oching va i² = −1 ni qo'llang.",
    solution: `|z| = 5; z·i = ${turned[0]} + ${turned[1]}i; z·(1 + i) = ${turned45[0]} + ${turned45[1]}i`,
    success: [
      "Dron uchdi! i ga ko'paytirish uni 90° burdi, (1 + i) ga ko'paytirish esa 45° burib, √2 marta uzoqlashtirdi.",
      "Kompleks sonni ko'paytirishda modullar ko'paytiriladi, argumentlar qo'shiladi. Mana trigonometrik shaklning ma'nosi.",
    ],
    questions: ['q-algebra-001', 'q-algebra-010', 'q-algebra-002', 'q-algebra-035', 'q-algebra-046'],
    steps: [
      { label: '1. Dron bazadan qancha uzoqda? |3 + 4i| =', fields: ['|z|'], answer: ints(cabs(DRONE)), hint: "Modul: √(3² + 4²)." },
      { label: '2. 90° ga burish: (3 + 4i) · i =', fields: ['Re', 'Im'], answer: ints(...turned), hint: "4i · i = 4i² = −4. Haqiqiy qism −4 bo'ladi." },
      { label: '3. 45° ga burish: (3 + 4i)(1 + i) =', fields: ['Re', 'Im'], answer: ints(...turned45), hint: "3 + 3i + 4i + 4i² = 3 − 4 + 7i." },
    ],
  },
  {
    id: 2,
    title: 'Yuk taqsimoti',
    kind: 'cramer',
    brief: [
      "Dronga uch xil quti yuklanadi: kichik, o'rta va katta. Ombor nechtadan berganini yozib qo'ymagan!",
      "Faqat jami son, og'irlik va hajm ma'lum. Kramer qoidasi bilan har turdan nechta ekanini topamiz.",
    ],
    task: "Tenglamalar sistemasini Kramer qoidasi bilan yeching: avval asosiy determinant Δ, keyin Δx, Δy, Δz, oxirida x, y, z.",
    hint: "Δx uchun asosiy determinantning 1-ustunini ozod hadlar (10, 33, 20) bilan almashtiring, Δy uchun 2-ustunni, Δz uchun 3-ustunni. x = Δx/Δ.",
    solution: `Δ = ${delta}; Δx = ${deltas[0]}, Δy = ${deltas[1]}, Δz = ${deltas[2]}; x = ${deltas[0] / delta}, y = ${deltas[1] / delta}, z = ${deltas[2] / delta}`,
    success: [
      `Topildi: ${deltas[0] / delta} ta kichik, ${deltas[1] / delta} ta o'rta va ${deltas[2] / delta} ta katta quti. Dron yuklandi!`,
      "Δ ≠ 0 bo'lgani uchun yechim yagona edi. Agar Δ = 0 bo'lganida, Kramer qoidasi ishlamas edi.",
    ],
    questions: ['q-algebra-016', 'q-algebra-082', 'q-algebra-017', 'q-algebra-085', 'q-algebra-086'],
    steps: [
      { label: '1. Asosiy determinant Δ =', fields: ['Δ'], answer: ints(delta), hint: "Uchburchak (Sarryus) qoidasi yoki 1-satr bo'yicha yoyish: 1·(9 − 10) − 1·(6 − 5) + 1·(4 − 3)." },
      { label: '2. Yordamchi determinantlar', fields: ['Δx', 'Δy', 'Δz'], answer: ints(...deltas), hint: "Har birida bitta ustun o'rniga ozod hadlar ustuni (10, 33, 20) qo'yiladi." },
      {
        label: '3. Yechim',
        fields: ['x', 'y', 'z'],
        answer: deltas.map((d) => frac(d, delta)),
        hint: 'x = Δx / Δ, y = Δy / Δ, z = Δz / Δ.',
      },
    ],
  },
  {
    id: 3,
    title: 'Xarita qatlamlari',
    kind: 'matmul',
    brief: [
      "Xaritani ekranga moslash kerak: A — 90° burish, B — kenglik bo'yicha 2 marta cho'zish.",
      "Dasturchilar «qaysi tartibda qilsak ham baribir» deyishyapti. Rostmi? Hisoblab ko'ramiz.",
    ],
    task: "A = (0 −1; 1 0) va B = (2 0; 0 1). AB va BA ko'paytmalarni toping. Xaritadagi bayroqcha ikkala holatda qanday o'zgarishini ko'ring.",
    hint: "Ko'paytmaning i-satr, j-ustun elementi = birinchi matritsaning i-satri bilan ikkinchisining j-ustunining skalyar ko'paytmasi.",
    solution: `AB = (${mat2mul(TURN, STRETCH).map((r) => r.join(' ')).join('; ')}), BA = (${mat2mul(STRETCH, TURN).map((r) => r.join(' ')).join('; ')})`,
    success: [
      "Ko'rdingizmi? AB ≠ BA: «cho'zib, keyin burish» bilan «burib, keyin cho'zish» ikki xil xarita beradi.",
      "Matritsalarni ko'paytirishda tartib muhim. Dasturchilarga aytib qo'yamiz!",
    ],
    questions: ['q-algebra-027', 'q-algebra-110', 'q-algebra-114', 'q-algebra-026', 'q-algebra-119'],
    steps: [
      { label: '1. AB =', fields: CELLS, answer: flat2(mat2mul(TURN, STRETCH)), hint: "AB ning 1-satri: (0·2 + (−1)·0, 0·0 + (−1)·1)." },
      { label: '2. BA =', fields: CELLS, answer: flat2(mat2mul(STRETCH, TURN)), hint: "BA ning 1-satri: (2·0 + 0·1, 2·(−1) + 0·0)." },
    ],
  },
  {
    id: 4,
    title: 'Shifrlangan buyruq',
    kind: 'inverse',
    brief: [
      "Dronga markazdan shifrlangan buyruq keldi. Harflar sonlarga aylantirilib (A=1, B=2 … Z=26), juft-juft K matritsaga ko'paytirilgan.",
      "Buyruqni o'qish uchun K⁻¹ kerak. Kalit: K = (2 1; 1 1).",
    ],
    task: "K ning determinantini va teskari matritsasini toping, keyin birinchi juftni oching: K⁻¹ · (43, 32).",
    hint: "(a b; c d)⁻¹ = 1/(ad − bc) · (d −b; −c a). Juftni ochish: K⁻¹ ni (43, 32) ustunga ko'paytiring.",
    solution: 'det K = 1; K⁻¹ = (1 −1; −1 2); K⁻¹·(43, 32) = (11, 21) → K, U',
    success: [
      `Buyruq ochildi: «${SECRET}». Dron kuryerga yo'l oldi!`,
      "Teskari matritsa faqat det ≠ 0 bo'lganda bor. Shuning uchun kalit matritsa determinanti 0 bo'lmasligi kerak.",
    ],
    questions: ['q-algebra-029', 'q-algebra-136', 'q-algebra-139', 'q-algebra-024', 'q-algebra-127'],
    steps: [
      { label: '1. det K =', fields: ['det'], answer: ints(det(KEY)), hint: 'det = 2·1 − 1·1.' },
      { label: '2. K⁻¹ =', fields: CELLS, answer: inverse2(KEY)!.flat(), hint: "1/det · (d −b; −c a): elementlar o'rnini almashtiring va ishorasini o'zgartiring." },
      {
        label: '3. Birinchi juft: K⁻¹ · (43, 32) =',
        fields: ['1-son', '2-son'],
        answer: ints(numberOf(SECRET[0]), numberOf(SECRET[1])),
        hint: '1-satr: 1·43 + (−1)·32. 2-satr: (−1)·43 + 2·32.',
      },
    ],
  },
  {
    id: 5,
    title: 'Avtopilot',
    kind: 'gauss',
    brief: [
      "Oxirgi vazifa: avtopilot uch motor tezligini x, y, z topishi kerak. Kompyuter qotib qoldi, qo'lda yechamiz.",
      "Gauss usuli: satrlar ustida amallar bilan diagonal ostini nolga keltiramiz, keyin pastdan yuqoriga yechamiz.",
    ],
    task: "Kengaytirilgan matritsani satrlar ustida amallar bilan uchburchak ko'rinishga keltiring (diagonal ostida nollar). Keyin x, y, z ni toping.",
    hint: "R2 ← R2 + (−2)·R1 va R3 ← R3 + (−1)·R1 bilan 1-ustunni tozalang. Keyin R3 ga R2 ning mos karralisini qo'shing. Oxirgi satrdan z, keyin y, keyin x.",
    solution: "R2 ← R2 − 2R1, R3 ← R3 − R1, R3 ← R3 + 2R2 → z = 3, y = 2, x = 1",
    success: [
      "Avtopilot ishga tushdi: x = 1, y = 2, z = 3. Dron xavfsiz qo'ndi!",
      "Bugun kompleks sonlar, determinantlar, matritsalar va Gauss usuli bilan haqiqiy ish qildingiz. Siz endi haqiqiy dron muhandisisiz!",
    ],
    questions: ['q-algebra-014', 'q-algebra-013', 'q-algebra-080', 'q-algebra-078', 'q-algebra-084'],
    steps: [{ label: 'Yechim', fields: ['x', 'y', 'z'], answer: GAUSS_ANSWER, hint: "Oxirgi satrdan z ni toping, uni 2-satrga qo'yib y ni, keyin 1-satrdan x ni." }],
  },
];

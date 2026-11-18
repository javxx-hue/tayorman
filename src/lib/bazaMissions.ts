// "Ma'lumotlar bazasi" story: the student is an intern at a made-up delivery company and solves a real incident
// with SQL. Today in the story is 2026-11-18. A test script run on the live database at night on 16 November
// gave every waiting order to Sardor, a courier who is on leave since 12 November.
import type { SqlMission } from './sqlMission';

export const COMPANY = 'TezYetkaz';
export const BOSS = 'Dilnoza';

export const BAZA_TABLES: { name: string; columns: string[] }[] = [
  { name: 'buyurtmalar', columns: ['id', 'mijoz_id', 'kuryer_id', 'sana', 'summa', 'holat'] },
  { name: 'kuryerlar', columns: ['id', 'ism', 'tuman', 'faol'] },
  { name: 'mijozlar', columns: ['id', 'ism', 'tuman'] },
  { name: 'jurnal', columns: ['id', 'vaqt', 'foydalanuvchi', 'amal'] },
];

export const BAZA_SETUP = `
CREATE TABLE kuryerlar (id INTEGER PRIMARY KEY, ism TEXT NOT NULL, tuman TEXT NOT NULL, faol INTEGER NOT NULL);
CREATE TABLE mijozlar (id INTEGER PRIMARY KEY, ism TEXT NOT NULL, tuman TEXT NOT NULL);
CREATE TABLE buyurtmalar (
  id INTEGER PRIMARY KEY,
  mijoz_id INTEGER NOT NULL REFERENCES mijozlar (id),
  kuryer_id INTEGER REFERENCES kuryerlar (id),
  sana TEXT NOT NULL,
  summa INTEGER NOT NULL,
  holat TEXT NOT NULL
);
CREATE TABLE jurnal (id INTEGER PRIMARY KEY, vaqt TEXT NOT NULL, foydalanuvchi TEXT NOT NULL, amal TEXT NOT NULL);

INSERT INTO kuryerlar VALUES
  (1, 'Bekzod', 'Chilonzor', 1), (2, 'Madina', 'Yunusobod', 1), (3, 'Sardor', 'Sergeli', 0),
  (4, 'Jasur', 'Chilonzor', 1), (5, 'Nodira', 'Sergeli', 1), (6, 'Otabek', 'Mirobod', 1);

INSERT INTO mijozlar VALUES
  (1, 'Aziza', 'Chilonzor'), (2, 'Rustam', 'Sergeli'), (3, 'Dilshod', 'Yunusobod'), (4, 'Malika', 'Sergeli'),
  (5, 'Shahzod', 'Mirobod'), (6, 'Kamola', 'Chilonzor'), (7, 'Islom', 'Sergeli'), (8, 'Nilufar', 'Yunusobod'),
  (9, 'Temur', 'Mirobod'), (10, 'Zarina', 'Sergeli');

INSERT INTO buyurtmalar VALUES
  (101, 1, 1, '2026-11-10', 85000, 'yetkazildi'),
  (102, 2, 3, '2026-11-10', 120000, 'yetkazildi'),
  (103, 4, 3, '2026-11-12', 64000, 'kutilmoqda'),
  (104, 3, 2, '2026-11-12', 45000, 'bekor'),
  (105, 7, 3, '2026-11-13', 230000, 'kutilmoqda'),
  (106, 5, 6, '2026-11-13', 99000, 'yetkazildi'),
  (107, 10, 3, '2026-11-11', 150000, 'yetkazildi'),
  (108, 1, 3, '2026-11-13', 38000, 'kutilmoqda'),
  (109, 8, 2, '2026-11-14', 175000, 'yetkazildi'),
  (110, 6, 4, '2026-11-14', 52000, 'yetkazildi'),
  (111, 9, 3, '2026-11-14', 310000, 'kutilmoqda'),
  (112, 2, 5, '2026-11-14', 47000, 'yetkazildi'),
  (113, 3, 2, '2026-11-15', 88000, 'bekor'),
  (114, 10, 3, '2026-11-15', 126000, 'kutilmoqda'),
  (115, 5, 6, '2026-11-15', 73000, 'yetkazildi'),
  (116, 4, 5, '2026-11-16', 95000, 'yetkazildi'),
  (117, 7, 3, '2026-11-15', 58000, 'kutilmoqda'),
  (118, 6, 1, '2026-11-16', 140000, 'yetkazildi'),
  (119, 2, 3, '2026-11-15', 204000, 'kutilmoqda'),
  (120, 8, 2, '2026-11-17', 66000, 'yetkazildi'),
  (121, 1, 1, '2026-11-16', 91000, 'kutilmoqda'),
  (122, 9, 6, '2026-11-17', 112000, 'yetkazildi'),
  (123, 4, 5, '2026-11-17', 49000, 'kutilmoqda'),
  (124, 3, 2, '2026-11-18', 157000, 'kutilmoqda');

INSERT INTO jurnal VALUES
  (1, '2026-11-10 09:12', 'dilnoza', 'SELECT * FROM mijozlar'),
  (2, '2026-11-11 18:40', 'madina', 'UPDATE buyurtmalar SET kuryer_id = 2 WHERE id = 104'),
  (3, '2026-11-12 08:05', 'dilnoza', 'UPDATE kuryerlar SET faol = 0 WHERE id = 3'),
  (4, '2026-11-13 14:22', 'bekzod', 'SELECT * FROM buyurtmalar WHERE kuryer_id = 1'),
  (5, '2026-11-15 11:30', 'admin', 'CREATE INDEX buyurtmalar_holat ON buyurtmalar (holat)'),
  (6, '2026-11-16 02:14', 'test_skript', 'UPDATE buyurtmalar SET kuryer_id = 3 WHERE holat = ''kutilmoqda'''),
  (7, '2026-11-16 09:03', 'dilnoza', 'SELECT COUNT(*) FROM buyurtmalar'),
  (8, '2026-11-17 10:47', 'madina', 'UPDATE buyurtmalar SET holat = ''yetkazildi'' WHERE id = 120'),
  (9, '2026-11-18 08:30', 'dilnoza', 'SELECT * FROM buyurtmalar WHERE holat = ''kutilmoqda''');
`;

export const BAZA_MISSIONS: SqlMission[] = [
  {
    id: 1,
    title: 'Yo\'qolgan buyurtmalar',
    brief: [
      `Xush kelibsiz, ${COMPANY} jamoasiga! Men ${BOSS}, bugundan siz bilan ishlayman.`,
      "Muammo bor: mijozlar buyurtmasi kelmayapti deb shikoyat qilyapti. Bugun 18-noyabr.",
      'Bazadan 3 kundan beri yetkazilmay turgan buyurtmalarni topib bering.',
    ],
    task: "buyurtmalar jadvalidan holati 'kutilmoqda' va sanasi 2026-11-15 yoki undan oldingi buyurtmalarni toping. Ustunlar: id, mijoz_id, sana. Eng eskisi birinchi tursin.",
    tables: ['buyurtmalar'],
    chips: ['SELECT', 'FROM', 'WHERE', 'AND', 'ORDER BY', "'kutilmoqda'", "'2026-11-15'", '<='],
    hint: "Shartlarni WHERE dan keyin AND bilan bog'lang. Matn va sanalar qo'shtirnoq ichida yoziladi: holat = 'kutilmoqda'. Tartib uchun oxirida ORDER BY sana.",
    solution: "SELECT id, mijoz_id, sana FROM buyurtmalar WHERE holat = 'kutilmoqda' AND sana <= '2026-11-15' ORDER BY sana;",
    kind: 'select',
    orderBy: [{ col: 2 }],
    success: [
      'Rahmat! 7 ta buyurtma. Eng eskisi 12-noyabrdan beri kutyapti.',
      'Endi ular qaysi kuryerda qolib ketganini bilishimiz kerak.',
    ],
    questions: ['q-baza-048', 'q-baza-051', 'q-baza-097'],
  },
  {
    id: 2,
    title: 'Kimda qolib ketdi?',
    brief: [
      'Kuryerlar buyurtmalarni olib ketishi kerak edi. Qaysi kuryerda eng ko\'p buyurtma kutib turibdi?',
      "Har bir kuryer bo'yicha sanab bering.",
    ],
    task: "Holati 'kutilmoqda' bo'lgan buyurtmalarni kuryer_id bo'yicha guruhlab sanang. Ustunlar: kuryer_id va soni. Eng ko'pi birinchi tursin.",
    tables: ['buyurtmalar'],
    chips: ['SELECT', 'COUNT(*)', 'AS soni', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'DESC'],
    hint: "COUNT(*) har guruhdagi qatorlarni sanaydi. Guruh uchun GROUP BY kuryer_id, kamayish tartibi uchun ORDER BY soni DESC.",
    solution: "SELECT kuryer_id, COUNT(*) AS soni FROM buyurtmalar WHERE holat = 'kutilmoqda' GROUP BY kuryer_id ORDER BY soni DESC;",
    kind: 'select',
    orderBy: [{ col: 1, desc: true }],
    success: [
      "7 tasi bitta kuryerda, 3-raqamlida! Qolganlarida bittadan, ular yangi buyurtmalar.",
      "3-raqamli kim ekan? Direktorga raqam bilan bora olmayman.",
    ],
    questions: ['q-baza-059', 'q-baza-054', 'q-baza-103'],
  },
  {
    id: 3,
    title: 'Raqam emas, ism kerak',
    brief: [
      "Direktor «kuryer 3» degan javobni qabul qilmaydi, ism kerak.",
      "Kuryerlar haqidagi ma'lumot boshqa jadvalda: kuryerlar. Ikki jadvalni bog'lash kerak.",
    ],
    task: "2026-11-15 yoki undan oldingi kutilayotgan buyurtmalar uchun buyurtma id raqami, kuryer ismi (ism) va faolligini (faol) chiqaring. buyurtmalar va kuryerlar jadvallarini JOIN bilan bog'lang.",
    tables: ['buyurtmalar', 'kuryerlar'],
    chips: ['SELECT', 'FROM', 'buyurtmalar b', 'JOIN', 'kuryerlar k', 'ON', 'b.kuryer_id = k.id', 'WHERE', 'AND'],
    hint: "Jadvallarga qisqa nom bering: FROM buyurtmalar b JOIN kuryerlar k ON b.kuryer_id = k.id. Ikkala jadvalda ham id bor, shuning uchun b.id deb yozing.",
    solution:
      "SELECT b.id, k.ism, k.faol FROM buyurtmalar b JOIN kuryerlar k ON b.kuryer_id = k.id WHERE b.holat = 'kutilmoqda' AND b.sana <= '2026-11-15';",
    kind: 'select',
    success: [
      'Sardor?! U 12-noyabrdan beri ta\'tilda, faol = 0. Buyurtmalar ta\'tildagi odamga berilgan!',
      "Unga kim berdi? Bazadagi har bir buyruq jurnal jadvaliga yozib boriladi...",
    ],
    questions: ['q-baza-061', 'q-baza-109', 'q-baza-023'],
  },
  {
    id: 4,
    title: 'Jurnal sirlari',
    brief: [
      "Kimdir buyurtmalarni ta'tildagi Sardorga biriktirgan. Hamma buyruqlar jurnal jadvalida saqlanadi.",
      "Tungi navbatchining aytishicha, 16-noyabr kechasi nimadir ishga tushgan.",
    ],
    task: "jurnal jadvalidan 2026-11-16 kuni yozilgan va amal matnida kuryer_id so'zi bor yozuvni toping. Ustunlar: vaqt va foydalanuvchi.",
    tables: ['jurnal'],
    chips: ['SELECT', 'FROM', 'WHERE', 'LIKE', "'%kuryer_id%'", "'2026-11-16%'", 'AND'],
    hint: "Matn ichidan qidirish uchun LIKE ishlatiladi: amal LIKE '%kuryer_id%'. % belgisi «istalgan matn» degani. Kun bo'yicha: vaqt LIKE '2026-11-16%'.",
    solution: "SELECT vaqt, foydalanuvchi FROM jurnal WHERE amal LIKE '%kuryer_id%' AND vaqt LIKE '2026-11-16%';",
    kind: 'select',
    success: [
      "test_skript! Dasturchilar sinov uchun yozgan skript kechasi haqiqiy bazada ishlab ketgan.",
      "U barcha kutilayotgan buyurtmalarni ta'tildagi Sardorga yozib qo'ygan. Endi buni tuzatamiz.",
    ],
    questions: ['q-baza-143', 'q-baza-194'],
  },
  {
    id: 5,
    title: 'Qutqaruv',
    brief: [
      'Aybdor topildi, endi buyurtmalarni qutqaramiz. Sergelidagi Nodira bugun bo\'sh.',
      "Sardordagi kutilayotgan buyurtmalarni Nodiraga o'tkazing. Ehtiyot bo'ling: Sardor ta'tilgacha yetkazgan buyurtmalar tarixda o'zgarmay qolishi kerak!",
    ],
    task: "Kuryeri 3 bo'lgan va holati 'kutilmoqda' buyurtmalarni Nodiraga o'tkazing (UPDATE). Nodiraning id raqamini kuryerlar jadvalidan toping. Boshqa hech bir qator o'zgarmasin.",
    tables: ['buyurtmalar', 'kuryerlar'],
    chips: ['UPDATE', 'buyurtmalar', 'SET', 'kuryer_id =', 'WHERE', 'AND', "'kutilmoqda'", 'SELECT * FROM kuryerlar;'],
    hint: "Avval SELECT * FROM kuryerlar; bilan Nodiraning id raqamini toping. Keyin: UPDATE buyurtmalar SET kuryer_id = ... WHERE kuryer_id = 3 AND holat = 'kutilmoqda'.",
    solution: "UPDATE buyurtmalar SET kuryer_id = 5 WHERE kuryer_id = 3 AND holat = 'kutilmoqda';",
    kind: 'change',
    check: 'SELECT id, kuryer_id, holat FROM buyurtmalar ORDER BY id;',
    success: [
      "Ajoyib! 7 ta buyurtma yo'lga chiqdi, mijozlar ularni bugun oladi.",
      "Sardorning eski, yetkazilgan buyurtmalariga tegmaganingiz juda to'g'ri. WHERE'siz UPDATE bazani buzib yuborardi.",
      'Direktor sizni Junior lavozimiga ko\'tardi!',
    ],
    questions: ['q-baza-047', 'q-baza-053', 'q-baza-095', 'q-baza-195'],
  },
];

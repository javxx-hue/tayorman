# Ishga tushirish kuni

Qaror (2026-11-06): talabalar uchun **asosiy muhit bizniki**: `@tayormanbot`, Supabase loyihasi `tayorman`, Vercel saytlari. Sanjarning serveri (`@sessiyagatayyorlanbot`, `st.uzbek-talim.uz`) **qo'shimcha variant**: kerak bo'lganda unga o'tiladi (pastda «B variant»).

Qadamlarda: nima qilish, nega, qanday tekshirish.

---

## A variant. Bizning muhit (asosiy)

### Holat (nima tayyor)
- Bot, admin sayt, funksiyalar, cron, Gemini kaliti, kutubxona jonli ishlaydi. Jonli sinovlar (Admin tugmasi, parol bilan kirish, ovozli javob, qog'oz rasmi, muammo xabari, fayl bilan so'rov, rejalashtirilgan xabar, bloklash, talabaning admin saytga kira olmasligi) 2026-11-05 da o'tgan.
- Bot profili sozlangan: buyruqlar (`/start`, `/reja`, `/til`, `/eslatma`) va tavsif (o'zbek va rus).
- Zaxira: `npm run backup -- --project ysibxpifzylaqtqyykij`; birinchi nusxa fleshkada.
- Talabalar guruhlari (masalan, `ATT 203`) allaqachon shu botda.

### Ochishdan oldin qilinadigan ishlar
1. **Eslatmani tasdiqlash.** Muddati ertaga bo'lgan topshiriq bergan hisobga soat 08:00 da (Toshkent) eslatma kelishi kerak. Kelmasa, jurnalni ko'ring.
2. **AI limiti.** Admin sayt → Sozlamalar → kunlik limit (hozir 10). Talabalar soniga qarab 20–30 qiling. Pullik Gemini kalitiga o'tish hozircha kerak emas: muammo chiqqandagina (xatolar, sekinlik, `429`) yangi kalit va billing yoqiladi.
3. **Maxfiylik xabari.** Talabalarga ovoz va qog'oz rasmi Google Gemini'ga yuborilishini va saqlanmasligini aytish (bot yoki ilovaning boshida bir-ikki jumla).
4. **Zaxira tartibi.** Haftada bir `npm run backup`, nusxani fleshkaga ko'chirish. Talabalar ko'payganda Supabase Pro (kunlik zaxira).
5. **Tariflar.** Vercel Hobby tijoriy foydalanishga mo'ljallanmagan: daromad boshlanganda Pro. Supabase bepul tarifida loyiha uzoq faolsiz qolsa to'xtatiladi; faol foydalanishda bu xavf yo'q.
6. **Qonuniy tomon.** Supabase Parijda (eu-west-3). 2026 yil o'zgarishlaridan keyin O'zbekistonda saqlash majburiyligi faqat biometrik/genetik va telekom ma'lumotlariga tegishli; ilova ovoz yoki rasmni saqlamaydi. Baribir joriy holatni huquqshunos yoki Lex.uz orqali tekshiring.
7. **Sinov muhiti (tavsiya).** Hozir sinov va haqiqiy talabalar bitta bazada. Yangi funksiyalar talabalarga ta'sir qilmasligi uchun alohida bepul Supabase loyihasi va alohida bot oching (`npm run setup:env`, [ENVIRONMENTS.md](ENVIRONMENTS.md)).

### Bosqichma-bosqich e'lon
1. Avval 5–10 ta tanish talabaga bering, 1–2 kun kuzating: xatolar, sekinlik, Gemini limiti.
2. Muammo bo'lmasa, guruh-guruh qilib kengaytiring.
3. Birinchi kunlarda har kuni admin saytdagi «Xatolar» va «So'rovlar»ni ko'ring, AI sarfini kuzating.

### Nimadir noto'g'ri ketsa
- **Bot javob bermayapti:** `npm run check:env -- --url https://ysibxpifzylaqtqyykij.supabase.co --env supabase/functions/.env`. Webhook bo'sh bo'lsa, qayta o'rnating: `npm run setup:env -- --project ysibxpifzylaqtqyykij --env supabase/functions/.env --webhook`.
- **Kirish ishlamayapti:** `AUTH_SECRET` ni hech qachon o'zgartirmang.
- **Baza buzildi:** eng yangi zaxirani tiklang (fleshkadagi nusxa).
- **AI xatolari ko'paydi:** kunlik limitni kamaytiring, keyin pullik kalitga o'ting.

---

## B variant. Sanjarning serveri (qo'shimcha, kerak bo'lganda)

Production Sanjarning o'z serverida (Docker, o'z Supabase'i, `https://st.uzbek-talim.uz`, bot `@sessiyagatayyorlanbot`). Bu serverdagi sirlar, baza va botni Sanjar boshqaradi. Umumiy tafsilotlar: [ENVIRONMENTS.md](ENVIRONMENTS.md), «O'z serveri yo'li». Unga o'tishdan oldin quyidagilar bajarilgan bo'lishi shart:

### B1. (1-qadam) Bot tokenini almashtirish (shart, 15 daqiqa)

**Nega:** eski tokenlar git tarixida ochiq turibdi (repo ochiq, bot ID `9088363125`). Topgan odam botni boshqarishi mumkin: talabalar nomidan xabar yuborish, webhookni o'zgartirish. Token bekor qilinmaguncha bot xavfsiz emas.

1. Telegram'da **@BotFather** → `/mybots` → `@sessiyagatayyorlanbot` → **API Token** → **Revoke current token**. (Yoki `/revoke` buyrug'i.) BotFather yangi tokenni yuboradi. Uni hech kimga, hech qayerga (chat, git, skrinshot) yubormang.
2. Yangi tokenni faqat serverdagi sirlar fayliga yozing (`TELEGRAM_BOT_TOKEN`). Eski tokenni **hamma joydan** qidirib o'chiring: `.env` fayllar, `docker-compose` muhit o'zgaruvchilari, eski skriptlar, shell tarixi.
3. Edge Runtime konteynerini qayta ishga tushiring, yangi sir kuchga kirsin.
4. Webhookni yangi token bilan qayta o'rnating (loyiha papkasida):
   ```bash
   npm run setup:env -- --url https://st.uzbek-talim.uz --env <sirlar-fayli> --webhook
   ```
   «Webhook set to …/functions/v1/telegram-bot» chiqishi kerak.
5. Eski token endi ishlamasligini tekshiring: `https://api.telegram.org/bot<ESKI_TOKEN>/getMe` javobi **401 Unauthorized** bo'lishi kerak (natijani yuboring, tokenning o'zini yubormang).
6. Botga `/start` yozing: javob kelishi kerak.

### B2. (2-qadam) Gemini kalitini almashtirish va limit (shart, 15 daqiqa)

**Nega:** eski kalit ochiq oqib chiqqan bo'lishi mumkin. Bepul kalitning daqiqalik limiti kichik: bir nechta talaba bir vaqtda ovozli javob bersa, xatolar chiqadi.

1. Google AI Studio → API keys: eski kalitni **o'chiring**, yangisini yarating.
2. Kalit bog'langan Google Cloud loyihasida **billing** (to'lov hisobi) yoqilgan bo'lsin (pullik daraja ancha yuqori limit beradi).
3. Yangi kalitni `GEMINI_API_KEY` siriga yozing, konteynerni qayta ishga tushiring.
4. Admin sayt → **Sozlamalar** → kunlik AI limitini belgilang (talaba boshiga; boshlash uchun 20–30).
5. Tekshiruv: ilovada bir savolga ovozli yoki matnli javob bering, baho kelishi kerak.

### B3. (3-qadam) Zaxira (backup) (shart, 30 daqiqa)

**Nega:** o'z serveringizda bazani hech kim zaxiralamaydi. Disk buzilsa yoki xato buyruq jadvalni tozalasa, talabalar ma'lumoti butunlay yo'qoladi.

1. `scripts/backup-selfhosted.sh` ni serverda cron'ga qo'ying (kuniga bir marta). Namuna va qayta tiklash buyrug'i: [ENVIRONMENTS.md](ENVIRONMENTS.md), «Zaxira o'z serverida».
2. Bir marta qo'lda ishga tushiring: `backups/` da fayl paydo bo'lsin (hajmi 0 bo'lmasin).
3. Nusxani **boshqa joyga** ko'chiring (boshqa server yoki yopiq xotira).
4. Zaxirani bir marta test bazaga qayta tiklab ko'ring. Tiklanmagan zaxiraga ishonib bo'lmaydi.
5. Storage fayllarini (so'rovlarga ilovalar) ham `rsync` qiling.

### B4. (4-qadam) Production'ni yangilash (30 daqiqa)

**Nega:** server `main` dagi so'nggi kodni bilmaydi (`production` branchi 25 commit orqada).

```bash
git fetch origin
git checkout production && git merge --ff-only origin/main && git push origin production
git checkout development && git merge --ff-only origin/main && git push origin development
```
Keyin Mini App va admin saytni qayta build qilib joylang (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT`, `VITE_ADMIN_URL` berilgan holda; admin uchun `ADMIN_BASE=/admin/`). Migratsiyalar `0001`–`0009` hammasi bajarilganini tekshiring.

Hammasi joyida ekanini bitta buyruq ko'rsatadi:
```bash
npm run check:env -- --url https://st.uzbek-talim.uz --env <sirlar-fayli>
```
Natija «Everything looks right» bo'lishi kerak.

### B5. (5-qadam) BotFather sozlamalari (10 daqiqa)

`@BotFather` da `@sessiyagatayyorlanbot` uchun:
- **Menu Button** (Bot Settings → Menu Button): `https://st.uzbek-talim.uz` (adminlar uchun bot o'zi «Admin» tugmasini qo'yadi).
- **/setcommands** (bitta xabarda yuboring):
  ```
  reja - Bugungi reja
  til - Tilni almashtirish
  eslatma - Eslatmalarni yoqish/o'chirish
  ```
- **/setdescription** va **/setabouttext**: botning qisqa tavsifi (nima uchun, kimlar uchun).
- **/setuserpic**: bot rasmi.

### B6. (6-qadam) Production sinovi (1 soat, telefonda)

Admin hisobdan va ikkinchi (talaba) hisobdan. Har birini bajarib belgilang:

| # | Sinov | Kutilgan natija |
|---|---|---|
| 1 | Talaba: botga `/start` | Salom xabari va «Ilovani ochish» tugmasi |
| 2 | Talaba: ilovani oching | Fanlar ro'yxati (kutubxonadan kelgan), kirish xatosiz |
| 3 | Talaba: guruhga qo'shilish (taklif havolasi) | Guruh fanlari/topshiriqlari keladi |
| 4 | Talaba: ovozli javob | Matn chiqadi, baho 30 soniyadan kam |
| 5 | Talaba: qog'oz rasmi | Matnga aylanadi |
| 6 | Talaba: savolda «Xato bor» | Admin saytda «Xatolar» da ko'rinadi |
| 7 | Talaba: botga fayl yuborish | «So'rov yuborildi», admin saytda «So'rovlar» da fayl bilan |
| 8 | Admin: botdagi «Admin» tugmasi | Login va parol formasi |
| 9 | Admin: «Hisoblar» → login va parol berish, chiqib kirish | Kirish o'tadi |
| 10 | Talaba: admin saytga kirishga urinish | Rad etiladi |
| 11 | Admin: topshiriq (muddati ertaga) | Botga darhol xabar; ertaga 08:00 da eslatma |
| 12 | Admin: 2 daqiqaga rejalashtirilgan xabar (faqat test guruhiga) | O'z vaqtida keladi |
| 13 | Admin: test hisobni bloklash | U darhol chiqib ketadi, keyin blokdan chiqarish |

Hammasi o'tmaguncha e'lon qilmang.

### B7. (7-qadam) Bosqichma-bosqich e'lon

1. Avval 5–10 ta tanish talabaga bering, 1–2 kun kuzating: xatolar, sekinlik, Gemini limiti, serverdagi jurnallar.
2. Muammo bo'lmasa, guruh-guruh qilib kengaytiring (bir vaqtda hammaga emas).
3. Birinchi kunlarda har kuni: «Xatolar» va «So'rovlar» bo'limlarini ko'rib chiqing, AI sarfini (admin saytda) kuzating.

### B: Nimadir noto'g'ri ketsa

- **Bot javob bermayapti:** `npm run check:env ...` ni ishga tushiring: webhook bo'sh bo'lsa, qaysidir eski skript (polling) botni egallab olgan bo'lishi mumkin. Webhookni 1-qadamning 4-bandidagi buyruq bilan qayta o'rnating.
- **Kirish ishlamayapti:** sirlarda `AUTH_SECRET` o'zgartirilmaganini tekshiring (o'zgarsa, hamma o'z hisobiga kira olmay qoladi). Hech qachon uni o'zgartirmang.
- **Baza buzildi:** eng yangi zaxirani 3-qadamdagi buyruq bilan tiklang.
- **AI xatolari ko'paydi:** admin saytda kunlik limitni kamaytiring, Google Cloud'da kvota va billing holatini tekshiring.

### B: Tayyor deb hisoblash sharti
- [ ] Eski bot tokeni bekor qilingan (eski tokenda `getMe` → 401), yangisi faqat sirlarda.
- [ ] Gemini kaliti almashtirilgan, billing yoqilgan, kunlik limit qo'yilgan.
- [ ] Zaxira cron'da, bir marta qayta tiklab ko'rilgan, nusxa boshqa joyda.
- [ ] `production` va `development` branchlari `main` bilan teng, server shu kodda.
- [ ] `check:env` → «Everything looks right».
- [ ] 6-qadamdagi jadval to'liq o'tgan.

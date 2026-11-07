# Muhitlar va ishga tushirishdan oldingi ro'yxat

Botni haqiqiy talabalarga ochish uchun tartibli qadamlar: [LAUNCH.md](LAUNCH.md) (A: bizning muhit, B: Sanjarning serveri).

## Muhitlar

Qaror (2026-11-06): talabalar uchun **asosiy muhit bizniki**. Sanjarning serveri qo'shimcha variant (kerak bo'lganda o'tiladi).

| | Asosiy (talabalar, bizniki) | Sinov (yangi funksiyalar) | Qo'shimcha: Sanjarning serveri |
|---|---|---|---|
| Bot | `@tayormanbot` | `@tayyormantestbot` | `@sessiyagatayyorlanbot` |
| Supabase | `tayorman` (ref `ysibxpifzylaqtqyykij`), hosted | `tayorman-test` (ref `nbgyiqipwtblqvgqqjre`), hosted | o'z serveri, self-hosted |
| Saytlar | Vercel: `tayyorman-eight.vercel.app`, `tayyorman-admin.vercel.app` | Vercel: `tayyorman-test.vercel.app`, `tayyorman-admin-test.vercel.app` | `st.uzbek-talim.uz`, `/admin/` |
| Sirlar | `supabase/functions/.env` | `supabase/functions/.env.test`, `.env.testbot` (frontend) | Sanjarning serverida |
| Kod | `main` (PR orqali, CI yashil bo'lishi shart) | `feature/*` branchlari | `production` branchi |

### Sinov muhitiga joylash
Qoida: yangi funksiya **avval sinovda** sinaladi, keyin asosiyga o'tadi. Sinov muhiti haqiqiy talabalarga tegmaydi.
```bash
# server funksiyalari
npm run deploy:functions -- --project nbgyiqipwtblqvgqqjre
# migratsiya (har birini alohida)
npx supabase db query --remote=nbgyiqipwtblqvgqqjre --yes -f supabase/migrations/<fayl>.sql
# Mini App va admin sayt
node scripts/deploy-app.mjs --env .env.testbot --project tayyorman-test
node scripts/deploy-admin.mjs --env .env.testbot --project tayyorman-admin-test
# holatni tekshirish
npm run check:env -- --url https://nbgyiqipwtblqvgqqjre.supabase.co --env supabase/functions/.env.test
```
Sinov muhitida sirlar va bazaning boshqa muhitlarga aloqasi yo'q. Gemini kaliti hozircha asosiy bilan bir xil (sinov uchun yetadi).

Muhitlar **hech narsani bo'lishmaydi**: bir muhitning tokeni, kaliti yoki bazasi ikkinchisida ishlatilmaydi. Bu tasodifan haqiqiy foydalanuvchilarga xabar yuborish yoki ularning ma'lumotini buzishdan saqlaydi.

### Yangi muhit ochish (production)

Qo'lda bajariladigan qismi (hisoblar, tokenlar) va skript bajaradigan qismi ajratilgan. Hammasi `<ref>` — production Supabase loyihasi identifikatori.

**Qo'lda (siz yoki Sanjar):**
1. Yangi Supabase loyihasi; Database → Extensions'da `pg_cron` va `pg_net` yoqilgan.
2. BotFather'da production bot tokeni (eskisi `/revoke` qilingan bo'lsin) va yangi Gemini kaliti.
3. Ikkita yangi Vercel loyihasi (Mini App va admin sayt), ularning manzillari.

**Skript bilan:**
4. `supabase/functions/.env.example` ni `supabase/functions/.env.production` ga nusxalang. Unga `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`, `OWNER_TELEGRAM_IDS` (ega, adminlardan biri), `APP_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS` ni yozing (`GEMINI_MODEL` bo'sh qolsa, standart ishlaydi).
5. `npm run setup:env -- --project <ref> --env supabase/functions/.env.production`: bo'sh `AUTH_SECRET`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET` ga tasodifiy qiymat yozadi (borini o'zgartirmaydi), yana nima yetishmayotganini aytadi va cron SQL faylini yaratadi. Sirlar ekranga chiqmaydi.
6. Migratsiyalar `0001`…`0009` tartib bilan (README, 2-bosqich).
7. `npx supabase secrets set --env-file supabase/functions/.env.production --project-ref <ref>`
8. `npm run deploy:functions -- --project <ref>`
9. `supabase/functions/.env.production.cron.sql` ichidagini SQL Editor'da bir marta bajaring.
10. `npm run setup:env -- --project <ref> --env supabase/functions/.env.production --webhook` (bot shu loyihaga ulanadi).
11. `.env.production` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT`, `VITE_ADMIN_URL`) bilan `npm run deploy:app -- --env .env.production`, so'ng `npm run deploy:admin`.
12. BotFather: Menu Button = production Mini App manzili.

### O'z serveri yo'li (Docker va o'z Supabase'i)

Yuqoridagi qadamlar hosted Supabase (supabase.com) va Vercel uchun. Production o'z serverida (Docker, Caddy yoki nginx) va o'z Supabase'ida ishlasa, farqlar shular. Server tafsilotlari har xil bo'lishi mumkin; quyidagilar umumiy qoidalar.

- **Mini App va admin sayt.** `docker compose build` qiymatlarni build argumentlaridan oladi: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT`, `VITE_ADMIN_URL`. Ular serverdagi `.env` da bo'lmasa, sayt Supabase'siz build bo'ladi (kirish ishlamaydi). Build'dan keyin saytning JS fayllarida backend manzili ko'rinishi kerak.
- **Admin sayt manzili.** Admin sayt bitta domen ostida `/admin/` yo'lida turadi (`nginx/spa.conf`), shuning uchun `vite.admin.config.ts` standart holda `base: '/admin/'` bilan build qiladi. Vercel'dagi alohida admin loyiha ildizda turadi, shu sababli `npm run deploy:admin` `ADMIN_BASE=/` bilan build qiladi. Ildizda turadigan boshqa joy uchun (masalan, compose'dagi `admin` xizmati) `ADMIN_BASE=/ npm run build:admin` ishlating.
- **Bot: webhook yoki polling, ikkalasi emas.** Telegram bitta botni bir vaqtda ikki usulda xizmat qilmaydi. Eski `bot.mjs` skripti (polling) repodan olib tashlangan, lekin serverda hali ishlab turgan bo'lishi mumkin: u ishga tushganda webhookni o'chiradi. Production'da bizning funksiyali botimiz (`telegram-bot`) ishlashi uchun serverdagi `bot.mjs` jarayoni (konteyner yoki `node bot.mjs`) to'xtatilgan va o'chirilgan bo'lishi, webhook esa o'rnatilgan bo'lishi shart: `npm run setup:env -- --url https://<domen> --env <fayl> --webhook` (webhook manzili `<domen>/functions/v1/telegram-bot` bo'ladi).
- **Funksiyalar.** Hosted'dagi `npm run deploy:functions` self-hosted'ga to'g'ridan-to'g'ri tegishli emas: u yerda `supabase/functions` papkasi (`_shared` bilan) Edge Runtime konteyneri o'qiydigan papkaga nusxalanadi va konteyner qayta ishga tushiriladi. Funksiya ro'yxati `scripts/functions.mjs` da; `verifyJwt: false` bo'lganlari JWT tekshiruvisiz ishlashi kerak (Edge Runtime sozlamasida).
- **Sirlar.** Funksiyalarning sirlari (`.env.example` dagi ro'yxat) Edge Runtime konteynerining muhit o'zgaruvchilariga beriladi. `OWNER_TELEGRAM_IDS` va `ADMIN_TELEGRAM_IDS` ni unutmang. Sirlarni o'zgartirgach, konteynerni qayta ishga tushiring.
- **Migratsiyalar.** `0001`…`0009` ni Postgres'ga `psql` bilan (yoki Studio SQL muharriri orqali) tartib bilan bajaring. `pg_cron` va `pg_net` yoqilgan bo'lishi kerak, cron SQL fayli `setup:env -- --url https://<domen> --env <fayl>` dan keladi (manzillar o'z domeningiz bilan yoziladi).
- **Zaxira (backup) o'z serverida.** Hosted Supabase'ning pullik tarifida zaxira bor, o'z serveringizda esa uni hech kim qilib bermaydi. `scripts/backup-selfhosted.sh` serverning o'zida ishlaydi: Postgres konteyneridan (standart nomi `supabase-db`) hamma narsani `backups/db-<sana>.dump` fayliga yozadi, 14 kundan eskilarini o'chiradi, xato bo'lsa yarim fayl qoldirmaydi. Cron'ga kuniga bir marta qo'ying, masalan `30 2 * * * cd /home/ubuntu/sessiyagatayyorlan && DB_CONTAINER=supabase-db scripts/backup-selfhosted.sh >> backups/backup.log 2>&1`. Qayta tiklash: `docker exec -i supabase-db pg_restore -U postgres -d postgres --clean --if-exists < backups/<fayl>.dump`. Nusxani albatta **boshqa joyga** ham ko'chiring (boshqa server yoki yopiq xotira): disk buzilsa, shu serverdagi nusxa ham yo'qoladi. Storage'ga yuklangan fayllar (so'rovlarga ilovalar) bazada emas, Docker volume'da turadi: uni ham `rsync` qiling. Fayllarda shaxsiy ma'lumot bor, ularga faqat o'zingiz kira olishi kerak. Zaxirani kamida bir marta qayta tiklab ko'ring, aks holda u ishlashiga ishonch yo'q.
- **Tekshiruv.** Hammasi joyida ekanini bitta buyruq bilan ko'ring:
  `npm run check:env -- --url https://<domen> --env <fayl>`
  U funksiyalar mavjudligini, `admin-login` yangi versiyadaligini, env faylda bo'sh qiymatlar nomini va botning webhook manzilini ko'rsatadi. Hech narsani o'zgartirmaydi va sirlarni chiqarmaydi. Faqat o'zingizning muhitingizda ishlating.

## Ishga tushirishdan oldingi ro'yxat (haqiqiy talabalar kelishidan oldin)

**Xavfsizlik**
- [ ] Git tarixida ochiq qolgan eski bot tokeni (bot ID `9088363125`) BotFather'da `/revoke` qilingan va yangi token faqat sirlarda turibdi.
- [ ] Eski Gemini kaliti bekor qilingan.
- [ ] Har bir muhitning `AUTH_SECRET` i o'zining; ular hech qayerda git'ga yozilmagan (`git log -p | grep` bilan tekshirish).
- [ ] `OWNER_TELEGRAM_IDS` bitta ishonchli odam; u adminlar ro'yxatida ham bo'lishi shart. Faqat shu odam «Hisoblar» sahifasidan login va parol bera oladi.
- [ ] `ADMIN_TELEGRAM_IDS` faqat haqiqiy adminlar. (Eslatma: Sanjar qo'shgan `DEFAULT_ADMIN_IDS` ro'yxati kodda ham turibdi, `supabase/functions/_shared/users.ts`.)
- [ ] GitHub'da `main` uchun branch himoyasi: faqat Pull Request orqali, CI o'tishi shart.

**Ma'lumot**
- [ ] **Haftalik zaxira (bizning muhit):** `npm run backup:copy -- --project ysibxpifzylaqtqyykij --to E:	ayyorman-backups` (Docker yoqilgan bo'lishi kerak). U zaxirani oladi, fleshkaga ko'chiradi, nusxa asl bilan bir xilligini tekshiradi va 12 tadan eskisini o'chiradi.
- [ ] **Zaxira (backup):** o'z serverida `scripts/backup-selfhosted.sh` cron'da turibdi va bitta nusxa boshqa joyga ko'chiriladi. Hosted Supabase'ning bepul tarifida avtomatik zaxira yo'q. Pullik tarifga o'ting yoki haftada bir `npm run backup -- --project <ref>` qiling (Docker ishlab turishi va `npx supabase login` kerak; baza paroli kerak emas). Nusxa `backups/` papkasiga tushadi, git uni ko'rmaydi; ichida shaxsiy ma'lumot bor, xavfsiz joyga saqlang. Storage'dagi fayllar (so'rovlarga ilova qilinganlari) bu nusxaga kirmaydi. Bepul loyiha bir hafta faolsiz qolsa to'xtatiladi.
- [ ] Migratsiyalar tartib bilan bajarilgan (`0001`…`0009`).
- [ ] Ikkala cron ishi mavjud: `select jobname, schedule from cron.job;`

**Tarif va cheklovlar**
- [ ] Vercel Hobby tarifi tijoriy foydalanishga mo'ljallanmagan: daromad boshlanganda Pro'ga o'ting.
- [ ] Supabase bepul tarif chegaralari (baza hajmi, funksiya chaqiruvlari) kuzatilmoqda.

**Jonli tekshiruv** (har yangi muhitda, telefonda; avval `npm run check:env`)
- [ ] Talaba: kirish, guruhga qo'shilish, fan keladi, mashq, ovoz/rasm bilan javob, topshiriq, so'rov (fayl bilan).
- [ ] Admin: botdagi «Admin» tugmasi (faqat adminda), kirish, kutubxonada test tuzish, topshiriq berish va botga xabar, xabarni rejalashtirish.
- [ ] Ertalab 08:00 eslatma keldi (muddatli topshiriq bilan).
- [ ] Talaba admin saytga kira olmaydi.

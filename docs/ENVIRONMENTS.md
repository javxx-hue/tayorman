# Muhitlar va ishga tushirishdan oldingi ro'yxat

## Ikki muhit

| | Development | Production |
|---|---|---|
| Bot | `@tayormanbot` | Sanjarning boti |
| Supabase loyihasi | `tayorman` (hozirgi) | **alohida** loyiha |
| Vercel loyihalari | `tayyorman` (Mini App), `tayyorman-admin` | alohida ikkitasi |
| Sirlar | `supabase/functions/.env` | alohida to'plam; `AUTH_SECRET`, tokenlar boshqa |
| Kod | `feature/*` branchlari | `main` (PR orqali) |

Muhitlar **hech narsani bo'lishmaydi**: bir muhitning tokeni, kaliti yoki bazasi ikkinchisida ishlatilmaydi. Bu tasodifan haqiqiy foydalanuvchilarga xabar yuborish yoki ularning ma'lumotini buzishdan saqlaydi.

### Yangi muhit ochish (production)

Qo'lda bajariladigan qismi (hisoblar, tokenlar) va skript bajaradigan qismi ajratilgan. Hammasi `<ref>` — production Supabase loyihasi identifikatori.

**Qo'lda (siz yoki Sanjar):**
1. Yangi Supabase loyihasi; Database → Extensions'da `pg_cron` va `pg_net` yoqilgan.
2. BotFather'da production bot tokeni (eskisi `/revoke` qilingan bo'lsin) va yangi Gemini kaliti.
3. Ikkita yangi Vercel loyihasi (Mini App va admin sayt), ularning manzillari.

**Skript bilan:**
4. `supabase/functions/.env.example` ni `supabase/functions/.env.production` ga nusxalang. Unga `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`, `APP_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS` ni yozing (`GEMINI_MODEL` bo'sh qolsa, standart ishlaydi).
5. `npm run setup:env -- --project <ref> --env supabase/functions/.env.production`: bo'sh `AUTH_SECRET`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET` ga tasodifiy qiymat yozadi (borini o'zgartirmaydi), yana nima yetishmayotganini aytadi va cron SQL faylini yaratadi. Sirlar ekranga chiqmaydi.
6. Migratsiyalar `0001`…`0006` tartib bilan (README, 2-bosqich).
7. `npx supabase secrets set --env-file supabase/functions/.env.production --project-ref <ref>`
8. `npm run deploy:functions -- --project <ref>`
9. `supabase/functions/.env.production.cron.sql` ichidagini SQL Editor'da bir marta bajaring.
10. `npm run setup:env -- --project <ref> --env supabase/functions/.env.production --webhook` (bot shu loyihaga ulanadi).
11. `.env.production` (VITE_* qiymatlari) bilan `npm run deploy:app -- --env .env.production`, so'ng `npm run deploy:admin`.
12. BotFather: Menu Button = production Mini App manzili.

## Ishga tushirishdan oldingi ro'yxat (haqiqiy talabalar kelishidan oldin)

**Xavfsizlik**
- [ ] Git tarixida ochiq qolgan eski bot tokeni (bot ID `9088363125`) BotFather'da `/revoke` qilingan va yangi token faqat sirlarda turibdi.
- [ ] Eski Gemini kaliti bekor qilingan.
- [ ] Har bir muhitning `AUTH_SECRET` i o'zining; ular hech qayerda git'ga yozilmagan (`git log -p | grep` bilan tekshirish).
- [ ] `ADMIN_TELEGRAM_IDS` faqat haqiqiy adminlar. (Eslatma: Sanjar qo'shgan `DEFAULT_ADMIN_IDS` ro'yxati kodda ham turibdi, `supabase/functions/_shared/users.ts`.)
- [ ] GitHub'da `main` uchun branch himoyasi: faqat Pull Request orqali, CI o'tishi shart.

**Ma'lumot**
- [ ] **Zaxira (backup):** Supabase bepul tarifida avtomatik zaxira yo'q. Pullik tarifga o'ting yoki muntazam `npx supabase db dump` (DB paroli bilan) qiling va xavfsiz joyga saqlang. Bepul loyiha bir hafta faolsiz qolsa to'xtatiladi.
- [ ] Migratsiyalar tartib bilan bajarilgan (`0001`…`0006`).
- [ ] Ikkala cron ishi mavjud: `select jobname, schedule from cron.job;`

**Tarif va cheklovlar**
- [ ] Vercel Hobby tarifi tijoriy foydalanishga mo'ljallanmagan: daromad boshlanganda Pro'ga o'ting.
- [ ] Supabase bepul tarif chegaralari (baza hajmi, funksiya chaqiruvlari) kuzatilmoqda.

**Jonli tekshiruv** (har yangi muhitda, telefonda)
- [ ] Talaba: kirish, guruhga qo'shilish, fan keladi, mashq, ovoz/rasm bilan javob, topshiriq, so'rov (fayl bilan).
- [ ] Admin: botdagi «Admin» tugmasi (faqat adminda), kirish, kutubxonada test tuzish, topshiriq berish va botga xabar, xabarni rejalashtirish.
- [ ] Ertalab 08:00 eslatma keldi (muddatli topshiriq bilan).
- [ ] Talaba admin saytga kira olmaydi.

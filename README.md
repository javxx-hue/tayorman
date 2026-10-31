# Tayyorman

Sessiya va oraliq nazoratlarga tayyorlanish uchun **Telegram bot + Mini App**. Hozircha SamDU talabalariga mo'ljallangan, lekin kirish hamma uchun ochiq. Hammasi bepul (beta).

## Nima qiladi

**Bot (chat):**
- `/start` — salomlashish va Mini App tugmasi; `t.me/<bot>?start=c_<kod>` havolasi orqali guruhga qo'shilish.
- Har qanday matn, fayl yoki rasm adminga so'rov bo'lib boradi (talaba o'zi fan yoki material yaratmaydi). Admin javobi botga keladi.
- Ovozli javob: ilovada savolni oching → «Botda ovoz bilan» → botga ovozli xabar yuboring, AI tinglab baholaydi.
- `/reja` (bugungi reja), `/til` (o'zbek/rus), `/eslatma`. Har kuni 08:00 da reja avtomatik keladi.

**Mini App:**
- **Bugun** — bugungi reja, ketma-ket kunlar, oxirgi to'plamlar.
- **Fanlar** — imtihon sanasi va shakli, materiallar (PDF, PPTX, DOCX, rasm, YouTube), imtihon savollari ro'yxati, namunaviy javob, AI baholash yoki «Bilaman / Qisman / Bilmayman» (AI limiti tugaganda ham ishlaydi), test va kartalar (FSRS takrorlash), tayyorlik foizi.
- **Kutubxona** — admin chop etgan fan va to'plamlar; «Qo'shish» bilan o'zingizniki bo'ladi.
- **Profil** — til, OTM, guruhlar, eslatmalar.
- **Admin** (faqat adminlarga) — statistika, guruhlar va taklif havolalari, kutubxonaga chop etish (kimga ko'rinishini siz tanlaysiz), tanlangan auditoriyaga xabar.

AI kuniga har bir foydalanuvchiga 30 ta so'rov bilan cheklangan (`AI_DAILY_LIMIT`). Kalit faqat serverda.

## Tuzilma

```
src/                  Mini App (React + Vite + TypeScript)
supabase/migrations/  ma'lumotlar bazasi sxemasi (RLS bilan)
supabase/functions/   server: telegram-auth, telegram-bot, bot-action,
                      gemini, admin-broadcast, telegram-reminders
```

Mini App ochilganda `telegram-auth` Telegram imzosini (initData) tekshiradi va Supabase sessiyasini beradi. Parol va email yo'q. Foydalanuvchi ma'lumotlari brauzerda saqlanadi va Supabase'ga nusxalanadi.

## Ishga tushirish (bir marta sozlash)

### 1. Hisoblar
- **Bot:** [@BotFather](https://t.me/BotFather) → `/newbot` → token. `/setdomain` shart emas. Mini App: `/newapp` yoki `/mybots` → Bot Settings → Menu Button → URL (deploydan keyin).
- **Supabase:** [supabase.com](https://supabase.com) → yangi loyiha (region: Frankfurt).
- **Gemini kaliti:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
- **Telegram ID'ingiz:** [@userinfobot](https://t.me/userinfobot) → raqam. Bu sizni admin qiladi.

### 2. Baza
Supabase → **SQL Editor** → [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) ni ishga tushiring.

### 3. Sirlar
`supabase/functions/.env` (shablon: `.env.example`) ni to'ldiring: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`, `APP_URL` (Mini App manzili), `ALLOWED_ORIGINS` (xuddi shu manzil). `AUTH_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET` tasodifiy uzun qiymatlar; **`AUTH_SECRET` ni keyin o'zgartirmang**.

```bash
npx supabase login
npx supabase link --project-ref <loyiha-ref>
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy telegram-auth
npx supabase functions deploy gemini
npx supabase functions deploy bot-action
npx supabase functions deploy admin-broadcast
npx supabase functions deploy telegram-reminders
npx supabase functions deploy telegram-bot --no-verify-jwt
```

### 4. Botni ulash
```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<loyiha-ref>.supabase.co/functions/v1/telegram-bot&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### 5. Kunlik eslatma (08:00 Toshkent)
**Database → Extensions**: `pg_cron` va `pg_net` ni yoqing, so'ng SQL Editor'da:
```sql
select cron.schedule('daily-reminders', '0 3 * * *', $$
  select net.http_post(
    url := 'https://<loyiha-ref>.supabase.co/functions/v1/telegram-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'x-cron-secret', '<CRON_SECRET>')
  );
$$);
```

### 6. Mini App'ni joylash
`.env` ga `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT` ni yozing. Vercel yoki Netlify'da: build `npm run build`, papka `dist`, barcha yo'llar `index.html` ga yo'naltirilsin (SPA rewrite), `VITE_*` qiymatlarni hosting sozlamalariga ham kiriting. Manzilni `APP_URL`, `ALLOWED_ORIGINS` va BotFather menyu tugmasiga qo'ying.

## Admin sayti

Alohida veb sahifa (`admin/`), talabalar ilovasidan butunlay ajratilgan. Kirish: saytdagi "Telegram orqali kirish" tugmasi botni ochadi, bot kodni ko'rsatib "Tasdiqlash" tugmasini yuboradi (parol yo'q, `/setdomain` kerak emas). Faqat `ADMIN_TELEGRAM_IDS` dagilar (admin) va ular tayinlagan moderatorlar kira oladi. Sessiya 8 soat.

```bash
npm run dev:admin        # http://localhost:5174
node scripts/deploy-admin.mjs   # build + alohida Vercel loyihasi (tayyorman-admin)
```

Sozlash: baza uchun `supabase/migrations/0002_admin.sql`, so'ng `0003_admin_login.sql` ni SQL Editor'da ishga tushiring; `ALLOWED_ORIGINS` ga admin sayti manzilini qo'shing; `admin-login` funksiyasini `--no-verify-jwt` bilan joylang. `AI_DAILY_LIMIT` siri endi ishlatilmaydi: AI limiti admin saytida (foydalanuvchi > guruh > umumiy).

Reja va bosqichlar: [docs/ADMIN_PLAN.md](docs/ADMIN_PLAN.md).

## Ishlab chiqish

```bash
npm install
npm run dev        # http://localhost:5173 — Telegramdan tashqarida lokal rejim (server yo'q)
npm test           # vitest
npm run typecheck
```

Mini App faqat Telegram ichida to'liq ishlaydi; oddiy brauzerda production build «Telegram ichida oching» deb yozadi, dev build esa lokal ma'lumotlar bilan ochiladi.

## Eslatmalar
- Bot nomi va brend hozircha vaqtincha «Tayyorman».
- To'lov yo'q: barcha rejimlar bepul. Keyin tarif qo'shish uchun `profiles` jadvaliga maydon qo'shiladi.
- Bir martalik xabar yuborish (`admin-broadcast`) bitta so'rovda 2500 tagacha foydalanuvchiga ishlaydi; kattaroq auditoriya uchun bo'laklash kerak bo'ladi.
- Ovozli javob 20 MB gacha (Telegram cheklovi).

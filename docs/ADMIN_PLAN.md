# Admin panel va talabalar oqimi: reja

Qabul qilingan qarorlar:
- **Topshiriq** = mazmun (fan yoki to'plam) + guruhlar + muddat.
- **Admin sayti** = alohida veb sahifa, kirish botdagi bir martalik havola orqali, faqat adminlar ID ro'yxatidagilarga.
- **Takliflar** = talabadan adminga «Taklif qutisi».
- **Talabalar oqimi** = tushunarsiz yo'llarni olib tashlash (sehrgar kerak emas).

## 1-bosqich: Admin sayti (alohida, faqat adminlar)
- Alohida Vite kirish nuqtasi `admin/` va alohida Vercel loyihasi (talabalar yuklaydigan faylda admin kodi bo'lmaydi).
- Kirish: botga `/admin` yozilsa, ID `ADMIN_TELEGRAM_IDS` ichida bo'lsa, 5 daqiqalik bir martalik havola keladi.
  - Jadval `admin_login_tokens` (token xeshi, user, muddat, ishlatilgan).
  - Funksiya `admin-login`: tokenni tekshiradi, bir marta ishlatadi, Supabase sessiyasini beradi.
  - Har bir so'rov bazada `is_admin()` bilan yana tekshiriladi (sayt ham, Mini App ham).
- Admin yorlig'i Mini App'dan olib tashlanadi.
- Adminlar ro'yxati: Telegram ID'lar, `ADMIN_TELEGRAM_IDS` sirida (vergul bilan).

## 2-bosqich: Topshiriqlar
- Jadvallar: `assignments` (sarlavha, izoh, kutubxona elementi, guruhlar yoki hamma, muddat), `assignment_progress` (topshiriq, talaba, holat, ball).
- Admin: fan/to'plam yaratadi, ayni shu oynada **guruhlarni tanlaydi** va muddat qo'yadi, «Yuborish» bosadi.
- Bot: tanlangan guruhlar a'zolariga xabar + «Ochish» tugmasi.
- Talaba: bosh sahifada «Topshiriqlar» (muddat bilan), bajarilganda belgi.
- Admin: har guruh bo'yicha nechtasi boshladi/bajardi, o'rtacha ball.

## 3-bosqich: Taklif qutisi
- Jadval `suggestions` (talaba, tur, matn, holat: yangi/ko'rildi/qabul qilindi/rad etildi, admin javobi).
- Talaba: Profil va fan sahifasida «Adminga yozish» (tur: yangi fan, savollar ro'yxati, xato, boshqa).
- Admin: botda yangi taklif haqida xabar, saytda ro'yxat va holatlar, javob bot orqali talabaga boradi.

## 4-bosqich: Talabalar oqimini tozalash
Olib tashlanadi yoki soddalashtiriladi:
- Fan yaratishdagi «Imtihon shakli» tanlovi (talabaga kerak emas).
- Savollar kiritilmaguncha «Tayyorlik 0%» chizig'i.
- «Test va kartalar» yorlig'i materialsiz ko'rinmaydi, nomi «Mashq».
- «YouTube» va «Matn joylashtirish» bir maydonga birlashtiriladi («Material qo'shish»).
- AI atamalari va texnik xabarlar oddiy tilga o'tkaziladi.
- Bo'sh holatlarda bitta aniq tugma: «Birinchi fanni qo'shish».
- Kutubxonada topshiriq bo'lsa, birinchi bo'lib shu ko'rsatiladi.

## Ish tartibi (Sanjar bilan)
- Ish alohida branch'da: `feature/admin-web`. `main` ga faqat Pull Request orqali.
- Sanjar: Docker/CI va o'z joylashi. `src/` va `supabase/` ga tegsa, avval kelishamiz.

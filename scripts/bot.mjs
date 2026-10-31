// Standalone Long-Polling Telegram Bot for @sessiyagatayyorlanbot
// Built with native node:https (IPv4 enforced, rock-solid)
import https from 'node:https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '9088363125:AAFQ8Gtfnjl5G04n_aHRUPKbocAlg1QDuLo';
const APP_URL = process.env.APP_URL || 'https://st.uzbek-talim.uz';

const WELCOME_TEXT = (name) => `Salom, ${name || 'talaba'}! 👋

«Sessiyaga tayyorlan» — sessiya va oraliq nazoratlarga tayyorlanish platformasi:
• Fanlar, oraliq va yakuniy imtihon savollari
• Test imtihoni simulyatori (vaqt hisobi va xatolar tahlili)
• Yozma imtihon biletlari va namunaviy qisqa tezislar
• O'z-o'zini tekshirish va takrorlash

Tayyorlanishni boshlash uchun pastdagi «📚 Mini Appni ochish» tugmasini bosing!`;

const KEYBOARD = {
  inline_keyboard: [
    [
      {
        text: '📚 Mini Appni ochish',
        web_app: { url: APP_URL },
      },
    ],
  ],
};

function api(method, body = {}) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        family: 4,
        timeout: 40000,
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(buf));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', (err) => {
      console.error(`Telegram API xatosi (${method}):`, err.message);
      resolve(null);
    });
    req.write(data);
    req.end();
  });
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const from = msg.from || {};
  const name = from.first_name || '';
  const text = (msg.text || '').trim();

  console.log(`[Xabar] ${chatId} (${name}): ${text}`);

  if (text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/yordam')) {
    await api('sendMessage', {
      chat_id: chatId,
      text: WELCOME_TEXT(name),
      reply_markup: KEYBOARD,
    });
    return;
  }

  // Har qanday boshqa xabar uchun ham qulay Mini App tugmasi
  await api('sendMessage', {
    chat_id: chatId,
    text: `Imtihon savollari, test simulyatori va konspektlar Mini App ichida.\nQuyidagi tugma orqali ilovaga kiring:`,
    reply_markup: KEYBOARD,
  });
}

async function startPolling() {
  console.log(`>>> @sessiyagatayyorlanbot polling boshlandi...`);
  console.log(`>>> Mini App manzili: ${APP_URL}`);

  // Oldingi webhooklarni tozalash (polling ishlashi uchun)
  await api('deleteWebhook', { drop_pending_updates: false });

  // Bot buyruqlarini sozlash
  await api('setMyCommands', {
    commands: [
      { command: 'start', description: 'Botni ishga tushirish va Mini App' },
      { command: 'yordam', description: "Qo'llanma va ma'lumot" },
    ],
  });

  // Chat menyu tugmasini sozlash
  await api('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: '📚 Ochish',
      web_app: { url: APP_URL },
    },
  });

  let offset = 0;

  while (true) {
    try {
      const data = await api('getUpdates', {
        offset,
        timeout: 20,
        allowed_updates: ['message', 'callback_query'],
      });

      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message) {
            await handleMessage(update.message);
          }
        }
      }
    } catch (err) {
      console.error('Polling sikl xatosi:', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

startPolling();

/**
 * =============================================================================
 *  WHATSAPP MULTI ACCOUNT BOT - PERSISTENT TYPING (PM2 READY)
 *  Tetap melanjutkan ketikan setelah restart
 * =============================================================================
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const fs = require('fs');

// =========================== KONFIGURASI ===========================
const ACCOUNTS = [
  { name: "Akun1", folder: "auth_akun1" },
  { name: "Akun2", folder: "auth_akun2" },
];

const EMOJIS = ['💛','💙','💜','💚','❤','💔','💗','💓','💕','💖','💞','💘','💌'];

const FEATURE = {
  AUTO_REACT: true,
  AUTO_SEEN: true,
  ALWAYS_TYPING: true,
  ALWAYS_RECORDING: false,
  AUTO_VIEW_STATUS: true,
  AUTO_LOVE_GREEN: true,     // 💚 Love Hijau
  AUTO_LOVE_RED: true,       // ❤️ Love Merah
};

const ACTIVE_FILE = 'active_chats.json';
const activePresence = new Map();

// =========================== HELPER ===========================
function getRandomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveActiveChats() {
  try {
    const data = Array.from(activePresence.keys());
    fs.writeFileSync(ACTIVE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function loadActiveChats() {
  try {
    if (fs.existsSync(ACTIVE_FILE)) {
      return JSON.parse(fs.readFileSync(ACTIVE_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
}

// =========================== START ACCOUNT ===========================
async function startAccount(account) {
  console.log(`🚀 Menjalankan ${account.name}...`);

  const { state, saveCreds } = await useMultiFileAuthState(account.folder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: [`${account.name}`, "Chrome", "1.0"],
    markRead: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log(`📱 QR Code untuk ${account.name}`);
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log(`✅ ${account.name} Sudah Siap!!`);
    }

    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode === DisconnectReason.connectionReplaced) {
        console.log(`🛑 ${account.name} dipakai di HP lain`);
        return;
      }
      console.log(`🔄 Reconnecting ${account.name}...`);
      setTimeout(() => startAccount(account), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;

      const jid = m.key.remoteJid;

      if (jid === 'status@broadcast' && FEATURE.AUTO_VIEW_STATUS) {
        await sock.readMessages([m.key]).catch(() => {});
        continue;
      }

      if (FEATURE.AUTO_SEEN) await sock.readMessages([m.key]).catch(() => {});

      // Auto React + Love
      if (FEATURE.AUTO_REACT) {
        await sock.sendMessage(jid, { react: { text: getRandomEmoji(), key: m.key } }).catch(() => {});
      }
      if (FEATURE.AUTO_LOVE_GREEN) {
        await sock.sendMessage(jid, { react: { text: '💚', key: m.key } }).catch(() => {});
      }
      if (FEATURE.AUTO_LOVE_RED) {
        await sock.sendMessage(jid, { react: { text: '❤️', key: m.key } }).catch(() => {});
      }

      // Persistent Typing
      if ((FEATURE.ALWAYS_TYPING || FEATURE.ALWAYS_RECORDING) && !jid.endsWith('@g.us')) {
        if (!activePresence.has(jid)) {
          const mode = FEATURE.ALWAYS_RECORDING ? "recording" : "composing";
          await sock.presenceSubscribe(jid).catch(() => {});

          const interval = setInterval(async () => {
            try { await sock.sendPresenceUpdate(mode, jid); } catch {}
          }, 2500);

          activePresence.set(jid, interval);
          saveActiveChats();
          console.log(`🔄 [${account.name}] Nonstop ${mode} → ${jid}`);
        }
      }
    }
  });
}

// =========================== START ALL ===========================
async function startAll() {
  console.log(`\n🤖 MEMULAI ${ACCOUNTS.length} AKUN WHATSAPP...\n`);
  
  for (const acc of ACCOUNTS) {
    startAccount(acc);
    await sleep(4000);
  }
}

startAll();

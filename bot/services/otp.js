const { getISTTime } = require('./time');
const db = require('./db');

// In-memory token storage: Map<string, { token: string, admin: any, expiresAt: number, attempts: number }>
const pendingTokens = new Map();
// In-memory legacy OTP storage: Map<string, { code: string, expiresAt: number, attempts: number }>
const pendingOtps = new Map();

/**
 * Generate a 4-character mix of capital letters and numbers
 * Example: 8F2K, 3M9Y, K7B4, 9W2A
 */
function generateAlphanumericToken(length = 4) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // excludes ambiguous 0/O, 1/I
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure it contains at least one letter and at least one digit
  const hasLetter = /[A-Z]/.test(result);
  const hasNumber = /[0-9]/.test(result);
  if (!hasLetter || !hasNumber) {
    return generateAlphanumericToken(length);
  }
  return result;
}

/**
 * Generate and dispatch a 4-character token to the verified Admin Telegram Bot
 */
async function sendPhoneToken(bot, phone) {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.substring(2);
  }

  if (cleanPhone.length !== 10) {
    throw new Error('Please enter a valid 10-digit mobile number (e.g. 9149847965).');
  }

  // 1. Strict Security Check: Verify Phone Number is bound to an authorized Admin Telegram ID
  const admin = await db.getAdminByPhone(cleanPhone);
  if (!admin || !admin.telegram_chat_id) {
    throw new Error('Access Denied: Phone number is not registered as an authorized Admin. Only linked Telegram administrators can log in.');
  }

  // 2. Generate 4-digit mix of capital letters and numbers
  const token = generateAlphanumericToken(4);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

  // Save to pending tokens
  pendingTokens.set(cleanPhone, {
    token,
    admin,
    expiresAt,
    attempts: 0,
  });

  const now = getISTTime();

  const message = `
🔐 <b>DeskFlow Admin Login Security Token</b>
━━━━━━━━━━━━━━━━━━━━━
A web dashboard login attempt was initiated for:
👤 <b>Admin:</b> ${admin.name}
📞 <b>Phone:</b> <code>+91 ${cleanPhone}</code>
🕒 <b>Time:</b> ${now} (IST)

🔑 <b>Your 4-Digit Security Token:</b>
<blockquote>👉 <b><code>${token}</code></b></blockquote>

⏱ <i>This token is strictly valid for 5 minutes.</i>
⚠️ <i>If you did not initiate this login, someone tried accessing your dashboard. Never share this code.</i>
`;

  try {
    await bot.api.sendMessage(admin.telegram_chat_id, message, {
      parse_mode: 'HTML',
    });
    console.log(`[Admin Token] Dispatched 4-digit token [${token}] to Telegram Chat ID ${admin.telegram_chat_id} for +91 ${cleanPhone}`);
    return {
      success: true,
      phone: cleanPhone,
      adminName: admin.name,
      maskedPhone: cleanPhone.substring(0, 2) + '******' + cleanPhone.substring(8),
    };
  } catch (error) {
    console.error('Failed to send Telegram token:', error);
    throw new Error('Failed to send token to Telegram. Make sure you tapped /start on @controllibrarybot');
  }
}

/**
 * Verify submitted 4-character token
 */
async function verifyPhoneToken(bot, phone, inputToken) {
  let cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.substring(2);
  }

  const record = pendingTokens.get(cleanPhone);
  if (!record) {
    throw new Error('No pending login token found. Please request a new token.');
  }

  if (Date.now() > record.expiresAt) {
    pendingTokens.delete(cleanPhone);
    throw new Error('Token has expired. Please request a new code.');
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    pendingTokens.delete(cleanPhone);
    throw new Error('Too many invalid attempts. Please request a new token.');
  }

  if (record.token.toUpperCase() !== (inputToken || '').trim().toUpperCase()) {
    throw new Error('Invalid 4-digit token. Please check your Telegram alert and try again.');
  }

  // Verification passed!
  pendingTokens.delete(cleanPhone);
  const admin = record.admin;
  const now = getISTTime();

  // Send login confirmation notice to Telegram
  if (admin.telegram_chat_id) {
    try {
      await bot.api.sendMessage(
        admin.telegram_chat_id,
        `✅ <b>Admin Web Login Approved!</b>\n━━━━━━━━━━━━━━━━━━━━━\nAccess granted to DeskFlow Dashboard.\n👤 <b>Admin:</b> ${admin.name}\n📞 <b>Phone:</b> <code>+91 ${cleanPhone}</code>\n🕒 <b>Time:</b> ${now} (IST)`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error('Failed to send login confirmation message:', e);
    }
  }

  return {
    success: true,
    verified: true,
    user: {
      accountNo: admin.id || 'ADM-001',
      name: admin.name,
      phone: cleanPhone,
      email: admin.email || 'admin@deskflow.com',
      role: ['admin', 'librarian'],
    },
  };
}

/**
 * Legacy: Generate and dispatch a 6-digit OTP via Telegram for email
 */
async function sendTelegramOtp(bot, email, chatId) {
  if (!chatId) {
    throw new Error('Librarian Telegram Chat ID is not configured.');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  pendingOtps.set(email.toLowerCase().trim(), {
    code,
    expiresAt,
    attempts: 0,
  });

  const now = getISTTime();

  const message = `
🔐 <b>DeskFlow Two-Factor Authentication</b>
━━━━━━━━━━━━━━━━━━━━━
A librarian login attempt was requested on the web dashboard.

👤 <b>Account:</b> <code>${email}</code>
🕒 <b>Time:</b> ${now}

🔑 <b>Your 2-Step Security Code:</b>
<blockquote>👉 <b><code>${code}</code></b></blockquote>

⏱ <i>This code expires in 5 minutes.</i>
⚠️ <i>If you did not initiate this login, please ignore this alert.</i>
`;

  try {
    await bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
    });
    console.log(`[2FA] Dispatched OTP ${code} to Telegram Chat ID ${chatId} for ${email}`);
    return { success: true, email };
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    throw new Error('Failed to send verification code to Telegram bot. Make sure you tapped /start on @controllibrarybot');
  }
}

/**
 * Legacy: Verify submitted email OTP code
 */
async function verifyTelegramOtp(bot, email, inputCode, chatId) {
  const key = email.toLowerCase().trim();
  const record = pendingOtps.get(key);

  if (!record) {
    throw new Error('No pending verification code found. Please request a new code.');
  }

  if (Date.now() > record.expiresAt) {
    pendingOtps.delete(key);
    throw new Error('Verification code has expired. Please request a new one.');
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    pendingOtps.delete(key);
    throw new Error('Too many invalid attempts. Please request a new code.');
  }

  if (record.code !== inputCode.trim()) {
    throw new Error('Invalid 6-digit verification code. Please check your Telegram message and try again.');
  }

  pendingOtps.delete(key);

  if (chatId) {
    try {
      const now = getISTTime();
      await bot.api.sendMessage(
        chatId,
        `✅ <b>Web Login Approved!</b>\n━━━━━━━━━━━━━━━━━━━━━\nAccess granted to DeskFlow Admin Dashboard.\n👤 <b>User:</b> <code>${email}</code>\n🕒 <b>Time:</b> ${now} (IST)`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {
      console.error('Failed to send login confirmation message:', e);
    }
  }

  return { success: true, verified: true };
}

module.exports = {
  sendPhoneToken,
  verifyPhoneToken,
  sendTelegramOtp,
  verifyTelegramOtp,
  generateAlphanumericToken,
};

const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const db = require('./services/db');
const {
  sendReceiptEmail,
  sendReminderEmail,
  sendWifiCredentialsEmail,
  broadcastWifiCredentials,
  sendAnnouncementEmail,
  broadcastAnnouncement,
} = require('./services/email');
const { sendPhoneToken, verifyPhoneToken, sendTelegramOtp, verifyTelegramOtp } = require('./services/otp');
const { getISTTime, getISTDate, getISTDateString } = require('./services/time');

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID ? parseInt(process.env.ADMIN_CHAT_ID, 10) : 0;
const WEB_APP_URL = process.env.WEB_APP_URL || '';
const PORT = process.env.PORT || 5001;

if (!BOT_TOKEN) {
  console.error('FATAL: TELEGRAM_BOT_TOKEN is missing in bot/.env');
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// In-memory conversation state for interactive admin input (e.g. custom fee amounts)
const adminFlowState = new Map();
// In-memory state for 2-step attendance verification (Contact -> Location)
const pendingAttendanceState = new Map();

// ==============================================================================
// 1. Interactive Keyboards & Menus
// ==============================================================================

function getMainMenuKeyboard() {
  const kb = new InlineKeyboard()
    .text('🪑 Desk Matrix', 'menu_desks')
    .text('👥 Students', 'menu_students')
    .row()
    .text('💳 Collect Fee', 'menu_fees')
    .text('⚠️ Defaulters & Dues', 'menu_defaulters')
    .row()
    .text('📍 Live Attendance', 'menu_attendance')
    .text('📥 Admissions Queue', 'menu_admissions')
    .row()
    .text('📊 Daily Stats', 'menu_stats')
    .text('📷 Attendance QRs', 'menu_qrs')
    .row()
    .text('🛡 GPS Geofence (75m)', 'menu_geofence')
    .text('📶 WiFi Credentials', 'menu_wifi')
    .row()
    .text('📢 Post Announcement', 'menu_announcement')
    .row();

  if (WEB_APP_URL) {
    kb.webApp('🚀 Open DeskFlow WebApp', WEB_APP_URL).row();
  }

  kb.text('🔄 Refresh Menu', 'menu_main');
  return kb;
}

// ==============================================================================
// 2. Bot Commands & Navigation
// ==============================================================================

bot.command('start', async (ctx) => {
  const param = ctx.match?.trim().toLowerCase();

  // 1. Entrance Check-In QR Scan (t.me/controllibrarybot?start=in)
  if (param === 'in' || param === 'checkin') {
    const contactKb = new Keyboard()
      .requestContact('📱 Tap to Share Phone Number & Check In')
      .oneTime()
      .resized();

    return ctx.reply(`
🚪 <b>Vertical Classes Library — Entrance Check-In</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Welcome to the study hall! To confirm your arrival and mark your desk present:

👇 <b>Tap the button below to share your phone number:</b>
<i>(Your attendance and seat number will be verified automatically from our database.)</i>
`, {
      parse_mode: 'HTML',
      reply_markup: contactKb,
    });
  }

  // 2. Exit Check-Out QR Scan (t.me/controllibrarybot?start=out)
  if (param === 'out' || param === 'checkout') {
    const contactKb = new Keyboard()
      .requestContact('📱 Tap to Share Phone Number & Check Out')
      .oneTime()
      .resized();

    return ctx.reply(`
🚪 <b>Vertical Classes Library — Exit Check-Out</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Leaving for the day? To log your total study hours:

👇 <b>Tap the button below to share your phone number & Check Out:</b>
`, {
      parse_mode: 'HTML',
      reply_markup: contactKb,
    });
  }

  // 3. Default Admin / Management Menu
  ADMIN_CHAT_ID = ctx.chat.id;
  const name = ctx.from?.first_name || 'Librarian';
  const adminPhone = process.env.ADMIN_PHONE || '9149847965';

  const welcomeText = `
🏛 <b>Welcome to DeskFlow Operating System!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
Hello, <b>${name}</b>! You are authenticated as the <b>Lead Librarian & Admin</b>.

🔐 <b>Admin Login Token Active:</b> Web login tokens (4-digit code) arrive here.
📱 <b>Linked Admin Phone:</b> <code>+91 ${adminPhone}</code>
<i>(To change, send: <code>/setphone [10-digit number]</code>)</i>

📧 <b>Resend Email Engine:</b> Receipts & Reminders sent from <code>receipts@globalpulse24.in</code>.
📍 <b>QR Attendance System:</b> Live Check-In / Check-Out scanning active.

<i>Select an option below to manage the library:</i>
`;

  await ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
});

// Admin Command to Link / Update Admin Phone
bot.command('setphone', async (ctx) => {
  const phoneInput = ctx.match?.trim();
  if (!phoneInput) {
    return ctx.reply(`
📱 <b>Link Admin Phone Number</b>
━━━━━━━━━━━━━━━━━━━━━
To bind your Telegram account to your mobile phone for secure web dashboard login:

Send: <code>/setphone [Your 10-Digit Mobile Number]</code>
<i>Example: <code>/setphone 9149847965</code></i>
`, { parse_mode: 'HTML' });
  }

  try {
    const admin = await db.linkAdminPhone(ctx.chat.id, phoneInput, ctx.from?.first_name || 'Admin');
    ADMIN_CHAT_ID = ctx.chat.id;
    await ctx.reply(`
✅ <b>Admin Phone Successfully Linked!</b>
━━━━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${admin.name}
📱 <b>Phone:</b> <code>+91 ${admin.phone}</code>
💬 <b>Telegram Chat ID:</b> <code>${ctx.chat.id}</code>

🔐 When you enter <b>${admin.phone}</b> on the DeskFlow web login, your 4-digit security token will arrive right here in this chat!
`, { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply(`❌ Failed to link phone: ${err.message}`);
  }
});

bot.command('checkin', async (ctx) => {
  const contactKb = new Keyboard()
    .requestContact('📱 Tap to Share Phone Number & Check In')
    .oneTime()
    .resized();

  await ctx.reply(`🚪 <b>Entrance Check-In:</b> Tap below to share phone number:`, {
    parse_mode: 'HTML',
    reply_markup: contactKb,
  });
});

bot.command('checkout', async (ctx) => {
  const contactKb = new Keyboard()
    .requestContact('📱 Tap to Share Phone Number & Check Out')
    .oneTime()
    .resized();

  await ctx.reply(`🚪 <b>Exit Check-Out:</b> Tap below to log out and record hours:`, {
    parse_mode: 'HTML',
    reply_markup: contactKb,
  });
});

bot.command(['wifi', 'wificreds'], async (ctx) => {
  await renderWifiMenu(ctx, false);
});

bot.command(['announce', 'broadcast'], async (ctx) => {
  await renderAnnouncementMenu(ctx, false);
});

// Interactive Text Handler for Custom Amount Input, WiFi Setup & Announcements
bot.on('message:text', async (ctx, next) => {
  const chatId = ctx.chat.id;
  const state = adminFlowState.get(chatId);

  // Announcement Flow - Step 1: Subject / Title
  if (state && state.action === 'awaiting_announcement_subject') {
    const rawSubject = ctx.message.text.trim();
    if (!rawSubject || rawSubject.length < 3) {
      return ctx.reply('⚠️ <b>Subject Too Short!</b>\nPlease type a descriptive announcement title (at least 3 characters):', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Cancel', 'menu_announcement'),
      });
    }

    adminFlowState.set(chatId, {
      action: 'awaiting_announcement_body',
      subject: rawSubject,
    });

    return ctx.reply(`
📢 <b>Post Announcement to Students (Step 2 of 2)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Subject:</b> <code>${rawSubject}</code>

💬 <b>Now reply with the full Announcement Message:</b>
<i>(You can write multiple paragraphs, bullet points, schedules, notes, or instructions.)</i>
`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Cancel', 'menu_announcement'),
    });
  }

  // Announcement Flow - Step 2: Message Body
  if (state && state.action === 'awaiting_announcement_body') {
    const rawBody = ctx.message.text.trim();
    if (!rawBody || rawBody.length < 5) {
      return ctx.reply('⚠️ <b>Message Too Short!</b>\nPlease type a clear message for students (at least 5 characters):', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Cancel', 'menu_announcement'),
      });
    }

    const subject = state.subject;
    adminFlowState.set(chatId, {
      action: 'announcement_preview',
      subject: subject,
      body: rawBody,
    });

    const students = await db.getActiveStudentsForWifi();

    const previewText = `
📢 <b>Announcement Preview & Confirmation</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Subject:</b>
<b>${subject}</b>

📝 <b>Message:</b>
${rawBody}

👥 <b>Recipients:</b> <b>${students.length} active students</b> will receive this individual branded email.
📧 <b>Sender:</b> Vertical Classes Library &lt;receipts@globalpulse24.in&gt;

👇 <b>Ready to send to all ${students.length} students?</b>
`;

    const kb = new InlineKeyboard()
      .text('🚀 Broadcast to All Students Now', 'announcement_broadcast_now')
      .row()
      .text('✏️ Re-compose', 'announcement_compose_start')
      .text('🔙 Cancel', 'menu_announcement');

    return ctx.reply(previewText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  }

  // WiFi Setup Flow - Step 1: SSID (Network Name)
  if (state && state.action === 'awaiting_wifi_ssid') {
    const rawSsid = ctx.message.text.trim();
    if (!rawSsid || rawSsid.length < 2) {
      return ctx.reply('⚠️ <b>Invalid Wi-Fi Name!</b>\nPlease type a valid Network Name / SSID (at least 2 characters):', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Cancel', 'menu_wifi'),
      });
    }

    adminFlowState.set(chatId, {
      action: 'awaiting_wifi_password',
      ssid: rawSsid,
    });

    return ctx.reply(`
📶 <b>Step 2 of 2: Enter Wi-Fi Password</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 <b>Network Name (SSID):</b> <code>${rawSsid}</code>

💬 <b>Please reply with the Wi-Fi Password:</b>
<i>(Example: <code>StudySafe@2026</code> or <code>Vertical#9988</code>)</i>
`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Cancel', 'menu_wifi'),
    });
  }

  // WiFi Setup Flow - Step 2: Password
  if (state && state.action === 'awaiting_wifi_password') {
    const rawPassword = ctx.message.text.trim();
    if (!rawPassword || rawPassword.length < 4) {
      return ctx.reply('⚠️ <b>Password Too Short!</b>\nPlease type a secure Wi-Fi password (at least 4 characters):', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Cancel', 'menu_wifi'),
      });
    }

    const ssid = state.ssid;
    adminFlowState.delete(chatId);

    try {
      const updatedCreds = await db.updateWifiCredentials({
        ssid: ssid,
        password: rawPassword,
        updated_by: ctx.from?.first_name || 'Admin',
      });

      const kb = new InlineKeyboard()
        .text('🚀 Share Credentials with Students', 'wifi_share_confirm')
        .row()
        .text('✏️ Change Details', 'wifi_setup_start')
        .text('🔙 Main Menu', 'menu_main');

      return ctx.reply(`
✅ <b>Wi-Fi Credentials Saved Successfully!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 <b>Network Name (SSID):</b> <code>${updatedCreds.ssid}</code>
🔑 <b>Wi-Fi Password:</b> <code>${updatedCreds.password}</code>
🕒 <b>Saved At:</b> ${getISTTime()} (${getISTDate()})

👇 <b>Tap below to broadcast these credentials to all students via email:</b>
`, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      return ctx.reply(`❌ Failed to save Wi-Fi credentials: ${err.message}`, {
        reply_markup: new InlineKeyboard().text('🔙 Back to WiFi Menu', 'menu_wifi'),
      });
    }
  }

  if (state && state.action === 'awaiting_fee_amount') {
    const rawText = ctx.message.text.trim();
    // Allow formats like "1200", "1,200", "₹1200", "rs 1200"
    const amount = parseInt(rawText.replace(/[^\d]/g, ''), 10);

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('⚠️ <b>Invalid Amount!</b>\nPlease type a valid positive number (e.g. <code>500</code>, <code>1000</code>, <code>1500</code>, <code>2500</code>):', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Cancel', `fee_collect_${state.studentId}`),
      });
    }

    const studentId = state.studentId;
    adminFlowState.delete(chatId);

    try {
      const student = await db.getStudentById(studentId);
      if (!student) return ctx.reply('❌ Student not found in database.');

      const kb = new InlineKeyboard()
        .text('📱 UPI', `fee_pay_${student.id}_${amount}_upi`)
        .text('💵 Cash', `fee_pay_${student.id}_${amount}_cash`)
        .row()
        .text('🏦 Bank Transfer', `fee_pay_${student.id}_${amount}_bank_transfer`)
        .text('📜 Cheque', `fee_pay_${student.id}_${amount}_cheque`)
        .row()
        .text('✏️ Change Amount', `fee_custom_${student.id}`)
        .text('🔙 Cancel', `student_view_${student.id}`);

      return ctx.reply(`
💳 <b>Record Payment: ₹${amount.toLocaleString('en-IN')}</b>
━━━━━━━━━━━━━━━━━━━━━
👤 <b>Student:</b> ${student.full_name}
🪑 <b>Desk:</b> <b>${student.seat_number}</b>
💰 <b>Current Balance Due:</b> ₹${student.amount_due}

👇 <b>Select Payment Method:</b>
`, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } catch (err) {
      return ctx.reply(`❌ Error: ${err.message}`);
    }
  }

  return next();
});

// Native Telegram Contact Handler for 1-Tap Attendance Check-In / Out (Step 1)
bot.on('message:contact', async (ctx) => {
  const contact = ctx.message.contact;
  const phone = contact.phone_number;

  try {
    const student = await db.findStudentByPhone(phone);

    if (!student) {
      return ctx.reply(`
⚠️ <b>Phone Number Not Found in Library Database</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
We could not find an active student membership for phone: <code>${phone}</code>.

Please contact the administration counter or apply online at:
🌐 <a href="${WEB_APP_URL}/join">Join Vertical Classes Library</a>
`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });
    }

    const todayStr = getISTDateString();
    const { logs } = await db.getTodayAttendance();
    const activeSession = logs.find(
      (l) => l.student_id === student.id && l.status === 'checked_in'
    );

    const action = activeSession ? 'checkout' : 'checkin';
    const actionTitle = action === 'checkout' ? 'Exit Check-Out' : 'Entrance Check-In';
    const actionEmoji = action === 'checkout' ? '🚪' : '🎉';
    const btnText = action === 'checkout'
      ? '📍 Tap to Share GPS Location & Check Out'
      : '📍 Tap to Share GPS Location & Check In';

    // Store in pending attendance state awaiting GPS location
    pendingAttendanceState.set(ctx.chat.id, {
      student,
      action,
      activeSession,
      timestamp: Date.now(),
    });

    const geofence = await db.getGeofenceSettings();

    const locationKb = new Keyboard()
      .requestLocation(btnText)
      .oneTime()
      .resized();

    await ctx.reply(`
${actionEmoji} <b>${actionTitle} — Step 2 of 2: Location Verification</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Student:</b> ${student.full_name}
🪑 <b>Desk:</b> <b>${student.seat_number || 'Flexi'}</b>
🏢 <b>Library:</b> ${geofence.name}

🛡 <b>Anti-Proxy Geofence Active:</b>
To verify student safety and prevent remote attendance from home, you must be physically inside the study lounge (within <b>${geofence.radius_meters} meters</b>).

👇 <b>Tap the button below to share your GPS Location & complete ${actionTitle}:</b>
`, {
      parse_mode: 'HTML',
      reply_markup: locationKb,
    });
  } catch (err) {
    console.error('Contact attendance error:', err);
    await ctx.reply(`❌ Attendance error: ${err.message}`, {
      reply_markup: { remove_keyboard: true },
    });
  }
});

// Native Telegram Location Handler with Geofence Verification (Step 2)
bot.on('message:location', async (ctx) => {
  const chatId = ctx.chat.id;
  const state = pendingAttendanceState.get(chatId);

  if (!state || (Date.now() - state.timestamp > 5 * 60 * 1000)) {
    pendingAttendanceState.delete(chatId);
    return ctx.reply(`
⚠️ <b>Session Expired or No Pending Attendance</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please send /checkin or /checkout, or scan the entrance QR code to begin.
`, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    });
  }

  const { student, action } = state;
  const { latitude, longitude } = ctx.message.location;

  try {
    const geofence = await db.getGeofenceSettings();
    const distanceMeters = db.calculateDistanceMeters(
      latitude,
      longitude,
      geofence.latitude,
      geofence.longitude
    );

    const nowTime = getISTTime();
    const SHIFT_INFO = {
      morning: 'Morning Slot (06:00 AM - 12:00 PM)',
      afternoon: 'Afternoon Slot (12:00 PM - 06:00 PM)',
      evening: 'Evening Slot (06:00 PM - 11:00 PM)',
      night: 'Night Owl Slot (10:00 PM - 06:00 AM)',
      fullday: 'Full Day Access (06:00 AM - 11:30 PM)',
    };
    const shiftText = SHIFT_INFO[student.shift] || (student.shift ? student.shift.toUpperCase() : 'Full Day Access');

    // Geofence verification check
    if (geofence.enabled && distanceMeters > geofence.radius_meters) {
      await ctx.reply(`
❌ <b>Attendance Denied — Outside Library!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 <b>Your Distance:</b> <b>${distanceMeters.toLocaleString('en-IN')} meters away</b>
🎯 <b>Allowed Geofence:</b> Within <b>${geofence.radius_meters} meters</b> of ${geofence.name}

⚠️ <b>Notice:</b>
You are outside the library premises. Remote attendance is strictly prohibited, and the library is not responsible for your presence or whereabouts outside the study lounge.

👉 <i>Please enter the library and try again when you are inside at your desk.</i>
`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });

      // Alert Librarian / Admin of remote check-in attempt
      if (ADMIN_CHAT_ID) {
        try {
          const studentPhone = student.phone || 'N/A';
          const parentPhone = student.emergency_contact || 'N/A';

          const adminAlertText = `
🚨 <b>[Remote Attendance Blocked]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Student:</b> ${student.full_name}
🪑 <b>Desk:</b> <b>${student.seat_number || 'Unassigned'}</b>
❌ <b>Attempted:</b> <b>${action.toUpperCase()}</b> from <b>${distanceMeters.toLocaleString('en-IN')}m away</b> (Outside Library)!
🕒 <b>Time:</b> ${nowTime} (IST)
📍 <b>GPS:</b> <code>${latitude.toFixed(6)}, ${longitude.toFixed(6)}</code>

📞 <b>Call Student or Parent:</b>
• 📱 <b>Student Phone:</b> <code>+91 ${studentPhone}</code> (<a href="tel:+91${studentPhone.replace(/\D/g, '')}">Call Student</a>)
• 👨‍👩‍👦 <b>Parent Phone:</b> <code>+91 ${parentPhone}</code> ${parentPhone !== 'N/A' ? `(<a href="tel:+91${parentPhone.replace(/\D/g, '')}">Call Parent</a>)` : ''}

⚠️ <b>LIABILITY NOTICE:</b>
<b>We are NOT responsible for him/her right now as they are outside library premises!</b>
`;

          const alertKb = new InlineKeyboard()
            .text('👤 View Student Details', `student_view_${student.id}`)
            .row();

          await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            adminAlertText,
            {
              parse_mode: 'HTML',
              reply_markup: alertKb,
            }
          );
        } catch (e) {
          console.error('Failed to dispatch remote attendance alert to admin:', e);
        }
      }
      return;
    }

    // Inside Geofence! Process Attendance
    pendingAttendanceState.delete(chatId);

    if (action === 'checkout') {
      const result = await db.checkOutStudent(student.id, { latitude, longitude, distanceMeters });
      const hours = Math.floor((result.durationMinutes || 0) / 60);
      const mins = (result.durationMinutes || 0) % 60;
      const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;

      await ctx.reply(`
👋 <b>Check-Out Confirmed!</b>
━━━━━━━━━━━━━━━━━━━━━
👤 <b>Student:</b> ${student.full_name}
🪑 <b>Desk:</b> <b>${student.seat_number || 'Flexi'}</b>
⏰ <b>Slot:</b> ${shiftText}
🕒 <b>Check-Out Time:</b> ${nowTime} (IST)
⏱ <b>Total Study Duration:</b> <b>${durationStr}</b>
📍 <b>GPS Verification:</b> <b>Verified Inside (${distanceMeters}m from center)</b>

<i>Great study session today! See you tomorrow. 📚✨</i>
`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });

      if (ADMIN_CHAT_ID) {
        try {
          await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            `🔴 <b>[Check-Out Notice]</b>\n👤 <b>${student.full_name}</b> checked out from Desk <b>${student.seat_number}</b> at ${nowTime} (IST).\n⏱ Studied: <b>${durationStr}</b>\n📍 GPS Verified (${distanceMeters}m from center).`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
      return;
    }

    // Entrance Check-In
    await db.checkInStudent(student.id, { latitude, longitude, distanceMeters });

    await ctx.reply(`
🎉 <b>Check-In Confirmed!</b>
━━━━━━━━━━━━━━━━━━━━━
👤 Welcome back, <b>${student.full_name}</b>!
🪑 <b>Your Desk:</b> <b>${student.seat_number || 'Assigned'}</b>
⏰ <b>Assigned Slot:</b> ${shiftText}
🕒 <b>Check-In Time:</b> ${nowTime} (IST)
📍 <b>GPS Verification:</b> <b>Verified Inside (${distanceMeters}m from center)</b>
⏳ <b>Membership Valid Till:</b> ${student.end_date}

<i>Have a focused and productive study session! 📖🔥</i>
`, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    });

    if (ADMIN_CHAT_ID) {
      try {
        await bot.api.sendMessage(
          ADMIN_CHAT_ID,
          `🟢 <b>[Check-In Notice]</b>\n👤 <b>${student.full_name}</b> entered and occupied Desk <b>${student.seat_number}</b> at ${nowTime} (IST) [${shiftText}].\n📍 GPS Verified (${distanceMeters}m from center).`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }
  } catch (err) {
    console.error('Location attendance error:', err);
    await ctx.reply(`❌ Attendance error: ${err.message}`, {
      reply_markup: { remove_keyboard: true },
    });
  }
});

bot.command('menu', async (ctx) => {
  await ctx.reply('📋 <b>DeskFlow Management Hub:</b>', {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
});

// Global error handler to ensure bot never crashes on Telegram API errors
bot.catch((err) => {
  const ctx = err.ctx;
  const msg = err.error?.description || err.error?.message || err.message;
  console.warn(`[Bot Warning] Handled update ${ctx?.update?.update_id}: ${msg}`);
});

async function safeEdit(ctx, text, options) {
  try {
    await ctx.editMessageText(text, options);
  } catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
      return; // Safe to ignore
    }
    console.error('safeEdit error:', err);
  }
}

// Callback Query: Main Menu
bot.callbackQuery('menu_main', async (ctx) => {
  await ctx.answerCallbackQuery();
  await safeEdit(ctx, '📋 <b>DeskFlow Management Hub:</b>', {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
});

// ==============================================================================
// 3. Desk & Seat Matrix
// ==============================================================================

bot.callbackQuery('menu_desks', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const seats = await db.getAllSeats();
    const total = seats.length;
    const occupied = seats.filter((s) => s.status === 'occupied').length;
    const available = total - occupied;
    const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    const text = `
🪑 <b>Visual Seating Overview</b>
━━━━━━━━━━━━━━━━━━━━━
📊 <b>Total Capacity:</b> ${total} Desks
🟢 <b>Available:</b> ${available} Desks
🔴 <b>Occupied:</b> ${occupied} Desks (${occRate}% Occupancy)

🏢 <b>Sections:</b>
• <b>Main Silent Hall A:</b> 20 Dedicated Desks (D-01 to D-20)
• <b>Flexi Open Zone B:</b> 10 Flexible Desks (F-01 to F-10)
`;

    const kb = new InlineKeyboard()
      .text('🟢 View Vacant Desks', 'desks_vacant')
      .text('🔴 View Occupied Desks', 'desks_occupied')
      .row()
      .text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('Error fetching seats:', err);
    await ctx.reply(`❌ Failed to load seats: ${err.message}`);
  }
});

// Vacant Desks
bot.callbackQuery('desks_vacant', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const seats = await db.getAllSeats();
    const vacant = seats.filter((s) => s.status === 'available');

    if (vacant.length === 0) {
      await ctx.editMessageText('⚠️ <b>All desks are currently occupied!</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back', 'menu_desks'),
      });
      return;
    }

    const kb = new InlineKeyboard();
    let rowCount = 0;
    for (const seat of vacant.slice(0, 18)) {
      kb.text(`🟢 ${seat.seat_number}`, `seat_view_${seat.seat_number}`);
      rowCount++;
      if (rowCount % 3 === 0) kb.row();
    }
    kb.row().text('🔙 Back to Desks', 'menu_desks');

    await ctx.editMessageText(`🟢 <b>Vacant Desks (${vacant.length} Available):</b>\nTap any seat to inspect or assign:`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Occupied Desks
bot.callbackQuery('desks_occupied', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const seats = await db.getAllSeats();
    const occupied = seats.filter((s) => s.status === 'occupied');

    if (occupied.length === 0) {
      await ctx.editMessageText('🟢 <b>No desks are currently occupied! All desks are free.</b>', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back', 'menu_desks'),
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const s of occupied) {
      kb.text(`🔴 ${s.seat_number} - ${s.current_student_name || 'Occupied'}`, `seat_view_${s.seat_number}`).row();
    }
    kb.text('🔙 Back to Desks', 'menu_desks');

    await ctx.editMessageText(`🔴 <b>Occupied Desks (${occupied.length} Students):</b>\nTap a desk to view details or vacate:`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Inspect a specific seat
bot.callbackQuery(/^seat_view_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const seatNumber = ctx.match[1];
  try {
    const seat = await db.getSeatByNumber(seatNumber);
    if (!seat) {
      await ctx.reply(`❌ Seat ${seatNumber} not found.`);
      return;
    }

    let text = `🪑 <b>Desk Information: ${seat.seat_number}</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📍 <b>Section:</b> ${seat.section}\n`;
    text += `🔖 <b>Type:</b> ${seat.type.toUpperCase()}\n`;
    text += `⚡ <b>Status:</b> ${seat.status === 'occupied' ? '🔴 Occupied' : '🟢 Available'}\n`;

    const kb = new InlineKeyboard();

    if (seat.status === 'occupied' && seat.current_student_id) {
      text += `👤 <b>Student:</b> ${seat.current_student_name || 'Assigned'}\n`;
      text += `🕒 <b>Shift:</b> ${(seat.shift || 'fullday').toUpperCase()}\n`;

      kb.text('👤 View Student Details', `student_view_${seat.current_student_id}`).row();
      kb.text('🚫 Vacate / Free Desk', `seat_vacate_${seat.seat_number}`).row();
    } else {
      text += `\n<i>This seat is vacant and ready for immediate allocation.</i>\n`;
    }

    kb.text('🔙 Back to Desks', 'menu_desks');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Vacate a seat
bot.callbackQuery(/^seat_vacate_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const seatNumber = ctx.match[1];
  try {
    await db.vacateSeat(seatNumber);
    await ctx.editMessageText(`✅ <b>Desk ${seatNumber} has been successfully released and marked vacant!</b>`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back to Desks', 'menu_desks'),
    });
  } catch (err) {
    await ctx.reply(`❌ Failed to vacate seat: ${err.message}`);
  }
});

// ==============================================================================
// 4. Students Directory & Profile
// ==============================================================================

bot.callbackQuery('menu_students', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const students = await db.searchStudents('');
    if (students.length === 0) {
      await ctx.editMessageText('ℹ️ No students registered in the database yet.', {
        reply_markup: new InlineKeyboard().text('🔙 Back', 'menu_main'),
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const s of students.slice(0, 10)) {
      kb.text(`👤 ${s.full_name} (${s.seat_number || 'Unassigned'})`, `student_view_${s.id}`).row();
    }
    kb.text('🔙 Back to Main Menu', 'menu_main');

    const text = `
👥 <b>Student Directory (${students.length} Total)</b>
━━━━━━━━━━━━━━━━━━━━━
Select a student to view membership, collect fees, or dispatch an email receipt:

<i>Tip: You can also send <code>/student [name]</code> anytime to search!</i>
`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Search command
bot.command('student', async (ctx) => {
  const query = ctx.match?.trim() || '';
  try {
    const students = await db.searchStudents(query);
    if (students.length === 0) {
      await ctx.reply(`🔍 No students found matching "<b>${query}</b>".`, { parse_mode: 'HTML' });
      return;
    }

    const kb = new InlineKeyboard();
    for (const s of students.slice(0, 8)) {
      kb.text(`👤 ${s.full_name} (${s.seat_number || 'Unassigned'})`, `student_view_${s.id}`).row();
    }

    await ctx.reply(`🔍 <b>Search Results (${students.length} found):</b>`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// View Student Details
bot.callbackQuery(/^student_view_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) {
      await ctx.reply('❌ Student not found.');
      return;
    }

    const dueColor = student.amount_due > 0 ? '🔴' : '🟢';

    const text = `
👤 <b>Student Profile: ${student.full_name}</b>
━━━━━━━━━━━━━━━━━━━━━
🔖 <b>Reg No:</b> <code>${student.reg_no}</code>
🪑 <b>Assigned Desk:</b> <b>${student.seat_number || 'Unassigned'}</b>
📞 <b>Phone:</b> ${student.phone}
📧 <b>Email:</b> ${student.email || 'Not provided'}
📍 <b>Address:</b> ${student.address || 'N/A'}
🎯 <b>Study Goal:</b> ${student.study_goal || 'General Study'}

📅 <b>Membership Plan:</b> ${(student.membership_plan || 'Monthly').toUpperCase()}
🕒 <b>Shift:</b> ${(student.shift || 'Full Day').toUpperCase()}
⏳ <b>Valid Until:</b> <b>${student.end_date || 'N/A'}</b>
⚡ <b>Status:</b> ${student.status.toUpperCase()}

💰 <b>Financials:</b>
• Total Plan: ₹${(student.plan_amount || 1000).toLocaleString('en-IN')}
• Paid: ₹${(student.amount_paid || 0).toLocaleString('en-IN')}
• ${dueColor} <b>Balance Due:</b> ₹${(student.amount_due || 0).toLocaleString('en-IN')}
`;

    const kb = new InlineKeyboard()
      .text('💳 Collect Fee (+30 Days)', `fee_collect_${student.id}`)
      .row()
      .text('📧 Send Receipt to Email', `email_receipt_${student.id}`)
      .row();

    if (student.email) {
      kb.text('⏰ Send Renewal Reminder Email', `email_reminder_${student.id}`).row();
    }

    if (student.seat_number && student.seat_number !== 'Unassigned') {
      kb.text(`🚫 Vacate Desk ${student.seat_number}`, `seat_vacate_${student.seat_number}`).row();
    }

    kb.text('🔙 Back to Students', 'menu_students');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// ==============================================================================
// 5. Fee Collection & Payment Logging
// ==============================================================================

bot.callbackQuery('menu_fees', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const students = await db.searchStudents('');
    const withDues = students.filter((s) => s.amount_due > 0);

    const kb = new InlineKeyboard();
    const list = withDues.length > 0 ? withDues : students;

    for (const s of list.slice(0, 8)) {
      kb.text(`💳 ${s.full_name} (Due: ₹${s.amount_due})`, `fee_collect_${s.id}`).row();
    }
    kb.text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText('💳 <b>Select a student to collect fee & extend membership:</b>', {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Step 1: Fee Collection Amount Prompt (Presets + Custom)
bot.callbackQuery(/^fee_collect_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    const kb = new InlineKeyboard();

    if (student.amount_due > 0) {
      kb.text(`💰 Full Due (₹${student.amount_due})`, `fee_amt_${student.id}_${student.amount_due}`).row();
    }
    kb.text('₹1,000 (Monthly)', `fee_amt_${student.id}_1000`)
      .text('₹500 (Half / Partial)', `fee_amt_${student.id}_500`)
      .row()
      .text('✏️ Enter Custom Amount', `fee_custom_${student.id}`)
      .row()
      .text('🔙 Cancel', `student_view_${student.id}`);

    await ctx.editMessageText(`
💳 <b>Record Payment for ${student.full_name}</b>
━━━━━━━━━━━━━━━━━━━━━
🪑 Desk: <b>${student.seat_number}</b>
💰 Current Balance Due: <b>₹${student.amount_due}</b>
📅 Current Expiry: <b>${student.end_date}</b>

<i>Select a quick amount or tap <b>"✏️ Enter Custom Amount"</b> to type any amount:</i>
`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Prompt for custom amount input
bot.callbackQuery(/^fee_custom_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    adminFlowState.set(ctx.chat.id, {
      action: 'awaiting_fee_amount',
      studentId: student.id,
    });

    await ctx.reply(`
✏️ <b>Enter Custom Amount for ${student.full_name}</b>
━━━━━━━━━━━━━━━━━━━━━
🪑 Desk: <b>${student.seat_number}</b>
💰 Balance Due: <b>₹${student.amount_due}</b>

💬 <b>Please reply with the exact amount to collect:</b>
<i>(e.g., 700, 1200, 1500, 2500, 3000)</i>
`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back to Options', `fee_collect_${student.id}`),
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Step 2: Amount Selected -> Choose Payment Mode (UPI, Cash, Bank Transfer, Cheque)
bot.callbackQuery(/^fee_amt_(.+)_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, studentId, amountStr] = ctx.match;
  const amount = parseInt(amountStr, 10);
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    const kb = new InlineKeyboard()
      .text('📱 UPI', `fee_pay_${student.id}_${amount}_upi`)
      .text('💵 Cash', `fee_pay_${student.id}_${amount}_cash`)
      .row()
      .text('🏦 Bank Transfer', `fee_pay_${student.id}_${amount}_bank_transfer`)
      .text('📜 Cheque', `fee_pay_${student.id}_${amount}_cheque`)
      .row()
      .text('✏️ Change Amount', `fee_collect_${student.id}`)
      .text('🔙 Cancel', `student_view_${student.id}`);

    await ctx.editMessageText(`
💳 <b>Record Payment: ₹${amount.toLocaleString('en-IN')}</b>
━━━━━━━━━━━━━━━━━━━━━
👤 <b>Student:</b> ${student.full_name}
🪑 <b>Desk:</b> <b>${student.seat_number}</b>
💰 <b>Current Balance Due:</b> ₹${student.amount_due}

👇 <b>Select Payment Method:</b>
`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Step 3: Execute Payment Collection & Generate Receipt
bot.callbackQuery(/^fee_pay_(.+)_(.+)_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Recording payment...' });
  const [, studentId, amount, mode] = ctx.match;
  try {
    const modeLabels = {
      upi: '📱 UPI',
      cash: '💵 Cash',
      bank_transfer: '🏦 Bank Transfer',
      cheque: '📜 Cheque',
      card: '💳 Card',
    };
    const modeTitle = modeLabels[mode] || mode.toUpperCase();

    const { transaction, student } = await db.collectFee({
      studentId,
      amount: parseInt(amount, 10),
      paymentMode: mode,
      remarks: `Collected via Telegram bot (${modeTitle})`,
      extendDays: 30,
    });

    const successText = `
✅ <b>Payment Successfully Recorded!</b>
━━━━━━━━━━━━━━━━━━━━━
🧾 <b>Receipt No:</b> <code>${transaction.receipt_number}</code>
👤 <b>Student:</b> ${student.full_name} (Desk: ${student.seat_number})
💵 <b>Amount Paid:</b> <b>₹${transaction.amount.toLocaleString('en-IN')}</b>
💳 <b>Payment Mode:</b> <b>${modeTitle}</b>
📅 <b>New Expiry Date:</b> <b>${student.end_date}</b> (+30 Days)
💰 <b>Remaining Due:</b> ₹${student.amount_due.toLocaleString('en-IN')}
`;

    const kb = new InlineKeyboard();
    if (student.email) {
      kb.text(`📧 Email Receipt to ${student.email}`, `email_receipt_${student.id}_${transaction.id}`).row();
    }
    kb.text('🔙 View Student', `student_view_${student.id}`).row();
    kb.text('📋 Main Menu', 'menu_main');

    await ctx.editMessageText(successText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Payment failed: ${err.message}`);
  }
});


// ==============================================================================
// 6. Resend Email Receipts
// ==============================================================================

bot.callbackQuery(/^email_receipt_([^_]+)(?:_(.+))?$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Sending receipt email via Resend...' });
  const studentId = ctx.match[1];
  const transactionId = ctx.match[2];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    if (!student.email) {
      await ctx.reply(`⚠️ Student <b>${student.full_name}</b> does not have an email address recorded. Please add an email first.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    // Retrieve exact transaction or latest transaction for this student
    let transaction = null;
    if (transactionId) {
      transaction = await db.getTransactionById(transactionId);
    }
    if (!transaction) {
      transaction = await db.getLatestTransactionForStudent(studentId);
    }

    const result = await sendReceiptEmail({ student, transaction });

    if (result.sandbox) {
      await ctx.reply(`
📧 <b>Receipt Email Delivered!</b>
━━━━━━━━━━━━━━━━━━━━━
⚠️ <b>Resend Sandbox Notice:</b> Delivered to your admin email (<code>${result.recipient}</code>) because your custom domain is not yet verified on Resend.

👤 <b>Student:</b> ${student.full_name}
📩 <b>Student Email:</b> <code>${student.email}</code>
🧾 <b>Receipt No:</b> <code>${result.receiptNo}</code>
🪑 <b>Desk:</b> ${student.seat_number}
📅 <b>Valid Until:</b> ${student.end_date}

<i>💡 Tip: Check your inbox (<code>${result.recipient}</code>) to view the generated receipt. To send directly to student emails, verify a domain at resend.com/domains.</i>
`, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back to Student', `student_view_${student.id}`),
      });
      return;
    }

    await ctx.reply(`
📧 <b>Receipt Email Dispatched!</b>
━━━━━━━━━━━━━━━━━━━━━
✅ Official branded fee receipt sent via <b>Resend</b>.
👤 <b>Recipient:</b> <code>${student.email}</code>
🧾 <b>Receipt No:</b> <code>${result.receiptNo}</code>
🪑 <b>Desk:</b> ${student.seat_number}
📅 <b>Validity:</b> Valid till ${student.end_date}
`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back to Student', `student_view_${student.id}`),
    });
  } catch (err) {
    console.error('Email error:', err);
    await ctx.reply(`❌ Failed to send email receipt: ${err.message}`);
  }
});

// Command: /emailreceipt [student_id]
bot.command('emailreceipt', async (ctx) => {
  const query = ctx.match?.trim();
  if (!query) {
    return ctx.reply('Usage: <code>/emailreceipt [student_name_or_id]</code>', { parse_mode: 'HTML' });
  }

  try {
    const students = await db.searchStudents(query);
    if (students.length === 0) {
      return ctx.reply(`❌ No student found for "${query}"`);
    }

    const student = students[0];
    const result = await sendReceiptEmail({ student });

    await ctx.reply(`
✅ <b>Receipt Emailed Successfully!</b>
👤 Student: <b>${student.full_name}</b>
📧 Sent to: <code>${student.email}</code>
🧾 Receipt: <code>${result.receiptNo}</code>
`, { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply(`❌ Failed: ${err.message}`);
  }
});

// Callback: Send individual reminder email
bot.callbackQuery(/^email_reminder_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Sending renewal reminder email...' });
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    if (!student.email) {
      return ctx.reply(`⚠️ Student <b>${student.full_name}</b> does not have an email address on file.`, { parse_mode: 'HTML' });
    }

    await sendReminderEmail({ student });

    await ctx.reply(`
⏰ <b>Renewal Reminder Dispatched!</b>
━━━━━━━━━━━━━━━━━━━━━
✅ Official courtesy reminder email sent directly to student.
👤 <b>Recipient:</b> ${student.full_name} (<code>${student.email}</code>)
🪑 <b>Desk:</b> ${student.seat_number}
💰 <b>Amount Due:</b> ₹${(student.amount_due || 0).toLocaleString('en-IN')}
📅 <b>Current Expiry:</b> ${student.end_date}
`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back to Student', `student_view_${student.id}`),
    });
  } catch (err) {
    console.error('Reminder error:', err);
    await ctx.reply(`❌ Failed to send reminder email: ${err.message}`);
  }
});

// Callback: Broadcast reminders to all defaulters
bot.callbackQuery('remind_all_defaulters', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Dispatching reminders to all defaulters...' });
  try {
    const { dues } = await db.getDefaultersAndExpiries();
    const eligible = dues.filter((d) => d.email);

    if (eligible.length === 0) {
      return ctx.reply('⚠️ No defaulters with valid email addresses found.');
    }

    let sent = 0;
    for (const student of eligible) {
      try {
        await sendReminderEmail({ student });
        sent++;
      } catch (err) {
        console.error(`Failed to send reminder to ${student.email}:`, err);
      }
    }

    await ctx.reply(`
📢 <b>Broadcast Reminders Complete!</b>
━━━━━━━━━━━━━━━━━━━━━
✅ Successfully dispatched personalized renewal reminder emails to <b>${sent} student(s)</b> from <code>receipts@globalpulse24.in</code>.
`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Defaulters Menu', 'menu_defaulters'),
    });
  } catch (err) {
    await ctx.reply(`❌ Broadcast error: ${err.message}`);
  }
});

// Command: /remind [student_name_or_seat]
bot.command('remind', async (ctx) => {
  const query = ctx.match?.trim();
  if (!query) {
    return ctx.reply('Usage: <code>/remind [student_name_or_seat]</code>', { parse_mode: 'HTML' });
  }

  try {
    const students = await db.searchStudents(query);
    if (students.length === 0) {
      return ctx.reply(`❌ No student found for "${query}"`);
    }

    const student = students[0];
    if (!student.email) {
      return ctx.reply(`⚠️ Student <b>${student.full_name}</b> does not have an email on file.`, { parse_mode: 'HTML' });
    }

    await sendReminderEmail({ student });
    await ctx.reply(`✅ <b>Reminder email sent to ${student.full_name} (${student.email})!</b>`, { parse_mode: 'HTML' });
  } catch (err) {
    await ctx.reply(`❌ Failed: ${err.message}`);
  }
});

// ==============================================================================
// 7. Defaulters & Expiries
// ==============================================================================

bot.callbackQuery('menu_defaulters', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const { dues, expiringSoon, expired } = await db.getDefaultersAndExpiries();

    let text = `⚠️ <b>Defaulters & Expiry Tracker</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 <b>Pending Fee Dues:</b> ${dues.length} Students\n`;
    text += `🟡 <b>Expiring Within 3 Days:</b> ${expiringSoon.length} Students\n`;
    text += `🔴 <b>Overdue / Expired:</b> ${expired.length} Students\n\n`;

    const kb = new InlineKeyboard();

    if (dues.length > 0) {
      text += `<b>Outstanding Balances:</b>\n`;
      for (const d of dues.slice(0, 5)) {
        text += `• <b>${d.full_name}</b> (${d.seat_number}): <b>₹${d.amount_due} due</b>\n`;
        kb.text(`💳 Collect ₹${d.amount_due} - ${d.full_name}`, `fee_collect_${d.id}`).row();
        if (d.email) {
          kb.text(`⏰ Email Reminder: ${d.full_name}`, `email_reminder_${d.id}`).row();
        }
      }
      if (dues.some(d => d.email)) {
        kb.text('📢 Broadcast Reminders to ALL Defaulters', 'remind_all_defaulters').row();
      }
    } else {
      text += `<i>No pending fee dues. All active students are fully paid!</i>\n`;
    }

    kb.text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// ==============================================================================
// 8. New Admissions Queue
// ==============================================================================

bot.callbackQuery('menu_admissions', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const pending = await db.getPendingAdmissions();

    if (pending.length === 0) {
      await ctx.editMessageText('📥 <b>Admissions Queue:</b>\n\nNo pending self-registrations. All applicants have been processed! ✨', {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back', 'menu_main'),
      });
      return;
    }

    const kb = new InlineKeyboard();
    for (const p of pending.slice(0, 5)) {
      kb.text(`📝 ${p.full_name} (${p.seat_number || 'Unassigned'})`, `adm_view_${p.id}`).row();
    }
    kb.text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText(`📥 <b>Pending Admissions (${pending.length} Waiting):</b>\nReview prospective students and allot desks:`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// View prospective admission
bot.callbackQuery(/^adm_view_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Applicant not found.');

    const text = `
📝 <b>New Admission Application: ${student.full_name}</b>
━━━━━━━━━━━━━━━━━━━━━
🔖 <b>Reg No:</b> <code>${student.reg_no}</code>
📞 <b>Phone:</b> ${student.phone}
📧 <b>Email:</b> ${student.email || 'None'}
🎯 <b>Study Goal:</b> ${student.study_goal || 'Self Study'}
🪑 <b>Requested Desk:</b> <b>${student.seat_number || 'Any'}</b>
🕒 <b>Shift:</b> ${(student.shift || 'fullday').toUpperCase()}
📅 <b>Requested Plan:</b> ${(student.membership_plan || 'monthly').toUpperCase()}
📝 <b>Notes:</b> ${student.notes || 'None'}
`;

    const kb = new InlineKeyboard()
      .text('✅ Approve & Allot Desk', `adm_approve_${student.id}`)
      .row()
      .text('🔙 Back to Queue', 'menu_admissions');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Approve admission
bot.callbackQuery(/^adm_approve_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) {
      return ctx.reply('❌ Student not found in database.');
    }
    const approved = await db.approveAdmission(studentId, student.seat_number !== 'Unassigned' ? student.seat_number : null);

    const seatNum = approved?.seat_number || student.seat_number || 'Unassigned';
    await ctx.editMessageText(`🎉 <b>Admission Approved for ${student.full_name}!</b>\nStudent is now active with seat <b>${seatNum}</b>.`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('💳 Collect Admission Fee', `fee_collect_${student.id}`)
        .row()
        .text('🔙 Admissions Queue', 'menu_admissions'),
    });
  } catch (err) {
    console.error('Bot approve admission error:', err);
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Daily Stats
bot.callbackQuery('menu_stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const seats = await db.getAllSeats();
    const students = await db.searchStudents('');
    const occupied = seats.filter((s) => s.status === 'occupied').length;
    const active = students.filter((s) => s.status === 'active').length;
    const totalDues = students.reduce((acc, s) => acc + (s.amount_due || 0), 0);

    const text = `
📊 <b>DeskFlow Daily Executive Briefing</b>
━━━━━━━━━━━━━━━━━━━━━
🪑 <b>Capacity:</b> 30 Desks
🟢 <b>Available:</b> ${30 - occupied} Desks
🔴 <b>Occupancy:</b> ${occupied} / 30 (${Math.round((occupied / 30) * 100)}%)

👥 <b>Active Members:</b> ${active} Students
💰 <b>Outstanding Balance in Market:</b> ₹${totalDues.toLocaleString('en-IN')}
⚡ <b>System Status:</b> Online & Synced with Supabase
`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back to Main Menu', 'menu_main'),
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Live Attendance & Headcount Callback
bot.callbackQuery('menu_attendance', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const { currentlyInside, checkedOut } = await db.getTodayAttendance();
    const nowTime = getISTTime();

    let text = `📍 <b>Live Attendance & Headcount</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🕒 <b>Current Time:</b> ${nowTime} (IST)\n`;
    text += `🟢 <b>Inside Hall Now:</b> <b>${currentlyInside.length} Students</b>\n`;
    text += `⚪ <b>Checked Out Today:</b> ${checkedOut.length} Students\n\n`;

    if (currentlyInside.length > 0) {
      text += `<b>Students Currently Inside:</b>\n`;
      for (const s of currentlyInside.slice(0, 10)) {
        const inTime = getISTTime(s.check_in_time);
        text += `• <b>${s.student_name}</b> (Desk: <b>${s.seat_number || 'Flexi'}</b>) — In at ${inTime}\n`;
      }
    } else {
      text += `<i>No students currently checked in inside the hall.</i>\n`;
    }

    const kb = new InlineKeyboard()
      .text('🔄 Refresh Count', 'menu_attendance')
      .row()
      .text('📷 View QR Codes', 'menu_qrs')
      .text('🔙 Main Menu', 'menu_main');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Attendance error: ${err.message}`);
  }
});

// Attendance QR Codes display
bot.callbackQuery('menu_qrs', async (ctx) => {
  await ctx.answerCallbackQuery();
  const botUsername = ctx.me.username || 'controllibrarybot';
  const checkInUrl = `https://t.me/${botUsername}?start=in`;
  const checkOutUrl = `https://t.me/${botUsername}?start=out`;

  const text = `
📷 <b>Attendance QR Code Links & Setup</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
Print and place these two QR codes at your library doors:

🟢 <b>1. ENTRANCE CHECK-IN QR:</b>
🔗 <code>${checkInUrl}</code>
<i>(Stick this on the front reception door / entry glass)</i>

🔴 <b>2. EXIT CHECK-OUT QR:</b>
🔗 <code>${checkOutUrl}</code>
<i>(Stick this on the exit door / counter)</i>

💡 <b>How it works for students:</b>
1. Student points camera at QR code.
2. Telegram opens -> Student taps <b>"Share Phone Number"</b>.
3. System matches phone with database -> <b>Instant Check-In/Out in 2 seconds with 0 typing!</b>
`;

  const kb = new InlineKeyboard()
    .url('🟢 Test Check-In Link', checkInUrl)
    .url('🔴 Test Check-Out Link', checkOutUrl)
    .row()
    .text('📍 Live Headcount', 'menu_attendance')
    .text('🔙 Main Menu', 'menu_main');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
});

// Commands: /attendance and /qr
bot.command('attendance', async (ctx) => {
  try {
    const { currentlyInside, checkedOut } = await db.getTodayAttendance();
    const nowTime = getISTTime();

    let text = `📍 <b>Live Attendance & Headcount</b>\n━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🕒 <b>Time:</b> ${nowTime} (IST)\n`;
    text += `🟢 <b>Inside Now:</b> ${currentlyInside.length} Students\n`;
    text += `⚪ <b>Departed Today:</b> ${checkedOut.length} Students\n\n`;

    if (currentlyInside.length > 0) {
      for (const s of currentlyInside.slice(0, 10)) {
        const inTime = getISTTime(s.check_in_time);
        text += `• <b>${s.student_name}</b> (${s.seat_number}) — In: ${inTime}\n`;
      }
    } else {
      text += `<i>No students currently checked in.</i>\n`;
    }

    await ctx.reply(text, { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply(`❌ Error: ${e.message}`);
  }
});

bot.command('qr', async (ctx) => {
  const botUsername = ctx.me.username || 'controllibrarybot';
  const checkInUrl = `https://t.me/${botUsername}?start=in`;
  const checkOutUrl = `https://t.me/${botUsername}?start=out`;

  await ctx.reply(`
📷 <b>Attendance QR Code Links:</b>\n
🟢 <b>Entrance Check-In:</b> <code>${checkInUrl}</code>\n
🔴 <b>Exit Check-Out:</b> <code>${checkOutUrl}</code>
`, { parse_mode: 'HTML' });
});

// ==============================================================================
// 8.5. GPS Geofence Administration & Controls
// ==============================================================================

bot.callbackQuery('menu_geofence', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const geofence = await db.getGeofenceSettings();
    const statusEmoji = geofence.enabled ? '🟢 ACTIVE' : '🔴 DISABLED';

    const text = `
🛡 <b>Library GPS Geofence Controls</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Library:</b> ${geofence.name}
📍 <b>Coordinates:</b> <code>${geofence.latitude.toFixed(6)}, ${geofence.longitude.toFixed(6)}</code>
📏 <b>Allowed Radius:</b> <b>${geofence.radius_meters} Meters</b>
🔒 <b>Anti-Proxy Protection:</b> ${statusEmoji}

<i>Students must share their live phone GPS when scanning at the door. If they are farther than ${geofence.radius_meters}m away, check-in and check-out are strictly denied.</i>
`;

    const kb = new InlineKeyboard()
      .text(geofence.radius_meters === 50 ? '🔘 50m (Strict)' : '50m (Strict)', 'geofence_radius_50')
      .text(geofence.radius_meters === 75 ? '🔘 75m (Recommended)' : '75m (Recommended)', 'geofence_radius_75')
      .text(geofence.radius_meters === 100 ? '🔘 100m' : '100m', 'geofence_radius_100')
      .row()
      .text(geofence.enabled ? '⏸ Pause Geofence' : '▶️ Enable Geofence', 'geofence_toggle')
      .row()
      .text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error loading geofence: ${err.message}`);
  }
});

bot.callbackQuery(/^geofence_radius_(\d+)$/, async (ctx) => {
  const newRadius = parseInt(ctx.match[1], 10);
  await ctx.answerCallbackQuery({ text: `Radius updated to ${newRadius} meters!` });
  try {
    await db.updateGeofenceSettings({ radius_meters: newRadius });
    const geofence = await db.getGeofenceSettings();
    const statusEmoji = geofence.enabled ? '🟢 ACTIVE' : '🔴 DISABLED';

    const text = `
🛡 <b>Library GPS Geofence Controls</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Library:</b> ${geofence.name}
📍 <b>Coordinates:</b> <code>${geofence.latitude.toFixed(6)}, ${geofence.longitude.toFixed(6)}</code>
📏 <b>Allowed Radius:</b> <b>${geofence.radius_meters} Meters</b> ✅
🔒 <b>Anti-Proxy Protection:</b> ${statusEmoji}

<i>✅ Geofence perimeter updated to <b>${geofence.radius_meters} meters</b>!</i>
`;

    const kb = new InlineKeyboard()
      .text(geofence.radius_meters === 50 ? '🔘 50m (Strict)' : '50m (Strict)', 'geofence_radius_50')
      .text(geofence.radius_meters === 75 ? '🔘 75m (Recommended)' : '75m (Recommended)', 'geofence_radius_75')
      .text(geofence.radius_meters === 100 ? '🔘 100m' : '100m', 'geofence_radius_100')
      .row()
      .text(geofence.enabled ? '⏸ Pause Geofence' : '▶️ Enable Geofence', 'geofence_toggle')
      .row()
      .text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error updating radius: ${err.message}`);
  }
});

bot.callbackQuery('geofence_toggle', async (ctx) => {
  try {
    const current = await db.getGeofenceSettings();
    const newStatus = !current.enabled;
    await db.updateGeofenceSettings({ enabled: newStatus });
    await ctx.answerCallbackQuery({ text: newStatus ? 'Geofence activated!' : 'Geofence paused!' });

    const geofence = await db.getGeofenceSettings();
    const statusEmoji = geofence.enabled ? '🟢 ACTIVE' : '🔴 DISABLED';

    const text = `
🛡 <b>Library GPS Geofence Controls</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Library:</b> ${geofence.name}
📍 <b>Coordinates:</b> <code>${geofence.latitude.toFixed(6)}, ${geofence.longitude.toFixed(6)}</code>
📏 <b>Allowed Radius:</b> <b>${geofence.radius_meters} Meters</b>
🔒 <b>Anti-Proxy Protection:</b> ${statusEmoji}

<i>Status changed to <b>${statusEmoji}</b>.</i>
`;

    const kb = new InlineKeyboard()
      .text(geofence.radius_meters === 50 ? '🔘 50m (Strict)' : '50m (Strict)', 'geofence_radius_50')
      .text(geofence.radius_meters === 75 ? '🔘 75m (Recommended)' : '75m (Recommended)', 'geofence_radius_75')
      .text(geofence.radius_meters === 100 ? '🔘 100m' : '100m', 'geofence_radius_100')
      .row()
      .text(geofence.enabled ? '⏸ Pause Geofence' : '▶️ Enable Geofence', 'geofence_toggle')
      .row()
      .text('🔙 Back to Main Menu', 'menu_main');

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error toggling geofence: ${err.message}`);
  }
});

// ==============================================================================
// 8.5. Wi-Fi Credentials & Email Broadcast
// ==============================================================================

async function renderWifiMenu(ctx, edit = true) {
  try {
    const creds = await db.getWifiCredentials();
    const students = await db.getActiveStudentsForWifi();
    const isConfigured = Boolean(creds.ssid && creds.password);

    const formattedDate = creds.last_updated_at 
      ? new Date(creds.last_updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
      : 'Not set yet';

    const text = `
📶 <b>Library Wi-Fi Access & Credentials</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${isConfigured ? `
📡 <b>Network Name (SSID):</b> <code>${creds.ssid}</code>
🔑 <b>Wi-Fi Password:</b> <code>${creds.password}</code>
🕒 <b>Last Updated:</b> ${formattedDate} (${creds.updated_by || 'Admin'})
👥 <b>Eligible Students with Email:</b> <b>${students.length} students</b>

👇 <i>Select an action below:</i>
` : `
⚠️ <b>No Wi-Fi credentials configured yet.</b>

Set up your high-speed library Wi-Fi SSID and password to securely broadcast access to all enrolled students.
`}
`;

    const kb = new InlineKeyboard();
    if (isConfigured) {
      kb.text(`🚀 Share Credentials (${students.length} Students)`, 'wifi_share_confirm').row();
      kb.text('✏️ Update Wi-Fi Details', 'wifi_setup_start');
    } else {
      kb.text('➕ Set Up Wi-Fi Credentials', 'wifi_setup_start');
    }
    kb.text('🔙 Back to Main Menu', 'menu_main');

    if (edit && ctx.callbackQuery) {
      await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    }
  } catch (err) {
    console.error('renderWifiMenu error:', err);
    await ctx.reply(`❌ Error loading Wi-Fi settings: ${err.message}`);
  }
}

bot.callbackQuery('menu_wifi', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderWifiMenu(ctx, true);
});

bot.callbackQuery('wifi_setup_start', async (ctx) => {
  await ctx.answerCallbackQuery();
  adminFlowState.set(ctx.chat.id, { action: 'awaiting_wifi_ssid' });

  const text = `
📶 <b>Configure Library Wi-Fi Credentials</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Step 1 of 2: Network Name (SSID)</b>

💬 <b>Please reply with your Wi-Fi Network Name:</b>
<i>(Example: <code>VerticalClasses_5G</code> or <code>Library_HighSpeed</code>)</i>
`;

  const kb = new InlineKeyboard().text('🔙 Cancel', 'menu_wifi');

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
});

bot.callbackQuery('wifi_share_confirm', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const creds = await db.getWifiCredentials();
    if (!creds.ssid || !creds.password) {
      return ctx.reply('⚠️ Please configure a Wi-Fi Network Name and Password first before sharing.', {
        reply_markup: new InlineKeyboard().text('➕ Set Up Wi-Fi', 'wifi_setup_start'),
      });
    }

    const students = await db.getActiveStudentsForWifi();
    if (students.length === 0) {
      return ctx.reply('⚠️ No active students with valid email addresses found in the database.', {
        reply_markup: new InlineKeyboard().text('🔙 Back to WiFi Menu', 'menu_wifi'),
      });
    }

    const previewList = students.slice(0, 6).map(s => `• <b>${s.full_name}</b> (<code>${s.email}</code>)`).join('\n');
    const moreText = students.length > 6 ? `\n<i>...and ${students.length - 6} more students</i>` : '';

    const text = `
📢 <b>Confirm Wi-Fi Credentials Broadcast</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are about to email the official Wi-Fi access pass to all active students.

📡 <b>Network (SSID):</b> <code>${creds.ssid}</code>
🔑 <b>Password:</b> <code>${creds.password}</code>
👥 <b>Total Recipients:</b> <b>${students.length} students</b>

📋 <b>Recipients Preview:</b>
${previewList}${moreText}

📜 <b>Mandatory Policies Included in Email:</b>
• 🚫 <b>Confidentiality:</b> Zero sharing with outsiders, visitors, or non-members.
• 💻 <b>Study Device:</b> 1 primary personal study laptop/tablet only.
• 🎧 <b>Silent Hall:</b> Headphones mandatory for audio & lecture listening.
• 🛑 <b>Academic Purpose:</b> Torrenting, gaming, and illegal downloading prohibited.
• ⚖️ <b>Penalty:</b> Violation triggers immediate Wi-Fi revocation & suspension.

👇 <b>Do you want to send this email now?</b>
`;

    const kb = new InlineKeyboard()
      .text('🚀 Send to All Students Now', 'wifi_share_broadcast')
      .row()
      .text('🔙 Cancel', 'menu_wifi');

    await safeEdit(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

bot.callbackQuery('wifi_share_broadcast', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Starting email broadcast...' });
  try {
    const creds = await db.getWifiCredentials();
    const students = await db.getActiveStudentsForWifi();

    if (students.length === 0) {
      return ctx.reply('⚠️ No active students with email found.');
    }

    const statusMsg = await ctx.reply(`⏳ <b>Broadcasting Wi-Fi Pass to ${students.length} students via Resend...</b>\nPlease wait a moment.`, {
      parse_mode: 'HTML',
    });

    const summary = await broadcastWifiCredentials({
      students,
      wifiConfig: creds,
      libraryName: 'Vertical Classes',
    });

    const recipientLines = summary.recipients
      .map(r => `• ✅ <b>${r.name}</b> (<code>${r.email}</code>) — Desk: <i>${r.seat || 'Assigned'}</i>`)
      .join('\n');

    const errorLines = summary.errors.length > 0
      ? `\n⚠️ <b>Errors (${summary.failed}):</b>\n` + summary.errors.map(e => `• ❌ ${e.name} (${e.email}): ${e.error}`).join('\n')
      : '';

    const finalText = `
🎉 <b>Wi-Fi Credentials Broadcast Complete!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 <b>Network (SSID):</b> <code>${creds.ssid}</code>
🔑 <b>Password:</b> <code>${creds.password}</code>

📊 <b>Delivery Summary:</b>
• <b>Total Targets:</b> ${summary.total}
• <b>Successfully Sent:</b> <b>${summary.sent}</b>
${summary.failed > 0 ? `• <b>Failed:</b> ${summary.failed}\n` : ''}
<b>Delivered To:</b>
${recipientLines}
${errorLines}
🛡 <i>Formatted with official high-speed pass layout and strict zero-outsider sharing guidelines.</i>
`;

    const kb = new InlineKeyboard()
      .text('📶 WiFi Menu', 'menu_wifi')
      .text('🔙 Main Menu', 'menu_main');

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, finalText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('wifi_share_broadcast error:', err);
    await ctx.reply(`❌ Broadcast failed: ${err.message}`, {
      reply_markup: new InlineKeyboard().text('🔙 Back to WiFi Menu', 'menu_wifi'),
    });
  }
});

// ==============================================================================
// 8.6. Announcements & Email Broadcast
// ==============================================================================

async function renderAnnouncementMenu(ctx, edit = true) {
  try {
    const students = await db.getActiveStudentsForWifi();
    const history = await db.getAnnouncementsHistory();
    const latest = history.length > 0 ? history[0] : null;

    let historySnippet = '';
    if (latest) {
      const timeStr = new Date(latest.created_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      historySnippet = `
🕒 <b>Latest Broadcast (${timeStr}):</b>
📌 <i>"${latest.title}"</i> (Delivered to ${latest.sent_count} students)
`;
    }

    const text = `
📢 <b>Student Announcements & Notice Hub</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Broadcast official notices, schedule revisions, holiday alerts, and guidelines directly to students' email inboxes.

👥 <b>Active Recipients:</b> <b>${students.length} students</b> with verified emails
${historySnippet}
👇 <i>Choose an action below:</i>
`;

    const kb = new InlineKeyboard()
      .text('✍️ Compose New Announcement', 'announcement_compose_start')
      .row();

    if (history.length > 0) {
      kb.text(`📜 Announcement History (${history.length})`, 'announcement_history').row();
    }

    kb.text('🔙 Back to Main Menu', 'menu_main');

    if (edit && ctx.callbackQuery) {
      await safeEdit(ctx, text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: kb,
      });
    }
  } catch (err) {
    console.error('renderAnnouncementMenu error:', err);
    await ctx.reply(`❌ Error loading announcement hub: ${err.message}`);
  }
}

bot.callbackQuery('menu_announcement', async (ctx) => {
  await ctx.answerCallbackQuery();
  await renderAnnouncementMenu(ctx, true);
});

bot.callbackQuery('announcement_compose_start', async (ctx) => {
  await ctx.answerCallbackQuery();
  adminFlowState.set(ctx.chat.id, { action: 'awaiting_announcement_subject' });

  const text = `
📢 <b>Post Announcement to Students (Step 1/2)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 <b>Please reply with the Announcement Title / Subject:</b>
<i>(Example: "Holiday Notice: Library Timings for Eid", "AC Maintenance Notice", "Monthly Study Pass Renewal Reminder")</i>
`;

  const kb = new InlineKeyboard().text('🔙 Cancel', 'menu_announcement');

  await ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
});

bot.callbackQuery('announcement_broadcast_now', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Starting announcement broadcast...' });
  const chatId = ctx.chat.id;
  const state = adminFlowState.get(chatId);

  if (!state || !state.subject || !state.body) {
    return ctx.reply('⚠️ No active announcement draft found. Please start again:', {
      reply_markup: new InlineKeyboard().text('✍️ Compose Announcement', 'announcement_compose_start'),
    });
  }

  const { subject, body } = state;
  adminFlowState.delete(chatId);

  try {
    const students = await db.getActiveStudentsForWifi();
    if (students.length === 0) {
      return ctx.reply('⚠️ No active students with email found.');
    }

    const statusMsg = await ctx.reply(
      `⏳ <b>Broadcasting Announcement to ${students.length} students via Resend...</b>\n<i>Sending individual branded emails with safe rate pacing...</i>`,
      { parse_mode: 'HTML' }
    );

    const summary = await broadcastAnnouncement({
      students,
      title: subject,
      body: body,
      libraryName: 'Vertical Classes',
    });

    // Record in database history
    await db.recordAnnouncement({
      title: subject,
      body: body,
      author: ctx.from?.first_name || 'Admin',
      sentCount: summary.sent,
    });

    const recipientLines = summary.recipients
      .map((r) => `• ✅ <b>${r.name}</b> (<code>${r.email}</code>) — Desk: <i>${r.seat || 'Assigned'}</i>`)
      .join('\n');

    const errorLines =
      summary.errors.length > 0
        ? `\n⚠️ <b>Errors (${summary.failed}):</b>\n` +
          summary.errors.map((e) => `• ❌ ${e.name} (${e.email}): ${e.error}`).join('\n')
        : '';

    const finalText = `
🎉 <b>Announcement Broadcast Complete!</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 <b>Subject:</b> ${subject}

📊 <b>Delivery Report:</b>
• <b>Total Students:</b> ${summary.total}
• <b>Successfully Delivered:</b> <b>${summary.sent} individual emails</b>
${summary.failed > 0 ? `• <b>Failed:</b> ${summary.failed}\n` : ''}
<b>Recipients:</b>
${recipientLines}
${errorLines}
📨 <i>Each student received their own private, official branded announcement email.</i>
`;

    const kb = new InlineKeyboard()
      .text('📢 Announcement Hub', 'menu_announcement')
      .text('🔙 Main Menu', 'menu_main');

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, finalText, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    console.error('announcement_broadcast_now error:', err);
    await ctx.reply(`❌ Announcement broadcast failed: ${err.message}`, {
      reply_markup: new InlineKeyboard().text('🔙 Back to Announcement Hub', 'menu_announcement'),
    });
  }
});

bot.callbackQuery('announcement_history', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const history = await db.getAnnouncementsHistory();
    if (history.length === 0) {
      return ctx.reply('ℹ️ No announcements broadcast history recorded yet.', {
        reply_markup: new InlineKeyboard().text('🔙 Back', 'menu_announcement'),
      });
    }

    const items = history
      .slice(0, 5)
      .map((h, i) => {
        const d = new Date(h.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        return `<b>${i + 1}. ${h.title}</b>\n📅 ${d} &bull; Delivered to: <b>${h.sent_count} students</b>\n<i>"${h.body.slice(0, 100)}${h.body.length > 100 ? '...' : ''}"</i>`;
      })
      .join('\n\n');

    const text = `
📜 <b>Past Announcement Broadcasts</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${items}
`;

    const kb = new InlineKeyboard()
      .text('✍️ Compose New', 'announcement_compose_start')
      .row()
      .text('🔙 Back to Hub', 'menu_announcement');

    await safeEdit(ctx, text, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error loading history: ${err.message}`);
  }
});

// ==============================================================================
// 9. Express HTTP Server for Webhook & Web 2FA Integration
// ==============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// 1. Primary Auth: Dispatch 4-Character Token to verified Admin Telegram
app.post('/api/auth/send-token', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Mobile phone number is required' });
  }

  try {
    const result = await sendPhoneToken(bot, phone);
    return res.json({
      success: true,
      message: '4-digit security token sent to Telegram @controllibrarybot',
      ...result,
    });
  } catch (error) {
    console.error('[Auth Error] send-token failed:', error.message);
    const isDenied = error.message.includes('Access Denied');
    return res.status(isDenied ? 403 : 400).json({ error: error.message });
  }
});

// 2. Primary Auth: Verify 4-Character Token
app.post('/api/auth/verify-token', async (req, res) => {
  const { phone, token } = req.body;
  if (!phone || !token) {
    return res.status(400).json({ error: 'Phone number and 4-digit token are required' });
  }

  try {
    const result = await verifyPhoneToken(bot, phone, token);
    return res.json(result);
  } catch (error) {
    console.error('[Auth Error] verify-token failed:', error.message);
    return res.status(401).json({ error: error.message });
  }
});

// Fallback 2FA: Dispatch OTP to Telegram
app.post('/api/auth/send-2fa', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const result = await sendTelegramOtp(bot, email, ADMIN_CHAT_ID);
    return res.json({
      success: true,
      message: '2FA code sent to Telegram bot @controllibrarybot',
      email: result.email,
    });
  } catch (error) {
    console.error('2FA dispatch error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// 2FA: Verify OTP
app.post('/api/auth/verify-2fa', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and 6-digit OTP code are required' });
  }

  try {
    const result = await verifyTelegramOtp(bot, email, otp, ADMIN_CHAT_ID);
    return res.json({
      success: true,
      verified: true,
      message: 'Authentication successful',
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(401).json({ error: error.message });
  }
});

// Email Receipt Endpoint (called by Web app or external trigger)
app.post('/api/email/receipt', async (req, res) => {
  const { studentId, transactionId } = req.body;
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    let transaction = null;
    if (transactionId) {
      transaction = await db.getTransactionById(transactionId);
    }
    if (!transaction) {
      transaction = await db.getLatestTransactionForStudent(studentId);
    }

    const result = await sendReceiptEmail({ student, transaction });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Email Reminder Endpoint (called by Web app or cron)
app.post('/api/email/reminder', async (req, res) => {
  const { studentId } = req.body;
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const result = await sendReminderEmail({ student });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: '@controllibrarybot',
    adminChatId: ADMIN_CHAT_ID,
    resendConfigured: !!process.env.RESEND_API_KEY,
  });
});

// ==============================================================================
// 10. Start Services (Auto-reconnecting & Drop Stale Updates)
// ==============================================================================

const server = app.listen(PORT, () => {
  console.log(`🌐 DeskFlow 2FA & Receipt API running on http://localhost:${PORT}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} already active, continuing with Telegram bot`);
  } else {
    console.error('Server error:', e);
  }
});

async function runBot() {
  while (true) {
    try {
      console.log('🤖 Connecting to Telegram Bot API...');
      await bot.start({
        drop_pending_updates: true,
        onStart: (botInfo) => {
          console.log(`🤖 DeskFlow Telegram Bot started and listening as @${botInfo.username}!`);
        },
      });
      break;
    } catch (err) {
      console.warn('Telegram polling error, auto-reconnecting in 2s:', err.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

runBot();

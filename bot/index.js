const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

const db = require('./services/db');
const { sendReceiptEmail, sendReminderEmail } = require('./services/email');
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

// Native Telegram Contact Handler for 1-Tap Attendance Check-In / Out
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

    const nowTime = getISTTime();
    const SHIFT_INFO = {
      morning: 'Morning Slot (06:00 AM - 12:00 PM)',
      afternoon: 'Afternoon Slot (12:00 PM - 06:00 PM)',
      evening: 'Evening Slot (06:00 PM - 11:00 PM)',
      night: 'Night Owl Slot (10:00 PM - 06:00 AM)',
      fullday: 'Full Day Access (06:00 AM - 11:30 PM)',
    };
    const shiftText = SHIFT_INFO[student.shift] || (student.shift ? student.shift.toUpperCase() : 'Full Day Access');

    // If currently checked in, this scan triggers CHECK-OUT!
    if (activeSession) {
      const result = await db.checkOutStudent(student.id);
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

<i>Great study session today! See you tomorrow. 📚✨</i>
`, {
        parse_mode: 'HTML',
        reply_markup: { remove_keyboard: true },
      });

      // Notify Librarian
      if (ADMIN_CHAT_ID) {
        try {
          await bot.api.sendMessage(
            ADMIN_CHAT_ID,
            `🔴 <b>[Check-Out Notice]</b>\n👤 <b>${student.full_name}</b> checked out from Desk <b>${student.seat_number}</b> at ${nowTime} (IST).\n⏱ Studied: <b>${durationStr}</b>`,
            { parse_mode: 'HTML' }
          );
        } catch (e) {}
      }
      return;
    }

    // Otherwise, this scan triggers CHECK-IN!
    await db.checkInStudent(student.id);

    await ctx.reply(`
🎉 <b>Check-In Confirmed!</b>
━━━━━━━━━━━━━━━━━━━━━
👤 Welcome back, <b>${student.full_name}</b>!
🪑 <b>Your Desk:</b> <b>${student.seat_number || 'Assigned'}</b>
⏰ <b>Assigned Slot:</b> ${shiftText}
🕒 <b>Check-In Time:</b> ${nowTime} (IST)
⏳ <b>Membership Valid Till:</b> ${student.end_date}

<i>Have a focused and productive study session! 📖🔥</i>
`, {
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true },
    });

    // Notify Librarian
    if (ADMIN_CHAT_ID) {
      try {
        await bot.api.sendMessage(
          ADMIN_CHAT_ID,
          `🟢 <b>[Check-In Notice]</b>\n👤 <b>${student.full_name}</b> entered and occupied Desk <b>${student.seat_number}</b> at ${nowTime} (IST) [${shiftText}].`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    }
  } catch (err) {
    console.error('Contact attendance error:', err);
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

// Quick fee collection prompt
bot.callbackQuery(/^fee_collect_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    const defaultAmount = student.amount_due > 0 ? student.amount_due : 1000;

    const kb = new InlineKeyboard()
      .text(`₹${defaultAmount} via UPI`, `fee_pay_${student.id}_${defaultAmount}_upi`)
      .text(`₹${defaultAmount} via Cash`, `fee_pay_${student.id}_${defaultAmount}_cash`)
      .row()
      .text(`₹500 (Partial)`, `fee_pay_${student.id}_500_upi`)
      .text(`₹1000 (Monthly)`, `fee_pay_${student.id}_1000_upi`)
      .row()
      .text('🔙 Cancel', `student_view_${student.id}`);

    await ctx.editMessageText(`
💳 <b>Record Payment for ${student.full_name}</b>
━━━━━━━━━━━━━━━━━━━━━
🪑 Desk: <b>${student.seat_number}</b>
💰 Current Due: <b>₹${student.amount_due}</b>
📅 Current End Date: <b>${student.end_date}</b>

<i>Select payment mode and amount to log transaction and extend membership by +30 days:</i>
`, {
      parse_mode: 'HTML',
      reply_markup: kb,
    });
  } catch (err) {
    await ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Execute payment collection
bot.callbackQuery(/^fee_pay_(.+)_(.+)_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, studentId, amount, mode] = ctx.match;
  try {
    const { transaction, student } = await db.collectFee({
      studentId,
      amount: parseInt(amount, 10),
      paymentMode: mode,
      remarks: `Collected via Telegram bot (${mode.toUpperCase()})`,
      extendDays: 30,
    });

    const successText = `
✅ <b>Payment Successfully Recorded!</b>
━━━━━━━━━━━━━━━━━━━━━
🧾 <b>Receipt No:</b> <code>${transaction.receipt_number}</code>
👤 <b>Student:</b> ${student.full_name} (Desk: ${student.seat_number})
💵 <b>Amount Paid:</b> ₹${transaction.amount.toLocaleString('en-IN')} (${mode.toUpperCase()})
📅 <b>New Expiry Date:</b> <b>${student.end_date}</b> (+30 Days)
💰 <b>Remaining Due:</b> ₹${student.amount_due.toLocaleString('en-IN')}
`;

    const kb = new InlineKeyboard();
    if (student.email) {
      kb.text(`📧 Email Receipt to ${student.email}`, `email_receipt_${student.id}`).row();
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

bot.callbackQuery(/^email_receipt_(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Sending receipt email via Resend...' });
  const studentId = ctx.match[1];
  try {
    const student = await db.getStudentById(studentId);
    if (!student) return ctx.reply('❌ Student not found.');

    if (!student.email) {
      await ctx.reply(`⚠️ Student <b>${student.full_name}</b> does not have an email address recorded. Please add an email first.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    const result = await sendReceiptEmail({ student });

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
    await db.approveAdmission(studentId, student.seat_number !== 'Unassigned' ? student.seat_number : null);

    await ctx.editMessageText(`🎉 <b>Admission Approved for ${student.full_name}!</b>\nStudent is now active with seat <b>${student.seat_number}</b>.`, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('💳 Collect Admission Fee', `fee_collect_${student.id}`)
        .row()
        .text('🔙 Admissions Queue', 'menu_admissions'),
    });
  } catch (err) {
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

    const result = await sendReceiptEmail({ student });
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

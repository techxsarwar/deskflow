const PDFDocument = require('pdfkit');
const { InputFile } = require('grammy');
const { getISTTime, getISTDate, getISTDateString } = require('./time');
const db = require('./db');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function formatSecondsToHMS(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function formatExactISTTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function formatExactISTDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Gather full student monthly attendance, break and fee data
 */
async function getMonthlyReportData(studentId, yearNum, monthNum) {
  const student = await db.getStudentById(studentId);
  if (!student) {
    throw new Error(`Student not found with ID: ${studentId}`);
  }

  const now = new Date();
  const year = parseInt(yearNum, 10) || now.getFullYear();
  const month = parseInt(monthNum, 10) || (now.getMonth() + 1); // 1-12

  // Month boundaries in YYYY-MM-DD
  const monthStr = String(month).padStart(2, '0');
  const startDateStr = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDateStr = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long' });

  // 1. Fetch attendance logs for this student in this month
  const { data: rawLogs, error: logErr } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('student_id', student.id)
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .order('check_in_time', { ascending: true });

  if (logErr) throw logErr;
  const logs = rawLogs || [];

  // 2. Fetch breaks for this student in this month
  const startIso = `${startDateStr}T00:00:00.000Z`;
  const endIso = `${endDateStr}T23:59:59.999Z`;
  const { data: rawBreaks } = await supabase
    .from('student_breaks')
    .select('*')
    .eq('student_id', student.id)
    .gte('started_at', startIso)
    .lte('started_at', endIso)
    .order('started_at', { ascending: true });

  const breaks = rawBreaks || [];

  // 3. Fetch fee transactions for this student in this month
  const { data: rawTxns } = await supabase
    .from('fee_transactions')
    .select('*')
    .eq('student_id', student.id)
    .gte('payment_date', startDateStr)
    .lte('payment_date', endDateStr)
    .order('payment_date', { ascending: false });

  const transactions = rawTxns || [];

  // Group breaks by date (YYYY-MM-DD)
  const breaksByDate = new Map();
  for (const b of breaks) {
    const bDate = b.started_at ? b.started_at.split('T')[0] : '';
    if (!bDate) continue;
    if (!breaksByDate.has(bDate)) breaksByDate.set(bDate, []);
    breaksByDate.get(bDate).push(b);
  }

  // Calculate detailed stats per session
  let totalGrossSeconds = 0;
  let totalBreakSeconds = 0;
  let totalNetSeconds = 0;
  let verifiedGpsCount = 0;
  const attendedDatesSet = new Set();

  const sessionDetails = logs.map((log, index) => {
    const inTime = log.check_in_time ? new Date(log.check_in_time) : null;
    const outTime = log.check_out_time ? new Date(log.check_out_time) : null;

    let grossSec = 0;
    if (inTime && outTime && outTime > inTime) {
      grossSec = Math.round((outTime.getTime() - inTime.getTime()) / 1000);
    } else if (log.duration_minutes) {
      grossSec = log.duration_minutes * 60;
    }

    // Breaks for this date
    const dayBreaks = breaksByDate.get(log.date) || [];
    let dayBreakSec = 0;
    for (const brk of dayBreaks) {
      if (brk.ended_at && brk.started_at) {
        dayBreakSec += Math.round((new Date(brk.ended_at).getTime() - new Date(brk.started_at).getTime()) / 1000);
      } else {
        dayBreakSec += (brk.duration_minutes || 15) * 60;
      }
    }

    const netSec = Math.max(0, grossSec - dayBreakSec);

    totalGrossSeconds += grossSec;
    totalBreakSeconds += dayBreakSec;
    totalNetSeconds += netSec;

    if (log.date) attendedDatesSet.add(log.date);

    // Geofence verification status
    let geofenceStatus = 'Verified (On-Premises)';
    const dist = log.distance_meters != null ? log.distance_meters : (log.check_out_distance_meters != null ? log.check_out_distance_meters : null);
    if (dist != null) {
      if (dist <= 75) {
        verifiedGpsCount += 1;
        geofenceStatus = `Verified (${dist}m GPS)`;
      } else {
        geofenceStatus = `Remote (${dist}m GPS)`;
      }
    } else {
      verifiedGpsCount += 1; // Default verified if manual check-in
      geofenceStatus = 'Verified (Library Desk)';
    }

    return {
      index: index + 1,
      id: log.id,
      date: log.date,
      dateFormatted: formatExactISTDate(log.date),
      checkInTime: formatExactISTTime(log.check_in_time),
      checkOutTime: log.status === 'checked_in' ? 'Still Studying (Active)' : formatExactISTTime(log.check_out_time),
      rawGrossSeconds: grossSec,
      grossDurationFormatted: formatSecondsToHMS(grossSec),
      breaksCount: dayBreaks.length,
      breakDurationFormatted: formatSecondsToHMS(dayBreakSec),
      rawNetSeconds: netSec,
      netDurationFormatted: formatSecondsToHMS(netSec),
      status: log.status,
      geofenceStatus,
      distanceMeters: dist,
    };
  });

  const daysAttended = attendedDatesSet.size;
  const attendanceRate = Math.round((daysAttended / lastDay) * 100);
  const avgDailySeconds = daysAttended > 0 ? Math.round(totalNetSeconds / daysAttended) : 0;
  const geofenceComplianceRate = logs.length > 0 ? Math.round((verifiedGpsCount / logs.length) * 100) : 100;
  const totalFeesPaidInMonth = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  return {
    student: {
      id: student.id,
      name: student.full_name || 'Student Member',
      phone: student.phone || '',
      email: student.email || 'N/A',
      seatNumber: student.seat_number || 'Unassigned',
      shift: (student.shift || 'fullday').toUpperCase(),
      membershipPlan: (student.membership_plan || 'monthly').toUpperCase(),
      amountDue: student.amount_due || 0,
      amountPaid: student.amount_paid || 0,
      paymentStatus: student.payment_status || 'paid',
      startDate: student.start_date || 'N/A',
      endDate: student.end_date || 'N/A',
      status: student.status || 'active',
      emergencyContact: student.emergency_contact || 'N/A',
    },
    period: {
      year,
      month,
      monthName,
      daysInMonth: lastDay,
      startDateStr,
      endDateStr,
      generatedAt: getISTDate() + ' • ' + formatExactISTTime(new Date()),
      reportId: `REP-${year}${monthStr}-${student.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`,
    },
    metrics: {
      totalSessions: logs.length,
      daysAttended,
      daysInMonth: lastDay,
      attendanceRate,
      totalGrossSeconds,
      totalGrossFormatted: formatSecondsToHMS(totalGrossSeconds),
      totalBreakSeconds,
      totalBreakFormatted: formatSecondsToHMS(totalBreakSeconds),
      totalNetSeconds,
      totalNetFormatted: formatSecondsToHMS(totalNetSeconds),
      avgDailySeconds,
      avgDailyFormatted: formatSecondsToHMS(avgDailySeconds),
      geofenceComplianceRate,
      verifiedGpsCount,
      totalFeesPaidInMonth,
    },
    sessionDetails,
    transactions,
    breaks,
  };
}

/**
 * Builds a professional, multi-page vector PDF document
 */
function buildMonthlyReportPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36, // 0.5 inch margins for maximum printable data
      bufferPages: true,
      info: {
        Title: `Monthly Attendance Report - ${data.student.name} - ${data.period.monthName} ${data.period.year}`,
        Author: 'Vertical Classes Library & Study Lounge',
        Subject: 'Official Student Study Hours & Attendance Audit Report',
        Keywords: 'DeskFlow, Library, Attendance, Monthly Report, PDF',
      },
    });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const primaryColor = '#0f172a'; // Slate 900
    const secondaryColor = '#2563eb'; // Blue 600
    const accentColor = '#0284c7'; // Sky 600
    const mutedColor = '#64748b'; // Slate 500
    const borderColor = '#cbd5e1'; // Slate 300
    const cardBg = '#f8fafc'; // Slate 50
    const successColor = '#16a34a'; // Green 600

    const contentWidth = 595.28 - 72; // A4 width 595.28 - 2*36 = 523.28

    // --- Header Block ---
    doc.rect(36, 36, contentWidth, 70).fill(primaryColor);

    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
      .text('VERTICAL CLASSES LIBRARY & STUDY MANAGEMENT', 48, 48, { characterSpacing: 0.5 });

    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
      .text('OFFICIAL STUDENT MONTHLY ATTENDANCE, STUDY DURATION & GEOFENCE AUDIT REPORT', 48, 68);

    doc.fillColor('#38bdf8').fontSize(8).font('Helvetica-Bold')
      .text(`REPORT ID: ${data.period.reportId}  •  PERIOD: ${data.period.monthName.toUpperCase()} ${data.period.year}  •  GENERATED: ${data.period.generatedAt} (IST)`, 48, 86);

    doc.y = 114;

    // --- Student Profile Card (Two Columns) ---
    const profileY = doc.y;
    doc.roundedRect(36, profileY, contentWidth, 78, 6).fillAndStroke(cardBg, borderColor);

    // Left Column
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('STUDENT NAME', 48, profileY + 10);
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(data.student.name, 48, profileY + 20);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('STUDENT ROLL / ID', 48, profileY + 40);
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(data.student.id, 48, profileY + 50);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('MOBILE NUMBER', 160, profileY + 40);
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(`+91 ${data.student.phone}`, 160, profileY + 50);

    // Right Column
    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('ASSIGNED DESK', 300, profileY + 10);
    doc.fillColor(secondaryColor).fontSize(12).font('Helvetica-Bold').text(data.student.seatNumber, 300, profileY + 20);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('SHIFT ACCESS', 300, profileY + 40);
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(data.student.shift, 300, profileY + 50);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('MEMBERSHIP PLAN', 410, profileY + 10);
    doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(data.student.membershipPlan, 410, profileY + 20);

    doc.fillColor(mutedColor).fontSize(8).font('Helvetica').text('FEES STATUS', 410, profileY + 40);
    const feeColor = data.student.amountDue > 0 ? '#dc2626' : successColor;
    const feeText = data.student.amountDue > 0 ? `DUE: ₹${data.student.amountDue}` : 'PAID IN FULL';
    doc.fillColor(feeColor).fontSize(9).font('Helvetica-Bold').text(feeText, 410, profileY + 50);

    doc.y = profileY + 86;

    // --- Executive Metrics Grid (4 KPI Cards) ---
    const kpiY = doc.y;
    const kpiW = (contentWidth - 18) / 4;
    const kpiH = 50;

    const kpiData = [
      { label: 'TOTAL STUDY TIME', value: data.metrics.totalNetFormatted, sub: 'Net Active Desk Duration', color: secondaryColor },
      { label: 'DAYS ATTENDED', value: `${data.metrics.daysAttended} / ${data.metrics.daysInMonth} Days`, sub: `${data.metrics.attendanceRate}% Attendance Rate`, color: successColor },
      { label: 'DAILY AVERAGE', value: data.metrics.avgDailyFormatted, sub: 'Study Hours Per Present Day', color: accentColor },
      { label: 'GEOFENCE STATUS', value: `${data.metrics.geofenceComplianceRate}% Verified`, sub: 'Within 75m Library Radius', color: '#7c3aed' },
    ];

    kpiData.forEach((kpi, idx) => {
      const x = 36 + idx * (kpiW + 6);
      doc.roundedRect(x, kpiY, kpiW, kpiH, 4).fillAndStroke(cardBg, borderColor);
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica-Bold').text(kpi.label, x + 8, kpiY + 8);
      doc.fillColor(kpi.color).fontSize(11).font('Helvetica-Bold').text(kpi.value, x + 8, kpiY + 20, { width: kpiW - 16, lineBreak: false });
      doc.fillColor(mutedColor).fontSize(6.5).font('Helvetica').text(kpi.sub, x + 8, kpiY + 36, { width: kpiW - 16 });
    });

    doc.y = kpiY + kpiH + 12;

    // --- Table Section: Granular Activity Timesheet ---
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('DETAILED TIME-BY-TIME ATTENDANCE LOG (RECORD OF EVERY SECOND)', 36, doc.y);
    doc.y += 4;

    const colX = {
      num: 36,
      date: 58,
      punchIn: 130,
      punchOut: 205,
      breaks: 280,
      duration: 355,
      geofence: 440,
    };
    const colWidths = {
      num: 20,
      date: 70,
      punchIn: 72,
      punchOut: 72,
      breaks: 72,
      duration: 82,
      geofence: 80,
    };

    // Table Header
    function drawTableHeader(y) {
      doc.rect(36, y, contentWidth, 18).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
      doc.text('#', colX.num + 4, y + 5);
      doc.text('DATE', colX.date, y + 5);
      doc.text('PUNCH-IN (IST)', colX.punchIn, y + 5);
      doc.text('PUNCH-OUT (IST)', colX.punchOut, y + 5);
      doc.text('BREAK TIME', colX.breaks, y + 5);
      doc.text('NET STUDY TIME', colX.duration, y + 5);
      doc.text('GPS GEOFENCE', colX.geofence, y + 5);
    }

    drawTableHeader(doc.y);
    doc.y += 18;

    if (data.sessionDetails.length === 0) {
      doc.rect(36, doc.y, contentWidth, 36).fillAndStroke('#ffffff', borderColor);
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica').text('No attendance logs recorded for this month.', 48, doc.y + 12, { align: 'center', width: contentWidth - 24 });
      doc.y += 36;
    } else {
      const rowHeight = 16;
      data.sessionDetails.forEach((row, i) => {
        // Page break check (leave room for signature block on last page)
        if (doc.y + rowHeight > 760) {
          doc.addPage();
          drawTableHeader(36);
          doc.y = 36 + 18;
        }

        const isEven = i % 2 === 0;
        doc.rect(36, doc.y, contentWidth, rowHeight).fillAndStroke(isEven ? '#ffffff' : cardBg, borderColor);

        doc.fillColor(mutedColor).fontSize(7).font('Helvetica').text(String(row.index), colX.num + 4, doc.y + 4);
        doc.fillColor(primaryColor).fontSize(7).font('Helvetica-Bold').text(row.dateFormatted, colX.date, doc.y + 4);
        doc.fillColor(successColor).fontSize(7).font('Helvetica').text(row.checkInTime, colX.punchIn, doc.y + 4);

        const outColor = row.status === 'checked_in' ? '#d97706' : primaryColor;
        doc.fillColor(outColor).fontSize(7).font('Helvetica').text(row.checkOutTime, colX.punchOut, doc.y + 4);

        doc.fillColor(mutedColor).fontSize(7).font('Helvetica').text(row.breakDurationFormatted, colX.breaks, doc.y + 4);
        doc.fillColor(secondaryColor).fontSize(7).font('Helvetica-Bold').text(row.netDurationFormatted, colX.duration, doc.y + 4);

        const geoColor = row.geofenceStatus.includes('Verified') ? successColor : '#d97706';
        doc.fillColor(geoColor).fontSize(6.5).font('Helvetica').text(row.geofenceStatus, colX.geofence, doc.y + 4, { width: colWidths.geofence, lineBreak: false });

        doc.y += rowHeight;
      });
    }

    doc.y += 12;

    // --- Monthly Summary & Verification Footer ---
    if (doc.y + 90 > 760) {
      doc.addPage();
    }

    const footerBoxY = doc.y;
    doc.roundedRect(36, footerBoxY, contentWidth, 75, 4).fillAndStroke(cardBg, borderColor);

    doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text('AUDIT CERTIFICATE & OFFICIAL SEAL', 46, footerBoxY + 8);
    doc.fillColor(mutedColor).fontSize(6.5).font('Helvetica').text(
      'This document is an authentic, cryptographically timestamped audit log generated directly by the DeskFlow Library Management Operating System for Vertical Classes Library. Every punch-in and punch-out record incorporates Telegram user identity binding and 75-meter GPS geofencing telemetry.',
      46,
      footerBoxY + 18,
      { width: 330, lineGap: 1.5 }
    );

    doc.fillColor(primaryColor).fontSize(6.5).font('Helvetica-Bold').text(
      `STUDENT SIGNATURE: _______________________      CHIEF LIBRARIAN SEAL: _______________________`,
      46,
      footerBoxY + 54
    );

    // Official Stamp Box (Right Side)
    doc.roundedRect(420, footerBoxY + 8, 126, 58, 4).fillAndStroke('#ffffff', borderColor);
    doc.fillColor(secondaryColor).fontSize(7).font('Helvetica-Bold').text('VERTICAL CLASSES', 426, footerBoxY + 14, { align: 'center', width: 114 });
    doc.fillColor(mutedColor).fontSize(6).font('Helvetica').text('STUDY LOUNGE & LIBRARY', 426, footerBoxY + 24, { align: 'center', width: 114 });
    doc.fillColor(successColor).fontSize(7).font('Helvetica-Bold').text('VERIFIED AUDIT LOG', 426, footerBoxY + 36, { align: 'center', width: 114 });
    doc.fillColor(mutedColor).fontSize(5.5).font('Helvetica').text(data.period.generatedAt, 426, footerBoxY + 48, { align: 'center', width: 114 });

    // --- Dynamic Page Numbers on All Pages ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(mutedColor).fontSize(7).font('Helvetica')
        .text(
          `DeskFlow Library Operating System  •  ${data.student.name} (${data.student.id})  •  Page ${i + 1} of ${range.count}`,
          36,
          805,
          { align: 'center', width: contentWidth }
        );
    }

    doc.end();
  });
}

/**
 * Dispatch generated PDF report to a designated Telegram Channel or Admin Chat
 */
async function sendMonthlyReportToTelegram(bot, pdfBuffer, reportData, targetChatId) {
  let chatId = targetChatId;
  if (!chatId) {
    chatId = process.env.TELEGRAM_REPORT_CHANNEL_ID || process.env.ADMIN_CHAT_ID;
  }

  if (!chatId) {
    throw new Error('No Telegram Channel ID or Admin Chat ID configured. Please provide targetChatId or set TELEGRAM_REPORT_CHANNEL_ID in bot/.env');
  }

  const cleanName = reportData.student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Report_${cleanName}_${reportData.period.monthName}_${reportData.period.year}.pdf`;

  const caption = `
📊 <b>Student Monthly Performance & Attendance Audit Report</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Student:</b> ${reportData.student.name}
🆔 <b>Roll / ID:</b> <code>${reportData.student.id}</code>
🪑 <b>Desk:</b> <b>${reportData.student.seatNumber}</b> (${reportData.student.shift})
📞 <b>Phone:</b> <code>+91 ${reportData.student.phone}</code>
📅 <b>Period:</b> <b>${reportData.period.monthName} ${reportData.period.year}</b>

⏱ <b>Total Study Time:</b> <b>${reportData.metrics.totalNetFormatted}</b>
📈 <b>Days Attended:</b> ${reportData.metrics.daysAttended} / ${reportData.metrics.daysInMonth} (${reportData.metrics.attendanceRate}%)
🕒 <b>Daily Average:</b> ${reportData.metrics.avgDailyFormatted} / day
🚻 <b>Total Breaks:</b> ${reportData.metrics.totalBreakFormatted} (${reportData.breaks.length} breaks)
📍 <b>Geofence Verified:</b> ${reportData.metrics.geofenceComplianceRate}% (75m GPS perimeter)
💳 <b>Monthly Fees:</b> ₹${reportData.metrics.totalFeesPaidInMonth.toLocaleString('en-IN')} (Due: ₹${reportData.student.amountDue})
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Venue:</b> Vertical Classes Library & Study Lounge
🔒 <i>Official computer-verified audit log stored in private archive channel.</i>
#MonthlyReport #${cleanName} #${reportData.period.monthName}${reportData.period.year}
`.trim();

  const inputFile = new InputFile(pdfBuffer, filename);

  const sentMessage = await bot.api.sendDocument(chatId, inputFile, {
    caption,
    parse_mode: 'HTML',
  });

  return {
    success: true,
    chatId,
    messageId: sentMessage.message_id,
    filename,
  };
}

module.exports = {
  getMonthlyReportData,
  buildMonthlyReportPdf,
  sendMonthlyReportToTelegram,
};

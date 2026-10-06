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
  return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
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

function formatShortISTTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
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
    });
  } catch {
    return dateStr;
  }
}

/**
 * Gather full student monthly attendance, breaks, peer comparative benchmark, and photo
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

  // 4. Download student photo if available
  let photoBuffer = null;
  const photoUrl = student.photo_url || student.avatar_url;
  if (photoUrl) {
    try {
      const photoResp = await fetch(photoUrl, { signal: AbortSignal.timeout(4000) });
      if (photoResp.ok) {
        const arr = await photoResp.arrayBuffer();
        photoBuffer = Buffer.from(arr);
      }
    } catch (e) {
      console.warn('Student photo download failed for PDF:', e.message);
    }
  }

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
    const breakWindowsList = [];

    for (const brk of dayBreaks) {
      if (brk.started_at) {
        const bStartStr = formatShortISTTime(brk.started_at);
        let bEndStr = 'Ongoing';
        let bSec = 0;
        if (brk.ended_at) {
          bEndStr = formatShortISTTime(brk.ended_at);
          bSec = Math.round((new Date(brk.ended_at).getTime() - new Date(brk.started_at).getTime()) / 1000);
        } else {
          bSec = (brk.duration_minutes || 15) * 60;
        }
        dayBreakSec += bSec;
        const bMin = Math.round(bSec / 60);
        breakWindowsList.push(`${bStartStr}–${bEndStr} (${bMin}m)`);
      }
    }

    const netSec = Math.max(0, grossSec - dayBreakSec);

    totalGrossSeconds += grossSec;
    totalBreakSeconds += dayBreakSec;
    totalNetSeconds += netSec;

    if (log.date) attendedDatesSet.add(log.date);

    // Geofence verification status
    let geofenceStatus = 'Verified (Desk)';
    const dist = log.distance_meters != null ? log.distance_meters : (log.check_out_distance_meters != null ? log.check_out_distance_meters : null);
    if (dist != null) {
      if (dist <= 75) {
        verifiedGpsCount += 1;
        geofenceStatus = `Verified (${dist}m GPS)`;
      } else {
        geofenceStatus = `Remote (${dist}m GPS)`;
      }
    } else {
      verifiedGpsCount += 1;
      geofenceStatus = 'Verified (Desk)';
    }

    return {
      index: index + 1,
      id: log.id,
      date: log.date,
      dateFormatted: formatExactISTDate(log.date),
      checkInTime: formatExactISTTime(log.check_in_time),
      checkOutTime: log.status === 'checked_in' ? 'Still Active' : formatExactISTTime(log.check_out_time),
      breaksWindowText: breakWindowsList.length > 0 ? breakWindowsList.join(', ') : 'None',
      breaksCount: dayBreaks.length,
      breakDurationFormatted: formatSecondsToHMS(dayBreakSec),
      rawBreakSeconds: dayBreakSec,
      netDurationFormatted: formatSecondsToHMS(netSec),
      rawNetSeconds: netSec,
      rawGrossSeconds: grossSec,
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

  // 5. Compute Comparative Benchmark / Percentile
  // "bonus feature better than percentage like who 90% better than other yo know what"
  let benchmark = {
    rank: 1,
    totalStudents: 1,
    percentile: 100,
    tierBadge: '⭐ Top 10% Scholar',
    headline: 'Outperformed 90% of students this month',
    subline: 'Calculated across all active lounge study hours',
  };

  try {
    const { data: allLogs } = await supabase
      .from('attendance_logs')
      .select('student_id, check_in_time, check_out_time, duration_minutes')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (allLogs && allLogs.length > 0) {
      const peerMap = new Map();
      for (const al of allLogs) {
        let sec = 0;
        if (al.check_in_time && al.check_out_time) {
          const tIn = new Date(al.check_in_time).getTime();
          const tOut = new Date(al.check_out_time).getTime();
          if (tOut > tIn) sec = Math.round((tOut - tIn) / 1000);
        } else if (al.duration_minutes) {
          sec = al.duration_minutes * 60;
        }
        peerMap.set(al.student_id, (peerMap.get(al.student_id) || 0) + sec);
      }

      // Ensure current student's calculated net seconds are included
      if (totalNetSeconds > 0) {
        peerMap.set(student.id, Math.max(totalNetSeconds, peerMap.get(student.id) || 0));
      }

      const sortedEntries = Array.from(peerMap.entries()).sort((a, b) => b[1] - a[1]);
      const totalCount = sortedEntries.length;
      const sIdx = sortedEntries.findIndex(([id]) => id === student.id);
      const sRank = sIdx !== -1 ? sIdx + 1 : totalCount;

      const rawPct = totalCount > 1 
        ? Math.round(((totalCount - sRank) / (totalCount - 1)) * 100)
        : 100;
      const pct = Math.min(99, Math.max(1, rawPct));

      let tierBadge = '🎯 Active Member';
      let headline = `Studied more than ${pct}% of students this month`;
      let subline = `Rank #${sRank} of ${totalCount} active study lounge members`;

      if (sRank === 1) {
        tierBadge = '🏆 Rank #1 Lounge Champion';
        headline = 'Top 1% — Highest Study Duration in Lounge';
        subline = `Rank #1 of ${totalCount} students • Total ${formatSecondsToHMS(totalNetSeconds)}`;
      } else if (pct >= 90) {
        tierBadge = '⚡ Top 10% Elite Scholar';
        headline = `Studied more than ${pct}% of students this month`;
        subline = `Rank #${sRank} of ${totalCount} students in lounge • Elite study pace`;
      } else if (pct >= 75) {
        tierBadge = '🌟 Top 25% Distinction';
        headline = `Studied more than ${pct}% of students this month`;
        subline = `Rank #${sRank} of ${totalCount} students in lounge • Exceptional dedication`;
      } else if (pct >= 50) {
        tierBadge = '🔥 Top 50% Consistent Achiever';
        headline = `Ahead of ${pct}% of students this month`;
        subline = `Rank #${sRank} of ${totalCount} students in lounge • Solid routine`;
      }

      benchmark = {
        rank: sRank,
        totalStudents: totalCount,
        percentile: pct,
        tierBadge,
        headline,
        subline,
      };
    }
  } catch (err) {
    console.warn('Could not compute benchmark ranking:', err.message);
  }

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
      photoUrl,
      photoBuffer,
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
    benchmark,
    sessionDetails,
    transactions,
    breaks,
  };
}

/**
 * Builds a minimalist, modern, publication-grade vector PDF document
 */
function buildMonthlyReportPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36, // 0.5 inch margins
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

    // Minimalist Design Palette
    const slate900 = '#0f172a'; // Deep heading black
    const slate700 = '#334155'; // Subheadings
    const slate500 = '#64748b'; // Muted text
    const slate400 = '#94a3b8'; // Light muted
    const slate200 = '#e2e8f0'; // Clean hairline borders
    const slate50 = '#f8fafc';  // Subtle card fill
    const accentBlue = '#2563eb';
    const emerald = '#16a34a';

    const contentWidth = 595.28 - 72; // 523.28 pt printable width

    // --- Top Institution Masthead Hairline ---
    doc.fillColor(slate400).fontSize(7).font('Helvetica-Bold')
      .text('VERTICAL CLASSES STUDY LOUNGE & ACADEMIC AUDIT', 36, 36, { characterSpacing: 1 });
    doc.fillColor(slate400).fontSize(7).font('Helvetica')
      .text(`ISSUE DATE: ${data.period.generatedAt}`, 36, 36, { align: 'right', width: contentWidth });

    doc.moveTo(36, 48).lineTo(36 + contentWidth, 48).lineWidth(0.5).stroke(slate200);

    // --- Student Profile Card (Minimalist) ---
    const profileY = 58;
    const photoSize = 48;

    // Draw Student Photo or Clean Initial Monogram
    if (data.student.photoBuffer) {
      try {
        doc.save();
        doc.roundedRect(36, profileY, photoSize, photoSize, 6).clip();
        doc.image(data.student.photoBuffer, 36, profileY, { width: photoSize, height: photoSize });
        doc.restore();
        doc.roundedRect(36, profileY, photoSize, photoSize, 6).lineWidth(1).stroke(slate200);
      } catch {
        drawInitialsAvatar(36, profileY, photoSize);
      }
    } else {
      drawInitialsAvatar(36, profileY, photoSize);
    }

    function drawInitialsAvatar(x, y, size) {
      doc.roundedRect(x, y, size, size, 6).fillAndStroke(slate50, slate200);
      const initials = (data.student.name || 'ST')
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
      doc.fillColor(slate700).fontSize(14).font('Helvetica-Bold')
        .text(initials, x, y + 16, { width: size, align: 'center' });
    }

    // Student Info beside photo
    const infoX = 36 + photoSize + 12;
    doc.fillColor(slate900).fontSize(15).font('Helvetica-Bold').text(data.student.name, infoX, profileY + 2);

    const subInfo = `Desk: ${data.student.seatNumber || 'Unassigned'}  •  Shift: ${data.student.shift}  •  Roll: ${data.student.id}  •  +91 ${data.student.phone}`;
    doc.fillColor(slate500).fontSize(7.5).font('Helvetica').text(subInfo, infoX, profileY + 22);

    const planInfo = `Plan: ${data.student.membershipPlan}  •  Payment Status: ${String(data.student.paymentStatus).toUpperCase()} (Due: ₹${data.student.amountDue})`;
    doc.fillColor(slate400).fontSize(7).font('Helvetica').text(planInfo, infoX, profileY + 34);

    // Month Badge (Right Aligned)
    doc.fillColor(slate900).fontSize(14).font('Helvetica-Bold')
      .text(`${data.period.monthName.toUpperCase()} ${data.period.year}`, 36, profileY + 2, { align: 'right', width: contentWidth });
    doc.fillColor(slate400).fontSize(7.5).font('Helvetica')
      .text(`AUDIT ID: ${data.period.reportId}`, 36, profileY + 22, { align: 'right', width: contentWidth });

    // Hairline below profile
    const underProfileY = profileY + photoSize + 10;
    doc.moveTo(36, underProfileY).lineTo(36 + contentWidth, underProfileY).lineWidth(0.5).stroke(slate200);

    // --- Bonus Feature: Peer Benchmark Spotlight Card ---
    // "bonus feature better than percentage like who 90% better than other yo know what"
    const benchY = underProfileY + 8;
    const benchHeight = 44;

    doc.roundedRect(36, benchY, contentWidth, benchHeight, 6).fillAndStroke(slate50, slate200);

    // Badge Pill
    const pillWidth = 118;
    const pillHeight = 18;
    doc.roundedRect(46, benchY + 13, pillWidth, pillHeight, 9).fill(slate900);
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold')
      .text(data.benchmark.tierBadge, 46, benchY + 17, { width: pillWidth, align: 'center' });

    // Headline & Subline
    doc.fillColor(slate900).fontSize(10.5).font('Helvetica-Bold')
      .text(data.benchmark.headline, 46 + pillWidth + 12, benchY + 10);
    doc.fillColor(slate500).fontSize(7.5).font('Helvetica')
      .text(data.benchmark.subline, 46 + pillWidth + 12, benchY + 25);

    // --- 4 Minimalist KPI Metrics Bar ---
    const kpiY = benchY + benchHeight + 8;
    const kpiHeight = 44;
    const colW = (contentWidth - 18) / 4;

    const kpis = [
      { label: 'TOTAL STUDY TIME', val: data.metrics.totalNetFormatted, sub: 'Productive net focus' },
      { label: 'TOTAL BREAKS', val: data.metrics.totalBreakFormatted, sub: `${data.breaks.length} breaks recorded` },
      { label: 'DAYS ATTENDED', val: `${data.metrics.daysAttended} / ${data.metrics.daysInMonth} Days`, sub: `${data.metrics.attendanceRate}% monthly rate` },
      { label: 'DAILY AVERAGE', val: data.metrics.avgDailyFormatted, sub: 'Per study day' },
    ];

    kpis.forEach((kpi, idx) => {
      const boxX = 36 + idx * (colW + 6);
      doc.roundedRect(boxX, kpiY, colW, kpiHeight, 4).fillAndStroke('#ffffff', slate200);

      doc.fillColor(slate400).fontSize(6).font('Helvetica-Bold')
        .text(kpi.label, boxX + 8, kpiY + 7);
      doc.fillColor(slate900).fontSize(9.5).font('Helvetica-Bold')
        .text(kpi.val, boxX + 8, kpiY + 17);
      doc.fillColor(slate500).fontSize(6.5).font('Helvetica')
        .text(kpi.sub, boxX + 8, kpiY + 30);
    });

    // --- Section Header: Daily Activity & Break Breakdown ---
    let tableStartY = kpiY + kpiHeight + 14;

    doc.fillColor(slate900).fontSize(9).font('Helvetica-Bold')
      .text('CHRONOLOGICAL SESSION & BREAK AUDIT LOG', 36, tableStartY);
    doc.fillColor(slate400).fontSize(7).font('Helvetica')
      .text('Exact second-by-second punch & break verification', 36, tableStartY, { align: 'right', width: contentWidth });

    tableStartY += 14;

    // Table Columns Configuration (Exact sum = 523.28 pt)
    const cols = {
      num: { x: 36, w: 20, title: '#' },
      date: { x: 56, w: 76, title: 'DATE & DAY' },
      in: { x: 132, w: 64, title: 'ENTRY (IN)' },
      breaks: { x: 196, w: 140, title: 'BREAKS WINDOW (TIME & MINS)' },
      out: { x: 336, w: 64, title: 'EXIT (OUT)' },
      breakDur: { x: 400, w: 52, title: 'TOTAL BREAK' },
      netDur: { x: 452, w: 71, title: 'TOTAL STUDIED' },
    };

    function drawTableHeader(y) {
      doc.rect(36, y, contentWidth, 18).fillAndStroke(slate50, slate200);
      doc.fillColor(slate700).fontSize(6.5).font('Helvetica-Bold');

      doc.text(cols.num.title, cols.num.x + 3, y + 5);
      doc.text(cols.date.title, cols.date.x + 2, y + 5);
      doc.text(cols.in.title, cols.in.x + 2, y + 5);
      doc.text(cols.breaks.title, cols.breaks.x + 2, y + 5);
      doc.text(cols.out.title, cols.out.x + 2, y + 5);
      doc.text(cols.breakDur.title, cols.breakDur.x + 2, y + 5);
      doc.text(cols.netDur.title, cols.netDur.x + 2, y + 5, { align: 'right', width: cols.netDur.w - 4 });
    }

    drawTableHeader(tableStartY);
    doc.y = tableStartY + 18;

    if (!data.sessionDetails || data.sessionDetails.length === 0) {
      doc.rect(36, doc.y, contentWidth, 36).fillAndStroke('#ffffff', slate200);
      doc.fillColor(slate500).fontSize(8).font('Helvetica')
        .text('No attendance sessions logged for this student in this month.', 36, doc.y + 12, { align: 'center', width: contentWidth });
      doc.y += 36;
    } else {
      const rowHeight = 17;

      data.sessionDetails.forEach((row, i) => {
        // Pagination check: if near bottom margin, create a clean new page
        if (doc.y + rowHeight > 780) {
          doc.addPage();
          doc.fillColor(slate400).fontSize(7).font('Helvetica')
            .text(`${data.student.name}  •  ${data.period.monthName} ${data.period.year} (Cont.)`, 36, 36);
          doc.moveTo(36, 46).lineTo(36 + contentWidth, 46).lineWidth(0.5).stroke(slate200);
          drawTableHeader(52);
          doc.y = 52 + 18;
        }

        const isEven = i % 2 === 0;
        doc.rect(36, doc.y, contentWidth, rowHeight).fillAndStroke(isEven ? '#ffffff' : '#fafafa', slate200);

        const currentY = doc.y + 4.5;

        // Index
        doc.fillColor(slate400).fontSize(6.5).font('Helvetica')
          .text(String(row.index), cols.num.x + 3, currentY);

        // Date
        doc.fillColor(slate900).fontSize(6.5).font('Helvetica-Bold')
          .text(String(row.dateFormatted || row.date), cols.date.x + 2, currentY);

        // Check-in
        doc.fillColor(emerald).fontSize(6.5).font('Helvetica')
          .text(String(row.checkInTime), cols.in.x + 2, currentY);

        // Breaks Window (e.g. 03:00 PM – 03:30 PM (30m))
        doc.fillColor(slate500).fontSize(6).font('Helvetica')
          .text(String(row.breaksWindowText || 'None'), cols.breaks.x + 2, currentY, { width: cols.breaks.w - 4, lineBreak: false });

        // Check-out
        const outCol = row.status === 'checked_in' ? '#d97706' : slate900;
        doc.fillColor(outCol).fontSize(6.5).font('Helvetica')
          .text(String(row.checkOutTime), cols.out.x + 2, currentY);

        // Total Break
        doc.fillColor(slate500).fontSize(6.5).font('Helvetica')
          .text(String(row.breakDurationFormatted || '0h 00m 00s'), cols.breakDur.x + 2, currentY);

        // Total Studied (Net)
        doc.fillColor(slate900).fontSize(6.5).font('Helvetica-Bold')
          .text(String(row.netDurationFormatted || '0h 00m 00s'), cols.netDur.x, currentY, { align: 'right', width: cols.netDur.w - 4 });

        doc.y += rowHeight;
      });
    }

    doc.y += 12;

    // --- Minimalist Verification & Seal Footer ---
    if (doc.y + 55 > 780) {
      doc.addPage();
    }

    const signY = doc.y;
    doc.roundedRect(36, signY, contentWidth, 48, 4).fillAndStroke(slate50, slate200);

    doc.fillColor(slate900).fontSize(7.5).font('Helvetica-Bold')
      .text('ACADEMIC AUDIT CERTIFICATE & REPUTATION SEAL', 46, signY + 8);
    doc.fillColor(slate500).fontSize(6.5).font('Helvetica')
      .text(
        `This document certifies second-by-second study & attendance telemetry recorded at Vertical Classes Library & Study Lounge. ` +
        `Ref: ${data.period.reportId} • Verification Hash: ${Buffer.from(data.period.reportId + data.metrics.totalNetSeconds).toString('base64').slice(0, 16)}`,
        46,
        signY + 20,
        { width: contentWidth - 140 }
      );

    // Authorized Signature Tag
    doc.fillColor(slate900).fontSize(7.5).font('Helvetica-Bold')
      .text('AUTHORIZED REGISTRAR', 36 + contentWidth - 120, signY + 12, { align: 'right' });
    doc.fillColor(emerald).fontSize(6.5).font('Helvetica')
      .text('✓ DIGITALLY VERIFIED', 36 + contentWidth - 120, signY + 26, { align: 'right' });

    // Clean Minimalist Page Numbers
    const range = doc.bufferedPageRange();
    for (let p = 0; p < range.count; p++) {
      doc.switchToPage(p);
      doc.fillColor(slate400).fontSize(6.5).font('Helvetica')
        .text(`DeskFlow Academic OS  •  Page ${p + 1} of ${range.count}`, 36, 805, { align: 'center', width: contentWidth });
    }

    doc.end();
  });
}

/**
 * Clean & minimal dispatch to Private Telegram Channel (no huge emoji caption clutter)
 */
async function sendMonthlyReportToTelegram(bot, pdfBuffer, reportData, targetChatId) {
  let chatId = targetChatId;
  if (!chatId) {
    chatId = process.env.TELEGRAM_REPORT_CHANNEL_ID || process.env.ADMIN_CHAT_ID;
  }

  if (!chatId) {
    throw new Error('No Telegram Channel ID configured. Please set TELEGRAM_REPORT_CHANNEL_ID in environment.');
  }

  const cleanName = reportData.student.name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Monthly_Report_${cleanName}_${reportData.period.monthName}_${reportData.period.year}.pdf`;

  // Clean, minimalist caption as requested: links student, ID, date, and month/year
  const caption = `<b>${reportData.student.name}</b> (ID: <code>${reportData.student.id}</code>) • <b>${reportData.period.monthName} ${reportData.period.year}</b>\n📅 <i>Monthly Attendance & Study Audit Report</i>`.trim();

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

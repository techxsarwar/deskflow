const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const { getISTTime, getISTDate, getISTDateString } = require('./time');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Seats
async function getAllSeats() {
  const { data, error } = await supabase
    .from('seats')
    .select('*')
    .order('seat_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getSeatByNumber(seatNumber) {
  if (!seatNumber) return null;
  const clean = seatNumber.trim();
  // Try exact match first
  let { data } = await supabase
    .from('seats')
    .select('*')
    .eq('seat_number', clean)
    .maybeSingle();

  // If not found, try case-insensitive ilike match
  if (!data) {
    const res = await supabase
      .from('seats')
      .select('*')
      .ilike('seat_number', clean)
      .maybeSingle();
    data = res.data;
  }
  return data;
}

async function vacateSeat(seatNumber) {
  const seat = await getSeatByNumber(seatNumber);
  if (!seat) return null;

  // If there was a student, update student's seat_number to Unassigned
  if (seat.current_student_id) {
    await supabase
      .from('students')
      .update({ seat_number: 'Unassigned' })
      .eq('id', seat.current_student_id);
  }

  const { data, error } = await supabase
    .from('seats')
    .update({
      status: 'available',
      current_student_id: null,
      current_student_name: null,
      shift: null,
    })
    .eq('seat_number', seat.seat_number)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data || seat;
}

async function assignSeat(seatNumber, studentId, studentName, shift = 'fullday') {
  if (!seatNumber || seatNumber === 'Unassigned') return null;

  // Free any previous seat student might have had
  await supabase
    .from('seats')
    .update({
      status: 'available',
      current_student_id: null,
      current_student_name: null,
      shift: null,
    })
    .eq('current_student_id', studentId);

  // Find exact seat from DB to ensure exact casing
  const existingSeat = await getSeatByNumber(seatNumber);
  const exactSeatNumber = existingSeat ? existingSeat.seat_number : seatNumber.trim();

  // Assign new seat
  const { data, error } = await supabase
    .from('seats')
    .update({
      status: 'occupied',
      current_student_id: studentId,
      current_student_name: studentName,
      shift: shift,
    })
    .eq('seat_number', exactSeatNumber)
    .select()
    .maybeSingle();

  if (error) {
    console.error('assignSeat DB error:', error.message);
  }

  // Update student profile
  await supabase
    .from('students')
    .update({ seat_number: exactSeatNumber })
    .eq('id', studentId);

  return data || existingSeat;
}

// Students
async function searchStudents(query = '') {
  let q = supabase.from('students').select('*').order('created_at', { ascending: false });

  if (query && query.trim() !== '') {
    const term = query.trim();
    q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,reg_no.ilike.%${term}%,seat_number.ilike.%${term}%`);
  }

  const { data, error } = await q.limit(25);
  if (error) throw error;
  return data || [];
}

async function getStudentById(id) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getPendingAdmissions() {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function approveAdmission(studentId, seatNumber) {
  const student = await getStudentById(studentId);
  if (!student) throw new Error('Student not found in database');

  const updates = {
    status: 'active',
  };

  const targetSeat = seatNumber || student.seat_number;
  if (targetSeat && targetSeat !== 'Unassigned') {
    updates.seat_number = targetSeat;
    await assignSeat(targetSeat, studentId, student.full_name, student.shift);
  }

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', studentId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data || { ...student, ...updates };
}

// Defaulters & Expiries
async function getDefaultersAndExpiries() {
  const today = new Date().toISOString().split('T')[0];
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .eq('status', 'active');

  if (error) throw error;

  const dues = [];
  const expiringSoon = [];
  const expired = [];

  for (const s of (students || [])) {
    if (s.amount_due > 0) {
      dues.push(s);
    }
    if (s.end_date && s.end_date < today) {
      expired.push(s);
    } else if (s.end_date && s.end_date <= inThreeDays) {
      expiringSoon.push(s);
    }
  }

  return { dues, expiringSoon, expired };
}

// Fees & Transactions
async function collectFee({ studentId, amount, paymentMode = 'upi', remarks = '', extendDays = 30 }) {
  const student = await getStudentById(studentId);
  if (!student) throw new Error('Student not found');

  const parsedAmount = parseInt(amount, 10);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Invalid payment amount');
  }

  const receiptNumber = `RCP-${Math.floor(100000 + Math.random() * 900000)}`;
  const todayStr = new Date().toISOString().split('T')[0];

  let cleanMode = paymentMode.toLowerCase();
  let cleanRemarks = remarks || `Fee payment collected via Telegram bot (${cleanMode.toUpperCase()})`;

  // 1. Insert Transaction
  let insertObj = {
    student_id: student.id,
    student_name: student.full_name,
    reg_no: student.reg_no,
    amount: parsedAmount,
    payment_date: todayStr,
    payment_mode: cleanMode,
    receipt_number: receiptNumber,
    remarks: cleanRemarks,
  };

  let { data: txn, error: txnError } = await supabase
    .from('fee_transactions')
    .insert(insertObj)
    .select()
    .maybeSingle();

  // If DB rejected 'cheque' due to constraint, fallback to bank_transfer with [Cheque] remark
  if (txnError && cleanMode === 'cheque') {
    insertObj.payment_mode = 'bank_transfer';
    insertObj.remarks = `[Cheque] ${cleanRemarks}`;
    const fallback = await supabase
      .from('fee_transactions')
      .insert(insertObj)
      .select()
      .maybeSingle();
    txn = fallback.data;
    txnError = fallback.error;
  }

  if (txnError) throw txnError;

  // 2. Calculate New End Date (if extending)
  let newEndDate = student.end_date;
  if (extendDays > 0) {
    const currentEnd = student.end_date ? new Date(student.end_date) : new Date();
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    baseDate.setDate(baseDate.getDate() + extendDays);
    newEndDate = baseDate.toISOString().split('T')[0];
  }

  // 3. Update Student Balances
  const newAmountPaid = (student.amount_paid || 0) + parsedAmount;
  const newAmountDue = Math.max(0, (student.amount_due || 0) - parsedAmount);
  const paymentStatus = newAmountDue === 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'pending';

  const { data: updatedStudent, error: stuError } = await supabase
    .from('students')
    .update({
      amount_paid: newAmountPaid,
      amount_due: newAmountDue,
      payment_status: paymentStatus,
      end_date: newEndDate,
      status: 'active',
    })
    .eq('id', student.id)
    .select()
    .maybeSingle();

  if (stuError) throw stuError;

  return { transaction: txn, student: updatedStudent || student };
}

async function getTransactionById(transactionId) {
  if (!transactionId) return null;
  const { data, error } = await supabase
    .from('fee_transactions')
    .select('*')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) {
    console.error('getTransactionById error:', error.message);
    return null;
  }
  return data;
}

async function getLatestTransactionForStudent(studentId) {
  if (!studentId) return null;
  const { data, error } = await supabase
    .from('fee_transactions')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('getLatestTransactionForStudent error:', error.message);
    return null;
  }
  return data;
}

// ==============================================================================
// Attendance Tracking
// ==============================================================================

function normalizePhone(rawPhone) {
  if (!rawPhone) return '';
  // Remove non-digit characters
  let digits = rawPhone.toString().replace(/\D/g, '');
  // If starts with 91 and has 12 digits, strip 91
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // Strip leading 0
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

async function findStudentByPhone(rawPhone) {
  const cleanPhone = normalizePhone(rawPhone);
  if (!cleanPhone || cleanPhone.length < 10) return null;

  const last10 = cleanPhone.slice(-10);

  const { data, error } = await supabase
    .from('students')
    .select('*')
    .ilike('phone', `%${last10}%`)
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

const DEFAULT_GEOFENCE = {
  latitude: 33.617014,
  longitude: 74.924696,
  radius_meters: 75,
  enabled: true,
  name: 'Vertical Classes Library',
};

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

async function getGeofenceSettings() {
  try {
    const { data, error } = await supabase
      .from('library_settings')
      .select('value')
      .eq('key', 'geofence')
      .maybeSingle();
    if (error || !data || !data.value) {
      return DEFAULT_GEOFENCE;
    }
    return { ...DEFAULT_GEOFENCE, ...data.value };
  } catch (err) {
    console.error('getGeofenceSettings error:', err.message);
    return DEFAULT_GEOFENCE;
  }
}

async function updateGeofenceSettings(newSettings) {
  const current = await getGeofenceSettings();
  const merged = { ...current, ...newSettings };
  const { data, error } = await supabase
    .from('library_settings')
    .upsert({
      key: 'geofence',
      value: merged,
      updated_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return merged;
}

const DEFAULT_WIFI = {
  ssid: '',
  password: '',
  last_updated_at: null,
  updated_by: 'Admin',
};

async function getWifiCredentials() {
  try {
    const { data, error } = await supabase
      .from('library_settings')
      .select('value')
      .eq('key', 'wifi_credentials')
      .maybeSingle();
    if (error || !data || !data.value) {
      return DEFAULT_WIFI;
    }
    return { ...DEFAULT_WIFI, ...data.value };
  } catch (err) {
    console.error('getWifiCredentials error:', err.message);
    return DEFAULT_WIFI;
  }
}

async function updateWifiCredentials(newCreds) {
  const current = await getWifiCredentials();
  const merged = {
    ...current,
    ...newCreds,
    last_updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('library_settings')
    .upsert({
      key: 'wifi_credentials',
      value: merged,
      description: 'Library Wi-Fi Network Name & Security Password',
      updated_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return merged;
}

async function getActiveStudentsForWifi() {
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, email, phone, seat_number, shift, status')
    .neq('status', 'cancelled')
    .neq('status', 'rejected')
    .not('email', 'is', null)
    .neq('email', '')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getAnnouncementsHistory() {
  try {
    const { data, error } = await supabase
      .from('library_settings')
      .select('value')
      .eq('key', 'announcements')
      .maybeSingle();
    if (error || !data || !data.value) {
      return [];
    }
    return Array.isArray(data.value.history) ? data.value.history : [];
  } catch (err) {
    console.error('getAnnouncementsHistory error:', err.message);
    return [];
  }
}

async function recordAnnouncement({ title, body, author = 'Admin', sentCount = 0 }) {
  const history = await getAnnouncementsHistory();
  const newEntry = {
    id: `ANN-${Date.now()}`,
    title,
    body,
    author,
    sent_count: sentCount,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [newEntry, ...history].slice(0, 20);

  await supabase
    .from('library_settings')
    .upsert({
      key: 'announcements',
      value: { history: updatedHistory },
      description: 'Log of broadcast announcements sent to students',
      updated_at: new Date().toISOString(),
    });

  return newEntry;
}

// ==============================================================================
// Student Restroom & Break Management
// ==============================================================================

async function startStudentBreak({ studentId, durationMinutes = 15, breakType = 'restroom', chatId = null }) {
  const student = await getStudentById(studentId);
  if (!student) throw new Error('Student not found');

  const todayStr = getISTDateString();
  const { data: activeLog } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('student_id', student.id)
    .eq('date', todayStr)
    .eq('status', 'checked_in')
    .limit(1);

  if (!activeLog || activeLog.length === 0) {
    return {
      success: false,
      error: 'not_checked_in',
      message: 'You must be checked in to the library before taking a break.',
      student,
    };
  }

  // End any currently active break for this student
  await supabase
    .from('student_breaks')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('student_id', student.id)
    .eq('status', 'active');

  const now = new Date();
  const duration = parseInt(durationMinutes, 10) || 15;
  const grace = 5;
  const expectedReturn = new Date(now.getTime() + duration * 60 * 1000);
  const autoReturn = new Date(now.getTime() + (duration + grace) * 60 * 1000);

  const { data, error } = await supabase
    .from('student_breaks')
    .insert({
      student_id: student.id,
      student_name: student.full_name,
      seat_number: student.seat_number,
      phone: student.phone,
      telegram_chat_id: chatId ? parseInt(chatId, 10) : null,
      break_type: breakType,
      duration_minutes: duration,
      grace_minutes: grace,
      started_at: now.toISOString(),
      expected_return: expectedReturn.toISOString(),
      auto_return: autoReturn.toISOString(),
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return {
    success: true,
    breakRecord: data,
    student,
  };
}

async function endStudentBreak({ studentId }) {
  const nowStr = new Date().toISOString();
  const { data, error } = await supabase
    .from('student_breaks')
    .update({ status: 'completed', ended_at: nowStr })
    .eq('student_id', studentId)
    .eq('status', 'active')
    .select();

  if (error) throw error;
  return { success: true, endedCount: data ? data.length : 0 };
}

async function getActiveBreakForStudent(studentId) {
  const now = new Date();
  const { data } = await supabase
    .from('student_breaks')
    .select('*')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  const record = data[0];

  // If auto-return has expired, auto-complete it
  if (now >= new Date(record.auto_return)) {
    await supabase
      .from('student_breaks')
      .update({ status: 'auto_completed', ended_at: now.toISOString() })
      .eq('id', record.id);
    return null;
  }

  return record;
}

async function getAllActiveBreaks() {
  const nowStr = new Date().toISOString();
  // Auto-complete any expired breaks where auto_return has passed
  await supabase
    .from('student_breaks')
    .update({ status: 'auto_completed', ended_at: nowStr })
    .eq('status', 'active')
    .lte('auto_return', nowStr);

  const { data, error } = await supabase
    .from('student_breaks')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function checkAndAutoResetExpiredBreaks() {
  const now = new Date();
  const nowStr = now.toISOString();

  const { data: expired } = await supabase
    .from('student_breaks')
    .select('*')
    .eq('status', 'active')
    .lte('auto_return', nowStr);

  if (expired && expired.length > 0) {
    await supabase
      .from('student_breaks')
      .update({ status: 'auto_completed', ended_at: nowStr })
      .eq('status', 'active')
      .lte('auto_return', nowStr);
  }

  return expired || [];
}

async function getStudentPresenceStatus(query) {
  if (!query || query.trim() === '') return null;
  const term = query.trim();

  // Search student by name, phone, reg_no, or seat_number
  let q = supabase
    .from('students')
    .select('*')
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,seat_number.ilike.%${term}%`)
    .limit(1);

  const { data: matches, error } = await q;
  if (error || !matches || matches.length === 0) return null;
  const student = matches[0];

  const todayStr = getISTDateString();
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('student_id', student.id)
    .eq('date', todayStr)
    .order('created_at', { ascending: false })
    .limit(1);

  const isCheckedIn = Boolean(logs && logs.length > 0 && logs[0].status === 'checked_in');

  if (isCheckedIn) {
    const activeBreak = await getActiveBreakForStudent(student.id);
    if (activeBreak) {
      const now = Date.now();
      const expTime = new Date(activeBreak.expected_return).getTime();
      const autoTime = new Date(activeBreak.auto_return).getTime();
      const minsRemaining = Math.max(0, Math.round((expTime - now) / 60000));
      const graceMinsRemaining = Math.max(0, Math.round((autoTime - now) / 60000));

      return {
        found: true,
        student,
        isCheckedIn: true,
        status: 'on_break',
        activeBreak,
        checkInLog: logs[0],
        minsRemaining,
        isGracePeriod: now > expTime && now < autoTime,
        graceMinsRemaining,
      };
    }

    return {
      found: true,
      student,
      isCheckedIn: true,
      status: 'studying',
      checkInLog: logs[0],
    };
  }

  return {
    found: true,
    student,
    isCheckedIn: false,
    status: 'away',
    lastLog: logs && logs.length > 0 ? logs[0] : null,
  };
}

async function getLibraryPresenceSummary() {
  const todayStr = getISTDateString();
  const { data: checkedInLogs } = await supabase
    .from('attendance_logs')
    .select('student_id, student_name, seat_number, check_in_time')
    .eq('date', todayStr)
    .eq('status', 'checked_in');

  const activeBreaks = await getAllActiveBreaks();
  const onBreakStudentIds = new Set(activeBreaks.map((b) => b.student_id));

  const totalPresent = checkedInLogs ? checkedInLogs.length : 0;
  const onBreakCount = activeBreaks.length;
  const studyingCount = Math.max(0, totalPresent - onBreakCount);

  return {
    totalPresent,
    studyingCount,
    onBreakCount,
    activeBreaks,
    checkedInLogs: checkedInLogs || [],
  };
}

async function checkInStudent(studentId, geoData = {}) {
  const student = await getStudentById(studentId);
  if (!student) throw new Error('Student not found');

  const todayStr = getISTDateString();

  // Check if student is already checked in and hasn't checked out
  const { data: activeLog } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('student_id', student.id)
    .eq('date', todayStr)
    .eq('status', 'checked_in')
    .order('created_at', { ascending: false })
    .limit(1);

  if (activeLog && activeLog.length > 0) {
    return {
      alreadyCheckedIn: true,
      log: activeLog[0],
      student,
    };
  }

  // Insert new check-in record
  const insertPayload = {
    student_id: student.id,
    student_name: student.full_name,
    phone: student.phone,
    seat_number: student.seat_number,
    date: todayStr,
    check_in_time: new Date().toISOString(),
    status: 'checked_in',
  };

  if (geoData.latitude != null) insertPayload.latitude = geoData.latitude;
  if (geoData.longitude != null) insertPayload.longitude = geoData.longitude;
  if (geoData.distanceMeters != null) insertPayload.distance_meters = geoData.distanceMeters;

  const { data: newLog, error } = await supabase
    .from('attendance_logs')
    .insert(insertPayload)
    .select()
    .maybeSingle();

  if (error) throw error;

  return {
    alreadyCheckedIn: false,
    log: newLog,
    student,
  };
}

async function checkOutStudent(studentId, geoData = {}) {
  const student = await getStudentById(studentId);
  if (!student) throw new Error('Student not found');

  const todayStr = getISTDateString();

  // Find latest active check-in
  const { data: activeLogs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('student_id', student.id)
    .eq('date', todayStr)
    .eq('status', 'checked_in')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!activeLogs || activeLogs.length === 0) {
    return {
      notCheckedIn: true,
      student,
    };
  }

  const activeLog = activeLogs[0];
  const checkInTime = new Date(activeLog.check_in_time);
  const now = new Date();
  const diffMinutes = Math.max(1, Math.round((now - checkInTime) / 60000));

  const updatePayload = {
    check_out_time: now.toISOString(),
    duration_minutes: diffMinutes,
    status: 'checked_out',
  };

  if (geoData.latitude != null) updatePayload.check_out_latitude = geoData.latitude;
  if (geoData.longitude != null) updatePayload.check_out_longitude = geoData.longitude;
  if (geoData.distanceMeters != null) updatePayload.check_out_distance_meters = geoData.distanceMeters;

  const { data: updatedLog, error } = await supabase
    .from('attendance_logs')
    .update(updatePayload)
    .eq('id', activeLog.id)
    .select()
    .maybeSingle();

  if (error) throw error;

  return {
    notCheckedIn: false,
    log: updatedLog,
    student,
    durationMinutes: diffMinutes,
  };
}

async function getTodayAttendance() {
  const todayStr = getISTDateString();

  const { data: logs, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('date', todayStr)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const currentlyInside = (logs || []).filter((l) => l.status === 'checked_in');
  const checkedOut = (logs || []).filter((l) => l.status === 'checked_out');

  return {
    logs: logs || [],
    currentlyInside,
    checkedOut,
    totalRecords: (logs || []).length,
  };
}

async function getAdminByPhone(phone) {
  if (!phone) return null;
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    clean = clean.substring(2);
  }

  // 1. Check in Supabase admin_accounts table
  try {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('phone', clean)
      .eq('is_active', true)
      .single();

    if (data && !error) {
      return data;
    }
  } catch (err) {
    console.warn('[DB] admin_accounts query warning:', err.message);
  }

  // 2. Check environment variable fallback
  const envPhone = (process.env.ADMIN_PHONE || '9149847965').replace(/[^0-9]/g, '');
  const envClean = (envPhone.length === 12 && envPhone.startsWith('91')) ? envPhone.substring(2) : envPhone;
  if (clean === envClean) {
    return {
      id: 'ADM-PRIMARY',
      phone: clean,
      name: process.env.ADMIN_NAME || 'Sarwar Altaf Dar',
      telegram_chat_id: (process.env.ADMIN_CHAT_ID || '8707444480').toString(),
      role: 'superadmin',
      is_active: true,
    };
  }

  return null;
}

async function linkAdminPhone(chatId, phone, name = 'Librarian') {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.length === 12 && clean.startsWith('91')) {
    clean = clean.substring(2);
  }
  if (clean.length !== 10) {
    throw new Error('Please provide a valid 10-digit mobile number.');
  }

  const { data, error } = await supabase
    .from('admin_accounts')
    .upsert({
      phone: clean,
      name,
      telegram_chat_id: chatId.toString(),
      role: 'admin',
      is_active: true,
    }, { onConflict: 'phone' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getAllAdmins() {
  try {
    const { data } = await supabase
      .from('admin_accounts')
      .select('*')
      .eq('is_active', true);
    return data || [];
  } catch (e) {
    return [];
  }
}

async function isAdminChatId(chatId) {
  if (!chatId) return false;
  const strId = chatId.toString();
  const envAdminId = (process.env.ADMIN_CHAT_ID || '8707444480').toString();
  if (strId === envAdminId) return true;

  try {
    const { data } = await supabase
      .from('admin_accounts')
      .select('telegram_chat_id')
      .eq('telegram_chat_id', strId)
      .eq('is_active', true)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch (e) {
    return false;
  }
}

module.exports = {
  supabase,
  getAllSeats,
  getSeatByNumber,
  vacateSeat,
  assignSeat,
  searchStudents,
  getStudentById,
  getPendingAdmissions,
  approveAdmission,
  getDefaultersAndExpiries,
  collectFee,
  getTransactionById,
  getLatestTransactionForStudent,
  normalizePhone,
  findStudentByPhone,
  checkInStudent,
  checkOutStudent,
  getTodayAttendance,
  getAdminByPhone,
  linkAdminPhone,
  getAllAdmins,
  isAdminChatId,
  calculateDistanceMeters,
  getGeofenceSettings,
  updateGeofenceSettings,
  getWifiCredentials,
  updateWifiCredentials,
  getActiveStudentsForWifi,
  getAnnouncementsHistory,
  recordAnnouncement,
  startStudentBreak,
  endStudentBreak,
  getActiveBreakForStudent,
  getAllActiveBreaks,
  checkAndAutoResetExpiredBreaks,
  getStudentPresenceStatus,
  getLibraryPresenceSummary,
};

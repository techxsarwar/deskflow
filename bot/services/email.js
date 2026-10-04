const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const { Resend } = require('resend');
const { getISTTime, getISTDate } = require('./time');

// Initialize Resend if key is available
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

function getReceiptHtml({ student, transaction, libraryName = 'Vertical Classes' }) {
  const dateStr = transaction?.payment_date 
    ? getISTDate(transaction.payment_date)
    : getISTDate();
  
  const timeStr = getISTTime();
  const receiptNo = transaction?.receipt_number || `RCP-${Math.floor(100000 + Math.random() * 900000)}`;
  const rawAmountNum = transaction?.amount != null ? Number(transaction.amount) : 1000;
  const amount = rawAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const rawDueNum = student?.amount_due || 0;
  const dueFormatted = Number(rawDueNum).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const modeMap = {
    upi: 'UPI Transfer',
    cash: 'Cash Payment',
    bank_transfer: 'Bank Transfer (NEFT/IMPS)',
    cheque: 'Cheque Payment',
    card: 'Card / POS Payment',
  };
  let modeKey = (transaction?.payment_mode || 'upi').toLowerCase();
  if (modeKey === 'bank_transfer' && transaction?.remarks && transaction.remarks.includes('[Cheque]')) {
    modeKey = 'cheque';
  }
  const mode = modeMap[modeKey] || modeKey.toUpperCase();

  const seatNo = student?.seat_number && student.seat_number !== 'Unassigned' ? student.seat_number : 'Desk Assigned';
  const shift = (student?.shift || 'fullday').toUpperCase() === 'FULLDAY' ? 'Full Day Access' : `${(student?.shift || 'General').toUpperCase()} Shift`;
  const plan = (student?.membership_plan || 'monthly').toUpperCase() === 'MONTHLY' ? 'Monthly Pass' : (student?.membership_plan || 'Standard Plan').toUpperCase();
  const validityEnd = student?.end_date 
    ? new Date(student.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '30 Days from Issue';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt from ${libraryName} - ${receiptNo}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 4px 20px -2px rgba(15,23,42,0.06);overflow:hidden;">
    
    <!-- Top Brand Header -->
    <tr>
      <td style="padding:32px 36px 24px 36px;border-bottom:1px solid #f1f5f9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">
                ${libraryName.toUpperCase()} &bull; STUDY LOUNGE
              </div>
              <div style="font-size:18px;font-weight:800;letter-spacing:-0.4px;color:#0f172a;">
                Official Fee Receipt
              </div>
            </td>
            <td align="right" valign="top">
              ${rawDueNum > 0
                ? `<span style="display:inline-block;padding:5px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;font-size:12px;font-weight:700;color:#d97706;letter-spacing:0.2px;">Partially Paid</span>`
                : `<span style="display:inline-block;padding:5px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;font-size:12px;font-weight:700;color:#059669;letter-spacing:0.2px;">&#10003; Paid in Full</span>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Hero Amount Section -->
    <tr>
      <td style="padding:32px 36px;background:#fafbfc;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:13px;font-weight:600;color:#64748b;margin-bottom:8px;">Amount Collected</div>
        <div style="font-size:42px;font-weight:900;letter-spacing:-1.5px;color:#0f172a;line-height:1;">
          <span style="font-size:26px;font-weight:700;color:#64748b;vertical-align:top;margin-right:2px;">&#8377;</span>${amount}
        </div>
        <div style="font-size:13px;color:#64748b;margin-top:10px;">
          Paid via <b>${mode}</b> on ${dateStr} at ${timeStr}
        </div>
      </td>
    </tr>

    <!-- Digital Desk Reservation Pass Box -->
    <tr>
      <td style="padding:28px 36px 20px 36px;">
        <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);border-radius:14px;padding:22px 24px;color:#ffffff;box-shadow:0 8px 16px -4px rgba(15,23,42,0.15);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td>
                <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">
                  RESERVED SEAT
                </div>
                <div style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;margin-top:2px;">
                  ${seatNo}
                </div>
                <div style="font-size:12px;color:#cbd5e1;margin-top:2px;">
                  ${shift} &bull; Quiet Hall
                </div>
              </td>
              <td align="right" valign="middle">
                <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">
                  MEMBERSHIP VALID TILL
                </div>
                <div style="font-size:16px;font-weight:800;color:#34d399;margin-top:4px;">
                  ${validityEnd}
                </div>
                <div style="display:inline-block;margin-top:6px;background:rgba(255,255,255,0.12);padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;color:#e2e8f0;">
                  ${plan}
                </div>
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- Itemized Breakdown -->
    <tr>
      <td style="padding:10px 36px 24px 36px;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#64748b;margin-bottom:14px;">
          Receipt Breakdown
        </div>
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:12px 0;font-size:14px;color:#0f172a;font-weight:600;">
              ${plan} Desk Reservation (${seatNo})
              <div style="font-size:12px;color:#64748b;font-weight:400;margin-top:2px;">
                Dedicated study desk allocation &bull; Valid until ${validityEnd}
              </div>
            </td>
            <td align="right" style="padding:12px 0;font-size:14px;font-weight:700;color:#0f172a;" valign="top">
              &#8377;${amount}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 0;font-size:13px;color:#64748b;">
              High-Speed Fiber WiFi & Silent Environment Access
            </td>
            <td align="right" style="padding:10px 0;font-size:13px;font-weight:600;color:#059669;">
              Included
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 0;font-size:13px;color:#64748b;">
              Dedicated Locker & Power Hub Access
            </td>
            <td align="right" style="padding:10px 0;font-size:13px;font-weight:600;color:#059669;">
              Included
            </td>
          </tr>
          
          <!-- Total Row -->
          <tr>
            <td style="padding:16px 0 6px 0;font-size:15px;font-weight:700;color:#0f172a;">
              Total Paid
            </td>
            <td align="right" style="padding:16px 0 6px 0;font-size:17px;font-weight:900;color:#0f172a;">
              &#8377;${amount}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 0 12px 0;font-size:13px;color:#64748b;">
              Outstanding Balance
            </td>
            <td align="right" style="padding:4px 0 12px 0;font-size:13px;font-weight:700;color:${rawDueNum > 0 ? '#dc2626' : '#059669'};">
              &#8377;${dueFormatted} ${rawDueNum === 0 ? '(Nil)' : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Billing & Transaction Metadata Grid -->
    <tr>
      <td style="padding:0 36px 32px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border-radius:12px;padding:20px;border:1px solid #e2e8f0;">
          <tr>
            <td width="50%" valign="top" style="padding-right:12px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
                Billed To
              </div>
              <div style="font-size:14px;font-weight:700;color:#0f172a;">
                ${student?.full_name || 'Registered Member'}
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                ID: <b>${student?.reg_no || 'N/A'}</b>
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:2px;">
                Phone: ${student?.phone || 'N/A'}
              </div>
              ${student?.email ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${student.email}</div>` : ''}
            </td>
            
            <td width="50%" valign="top" style="border-left:1px solid #e2e8f0;padding-left:20px;">
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
                Transaction Info
              </div>
              <div style="font-size:12px;color:#64748b;">
                Receipt No: <b style="color:#0f172a;">${receiptNo}</b>
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
                Date: <b style="color:#0f172a;">${dateStr}</b>
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
                Payment Mode: <b style="color:#0f172a;">${mode}</b>
              </div>
              <div style="font-size:12px;color:#64748b;margin-top:4px;">
                Status: <span style="color:#059669;font-weight:700;">Captured &bull; Settled</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer & Authenticity Guarantee -->
    <tr>
      <td style="padding:24px 36px 32px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <div style="font-size:12px;color:#64748b;line-height:1.6;">
          This is an official computer-generated receipt issued by <b>${libraryName} Operating System</b>.<br>
          For seating queries or seat switches, please reach out to the front desk.
        </div>
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;">
          &copy; ${new Date().getFullYear()} ${libraryName} &bull; All Rights Reserved &bull; <a href="mailto:receipts@globalpulse24.in" style="color:#64748b;text-decoration:underline;">receipts@globalpulse24.in</a>
        </div>
      </td>
    </tr>

  </table>

</body>
</html>
  `;
}

async function sendReceiptEmail({ student, transaction }) {
  if (!student?.email) {
    throw new Error('Student does not have an email address configured.');
  }

  const receiptNo = transaction?.receipt_number || `RCP-${Math.floor(100000 + Math.random() * 900000)}`;
  const html = getReceiptHtml({ student, transaction });
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Vertical Classes Library <receipts@globalpulse24.in>';

  // If no Resend API key is configured yet, provide a mock success so testing works smoothly
  if (!process.env.RESEND_API_KEY || !resend) {
    console.log(`[MOCK EMAIL] Resend API Key not set yet. Would have sent email to ${student.email} for receipt ${receiptNo}`);
    return {
      success: true,
      mock: true,
      message: `Simulated receipt email sent to ${student.email}. (To send real emails, set RESEND_API_KEY in bot/.env)`,
      receiptNo,
    };
  }

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: [student.email],
      subject: `Official Fee Receipt: ${receiptNo} - Vertical Classes Study Lounge`,
      html: html,
    });

    if (res.error) {
      // If domain is not verified yet on Resend, send to admin account so they still get the receipt!
      if (
        res.error.statusCode === 403 ||
        res.error.status === 403 ||
        res.error.message?.includes('testing emails') ||
        res.error.message?.includes('only send testing emails')
      ) {
        console.warn('Resend testing mode: Forwarding receipt to admin email (darsarwar1908@gmail.com)');
        const fallbackRes = await resend.emails.send({
          from: fromEmail,
          to: ['darsarwar1908@gmail.com'],
          subject: `[Student Receipt - Forward to ${student.email}] ${receiptNo} - Vertical Classes`,
          html: `<div style="background:#fef3c7;padding:12px;border-radius:8px;font-size:13px;color:#92400e;margin-bottom:16px;">
            ⚠️ <b>Resend Sandbox Notice:</b> Delivered to your admin email because your custom domain is not yet verified at <a href="https://resend.com/domains">resend.com/domains</a>. You can forward this receipt to <b>${student.email}</b>.
          </div>` + html,
        });

        return {
          success: true,
          sandbox: true,
          data: fallbackRes.data,
          receiptNo,
          recipient: 'darsarwar1908@gmail.com',
          intendedRecipient: student.email,
          message: `Receipt dispatched to your admin email (darsarwar1908@gmail.com) for forwarding to ${student.email}.`,
        };
      }

      throw new Error(res.error.message || 'Resend dispatch failed');
    }

    return {
      success: true,
      data: res.data,
      receiptNo,
      recipient: student.email,
    };
  } catch (error) {
    console.error('Failed to send email via Resend:', error);
    throw error;
  }
}

function getReminderHtml({ student, libraryName = 'Vertical Classes' }) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const rawDueNum = student?.amount_due || 1000;
  const dueFormatted = Number(rawDueNum).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const seatNo = student?.seat_number && student.seat_number !== 'Unassigned' ? student.seat_number : 'Desk Reserved';
  const validityEnd = student?.end_date 
    ? new Date(student.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Pending Renewal';
  
  const isExpired = student?.end_date && new Date(student.end_date) < new Date();
  const badgeText = isExpired ? '🔴 Membership Expired' : rawDueNum > 0 ? '⚠️ Fee Payment Due' : '⏳ Renewal Required';
  const badgeColor = isExpired ? '#fef2f2; border: 1px solid #fecaca; color: #dc2626;' : '#fffbeb; border: 1px solid #fef3c7; color: #d97706;';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Membership Renewal Notice - ${libraryName}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 4px 20px -2px rgba(15,23,42,0.06);overflow:hidden;">
    
    <!-- Top Header -->
    <tr>
      <td style="padding:32px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">
                ${libraryName.toUpperCase()} &bull; STUDY LOUNGE
              </div>
              <div style="font-size:18px;font-weight:800;letter-spacing:-0.4px;color:#0f172a;">
                Membership Renewal Notice
              </div>
            </td>
            <td align="right" valign="top">
              <span style="display:inline-block;padding:5px 12px;background:${badgeColor}border-radius:999px;font-size:12px;font-weight:700;">
                ${badgeText}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Notice -->
    <tr>
      <td style="padding:28px 36px 16px 36px;">
        <p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 16px 0;">
          Dear <b>${student?.full_name || 'Student'}</b>,
        </p>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 20px 0;">
          This is a friendly reminder from <b>${libraryName}</b> regarding your dedicated desk reservation. Your study pass is due for monthly renewal to maintain uninterrupted seat access.
        </p>
        
        <!-- Reservation Highlight Card -->
        <div style="background:#f8fafc;border-radius:14px;padding:22px 24px;border:1px solid #e2e8f0;margin-bottom:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
                  Assigned Seat
                </div>
                <div style="font-size:24px;font-weight:900;color:#0f172a;margin-top:2px;">
                  ${seatNo}
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">
                  ${(student?.shift || 'Full Day').toUpperCase()} Shift
                </div>
              </td>
              <td width="50%" valign="top" style="border-left:1px solid #e2e8f0;padding-left:20px;">
                <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
                  Amount Due
                </div>
                <div style="font-size:24px;font-weight:900;color:#dc2626;margin-top:2px;">
                  &#8377;${dueFormatted}
                </div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;">
                  Valid Till: <b>${validityEnd}</b>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <div style="background:#eff6ff;border-radius:10px;padding:14px 18px;border:1px solid #bfdbfe;margin-bottom:24px;">
          <div style="font-size:13px;color:#1e40af;line-height:1.5;">
            💡 <b>Important:</b> Desks with overdue renewals may be auto-released to students on the waiting list after the 2-day grace period.
          </div>
        </div>

        <!-- How to Pay -->
        <div style="font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#64748b;margin-bottom:10px;">
          Payment Methods
        </div>
        <div style="font-size:13px;color:#475569;line-height:1.6;margin-bottom:24px;">
          &bull; <b>UPI Payment:</b> You can pay directly via UPI at the front desk QR code.<br>
          &bull; <b>Cash / Card:</b> Visit the administration counter during library operating hours.
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:24px 36px 32px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <div style="font-size:12px;color:#64748b;line-height:1.6;">
          Issued on ${dateStr} by <b>${libraryName} Administration Desk</b>.<br>
          If you have already paid today, please ignore this notice.
        </div>
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;">
          &copy; ${new Date().getFullYear()} ${libraryName} &bull; <a href="mailto:receipts@globalpulse24.in" style="color:#64748b;text-decoration:underline;">receipts@globalpulse24.in</a>
        </div>
      </td>
    </tr>

  </table>

</body>
</html>
  `;
}

async function sendReminderEmail({ student }) {
  if (!student?.email) {
    throw new Error('Student does not have an email address configured.');
  }

  const html = getReminderHtml({ student });
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Vertical Classes Library <receipts@globalpulse24.in>';

  if (!process.env.RESEND_API_KEY || !resend) {
    return {
      success: true,
      mock: true,
      message: `Simulated reminder email sent to ${student.email}.`,
    };
  }

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: [student.email],
      subject: `Action Required: Desk ${student.seat_number || ''} Renewal Reminder - Vertical Classes`,
      html: html,
    });

    if (res.error) {
      throw new Error(res.error.message || 'Resend reminder error');
    }

    return {
      success: true,
      data: res.data,
      recipient: student.email,
      studentName: student.full_name,
    };
  } catch (error) {
    console.error('Failed to send reminder email:', error);
    throw error;
  }
}

function getWifiCredentialsHtml({ student, wifiConfig, libraryName = 'Vertical Classes' }) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const seatNo = student?.seat_number && student.seat_number !== 'Unassigned' ? student.seat_number : 'Assigned Study Desk';
  const ssid = wifiConfig?.ssid || 'Vertical Classes Library';
  const password = wifiConfig?.password || '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Library Wi-Fi Access & Confidential Credentials - ${libraryName}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 4px 20px -2px rgba(15,23,42,0.06);overflow:hidden;">
    
    <!-- Top Header -->
    <tr>
      <td style="padding:32px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#0284c7;text-transform:uppercase;margin-bottom:4px;">
                ${libraryName.toUpperCase()} &bull; STUDY LOUNGE
              </div>
              <div style="font-size:20px;font-weight:800;letter-spacing:-0.4px;color:#0f172a;">
                Official Wi-Fi Network Pass
              </div>
            </td>
            <td align="right" valign="top">
              <span style="display:inline-block;padding:6px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:999px;font-size:12px;font-weight:700;color:#16a34a;letter-spacing:0.2px;">
                &#9679; Active Member Pass
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Member Greeting -->
    <tr>
      <td style="padding:28px 36px 16px 36px;">
        <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;">
          Hello ${student.full_name || 'Student'},
        </div>
        <div style="font-size:14px;color:#475569;line-height:1.6;">
          You are receiving this official communication as an active enrolled student of <b>${libraryName} Study Lounge</b> (Desk: <b>${seatNo}</b>). Below are your confidential credentials to connect to our high-speed member Wi-Fi network.
        </div>
      </td>
    </tr>

    <!-- High-Tech WiFi Credentials Badge Box -->
    <tr>
      <td style="padding:0 36px 24px 36px;">
        <div style="background:linear-gradient(135deg, #090d16 0%, #1e293b 100%);border-radius:16px;padding:24px 28px;color:#ffffff;box-shadow:0 10px 25px -5px rgba(15,23,42,0.25);border:1px solid #334155;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td colspan="2" style="padding-bottom:16px;border-bottom:1px solid #334155;">
                <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:#38bdf8;text-transform:uppercase;">
                  SECURE WIRELESS ACCESS DETAILS
                </div>
              </td>
            </tr>
            
            <!-- SSID -->
            <tr>
              <td style="padding-top:16px;font-size:12px;color:#94a3b8;font-weight:600;width:40%;">
                Network Name (SSID)
              </td>
              <td align="right" style="padding-top:16px;font-size:16px;font-weight:800;color:#f8fafc;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                ${ssid}
              </td>
            </tr>

            <!-- Password -->
            <tr>
              <td style="padding-top:14px;font-size:12px;color:#94a3b8;font-weight:600;">
                Wi-Fi Password
              </td>
              <td align="right" style="padding-top:14px;">
                <span style="display:inline-block;padding:5px 12px;background:#0f172a;border:1px dashed #64748b;border-radius:8px;font-size:16px;font-weight:800;letter-spacing:1px;color:#38bdf8;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                  ${password}
                </span>
              </td>
            </tr>

            <!-- Specs -->
            <tr>
              <td style="padding-top:14px;font-size:12px;color:#94a3b8;font-weight:600;">
                Bands & Security
              </td>
              <td align="right" style="padding-top:14px;font-size:12px;font-weight:600;color:#cbd5e1;">
                Dual-Band 5 GHz / 2.4 GHz &bull; WPA2/WPA3
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>

    <!-- Wi-Fi Rules & Acceptable Use Policy -->
    <tr>
      <td style="padding:0 36px 28px 36px;">
        <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:14px;padding:20px 22px;margin-bottom:20px;">
          <div style="font-size:13px;font-weight:800;color:#92400e;letter-spacing:0.2px;margin-bottom:12px;display:flex;align-items:center;">
            ⚠️ MANDATORY WI-FI USAGE RULES &amp; SECURITY GUIDELINES
          </div>
          
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12.5px;color:#78350f;line-height:1.6;">
            <tr>
              <td valign="top" style="padding-bottom:10px;width:24px;font-size:14px;">🚫</td>
              <td style="padding-bottom:10px;">
                <b>DO NOT SHARE WITH OUTSIDERS:</b> These credentials are for registered library students only. Sharing network access with friends, visitors, or non-members is strictly forbidden.
              </td>
            </tr>
            <tr>
              <td valign="top" style="padding-bottom:10px;width:24px;font-size:14px;">💻</td>
              <td style="padding-bottom:10px;">
                <b>1 Primary Study Device:</b> Please connect only your main personal study device (laptop or tablet). Secondary device connections and mobile hotspot tethering are prohibited.
              </td>
            </tr>
            <tr>
              <td valign="top" style="padding-bottom:10px;width:24px;font-size:14px;">🎧</td>
              <td style="padding-bottom:10px;">
                <b>Headphones Mandatory:</b> Video lectures, audio notes, and online tutorials must be played with headphones at all times inside reading rooms.
              </td>
            </tr>
            <tr>
              <td valign="top" style="padding-bottom:10px;width:24px;font-size:14px;">🛑</td>
              <td style="padding-bottom:10px;">
                <b>Strictly Academic Use:</b> High-bandwidth abuse such as torrenting, online gaming, crypto mining, or downloading pirated material will trigger automatic MAC address blocking.
              </td>
            </tr>
            <tr>
              <td valign="top" style="padding-bottom:0;width:24px;font-size:14px;">⚖️</td>
              <td style="padding-bottom:0;">
                <b>Auditing &amp; Membership Revocation:</b> Traffic is monitored at the router level. Any member found violating these guidelines or redistributing credentials will have Wi-Fi access revoked and library membership suspended without refund.
              </td>
            </tr>
          </table>
        </div>

        <div style="font-size:12px;color:#64748b;line-height:1.6;text-align:center;">
          Need assistance connecting? Please visit the reception counter or email us at <a href="mailto:receipts@globalpulse24.in" style="color:#0284c7;text-decoration:none;font-weight:600;">receipts@globalpulse24.in</a>.
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:20px 36px 28px 36px;background:#fafbfc;border-top:1px solid #f1f5f9;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.5px;">
          VERTICAL CLASSES STUDY LOUNGE &bull; DESKFLOW MANAGEMENT SYSTEM
        </div>
        <div style="margin-top:6px;font-size:11px;color:#94a3b8;">
          Sent to <b>${student.email}</b> on ${dateStr} &bull; Confidential
        </div>
      </td>
    </tr>

  </table>

</body>
</html>
  `;
}

async function sendWifiCredentialsEmail({ student, wifiConfig, libraryName = 'Vertical Classes' }) {
  if (!student?.email) {
    throw new Error('Student does not have an email address configured.');
  }
  if (!wifiConfig?.ssid || !wifiConfig?.password) {
    throw new Error('WiFi SSID or Password is not set.');
  }

  const html = getWifiCredentialsHtml({ student, wifiConfig, libraryName });
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Vertical Classes Library <receipts@globalpulse24.in>';

  if (!process.env.RESEND_API_KEY || !resend) {
    return {
      success: true,
      mock: true,
      recipient: student.email,
      studentName: student.full_name,
      message: `Simulated Wi-Fi credentials email sent to ${student.email}.`,
    };
  }

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: [student.email],
      subject: `📶 Official Library Wi-Fi Access & Confidential Credentials — ${libraryName}`,
      html: html,
    });

    if (res.error) {
      if (
        res.error.statusCode === 403 ||
        res.error.status === 403 ||
        res.error.message?.includes('testing emails') ||
        res.error.message?.includes('only send testing emails')
      ) {
        console.warn(`Resend testing mode: Forwarding WiFi email to admin email (darsarwar1908@gmail.com) for ${student.email}`);
        const fallbackRes = await resend.emails.send({
          from: fromEmail,
          to: ['darsarwar1908@gmail.com'],
          subject: `[Student Wi-Fi Pass - Forward to ${student.email}] ${student.full_name} — ${libraryName}`,
          html: `<div style="background:#fef3c7;padding:12px;border-radius:8px;font-size:13px;color:#92400e;margin-bottom:16px;">
            ⚠️ <b>Resend Sandbox Notice:</b> Delivered to admin email because custom domain is in testing mode. Please forward to <b>${student.email}</b>.
          </div>` + html,
        });

        return {
          success: true,
          sandbox: true,
          data: fallbackRes.data,
          recipient: 'darsarwar1908@gmail.com',
          intendedRecipient: student.email,
          studentName: student.full_name,
        };
      }

      throw new Error(res.error.message || 'Resend Wi-Fi dispatch failed');
    }

    return {
      success: true,
      data: res.data,
      recipient: student.email,
      studentName: student.full_name,
    };
  } catch (error) {
    console.error(`Failed to send Wi-Fi credentials email to ${student.email}:`, error);
    throw error;
  }
}

async function broadcastWifiCredentials({ students, wifiConfig, libraryName = 'Vertical Classes' }) {
  const summary = {
    total: students.length,
    sent: 0,
    failed: 0,
    recipients: [],
    errors: [],
  };

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    try {
      const res = await sendWifiCredentialsEmail({ student, wifiConfig, libraryName });
      summary.sent++;
      summary.recipients.push({
        id: student.id,
        name: student.full_name,
        email: student.email,
        seat: student.seat_number,
        sandbox: res.sandbox || false,
      });
    } catch (err) {
      summary.failed++;
      summary.errors.push({
        id: student.id,
        name: student.full_name,
        email: student.email,
        error: err.message,
      });
    }

    if (i < students.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return summary;
}

function getAnnouncementHtml({ student, title, body, libraryName = 'Vertical Classes' }) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const seatNo = student?.seat_number && student.seat_number !== 'Unassigned' ? student.seat_number : 'Assigned Study Desk';
  
  // Format body paragraphs
  const formattedBody = (body || '')
    .split('\n\n')
    .map(para => `<p style="margin: 0 0 16px 0; line-height: 1.7; color: #334155;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${libraryName}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #e2e8f0;box-shadow:0 4px 20px -2px rgba(15,23,42,0.06);overflow:hidden;">
    
    <!-- Top Header -->
    <tr>
      <td style="padding:32px 36px 20px 36px;border-bottom:1px solid #f1f5f9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#0284c7;text-transform:uppercase;margin-bottom:4px;">
                ${libraryName.toUpperCase()} &bull; STUDY LOUNGE
              </div>
              <div style="font-size:20px;font-weight:800;letter-spacing:-0.4px;color:#0f172a;">
                Official Announcement
              </div>
            </td>
            <td align="right" valign="top">
              <span style="display:inline-block;padding:6px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;font-size:12px;font-weight:700;color:#1d4ed8;letter-spacing:0.2px;">
                📢 Member Notice &bull; ${dateStr}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Member Greeting -->
    <tr>
      <td style="padding:28px 36px 16px 36px;">
        <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;">
          Hello ${student.full_name || 'Student'},
        </div>
        <div style="font-size:13.5px;color:#64748b;line-height:1.5;">
          This is an official administrative notice broadcast to registered students of <b>${libraryName}</b> (Desk: <b>${seatNo}</b>).
        </div>
      </td>
    </tr>

    <!-- Announcement Box -->
    <tr>
      <td style="padding:0 36px 24px 36px;">
        <div style="background:#f8fafc;border-radius:16px;padding:24px 26px;border:1px solid #e2e8f0;box-shadow:inset 0 1px 3px rgba(0,0,0,0.02);">
          
          <div style="font-size:18px;font-weight:800;color:#0f172a;line-height:1.4;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e2e8f0;">
            ${title}
          </div>

          <div style="font-size:14.5px;color:#334155;line-height:1.7;">
            ${formattedBody}
          </div>

        </div>
      </td>
    </tr>

    <!-- Action / Advisory Notice -->
    <tr>
      <td style="padding:0 36px 28px 36px;">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 18px;font-size:12.5px;color:#166534;line-height:1.6;">
          💡 <b>Notice Advisory:</b> Please keep this update in mind during your study hours. If you have questions or require further assistance, please contact library administration at <a href="mailto:receipts@globalpulse24.in" style="color:#15803d;font-weight:700;text-decoration:none;">receipts@globalpulse24.in</a> or visit the front reception desk.
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:20px 36px 28px 36px;background:#fafbfc;border-top:1px solid #f1f5f9;text-align:center;">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.5px;">
          VERTICAL CLASSES STUDY LOUNGE &bull; DESKFLOW MANAGEMENT
        </div>
        <div style="margin-top:6px;font-size:11px;color:#94a3b8;">
          Sent to <b>${student.email}</b> on ${dateStr} &bull; Confidential Student Communication
        </div>
      </td>
    </tr>

  </table>

</body>
</html>
  `;
}

async function sendAnnouncementEmail({ student, title, body, libraryName = 'Vertical Classes' }) {
  if (!student?.email) {
    throw new Error('Student does not have an email address configured.');
  }

  const html = getAnnouncementHtml({ student, title, body, libraryName });
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Vertical Classes Library <receipts@globalpulse24.in>';

  if (!process.env.RESEND_API_KEY || !resend) {
    return {
      success: true,
      mock: true,
      recipient: student.email,
      studentName: student.full_name,
      message: `Simulated announcement email sent to ${student.email}.`,
    };
  }

  try {
    const res = await resend.emails.send({
      from: fromEmail,
      to: [student.email],
      subject: `📢 [${libraryName} Notice] ${title}`,
      html: html,
    });

    if (res.error) {
      if (
        res.error.statusCode === 403 ||
        res.error.status === 403 ||
        res.error.message?.includes('testing emails') ||
        res.error.message?.includes('only send testing emails')
      ) {
        console.warn(`Resend testing mode: Forwarding announcement to admin email for ${student.email}`);
        const fallbackRes = await resend.emails.send({
          from: fromEmail,
          to: ['darsarwar1908@gmail.com'],
          subject: `[Student Announcement - Forward to ${student.email}] ${title} — ${libraryName}`,
          html: `<div style="background:#fef3c7;padding:12px;border-radius:8px;font-size:13px;color:#92400e;margin-bottom:16px;">
            ⚠️ <b>Resend Sandbox Notice:</b> Delivered to admin email because custom domain is in testing mode. Please forward to <b>${student.email}</b>.
          </div>` + html,
        });

        return {
          success: true,
          sandbox: true,
          data: fallbackRes.data,
          recipient: 'darsarwar1908@gmail.com',
          intendedRecipient: student.email,
          studentName: student.full_name,
        };
      }

      throw new Error(res.error.message || 'Resend Announcement dispatch failed');
    }

    return {
      success: true,
      data: res.data,
      recipient: student.email,
      studentName: student.full_name,
    };
  } catch (error) {
    console.error(`Failed to send announcement email to ${student.email}:`, error);
    throw error;
  }
}

async function broadcastAnnouncement({ students, title, body, libraryName = 'Vertical Classes' }) {
  const summary = {
    total: students.length,
    sent: 0,
    failed: 0,
    recipients: [],
    errors: [],
  };

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    try {
      const res = await sendAnnouncementEmail({ student, title, body, libraryName });
      summary.sent++;
      summary.recipients.push({
        id: student.id,
        name: student.full_name,
        email: student.email,
        seat: student.seat_number,
        sandbox: res.sandbox || false,
      });
    } catch (err) {
      summary.failed++;
      summary.errors.push({
        id: student.id,
        name: student.full_name,
        email: student.email,
        error: err.message,
      });
    }

    // 250ms spacing between emails to ensure 100% compliant rate-limiting for 40+ students
    if (i < students.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return summary;
}

module.exports = {
  sendReceiptEmail,
  sendReminderEmail,
  sendWifiCredentialsEmail,
  broadcastWifiCredentials,
  sendAnnouncementEmail,
  broadcastAnnouncement,
  getReceiptHtml,
  getReminderHtml,
  getWifiCredentialsHtml,
  getAnnouncementHtml,
};

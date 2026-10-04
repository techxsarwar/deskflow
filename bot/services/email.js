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
  const mode = (transaction?.payment_mode || 'UPI').toUpperCase();

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
              <span style="display:inline-block;padding:5px 12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;font-size:12px;font-weight:700;color:#059669;letter-spacing:0.2px;">
                &#10003; Paid in Full
              </span>
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

module.exports = {
  sendReceiptEmail,
  sendReminderEmail,
  getReceiptHtml,
  getReminderHtml,
};

/**
 * rental-calc.js
 * Shared calculation library for monthly rental management.
 * Used by: monthly_tenants.html, monthly_payments.html, history.html
 */

function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTodayDateOnly() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function computeEndDate(startStr, monthsStr) {
  if (!startStr || !monthsStr) return "";
  const months = Number(monthsStr);
  if (Number.isNaN(months) || months <= 0) return "";
  const d = new Date(startStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const targetMonthNorm = targetMonth % 12;
  const lastDayOfTarget = new Date(targetYear, targetMonthNorm + 1, 0).getDate();
  const clampedDay = Math.min(day, lastDayOfTarget);
  const mm = String(targetMonthNorm + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function toDS(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function buildContractMonths(booking) {
  const startStr = booking.checkin_date || booking.start_date;
  const duration = Number(booking.lease_duration || 0);

  if (!startStr || duration <= 0) return [];

  const start = parseDate(startStr);
  if (!start) return [];

  const leaseEnd = parseDate(computeEndDate(startStr, duration));
  if (!leaseEnd) return [];

  const today = getTodayDateOnly();

  let effectiveEnd = leaseEnd;
  if (booking.stopped_at) {
    const stopped = parseDate(String(booking.stopped_at).split("T")[0]);
    if (stopped && stopped < effectiveEnd) effectiveEnd = stopped;
  } else if (booking.checkout_date) {
    const checkout = parseDate(String(booking.checkout_date).split("T")[0]);
    if (checkout && checkout < effectiveEnd) effectiveEnd = checkout;
  }

  const lastDate = today < effectiveEnd ? today : effectiveEnd;
  const periods = [];

  for (let i = 0; i < duration; i++) {
    const periodStart = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());

    if (periodStart > lastDate) break;

    const periodEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, start.getDate());

    const mm = String(periodStart.getMonth() + 1).padStart(2, "0");
    const yyyy = periodStart.getFullYear();

    periods.push({
      year: periodStart.getFullYear(),
      month: periodStart.getMonth() + 1,
      periodStart,
      periodEnd,
      key: `period-${i + 1}`,
      label: `ค่าเช่าเดือน ${mm}/${yyyy}`
    });
  }

  return periods;
}

function paymentBelongsToBooking(payment, booking) {
  if (!payment || !booking) return false;
  // Use original_booking_id for rental_history records
  const bookingId = booking.original_booking_id || booking.id;
  if (payment.booking_id !== undefined && payment.booking_id !== null && payment.booking_id !== "") {
    return String(payment.booking_id) === String(bookingId);
  }
  return String(payment.room_number || payment.room || "") === String(booking.room_number || "");
}

function extraBillBelongsToBooking(bill, booking) {
  if (!bill || !booking) return false;
  const bookingId = booking.original_booking_id || booking.id;
  if (bill.booking_id !== undefined && bill.booking_id !== null && bill.booking_id !== "") {
    return String(bill.booking_id) === String(bookingId);
  }
  return String(bill.room || bill.room_number || "") === String(booking.room_number || "");
}

function otherCostBelongsToBooking(cost, booking) {
  if (!cost || !booking) return false;
  const bookingId = booking.original_booking_id || booking.id;
  if (cost.booking_id !== undefined && cost.booking_id !== null && cost.booking_id !== "") {
    return String(cost.booking_id) === String(bookingId);
  }
  return String(cost.room_number || cost.room || "") === String(booking.room_number || "");
}

function getPaymentSortDate(payment) {
  const raw = payment.payment_date || payment.paid_at || payment.created_at || payment.updated_at || null;
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function calculatePaymentAllocationOldestFirst(booking, payments, extraBills, utilityReadings, otherCosts) {
  const contractMonths = buildContractMonths(booking);
  const rentBase = Number(booking.monthly_rent || 0);
  const depositBase = Number(booking.deposit || 0);

  const roomPayments = (payments || [])
    .filter(p => paymentBelongsToBooking(p, booking))
    .sort((a, b) => getPaymentSortDate(a) - getPaymentSortDate(b));

  const roomExtraBills = (extraBills || []).filter(b => extraBillBelongsToBooking(b, booking));
  const roomOtherCosts = (otherCosts || []).filter(c => otherCostBelongsToBooking(c, booking));

  let totalPaymentPool = roomPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const monthRows = [];

  // Determine cancel date for boundary check
  const _cancelDateStr = booking.stopped_at
    ? String(booking.stopped_at).split("T")[0]
    : booking.checkout_date
      ? String(booking.checkout_date).split("T")[0]
      : null;
  const _todayForCalc = todayStr();

  contractMonths.forEach((ms, index) => {
    const _periodStartStr = toDS(ms.periodStart);

    // Skip period starting exactly on cancel/end boundary (not yet started)
    if (index > 0) {
      if (_cancelDateStr && _periodStartStr === _cancelDateStr) return;
      if (!_cancelDateStr && _periodStartStr === _todayForCalc) return;
    }

    let waterBill = 0;
    let electricBill = 0;
    let otherBill = 0;

    roomExtraBills.forEach(b => {
      if (Number(b.year) === ms.year && Number(b.month) === ms.month) {
        otherBill += Number(b.other || b.other_bill || 0);
      }
    });

    const nextPeriod = index + 1 < contractMonths.length ? contractMonths[index + 1] : null;
    const periodStartTime = ms.periodStart.getTime();
    const periodEndTime = nextPeriod
      ? nextPeriod.periodStart.getTime()
      : ((_cancelDateStr ? parseDate(_cancelDateStr) : parseDate(_todayForCalc)) || ms.periodEnd).getTime() + 86400000;

    roomOtherCosts.forEach(c => {
      const rawDate = c.cost_date || c.created_at || c.updated_at || null;
      if (!rawDate) return;
      const costDate = new Date(String(rawDate).split("T")[0] + "T00:00:00");
      if (isNaN(costDate.getTime())) return;
      if (costDate.getTime() >= periodStartTime && costDate.getTime() < periodEndTime) {
        otherBill += Number(c.amount || 0);
      }
    });

    const fromStr = _periodStartStr;

    let toStr;
    if (nextPeriod) {
      toStr = toDS(nextPeriod.periodStart);
    } else {
      toStr = _cancelDateStr || _todayForCalc;
    }

    (utilityReadings || []).filter(u =>
      String(u.room_number) === String(booking.room_number) &&
      u.read_date > fromStr &&
      u.read_date <= toStr
    ).forEach(u => {
      waterBill += Number(u.water_amount || 0);
      electricBill += Number(u.electric_amount || 0);
    });

    const depositForMonth = index === 0 ? depositBase : 0;
    const isLastPeriod = !nextPeriod;
    // If booking is cancelled/ended, utility in last period is due now (not pending)
    const isCancelled = !!_cancelDateStr;
    const isCurrentPeriod = isLastPeriod && !isCancelled;
    const required = isLastPeriod
      ? rentBase + depositForMonth + (isCancelled ? waterBill + electricBill : 0) + otherBill
      : rentBase + depositForMonth + waterBill + electricBill + otherBill;
    const pendingWater = isCurrentPeriod ? waterBill : 0;
    const pendingElectric = isCurrentPeriod ? electricBill : 0;

    const paidApplied = Math.min(required, Math.max(totalPaymentPool, 0));
    totalPaymentPool -= paidApplied;

    const diff = required - paidApplied;

    let statusText = "", statusClass = "";
    if (diff > 0 && paidApplied === 0) { statusText = "ยังไม่ชำระ"; statusClass = "status-unpaid"; }
    else if (diff > 0 && paidApplied > 0) { statusText = "จ่ายบางส่วน"; statusClass = "status-partial"; }
    else { statusText = "ชำระแล้ว"; statusClass = "status-paid"; }

    const now = new Date();
    const isCurrent = ms.year === now.getFullYear() && ms.month === now.getMonth() + 1;
    const isOverdue = diff > 0 && (ms.year < now.getFullYear() || (ms.year === now.getFullYear() && ms.month < now.getMonth() + 1));

    const prevLabel = `${fromStr} ถึง ${toStr}`;
    let detailLine1 = `<span style="display:inline-block; min-width:0;">ค่าเช่าเดือนนี้ = <b>${rentBase.toFixed(2)} บาท</b>`;
    if (depositForMonth > 0) detailLine1 += ` &nbsp;&nbsp; เงินประกัน = <b>${depositForMonth.toFixed(2)} บาท</b>`;
    detailLine1 += `</span>`;
    if (!isCurrentPeriod) {
      detailLine1 += `<br><span style="display:inline-block; margin-top:3px;">`;
      detailLine1 += `ค่าไฟ (${prevLabel}) = <b>${electricBill.toFixed(2)} บาท</b>`;
      detailLine1 += ` &nbsp;&nbsp;&nbsp; ค่าน้ำ (${prevLabel}) = <b>${waterBill.toFixed(2)} บาท</b>`;
      detailLine1 += ` &nbsp;&nbsp;&nbsp; ค่าอื่นๆ (${prevLabel}) = <b>${otherBill.toFixed(2)} บาท</b>`;
      detailLine1 += `</span>`;
    } else if (otherBill > 0) {
      detailLine1 += `<br><span style="display:inline-block; margin-top:3px;">ค่าอื่นๆ = <b>${otherBill.toFixed(2)} บาท</b></span>`;
    }
    detailLine1 += `<br><span style="display:inline-block; margin-top:3px;">รวม = <b>${required.toFixed(2)} บาท</b></span>`;
    const detailLine2 = `ตัดชำระแล้ว ${paidApplied.toFixed(2)} บาท`;
    const detailLine3 = diff > 0 ? `ค้างชำระ ${diff.toFixed(2)} บาท` : `ไม่มีค้างชำระ`;

    monthRows.push({
      year: ms.year, month: ms.month, label: ms.label,
      rent: rentBase, depositForMonth,
      waterBill: isCurrentPeriod ? 0 : waterBill,
      electricBill: isCurrentPeriod ? 0 : electricBill,
      otherBill,
      required, paid: paidApplied, diff,
      pendingWater, pendingElectric, isCurrentPeriod,
      statusText, statusClass, detailLine1, detailLine2, detailLine3,
      isCurrent, isOverdue
    });
  });

  const extraCredit = totalPaymentPool > 0 ? totalPaymentPool : 0;
  const totalRequired = monthRows.reduce((sum, r) => sum + r.required, 0);
  const totalPaidApplied = monthRows.reduce((sum, r) => sum + r.paid, 0);
  const totalDebt = monthRows.reduce((sum, r) => sum + Math.max(r.diff, 0), 0);
  const depositCredit = monthRows.length > 0 ? Math.min(depositBase, monthRows[0].paid) : 0;

  return {
    months: monthRows,
    totalRequired, totalPaidApplied, totalDebt,
    extraCredit, depositCredit, depositBase
  };
}

function normalizeRoomType(value) {
  const x = String(value || "").trim().toUpperCase();
  if (x === "TWN") return "TWIN";
  return x;
}

function dateRangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return (startA < endB) && (startB < endA);
}

function isExpiredMonthlyBooking(booking) {
  if (!booking || booking.rent_type !== "monthly") return false;
  const endStr = computeEndDate(booking.checkin_date, booking.lease_duration);
  if (!endStr) return false;
  const endDate = parseDate(endStr);
  if (!endDate) return false;
  return getTodayDateOnly() >= endDate;
}

function updateEndedSummary(endedCount) {
  const bar = document.getElementById("endedSummary");
  if (!bar) return;
  if (endedCount > 0) {
    bar.classList.add("show");
    bar.textContent = `มีสัญญาที่หมดอายุแล้ว ${endedCount} รายการ`;
  } else {
    bar.classList.remove("show");
    bar.textContent = "";
  }
}

function goToHistory(room) {
  window.location.href = "history.html?room=" + encodeURIComponent(room);
}

function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

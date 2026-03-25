function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseDateOnlyString(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function formatDisplayDate(value, fallback = "-") {
  if (!value) return fallback;

  const dateOnly = parseDateOnlyString(value);
  if (dateOnly) {
    return `${pad2(dateOnly.day)}/${pad2(dateOnly.month)}/${dateOnly.year}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatDisplayTime(value, includeSeconds = false, fallback = "-") {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;

  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  if (!includeSeconds) return `${hh}:${mm}`;
  return `${hh}:${mm}:${pad2(d.getSeconds())}`;
}

function formatDisplayDateTime(value, options = {}) {
  const {
    fallback = "-",
    includeSeconds = false
  } = options;

  if (!value) return fallback;

  const dateOnly = parseDateOnlyString(value);
  if (dateOnly) {
    return `${pad2(dateOnly.day)}/${pad2(dateOnly.month)}/${dateOnly.year}`;
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const dateText = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  const timeText = formatDisplayTime(d, includeSeconds, "");
  return timeText ? `${dateText} ${timeText}` : dateText;
}

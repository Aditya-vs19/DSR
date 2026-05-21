const SQL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

const parseBackendDateValue = (value, { assumeUtc = false } = {}) => {
  if (!value) {
    return null;
  }

  const rawValue = String(value).trim();
  const normalizedValue = SQL_DATETIME_PATTERN.test(rawValue)
    ? `${rawValue.replace(" ", "T")}${assumeUtc ? "Z" : ""}`
    : rawValue;

  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const formatBackendDate = (value) => {
  if (!value) {
    return "";
  }

  const parsed = parseBackendDateValue(value);
  if (!parsed) {
    return String(value).slice(0, 10);
  }

  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
};

export const formatBackendDateTime = (value) => {
  if (!value) {
    return "";
  }

  const parsed = parseBackendDateValue(value, { assumeUtc: true });
  if (!parsed) {
    return String(value);
  }

  return parsed.toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
};

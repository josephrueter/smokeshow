// "Thursday ~6 PM" — verdict headlines always carry the ~ (share spec rule).
export function formatVerdictTime(timeUTCStr, tz) {
  const d = new Date(timeUTCStr + 'Z');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: true,
    timeZone: tz,
  }).format(d);
  return `${weekday} ~${time}`;
}

export function formatLocalTime(timeUTCStr, tz) {
  const d = new Date(timeUTCStr + 'Z');
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).format(d);
  return `${weekday} ${time}`;
}

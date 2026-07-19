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

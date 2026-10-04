import i18n, { translate } from './i18n';
import { LANGUAGES } from './language';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function currentLocale() {
  return LANGUAGES.find(item => item.code === i18n.resolvedLanguage)?.locale ?? 'en-LK';
}
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(currentLocale(), options).format(value);
}
export function formatDate(value: Date | number, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  // Some browsers omit Sinhala from ICU. Use bundled labels instead of silently rendering English.
  if (!Intl.DateTimeFormat.supportedLocalesOf([currentLocale()]).length) {
    if (options.hour) return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return [options.year ? formatNumber(date.getFullYear(), { useGrouping: false }) : '',
      options.month ? options.month === 'numeric' || options.month === '2-digit' ? formatNumber(date.getMonth() + 1) : translate(MONTHS[date.getMonth()]) : '',
      options.day ? formatNumber(date.getDate()) : ''].filter(Boolean).join(' ');
  }
  return new Intl.DateTimeFormat(currentLocale(), options).format(date);
}
export function formatTime(value: Date) {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' });
}
// Calendar dates are local dates, not UTC instants. Keep the selected day in every timezone.
export function formatCalendarDate(value: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return value;
  return formatDate(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])));
}
export function formatRelativeDate(date: Date, now = new Date()) {
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return translate('Just now');
  if (minutes >= 10080) return formatDate(date, { month: 'short', day: 'numeric' });
  // Hermes does not provide RelativeTimeFormat. Even available implementations
  // can reject a locale, so fall back for capability, locale and formatting errors.
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function'
      && typeof Intl.RelativeTimeFormat.supportedLocalesOf === 'function'
      && Intl.RelativeTimeFormat.supportedLocalesOf([currentLocale()]).length) {
      const formatter = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' });
      if (minutes < 60) return formatter.format(-minutes, 'minute');
      if (minutes < 1440) return formatter.format(-Math.floor(minutes / 60), 'hour');
      return formatter.format(-Math.floor(minutes / 1440), 'day');
    }
  } catch { /* The bundled translations also work without platform locale data. */ }
  if (minutes < 60) return translate('{{count}} minutes ago', { count: minutes });
  if (minutes < 1440) return translate('{{count}} hours ago', { count: Math.floor(minutes / 60) });
  if (minutes < 2880) return translate('Yesterday');
  return translate('{{count}} days ago', { count: Math.floor(minutes / 1440) });
}

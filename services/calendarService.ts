import { Platform, Linking } from 'react-native';
import * as Calendar from 'expo-calendar';

export interface CalendarEventInput {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  durationMinutes?: number;
  location?: string;
  description?: string;
  gigId?: string;
  applicationId?: string;
  pay?: number;
  payType?: 'fixed' | 'hourly' | string;
  counterpartName?: string;
  counterpartRole?: 'business' | 'freelancer' | string;
}

export interface CalendarResult {
  success: boolean;
  eventId?: string;
  calendarName?: string;
  method?: 'native' | 'google_web' | 'ics';
  error?: string;
}

/**
 * Safely parses YYYY-MM-DD and optional HH:MM into start and end Dates.
 */
export function parseGigEventDates(
  dateStr: string,
  timeStr?: string,
  durationMinutes = 180
): { startDate: Date; endDate: Date } {
  let year = new Date().getFullYear();
  let month = new Date().getMonth();
  let day = new Date().getDate();

  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const parts = dateStr.trim().split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  }

  let hours = 9;
  let minutes = 0;
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr.trim())) {
    const timeParts = timeStr.trim().split(':');
    hours = parseInt(timeParts[0], 10);
    minutes = parseInt(timeParts[1], 10);
  }

  const startDate = new Date(year, month, day, hours, minutes, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  return { startDate, endDate };
}

/**
 * Formats a Date object to YYYYMMDDTHHmmssZ format for calendar URLs and ICS files.
 */
function formatUtcIsoCompact(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Generates an event summary description from the gig details.
 */
export function buildEventDescription(input: CalendarEventInput): string {
  const lines: string[] = [];
  if (input.description) lines.push(input.description);
  if (input.counterpartName) {
    const label = input.counterpartRole === 'business' ? 'Business Client' : 'Youth Freelancer';
    lines.push(`${label}: ${input.counterpartName}`);
  }
  if (input.pay !== undefined && input.pay !== null) {
    lines.push(`Compensation: $${input.pay}${input.payType === 'hourly' ? '/hr' : ' fixed'}`);
  }
  if (input.location) lines.push(`Location: ${input.location}`);
  lines.push('Coordinated via Gigzy Youth Employment Platform');
  return lines.join('\n');
}

/**
 * Builds a Google Calendar web URL as a reliable cross-platform and web fallback.
 */
export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const { startDate, endDate } = parseGigEventDates(input.date, input.time, input.durationMinutes);
  const startIso = formatUtcIsoCompact(startDate);
  const endIso = formatUtcIsoCompact(endDate);

  const title = encodeURIComponent(input.title.startsWith('Gig:') ? input.title : `Gig: ${input.title}`);
  const details = encodeURIComponent(buildEventDescription(input));
  const location = encodeURIComponent(input.location || 'Gig Location');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string.
 */
export function generateIcsContent(input: CalendarEventInput): string {
  const { startDate, endDate } = parseGigEventDates(input.date, input.time, input.durationMinutes);
  const startIso = formatUtcIsoCompact(startDate);
  const endIso = formatUtcIsoCompact(endDate);
  const stampIso = formatUtcIsoCompact(new Date());
  const uid = `gigzy-${input.gigId || 'event'}-${input.applicationId || Date.now()}@gigzy.app`;

  const cleanTitle = (input.title.startsWith('Gig:') ? input.title : `Gig: ${input.title}`).replace(/[\r\n]/g, ' ');
  const cleanDesc = buildEventDescription(input).replace(/\n/g, '\\n');
  const cleanLoc = (input.location || 'Gig Location').replace(/[\r\n]/g, ' ');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gigzy//Youth Employment App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stampIso}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDesc}`,
    `LOCATION:${cleanLoc}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Upcoming Gigzy gig',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Finds or creates a writable calendar on native devices (iOS / Android).
 */
async function getWritableCalendarId(): Promise<{ id: string; name: string } | null> {
  try {
    if (Platform.OS === 'ios') {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar && defaultCalendar.id && defaultCalendar.allowsModifications) {
        return { id: defaultCalendar.id, name: defaultCalendar.title };
      }
    }

    // Query calendars for EVENT entities
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = calendars.find(
      (c) => c.allowsModifications && c.source && c.source.name
    ) || calendars.find((c) => c.allowsModifications);

    if (writable) {
      return { id: writable.id, name: writable.title };
    }

    // On Android, if no writable calendar exists, create one
    if (Platform.OS === 'android') {
      const newCalId = await Calendar.createCalendarAsync({
        title: 'Gigzy Gigs',
        color: '#087F73',
        entityType: Calendar.EntityTypes.EVENT,
        name: 'GigzyCalendar',
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
      return { id: newCalId, name: 'Gigzy Gigs' };
    }

    return null;
  } catch (error) {
    console.warn('Error resolving calendar ID:', error);
    return null;
  }
}

/**
 * Integrates an accepted gig with the user's calendar:
 * 1. Checks device calendar permissions on iOS/Android.
 * 2. Adds the event directly to system calendar via expo-calendar.
 * 3. Gracefully falls back to opening Google Calendar in browser or deep-link.
 */
export async function addGigToCalendar(input: CalendarEventInput): Promise<CalendarResult> {
  const { startDate, endDate } = parseGigEventDates(input.date, input.time, input.durationMinutes);
  const eventTitle = input.title.startsWith('Gig:') ? input.title : `Gig: ${input.title}`;
  const notes = buildEventDescription(input);
  const location = input.location || 'Gig Location';

  // 1. Web Environment: Open Google Calendar in browser or trigger download
  if (Platform.OS === 'web') {
    try {
      const googleUrl = buildGoogleCalendarUrl(input);
      if (typeof window !== 'undefined' && window.open) {
        window.open(googleUrl, '_blank');
      } else {
        await Linking.openURL(googleUrl);
      }
      return { success: true, method: 'google_web' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to open web calendar.' };
    }
  }

  // 2. Native Android / iOS Environment
  try {
    // Request permission
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (perm.status !== 'granted') {
      // If permission is denied, fall back to Google Calendar URL
      const googleUrl = buildGoogleCalendarUrl(input);
      const canOpen = await Linking.canOpenURL(googleUrl);
      if (canOpen) {
        await Linking.openURL(googleUrl);
        return { success: true, method: 'google_web' };
      }
      return {
        success: false,
        error: 'Calendar permission was denied. Please allow calendar access in Settings.',
      };
    }

    // Resolve calendar
    const calTarget = await getWritableCalendarId();
    if (!calTarget) {
      // Fallback to Google Calendar
      const googleUrl = buildGoogleCalendarUrl(input);
      await Linking.openURL(googleUrl);
      return { success: true, method: 'google_web' };
    }

    // Create event via expo-calendar
    const eventId = await Calendar.createEventAsync(calTarget.id, {
      title: eventTitle,
      startDate,
      endDate,
      location,
      notes,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      alarms: [
        { relativeOffset: -60 }, // 1 hour reminder
        { relativeOffset: -1440 }, // 24 hour reminder
      ],
    });

    return {
      success: true,
      eventId,
      calendarName: calTarget.name,
      method: 'native',
    };
  } catch (error: any) {
    console.warn('Native calendar addition failed, attempting web fallback:', error);
    try {
      const googleUrl = buildGoogleCalendarUrl(input);
      await Linking.openURL(googleUrl);
      return { success: true, method: 'google_web' };
    } catch (fallbackError: any) {
      return {
        success: false,
        error: error.message || fallbackError.message || 'Failed to add event to calendar.',
      };
    }
  }
}

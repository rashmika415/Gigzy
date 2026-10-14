const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setupCalendarService() {
  const source = fs.readFileSync(path.join(__dirname, '../services/calendarService.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;

  const exports = {};
  const mockCalendar = {
    EntityTypes: { EVENT: 'event' },
    CalendarAccessLevel: { OWNER: 'owner' },
    requestCalendarPermissionsAsync: async () => ({ status: 'granted' }),
    getDefaultCalendarAsync: async () => ({ id: 'cal-default', title: 'Default', allowsModifications: true }),
    getCalendarsAsync: async () => [{ id: 'cal-1', title: 'Work', allowsModifications: true, source: { name: 'Work' } }],
    createCalendarAsync: async () => 'cal-new',
    createEventAsync: async (calId, details) => `evt-${calId}-123`,
  };

  vm.runInNewContext(compiled, {
    exports,
    module: { exports },
    require: (mod) => {
      if (mod === 'react-native') {
        return {
          Platform: { OS: 'ios' },
          Linking: {
            openURL: async (url) => url,
            canOpenURL: async () => true,
          },
        };
      }
      if (mod === 'expo-calendar') return mockCalendar;
      return {};
    },
    Intl,
    Date,
    encodeURIComponent,
    console,
  });

  return exports;
}

test('parseGigEventDates safely parses date, time, and custom duration', () => {
  const service = setupCalendarService();

  const { startDate, endDate } = service.parseGigEventDates('2026-11-20', '14:30', 120);

  assert.equal(startDate.getFullYear(), 2026);
  assert.equal(startDate.getMonth(), 10); // November is 10 (0-indexed)
  assert.equal(startDate.getDate(), 20);
  assert.equal(startDate.getHours(), 14);
  assert.equal(startDate.getMinutes(), 30);

  // 120 minutes later = 16:30
  assert.equal(endDate.getHours(), 16);
  assert.equal(endDate.getMinutes(), 30);
});

test('parseGigEventDates uses sensible defaults when time is not provided', () => {
  const service = setupCalendarService();

  const { startDate, endDate } = service.parseGigEventDates('2026-12-05');

  assert.equal(startDate.getFullYear(), 2026);
  assert.equal(startDate.getMonth(), 11);
  assert.equal(startDate.getDate(), 5);
  assert.equal(startDate.getHours(), 9); // default 9:00 AM
  assert.equal(startDate.getMinutes(), 0);

  // default duration 180 min (3 hours) = 12:00 PM
  assert.equal(endDate.getHours(), 12);
  assert.equal(endDate.getMinutes(), 0);
});

test('buildEventDescription formats gig details with compensation, counterpart, and location', () => {
  const service = setupCalendarService();

  const desc = service.buildEventDescription({
    title: 'Store Front Mural Painting',
    date: '2026-11-25',
    description: 'Paint an artistic mural on storefront window.',
    counterpartName: 'Nimali Silva',
    counterpartRole: 'freelancer',
    pay: 150,
    payType: 'fixed',
    location: 'Galle Road, Colombo 03',
  });

  assert.match(desc, /Paint an artistic mural/);
  assert.match(desc, /Youth Freelancer: Nimali Silva/);
  assert.match(desc, /Compensation: \$150 fixed/);
  assert.match(desc, /Location: Galle Road, Colombo 03/);
  assert.match(desc, /LocalWorks Youth Employment Platform/);
});

test('buildGoogleCalendarUrl builds valid Google Calendar TEMPLATE URL', () => {
  const service = setupCalendarService();

  const url = service.buildGoogleCalendarUrl({
    title: 'Logo Redesign',
    date: '2026-11-20',
    time: '10:00',
    durationMinutes: 60,
    location: 'Remote Work',
    pay: 75,
    payType: 'fixed',
    counterpartName: 'Kasun Perera',
    counterpartRole: 'business',
  });

  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
  assert.match(url, /text=Gig%3A%20Logo%20Redesign/);
  assert.match(url, /dates=2026/);
  assert.match(url, /location=Remote%20Work/);
  assert.match(url, /details=/);
});

test('generateIcsContent generates valid RFC 5545 iCalendar content with alarms', () => {
  const service = setupCalendarService();

  const ics = service.generateIcsContent({
    title: 'Website Bug Fix',
    date: '2026-11-22',
    time: '09:00',
    durationMinutes: 180,
    gigId: 'gig-999',
    applicationId: 'app-888',
    location: 'Colombo Tech Hub',
    pay: 40,
    payType: 'hourly',
  });

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /VERSION:2\.0/);
  assert.match(ics, /PRODID:-\/\/LocalWorks\/\/Youth Employment App\/\/EN/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /UID:localworks-gig-999-app-888@localworks\.app/);
  assert.match(ics, /SUMMARY:Gig: Website Bug Fix/);
  assert.match(ics, /LOCATION:Colombo Tech Hub/);
  assert.match(ics, /STATUS:CONFIRMED/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /TRIGGER:-PT60M/);
  assert.match(ics, /END:VALARM/);
  assert.match(ics, /END:VEVENT/);
  assert.match(ics, /END:VCALENDAR/);
});

test('addGigToCalendar successfully creates event on native device platform', async () => {
  const service = setupCalendarService();

  const result = await service.addGigToCalendar({
    title: 'Mobile App Testing',
    date: '2026-11-30',
    time: '13:00',
    location: 'Virtual Meet',
    pay: 50,
  });

  assert.equal(result.success, true);
  assert.equal(result.method, 'native');
  assert.ok(result.eventId);
  assert.match(result.eventId, /evt-/);
});

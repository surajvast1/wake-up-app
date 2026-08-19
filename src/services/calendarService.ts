import * as Calendar from "expo-calendar";
import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CONNECTED_KEY = "CALENDAR_CONNECTED";
const SELECTED_CALS_KEY = "CALENDAR_SELECTED_IDS";
const REMINDER_MINS_KEY = "CALENDAR_REMINDER_MINS";

export interface CalEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  calendarId: string;
  calendarColor?: string;
  calendarTitle?: string;
  allDay: boolean;
  organizer?: string;
  attendees?: { name?: string; email?: string; status?: string }[];
}

export interface CalendarInfo {
  id: string;
  title: string;
  color: string;
  source: string;
  type: string;
  writable: boolean;
  selected: boolean;
}

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status === "granted") {
    await AsyncStorage.setItem(CONNECTED_KEY, "true");
    return true;
  }
  return false;
}

export async function isCalendarConnected(): Promise<boolean> {
  const val = await AsyncStorage.getItem(CONNECTED_KEY);
  if (val !== "true") return false;
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === "granted";
}

export async function disconnectCalendar(): Promise<void> {
  await AsyncStorage.multiRemove([CONNECTED_KEY, SELECTED_CALS_KEY]);
}

export async function getCalendars(): Promise<CalendarInfo[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const selectedIds = await getSelectedCalendarIds();

  return calendars.map((c) => ({
    id: c.id,
    title: c.title,
    color: c.color ?? "#5B7553",
    source: c.source?.name ?? "Local",
    type: c.source?.type ?? "unknown",
    writable: c.allowsModifications ?? false,
    selected: selectedIds.length === 0 || selectedIds.includes(c.id),
  }));
}

export async function getSelectedCalendarIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(SELECTED_CALS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function setSelectedCalendarIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(SELECTED_CALS_KEY, JSON.stringify(ids));
}

export async function getReminderMinutes(): Promise<number> {
  const val = await AsyncStorage.getItem(REMINDER_MINS_KEY);
  return val ? parseInt(val, 10) : 10;
}

export async function setReminderMinutes(mins: number): Promise<void> {
  await AsyncStorage.setItem(REMINDER_MINS_KEY, String(mins));
}

export async function fetchTodayEvents(): Promise<CalEvent[]> {
  const connected = await isCalendarConnected();
  if (!connected) return [];

  const selectedIds = await getSelectedCalendarIds();
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calMap = new Map(calendars.map((c) => [c.id, c]));

  const activeIds =
    selectedIds.length > 0
      ? selectedIds
      : calendars.map((c) => c.id);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const events = await Calendar.getEventsAsync(activeIds, start, end);

  return events
    .map((e) => {
      const cal = calMap.get(e.calendarId);
      return {
        id: e.id,
        title: e.title ?? "(No title)",
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
        location: e.location ?? undefined,
        notes: e.notes ?? undefined,
        calendarId: e.calendarId,
        calendarColor: cal?.color ?? "#5B7553",
        calendarTitle: cal?.title ?? "",
        allDay: e.allDay ?? false,
        organizer: (e as any).organizer?.email ?? undefined,
        attendees: ((e as any).attendees ?? []).map((a: any) => ({
          name: a.name,
          email: a.email ?? a.url,
          status: a.status,
        })),
      };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export interface CreateEventResult {
  eventId: string;
  calendarId: string;
  shouldSendInvite: boolean;
  inviteParams?: {
    title: string;
    startDate: Date;
    endDate: Date;
    location?: string;
    notes?: string;
    attendeeEmails: string[];
  };
}

export async function createEvent(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  attendeeEmails?: string[];
  calendarId?: string;
}): Promise<CreateEventResult> {
  const connected = await isCalendarConnected();
  if (!connected) throw new Error("Calendar is not connected. Please connect first.");

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) throw new Error("No calendars found on this device.");

  let calendarId = params.calendarId;

  if (!calendarId) {
    const syncedWritable = calendars.find(
      (c) =>
        c.allowsModifications &&
        c.source?.type &&
        !["local", "birthdays"].includes(c.source.type.toLowerCase())
    );
    const anyWritable = calendars.find((c) => c.allowsModifications);

    if (syncedWritable) {
      calendarId = syncedWritable.id;
    } else if (anyWritable) {
      calendarId = anyWritable.id;
    } else {
      const createOpts: any = {
        title: "Uniflow",
        color: "#5B7553",
        entityType: Calendar.EntityTypes.EVENT,
          name: "uniflow",
        ownerAccount: "personal",
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      };
      if (Platform.OS === "ios") {
        createOpts.sourceId = calendars[0]?.source?.id;
        createOpts.source = {
          name: calendars[0]?.source?.name ?? "Default",
          type: calendars[0]?.source?.type as any,
          isLocalAccount: true,
        };
      } else {
        createOpts.source = {
          name: "Uniflow",
          isLocalAccount: true,
          type: Calendar.CalendarType.LOCAL as any,
        };
      }
      calendarId = await Calendar.createCalendarAsync(createOpts);
    }
  }

  const selectedIds = await getSelectedCalendarIds();
  if (selectedIds.length > 0 && !selectedIds.includes(calendarId)) {
    await setSelectedCalendarIds([...selectedIds, calendarId]);
  }

  type CreateEventPayload = NonNullable<
    Parameters<typeof Calendar.createEventAsync>[1]
  >;
  const details: CreateEventPayload = {
    title: params.title,
    startDate: params.startDate,
    endDate: params.endDate,
    location: params.location,
    notes: params.notes,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const eventId = await Calendar.createEventAsync(calendarId, details);

  const hasAttendees = (params.attendeeEmails?.length ?? 0) > 0;

  return {
    eventId,
    calendarId,
    shouldSendInvite: hasAttendees,
    inviteParams: hasAttendees
      ? { ...params, attendeeEmails: params.attendeeEmails! }
      : undefined,
  };
}

export async function sendMeetingInviteEmail(params: {
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  attendeeEmails?: string[];
}): Promise<void> {
  const { title, startDate, endDate, location, attendeeEmails } = params;
  if (!attendeeEmails?.length) return;

  const dateStr = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const startTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const bodyParts = [
    `You're invited to: ${title}`,
    "",
    `Date: ${dateStr}`,
    `Time: ${startTime} - ${endTime}`,
  ];
  if (location) {
    const isLink = location.startsWith("http");
    bodyParts.push(isLink ? `Join: ${location}` : `Location: ${location}`);
  }
  if (params.notes) {
    bodyParts.push("", `Notes: ${params.notes}`);
  }
  bodyParts.push("", "— Sent via Uniflow");

  const to = attendeeEmails.join(",");
  const subject = encodeURIComponent(`Meeting Invite: ${title}`);
  const body = encodeURIComponent(bodyParts.join("\n"));
  const mailto = `mailto:${to}?subject=${subject}&body=${body}`;

  try {
    const canOpen = await Linking.canOpenURL(mailto);
    if (canOpen) await Linking.openURL(mailto);
  } catch {}
}

export async function deleteEvent(eventId: string): Promise<void> {
  await Calendar.deleteEventAsync(eventId);
}

export function formatEventTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getEventDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

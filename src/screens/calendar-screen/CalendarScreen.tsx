import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  Alert,
  Animated,
  Platform,
  Switch,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import MenuButton from "../../components/MenuButton";
import { useAppTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { AppColors } from "../../theme/colors";
import {
  CalEvent,
  CalendarInfo,
  requestCalendarPermission,
  isCalendarConnected,
  disconnectCalendar,
  getCalendars,
  fetchTodayEvents,
  createEvent,
  deleteEvent,
  formatEventTime,
  getEventDuration,
  getSelectedCalendarIds,
  setSelectedCalendarIds,
  getReminderMinutes,
  setReminderMinutes,
  sendMeetingInviteEmail,
} from "../../services/calendarService";

type CalAttendee = NonNullable<CalEvent["attendees"]>[number];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 72;
const REMINDER_OPTIONS = [5, 10, 15, 30, 60];

const CalendarScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c } = useAppTheme();
  const { isGuest } = useAuth();
  const styles = useMemo(() => createCalendarStyles(c), [c]);

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [calendars, setCalendars] = useState<CalendarInfo[]>([]);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);
  const [reminderMins, setReminderMinsState] = useState(10);

  // Create form
  const [cTitle, setCTitle] = useState("");
  const [cLocation, setCLocation] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cEmails, setCEmails] = useState("");
  const [cMeetLink, setCMeetLink] = useState("");
  const [showPasteInput, setShowPasteInput] = useState(false);
  const [cStartDate, setCStartDate] = useState(new Date());
  const [cEndDate, setCEndDate] = useState(new Date(Date.now() + 3600000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const scrollRef = useRef<ScrollView>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMsg(""));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const conn = await isCalendarConnected();
    if (!conn && isGuest) {
      const start = new Date();
      start.setHours(Math.min(start.getHours() + 1, 21), 0, 0, 0);
      const end = new Date(start.getTime() + 45 * 60 * 1000);
      const later = new Date(start);
      later.setHours(Math.min(start.getHours() + 3, 23), 0, 0, 0);
      setConnected(true);
      setEvents([
        {
          id: "guest-demo-event-1",
          title: "Focus time",
          startDate: start,
          endDate: end,
          calendarId: "guest-demo",
          calendarColor: "#5B7553",
          calendarTitle: "Guest preview",
          allDay: false,
        },
        {
          id: "guest-demo-event-2",
          title: "Evening wind-down",
          startDate: later,
          endDate: new Date(later.getTime() + 30 * 60 * 1000),
          calendarId: "guest-demo",
          calendarColor: "#7C3AED",
          calendarTitle: "Guest preview",
          allDay: false,
        },
      ]);
      setCalendars([]);
      setLoading(false);
      return;
    }
    setConnected(conn);
    if (conn) {
      const [ev, cals, mins] = await Promise.all([
        fetchTodayEvents(),
        getCalendars(),
        getReminderMinutes(),
      ]);
      setEvents(ev);
      setCalendars(cals);
      setReminderMinsState(mins);
      scheduleAllReminders(ev, mins);
    }
    setLoading(false);
  }, [isGuest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const hasScrolled = useRef(false);
  useEffect(() => {
    if (connected && events.length >= 0 && !hasScrolled.current) {
      hasScrolled.current = true;
      const firstEvent = events.find((e) => !e.allDay);
      const targetHour = firstEvent
        ? Math.max(0, firstEvent.startDate.getHours() - 1)
        : Math.max(0, new Date().getHours() - 1);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: targetHour * HOUR_HEIGHT, animated: true });
      }, 400);
    }
  }, [connected, events]);

  const scheduleAllReminders = async (evts: CalEvent[], mins: number) => {
    try {
      const Notif: any = require("expo-notifications");
      if (
        !Notif?.getPermissionsAsync ||
        !Notif?.scheduleNotificationAsync
      )
        return;

      const { status } = await Notif.getPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } = await Notif.requestPermissionsAsync();
        if (newStatus !== "granted") return;
      }

      if (Notif.setNotificationHandler) {
        Notif.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
      }

      const now = Date.now();
      for (const ev of evts) {
        if (ev.allDay) continue;
        const triggerTime = ev.startDate.getTime() - mins * 60 * 1000;
        const secondsUntil = Math.round((triggerTime - now) / 1000);
        if (secondsUntil <= 0) continue;

        try {
          await Notif.scheduleNotificationAsync({
            content: {
              title: "Meeting Starting Soon",
              body: `${ev.title} starts in ${mins} min`,
              data: { eventId: ev.id },
            },
            trigger: { type: "timeInterval", seconds: secondsUntil, repeats: false },
            identifier: `cal-${ev.id}`,
          });
        } catch {}
      }
    } catch {}
  };

  const handleConnect = async () => {
    const granted = await requestCalendarPermission();
    if (granted) {
      showToast("Calendar connected!");
      await load();
    } else {
      Alert.alert(
        "Permission Required",
        "Please grant calendar access in your device settings to connect your calendars."
      );
    }
  };

  const handleDisconnect = async () => {
    Alert.alert("Disconnect", "Remove calendar integration?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          await disconnectCalendar();
          setConnected(false);
          setEvents([]);
          setCalendars([]);
          showToast("Calendar disconnected");
        },
      },
    ]);
  };

  const toggleCalendar = async (calId: string) => {
    const currentIds = await getSelectedCalendarIds();
    const allIds = calendars.map((c) => c.id);
    let active = currentIds.length > 0 ? currentIds : allIds;

    if (active.includes(calId)) {
      active = active.filter((id: string) => id !== calId);
    } else {
      active = [...active, calId];
    }

    await setSelectedCalendarIds(active);
    setCalendars((prev) =>
      prev.map((c) => ({ ...c, selected: active.includes(c.id) }))
    );
    const ev = await fetchTodayEvents();
    setEvents(ev);
  };

  const handleSaveReminder = async (mins: number) => {
    await setReminderMinutes(mins);
    setReminderMinsState(mins);
    scheduleAllReminders(events, mins);
    showToast(`Reminder set to ${mins} min before`);
  };

  const openCreate = () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    setCTitle("");
    setCLocation("");
    setCNotes("");
    setCEmails("");
    setCMeetLink("");
    setShowPasteInput(false);
    setCStartDate(now);
    setCEndDate(new Date(now.getTime() + 3600000));
    setShowDatePicker(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
    setCreateVisible(true);
  };

  const handleCreateEvent = async () => {
    if (!cTitle.trim()) {
      Alert.alert("Error", "Meeting title is required");
      return;
    }
    if (cEndDate <= cStartDate) {
      Alert.alert("Error", "End time must be after start time");
      return;
    }

    const emails = cEmails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    const meetLink = cMeetLink.trim();
    const noteParts: string[] = [];
    if (meetLink) noteParts.push(`Meeting Link: ${meetLink}`);
    if (cNotes.trim()) noteParts.push(cNotes.trim());
    if (emails.length > 0) noteParts.push(`Attendees: ${emails.join(", ")}`);

    try {
      const result = await createEvent({
        title: cTitle.trim(),
        startDate: cStartDate,
        endDate: cEndDate,
        location: meetLink || cLocation.trim() || undefined,
        notes: noteParts.join("\n\n") || undefined,
        attendeeEmails: emails.length > 0 ? emails : undefined,
      });

      setCreateVisible(false);
      showToast("Meeting created!");
      await load();

      if (result.shouldSendInvite && result.inviteParams) {
        setTimeout(() => {
          sendMeetingInviteEmail(result.inviteParams!);
        }, 600);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to create event");
    }
  };

  const handleDeleteEvent = (ev: CalEvent) => {
    Alert.alert("Delete Event", `Remove "${ev.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(ev.id);
            setDetailEvent(null);
            showToast("Event deleted");
            await load();
          } catch {
            Alert.alert("Error", "Could not delete event");
          }
        },
      },
    ]);
  };

  // Time slot calculations
  const eventsByHour = useMemo(() => {
    const map = new Map<number, CalEvent[]>();
    for (const ev of events) {
      if (ev.allDay) continue;
      const h = ev.startDate.getHours();
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(ev);
    }
    return map;
  }, [events]);

  const allDayEvents = useMemo(
    () => events.filter((e) => e.allDay),
    [events]
  );

  const upcomingEvent = useMemo(() => {
    const now = Date.now();
    return events.find((e) => !e.allDay && e.startDate.getTime() > now) ?? null;
  }, [events]);

  /* ================================================================= */
  /* CONNECT SCREEN                                                     */
  /* ================================================================= */
  if (!connected && !loading) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, backgroundColor: c.backgroundSecondary },
        ]}
      >
        <MenuButton />
        <View style={styles.connectWrap}>
          <View style={styles.connectIconWrap}>
            <LinearGradient
              colors={["#5B7553", "#7A9972"]}
              style={styles.connectIcon}
            >
              <Ionicons name="calendar" size={48} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={[styles.connectTitle, { color: c.text }]}>
            Connect Your Calendar
          </Text>
          <Text style={[styles.connectSub, { color: c.textSecondary }]}>
            See all your meetings, events, and schedules in one place.
            We&apos;ll sync with Google Calendar, Outlook, iCloud, and
            any calendar on your device.
          </Text>

          <View style={styles.connectFeatures}>
            {[
              { icon: "sync-outline", text: "Auto-sync today's events" },
              { icon: "notifications-outline", text: "Meeting reminders" },
              { icon: "time-outline", text: "Beautiful timeline view" },
              { icon: "people-outline", text: "Schedule & invite attendees" },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name={f.icon as any} size={20} color={c.primary} />
                <Text style={[styles.featureText, { color: c.text }]}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleConnect}>
            <LinearGradient
              colors={["#5B7553", "#7A9972"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectBtn}
            >
              <Ionicons name="link-outline" size={20} color="#fff" />
              <Text style={styles.connectBtnText}>Connect Calendar</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[styles.connectNote, { color: c.textMuted }]}>
            This accesses calendars already on your device.{"\n"}
            No passwords shared with this app.
          </Text>
        </View>
      </View>
    );
  }

  /* ================================================================= */
  /* MAIN CALENDAR VIEW                                                 */
  /* ================================================================= */
  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: c.backgroundSecondary },
      ]}
    >
      <MenuButton />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingLeft: 42 }}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Calendar</Text>
          <Text style={[styles.headerSub, { color: c.textSecondary }]}>
            {events.length} event{events.length !== 1 ? "s" : ""} today
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setSettingsVisible(true)}
          style={styles.headerBtn}
        >
          <Ionicons name="settings-outline" size={20} color={c.iconMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={load}
          style={styles.headerBtn}
        >
          <Ionicons name="refresh-outline" size={20} color={c.iconMuted} />
        </TouchableOpacity>
      </View>

      {/* Upcoming banner */}
      {upcomingEvent && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setDetailEvent(upcomingEvent)}
          style={styles.upcomingBanner}
        >
          <LinearGradient
            colors={["#5B7553", "#7A9972"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.upcomingGrad}
          >
            <View style={styles.upcomingLeft}>
              <Text style={styles.upcomingLabel}>UP NEXT</Text>
              <Text style={styles.upcomingTitle} numberOfLines={1}>
                {upcomingEvent.title}
              </Text>
            </View>
            <View style={styles.upcomingRight}>
              <Text style={styles.upcomingTime}>
                {formatEventTime(upcomingEvent.startDate)}
              </Text>
              <Text style={styles.upcomingDur}>
                {getEventDuration(upcomingEvent.startDate, upcomingEvent.endDate)}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <View style={styles.allDayWrap}>
          <Text style={styles.allDayLabel}>ALL DAY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {allDayEvents.map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  activeOpacity={0.8}
                  onPress={() => setDetailEvent(ev)}
                  style={[
                    styles.allDayChip,
                    { borderLeftColor: ev.calendarColor ?? c.primary },
                  ]}
                >
                  <Text style={styles.allDayChipText} numberOfLines={1}>
                    {ev.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Timeline */}
      <ScrollView
        ref={scrollRef}
        style={styles.timeline}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {HOURS.map((hour) => {
          const hourEvents = eventsByHour.get(hour) || [];
          const isPast = new Date().getHours() > hour;
          const isCurrent = new Date().getHours() === hour;
          const label =
            hour === 0
              ? "12 AM"
              : hour < 12
              ? `${hour} AM`
              : hour === 12
              ? "12 PM"
              : `${hour - 12} PM`;

          return (
            <View key={hour} style={styles.hourRow}>
              <Text
                style={[
                  styles.hourLabel,
                  isCurrent && { color: c.primary, fontWeight: "800" },
                  isPast && { opacity: 0.4 },
                ]}
              >
                {label}
              </Text>
              <View style={styles.hourContent}>
                <View
                  style={[
                    styles.hourLine,
                    isCurrent && { backgroundColor: c.primary },
                  ]}
                />
                {isCurrent && <View style={styles.currentDot} />}
                {hourEvents.map((ev) => (
                  <TouchableOpacity
                    key={ev.id}
                    activeOpacity={0.85}
                    onPress={() => setDetailEvent(ev)}
                    style={[
                      styles.eventCard,
                      { borderLeftColor: ev.calendarColor ?? c.primary },
                    ]}
                  >
                    <View style={styles.eventCardTop}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {ev.title}
                      </Text>
                      <Text style={styles.eventTime}>
                        {formatEventTime(ev.startDate)} -{" "}
                        {formatEventTime(ev.endDate)}
                      </Text>
                    </View>
                    {ev.location ? (
                      <View style={styles.eventMeta}>
                        <Ionicons name="location-outline" size={12} color={c.iconMuted} />
                        <Text style={styles.eventMetaText} numberOfLines={1}>
                          {ev.location}
                        </Text>
                      </View>
                    ) : null}
                    {(ev.attendees?.length ?? 0) > 0 && (
                      <View style={styles.eventMeta}>
                        <Ionicons name="people-outline" size={12} color={c.iconMuted} />
                        <Text style={styles.eventMetaText}>
                          {ev.attendees!.length} attendee
                          {ev.attendees!.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={openCreate}
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
      >
        <LinearGradient colors={["#5B7553", "#7A9972"]} style={styles.fabGrad}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Toast */}
      {toastMsg !== "" && (
        <Animated.View
          style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 90 }]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* ─── CREATE MEETING MODAL ─────────────── */}
      <Modal visible={createVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Meeting</Text>
                  <Pressable onPress={() => setCreateVisible(false)}>
                    <Ionicons name="close" size={24} color={c.iconMuted} />
                  </Pressable>
                </View>

                <TextInput
                  style={styles.modalInput}
                  placeholder="Meeting title"
                  placeholderTextColor={c.placeholder}
                  value={cTitle}
                  onChangeText={setCTitle}
                />

                {/* Date */}
                <Text style={styles.fieldLabel}>
                  <Ionicons name="calendar-outline" size={13} color={c.textSecondary} /> Date
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowDatePicker(true);
                    setShowStartPicker(false);
                    setShowEndPicker(false);
                  }}
                  style={styles.timeBtn}
                >
                  <Text style={styles.timeBtnText}>
                    {cStartDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={c.primary} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={cStartDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={new Date()}
                    onChange={(event, d) => {
                      if (event.type === "dismissed" || !d) {
                        setShowDatePicker(false);
                        return;
                      }
                      if (Platform.OS === "android") setShowDatePicker(false);
                      const newStart = new Date(cStartDate);
                      newStart.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setCStartDate(newStart);
                      const newEnd = new Date(cEndDate);
                      newEnd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      if (newEnd <= newStart)
                        newEnd.setTime(newStart.getTime() + 3600000);
                      setCEndDate(newEnd);
                    }}
                  />
                )}

                {/* Start time */}
                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="time-outline" size={13} color={c.textSecondary} /> Start
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowStartPicker(true);
                        setShowEndPicker(false);
                        setShowDatePicker(false);
                      }}
                      style={styles.timeBtn}
                    >
                      <Text style={styles.timeBtnText}>
                        {cStartDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={c.primary} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>
                      <Ionicons name="time-outline" size={13} color={c.textSecondary} /> End
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowEndPicker(true);
                        setShowStartPicker(false);
                        setShowDatePicker(false);
                      }}
                      style={styles.timeBtn}
                    >
                      <Text style={styles.timeBtnText}>
                        {cEndDate.toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={c.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
                {showStartPicker && (
                  <DateTimePicker
                    value={cStartDate}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={(event, d) => {
                      if (event.type === "dismissed" || !d) {
                        setShowStartPicker(false);
                        return;
                      }
                      if (Platform.OS === "android") setShowStartPicker(false);
                      const selected = new Date(cStartDate);
                      selected.setHours(d.getHours(), d.getMinutes(), 0, 0);
                      setCStartDate(selected);
                      if (selected >= cEndDate)
                        setCEndDate(new Date(selected.getTime() + 3600000));
                    }}
                  />
                )}
                {showEndPicker && (
                  <DateTimePicker
                    value={cEndDate}
                    mode="time"
                    is24Hour={false}
                    display="spinner"
                    onChange={(event, d) => {
                      if (event.type === "dismissed" || !d) {
                        setShowEndPicker(false);
                        return;
                      }
                      if (Platform.OS === "android") setShowEndPicker(false);
                      const selected = new Date(cEndDate);
                      selected.setHours(d.getHours(), d.getMinutes(), 0, 0);
                      setCEndDate(selected);
                    }}
                  />
                )}

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                  <Ionicons name="videocam-outline" size={13} color={c.textSecondary} />{" "}
                  Video Meeting
                </Text>
                {cMeetLink ? (
                  <View style={styles.meetLinkWrap}>
                    <View style={styles.meetLinkBadge}>
                      <Ionicons name="videocam" size={16} color={c.primary} />
                      <Text style={styles.meetLinkUrl} numberOfLines={1}>
                        {cMeetLink}
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setCMeetLink("")}
                      style={styles.meetLinkRemove}
                    >
                      <Ionicons name="close-circle" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.meetBtnRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        const id = `uniflow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
                        setCMeetLink(`https://meet.jit.si/${id}`);
                      }}
                      style={styles.generateBtn}
                    >
                      <LinearGradient
                        colors={["#5B7553", "#7A9972"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.generateBtnGrad}
                      >
                        <Ionicons name="videocam" size={16} color="#fff" />
                        <Text style={styles.generateBtnText}>
                          Generate Link
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowPasteInput(true)}
                      style={styles.pasteBtn}
                    >
                      <Ionicons name="link-outline" size={16} color={c.primary} />
                      <Text style={styles.pasteBtnText}>Paste Own</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!cMeetLink && showPasteInput && (
                  <TextInput
                    style={[styles.modalInput, { marginTop: 8 }]}
                    placeholder="https://zoom.us/j/... or meet.google.com/..."
                    placeholderTextColor={c.placeholder}
                    value={cMeetLink}
                    onChangeText={setCMeetLink}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoFocus
                  />
                )}
                <Text style={styles.fieldHint}>
                  Generate a free video call link instantly, or paste your own
                  Zoom/Meet/Teams URL.
                </Text>

                <TextInput
                  style={[styles.modalInput, { marginTop: 12 }]}
                  placeholder="Location (optional)"
                  placeholderTextColor={c.placeholder}
                  value={cLocation}
                  onChangeText={setCLocation}
                />

                <TextInput
                  style={[styles.modalInput, { marginTop: 10, minHeight: 60 }]}
                  placeholder="Notes (optional)"
                  placeholderTextColor={c.placeholder}
                  value={cNotes}
                  onChangeText={setCNotes}
                  multiline
                />

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                  <Ionicons name="mail-outline" size={13} color={c.textSecondary} /> Invite
                  Attendees
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="email1@example.com, email2@example.com"
                  placeholderTextColor={c.placeholder}
                  value={cEmails}
                  onChangeText={setCEmails}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Text style={styles.fieldHint}>
                  Separate multiple emails with commas. They&apos;ll receive an
                  invite via your default calendar account.
                </Text>

                <TouchableOpacity activeOpacity={0.85} onPress={handleCreateEvent}>
                  <LinearGradient
                    colors={["#5B7553", "#7A9972"]}
                    style={styles.createBtn}
                  >
                    <Ionicons name="calendar-outline" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>Create Meeting</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── EVENT DETAIL MODAL ─────────────── */}
      <Modal
        visible={detailEvent !== null}
        animationType="slide"
        transparent
      >
        {detailEvent && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View
                  style={[
                    styles.detailColorDot,
                    { backgroundColor: detailEvent.calendarColor },
                  ]}
                />
                <Text style={[styles.modalTitle, { flex: 1 }]} numberOfLines={2}>
                  {detailEvent.title}
                </Text>
                <Pressable onPress={() => setDetailEvent(null)}>
                  <Ionicons name="close" size={24} color={c.iconMuted} />
                </Pressable>
              </View>

              <View style={styles.detailSection}>
                <Ionicons name="time-outline" size={18} color={c.primary} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  {detailEvent.allDay ? (
                    <Text style={styles.detailText}>All Day</Text>
                  ) : (
                    <>
                      <Text style={styles.detailText}>
                        {formatEventTime(detailEvent.startDate)} -{" "}
                        {formatEventTime(detailEvent.endDate)}
                      </Text>
                      <Text style={styles.detailSub}>
                        {getEventDuration(detailEvent.startDate, detailEvent.endDate)}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {detailEvent.location ? (() => {
                const loc = detailEvent.location!;
                const isLink = loc.startsWith("http");
                const isMeet =
                  loc.includes("zoom.us") ||
                  loc.includes("meet.google") ||
                  loc.includes("teams.microsoft") ||
                  loc.includes("meet.jit.si");
                return (
                  <TouchableOpacity
                    activeOpacity={isLink ? 0.6 : 1}
                    onPress={() => { if (isLink) Linking.openURL(loc); }}
                    style={styles.detailSection}
                  >
                    <Ionicons
                      name={isMeet ? "videocam-outline" : "location-outline"}
                      size={18}
                      color={c.primary}
                    />
                    <Text
                      style={[
                        styles.detailText,
                        { flex: 1, marginLeft: 12 },
                        isLink && { color: c.primary, textDecorationLine: "underline" as const },
                      ]}
                    >
                      {isMeet ? "Join Video Call" : loc}
                    </Text>
                    {isLink && (
                      <Ionicons name="open-outline" size={14} color={c.primary} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                );
              })() : null}

              {detailEvent.calendarTitle ? (
                <View style={styles.detailSection}>
                  <Ionicons name="calendar-outline" size={18} color={c.primary} />
                  <Text style={[styles.detailText, { flex: 1, marginLeft: 12 }]}>
                    {detailEvent.calendarTitle}
                  </Text>
                </View>
              ) : null}

              {(detailEvent.attendees?.length ?? 0) > 0 && (
                <View style={styles.detailSection}>
                  <Ionicons name="people-outline" size={18} color={c.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.detailText}>
                      {detailEvent.attendees!.length} Attendee
                      {detailEvent.attendees!.length !== 1 ? "s" : ""}
                    </Text>
                    {detailEvent.attendees!.slice(0, 5).map(
                      (a: CalAttendee, i: number) => (
                        <Text key={i} style={styles.detailSub}>
                          {a.name || a.email || "Unknown"}
                          {a.status ? ` (${a.status})` : ""}
                        </Text>
                      )
                    )}
                  </View>
                </View>
              )}

              {detailEvent.notes ? (
                <View style={styles.detailSection}>
                  <Ionicons name="document-text-outline" size={18} color={c.primary} />
                  <Text
                    style={[styles.detailText, { flex: 1, marginLeft: 12 }]}
                    numberOfLines={6}
                  >
                    {detailEvent.notes}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleDeleteEvent(detailEvent)}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Delete Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* ─── SETTINGS MODAL ─────────────── */}
      <Modal visible={settingsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Calendar Settings</Text>
                <Pressable onPress={() => setSettingsVisible(false)}>
                  <Ionicons name="close" size={24} color={c.iconMuted} />
                </Pressable>
              </View>

              <Text style={styles.settingsLabel}>Your Calendars</Text>
              <Text style={styles.settingsSub}>
                Toggle which calendars to show (Google, Outlook, iCloud, etc.)
              </Text>
              {calendars.map((cal) => (
                <View key={cal.id} style={styles.calRow}>
                  <View
                    style={[styles.calDot, { backgroundColor: cal.color }]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calName}>{cal.title}</Text>
                    <Text style={styles.calSource}>
                      {cal.source}
                      {!cal.writable ? "  (read-only)" : ""}
                    </Text>
                  </View>
                  <Switch
                    value={cal.selected}
                    onValueChange={() => toggleCalendar(cal.id)}
                    trackColor={{ false: c.border, true: c.primarySoftBg }}
                    thumbColor={cal.selected ? c.primary : c.textMuted}
                  />
                </View>
              ))}

              <Text style={[styles.settingsLabel, { marginTop: 20 }]}>
                Reminder
              </Text>
              <Text style={styles.settingsSub}>
                Notify before meetings start
              </Text>
              <View style={styles.reminderRow}>
                {REMINDER_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    activeOpacity={0.8}
                    onPress={() => handleSaveReminder(m)}
                    style={[
                      styles.reminderChip,
                      reminderMins === m && styles.reminderChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reminderChipText,
                        reminderMins === m && styles.reminderChipTextActive,
                      ]}
                    >
                      {m} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleDisconnect}
                style={styles.disconnectBtn}
              >
                <Ionicons name="unlink-outline" size={18} color="#ef4444" />
                <Text style={styles.disconnectText}>Disconnect Calendar</Text>
              </TouchableOpacity>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

function createCalendarStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.backgroundSecondary },
    /* ── Connect ── */
    connectWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    connectIconWrap: { marginBottom: 28 },
    connectIcon: {
      width: 100,
      height: 100,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    connectTitle: {
      fontSize: 26,
      fontWeight: "900",
      color: c.text,
      textAlign: "center",
      marginBottom: 12,
    },
    connectSub: {
      fontSize: 15,
      fontWeight: "500",
      color: c.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
    },
    connectFeatures: { width: "100%", marginBottom: 32 },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    featureText: { fontSize: 14, fontWeight: "600", color: c.text },
    connectBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      paddingHorizontal: 40,
      borderRadius: 16,
    },
    connectBtnText: { fontSize: 17, fontWeight: "800", color: "#fff" },
    connectNote: {
      fontSize: 12,
      fontWeight: "500",
      color: c.textMuted,
      textAlign: "center",
      marginTop: 16,
      lineHeight: 18,
    },
    /* ── Header ── */
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: "900", color: c.text },
    headerSub: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 2,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    /* ── Upcoming ── */
    upcomingBanner: { marginHorizontal: 16, marginBottom: 12 },
    upcomingGrad: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 16,
      padding: 16,
    },
    upcomingLeft: { flex: 1, paddingRight: 12 },
    upcomingLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: "rgba(255,255,255,0.6)",
      letterSpacing: 1,
      marginBottom: 4,
    },
    upcomingTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
    upcomingRight: { alignItems: "flex-end" },
    upcomingTime: { fontSize: 18, fontWeight: "900", color: "#fff" },
    upcomingDur: {
      fontSize: 12,
      fontWeight: "600",
      color: "rgba(255,255,255,0.7)",
      marginTop: 2,
    },
    /* ── All-day ── */
    allDayWrap: { paddingHorizontal: 16, marginBottom: 12 },
    allDayLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textSecondary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    allDayChip: {
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderLeftWidth: 3,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: c.border,
      borderRightColor: c.border,
      borderBottomColor: c.border,
    },
    allDayChipText: { fontSize: 13, fontWeight: "700", color: c.text },
    /* ── Timeline ── */
    timeline: { flex: 1 },
    hourRow: {
      flexDirection: "row",
      height: HOUR_HEIGHT,
      paddingHorizontal: 16,
    },
    hourLabel: {
      width: 52,
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
      textAlign: "right",
      paddingRight: 12,
      paddingTop: 2,
    },
    hourContent: {
      flex: 1,
      borderTopWidth: 1,
      borderTopColor: c.border,
      position: "relative",
    },
    hourLine: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: c.border,
    },
    currentDot: {
      position: "absolute",
      top: -4,
      left: -4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.primary,
    },
    eventCard: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderLeftWidth: 3,
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderTopColor: c.border,
      borderRightColor: c.border,
      borderBottomColor: c.border,
      padding: 12,
      marginTop: 4,
      marginRight: 4,
    },
    eventCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    eventTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      color: c.text,
      marginRight: 8,
    },
    eventTime: { fontSize: 11, fontWeight: "600", color: c.textSecondary },
    eventMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 4,
    },
    eventMetaText: { fontSize: 11, fontWeight: "500", color: c.textSecondary },
    /* ── FAB ── */
    fab: { position: "absolute", right: 24, zIndex: 10 },
    fabGrad: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    /* ── Toast ── */
    toast: {
      position: "absolute",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#22c55e",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    toastText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    /* ── Modal ── */
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      maxHeight: "88%",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    modalTitle: { fontSize: 20, fontWeight: "800", color: c.text },
    modalInput: {
      backgroundColor: c.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textSecondary,
      marginTop: 14,
      marginBottom: 6,
    },
    fieldHint: {
      fontSize: 11,
      fontWeight: "500",
      color: c.textMuted,
      marginTop: 4,
      lineHeight: 16,
    },
    meetLinkWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.primarySoftBg,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.primarySoftBg,
      padding: 10,
      gap: 8,
    },
    meetLinkBadge: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    meetLinkUrl: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: c.primary,
    },
    meetLinkRemove: { padding: 2 },
    meetBtnRow: {
      flexDirection: "row",
      gap: 10,
    },
    generateBtn: { flex: 1 },
    generateBtnGrad: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
    },
    generateBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    pasteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.primarySoftBg,
      backgroundColor: c.primarySoftBg,
    },
    pasteBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.primary,
    },
    timeRow: {
      flexDirection: "row",
      gap: 10,
    },
    timeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.backgroundSecondary,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    timeBtnText: { fontSize: 15, fontWeight: "700", color: c.text },
    createBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      borderRadius: 14,
      marginTop: 20,
    },
    createBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
    /* ── Detail ── */
    detailColorDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      marginRight: 10,
    },
    detailSection: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceMuted,
    },
    detailText: { fontSize: 15, fontWeight: "700", color: c.text },
    detailSub: { fontSize: 13, fontWeight: "500", color: c.textMuted, marginTop: 2 },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 20,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.dangerSoftBorder,
      backgroundColor: c.dangerSoftBg,
    },
    deleteBtnText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
    /* ── Settings ── */
    settingsLabel: {
      fontSize: 16,
      fontWeight: "800",
      color: c.text,
      marginBottom: 4,
    },
    settingsSub: { fontSize: 13, fontWeight: "500", color: c.textMuted, marginBottom: 12 },
    calRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 12,
    },
    calDot: { width: 12, height: 12, borderRadius: 6 },
    calName: { fontSize: 14, fontWeight: "700", color: c.text },
    calSource: { fontSize: 12, fontWeight: "500", color: c.textMuted },
    reminderRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    reminderChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.surfaceMuted,
    },
    reminderChipActive: { backgroundColor: c.primary },
    reminderChipText: { fontSize: 13, fontWeight: "700", color: c.textSecondary },
    reminderChipTextActive: { color: "#fff" },
    disconnectBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.dangerSoftBorder,
      backgroundColor: c.dangerSoftBg,
    },
    disconnectText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
  });
}

export default CalendarScreen;

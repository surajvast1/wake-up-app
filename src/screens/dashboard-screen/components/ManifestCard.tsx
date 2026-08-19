import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Keyboard,
  ScrollView,
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppTheme } from "../../../contexts/ThemeContext";
import HomeDashboardGradientCard from "../../../components/HomeDashboardGradientCard";
import {
  getHomeDashboardCardAccent,
  getHomeDashboardCardText,
  homeCardIconBubbleBg,
} from "../../../theme/homeDashboardCardTheme";
import {
  getTodayManifest,
  saveTodayManifest,
} from "../../../services/manifestService";

const MAX_LEN = 2000;
const { height: SCREEN_H } = Dimensions.get("window");

/** In-card scroll so huge entries don’t swallow the whole dashboard. */
const MANIFEST_PREVIEW_MAX_H = 360;

const MANIFEST_BODY_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: undefined,
});

/** Sheet grows to this fraction of screen when keyboard is hidden. */
const EXPANDED_FRACTION = 0.82;
/** Sheet shrinks to this fraction when keyboard is showing (above the keyboard). */
const COMPACT_FRACTION = 0.55;

const PROMPT_CHIPS: { label: string; snippet: string }[] = [
  { label: "Gratitude", snippet: "I'm grateful for " },
  { label: "Intention", snippet: "Today I intend to " },
  { label: "Feeling", snippet: "I want to feel " },
  { label: "Let go", snippet: "I'm releasing " },
];

const BULLET_PREFIX = "• ";

/** Strip a leading bullet / dash so we don’t show duplicate markers in preview. */
function stripLeadingBulletToken(line: string): string {
  return line.replace(/^\s*[•·\-\*]\s*/, "").trimEnd();
}

/** Lines for preview: keep structure; blank lines become small gaps. */
function manifestLinesForPreview(raw: string): { key: string; text: string | null }[] {
  if (!raw.trim()) return [];
  return raw.split(/\r?\n/).map((line, i) => ({
    key: `ln-${i}`,
    text: line.trim().length === 0 ? null : stripLeadingBulletToken(line),
  }));
}

const ManifestCard: React.FC = () => {
  const { storageScope } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const accent = useMemo(
    () => getHomeDashboardCardAccent("manifest", isDark),
    [isDark]
  );
  const txt = useMemo(() => getHomeDashboardCardText(isDark), [isDark]);

  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  /** Return inserts “• ” on the next line when typing. */
  const [bulletAuto, setBulletAuto] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef("");
  const selectionRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const sheetHeight = useSharedValue(SCREEN_H * EXPANDED_FRACTION);
  const sheetBottom = useSharedValue(0);

  const chipBg = isDark ? "rgba(249,115,22,0.22)" : "rgba(154, 52, 18, 0.12)";
  const chipBorder = isDark
    ? "rgba(249,115,22,0.45)"
    : "rgba(154, 52, 18, 0.26)";

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const entry = await getTodayManifest(storageScope);
        if (!alive) return;
        if (entry) {
          setContent(entry.content);
          setSaved(true);
        } else {
          setContent("");
          setSaved(false);
        }
        setLoaded(true);
      })();
      return () => {
        alive = false;
      };
    }, [storageScope])
  );

  /** Animate the sheet in response to the keyboard. */
  useEffect(() => {
    if (!editing) return;
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const duration = Platform.OS === "ios" ? 260 : 220;
    const easing = Easing.out(Easing.cubic);

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const kbH = e.endCoordinates?.height ?? 0;
      sheetBottom.value = withTiming(kbH, { duration, easing });
      sheetHeight.value = withTiming(SCREEN_H * COMPACT_FRACTION, {
        duration,
        easing,
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      sheetBottom.value = withTiming(0, { duration, easing });
      sheetHeight.value = withTiming(SCREEN_H * EXPANDED_FRACTION, {
        duration,
        easing,
      });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [editing, sheetBottom, sheetHeight]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const handleSave = useCallback(
    async (text: string) => {
      await saveTodayManifest(storageScope, text);
      setSaved(true);
    },
    [storageScope]
  );

  const onChangeText = useCallback(
    (text: string) => {
      let next = text.length > MAX_LEN ? text.slice(0, MAX_LEN) : text;
      const prev = contentRef.current;
      if (
        bulletAuto &&
        next.length > prev.length &&
        next.endsWith("\n") &&
        !next.endsWith(`\n${BULLET_PREFIX}`)
      ) {
        next = (next + BULLET_PREFIX).slice(0, MAX_LEN);
      }
      contentRef.current = next;
      setContent(next);
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (next.trim().length > 0) void handleSave(next);
      }, 800);
    },
    [bulletAuto, handleSave]
  );

  const closeEditor = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (content.trim().length > 0) void handleSave(content);
    Keyboard.dismiss();
    setEditing(false);
  }, [content, handleSave]);

  const openEditor = useCallback(() => {
    /* Reset sheet to expanded until keyboard fires "show". */
    sheetHeight.value = SCREEN_H * EXPANDED_FRACTION;
    sheetBottom.value = 0;
    setEditing(true);
  }, [sheetBottom, sheetHeight]);

  const appendSnippet = useCallback(
    (snippet: string) => {
      setContent((prev) => {
        const base = prev.trim();
        const block = bulletAuto ? `${BULLET_PREFIX}${snippet}` : snippet;
        const next =
          base.length === 0 ? block : `${prev.replace(/\s+$/, "")}\n${block}`;
        setSaved(false);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          if (next.trim().length > 0) void handleSave(next);
        }, 800);
        return next.length > MAX_LEN ? next.slice(0, MAX_LEN) : next;
      });
      setTimeout(() => inputRef.current?.focus(), 30);
    },
    [bulletAuto, handleSave]
  );

  const insertBulletLineAtCaret = useCallback(() => {
    setContent((prev) => {
      const { start, end } = selectionRef.current;
      const lo = Math.min(Math.max(0, start), prev.length);
      const hi = Math.max(Math.min(end, prev.length), lo);
      const before = prev.slice(0, lo);
      const after = prev.slice(hi);
      const insert =
        before.length > 0 && !before.endsWith("\n")
          ? `\n${BULLET_PREFIX}`
          : BULLET_PREFIX;
      const next = (before + insert + after).slice(0, MAX_LEN);
      contentRef.current = next;
      setSaved(false);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (next.trim().length > 0) void handleSave(next);
      }, 800);
      return next;
    });
  }, [handleSave]);

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
    bottom: sheetBottom.value,
  }));

  if (!loaded) return null;

  const hasContent = content.trim().length > 0;
  const h = new Date().getHours();
  const timeLabel = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const remaining = MAX_LEN - content.length;

  const sheetBg = isDark ? "#17110B" : "#FFFAF5";
  const sheetBorder = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(154, 52, 18, 0.14)";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF";
  const inputBorder = isDark
    ? "rgba(255,255,255,0.12)"
    : "rgba(154, 52, 18, 0.18)";

  return (
    <View style={styles.section}>
      {/* Compact card on the homepage */}
      <Pressable
        onPress={openEditor}
        style={({ pressed }) => [
          styles.press,
          pressed && styles.pressPressed,
        ]}
      >
        <HomeDashboardGradientCard variant="manifest">
          <View style={styles.cardInner}>
            <View style={styles.topRow}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: homeCardIconBubbleBg(accent, isDark) },
                ]}
              >
                <Ionicons name="sparkles-outline" size={20} color={accent} />
              </View>
              <View style={styles.topRowText}>
                <Text style={[styles.kicker, { color: accent }]}>
                  {hasContent ? "Today you wrote" : `This ${timeLabel}`}
                </Text>
                <Text style={[styles.title, { color: txt.title }]}>
                  {hasContent ? "Your manifest" : "Start your manifest"}
                </Text>
              </View>
              <View style={styles.rightCol}>
                {saved && hasContent ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={17}
                    color={isDark ? "#86EFAC" : "#166534"}
                    style={styles.checkIcon}
                  />
                ) : null}
                <View
                  style={[
                    styles.editPill,
                    {
                      borderColor: isDark
                        ? "rgba(249,115,22,0.45)"
                        : "rgba(154, 52, 18, 0.35)",
                      backgroundColor: isDark
                        ? "rgba(249,115,22,0.12)"
                        : "rgba(255,255,255,0.75)",
                    },
                  ]}
                >
                  <Ionicons name="create-outline" size={14} color={accent} />
                </View>
              </View>
            </View>

            <LinearGradient
              colors={
                isDark
                  ? (["rgba(249,115,22,0.35)", "rgba(249,115,22,0)"] as const)
                  : (["rgba(154, 52, 18, 0.28)", "rgba(154, 52, 18, 0)"] as const)
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dividerFade}
            />

            {hasContent ? (
              <View
                style={[
                  styles.manifestPaper,
                  {
                    backgroundColor: isDark
                      ? "rgba(0,0,0,0.22)"
                      : "rgba(255,255,255,0.55)",
                    borderColor: isDark
                      ? "rgba(255,255,255,0.09)"
                      : "rgba(154, 52, 18, 0.12)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.watermarkQuote,
                    { color: accent },
                  ]}
                  pointerEvents="none"
                >
                  “
                </Text>
                <ScrollView
                  style={styles.manifestScroll}
                  contentContainerStyle={styles.manifestScrollContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {manifestLinesForPreview(content).map(({ key, text: line }) =>
                    line === null ? (
                      <View key={key} style={styles.previewLineSpacer} />
                    ) : (
                      <View key={key} style={styles.bulletRow}>
                        <Text
                          style={[styles.bulletGlyph, { color: accent }]}
                          selectable
                        >
                          •
                        </Text>
                        <Text
                          style={[
                            styles.manifestBody,
                            {
                              color: txt.title,
                              fontFamily: MANIFEST_BODY_FONT,
                            },
                          ]}
                          selectable
                        >
                          {line}
                        </Text>
                      </View>
                    )
                  )}
                </ScrollView>
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    isDark
                      ? (["transparent", "rgba(0,0,0,0.35)"] as const)
                      : (["transparent", "rgba(255,255,255,0.85)"] as const)
                  }
                  style={styles.manifestBottomFade}
                />
              </View>
            ) : (
              <View style={styles.emptyCallout}>
                <Text style={[styles.emptyLead, { color: txt.title }]}>
                  What do you want today to feel like?
                </Text>
                <Text style={[styles.sub, { color: txt.subtitle }]}>
                  Intentions, gratitude, or a few honest lines — tap to write;
                  it saves as you go.
                </Text>
              </View>
            )}

          </View>
        </HomeDashboardGradientCard>
      </Pressable>

      {/* Bottom sheet editor */}
      <Modal
        visible={editing}
        animationType="fade"
        transparent
        onRequestClose={closeEditor}
        statusBarTranslucent
      >
        <View style={styles.backdrop}>
          <Pressable
            style={styles.backdropDismiss}
            onPress={closeEditor}
            accessibilityLabel="Close manifest editor"
          />
          <Animated.View
            style={[
              styles.sheet,
              sheetStyle,
              { backgroundColor: sheetBg, borderColor: sheetBorder },
            ]}
          >
            {/* Grabber */}
            <View style={styles.grabberWrap}>
              <View
                style={[
                  styles.grabber,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.22)"
                      : "rgba(0,0,0,0.18)",
                  },
                ]}
              />
            </View>

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Pressable
                onPress={closeEditor}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.05)",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="close" size={20} color={txt.title} />
              </Pressable>
              <View style={styles.sheetHeaderCopy}>
                <Text style={[styles.sheetKicker, { color: accent }]}>
                  {`Today · ${timeLabel}`}
                </Text>
                <Text style={[styles.sheetTitle, { color: txt.title }]}>
                  Daily manifest
                </Text>
              </View>
              <Pressable
                onPress={closeEditor}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.doneBtnHeader,
                  { backgroundColor: accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                <Text style={styles.doneBtnHeaderText}>Done</Text>
              </Pressable>
            </View>

            {/* Starters */}
            <View style={styles.chipsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
                keyboardShouldPersistTaps="handled"
              >
                {PROMPT_CHIPS.map((p) => (
                  <Pressable
                    key={p.label}
                    onPress={() => appendSnippet(p.snippet)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        backgroundColor: chipBg,
                        borderColor: chipBorder,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: accent }]}>
                      + {p.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.editorToolbar}>
              <Pressable
                onPress={() => setBulletAuto((v) => !v)}
                style={({ pressed }) => [
                  styles.editorToolBtn,
                  {
                    borderColor: isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(154, 52, 18, 0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.5)",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  bulletAuto
                    ? "Turn off automatic bullets on new line"
                    : "Turn on automatic bullets on new line"
                }
              >
                <Ionicons
                  name={bulletAuto ? "list" : "list-outline"}
                  size={18}
                  color={bulletAuto ? accent : txt.subtitle}
                />
                <Text
                  style={[
                    styles.editorToolLabel,
                    { color: bulletAuto ? accent : txt.subtitle },
                  ]}
                >
                  Auto bullets {bulletAuto ? "on" : "off"}
                </Text>
              </Pressable>
              <Pressable
                onPress={insertBulletLineAtCaret}
                style={({ pressed }) => [
                  styles.editorToolBtn,
                  {
                    borderColor: isDark
                      ? "rgba(255,255,255,0.12)"
                      : "rgba(154, 52, 18, 0.2)",
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.5)",
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Insert new bullet line"
              >
                <Ionicons name="return-down-forward-outline" size={18} color={accent} />
                <Text style={[styles.editorToolLabel, { color: txt.title }]}>
                  New bullet
                </Text>
              </Pressable>
            </View>

            {/* Input fills whatever room is left */}
            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                value={content}
                onChangeText={onChangeText}
                onSelectionChange={(e) => {
                  selectionRef.current = e.nativeEvent.selection;
                }}
                placeholder={
                  bulletAuto
                    ? "Type a thought — Return adds the next • bullet. Turn off Auto bullets for plain paragraphs."
                    : 'Plain text — no automatic bullets. Use "New bullet" to add a list line.'
                }
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.input,
                  {
                    color: txt.title,
                    backgroundColor: inputBg,
                    borderColor: inputBorder,
                    fontFamily: MANIFEST_BODY_FONT,
                  },
                ]}
                multiline
                textAlignVertical="top"
                maxLength={MAX_LEN}
                autoFocus
              />
            </View>

            {/* Footer pinned at bottom of sheet */}
            <View
              style={[
                styles.footer,
                {
                  borderTopColor: sheetBorder,
                  paddingBottom: sheetBottomPad(insets.bottom),
                },
              ]}
            >
              <View style={styles.footerLeft}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: saved
                        ? isDark
                          ? "#86EFAC"
                          : "#16A34A"
                        : content.trim().length > 0
                          ? "#F59E0B"
                          : "transparent",
                      borderWidth: content.trim().length === 0 ? 1 : 0,
                      borderColor: isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.15)",
                    },
                  ]}
                />
                <Text style={[styles.footerStatus, { color: txt.subtitle }]}>
                  {saved
                    ? "Saved"
                    : content.trim().length > 0
                      ? "Saving…"
                      : "Not started"}
                </Text>
              </View>
              <Text
                style={[
                  styles.counter,
                  { color: remaining < 100 ? accent : txt.subtitle },
                ]}
              >
                {remaining} left
              </Text>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

function sheetBottomPad(safeBottom: number): number {
  /* Use a reasonable floor so the footer never touches the sheet edge
   * when there's no safe-area inset (older Androids etc.). */
  return Math.max(safeBottom, 12);
}

const styles = StyleSheet.create({
  section: { marginBottom: 16 },
  press: {
    borderRadius: 22,
    overflow: "hidden",
  },
  pressPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  cardInner: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  topRowText: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  sub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
  rightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkIcon: {},
  editPill: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerFade: {
    height: 2,
    marginTop: 14,
    marginBottom: 2,
    borderRadius: 2,
    opacity: 0.9,
  },
  emptyCallout: {
    marginTop: 14,
    paddingVertical: 4,
  },
  emptyLead: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  manifestPaper: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  watermarkQuote: {
    position: "absolute",
    left: 8,
    top: -6,
    fontSize: 76,
    fontWeight: "300",
    opacity: 0.14,
    lineHeight: 76,
    zIndex: 0,
    fontFamily: MANIFEST_BODY_FONT,
  },
  manifestScroll: {
    maxHeight: MANIFEST_PREVIEW_MAX_H,
    zIndex: 1,
  },
  manifestScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
  },
  manifestBody: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 26,
    letterSpacing: 0.15,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
    paddingRight: 4,
  },
  bulletGlyph: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 26,
    marginTop: 1,
    width: 22,
    textAlign: "center",
  },
  previewLineSpacer: {
    height: 8,
  },
  manifestBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
    zIndex: 2,
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.35,
    textAlign: "center",
    textTransform: "uppercase",
    opacity: 0.85,
  },

  /* ─── Bottom-sheet modal ─── */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  sheetKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  doneBtnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  doneBtnHeaderText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  chipsWrap: { paddingVertical: 6 },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  editorToolbar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
  },
  editorToolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  editorToolLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  inputWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 26,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    textAlignVertical: "top",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footerStatus: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  counter: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});

export default ManifestCard;

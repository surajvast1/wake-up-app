import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  fetchDailyQuote,
  getQuoteTone,
  setQuoteTone,
  clearDailyQuoteCache,
  getQuoteVisualTheme,
  Quote,
  QuoteFetchContext,
} from "../../../services/quoteService";
import {
  isQuoteLiked,
  toggleLikeQuote,
} from "../../../services/likedQuotesService";
import { useAppTheme } from "../../../contexts/ThemeContext";

export interface QuoteSectionProps {
  storageScope: string;
  supabaseUserId: string | null;
  onQuoteReady?: () => void;
}

const QuoteSection: React.FC<QuoteSectionProps> = ({
  storageScope,
  supabaseUserId,
  onQuoteReady,
}) => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [toneVisible, setToneVisible] = useState(false);
  const [toneInput, setToneInput] = useState("");
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [copyErrorToast, setCopyErrorToast] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation<any>();

  const visualTheme = useMemo(
    () => getQuoteVisualTheme(undefined, isDark),
    [isDark]
  );

  const cardShadow = useMemo(
    () =>
      Platform.select({
        ios: {
          shadowColor: visualTheme.shadowColor,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.26 : 0.14,
          shadowRadius: 12,
        },
        android: { elevation: isDark ? 4 : 3 },
        default: {},
      }),
    [visualTheme.shadowColor, isDark]
  );

  const quoteOpacity = useRef(new Animated.Value(1)).current;
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const onQuoteReadyRef = useRef(onQuoteReady);
  onQuoteReadyRef.current = onQuoteReady;

  const fetchCtx = useMemo<QuoteFetchContext>(
    () => ({ storageScope, supabaseUserId }),
    [storageScope, supabaseUserId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsQuoteLoading(true);
      const q = await fetchDailyQuote(false, fetchCtx);
      const t = (await getQuoteTone()) || "";
      if (cancelled) return;
      setToneInput(t);
      setQuote(q);
      setIsQuoteLoading(false);
      onQuoteReadyRef.current?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCtx]);

  /** Re-sync quote when returning to Home (e.g. after quote sources changed — cache cleared there). Skips first mount (initial load handled above). */
  const isFirstDashboardFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstDashboardFocus.current) {
        isFirstDashboardFocus.current = false;
        return undefined;
      }
      let cancelled = false;
      (async () => {
        setIsQuoteLoading(true);
        Animated.timing(quoteOpacity, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }).start();
        try {
          const q = await fetchDailyQuote(false, fetchCtx);
          if (!cancelled) setQuote(q);
        } finally {
          setIsQuoteLoading(false);
          if (!cancelled) {
            Animated.timing(quoteOpacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
          } else {
            quoteOpacity.setValue(1);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [fetchCtx, quoteOpacity])
  );

  useEffect(() => {
    if (!quote?.text || quote.text.length < 2 || !quote?.author) {
      setLiked(false);
      return;
    }
    let alive = true;
    (async () => {
      const v = await isQuoteLiked(
        storageScope,
        quote.text,
        quote.author,
        supabaseUserId
      );
      if (alive) setLiked(v);
    })();
    return () => {
      alive = false;
    };
  }, [quote?.text, quote?.author, storageScope, supabaseUserId]);

  const onCopyQuote = async () => {
    let ok = false;
    try {
      if (quote?.text) {
        const fullText = quote.author
          ? `"${quote.text}" — ${quote.author}`
          : quote.text;
        if (
          typeof navigator !== "undefined" &&
          (navigator as any).clipboard?.writeText
        ) {
          await (navigator as any).clipboard.writeText(fullText);
          ok = true;
        }
        if (!ok) {
          try {
            const m: any = require("expo-clipboard");
            if (m?.setStringAsync) {
              await m.setStringAsync(fullText);
              ok = true;
            }
          } catch {}
        }
        if (!ok) {
          try {
            const rnClip: any = require("@react-native-clipboard/clipboard");
            if (rnClip?.setString) {
              rnClip.setString(fullText);
              ok = true;
            }
          } catch {}
        }
      }
    } catch {}
    setMenuVisible(false);
    if (ok) {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 1200);
    } else {
      setCopyErrorToast(true);
      setTimeout(() => setCopyErrorToast(false), 1500);
    }
  };

  const onToggleLike = useCallback(async () => {
    if (!quote?.text || !quote?.author || likeBusy) return;
    setLikeBusy(true);
    try {
      const next = await toggleLikeQuote(
        storageScope,
        quote,
        supabaseUserId
      );
      setLiked(next);
    } finally {
      setLikeBusy(false);
    }
  }, [quote, likeBusy, storageScope, supabaseUserId]);

  const canLikeByGesture =
    !!quote?.text &&
    quote.text.length >= 2 &&
    !!quote?.author &&
    !isQuoteLoading &&
    !likeBusy;

  const doubleTapLikeGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .enabled(canLikeByGesture)
        .onEnd(() => {
          runOnJS(onToggleLike)();
        }),
    [canLikeByGesture, onToggleLike]
  );

  const onSaveTone = async () => {
    const t = toneInput.trim();
    await setQuoteTone(t);
    setToneVisible(false);
    setIsQuoteLoading(true);
    Animated.timing(quoteOpacity, {
      toValue: 0.3,
      duration: 150,
      useNativeDriver: true,
    }).start();
    await clearDailyQuoteCache();
    const q = await fetchDailyQuote(true, fetchCtx);
    setQuote(q);
    setIsQuoteLoading(false);
    Animated.timing(quoteOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      <View style={styles.section}>
        <View style={[styles.cardOuter, cardShadow]}>
          <LinearGradient
            colors={visualTheme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.card,
              {
                borderColor: visualTheme.borderColor,
              },
            ]}
          >
            <View
              style={[
                styles.accentSide,
                { backgroundColor: visualTheme.shadowColor },
              ]}
            />
            <Pressable
              onPress={onToggleLike}
              disabled={!quote?.text || !quote?.author || isQuoteLoading || likeBusy}
              style={({ pressed }) => [
                styles.quoteLikeBtn,
                pressed && { opacity: 0.75 },
                (!quote?.text || !quote?.author || isQuoteLoading) && { opacity: 0.35 },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={liked ? "Unlike quote" : "Like quote"}
            >
              <Ionicons
                name={liked ? "heart" : "heart-outline"}
                size={18}
                color={liked ? "#e11d48" : visualTheme.quoteColor}
                style={{ opacity: liked ? 1 : 0.42 }}
              />
            </Pressable>

            <Pressable
              onPress={(e) => {
                const { pageX, pageY } = e.nativeEvent;
                setMenuPos({ x: pageX, y: pageY });
                setMenuVisible(true);
              }}
              style={styles.quoteMenuBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name="ellipsis-vertical"
                size={14}
                color={visualTheme.quoteColor}
                style={{ opacity: 0.4 }}
              />
            </Pressable>

            <GestureDetector gesture={doubleTapLikeGesture}>
              <View style={styles.cardBody}>
                <Text
                  style={[
                    styles.kicker,
                    { color: visualTheme.authorColor },
                  ]}
                >
                  Quote of the Day
                </Text>
                <Animated.View style={{ opacity: quoteOpacity }}>
                  <Text
                    style={[
                      styles.quoteText,
                      { color: visualTheme.quoteColor },
                    ]}
                  >
                    {quote?.text || "..."}
                  </Text>
                  {quote?.author ? (
                    <View style={styles.authorRow}>
                      <Text
                        style={[
                          styles.quoteAuthor,
                          { color: visualTheme.authorColor },
                        ]}
                        numberOfLines={2}
                      >
                        — {quote.author}
                      </Text>
                    </View>
                  ) : null}
                </Animated.View>
              </View>
            </GestureDetector>

            {isQuoteLoading && (
              <View
                style={[
                  styles.quoteLoader,
                  {
                    backgroundColor: isDark
                      ? "rgba(0,0,0,0.2)"
                      : "rgba(255,255,255,0.4)",
                  },
                ]}
              >
                <ActivityIndicator color={visualTheme.loaderColor} />
              </View>
            )}
          </LinearGradient>
        </View>
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlayModal }]}
          onPress={() => setMenuVisible(false)}
        >
          <View />
        </Pressable>
        <View
          style={[
            styles.menuCard,
            {
              top: menuPos.y + 3,
              left: Math.max(12, menuPos.x - 130),
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate("favorite-people");
            }}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="people-outline" size={18} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Quote sources</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenuVisible(false);
              setToneVisible(true);
            }}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="options-outline" size={18} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Set tone</Text>
          </Pressable>
          <Pressable
            onPress={onCopyQuote}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="copy-outline" size={18} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Copy quote</Text>
          </Pressable>
          <Pressable
            onPress={() => setMenuVisible(false)}
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.text} />
            <Text style={[styles.menuText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        visible={toneVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setToneVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlayModal }]}
          onPress={() => setToneVisible(false)}
        >
          <View />
        </Pressable>
        <View
          style={[
            styles.toneCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.toneTitle, { color: colors.text }]}>
            Set quote tone
          </Text>
          <TextInput
            value={toneInput}
            onChangeText={setToneInput}
            placeholder="e.g. motivational, stoic, hustle..."
            placeholderTextColor={colors.placeholder}
            style={[
              styles.toneInput,
              {
                color: colors.text,
                borderColor: colors.inputBorder,
                backgroundColor: colors.inputBg,
              },
            ]}
          />
          <View style={styles.toneActions}>
            <Pressable
              onPress={() => setToneVisible(false)}
              style={({ pressed }) => [
                styles.toneBtn,
                { backgroundColor: colors.surfaceMuted },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={[styles.toneBtnText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onSaveTone}
              style={({ pressed }) => [
                styles.toneBtnPrimary,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.toneBtnPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {copiedToast && (
        <View style={styles.toastWrap}>
          <View style={styles.toast}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color="#10b981"
            />
            <Text style={styles.toastText}>Copied</Text>
          </View>
        </View>
      )}
      {copyErrorToast && (
        <View style={styles.toastWrap}>
          <View
            style={[
              styles.toast,
              { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color="#dc2626"
            />
            <Text style={[styles.toastText, { color: "#7f1d1d" }]}>
              Copy failed
            </Text>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 12,
  },
  cardOuter: {
    borderRadius: 22,
    overflow: "visible",
  },
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
  },
  accentSide: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  cardBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    paddingRight: 48,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 6,
    opacity: 0.85,
  },
  quoteLikeBtn: {
    position: "absolute",
    top: 8,
    right: 40,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  quoteMenuBtn: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 6,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
    fontStyle: "italic",
    letterSpacing: 0.15,
  },
  authorRow: {
    marginTop: 8,
    alignItems: "flex-end",
    width: "100%",
    paddingLeft: 8,
  },
  quoteAuthor: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
    textAlign: "right",
    maxWidth: "92%",
  },
  quoteLoader: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  menuCard: {
    position: "absolute",
    right: 16,
    top: 110,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  menuText: { marginLeft: 8, fontWeight: "600" },
  toneCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "30%",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  toneTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  toneInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toneActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  toneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    marginRight: 8,
  },
  toneBtnText: { fontWeight: "700" },
  toneBtnPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  toneBtnPrimaryText: { color: "#fff", fontWeight: "800" },
  toastWrap: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  toastText: { marginLeft: 6, color: "#065f46", fontWeight: "700" },
});

export default QuoteSection;

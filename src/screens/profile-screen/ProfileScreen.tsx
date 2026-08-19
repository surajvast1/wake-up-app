import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated as RNAnimated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import type { AppColors, ThemePreference } from "../../theme/colors";
import { supabase, supabaseConfigured } from "../../lib/supabase";
import { uploadProfilePhotoToStorage } from "../../lib/profilePhotoUpload";
import MenuButton from "../../components/MenuButton";

const LOCAL_PROFILE_KEY = "LOCAL_PROFILE";

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "Auto", icon: "phone-portrait-outline" },
];

interface LinkRowDef {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  route: string;
  accent: string;
  iconTint?: string;
}

function createProfileStyles(c: AppColors, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.backgroundSecondary },
    content: { paddingHorizontal: 20, paddingBottom: 48 },

    /* ─── Hero ─────────────────────────────────────── */
    hero: {
      borderRadius: 26,
      overflow: "hidden",
      marginBottom: 20,
    },
    heroPad: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
      alignItems: "center",
    },
    avatarOuter: {
      width: 112,
      height: 112,
      borderRadius: 40,
      padding: 4,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
    },
    avatar: { width: "100%", height: "100%", borderRadius: 36 },
    avatarPlaceholder: {
      width: "100%",
      height: "100%",
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    cameraBadge: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: "#FFFFFF",
    },
    heroName: {
      marginTop: 14,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.3,
      color: "#FFFFFF",
      textAlign: "center",
    },
    heroHandle: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: "600",
      color: "rgba(255,255,255,0.9)",
      letterSpacing: 0.2,
    },
    heroBadgeRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "center",
    },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.32)",
    },
    heroBadgeText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
    },

    /* ─── Section ──────────────────────────────────── */
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 10,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      overflow: "hidden",
      marginBottom: 18,
    },

    /* ─── Appearance segmented control ─────────────── */
    segment: {
      flexDirection: "row",
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    segmentBtnText: {
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.2,
    },

    /* ─── Link rows ────────────────────────────────── */
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 14,
    },
    linkRowDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginLeft: 62,
    },
    linkIconBubble: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    linkText: { flex: 1, minWidth: 0 },
    linkTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.1,
    },
    linkSub: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textSecondary,
      marginTop: 2,
      letterSpacing: 0.1,
    },

    /* ─── Guest banner ─────────────────────────────── */
    guestBanner: {
      gap: 12,
      backgroundColor: c.guestBannerBg,
      borderRadius: 14,
      padding: 14,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: c.guestBannerBorder,
    },
    guestBannerCopy: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    guestBannerText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: c.guestBannerText,
      lineHeight: 19,
    },
    signInGuestBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingVertical: 4,
    },
    signInGuestText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: "800",
    },

    /* ─── Form fields ──────────────────────────────── */
    field: { marginBottom: 14 },
    label: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textSecondary,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: c.inputBg,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.inputBorder,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontWeight: "600",
      color: c.text,
    },
    inputDisabled: {
      backgroundColor: c.surfaceMuted,
      borderColor: c.border,
    },
    disabledText: {
      fontSize: 15,
      fontWeight: "600",
      color: c.textMuted,
    },

    /* ─── Buttons ──────────────────────────────────── */
    saveBtn: {
      borderRadius: 16,
      overflow: "hidden",
      marginTop: 8,
    },
    saveBtnGrad: {
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    saveBtnText: { fontSize: 16, fontWeight: "900", color: "#ffffff", letterSpacing: 0.2 },
    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.dangerSoftBorder,
      backgroundColor: c.dangerSoftBg,
    },
    signOutText: { fontSize: 14, fontWeight: "800", color: c.danger, letterSpacing: 0.2 },

    /* ─── Toast ────────────────────────────────────── */
    toast: {
      position: "absolute",
      left: 20,
      right: 20,
      zIndex: 100,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 14,
      shadowColor: c.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    toastText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#ffffff",
      flex: 1,
    },

    /* ─── Meta ─────────────────────────────────────── */
    buildFooter: {
      marginTop: 18,
      alignItems: "center",
    },
    buildFooterText: {
      fontSize: 11,
      fontWeight: "700",
      color: c.textMuted,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
  });
}

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors: c, preference, setPreference, isDark } = useAppTheme();
  const styles = useMemo(() => createProfileStyles(c, isDark), [c, isDark]);
  const {
    user,
    signOut,
    configured,
    isGuest,
    guestSession,
    updateGuestProfile,
  } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;
  const toastY = useRef(new RNAnimated.Value(-30)).current;

  const showToast = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      setToastMsg(msg);
      setToastType(type);
      toastOpacity.setValue(0);
      toastY.setValue(-30);
      RNAnimated.parallel([
        RNAnimated.spring(toastOpacity, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
        }),
        RNAnimated.spring(toastY, {
          toValue: 0,
          useNativeDriver: true,
          friction: 6,
        }),
      ]).start();
      setTimeout(() => {
        RNAnimated.timing(toastOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start(() => setToastMsg(""));
      }, 2500);
    },
    [toastOpacity, toastY]
  );

  useEffect(() => {
    if (isGuest && guestSession) {
      setName(guestSession.name);
      setPhotoUrl(guestSession.photoUri);
      setPhone("");
      return;
    }
    if (user) {
      setName(user.user_metadata?.full_name || "");
      setPhone(user.phone || "");
    }
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, configured, isGuest, guestSession]);

  const loadProfile = async () => {
    if (isGuest) return;
    let photoFromLocal: string | null | undefined;
    try {
      const raw = await AsyncStorage.getItem(LOCAL_PROFILE_KEY);
      if (raw) {
        const local = JSON.parse(raw) as {
          name?: string;
          phone?: string;
          photo_url?: string | null;
        };
        if (local.name) setName(local.name);
        if (local.phone) setPhone(local.phone);
        if ("photo_url" in local) {
          photoFromLocal =
            local.photo_url && String(local.photo_url).trim()
              ? String(local.photo_url).trim()
              : null;
        }
      }
    } catch {}

    if (configured && user) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          if (data.name) setName(data.name);
          if (data.phone) setPhone(data.phone);
          const u = data.photo_url != null ? String(data.photo_url).trim() : "";
          setPhotoUrl(u.length > 0 ? u : null);
          return;
        }
      } catch {}
    }

    if (photoFromLocal !== undefined) {
      setPhotoUrl(photoFromLocal);
      return;
    }

    setPhotoUrl(user?.user_metadata?.avatar_url?.trim() || null);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUrl(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Camera access is required to take a photo."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUrl(result.assets[0].uri);
    }
  };

  const handlePhotoPress = () => {
    Alert.alert("Profile photo", "Choose a picture or take a new one.", [
      { text: "Take Photo", onPress: () => void takePhoto() },
      { text: "Choose from Library", onPress: () => void pickFromLibrary() },
      { text: "Remove Photo", onPress: () => setPhotoUrl(null) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Please enter your name", "error");
      return;
    }
    setSaving(true);
    try {
      if (isGuest) {
        await updateGuestProfile({
          name: name.trim(),
          photoUri: photoUrl,
        });
        showToast("Saved on this device", "success");
        setSaving(false);
        return;
      }

      let photoForStore = photoUrl;
      if (configured && user && photoUrl) {
        const uploaded = await uploadProfilePhotoToStorage(user.id, photoUrl);
        if (uploaded) photoForStore = uploaded;
      }

      const localData = {
        name: name.trim(),
        phone,
        photo_url: photoForStore,
      };
      await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(localData));
      if (photoForStore !== photoUrl) setPhotoUrl(photoForStore);

      if (configured && user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          name: name.trim(),
          phone,
          photo_url: photoForStore ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      showToast("Profile saved successfully!", "success");
    } catch (e: any) {
      showToast(e.message || "Could not save profile", "error");
    }
    setSaving(false);
  };

  const handleSignOut = () => {
    const title = isGuest ? "Leave guest mode?" : "Sign Out";
    const message = isGuest
      ? "You can come back as a guest again; your local data stays on this device until you clear it or reinstall."
      : "Are you sure you want to sign out?";
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: isGuest ? "Leave" : "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const heroColors = isDark
    ? (["#1F2A24", "#2A3A32", "#3A4F44"] as const)
    : (["#5B7553", "#6C8C63", "#86A97B"] as const);

  const links: LinkRowDef[] = [
    {
      id: "edit-ui",
      icon: "color-wand",
      title: "Edit UI",
      subtitle: "Choose cards, order, colors, and temp Lottie",
      route: "edit-ui",
      accent: "#14B8A6",
    },
    {
      id: "liked",
      icon: "heart",
      title: "Liked items",
      subtitle: "News and quotes you've saved",
      route: "liked-items",
      accent: "#EC4899",
    },
    {
      id: "sources",
      icon: "people",
      title: "Quote sources",
      subtitle: "People whose words inspire you",
      route: "favorite-people",
      accent: "#6366F1",
    },
  ];

  const handleText =
    user?.email ||
    (user?.phone ? `+${user.phone.replace(/^\+?/, "")}` : "") ||
    (isGuest ? "Guest on this device" : "");

  return (
    <View style={styles.container}>
      <MenuButton />

      {toastMsg !== "" && (
        <RNAnimated.View
          style={[
            styles.toast,
            {
              top: insets.top + 56,
              opacity: toastOpacity,
              transform: [{ translateY: toastY }],
              backgroundColor: toastType === "success" ? "#22c55e" : "#ef4444",
            },
          ]}
        >
          <Ionicons
            name={toastType === "success" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color="#fff"
          />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </RNAnimated.View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 56 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero ─────────────────────────────────── */}
        <LinearGradient
          colors={[...heroColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroPad}>
            <Pressable
              onPress={handlePhotoPress}
              accessibilityLabel="Change profile photo"
              style={styles.avatarOuter}
            >
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatar} />
              ) : (
                <LinearGradient
                  colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.05)"]}
                  style={styles.avatarPlaceholder}
                >
                  <Ionicons name="person" size={44} color="#FFFFFF" />
                </LinearGradient>
              )}
              <View
                style={[styles.cameraBadge, { backgroundColor: c.primary }]}
              >
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            </Pressable>
            <Text style={styles.heroName} numberOfLines={1}>
              {name.trim() || (isGuest ? "Guest" : "Your name")}
            </Text>
            {handleText ? (
              <Text style={styles.heroHandle} numberOfLines={1}>
                {handleText}
              </Text>
            ) : null}
            <View style={styles.heroBadgeRow}>
              {isGuest ? (
                <View style={styles.heroBadge}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={12}
                    color="#FFFFFF"
                  />
                  <Text style={styles.heroBadgeText}>GUEST MODE</Text>
                </View>
              ) : null}
              {supabaseConfigured && user ? (
                <View style={styles.heroBadge}>
                  <Ionicons
                    name="shield-checkmark"
                    size={12}
                    color="#FFFFFF"
                  />
                  <Text style={styles.heroBadgeText}>SIGNED IN</Text>
                </View>
              ) : null}
              <View style={styles.heroBadge}>
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.heroBadgeText}>
                  {preference === "system" ? "AUTO" : preference.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {isGuest && (
          <View style={styles.guestBanner}>
            <View style={styles.guestBannerCopy}>
              <Ionicons
                name="information-circle"
                size={18}
                color={c.primary}
              />
              <Text style={styles.guestBannerText}>
                Guest mode · your tasks, habits, routines, and profile stay on
                this device.
              </Text>
            </View>
            {configured && (
              <Pressable
                onPress={() => void signOut()}
                style={({ pressed }) => [
                  styles.signInGuestBtn,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={styles.signInGuestText}>Sign in to save</Text>
                <Ionicons name="arrow-forward" size={15} color={c.primary} />
              </Pressable>
            )}
          </View>
        )}

        {/* ─── Appearance ──────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.segment}>
            {THEME_OPTIONS.map((opt) => {
              const selected = preference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => void setPreference(opt.value)}
                  style={({ pressed }) => [
                    styles.segmentBtn,
                    {
                      backgroundColor: selected
                        ? isDark
                          ? hexWithAlpha(c.primary, 0.22)
                          : c.primarySoftBg
                        : "transparent",
                    },
                    pressed && !selected && { opacity: 0.6 },
                  ]}
                  accessibilityLabel={opt.label}
                >
                  <Ionicons
                    name={opt.icon}
                    size={18}
                    color={selected ? c.primary : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentBtnText,
                      { color: selected ? c.primary : c.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Shortcuts ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Your stuff</Text>
        <View style={styles.card}>
          {links.map((lnk, idx) => (
            <React.Fragment key={lnk.id}>
              <Pressable
                onPress={() => navigation.navigate(lnk.route as never)}
                style={({ pressed }) => [
                  styles.linkRow,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <View
                  style={[
                    styles.linkIconBubble,
                    {
                      backgroundColor: hexWithAlpha(
                        lnk.accent,
                        isDark ? 0.22 : 0.15
                      ),
                    },
                  ]}
                >
                  <Ionicons name={lnk.icon} size={18} color={lnk.accent} />
                </View>
                <View style={styles.linkText}>
                  <Text style={styles.linkTitle} numberOfLines={1}>
                    {lnk.title}
                  </Text>
                  <Text style={styles.linkSub} numberOfLines={1}>
                    {lnk.subtitle}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={c.textMuted}
                />
              </Pressable>
              {idx < links.length - 1 ? (
                <View style={styles.linkRowDivider} />
              ) : null}
            </React.Fragment>
          ))}
        </View>

        {/* ─── Account ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={[styles.card, { padding: 16, paddingBottom: 12 }]}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={c.placeholder}
            />
          </View>

          {!isGuest && (
            <View style={styles.field}>
              <Text style={styles.label}>Phone</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.disabledText}>{phone || "Not set"}</Text>
              </View>
            </View>
          )}

          {user?.email && (
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.input, styles.inputDisabled]}>
                <Text style={styles.disabledText} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && { opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={[c.primary, c.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGrad}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.saveBtnInner}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>Save changes</Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* ─── Danger zone ─────────────────────────────────── */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={c.danger} />
          <Text style={styles.signOutText}>
            {isGuest ? "Leave guest mode" : "Sign out"}
          </Text>
        </Pressable>

        <View style={styles.buildFooter}>
          <Text style={styles.buildFooterText}>uniflow · v1.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

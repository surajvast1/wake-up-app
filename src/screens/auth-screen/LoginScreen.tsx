import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";
import { supabaseConfigured } from "../../lib/supabase";

const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppTheme();
  const navigation = useNavigation<any>();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signInWithPhone } = useAuth();

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\s/g, "");
    if (cleaned.length < 10) {
      setError("Enter a valid 10-digit phone number");
      return;
    }
    setLoading(true);
    setError("");
    const fullPhone = `+91${cleaned}`;
    const result = await signInWithPhone(fullPhone);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      navigation.navigate("otp", { phone: fullPhone });
    }
  };

  const bgGrad = isDark
    ? (["#1a2218", "#2d3d28", "#0f140d"] as const)
    : (["#f0f4ef", "#f5f7f4", "#ffffff"] as const);

  return (
    <LinearGradient colors={[...bgGrad]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top + 40 }]}
      >
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={["#5B7553", "#7A9972"]}
            style={styles.logoCircle}
          >
            <Ionicons name="sunny" size={36} color="#fff" />
          </LinearGradient>
          <Text style={[styles.appName, { color: c.text }]}>Uniflow</Text>
          <Text style={[styles.tagline, { color: c.primary }]}>
            Start every day with purpose
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: c.text }]}>
            Sign in with phone
          </Text>
          <Text style={[styles.inputLabel, { color: c.textSecondary }]}>
            Phone Number
          </Text>
          <View style={styles.phoneRow}>
            <View
              style={[
                styles.codeBox,
                { borderColor: c.inputBorder, backgroundColor: c.inputBg },
              ]}
            >
              <Text style={[styles.codeText, { color: c.text }]}>+91</Text>
            </View>
            <TextInput
              style={[
                styles.phoneInput,
                {
                  borderColor: c.inputBorder,
                  backgroundColor: c.inputBg,
                  color: c.text,
                },
              ]}
              placeholder="Enter phone number"
              placeholderTextColor={c.placeholder}
              keyboardType="phone-pad"
              maxLength={10}
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setError("");
              }}
              editable={supabaseConfigured}
            />
          </View>

          {!supabaseConfigured && (
            <Text style={[styles.hint, { color: c.textMuted }]}>
              Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env to enable
              sign-in.
            </Text>
          )}

          {error !== "" && (
            <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
          )}

          <Pressable
            onPress={handleSendOtp}
            disabled={loading || !supabaseConfigured}
            style={({ pressed }) => [
              styles.otpBtn,
              { backgroundColor: c.primary },
              pressed && { opacity: 0.85 },
              (loading || !supabaseConfigured) && { opacity: 0.6 },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.otpBtnText}>Send OTP</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("guest-name")}
            style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={[styles.guestBtnText, { color: c.primary }]}>
              Continue as guest
            </Text>
            <Text style={[styles.guestBtnSub, { color: c.textMuted }]}>
              Tasks & habits stay on this device only
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.terms, { color: c.textMuted }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: { fontSize: 32, fontWeight: "900" },
  tagline: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 18,
  },
  hint: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 10,
    lineHeight: 15,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  phoneRow: { flexDirection: "row", gap: 10 },
  codeBox: {
    width: 56,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: { fontSize: 15, fontWeight: "700" },
  phoneInput: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  otpBtn: {
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  otpBtnText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  guestBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  guestBtnText: {
    fontSize: 15,
    fontWeight: "800",
  },
  guestBtnSub: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  terms: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 16,
  },
});

export default LoginScreen;

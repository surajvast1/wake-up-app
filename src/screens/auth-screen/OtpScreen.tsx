import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { useAppTheme } from "../../contexts/ThemeContext";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const OtpScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppTheme();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const phone: string = route.params?.phone ?? "";
  const { verifyOtp, signInWithPhone } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputsRef = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = useCallback(
    (text: string, index: number) => {
      const next = [...digits];
      next[index] = text.slice(-1);
      setDigits(next);
      setError("");
      if (text && index < OTP_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    },
    [digits]
  );

  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === "Backspace" && !digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handleVerify = async () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setError("Please enter the complete OTP");
      return;
    }
    setLoading(true);
    setError("");
    const result = await verifyOtp(phone, otp);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setDigits(Array(OTP_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setCountdown(RESEND_SECONDS);
    setError("");
    await signInWithPhone(phone);
  };

  const maskedPhone =
    phone.length > 4
      ? phone.slice(0, phone.length - 4).replace(/./g, "X") +
        phone.slice(-4)
      : phone;

  const bgGrad = isDark
    ? (["#1a2218", "#2d3d28", "#0f140d"] as const)
    : (["#f0f4ef", "#f5f7f4", "#ffffff"] as const);

  return (
    <LinearGradient colors={[...bgGrad]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: c.menuButtonBg },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={c.menuButtonIcon} />
        </Pressable>

        <View style={styles.content}>
          <Text style={[styles.title, { color: c.text }]}>Verify Phone</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            We sent a 6-digit code to{"\n"}
            <Text style={[styles.phoneBold, { color: c.text }]}>
              {maskedPhone}
            </Text>
          </Text>

          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  inputsRef.current[i] = ref;
                }}
                style={[
                  styles.otpBox,
                  {
                    borderColor: d ? c.primary : c.border,
                    backgroundColor: d ? c.primarySoftBg : c.surface,
                    color: c.text,
                  },
                ]}
                value={d}
                onChangeText={(t) => handleChange(t, i)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, i)
                }
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={i === 0}
                selectTextOnFocus
              />
            ))}
          </View>

          {error !== "" && (
            <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
          )}

          <Pressable
            onPress={handleVerify}
            disabled={loading}
            style={({ pressed }) => [
              styles.verifyBtn,
              { backgroundColor: c.primary },
              pressed && { opacity: 0.85 },
              loading && { opacity: 0.6 },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify</Text>
            )}
          </Pressable>

          <Pressable onPress={handleResend} disabled={countdown > 0}>
            <Text style={[styles.resendText, { color: c.primary }]}>
              {countdown > 0
                ? `Resend OTP in ${countdown}s`
                : "Resend OTP"}
            </Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  content: { alignItems: "center", paddingTop: 40 },
  title: { fontSize: 28, fontWeight: "900" },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  phoneBold: { fontWeight: "800" },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 32,
    marginBottom: 12,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 8,
  },
  verifyBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 60,
    alignItems: "center",
  },
  verifyBtnText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  resendText: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default OtpScreen;

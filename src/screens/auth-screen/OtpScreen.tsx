import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors: c, isDark } = useAppTheme();
  const { verifyEmailOtp, sendEmailOtp } = useAuth();
  const email: string = route.params?.email ?? "";
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputsRef = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = useCallback((value: string, index: number) => {
    const pasted = value.replace(/\D/g, "");
    if (pasted.length > 1) {
      const next = [...digits];
      pasted.slice(0, OTP_LENGTH - index).split("").forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      setDigits(next);
      setError("");
      inputsRef.current[Math.min(index + pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = pasted.slice(-1);
    setDigits(next);
    setError("");
    if (next[index] && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  }, [digits]);

  const verify = async () => {
    const code = digits.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await verifyEmailOtp(email, code);
      if (result.error) {
        setError(result.error);
        setDigits(Array(OTP_LENGTH).fill(""));
        inputsRef.current[0]?.focus();
        return;
      }
      navigation.replace("name");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Could not verify the code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError("");
    const result = await sendEmailOtp(email);
    setLoading(false);
    if (result.error) setError(result.error);
    else setCountdown(RESEND_SECONDS);
  };

  const bgGrad = isDark
    ? (["#11151F", "#1A2130", "#0E1118"] as const)
    : (["#F1F6EE", "#F7FAF5", "#FFFFFF"] as const);

  return (
    <LinearGradient colors={[...bgGrad]} style={styles.root}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: c.menuButtonBg }]}>
          <Ionicons name="arrow-back" size={24} color={c.menuButtonIcon} />
        </Pressable>
        <View style={styles.content}>
          <Text style={[styles.title, { color: c.text }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            We sent a 6-digit code to{"\n"}
            <Text style={{ color: c.text, fontWeight: "900" }}>{email}</Text>
          </Text>
          <View style={styles.otpRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputsRef.current[index] = ref; }}
                style={[styles.otpBox, { color: c.text, borderColor: digit ? c.primary : c.inputBorder, backgroundColor: c.inputBg }]}
                value={digit}
                onChangeText={(value) => handleChange(value, index)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                autoFocus={index === 0}
              />
            ))}
          </View>
          {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
          <Pressable onPress={() => void verify()} disabled={loading} style={[styles.button, { backgroundColor: c.primary }, loading && { opacity: 0.6 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify email</Text>}
          </Pressable>
          <Pressable onPress={() => void resend()} disabled={countdown > 0 || loading} style={styles.resend}>
            <Text style={{ color: countdown > 0 ? c.textMuted : c.primary, fontWeight: "800" }}>
              {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
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
  back: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, justifyContent: "center" },
  title: { fontSize: 30, fontWeight: "900", marginBottom: 10 },
  subtitle: { fontSize: 15, lineHeight: 23, marginBottom: 28 },
  otpRow: { flexDirection: "row", gap: 9, marginBottom: 18 },
  otpBox: { flex: 1, height: 56, borderWidth: 1.5, borderRadius: 14, fontSize: 22, fontWeight: "900" },
  error: { fontSize: 13, fontWeight: "700", marginBottom: 14 },
  button: { alignItems: "center", borderRadius: 14, paddingVertical: 15 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  resend: { alignSelf: "center", paddingVertical: 18 },
});

export default OtpScreen;

import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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
  const navigation = useNavigation<any>();
  const { colors: c, isDark } = useAppTheme();
  const { sendEmailOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    const result = await sendEmailOtp(cleanEmail);
    setLoading(false);
    if (result.error) setError(result.error);
    else navigation.navigate("otp", { email: cleanEmail });
  };

  const bgGrad = isDark
    ? (["#11151F", "#1A2130", "#0E1118"] as const)
    : (["#F1F6EE", "#F7FAF5", "#FFFFFF"] as const);

  return (
    <LinearGradient colors={[...bgGrad]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top + 30 }]}
      >
        <View style={styles.logoWrap}>
          <LinearGradient colors={[c.primary, c.primaryLight]} style={styles.logoCircle}>
            <Ionicons name="sunny" size={36} color="#fff" />
          </LinearGradient>
          <Text style={[styles.appName, { color: c.text }]}>Uniflow</Text>
          <Text style={[styles.tagline, { color: c.primary }]}>Start every day with purpose</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.title, { color: c.text }]}>Sign in or create account</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Enter your email. We’ll send a free one-time verification code.
          </Text>
          <Text style={[styles.label, { color: c.textSecondary }]}>Email address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: c.inputBg, borderColor: c.inputBorder, color: c.text }]}
            placeholder="you@example.com"
            placeholderTextColor={c.placeholder}
            value={email}
            onChangeText={(value) => { setEmail(value); setError(""); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={supabaseConfigured}
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
          />
          {!supabaseConfigured && (
            <Text style={[styles.hint, { color: c.textMuted }]}>
              Add Supabase URL and anon key to .env to enable email sign-in.
            </Text>
          )}
          {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
          <Pressable
            onPress={() => void sendCode()}
            disabled={loading || !supabaseConfigured}
            style={({ pressed }) => [styles.button, { backgroundColor: c.primary }, pressed && { opacity: 0.85 }, (loading || !supabaseConfigured) && { opacity: 0.6 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send email code</Text>}
          </Pressable>
        </View>
        <Text style={[styles.terms, { color: c.textMuted }]}>
          No phone number or paid SMS provider required.
        </Text>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  appName: { fontSize: 32, fontWeight: "900" },
  tagline: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  card: { borderRadius: 24, borderWidth: 1, padding: 22 },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 22 },
  label: { fontSize: 12, fontWeight: "800", marginBottom: 8 },
  input: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  error: { fontSize: 13, fontWeight: "700", marginBottom: 12 },
  button: { alignItems: "center", borderRadius: 14, paddingVertical: 15, marginTop: 6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  terms: { textAlign: "center", fontSize: 12, marginTop: 22 },
});

export default LoginScreen;

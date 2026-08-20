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

const GuestNameScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors: c, isDark } = useAppTheme();
  const navigation = useNavigation<any>();
  const { saveUserName } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onContinue = async () => {
    setLoading(true);
    setError("");
    const result = await saveUserName(name);
    setLoading(false);
    if (result.error) setError(result.error);
  };

  const bgGrad = isDark
    ? (["#1a2218", "#2d3d28", "#0f140d"] as const)
    : (["#f0f4ef", "#f5f7f4", "#ffffff"] as const);

  return (
    <LinearGradient colors={[...bgGrad]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingTop: insets.top + 24 }]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color={c.primary} />
          <Text style={[styles.backText, { color: c.primary }]}>Back</Text>
        </Pressable>

        <View style={styles.logoWrap}>
          <LinearGradient
            colors={["#5B7553", "#7A9972"]}
            style={styles.logoCircle}
          >
            <Ionicons name="person-outline" size={32} color="#fff" />
          </LinearGradient>
          <Text style={[styles.title, { color: c.text }]}>What should we call you?</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            This name will be used across your dashboard and profile.
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
          <Text style={[styles.label, { color: c.textSecondary }]}>
            Display name
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: c.inputBg,
                borderColor: c.inputBorder,
                color: c.text,
              },
            ]}
            placeholder="How should we greet you?"
            placeholderTextColor={c.placeholder}
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError("");
            }}
            autoCapitalize="words"
            editable={!loading}
          />
          {error !== "" && (
            <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
          )}
          <Pressable
            onPress={onContinue}
            disabled={loading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: c.primary },
              pressed && { opacity: 0.88 },
              loading && { opacity: 0.65 },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.btnText}>Continue</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backText: { fontSize: 16, fontWeight: "700", color: "#5B7553" },
  logoWrap: { marginBottom: 24 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 26, fontWeight: "900", color: "#243420" },
  sub: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 8,
    lineHeight: 21,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
    marginTop: 8,
  },
  btn: {
    marginTop: 20,
    backgroundColor: "#5B7553",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnText: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
});

export default GuestNameScreen;

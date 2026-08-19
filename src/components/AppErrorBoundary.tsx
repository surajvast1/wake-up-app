import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Surfaces JS render errors instead of an immediate exit (native crashes still need logcat / Xcode).
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("AppErrorBoundary:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>This screen couldn&apos;t load</Text>
            <Text style={styles.body}>{this.state.error.message}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 12 },
  body: { fontSize: 14, lineHeight: 20, color: "#444" },
});

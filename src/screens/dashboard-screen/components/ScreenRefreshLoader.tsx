import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const ScreenRefreshLoader = () => {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1600,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

      <View style={styles.center}>
        <Text style={styles.text}>Refreshing live data</Text>

        <View style={styles.track}>
          <Animated.View
            style={[styles.shimmer, { transform: [{ translateX }] }]}
          >
            <LinearGradient
              colors={[
                "transparent",
                "rgba(255,255,255,0.9)",
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  track: {
    width: 240,
    height: 6,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: 10,
    overflow: "hidden",
  },
  shimmer: {
    width: 120,
    height: "100%",
  },
});

export default ScreenRefreshLoader;

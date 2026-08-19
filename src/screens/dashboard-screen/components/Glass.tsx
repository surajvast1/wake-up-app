import React from "react";
import { Platform, View } from "react-native";
import { BlurView } from "expo-blur";

interface GlassProps {
  style?: any;
  children?: React.ReactNode;
}

const Glass: React.FC<GlassProps> = ({ style, children }) => {
  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={28} tint="light" style={style}>
        {children}
      </BlurView>
    );
  }
  return <View style={[style, { backgroundColor: "rgba(255,255,255,0.65)" }]}>{children}</View>;
};

export default Glass;



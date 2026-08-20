import React, { useEffect, useMemo } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  LogBox,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";

LogBox.ignoreLogs([
  "setLayoutAnimationEnabledExperimental",
]);
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ThemeProvider, useAppTheme } from "./src/contexts/ThemeContext";
import { UiPrefsProvider } from "./src/contexts/UiPrefsContext";
import { buildNavigationTheme } from "./src/theme/navigationTheme";
import DrawerContent from "./src/navigation/DrawerContent";


import DashboardScreen from "./src/screens/dashboard-screen/DashboardScreen";
import NewsScreen from "./src/screens/news-screen/NewsScreen";
import HabitsScreen from "./src/screens/habits-screen/HabitsScreen";
import ProfileScreen from "./src/screens/profile-screen/ProfileScreen";
import LoginScreen from "./src/screens/auth-screen/LoginScreen";
import OtpScreen from "./src/screens/auth-screen/OtpScreen";
import GuestNameScreen from "./src/screens/auth-screen/GuestNameScreen";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AuthStack = ({ initialRouteName = "login" }: { initialRouteName?: "login" | "name" }) => (
  <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="login" component={LoginScreen} />
    <Stack.Screen name="otp" component={OtpScreen} />
    <Stack.Screen name="name" component={GuestNameScreen} />
  </Stack.Navigator>
);

const MainDrawer = () => (
  <Drawer.Navigator
    drawerContent={(props) => <DrawerContent {...props} />}
    screenOptions={{
      headerShown: false,
      drawerType: "front",
      swipeEdgeWidth: 50,
    }}
  >
    <Drawer.Screen
      name="dashboard"
      component={DashboardScreen}
      options={{ swipeEnabled: false }}
    />
    <Drawer.Screen
      name="news"
      component={NewsScreen}
      options={{ swipeEnabled: false }}
    />
    <Drawer.Screen name="habits" component={HabitsScreen} />
    <Drawer.Screen name="profile" component={ProfileScreen} />
  </Drawer.Navigator>
);

const GatedMain = () => <MainDrawer />;

const LoadingScreen = () => {
  const { colors } = useAppTheme();
  return (
    <View
      style={[loadStyles.container, { backgroundColor: colors.background }]}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const loadStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

function useMobileAdsInit(): void {
  useEffect(() => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") return;
    if (Constants.appOwnership === "expo") return;
    let cancelled = false;
    void (async () => {
      try {
        const { default: mobileAds } = await import(
          "react-native-google-mobile-ads"
        );
        if (cancelled) return;
        await mobileAds().initialize();
      } catch (e) {
        console.warn("Mobile Ads init skipped or failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}

const RootNavigator = () => {
  const { user, loading, configured, needsName } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!configured) return <AuthStack />;
  return user ? (needsName ? <AuthStack initialRouteName="name" /> : <GatedMain />) : <AuthStack />;
};

const ThemedNavigation: React.FC = () => {
  const { colors, isDark } = useAppTheme();
  const navTheme = useMemo(
    () => buildNavigationTheme(colors, isDark),
    [colors, isDark]
  );

  return (
    <>
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
    </>
  );
};

const App: React.FC = () => {
  useMobileAdsInit();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <ThemeProvider>
          <UiPrefsProvider>
            <AuthProvider>
              <ThemedNavigation />
            </AuthProvider>
          </UiPrefsProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default App;

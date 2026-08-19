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
  "expo-notifications",
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
import TaskScreen from "./src/screens/task-screen/TaskScreen";
import HabitsScreen from "./src/screens/habits-screen/HabitsScreen";
import MeditationScreen from "./src/screens/meditation-screen/MeditationScreen";
import NearbyPlacesScreen from "./src/screens/nearby-places-screen/NearbyPlacesScreen";
import CalendarScreen from "./src/screens/calendar-screen/CalendarScreen";
import ProfileScreen from "./src/screens/profile-screen/ProfileScreen";
import EditUiScreen from "./src/screens/edit-ui-screen/EditUiScreen";
import FavoritePeopleScreen from "./src/screens/favorite-people-screen/FavoritePeopleScreen";
import LikedItemsScreen from "./src/screens/liked-items-screen/LikedItemsScreen";
import RoutineNavigator from "./src/features/routine/navigation/RoutineNavigator";
import LoginScreen from "./src/screens/auth-screen/LoginScreen";
import OtpScreen from "./src/screens/auth-screen/OtpScreen";
import GuestNameScreen from "./src/screens/auth-screen/GuestNameScreen";
import { AppErrorBoundary } from "./src/components/AppErrorBoundary";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="login" component={LoginScreen} />
    <Stack.Screen name="otp" component={OtpScreen} />
    <Stack.Screen name="guest-name" component={GuestNameScreen} />
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
    <Drawer.Screen name="tasks" component={TaskScreen} />
    <Drawer.Screen name="habits" component={HabitsScreen} />
    <Drawer.Screen name="routines" component={RoutineNavigator} />
    <Drawer.Screen name="meditation" component={MeditationScreen} />
    <Drawer.Screen name="calendar" component={CalendarScreen} />
    <Drawer.Screen
      name="nearby"
      component={NearbyPlacesScreen}
      options={{ swipeEnabled: false }}
    />
    <Drawer.Screen name="profile" component={ProfileScreen} />
    <Drawer.Screen name="edit-ui" component={EditUiScreen} />
    <Drawer.Screen name="favorite-people" component={FavoritePeopleScreen} />
    <Drawer.Screen name="liked-items" component={LikedItemsScreen} />
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
  const { user, isGuest, loading, configured } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!configured) return <GatedMain />;
  return user || isGuest ? <GatedMain /> : <AuthStack />;
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

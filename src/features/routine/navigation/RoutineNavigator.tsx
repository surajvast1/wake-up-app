import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RoutineStackParamList } from "../types";
import RoutinesHubScreen from "../screens/RoutinesHubScreen";
import TodayRoutineScreen from "../screens/TodayRoutineScreen";
import RoutineEditorScreen from "../screens/RoutineEditorScreen";

const Stack = createNativeStackNavigator<RoutineStackParamList>();

const RoutineNavigator: React.FC = () => (
  <Stack.Navigator
    initialRouteName="RoutineToday"
    screenOptions={{
      headerShown: false,
      animation: "slide_from_right",
    }}
  >
    <Stack.Screen name="RoutineToday" component={TodayRoutineScreen} />
    <Stack.Screen name="RoutineEditor" component={RoutineEditorScreen} />
    <Stack.Screen name="RoutineHub" component={RoutinesHubScreen} />
  </Stack.Navigator>
);

export default RoutineNavigator;

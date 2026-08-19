import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_KEY = "USER_LOCATION";

export type UserLocation = {
  lat: number;
  lon: number;
  updatedAt: number;
};

export const getFreshLocationAndSave = async (): Promise<UserLocation | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    return null;
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced, // battery friendly
  });

  const location: UserLocation = {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    updatedAt: Date.now(),
  };

//   // overwrite every time
//   await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));

  return location;
};

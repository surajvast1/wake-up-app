import Constants from "expo-constants";
import mobileAds from "react-native-google-mobile-ads";

export async function initializeMobileAds(): Promise<void> {
  if (Constants.appOwnership === "expo") return;
  await mobileAds().initialize();
}

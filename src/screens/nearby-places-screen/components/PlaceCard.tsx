import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  type NearbyPlace,
  getPlacePhotoUrl,
} from "../../../services/nearbyPlacesService";

const { width: SCREEN_W } = Dimensions.get("window");

const PLACEHOLDER_COLORS: [string, string][] = [
  ["#3D5637", "#4A6B44"],
  ["#0c4a6e", "#0369a1"],
  ["#14532d", "#15803d"],
  ["#831843", "#be185d"],
  ["#713f12", "#b45309"],
];

interface PlaceCardProps {
  place: NearbyPlace;
  cardHeight: number;
  onOpenMaps: () => void;
}

const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  cardHeight,
  onOpenMaps,
}) => {
  const imageUri = useMemo(
    () => getPlacePhotoUrl(place.photoReference, 900),
    [place.photoReference]
  );

  const placeholderIdx =
    (place.name.charCodeAt(0) ?? 0) % PLACEHOLDER_COLORS.length;

  const imageH = Math.round(
    Math.min(cardHeight * 0.44, Math.max(112, cardHeight * 0.36))
  );

  const distLabel =
    place.distanceKm < 1
      ? `${Math.round(place.distanceKm * 1000)} m away`
      : `${place.distanceKm.toFixed(1)} km away`;

  const handlePress = useCallback(() => {
    onOpenMaps();
  }, [onOpenMaps]);

  const cardBg = "#ffffff";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const accent = "#5B7553";
  const badgeBg = "#EDF2EB";
  const badgeText = "#5B7553";
  const dividerColor = "rgba(0,0,0,0.06)";
  const ratingBg = "#fffbeb";
  const ratingText = "#b45309";

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          height: cardHeight,
          backgroundColor: cardBg,
          opacity: pressed ? 0.96 : 1,
        },
      ]}
    >
      {/* Title — mirrors News headline */}
      <View style={styles.headlineWrap}>
        <Text
          style={[styles.headline, { color: textPrimary }]}
          numberOfLines={3}
        >
          {place.name}
        </Text>
      </View>

      <View style={styles.imageWrap}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, { height: imageH }]}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={PLACEHOLDER_COLORS[placeholderIdx]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.imagePlaceholder, { height: imageH }]}
          >
            <Ionicons
              name="image-outline"
              size={44}
              color="rgba(255,255,255,0.35)"
            />
          </LinearGradient>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          {place.rating != null ? (
            <View style={[styles.ratingBadge, { backgroundColor: ratingBg }]}>
              <Ionicons name="star" size={13} color="#f59e0b" />
              <Text style={[styles.ratingValue, { color: ratingText }]}>
                {place.rating.toFixed(1)}
              </Text>
              {place.userRatingsTotal > 0 ? (
                <Text style={styles.ratingCount}>
                  ({place.userRatingsTotal})
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={[styles.sourceBadge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.sourceText, { color: badgeText }]}>
                No rating yet
              </Text>
            </View>
          )}
          <View
            style={[styles.metaDot, { backgroundColor: textSecondary }]}
          />
          <Text style={[styles.distText, { color: textSecondary }]}>
            {distLabel}
          </Text>
        </View>

        {place.address !== "" && (
          <Text
            style={[styles.addressText, { color: textSecondary }]}
            numberOfLines={3}
          >
            {place.address}
          </Text>
        )}

        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        <Text style={[styles.hint, { color: textSecondary }]}>
          Tap to open directions in Maps and go there.
        </Text>

        <View style={styles.bottomRow}>
          <View
            style={[styles.readBtn, { backgroundColor: accent }]}
            pointerEvents="none"
          >
            <Text style={styles.readBtnText}>Open in Maps</Text>
            <Ionicons name="navigate" size={16} color="#ffffff" />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const CARD_SIDE_MARGIN = 20;

const styles = StyleSheet.create({
  card: {
    width: SCREEN_W - CARD_SIDE_MARGIN * 2,
    alignSelf: "center",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headlineWrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headline: {
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.35,
  },
  imageWrap: {
    marginHorizontal: 14,
    borderRadius: 14,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    backgroundColor: "#e2e8f0",
  },
  imagePlaceholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  ratingCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: "800",
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 4,
  },
  distText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  addressText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    marginBottom: 6,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
    fontWeight: "500",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    flex: 1,
    justifyContent: "center",
  },
  readBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});

export default React.memo(PlaceCard);

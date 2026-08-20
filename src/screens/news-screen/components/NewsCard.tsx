import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { NewsArticle, timeAgo } from "../../../services/newsService";

const { width: SCREEN_W } = Dimensions.get("window");

interface NewsCardProps {
  article: NewsArticle;
  cardHeight: number;
  isDark: boolean;
}

const PLACEHOLDER_COLORS: [string, string][] = [
  ["#111827", "#1f2937"],
  ["#0f3460", "#172554"],
  ["#2d132c", "#1f2937"],
  ["#1b1b2f", "#162447"],
  ["#0a3d62", "#1e3c72"],
];

const NewsCard: React.FC<NewsCardProps> = ({ article, cardHeight, isDark }) => {
  const [storyOpen, setStoryOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const openLink = useCallback(() => {
    if (article.link) void Linking.openURL(article.link);
  }, [article.link]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\nRead more: ${article.link}`,
      });
    } catch {}
  }, [article.title, article.link]);

  const placeholderIdx = article.title.charCodeAt(0) % PLACEHOLDER_COLORS.length;
  const relativeTime = useMemo(() => timeAgo(article.publishedAt), [article.publishedAt]);
  const imageH = cardHeight * 0.34;
  const hasImage = Boolean(article.imageUrl) && !imageFailed;
  const bg = isDark ? "#0f172a" : "#ffffff";
  const textPrimary = isDark ? "#f8fafc" : "#111827";
  const textSecondary = isDark ? "#cbd5e1" : "#475569";
  const accent = isDark ? "#9fbe96" : "#5B7553";
  const storyText = article.description?.trim() || "The full story is available from the publisher.";

  return (
    <View style={[styles.card, { height: cardHeight, backgroundColor: bg }]} collapsable={false}>
      <View style={styles.imageWrap}>
        {hasImage ? (
          <Image
            source={{ uri: article.imageUrl! }}
            style={[styles.image, { height: imageH }]}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <LinearGradient colors={PLACEHOLDER_COLORS[placeholderIdx]} style={[styles.imagePlaceholder, { height: imageH }]}>
            <Ionicons name="newspaper-outline" size={48} color="rgba(255,255,255,0.24)" />
          </LinearGradient>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.72)"]} style={styles.imageOverlay}>
          <Text style={styles.brandText}>uniflow</Text>
        </LinearGradient>
        <View style={styles.sourcePill}>
          <Text style={styles.sourceText}>{article.source || "News"}</Text>
        </View>
      </View>

      <View style={[styles.actionBar, { borderBottomColor: isDark ? "#273449" : "#e5e7eb" }]}>
        <Pressable onPress={handleShare} style={[styles.actionButton, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
          <Ionicons name="share-social-outline" size={19} color={textSecondary} />
          <Text style={[styles.actionLabel, { color: textSecondary }]}>Share</Text>
        </Pressable>
        <Pressable onPress={() => setStoryOpen(true)} style={[styles.actionButton, { backgroundColor: accent }]}>
          <Ionicons name="book-outline" size={19} color="#fff" />
          <Text style={styles.actionLabelLight}>Read more</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={[styles.headline, { color: textPrimary }]} numberOfLines={3}>{article.title}</Text>
        <View style={[styles.storyPanel, { backgroundColor: isDark ? "#20242D" : "#F1F3F5" }]}>
          <View style={styles.storyHeader}>
            <Ionicons name="document-text-outline" size={15} color={isDark ? "#F8FAFC" : "#111827"} />
            <Text style={[styles.storyLabel, { color: isDark ? "#F8FAFC" : "#111827" }]}>Story</Text>
          </View>
          <Text
            style={[styles.storyPreview, { color: isDark ? "#F8FAFC" : "#111827" }]}
            numberOfLines={5}
            ellipsizeMode="tail"
          >
            {storyText}
          </Text>
          <Pressable onPress={() => setStoryOpen(true)}><Text style={[styles.storyCta, { color: isDark ? "#B0C0FF" : "#334155" }]}>Open full story →</Text></Pressable>
        </View>
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {relativeTime ? <Text style={[styles.footerText, { color: textSecondary }]}>{relativeTime}</Text> : null}
            <Text style={[styles.footerText, { color: textSecondary }]}>• {article.source || "News"}</Text>
          </View>
          <Pressable onPress={openLink} style={[styles.publisherButton, { borderColor: accent }]}>
            <Text style={[styles.publisherText, { color: accent }]}>Publisher</Text>
            <Ionicons name="open-outline" size={12} color={accent} />
          </Pressable>
        </View>
      </View>

      <Modal visible={storyOpen} animationType="slide" transparent onRequestClose={() => setStoryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.storyModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Article</Text>
              <Pressable onPress={() => setStoryOpen(false)} accessibilityLabel="Close full story">
                <Ionicons name="close-circle" size={28} color="#cbd5e1" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              <Text style={styles.modalHeadline}>{article.title}</Text>
              <Text style={styles.modalBody}>{storyText}</Text>
              <Pressable onPress={openLink} style={styles.modalReadButton}>
                <Text style={styles.modalReadText}>Open publisher article</Text>
                <Ionicons name="open-outline" size={15} color="#fff" />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { width: SCREEN_W, overflow: "hidden" },
  imageWrap: { position: "relative", overflow: "hidden" },
  image: { width: "100%", backgroundColor: "#1e293b" },
  imagePlaceholder: { width: "100%", alignItems: "center", justifyContent: "center" },
  imageOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 56, justifyContent: "flex-end", paddingHorizontal: 18, paddingBottom: 10 },
  brandText: { fontSize: 14, fontWeight: "900", color: "rgba(255,255,255,0.78)", letterSpacing: 1.6 },
  sourcePill: { position: "absolute", top: 14, left: 14, backgroundColor: "rgba(0,0,0,0.64)", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 10 },
  sourceText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  actionBar: { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 1 },
  actionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minWidth: 100, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  actionLabel: { fontSize: 12, fontWeight: "800" },
  actionLabelLight: { color: "#fff", fontSize: 12, fontWeight: "900" },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
  headline: { fontSize: 22, fontWeight: "900", lineHeight: 29, letterSpacing: -0.35, marginBottom: 12 },
  storyPanel: { flex: 1, minHeight: 130, borderRadius: 18, padding: 16 },
  storyHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  storyLabel: { color: "#fff", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  storyPreview: { color: "#f8fafc", fontSize: 15, lineHeight: 23, flex: 1 },
  storyCta: { color: "#b8d7ad", fontSize: 12, fontWeight: "900", marginTop: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  footerText: { fontSize: 12, fontWeight: "700" },
  publisherButton: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7 },
  publisherText: { fontSize: 11, fontWeight: "900" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
  storyModal: { height: "86%", backgroundColor: "#050505", borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: "#273449" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  modalHeadline: { color: "#fff", fontSize: 24, lineHeight: 31, fontWeight: "900", marginBottom: 18 },
  modalBody: { color: "#f8fafc", fontSize: 16, lineHeight: 26 },
  modalReadButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#5B7553", borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, marginTop: 24 },
  modalReadText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});

export default React.memo(NewsCard);

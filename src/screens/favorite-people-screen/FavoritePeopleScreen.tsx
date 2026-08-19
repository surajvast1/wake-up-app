import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../contexts/ThemeContext";
import type { AppColors } from "../../theme/colors";
import {
  getFavoritePeople,
  addFavoritePerson,
  removeFavoritePerson,
} from "../../services/favoritePeopleService";
import { clearDailyQuoteCache } from "../../services/quoteService";

const FAMOUS_PEOPLE = [
  "Alex Hormozi", "Naval Ravikant", "Marcus Aurelius", "Steve Jobs",
  "Elon Musk", "Warren Buffett", "Oprah Winfrey", "David Goggins",
  "Rumi", "Seneca", "Tony Robbins", "Ray Dalio", "Kobe Bryant",
  "Maya Angelou", "Mahatma Gandhi", "Nelson Mandela", "Albert Einstein",
  "Nikola Tesla", "Bruce Lee", "Aristotle", "Jeff Bezos", "Charlie Munger",
  "Sam Walton", "Andrew Carnegie", "Denzel Washington", "Theodore Roosevelt",
  "Vince Lombardi", "Jim Rohn", "Zig Ziglar", "Les Brown",
  "Grant Cardone", "Gary Vaynerchuk", "Tim Ferriss", "Ryan Holiday",
  "Robert Greene", "Jordan Peterson", "Simon Sinek", "Brene Brown",
  "Malcolm X", "Martin Luther King Jr.", "Winston Churchill",
  "Abraham Lincoln", "Benjamin Franklin", "Thomas Edison",
  "Henry Ford", "Walt Disney", "Richard Branson", "Mark Cuban",
  "Peter Thiel", "Reid Hoffman", "Jack Ma", "Bill Gates",
  "Sundar Pichai", "Satya Nadella", "Steve Martin", "Conor McGregor",
  "Michael Jordan", "Muhammad Ali", "Mike Tyson", "Arnold Schwarzenegger",
  "Dwayne Johnson", "Will Smith", "Jay-Z", "Kanye West",
  "Steve Harvey", "Tyler Perry", "Kevin Hart", "Jim Carrey",
  "Robin Williams", "Bob Marley", "John Lennon", "Oscar Wilde",
  "Mark Twain", "Ernest Hemingway", "Leo Tolstoy", "Friedrich Nietzsche",
  "Confucius", "Lao Tzu", "Sun Tzu", "Socrates", "Plato",
  "Epictetus", "Miyamoto Musashi", "Dalai Lama", "Mother Teresa",
  "Swami Vivekananda", "Ratan Tata", "APJ Abdul Kalam",
  "Marie Curie", "Frida Kahlo", "Coco Chanel", "Indra Nooyi",
  "Sheryl Sandberg", "Michelle Obama", "Ruth Bader Ginsburg",
  "Helen Keller", "Eleanor Roosevelt", "Harriet Tubman",
  "Paulo Coelho", "Nassim Taleb", "Daniel Kahneman", "Yuval Noah Harari",
  "James Clear", "Cal Newport", "Stephen Covey", "Dale Carnegie",
  "Napoleon Hill", "Robert Kiyosaki", "Eckhart Tolle", "Deepak Chopra",
  "Sadhguru", "Alan Watts", "Carl Jung", "Sigmund Freud",
  "Stephen Hawking", "Carl Sagan", "Neil deGrasse Tyson",
  "Leonardo da Vinci", "Michelangelo", "Isaac Newton",
  "Charles Darwin", "Galileo Galilei", "Alexander the Great",
  "Napoleon Bonaparte", "Genghis Khan", "Julius Caesar",
  "Cleopatra", "Queen Elizabeth I", "Florence Nightingale",
  "Rosa Parks", "Malala Yousafzai", "Greta Thunberg",
  "Bob Dylan", "David Bowie", "Freddie Mercury", "Prince",
  "Whitney Houston", "Aretha Franklin", "Beyonce",
  "Cristiano Ronaldo", "Lionel Messi", "Serena Williams",
  "Roger Federer", "Usain Bolt", "Tom Brady", "LeBron James",
  "Tiger Woods", "Sachin Tendulkar", "Virat Kohli",
];

function createStyles(c: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 22,
      fontWeight: "900",
      color: c.text,
      marginLeft: 12,
    },
    desc: {
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    descText: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textSecondary,
      lineHeight: 20,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 4,
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: c.inputBg,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.inputBorder,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    addBtn: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnDisabled: { opacity: 0.4 },
    searchResults: {
      marginHorizontal: 16,
      marginBottom: 12,
      maxHeight: 180,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: "hidden",
    },
    searchItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    searchItemText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: c.text,
    },
    searchItemAdded: {
      fontSize: 11,
      fontWeight: "800",
      color: c.primary,
      textTransform: "uppercase",
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: c.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 20,
      marginBottom: 10,
      marginTop: 6,
    },
    personChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginHorizontal: 16,
      marginBottom: 8,
    },
    personName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
      color: c.text,
    },
    removeBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: c.dangerSoftBg,
      alignItems: "center",
      justifyContent: "center",
    },
    suggestionsWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
      marginBottom: 20,
    },
    suggestionChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.border,
    },
    suggestionChipAdded: {
      backgroundColor: c.primarySoftBg,
      borderColor: c.primary,
    },
    suggestionText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textSecondary,
    },
    suggestionTextAdded: {
      color: c.primary,
      fontWeight: "700",
    },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 32,
      paddingHorizontal: 40,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 12,
    },
    clearBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginHorizontal: 16,
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.dangerSoftBorder,
      backgroundColor: c.dangerSoftBg,
    },
    clearBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.danger,
    },
    note: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 6,
    },
    noteText: {
      fontSize: 12,
      fontWeight: "500",
      color: c.textMuted,
      lineHeight: 18,
      fontStyle: "italic",
    },
  });
}

const TOP_PICKS = FAMOUS_PEOPLE.slice(0, 20);

const FavoritePeopleScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors: c } = useAppTheme();
  const styles = useMemo(() => createStyles(c), [c]);

  const [people, setPeople] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    void getFavoritePeople().then(setPeople);
  }, []);

  const loweredPeople = useMemo(
    () => new Set(people.map((p) => p.toLowerCase())),
    [people]
  );

  const searchResults = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (q.length < 1) return [];
    return FAMOUS_PEOPLE.filter((name) =>
      name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [input]);

  const handleAdd = useCallback(
    async (name?: string) => {
      const trimmed = (name ?? input).trim();
      if (!trimmed) return;
      const updated = await addFavoritePerson(trimmed);
      setPeople(updated);
      setInput("");
      Keyboard.dismiss();
      await clearDailyQuoteCache();
    },
    [input]
  );

  const handleRemove = useCallback(async (name: string) => {
    const updated = await removeFavoritePerson(name);
    setPeople(updated);
    await clearDailyQuoteCache();
  }, []);

  const handleSuggestionPress = useCallback(
    async (name: string) => {
      const isAdded = loweredPeople.has(name.toLowerCase());
      if (isAdded) {
        const updated = await removeFavoritePerson(name);
        setPeople(updated);
      } else {
        const updated = await addFavoritePerson(name);
        setPeople(updated);
      }
      await clearDailyQuoteCache();
    },
    [loweredPeople]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      "Clear all people",
      "This will return to default quotes from various influential figures.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            const { setFavoritePeople } = await import(
              "../../services/favoritePeopleService"
            );
            await setFavoritePeople([]);
            setPeople([]);
            await clearDailyQuoteCache();
          },
        },
      ]
    );
  }, []);

  const renderPerson = useCallback(
    ({ item }: { item: string }) => (
      <View style={styles.personChip}>
        <Ionicons
          name="person-circle-outline"
          size={22}
          color={c.primary}
          style={{ marginRight: 12 }}
        />
        <Text style={styles.personName}>{item}</Text>
        <Pressable
          onPress={() => void handleRemove(item)}
          style={({ pressed }) => [
            styles.removeBtn,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={c.danger} />
        </Pressable>
      </View>
    ),
    [styles, c, handleRemove]
  );

  const header = (
    <>
      <View style={styles.desc}>
        <Text style={styles.descText}>
          Add people whose quotes inspire you. When set, your daily quote will
          come exclusively from these individuals. Leave empty to get quotes
          from a wide range of world-changers.
        </Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Search famous people..."
          placeholderTextColor={c.placeholder}
          returnKeyType="done"
          onSubmitEditing={() => void handleAdd()}
          autoCorrect={false}
        />
        <Pressable
          onPress={() => void handleAdd()}
          disabled={!input.trim()}
          style={({ pressed }) => [
            styles.addBtn,
            !input.trim() && styles.addBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {searchResults.length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.map((name) => {
            const isAdded = loweredPeople.has(name.toLowerCase());
            return (
              <Pressable
                key={name}
                onPress={() => {
                  if (!isAdded) void handleAdd(name);
                }}
                style={({ pressed }) => [
                  styles.searchItem,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.searchItemText}>{name}</Text>
                {isAdded ? (
                  <Text style={styles.searchItemAdded}>Added</Text>
                ) : (
                  <Ionicons name="add-circle-outline" size={20} color={c.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {input.trim().length === 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Popular</Text>
          <View style={styles.suggestionsWrap}>
            {TOP_PICKS.map((s) => {
              const isAdded = loweredPeople.has(s.toLowerCase());
              return (
                <Pressable
                  key={s}
                  onPress={() => void handleSuggestionPress(s)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    isAdded && styles.suggestionChipAdded,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.suggestionText,
                      isAdded && styles.suggestionTextAdded,
                    ]}
                  >
                    {isAdded ? `\u2713 ${s}` : s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>
        Your People {people.length > 0 ? `(${people.length})` : ""}
      </Text>

      {people.length === 0 && (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={36} color={c.textMuted} />
          <Text style={styles.emptyText}>
            No one added yet. Search above or tap a suggestion to get
            quotes from specific people.
          </Text>
        </View>
      )}
    </>
  );

  const footer = (
    <>
      {people.length > 0 && (
        <Pressable
          onPress={handleClearAll}
          style={({ pressed }) => [
            styles.clearBtn,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="trash-outline" size={16} color={c.danger} />
          <Text style={styles.clearBtnText}>Clear All</Text>
        </Pressable>
      )}
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Tip: After changing this list, refresh the quote on your homepage (3-dot
          menu \u2192 New quote) to see the effect immediately.
        </Text>
      </View>
      <View style={{ height: 40 }} />
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Quote Sources</Text>
      </View>

      <FlatList
        data={people}
        keyExtractor={(item) => item}
        renderItem={renderPerson}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default FavoritePeopleScreen;

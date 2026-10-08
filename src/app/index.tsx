import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { listHistory, type HistoryItem } from "../lib/history";
import { useTheme } from "../lib/theme";
import type { Category } from "../lib/types";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "animal", label: "Animal" },
  { value: "plant", label: "Plant" },
];

export default function Home() {
  const theme = useTheme();
  const [category, setCategory] = useState<Category>("auto");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      listHistory().then(setHistory).catch(() => setHistory([]));
    }, []),
  );

  async function pickFromGallery() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    if (picked.canceled || picked.assets.length === 0) return;
    router.push({ pathname: "/result", params: { uri: picked.assets[0].uri, category } });
  }

  const header = (
    <View style={styles.header}>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Take or choose a photo of an animal or plant to find out what it is.
      </Text>

      <View style={[styles.segment, { borderColor: theme.border, backgroundColor: theme.card }]}>
        {CATEGORIES.map((c) => {
          const selected = c.value === category;
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[styles.segmentItem, selected && { backgroundColor: theme.primary }]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={{ color: selected ? theme.primaryText : theme.text, fontWeight: "600" }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={() => router.push({ pathname: "/camera", params: { category } })}
      >
        <Text style={[styles.buttonText, { color: theme.primaryText }]}>Take a photo</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.secondary, { borderColor: theme.primary }]}
        onPress={pickFromGallery}
      >
        <Text style={[styles.buttonText, { color: theme.primary }]}>Choose from gallery</Text>
      </Pressable>

      {history.length > 0 && (
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent</Text>
      )}
    </View>
  );

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push({ pathname: "/result", params: { historyId: String(item.id) } })}
        >
          <Image
            source={{ uri: item.photoUri || item.result.referenceImageUrl }}
            style={styles.thumb}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
              {item.result.commonName || item.result.scientificName || "Unknown"}
            </Text>
            <Text style={[styles.rowSub, { color: theme.muted }]} numberOfLines={1}>
              {item.result.scientificName}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  subtitle: { fontSize: 16, lineHeight: 22 },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 4, marginTop: 4 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
  button: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  secondary: { borderWidth: 2 },
  buttonText: { fontSize: 17, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#8884" },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSub: { fontSize: 14, fontStyle: "italic" },
});

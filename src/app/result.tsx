import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { identifyPhoto } from "../lib/api";
import { getHistoryItem, saveToHistory } from "../lib/history";
import { useTheme, type Theme } from "../lib/theme";
import type { Category, IdentifyResult } from "../lib/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; photoUri: string; result: IdentifyResult };

export default function ResultScreen() {
  const params = useLocalSearchParams<{ uri?: string; category?: string; historyId?: string }>();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    async function load() {
      if (params.historyId) {
        const item = await getHistoryItem(Number(params.historyId));
        if (!item) throw new Error("This saved result no longer exists.");
        return { photoUri: item.photoUri, result: item.result };
      }
      if (!params.uri) throw new Error("No photo was provided.");
      const category = (params.category ?? "auto") as Category;
      const result = await identifyPhoto(params.uri, category);
      if (result.kind !== "none") await saveToHistory(params.uri, result);
      return { photoUri: params.uri, result };
    }

    load()
      .then((data) => !cancelled && setState({ status: "done", ...data }))
      .catch(
        (err: unknown) =>
          !cancelled &&
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Something went wrong.",
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [params.uri, params.category, params.historyId, attempt]);

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        {params.uri && <Image source={{ uri: params.uri }} style={styles.loadingPhoto} />}
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.muted, fontSize: 16 }}>Identifying…</Text>
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={{ color: theme.text, fontSize: 17, textAlign: "center" }}>{state.message}</Text>
        {params.uri && (
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={() => setAttempt((n) => n + 1)}
          >
            <Text style={{ color: theme.primaryText, fontWeight: "700" }}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { result, photoUri } = state;

  if (result.kind === "none") {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Image source={{ uri: photoUri }} style={styles.loadingPhoto} />
        <Text style={{ color: theme.text, fontSize: 17, textAlign: "center" }}>
          No animal or plant found in this photo. Try getting closer, with the subject in focus.
        </Text>
        <Pressable
          style={[styles.button, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: theme.primaryText, fontWeight: "700" }}>Try another photo</Text>
        </Pressable>
      </View>
    );
  }

  const confidence = Math.round(result.confidence * 100);
  const lowConfidence = result.confidence < 0.5;
  const facts: [string, string][] = (
    [
      ["Habitat", result.habitat],
      ["Native range", result.nativeRange],
      ["Size", result.size],
      ["Diet", result.diet],
      ["Lifespan", result.lifespan],
      ["Conservation status", result.conservationStatus],
    ] as [string, string][]
  ).filter(([, value]) => value);
  const taxonomy = Object.entries(result.taxonomy).filter(([, v]) => v) as [string, string][];
  const hasSafetyRisk = result.safety.venomous || result.safety.toxic || result.safety.invasive;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Image source={{ uri: photoUri }} style={styles.photo} />

      <View style={styles.titleBlock}>
        <Text style={[styles.common, { color: theme.text }]}>
          {result.commonName || result.scientificName}
        </Text>
        <Text style={[styles.scientific, { color: theme.muted }]}>{result.scientificName}</Text>
        <Text style={{ color: lowConfidence ? theme.warning : theme.muted }}>
          {confidence}% match{result.verified ? " · verified name" : ""}
          {lowConfidence ? " · not sure, check the alternatives" : ""}
        </Text>
      </View>

      {hasSafetyRisk && (
        <View style={[styles.card, { backgroundColor: theme.warningBg, borderColor: theme.warning }]}>
          <Text style={[styles.cardTitle, { color: theme.warning }]}>
            {[
              result.safety.venomous && "Venomous",
              result.safety.toxic && "Toxic",
              result.safety.invasive && "Invasive",
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {!!result.safety.notes && <Text style={{ color: theme.text }}>{result.safety.notes}</Text>}
        </View>
      )}

      {!!result.description && (
        <Section title="About" theme={theme}>
          <Text style={[styles.body, { color: theme.text }]}>{result.description}</Text>
        </Section>
      )}

      {facts.length > 0 && (
        <Section title="Quick facts" theme={theme}>
          {facts.map(([label, value]) => (
            <Row key={label} label={label} value={value} theme={theme} />
          ))}
        </Section>
      )}

      {taxonomy.length > 0 && (
        <Section title="Classification" theme={theme}>
          {taxonomy.map(([rank, name]) => (
            <Row key={rank} label={capitalize(rank)} value={name} theme={theme} italic={rank === "genus"} />
          ))}
        </Section>
      )}

      {result.funFacts.length > 0 && (
        <Section title="Did you know?" theme={theme}>
          {result.funFacts.map((fact) => (
            <Text key={fact} style={[styles.body, { color: theme.text }]}>• {fact}</Text>
          ))}
        </Section>
      )}

      {result.alternatives.length > 0 && (
        <Section title="Could also be" theme={theme}>
          {result.alternatives.map((alt) => (
            <Row
              key={alt.scientificName}
              label={alt.commonName || alt.scientificName}
              value={`${alt.scientificName} · ${Math.round(alt.confidence * 100)}%`}
              theme={theme}
            />
          ))}
        </Section>
      )}

      <View style={styles.links}>
        {result.wikipediaUrl && (
          <Link label="Read on Wikipedia" url={result.wikipediaUrl} theme={theme} />
        )}
        {result.gbifUrl && <Link label="View on GBIF" url={result.gbifUrl} theme={theme} />}
      </View>

      <Text style={[styles.disclaimer, { color: theme.muted }]}>
        Identification by AI{result.sources.length > 1 ? ` with ${result.sources.slice(1).join(", ")}` : ""}.
        It can be wrong. Never use this app to decide whether something is safe to eat or touch.
      </Text>
    </ScrollView>
  );
}

function Section(props: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: props.theme.card, borderColor: props.theme.border }]}>
      <Text style={[styles.cardTitle, { color: props.theme.text }]}>{props.title}</Text>
      {props.children}
    </View>
  );
}

function Row(props: { label: string; value: string; theme: Theme; italic?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: props.theme.muted }]}>{props.label}</Text>
      <Text
        style={[styles.rowValue, { color: props.theme.text }, props.italic && { fontStyle: "italic" }]}
      >
        {props.value}
      </Text>
    </View>
  );
}

function Link(props: { label: string; url: string; theme: Theme }) {
  return (
    <Pressable onPress={() => Linking.openURL(props.url)}>
      <Text style={{ color: props.theme.primary, fontSize: 16, fontWeight: "600" }}>{props.label}</Text>
    </Pressable>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingPhoto: { width: 200, height: 200, borderRadius: 16 },
  button: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16 },
  titleBlock: { gap: 2, marginVertical: 4 },
  common: { fontSize: 28, fontWeight: "800" },
  scientific: { fontSize: 19, fontStyle: "italic" },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { fontSize: 15, flexShrink: 0 },
  rowValue: { fontSize: 15, flex: 1, textAlign: "right" },
  links: { flexDirection: "row", gap: 20, marginTop: 4 },
  disclaimer: { fontSize: 13, lineHeight: 18, marginTop: 8 },
});

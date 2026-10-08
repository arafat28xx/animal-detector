import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../lib/theme";

export default function RootLayout() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Animal Detector" }} />
        <Stack.Screen name="camera" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ title: "Result" }} />
      </Stack>
    </>
  );
}

import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CameraScreen() {
  const { category = "auto" } = useLocalSearchParams<{ category?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 24, gap: 16 }]}>
        <Text style={styles.message}>
          Animal Detector needs the camera to photograph animals and plants.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionText}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.message}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  async function capture() {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (photo) router.replace({ pathname: "/result", params: { uri: photo.uri, category } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      <Pressable
        style={[styles.close, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        accessibilityLabel="Close camera"
      >
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
      <View style={[styles.controls, { bottom: insets.bottom + 32 }]}>
        <Pressable
          style={styles.shutter}
          onPress={capture}
          disabled={busy}
          accessibilityLabel="Take photo"
        >
          {busy ? <ActivityIndicator /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  message: { color: "#fff", fontSize: 16, textAlign: "center" },
  permissionButton: { backgroundColor: "#7FC08A", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permissionText: { color: "#0D1A0F", fontSize: 16, fontWeight: "700" },
  close: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0008",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { color: "#fff", fontSize: 20 },
  controls: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
});

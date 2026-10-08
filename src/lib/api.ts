import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { Category, IdentifyResponse, IdentifyResult } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const REQUEST_TIMEOUT_MS = 45_000;

/** Shrinks the photo so uploads stay fast and cheap, then returns JPEG base64. */
async function prepareImage(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error("Could not read the photo.");
  return saved.base64;
}

export async function identifyPhoto(uri: string, category: Category): Promise<IdentifyResult> {
  if (!API_URL) {
    throw new Error("The app is not connected to a server yet (EXPO_PUBLIC_API_URL is not set).");
  }
  const image = await prepareImage(uri);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/identify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image, category }),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new Error("That took too long. Please try again.");
    }
    throw new Error("No internet connection. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as IdentifyResponse | null;
  if (!data) throw new Error("The server sent an unexpected reply.");
  if (!data.ok) throw new Error(data.error);
  return data.result;
}

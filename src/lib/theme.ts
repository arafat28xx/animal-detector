import { useColorScheme } from "react-native";

const light = {
  background: "#F6F7F2",
  card: "#FFFFFF",
  text: "#1C2118",
  muted: "#5E6858",
  border: "#E1E5DA",
  primary: "#2F6B3A",
  primaryText: "#FFFFFF",
  warning: "#B4541A",
  warningBg: "#FCEFE5",
};

const dark: typeof light = {
  background: "#11140F",
  card: "#1B2018",
  text: "#EEF1EA",
  muted: "#A3AD9C",
  border: "#2C3328",
  primary: "#7FC08A",
  primaryText: "#0D1A0F",
  warning: "#F0A06B",
  warningBg: "#3A2416",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.phillj26.streamline",
  appName: "Streamline",
  webDir: "../web/dist",
  server: {
    androidScheme: "https"
  }
};

export default config;

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Network } from "@capacitor/network";
import { ScreenOrientation } from "@capacitor/screen-orientation";

export interface DeviceLocation {
  latitude: number;
  longitude: number;
}

export const isNativeRuntime = Capacitor.isNativePlatform();

export async function getDeviceLocation(): Promise<DeviceLocation> {
  if (isNativeRuntime) {
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== "granted" && permissions.coarseLocation !== "granted") {
      await Geolocation.requestPermissions({ permissions: ["coarseLocation"] });
    }
  }

  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    maximumAge: 5 * 60 * 1000,
    timeout: 15_000
  });
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
}

export async function openProviderLink(url: string): Promise<void> {
  if (isNativeRuntime) {
    await Browser.open({ toolbarColor: "#0B0E17", url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function lockPlayerOrientation(): Promise<void> {
  if (isNativeRuntime) {
    await ScreenOrientation.lock({ orientation: "landscape" }).catch(() => undefined);
  }
}

export async function restoreOrientation(): Promise<void> {
  if (isNativeRuntime) {
    await ScreenOrientation.unlock().catch(() => undefined);
  }
}

export async function registerRefreshTriggers(onRefresh: () => void): Promise<() => void> {
  const appHandle = await App.addListener("resume", onRefresh);
  const networkHandle = await Network.addListener("networkStatusChange", (status) => {
    if (status.connected) {
      onRefresh();
    }
  });

  return () => {
    void Promise.all([appHandle.remove(), networkHandle.remove()]);
  };
}

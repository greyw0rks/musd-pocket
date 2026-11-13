import { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/app/providers";
import { AuthGate } from "@/components/auth-gate";
import HomePage from "@/app/(app)/home/page";
import { Checkout } from "@/components/checkout/Checkout";
import { ToastProvider } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/session";
import { normalizeRequestId } from "@/lib/requests/links";
import { installNativeAdapters } from "@/lib/native/client";
import "./mobile.css";

installNativeAdapters();

function Recovery({ message }: { message: string }) {
  return <main className="boot"><h1>mPocket</h1><p role="alert">{message}</p><button onClick={() => location.reload()}>Try again</button><a href="https://mpocket.tech/home?browser=1">Open in browser</a></main>;
}

class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Recovery message="The app could not open this screen. Please try again." /> : this.props.children; }
}

function ConnectionGate({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  // Keep the mounted wallet and its transaction journal during a connection loss.
  return <><div hidden={online} className="connection-status" role="status">You’re offline. Connect to refresh your wallet or make a payment.</div>{children}</>;
}

function SessionReady({ children }: { children: ReactNode }) {
  const { ready } = useSession();
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setExpired(true), 25_000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!ready && expired) return <Recovery message="Sign-in could not connect. Check your internet connection and try again." />;
  return <AuthGate>{children}</AuthGate>;
}

function Route() {
  if (location.pathname.startsWith("/pay/")) {
    const shortId = normalizeRequestId(location.pathname.split("/")[2]);
    return shortId ? <Checkout shortId={shortId} /> : <Recovery message="This payment link is invalid." />;
  }
  return <HomePage />;
}

function AppContent() {
  if (location.pathname.startsWith("/pay/") && !normalizeRequestId(location.pathname.split("/")[2])) {
    return <Recovery message="This payment link is invalid." />;
  }
  return <Providers><SessionReady><Route /></SessionReady></Providers>;
}

createRoot(document.getElementById("root")!).render(
  <AppBoundary><ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    <ToastProvider><ConnectionGate><AppContent /></ConnectionGate></ToastProvider>
  </ThemeProvider></AppBoundary>,
);
clearTimeout((window as Window & { __pocketBoot?: number }).__pocketBoot);

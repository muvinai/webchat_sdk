/*
  Web Events SDK — single-file, framework-friendly (React helpers included)
  ---------------------------------------------------------------
  Goals:
  - Minimal API for the chat agent to query recent user actions on the website
  - Easy install in React apps (Provider + hook) but usable without React
  - Optional persistence (memory / sessionStorage / localStorage)
  - Small, typed, and tree-shakeable

  Public API:
  - createWebEventsSDK(options)
  - sdk.track(name: string, note?: string, metadata?: Record<string, any>): WebEvent
  - sdk.getEvents(): WebEvent[]
  - sdk.clear(): void
  - sdk.subscribe(listener: (events: WebEvent[]) => void): () => void

  React helpers (optional):
  - <WebEventsProvider sdk={sdk}> ...
  - useWebEvents(): { track, getEvents, clear, events }

  Notes:
  - "note" is a brief human hint for the agent; "metadata" is machine-oriented
  - By default, the SDK keeps only the most recent N events (default 50)
  - Safe to expose sdk.getEvents() to the chat widget via a small bridge
*/

// -------------------- Types --------------------
export type StorageMode = "memory" | "session" | "local";

export interface WebEvent {
  id: string;                 // uuid-like id
  name: string;               // event name (e.g., "checkout_payment_failed")
  note?: string;              // short human note for the agent
  metadata?: Record<string, any>; // optional structured data
  path: string;               // window.location.pathname
  title?: string;             // document.title (when available)
  referrer?: string;          // document.referrer
  ts: string;                 // ISO timestamp
  tsMs: number;               // epoch ms for quick comparisons
  sessionId: string;          // stable for browser session
  pageId: string;             // unique id per page load
  viewport?: { w: number; h: number };
}

export interface SDKOptions {
  storage?: StorageMode;      // default: "memory"
  storageKey?: string;        // default: "__web_events_sdk__"
  maxEvents?: number;         // default: 50
}

export interface WebEventsSDK {
  track: (name: string, note?: string, metadata?: Record<string, any>) => WebEvent;
  getEvents: () => WebEvent[];
  clear: () => void;
  subscribe: (listener: (events: WebEvent[]) => void) => () => void;
}

// -------------------- Utilities --------------------
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const now = () => {
  const d = new Date();
  return { iso: d.toISOString(), ms: d.getTime() };
};

const getViewport = () => ({ w: window.innerWidth, h: window.innerHeight });

const safeTitle = () => (typeof document !== "undefined" ? document.title : undefined);
const safeReferrer = () => (typeof document !== "undefined" ? document.referrer : undefined);
const safePath = () => (typeof location !== "undefined" ? location.pathname + location.search : "");

const getSessionId = (): string => {
  const KEY = "__web_events_session_id__";
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const sid = uuid();
    sessionStorage.setItem(KEY, sid);
    return sid;
  } catch {
    // Fallback if sessionStorage is unavailable
    (window as any)._fallbackSessionId = (window as any)._fallbackSessionId || uuid();
    return (window as any)._fallbackSessionId;
  }
};

const getPageId = (): string => {
  const KEY = "__web_events_page_id__";
  // Scoped to page-load only; regenerate on refresh/hard navigation
  if (!(window as any)[KEY]) (window as any)[KEY] = uuid();
  return (window as any)[KEY];
};

// -------------------- Persistence Layer --------------------
interface Store {
  load: () => WebEvent[];
  save: (events: WebEvent[]) => void;
}

const createStore = (mode: StorageMode, key: string): Store => {
  if (mode === "session") {
    return {
      load: () => {
        try { return JSON.parse(sessionStorage.getItem(key) || "[]"); } catch { return []; }
      },
      save: (events) => {
        try { sessionStorage.setItem(key, JSON.stringify(events)); } catch {}
      }
    };
  }
  if (mode === "local") {
    return {
      load: () => {
        try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
      },
      save: (events) => {
        try { localStorage.setItem(key, JSON.stringify(events)); } catch {}
      }
    };
  }
  // memory (default)
  let memory: WebEvent[] = [];
  return {
    load: () => memory,
    save: (events) => { memory = events; }
  };
};

// -------------------- Core SDK --------------------
export const createWebEventsSDK = (options: SDKOptions = {}): WebEventsSDK => {
  const storage = options.storage || "memory";
  const storageKey = options.storageKey || "__web_events_sdk__";
  const maxEvents = Math.max(1, options.maxEvents ?? 50);

  const store = createStore(storage, storageKey);
  let events: WebEvent[] = store.load();
  const listeners = new Set<(events: WebEvent[]) => void>();

  const emit = () => listeners.forEach(l => l([...events]));

  const track: WebEventsSDK["track"] = (name, note, metadata) => {
    const { iso, ms } = now();
    const evt: WebEvent = {
      id: uuid(),
      name,
      note,
      metadata,
      path: safePath(),
      title: safeTitle(),
      referrer: safeReferrer(),
      ts: iso,
      tsMs: ms,
      sessionId: getSessionId(),
      pageId: getPageId(),
      viewport: getViewport(),
    };
    events = [...events, evt].slice(-maxEvents);
    store.save(events);
    emit();
    return evt;
  };

  const getEvents: WebEventsSDK["getEvents"] = () => [...events];

  const clear: WebEventsSDK["clear"] = () => {
    events = [];
    store.save(events);
    emit();
  };

  const subscribe: WebEventsSDK["subscribe"] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { track, getEvents, clear, subscribe };
};

// -------------------- React Helpers (optional) --------------------
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

interface Ctx {
  sdk: WebEventsSDK;
  events: WebEvent[];
  track: WebEventsSDK["track"];
  getEvents: WebEventsSDK["getEvents"];
  clear: WebEventsSDK["clear"];
}

const WebEventsContext = createContext<Ctx | null>(null);

export const WebEventsProvider: React.FC<{ sdk?: WebEventsSDK; options?: SDKOptions; children: React.ReactNode }>
= ({ sdk, options, children }) => {
  const instance = useMemo(() => sdk || createWebEventsSDK(options), [sdk, options]);
  const [events, setEvents] = useState<WebEvent[]>(() => instance.getEvents());

  useEffect(() => instance.subscribe(setEvents), [instance]);

  const value: Ctx = useMemo(() => ({
    sdk: instance,
    events,
    track: instance.track,
    getEvents: instance.getEvents,
    clear: instance.clear,
  }), [instance, events]);

  return <WebEventsContext.Provider value={value}>{children}</WebEventsContext.Provider>;
};

export const useWebEvents = () => {
  const ctx = useContext(WebEventsContext);
  if (!ctx) throw new Error("useWebEvents must be used within <WebEventsProvider>");
  return ctx;
};

// -------------------- Bridge for the chat widget --------------------
// Optional: expose a safe, read-only surface to the chat widget
// so it can pull recent events without importing React.
export const attachChatBridge = (sdk: WebEventsSDK, globalKey = "ChatEvents") => {
  (window as any)[globalKey] = {
    getEvents: () => sdk.getEvents(),
  };
  return () => { delete (window as any)[globalKey]; };
};

// -------------------- Example usage --------------------
/*
// 1) App root (React)
import { WebEventsProvider, createWebEventsSDK, attachChatBridge } from "./web-events-sdk";

const sdk = createWebEventsSDK({ storage: "session", maxEvents: 100 });
attachChatBridge(sdk); // window.ChatEvents.getEvents()

export function AppRoot() {
  return (
    <WebEventsProvider sdk={sdk}>
      <App />
    </WebEventsProvider>
  );
}

// 2) Tracking a domain event (e.g., after a failed payment attempt)
import { useWebEvents } from "./web-events-sdk";

function Checkout() {
  const { track } = useWebEvents();

  const onPaymentRejected = (reasonCode: string) => {
    track("checkout_payment_failed", "Pago rechazado en checkout", { reasonCode });
  };

  // ...
}

// 3) Chat widget proactively opens on specific events
// (Pseudo-code inside your chat widget)
const events = window.ChatEvents?.getEvents?.() || [];
const last = events[events.length - 1];
if (last?.name === "checkout_payment_failed") {
  openChatWithMessage(
    "Vemos que se rechazó tu pago. ¿Querés que te guíe para reintentar o probar otro método?"
  );
}
*/

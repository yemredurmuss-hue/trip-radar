// Web build (localhost): the extension APIs the board and its worker use, answered inside the page. Imported first by
// src/web/main.ts, so it runs before any module that touches `chrome`. The worker (src/background.ts) runs in this
// same page: messages go straight to its listeners, alarms become timers. What only an extension can do (read another
// site's page, badges, the popup, content scripts) answers "nothing": capture stays the extension's job.

type Listener = (...args: any[]) => unknown;

function event() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    addListener: (fn: Listener) => void listeners.add(fn),
    removeListener: (fn: Listener) => void listeners.delete(fn),
    hasListener: (fn: Listener) => listeners.has(fn),
  };
}

// Any API not written out below: a namespace whose methods resolve to undefined and whose events never fire.
function inert(): any {
  const fn = () => Promise.resolve(undefined);
  return new Proxy(fn, {
    get(_t, key) {
      if (key === "then") return undefined;
      if (typeof key === "string" && /^on[A-Z]/.test(key)) return event();
      return inert();
    },
    apply: () => Promise.resolve(undefined),
  });
}

function withFallback<T extends object>(api: T): T {
  return new Proxy(api, { get: (t, key) => (key in t ? (t as any)[key] : inert()) });
}

const onChanged = event();

function area(name: "local" | "session", store: Storage) {
  const prefix = `trip-radar:${name}:`;
  const read = (key: string): unknown => {
    const raw = store.getItem(prefix + key);
    return raw == null ? undefined : JSON.parse(raw);
  };
  const allKeys = () =>
    Array.from({ length: store.length }, (_, i) => store.key(i)!)
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  const notify = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
    if (Object.keys(changes).length) for (const fn of onChanged.listeners) fn(changes, name);
  };
  return withFallback({
    async get(keys?: string | string[] | Record<string, unknown> | null) {
      const out: Record<string, unknown> = {};
      if (keys == null) for (const k of allKeys()) out[k] = read(k);
      else if (typeof keys === "string") keys = [keys];
      if (Array.isArray(keys)) {
        for (const k of keys) {
          const v = read(k);
          if (v !== undefined) out[k] = v;
        }
      } else if (keys && typeof keys === "object") {
        for (const [k, fallback] of Object.entries(keys)) out[k] = read(k) ?? fallback;
      }
      return out;
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [k, v] of Object.entries(items)) {
        if (v === undefined) continue;
        changes[k] = { oldValue: read(k), newValue: v };
        store.setItem(prefix + k, JSON.stringify(v));
      }
      notify(changes);
    },
    async remove(keys: string | string[]) {
      const changes: Record<string, { oldValue?: unknown }> = {};
      for (const k of typeof keys === "string" ? [keys] : keys) {
        const old = read(k);
        if (old === undefined) continue;
        changes[k] = { oldValue: old };
        store.removeItem(prefix + k);
      }
      notify(changes);
    },
    async clear() {
      const changes: Record<string, { oldValue?: unknown }> = {};
      for (const k of allKeys()) {
        changes[k] = { oldValue: read(k) };
        store.removeItem(prefix + k);
      }
      notify(changes);
    },
    async getBytesInUse() {
      return allKeys().reduce((n, k) => n + (store.getItem(prefix + k)?.length ?? 0), 0);
    },
  });
}

const onMessage = event();
const onStartup = event();
const sender = { id: "web", url: location.href };

/** The worker's listeners answer as they do in the extension: sendResponse, or `true` and an answer later. */
function sendMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    let answered = false;
    let pending = false;
    const sendResponse = (value: unknown) => {
      if (answered) return;
      answered = true;
      resolve(value);
    };
    for (const fn of onMessage.listeners) if (fn(message, sender, sendResponse) === true) pending = true;
    if (!pending && !answered) resolve(undefined);
  });
}

const onAlarm = event();
const alarms = new Map<string, ReturnType<typeof setTimeout>>();

const manifest = { version: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0", host_permissions: [] as string[] };
const url = (path: string) => new URL(path, `${location.origin}/`).href;

(globalThis as any).chrome = withFallback({
  storage: withFallback({ local: area("local", localStorage), session: area("session", sessionStorage), onChanged }),
  runtime: withFallback({
    id: "web",
    lastError: undefined,
    ContextType: { TAB: "TAB", POPUP: "POPUP" },
    onMessage,
    onStartup,
    sendMessage,
    getURL: url,
    getManifest: () => manifest,
    getPlatformInfo: async () => ({ os: "web" }),
    // The worker reloads to apply an update or when no board is open; the page is the board, so it never does.
    getContexts: async () => [{ contextType: "TAB" }],
    reload: () => undefined,
  }),
  tabs: withFallback({
    // Our own pages open in this tab (the board has one tab); other sites in a new one.
    async create({ url: target }: { url?: string }) {
      if (!target) return undefined;
      if (new URL(target, location.href).origin === location.origin) location.assign(target);
      else window.open(target, "_blank", "noopener");
      return undefined;
    },
    query: async () => [],
    onRemoved: event(),
    onUpdated: event(),
  }),
  alarms: withFallback({
    create(name: string, info: { delayInMinutes?: number; periodInMinutes?: number }) {
      clearTimeout(alarms.get(name));
      const fire = () => {
        for (const fn of onAlarm.listeners) fn({ name });
        if (info.periodInMinutes) alarms.set(name, setTimeout(fire, info.periodInMinutes * 60_000));
      };
      alarms.set(name, setTimeout(fire, (info.delayInMinutes ?? info.periodInMinutes ?? 0) * 60_000));
    },
    clear: async (name: string) => (clearTimeout(alarms.get(name)), alarms.delete(name)),
    onAlarm,
  }),
  // Absent, not inert: the code checks `chrome.scripting?.…` before registering the companion, and reading a page
  // from here should fail as the extension does without the permission.
  scripting: undefined,
  permissions: withFallback({
    contains: async () => false,
    getAll: async () => ({ permissions: [], origins: [] }),
    request: async () => false,
    remove: async () => false,
    onAdded: event(),
    onRemoved: event(),
  }),
});

/** Called by src/web/main.ts once every module is loaded: what the extension does when the browser starts. */
export function startWorker(): void {
  for (const fn of onStartup.listeners) fn();
}

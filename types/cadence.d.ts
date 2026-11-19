// The plugin API, as public/core.js makeApi() builds it (user, 2026-11-17: type checking without a build step).
// `npm run typecheck` (scripts/typecheck.mjs) runs tsc over public/plugins/*.js with these types and fails on a plugin
// using a part of the API that doesn't exist (a typo, a renamed call, a removed one). Nothing is compiled: the app runs
// the same JavaScript as before. When you add to makeApi(), add it here too (the check reminds you: a plugin using
// the new call fails until it's declared).
// Data records stay loose (`[k: string]: any`) on purpose: tasks, clients and meetings carry plugin fields.

interface CadenceTask { id: string; title: string; clientId?: string | null; owner?: string; done?: boolean; dueDate?: string | null; dueTime?: string | null; [k: string]: any }
interface CadenceClient { id: string; name: string; [k: string]: any }
interface CadenceMeeting { id: string; clientId?: string | null; start?: number; [k: string]: any }
type CadenceHtml = string;
interface CadenceSearchHit { title: string; k?: string; run(): any }

interface CadenceApiTasks {
  list(filter?: (t: CadenceTask) => any): CadenceTask[];
  get(id: string): CadenceTask | null;
  add(p: Partial<CadenceTask>): CadenceTask;
  update(id: string, patch: Partial<CadenceTask>): void;
  complete(id: string): void;
  remove(id: string): void;
  quickAdd(text: string, ctx?: any): CadenceTask;
}
interface CadenceApiClients {
  list(): CadenceClient[];
  get(id: string): CadenceClient | null;
  add(name: string): CadenceClient;
  update(id: string, patch: Partial<CadenceClient>): void;
}
interface CadenceApiMeetings {
  list(): CadenceMeeting[];
  active(): any;
  start(clientId?: string | null, notes?: string): any;
  importNotes(clientId?: string | null): void;
}
interface CadenceIslandHandle { update(...a: any[]): void; done(p?: any): void; dismiss(): void; [k: string]: any }
interface CadenceApiIsland {
  available(): boolean;
  notify(n: any): any;
  show(n: any): CadenceIslandHandle;
  celebrate(n: any): CadenceIslandHandle;
  progress(key: string, title: string, o?: any): CadenceIslandHandle;
  live(key: string, l: any): any;
  clear(key: string): any;
}
interface CadenceApiToday { schedule(fn: (...a: any[]) => any, head?: any): void; refresh(): void }
interface CadenceApiWidgets {
  add(w: { id: string; title: string; render: (el: HTMLElement, api: CadenceApi, ctx: any) => any; [k: string]: any }): void;
  list(): any[];
  render(key: string, el: HTMLElement, ctx?: any): boolean;
}
interface CadenceApiUi {
  /** placeholder outlines (a title line and `cards` cards) while a page or section is on its way */
  skeleton(cards?: number, label?: string): string;
  icon(name: string, ...a: any[]): CadenceHtml;
  reducedMotion(): boolean;
  toast(msg: string, actions?: any[], opts?: any): any;
  ask(...a: any[]): any;
  refreshSide(): void;
  taskRow(t: any, o?: any): CadenceHtml;
  openTask(id: string): void;
  selected(): any;
  closeTask(): void;
  colorMode(): 'dark' | 'light';
  setColorMode(m: string): void;
  /** Settings, on a tab: 'general' | 'plugins' | 'connections' | 'dev' | 'data' */
  openSettings(tab?: string): void;
  refreshWidgets(): void;
  pointer(): { x: number; y: number; [k: string]: any };
  faviconUrl(domain: string, v?: any): string;
  logo(site: string, opts?: { img?: string; size?: number; cls?: string }): CadenceHtml;
  avatar(c: any, size?: number): CadenceHtml;
  navigate(route: string): void;
  refresh(): void;
  copy(text: string, ...a: any[]): any;
  esc(s: any): string;
  modal(...a: any[]): any;
  close(): void;
  currentRoute(): string;
  empty(title: string, sub?: string, icon?: string, small?: boolean): CadenceHtml;
}
interface CadenceApiSystem {
  demo: boolean; space: string; mode: 'nas' | 'claude' | 'local'; status: any; lastSyncAt: number | null; latency: number | null;
  ai: boolean; health: any; version: string; plugins: number; counts: { tasks: number; open: number; clients: number; meetings: number };
}
interface CadenceApiUtil {
  parse(input: string, ctx?: any): any; ymd(d: Date): string; fmtDate(...a: any[]): string; dueLabel(...a: any[]): string; addDays(...a: any[]): any;
  todayKey(): string; dueState(t: any): string; fromYmd(s: string): Date; fmtTime(...a: any[]): string;
}
interface CadenceApi {
  readonly pluginId: string;
  tasks: CadenceApiTasks;
  clients: CadenceApiClients;
  meetings: CadenceApiMeetings;
  on(ev: string, fn: (...a: any[]) => any): void;
  commands: { add(c: { title: string; hint?: string; /** a Lucide icon name, shown before the title */ icon?: string; run: (api?: CadenceApi) => any; [k: string]: any }): void };
  search: { add(fn: (q: string) => CadenceSearchHit[] | Promise<CadenceSearchHit[]>): void };
  views: { add(v: { id: string; title: string; render: (el: HTMLElement, ...a: any[]) => any; [k: string]: any }): void };
  db: { snapshot(): any };
  island: CadenceApiIsland;
  parsers: { add(fn: (...a: any[]) => any): void };
  notify(n: { title: string; [k: string]: any }): any;
  footer: { add(b: { id: string; [k: string]: any }): void };
  extractors: { add(e: any): void };
  taskActions: { add(a: any): void };
  chips: { add(fn: (task: any, preview?: boolean) => CadenceHtml | null | undefined | false): void };
  taskCards: { add(fn: (task: any) => CadenceHtml | null | undefined | false): void };
  today: CadenceApiToday;
  meetingActions: { add(a: any): void };
  clientActions: { add(a: any): void };
  sidebar: { add(w: any): void };
  onSettings(fn: () => any): void;
  widgets: CadenceApiWidgets;
  plugins: { enabled(id: string): boolean; list(): { id: string; name: string; enabled: boolean }[] };
  space(): string;
  system(): CadenceApiSystem;
  ui: CadenceApiUi;
  storage: { get(key: string): any; set(key: string, value: any): void };
  /** GET a NAS address, showing this device's last copy first: onData(copy, {stale:true}) right away (synchronously),
   *  then onData(fresh, {stale:false}) when it arrives and differs. Resolves with the fresh answer (or the copy on error). */
  cached(url: string, onData: (v: any, info: { stale: boolean }) => any, o?: { max?: number }): Promise<any>;
  readonly ai: any;
  settings(): any;
  util: CadenceApiUtil;
}
interface CadencePluginDef {
  id: string;
  name?: string;
  setup(api: CadenceApi): any;
  settings?(api: CadenceApi): any;
  [k: string]: any;
}
interface CadenceGlobal {
  readonly version: string;
  registerPlugin(def: CadencePluginDef): void;
  notify(n: { title: string; [k: string]: any }): any;
}
declare var Cadence: CadenceGlobal;
interface Window { Cadence: CadenceGlobal; [k: string]: any }
// shared helpers other scripts put on window (each plugin checks they exist before using them)
declare var CadenceKit: any;
declare var LifeKit: any;
declare var LZString: any;
// Chrome's Document Picture-in-Picture (the visualizer's "Pop out"); not in TypeScript's DOM types yet
declare var documentPictureInPicture: any;
// the Claude artifact runtime (core.js uses it only when window.claude exists)
declare var claude: any;

// idiomorph (vendor/idiomorph.min.js): redraws that change only what changed
declare const Idiomorph: { morph(el: Element, html: string | Element, opts?: any): any };

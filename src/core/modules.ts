/** Platform-independent module declarations. Platform adapters provide capabilities. */
export type HubCapability = "storage" | "terminal" | "integrations" | "updates";
export type HubModule = {
  id: "home" | "addons" | "terminal" | "updates" | "credits";
  title: string;
  capabilities: readonly HubCapability[];
  enabledByDefault: boolean;
};
export const CORE_MODULES: readonly HubModule[] = [
  { id:"home", title:"Pulpit", capabilities:[], enabledByDefault:true },
  { id:"addons", title:"Dodatki", capabilities:["integrations"], enabledByDefault:true },
  // Terminal is intentionally disabled after crashes in SteamOS Gaming Mode.
  { id:"terminal", title:"Terminal", capabilities:["terminal"], enabledByDefault:false },
  { id:"updates", title:"Aktualizacje", capabilities:["updates"], enabledByDefault:true },
  { id:"credits", title:"Podziękowania", capabilities:[], enabledByDefault:true }
] as const;

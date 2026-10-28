/** Platform-independent module declarations. Platform adapters provide capabilities. */
export type HubCapability = "storage" | "terminal" | "integrations" | "updates";
export type HubModule = {
  id: "home" | "addons" | "files" | "options" | "terminal" | "accounts" | "updates" | "credits";
  title: string;
  capabilities: readonly HubCapability[];
  enabledByDefault: boolean;
};
export const CORE_MODULES: readonly HubModule[] = [
  { id:"home", title:"Pulpit", capabilities:[], enabledByDefault:true },
  { id:"files", title:"Pliki", capabilities:["storage"], enabledByDefault:true },
  // Terminal remains displayed in safe mode, without starting a shell.
  { id:"terminal", title:"Terminal", capabilities:["terminal"], enabledByDefault:false },
  { id:"accounts", title:"Konta", capabilities:["integrations"], enabledByDefault:true },
  { id:"addons", title:"Dodatki", capabilities:["integrations"], enabledByDefault:true },
  { id:"options", title:"Opcje Huba", capabilities:[], enabledByDefault:true },
  { id:"updates", title:"Aktualizacje", capabilities:["updates"], enabledByDefault:true },
  { id:"credits", title:"Podziękowania", capabilities:[], enabledByDefault:true }
] as const;

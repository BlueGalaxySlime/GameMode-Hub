/** Release selection is platform-independent; installation belongs to a Decky adapter. */
export type UpdateChannel = "test" | "stable";
export type InstallAction = "upgrade" | "downgrade" | "installed";
export type ReleaseEntry = {
  version: string;
  url: string;
  sha256: string;
  action: InstallAction;
  legacy: boolean;
};
const ASSET = "GameMode-Hub.zip";
const ROOT = "https://github.com/BlueGalaxySlime/GameMode-Hub/releases/download/";

export function parseVersion(value: unknown): [number, number, number, number, number] | null {
  if (typeof value !== "string") return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-test\.(\d+))?$/.exec(value);
  if (!match) return null;
  const components = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!components.every(n => Number.isSafeInteger(n))) return null;
  const number = match[4] === undefined ? 0 : Number(match[4]);
  if (!Number.isSafeInteger(number)) return null;
  return [components[0], components[1], components[2], match[4] === undefined ? 1 : 0, number];
}
export function compareVersions(a: string, b: string): number {
  const first = parseVersion(a), second = parseVersion(b);
  if (!first || !second) throw new Error("Nieprawidłowa wersja.");
  for (let i = 0; i < first.length; i++) {
    const difference = first[i] - second[i];
    if (difference) return difference > 0 ? 1 : -1;
  }
  return 0;
}
function minimum(a: readonly number[], min: readonly number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] > min[i]) return true;
    if (a[i] < min[i]) return false;
  }
  return true;
}

/** Only published, verified GameMode-Hub.zip from an explicitly eligible channel. */
export function selectReleases(payload: unknown, channel: UpdateChannel, current: string): ReleaseEntry[] {
  if (channel !== "test" && channel !== "stable") throw new Error("Nieznany kanał.");
  if (!parseVersion(current)) throw new Error("Nieprawidłowa bieżąca wersja.");
  if (!Array.isArray(payload)) throw new Error("GitHub zwrócił nieprawidłową listę.");
  const catalog: ReleaseEntry[] = [];
  for (const candidate of payload.slice(0, 50)) {
    if (!candidate || typeof candidate !== "object" || candidate.draft === true) continue;
    const tag = candidate.tag_name;
    const v = parseVersion(tag);
    if (!v || typeof tag !== "string") continue;
    if (channel === "stable") {
      if (candidate.prerelease || v[3] !== 1 || !minimum(v, [0, 6, 0])) continue;
    } else {
      const modernTest = candidate.prerelease === true && v[3] === 0 && minimum(v, [0, 5, 3]);
      const rollback = tag === "v0.5.2" && !candidate.prerelease;
      if (!modernTest && !rollback) continue;
    }
    const assets = candidate.assets;
    if (!Array.isArray(assets)) continue;
    const asset = assets.find((entry: unknown) => !!entry && typeof entry === "object" && (entry as {name?: unknown}).name === ASSET);
    if (!asset || typeof asset !== "object") continue;
    const url = ROOT + tag + "/" + ASSET;
    if (asset.browser_download_url !== url ||
        typeof asset.digest !== "string" ||
        !/^sha256:[a-f\d]{64}$/i.test(asset.digest)) continue;
    catalog.push({
      version: tag.replace(/^v/, ""),
      url,
      sha256: asset.digest.slice(7).toLowerCase(),
      action: compareVersions(tag, current) < 0 ? "downgrade" : compareVersions(tag, current) > 0 ? "upgrade" : "installed",
      legacy: tag === "v0.5.2"
    });
  }
  return catalog.sort((a, b) => compareVersions(b.version, a.version));
}

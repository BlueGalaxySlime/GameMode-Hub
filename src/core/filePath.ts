/** Pure path/breadcrumb logic with no dependency on Decky or the browser. */
export type FileRoot = { name: string; path: string };
export type Crumb = { name: string; path: string };

export function breadcrumbs(path: string, roots: readonly FileRoot[]): Crumb[] {
  // Choose the deepest available root; never expose clickable ancestors
  // outside the allowed area.
  const root = [...roots]
    .filter(item => path === item.path || path.startsWith(item.path.replace(/\/$/, "") + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!root) return [];
  const parts = path.slice(root.path.length).split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ name: root.name, path: root.path }];
  let current = root.path.replace(/\/$/, "");
  for (const part of parts) {
    current += "/" + part;
    crumbs.push({ name: part, path: current });
  }
  return crumbs;
}

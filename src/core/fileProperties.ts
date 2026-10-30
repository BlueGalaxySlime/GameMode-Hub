/** Read-only file properties, from a bounded directory listing. No disk scan. */
export type FilePropertyEntry = {
  name: string;
  path: string;
  directory: boolean;
  symlink: boolean;
  size: number | null;
  modified: number;
};

export type FileProperty = { label: string; description: string };

export function fileExtension(name: string): string | null {
  const dot = name.lastIndexOf(".");
  // A leading dot for hidden files is part of the name, not an extension.
  return dot > 0 && dot < name.length - 1 ? name.slice(dot) : null;
}

export function formatFileSize(size: number | null, directory: boolean): string {
  if (directory) return "Nieobliczony (bez skanowania folderu)";
  if (size === null || !Number.isSafeInteger(size) || size < 0) return "Brak danych";
  const exact = size.toLocaleString("pl-PL") + " B";
  if (size < 1024) return exact;
  const units = ["KB", "MB", "GB", "TB"];
  let scaled = size;
  let index = -1;
  do { scaled /= 1024; index++; } while (scaled >= 1024 && index < units.length - 1);
  return scaled.toLocaleString("pl-PL", { maximumFractionDigits: 1 }) +
    " " + units[index] + " (" + exact + ")";
}

export function fileProperties(entry: FilePropertyEntry): FileProperty[] {
  const extension = entry.directory || entry.symlink ? null : fileExtension(entry.name);
  const date = Number.isFinite(entry.modified)
    ? new Date(entry.modified * 1000) : null;
  return [
    { label: "Nazwa", description: entry.name },
    { label: "Typ", description: entry.symlink ? "Dowiązanie symboliczne" :
      entry.directory ? "Folder" : "Plik" },
    ...(extension ? [{ label: "Rozszerzenie", description: extension }] : []),
    { label: "Rozmiar", description: formatFileSize(entry.size, entry.directory) },
    { label: "Data modyfikacji",
      description: date && !Number.isNaN(date.getTime())
        ? date.toLocaleString("pl-PL") : "Brak danych" },
    { label: "Ścieżka", description: entry.path },
  ];
}

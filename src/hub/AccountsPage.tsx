import { useEffect, useState } from "react";
import { DialogBody, DialogButton, DialogControlsSection, DialogControlsSectionHeader, Field } from "@decky/ui";
import { withTimeout } from "../utils/withTimeout";
import { GamepadScrollArea } from "./GamepadScrollArea";
import { readUnifideckStatuses } from "./unifideckBridge";
import type { StoreConnectionStatus } from "./unifideckBridge";

export function AccountsPage({ installed }: {
  installed: { name: string; disabled: boolean }[];
}) {
  const plugin = installed.find(item => item.name.toLowerCase() === "unifideck");
  const active = !!plugin && !plugin.disabled;
  const [statuses, setStatuses] = useState<StoreConnectionStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!active) return;
    setBusy(true);
    setError("");
    try {
      setStatuses(await withTimeout(readUnifideckStatuses(), 12000));
    } catch {
      // Do not show raw errors: they might contain provider details.
      setError("Nie udało się odczytać stanu kont z UniFiDeck.");
      setStatuses([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (active) void refresh();
    else { setStatuses([]); setError(""); }
  }, [active]);

  return <DialogBody>
    <GamepadScrollArea>
      <DialogControlsSection>
        <DialogControlsSectionHeader>Konta</DialogControlsSectionHeader>
        <Field label="UniFiDeck" focusable highlightOnFocus
          description={!plugin ? "Nie zainstalowano. Zainstaluj UniFiDeck w Decky, aby pokazać konta."
            : !active ? "Wtyczka jest wyłączona w Decky."
            : "Stan sklepów pobierany bezpośrednio z UniFiDeck, bez dostępu do tokenów."} />
        {active && <Field label="Status połączeń"
          description="Logowanie i wylogowanie pozostają w UniFiDeck. Hub pokazuje tylko bieżący stan.">
          <DialogButton disabled={busy} onClick={() => { void refresh(); }}>
            {busy ? "Sprawdzanie…" : "Odśwież"}
          </DialogButton>
        </Field>}
        {statuses.map(item => <Field key={item.id} label={item.name}
          focusable highlightOnFocus
          description={item.connected ? "Połączono przez UniFiDeck" : "Niepołączono / niedostępne"} />)}
        {active && !busy && !statuses.length && !error &&
          <Field label="Brak danych" description="UniFiDeck nie zgłosił obecnie obsługiwanych sklepów." />}
        {!!error && <Field label="Błąd" description={error} />}
        <Field label="Prywatność" focusable highlightOnFocus
          description="GameMode Hub nie kopiuje haseł ani tokenów, nie wylogowuje ze sklepów i nie modyfikuje kont UniFiDeck." />
      </DialogControlsSection>
    </GamepadScrollArea>
  </DialogBody>;
}

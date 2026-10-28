import { DialogButton, ModalRoot } from "@decky/ui";

export function DesktopRulesDialog({ automaticFlatpak, overridden, closeModal }: {
  automaticFlatpak: number; overridden: number; closeModal?: () => void;
}) {
  return <ModalRoot onCancel={() => closeModal?.()}>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12,
      width: "min(86vw, 520px)", maxWidth: "100%", boxSizing: "border-box" }}>
      <strong>Reguły widoku</strong>
      <div style={{ fontSize: 13 }}>
        <b>Flatpak</b> — aplikacje z wpisem X-Flatpak, katalogów eksportu Flatpak lub uruchamiane przez polecenie flatpak.
      </div>
      <div style={{ fontSize: 13 }}>
        <b>Systemowe</b> — pozostałe aplikacje wykryte w plikach .desktop.
      </div>
      <div style={{ fontSize: 13 }}>
        <b>Własne przypisania</b> — Y na wybranej aplikacji → Przypisanie:
        Automatycznie, Flatpak lub Systemowe. Nadpisanie kategorii nie zmienia
        sposobu uruchamiania ani instalacji aplikacji.
      </div>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        Automatycznie wykryte Flatpaki: {automaticFlatpak}. Ręcznie przypisane: {overridden}.
      </div>
      <DialogButton onClick={() => closeModal?.()}>Zamknij</DialogButton>
    </div>
  </ModalRoot>;
}

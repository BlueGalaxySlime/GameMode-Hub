import { Field } from "@decky/ui";

/** Plain text, never a collapsible action. Focusable makes D-pad scroll work. */
export function FocusableInfoField({ label, description }: {
  label: string; description: string;
}) {
  return <Field label={label} description={description}
    focusable highlightOnFocus />;
}

import type { FieldErrors } from "react-hook-form";

/**
 * Walks a react-hook-form error tree (which nests for arrays/objects) and
 * collects every leaf `message` string in encounter order. The first entry is
 * typically the most relevant one to surface in a toast.
 */
export function collectFormErrorMessages(errors: FieldErrors | unknown): string[] {
  const messages: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.length > 0) {
      messages.push(obj.message);
      return;
    }
    Object.values(obj).forEach(visit);
  };
  visit(errors);
  return messages;
}

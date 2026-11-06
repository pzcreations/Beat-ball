import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Estado padrão retornado pelas Server Actions de formulário. */
export type ActionState<T extends Record<string, string> = Record<string, string>> = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Partial<Record<keyof T | "form", string>>;
  values?: Partial<T>;
  /** Muda a cada envio, para reiniciar formulários/avisos. */
  at?: number;
};

export const initialActionState: ActionState = { status: "idle" };

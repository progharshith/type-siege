/**
 * Shared utility helpers.
 *
 * `cn` merges Tailwind class strings, resolving conflicts via tailwind-merge
 * and supporting conditional classes via clsx.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge one or more class name values into a single string.
 * Accepts strings, arrays, and objects — clsx handles the combinations,
 * then tailwind-merge resolves any conflicting Tailwind utilities.
 *
 * @example
 *   cn("px-2 py-1", isActive && "bg-primary", { "opacity-50": disabled })
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

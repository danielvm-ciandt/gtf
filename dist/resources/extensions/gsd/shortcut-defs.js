// Canonical GSD shortcut definitions used by registration, help text, and overlays.
import { formatShortcut } from "./files.js";
export const GSD_SHORTCUTS = {
    dashboard: {
        key: "g",
        action: "Open GSD dashboard",
        command: "/gsd status",
        hasFallback: true,
    },
    notifications: {
        key: "n",
        action: "Open notification history",
        command: "/gsd notifications",
        hasFallback: true,
    },
    parallel: {
        key: "p",
        action: "Open parallel worker monitor",
        command: "/gsd parallel watch",
        hasFallback: false, // Ctrl+Shift+P conflicts with cycleModelBackward
    },
};
function combo(prefix, key) {
    return `${prefix}${key.toUpperCase()}`;
}
export function primaryShortcutCombo(id) {
    return combo("Ctrl+Alt+", GSD_SHORTCUTS[id].key);
}
export function fallbackShortcutCombo(id) {
    return combo("Ctrl+Shift+", GSD_SHORTCUTS[id].key);
}
export function shortcutPair(id, formatter = (combo) => combo) {
    const primary = formatter(primaryShortcutCombo(id));
    if (!GSD_SHORTCUTS[id].hasFallback)
        return primary;
    return `${primary} / ${formatter(fallbackShortcutCombo(id))}`;
}
export function formattedShortcutPair(id) {
    return shortcutPair(id, formatShortcut);
}

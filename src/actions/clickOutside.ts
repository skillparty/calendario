/**
 * Svelte action: calls `callback` when a click lands outside `node`.
 *
 * Key design decisions:
 *  - Uses the **bubble** phase (not capture) so that inner click handlers
 *    (stopPropagation, etc.) work naturally.
 *  - Skips the very first event-loop tick after mount so that the click
 *    that *opened* the element doesn't immediately trigger "outside".
 */
export function clickOutside(node: HTMLElement, callback: () => void) {
    let ready = false;

    function handleClick(event: MouseEvent) {
        if (!ready) return;
        if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
            callback();
        }
    }

    if (typeof window !== "undefined") {
        // Defer activation until after the current event cycle finishes
        requestAnimationFrame(() => {
            ready = true;
        });
        document.addEventListener("click", handleClick, false);
    }

    return {
        update(newCallback: () => void) {
            callback = newCallback;
        },
        destroy() {
            if (typeof window !== "undefined") {
                document.removeEventListener("click", handleClick, false);
            }
        },
    };
}

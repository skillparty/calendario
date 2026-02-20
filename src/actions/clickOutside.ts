export function clickOutside(node: HTMLElement, callback: () => void) {
    function handleClick(event: MouseEvent) {
        if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
            callback();
        }
    }

    if (typeof window !== "undefined") {
        document.addEventListener("click", handleClick, true);
    }

    return {
        destroy() {
            if (typeof window !== "undefined") {
                document.removeEventListener("click", handleClick, true);
            }
        },
    };
}

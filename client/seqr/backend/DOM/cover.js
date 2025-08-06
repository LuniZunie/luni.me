export function CoverEventHandler($el) {
    $el.addEventListener("click", e => {
        document.querySelectorAll(".float:not(.hidden)").forEach($float => $float.classList.add("hidden"));
    });
};
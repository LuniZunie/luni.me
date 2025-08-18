export function OsxCloseEventHandler($button) {
    const $window = $button.closest(".osx-window");
    $button.addEventListener("click", e => {
        $window.classList.add("minimize", "closing");
        window.setTimeout(() => $window.remove(), 250);
    });
};

export function OsxMinimizeEventHandler($button) {
    const $window = $button.closest(".osx-window");
    $button.addEventListener("click", e => {
        $window.classList.add("minimize");
    });
};

export function OsxZoomEventHandler($button) {
    const $window = $button.closest(".osx-window");
    $button.addEventListener("click", e => {
        $window.classList.toggle("zoom");
    });
};
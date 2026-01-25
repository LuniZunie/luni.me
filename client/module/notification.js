export function CreateNotification(text, background = "var(--notification-gray)", duration = 3000) {
    document.querySelectorAll(".notification").forEach($el => $el.remove());

    const $notification = document.createElement("div");
    $notification.className = "notification";
    $notification.textContent = text;

    $notification.style.background = background;

    document.body.appendChild($notification);

    window.setTimeout(() => {
        $notification.remove();
    }, duration);

    return $notification;
}
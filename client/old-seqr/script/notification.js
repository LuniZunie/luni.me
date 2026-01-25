import "../../prototype/HTML.js";

export function CreateNotification(text, background = "var(--notification-gray)", duration = 3000) {
    document.qsa(".notification").forEach($el => $el.remove());

    const $notification = document.body.create("div", {
        class: "notification",
        content: text,
        style: { background }
    }, { end: true });

    setTimeout(() => {
        $notification.remove();
    }, duration);

    return $notification;
}
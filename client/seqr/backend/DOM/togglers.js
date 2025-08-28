export function RadioEventHandler($el) {
    $el.addEventListener("click", e => {
        const radio = $el.dataset.radio; // radio group;
        document.querySelectorAll(`.selected[data-radio="${radio}"]`).forEach($radio => $radio.classList.remove("selected"));
        $el.classList.add("selected");
    });
};

export function ToggleEventHandler($el) {
    $el.addEventListener("click", e => $el.classList.toggle("selected"));
};
import "../../prototype/HTML.js";

function update() {
    document.qsa("svg.iconify").forEach($icon => {
        const def = (k, v) => $icon.hasAttribute(k) ? null : $icon.setAttribute(k, v);

        def("viewBox", "0 0 24 24");
        def("fill", "none");
        def("stroke", "currentColor");
        def("stroke-width", "2");
        def("stroke-linecap", "round");
        def("stroke-linejoin", "round");
        def("clip-rule", "evenodd");
        def("fill-rule", "evenodd");

        $icon.classList.remove("iconify");
    });

    requestAnimationFrame(update);
}
update();
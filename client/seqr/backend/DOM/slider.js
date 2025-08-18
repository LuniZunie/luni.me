import cMath from "../../../module/cMath.js";

export function SliderTrackEventHandler($track) {
    const $slider = $track.closest(".slider"),
          $input = $slider.querySelector(":scope > .value > .input"),
          $terminus = $slider.querySelector(":scope > .terminus");

    const cache = {
        dragging: false,
    };

    function MouseMove(e) {
        if (!cache.dragging) {
            return;
        }

        Update(e);

        e?.preventDefault();
    }
    function MouseUp(e) {
        if (!cache.dragging) {
            return;
        }
        cache.dragging = false;

        Update(e);

        document.removeEventListener("mousemove", MouseMove);
        document.removeEventListener("mouseup", MouseUp);

        e?.preventDefault();
    }

    function Update(e) {
        if (e.buttons !== 1) {
            return;
        }

        const min = parseFloat($slider.dataset.min) || 0,
              max = parseFloat($slider.dataset.max) || 100,
              step = parseFloat($slider.dataset.step) || 1;

        const rect = $track.getBoundingClientRect();
        const y = 1 - cMath.clamp((e.clientY - rect.y) / rect.height, 0, 1),
              v = Math.round((min + (max - min) * y) / step) * step;

        $slider.style.setProperty("--value", `${Math.round(y * 100 / step) * step}%`);
        $input.textContent = v;
        $slider.dataset.value = v;

        $terminus.click();
    }

    $track.addEventListener("mousedown", e => {
        if (e.buttons !== 1) {
            return;
        }

        cache.dragging = true;

        document.addEventListener("mousemove", MouseMove);
        document.addEventListener("mouseup", MouseUp);

        Update(e);
    });
    $track.addEventListener("wheel", e => {
        const $slider = $track.closest(".slider");

        const value = parseFloat($slider.dataset.value) || 0,
              min = parseFloat($slider.dataset.min) || 0,
              max = parseFloat($slider.dataset.max) || 100,
              step = parseFloat($slider.dataset.step) || 1;

        const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);

        $slider.style.setProperty("--value", `${(v - min) / (max - min) * 100}%`);
        $slider.querySelector(":scope > .value > .input").textContent = v;
        $slider.dataset.value = v;

        $terminus.click();

        e.preventDefault();
    }, { passive: false });
};

export function SliderValueEventHandler($input) {
    const $slider = $input.closest(".slider"),
          $terminus = $slider.querySelector(":scope > .terminus");

    function Update(e, fix) {
        let v = parseFloat($input.textContent.replace(/[^\d.\-]/g, "") || "0");

        const min = parseFloat($slider.dataset.min) || 0,
              max = parseFloat($slider.dataset.max) || 100;

        if (isNaN(v) || v === "") {
            $input.textContent = $slider.dataset.value ||= min;
        } else {
            const step = parseFloat($slider.dataset.step) || 1;

            v = cMath.clamp(v, min, max);

            const value = Math.round((v - min) / step) * step;
            $slider.style.setProperty("--value", `${(value - min) / (max - min) * 100}%`);
            $slider.dataset.value = value + min;
            if (fix) {
                $input.textContent = value + min;
            }

            $terminus.click();
        }
    }
    $input.addEventListener("input", e => {
        Update(e, false);
    });
    $input.addEventListener("focusout", e => {
        Update(e, true);
    });
    $input.addEventListener("wheel", e => {
        const value = parseFloat($slider.dataset.value) || 0,
              min = parseFloat($slider.dataset.min) || 0,
              max = parseFloat($slider.dataset.max) || 100,
              step = parseFloat($slider.dataset.step) || 1;

        const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);

        $slider.dataset.value = v;
        $input.textContent = v;

        Update(e, true);

        e.preventDefault();
    }, { passive: false });
};
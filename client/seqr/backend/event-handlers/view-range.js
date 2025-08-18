import cMath from "../../../module/cMath.js";

export function ViewRangeEventHandler($range) {
    const $view = $range.closest(".section.view-range"),
          $shading = $range.querySelector(":scope > .shading"),
          $min = $range.querySelector(":scope > .min"),
          $max = $range.querySelector(":scope > .max"),
          $minInput = $view.querySelector(":scope > .inputs > .min"),
          $maxInput = $view.querySelector(":scope > .inputs > .max"),
          $minInputValue = $minInput.querySelector(":scope > .input"),
          $maxInputValue = $maxInput.querySelector(":scope > .input");

    const cache = {
        dragging: false,
        target: null
    };

    function MouseMove(e) {
        if (e.buttons !== 1 || !cache.dragging || !cache.target) {
            return;
        }

        const rect = $range.getBoundingClientRect(),
              x = cMath.clamp((e.clientX - rect.x) / rect.width, 0, 1);

        const min = parseFloat($range.style.getPropertyValue("--left")) || 0,
              max = parseFloat($range.style.getPropertyValue("--right")) || 1;

        let newMin = min,
            newMax = max;

        if (cache.target === "min") {
            newMin = x;
            if (newMin > max) {
                newMin = max;
                newMax = x;
                cache.target = "max";
            }
        } else {
            newMax = x;
            if (newMax < min) {
                newMax = min;
                newMin = x;
                cache.target = "min";
            }
        }

        $range.style.setProperty("--left", newMin);
        $range.style.setProperty("--right", newMax);

        const realMin = parseFloat($view.dataset.min) || 0,
              realMax = parseFloat($view.dataset.max) || 100,
              realDelta = realMax - realMin;

        const textMin = Math.round(realMin + realDelta * newMin),
              textMax = Math.round(realMin + realDelta * newMax);

        $min.textContent = textMin;
        $max.textContent = textMax;

        $minInput.dataset.value = textMin;
        $minInputValue.textContent = textMin;

        $maxInput.dataset.value = textMax;
        $maxInputValue.textContent = textMax;

        e.preventDefault();
    }

    function MouseUp(e) {
        if (!cache.dragging) {
            return;
        }

        cache.dragging = false;
        cache.target = null;

        document.removeEventListener("mousemove", MouseMove);
        document.removeEventListener("mouseup", MouseUp);

        e.preventDefault();
    }

    $range.addEventListener("mousedown", e => {
        if (e.buttons !== 1) {
            return;
        }

        const rect = $range.getBoundingClientRect(),
              shadingRect = $shading.getBoundingClientRect();

        const x = (e.clientX - rect.x) / rect.width,
              x1 = (shadingRect.x - rect.x) / rect.width,
              x2 = x1 + shadingRect.width / rect.width;

        let d1 = Math.abs(x - x1),
            d2 = Math.abs(x - x2);

        if (Math.abs(x1 - x2) < .01) {
            if (x < x1) {
                cache.target = "min";
            } else {
                cache.target = "max";
            }
        } else {
            if (d1 < d2) {
                cache.target = "min";
            } else {
                cache.target = "max";
            }
        }

        cache.dragging = true;

        document.addEventListener("mousemove", MouseMove);
        document.addEventListener("mouseup", MouseUp);

        e.preventDefault();
        MouseMove(e);
    });
};

export function ViewRangeInputsEventHandler($input, type) {
    const $view = $input.closest(".section.view-range"),
          $range = $view.querySelector(":scope > .range"),
          $min = $range.querySelector(":scope > .min"),
          $max = $range.querySelector(":scope > .max"),
          $minInputValue = $view.querySelector(":scope > .inputs > .min > .input"),
          $maxInputValue = $view.querySelector(":scope > .inputs > .max > .input");

    $input.addEventListener("click", e => {
        const value = type === "min" ?
            parseFloat($minInputValue.textContent) :
            parseFloat($maxInputValue.textContent);

        const realMin = parseFloat($view.dataset.min) || 0,
              realMax = parseFloat($view.dataset.max) || 100,
              realDelta = realMax - realMin;

        const norm = cMath.clamp((value - realMin) / realDelta, 0, 1),
              min = parseFloat($range.style.getPropertyValue("--left")) || 0,
              max = parseFloat($range.style.getPropertyValue("--right")) || 1;

        let final;
        if (type === "min") {
            final = Math.min(norm, max);
            $range.style.setProperty("--left", final);
            $min.textContent = Math.round(realMin + realDelta * final);
        } else {
            final = Math.max(norm, min);
            $range.style.setProperty("--right", final);
            $max.textContent = Math.round(realMin + realDelta * final);
        }

        $input.value = Math.round(realMin + realDelta * final);
    });
};
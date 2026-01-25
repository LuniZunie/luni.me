import cMath from "../../../module/cMath.js";
import { ReplaceAndPreserveCursor } from "../function/replace-and-preserve-cursor.js";

export function SetupNumberPlus() {
    document.querySelectorAll(".number-plus:not([data-initiated='true'])").forEach($number => {
        const $input = $number.querySelector(":scope > .input"),
              $terminus = $number.querySelector(":scope > .terminus");

        function Update(e, fix) {
            let v = parseFloat($input.textContent.replace(/[^\d.\-]/g, "") || "0");

            const min = parseFloat($number.dataset.min) || 0,
                  max = parseFloat($number.dataset.max) || 100;

            if (isNaN(v) || v === "") {
                $input.textContent = $number.dataset.value ||= min;
            } else {
                const step = parseFloat($number.dataset.step) || 1;

                v = cMath.clamp(v, min, max);

                const value = Math.round((v - min) / step) * step;
                $number.dataset.value = value + min;
                if (fix) {
                    $input.textContent = value + min;
                }

                $terminus.click();
            }
        }

        $input.addEventListener("input", e => {
            ReplaceAndPreserveCursor($input, text => text.replace(/[^\d.\-]/g, ""));

            Update(e, false);
        });
        $input.addEventListener("focusout", e => {
            Update(e, true);
        });
        $input.addEventListener("wheel", e => {
            const value = parseFloat($number.dataset.value) || 0,
                  min = parseFloat($number.dataset.min) || 0,
                  max = parseFloat($number.dataset.max) || 100,
                  step = parseFloat($number.dataset.step) || 1;

            const v = cMath.clamp(value - step * Math.sign(e.deltaY), min, max);

            $number.dataset.value = v;
            $input.textContent = v;

            Update(e, true);

            e.preventDefault();
        }, { passive: false });

        $number.dataset.initiated = true;
    });
};
import "../../prototype/HTML.js";

document.qsa("div.button-plus").forEach($buttonPlus => {
    const $trigger = $buttonPlus.qs(".trigger");
    const $terminus = $buttonPlus.qs(".terminus");

    const $icon = $buttonPlus.qs(".icon");

    const $normal = $icon.qs(".normal");
    const $cancel = $icon.qs(".cancel");

    $trigger.addEventListener("click", () => {
        const i = +$trigger.dataset.index || 1;

        $buttonPlus.qsa("div.cycles > div:not(.hidden)").forEach($cycle => $cycle.classList.add("hidden"));

        const $cycle = $buttonPlus.qs(`div.cycles > div:nth-child(${i})`);
        if (!$cycle) {
            $terminus.click();

            $normal.classList.remove("hidden");
            $cancel.classList.add("hidden");
            return;
        } else
            $cycle.classList.remove("hidden");

        $trigger.dataset.index = i + 1;
    });

    $buttonPlus.qs("div.icon").addEventListener("click", e => {
        if ($normal.classList.contains("hidden")) {
            $buttonPlus.qsa("div.cycles > div:not(.hidden)").forEach($cycle => $cycle.classList.add("hidden"));

            $normal.classList.remove("hidden");
            $cancel.classList.add("hidden");
        } else {
            // Close all other button-plus elements first
            document.qsa("div.button-plus").forEach($otherButtonPlus => {
                if ($otherButtonPlus !== $buttonPlus) {
                    const $otherNormal = $otherButtonPlus.qs(".icon .normal");
                    const $otherCancel = $otherButtonPlus.qs(".icon .cancel");

                    $otherButtonPlus.qsa("div.cycles > div:not(.hidden)").forEach($cycle => $cycle.classList.add("hidden"));
                    $otherNormal.classList.remove("hidden");
                    $otherCancel.classList.add("hidden");
                }
            });

            $normal.classList.add("hidden");
            $cancel.classList.remove("hidden");

            $trigger.dataset.index = 1;
            $trigger.click();
        }
    });
});
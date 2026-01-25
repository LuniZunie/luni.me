export function AspectRatioInputEventHandler($input) {
    const $aspect = $input.closest(".section.aspect-ratio"),
          $width = $aspect.querySelector(":scope > .content > .aspect-input > .width"),
          $height = $aspect.querySelector(":scope > .content > .aspect-input > .height"),
          $presets = $aspect.querySelector(":scope > .content > .presets");

    $input.addEventListener("click", e => {
        $presets.querySelectorAll(".button.selected").forEach($preset => $preset.classList.remove("selected"));

        const w = parseInt($width.dataset.value),
              h = parseInt($height.dataset.value);
        $presets.querySelectorAll(`.button[data-width="${w}"][data-height="${h}"]`)
            .forEach($preset => $preset.classList.add("selected"));
    });
}

export function AspectRatioPresetEventHandler($preset) {
    const $aspect = $preset.closest(".section.aspect-ratio"),
          $width = $aspect.querySelector(":scope > .content > .aspect-input > .width"),
          $height = $aspect.querySelector(":scope > .content > .aspect-input > .height"),
          $widthValue = $width.querySelector(":scope > .input"),
          $heightValue = $height.querySelector(":scope > .input");

    $preset.addEventListener("click", e => {
        const w = parseInt($preset.dataset.width),
              h = parseInt($preset.dataset.height);

        $width.dataset.value = w;
        $widthValue.textContent = w;

        $height.dataset.value = h;
        $heightValue.textContent = h;
    });
};
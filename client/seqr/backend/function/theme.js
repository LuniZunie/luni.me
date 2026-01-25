export function SwitchTheme() {
    document.body.classList.add("no-transition");

    let theme = localStorage.getItem("SeqR:theme") || "light-mode";
    document.documentElement.classList.remove(`theme_${theme}`);

    const $switch = document.documentElement.querySelector("body > .switch-theme");

    const $first = $switch.querySelector("[data-value]"),
          $theme = $switch.querySelector(`[data-value="${theme}"]`) ?? $first;
    const $next = $theme.nextElementSibling ?? $first;

    theme = $next.dataset.value;
    localStorage.setItem("SeqR:theme", theme);
    document.documentElement.classList.add(`theme_${theme}`);

    window.requestAnimationFrame(() => document.body.classList.remove("no-transition"));
}
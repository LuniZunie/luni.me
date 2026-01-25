const theme = localStorage.getItem("SeqR:theme") || "light-mode";
localStorage.setItem("SeqR:theme", theme);
document.documentElement.classList.add(`theme_${theme}`);

const groupsWidth = localStorage.getItem("SeqR:groups-width") || "30vw";
localStorage.setItem("SeqR:groups-width", groupsWidth);
document.documentElement.style.setProperty("--groups-width", groupsWidth);
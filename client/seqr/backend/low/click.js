import { CloseAllButtonPlus } from "../DOM/button-plus.js";
import { CancelMultiselect } from "../event-handlers/multiselect.js";

document.addEventListener("click", e => {
    if (!e.target.closest(".button-plus")) { /* Button-plus */
        CloseAllButtonPlus();
    }

    CancelMultiselect(e);
});
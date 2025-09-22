import { RememberGroupForDataSelector, UpdateMemoryForDataSelector } from "../function/groups/data-selector/main.js";
import { DecodeMemberSelectors } from "../function/groups/member-encoding.js";

export function DeleteMemberEventHandler($el) {
    $el.addEventListener("click", e => {
        const $group = $el.closest(".group"),
              $member = $el.closest(".member");

        RememberGroupForDataSelector($group.dataset.unique);
        UpdateMemoryForDataSelector(DecodeMemberSelectors($member.dataset.selectors), false);
    });
}
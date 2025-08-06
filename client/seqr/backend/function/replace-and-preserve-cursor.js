export function ReplaceAndPreserveCursor($el, replacer) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
        return;
    }

    const range = selection.getRangeAt(0),
          cursorOffset = range.startOffset;

    const oldText = $el.textContent,
          newText = replacer(oldText);

    let removed = 0,
        oldIndex = 0,
        newIndex = 0;


    const oldLen = oldText.length,
          newLen = newText.length;
    while (oldIndex < cursorOffset && newIndex < newLen) {
        const oldCh = oldText[oldIndex],
              newCh = newText[newIndex];

        if (oldIndex < oldLen && newIndex < newLen && oldCh === newCh) {
            oldIndex++;
            newIndex++;
        } else {
            oldIndex++;
            removed++;
        }
    }

    $el.textContent = newText;

    const newCursorPosition = Math.max(0, cursorOffset - removed);
    if ($el.firstChild && $el.firstChild.nodeType === Node.TEXT_NODE) {
        const textNode = $el.firstChild,
              finalPosition = Math.min(newCursorPosition, textNode.length);

        const newRange = document.createRange();
        newRange.setStart(textNode, finalPosition);
        newRange.collapse(true);

        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}
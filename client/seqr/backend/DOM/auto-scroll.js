const TPS = 60,
      SPT = 1/TPS;

async function SmoothScroll($el, d, t, callback = () => true) {
    if (d === 0) return Promise.resolve([ 0, 0 ]); // no scrolling needed

    const start = $el.scrollLeft,
          end = start + d;

    let resolve;
    const promise = new Promise(res => resolve = res),
          deadline = Date.now() + t;

    const scroll = () => {
        const now = Date.now(),
              progress = Math.min(1, (now - (deadline - t)) / t);

        const pos = start + progress * d;
        if (now >= deadline) {
            $el.scrollLeft = end; // ensure we reach the end
            resolve([ 0, 0 ]);
        } else if (!callback($el, pos))
            resolve([ d - (pos - start), Math.max(0, deadline - now) ]);
        else {
            $el.scrollLeft = pos;
            window.requestAnimationFrame(scroll); // continue scrolling
        }
    };

    window.requestAnimationFrame(scroll); // start scrolling
    return promise;
}

export function AutoScroll() {
    document.querySelectorAll(".auto-scroll").forEach($auto => {
        const scrollSpeed = parseFloat($auto.dataset.scrollSpeed) || 2.5;
        let carry = parseFloat($auto.dataset.scrollCarry) || 0;

        carry += scrollSpeed;
        const speed = Math.floor(carry);
        carry -= speed;

        $auto.dataset.scrollCarry = carry.toString();

        let scrolls = $auto.querySelectorAll(".scroll").length;
        if (scrolls === 0) {
            const content = $auto.innerHTML;
            $auto.innerHTML = "";

            const $scroll = document.createElement("span");
            $scroll.className = "scroll";
            $scroll.innerHTML = content;
            $auto.appendChild($scroll);

            scrolls = 1;
        }

        const $scroll = $auto.querySelector(".scroll"),
              cs = getComputedStyle($scroll);

        const textWidth = $scroll.clientWidth + ((parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0)),
              containerWidth = $auto.clientWidth;

        if (textWidth < containerWidth) {
            $auto.querySelectorAll(".scroll:not(:first-child)").forEach($el => $el.remove());
            return;
        }

        const min = Math.ceil(containerWidth / textWidth) + 1,
              n = min - scrolls;

        if (n > 0) {
            for (let i = 0; i < n; i++) {
                const $clone = $scroll.cloneNode(true),
                      $parent = $scroll.parentNode;

                $parent.insertBefore($clone, $scroll.nextSibling);
            }
        } else if (n < 0) {
            const $scrolls = $auto.querySelectorAll(".scroll");
            for (let i = 0; i < -n; i++) {
                $scrolls[i]?.remove()?.();
            }
        }

        const pos = Date.now() / 1000 * TPS * scrollSpeed % textWidth;
        $auto.scrollLeft = pos;

        const scroll = ($el, d, t) => {
            SmoothScroll($el, d, t, ($el, pos) => {
                const len = textWidth;
                if (pos >= len) {
                    $el.scrollLeft = pos % len;
                    return false;
                }
                return true;
            }).then(([ rd, rt ]) => {
                if (rd > 0) {
                    scroll($el, rd, rt);
                }
            });
        };

        if (speed > 0) scroll($auto, speed, SPT * 1000);
    });
};
const $url = document.querySelector("#url-bar");

// Listen for messages from other windows
window.addEventListener("message", e => {
    // A basic security check to see if the message is from an expected origin
    // In a real app, you might want to check e.origin against a list of allowed domains
    console.log(`Message received from ${e.origin}:`, e.data);

    // You can add any logic here to handle the received packet
    alert(`Received packet from other page: ${e.data.payload}`);
});

$url.addEventListener("keydown", e => {
    switch (e.key) {
        case "Enter": {
            let url = $url.textContent;
            $url.textContent = "";

            if (!url.match(/^https?\:\/\//))
                url = `https://${url}`;

            // Open the new window
            const win = window.open(new URL(url).href);

            win.addEventListener("load", () => {
                try {
                    // This will only work for same-origin pages.
                    const button = win.document.createElement("button");
                    button.textContent = "Send Packet Back";
                    button.style.cssText = `
                        position: fixed;
                        top: 10px;
                        right: 10px;
                        z-index: 9999;
                        padding: 10px;
                        background-color: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    `;

                    button.addEventListener("click", () => {
                        // Send a message back to the original window
                        win.opener.postMessage({
                            payload: "This is a packet from the opened page!"
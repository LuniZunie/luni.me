window.onerror = function(message, source, line, column, error) {
    const text = `${message} at ${source}:${line}:${column}`;

    const { protocol, host } = window.location;
    const socket = new WebSocket(`${protocol.replace("http", "ws")}//${host}`);
    socket.onopen = function() {
        socket.send(JSON.stringify({
            for: "server-logger",
            type: "SeqR-dev:error",
            message: text,
            stack: (error?.stack || "No stack trace")
                .split("\n")
                .map(line => line.trim())
        }));
        socket.close();
    };

    return false;
};
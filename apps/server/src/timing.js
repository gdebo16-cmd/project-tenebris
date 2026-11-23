// Adds a Server-Timing header to every response: how long the server took, in milliseconds.
// Browser DevTools shows it under Network -> (a request) -> Timing -> "Server Timing".
// Put it first, before the session middleware, so the session's database read is counted too.
//
// Reading it: Timing's "Waiting for server response" minus this number is the network trip.
export function serverTiming(req, res, next) {
    const start = process.hrtime.bigint();
    const writeHead = res.writeHead;
    // Headers are sent at writeHead, so measure just before it
    res.writeHead = function (...args) {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        if (!res.headersSent) res.setHeader('Server-Timing', `total;dur=${ms.toFixed(1)}`);
        return writeHead.apply(this, args);
    };
    next();
}

const http = require('http');
const net = require('net');
const { URL } = require('url');

// (this first handler handles regular HTTP requests made to our server)
// HTTP proxy
// regular HTTP requests are forwarded to destination target host
// i.e. it works like follows:
// 1) HTTP client connetion comes in -> we read HTTP request from client
// 2) we lookup the destination host in the request headers and open connection to the destination
// 3) now we got 2 connections open: one from client and the second to destination target host
// 4) we forward the whole request we got from client (1st connection) to the destination (2nd connection)
// _) for destination host it looks like we initiated the request in the first place
// 5) now when we have response from the destination target host we can reply to the client (1st connection) with the response we got from destination host
// 6) we act as man in the middle and since HTTP is totally unencrypted we can interfere whenever we like and eavesdrop whatever we like
//    we could mangle request headers for example
//    NOT incoming NOR outgoing connections are encrypted !
// NOTE that although we pipe request and response in the code below its not true tunneling, because we could have just read the whole request
// and the whole response, analyze them and only then forward them
// https://stackoverflow.com/questions/20351637/how-to-create-a-simple-http-proxy-in-node-js
const proxy = http.createServer((client_req, client_res) => {
    const { port, hostname } = new URL(client_req.url);

    const options = {
        port: port || 80,
        host: hostname,
        method: client_req.method,
        headers: client_req.headers,
        path: client_req.path
    };

    const proxy = http.request(options, function (res) {
        client_res.writeHead(res.statusCode, res.headers)
        res.pipe(client_res, { end: true });
    });

    client_req.pipe(proxy, { end: true });

    proxy.on('error', (err) => {
        console.log(err);
    });
});

// Create a HTTP/HTTPS tunneling proxy
// https://nodejs.org/api/http.html#http_event_connect
proxy.on('connect', (req, clientSocket, head) => {
    // Connect to an origin server
    const { port, hostname } = new URL(`http://${req.url}`);

    const serverSocket = net.connect(port || 80, hostname, () => {
        clientSocket.write(
            'HTTP/1.1 200 Connection Established\r\n' +
            'Proxy-agent: Node.js-Proxy\r\n' +
            '\r\n'
        );

        serverSocket.write(head);
        serverSocket.pipe(clientSocket);
        clientSocket.pipe(serverSocket);
    });
});

// Now that proxy is running
proxy.listen(4444, '127.0.0.1', () => {
    const address = proxy.address();
    console.log(`proxy running on ${address.address}:${address.port}`);
});
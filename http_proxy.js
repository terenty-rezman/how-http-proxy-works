const http = require('http');
const https = require('https');
const net = require('net');
const { URL } = require('url');

// generally there are 2 types of HTTP proxies

// 1st one is HTTP forward proxy, kind of old school, back from the days when HTTP without encryption was widely spread
// I think it is still in use today as caching proxy
// and it works as a middle man, you make your requests "as is" to the proxy instead of making them directly to your target host
// and the proxy forwards them to target host as it does with responses

// and the 2nd one is HTTP tunneling proxy
// and it works remarkably differently
// there is a special HTTP verb CONNECT that you as a client use to ask the proxy to establish a tunnel to target host
// after the proxy establishes a connection to target host, it steps aside and let you communicate with target host transparently
// (although the traffic still goes through the proxy, but at tcp level) 
// everything you send gets transferred to target host and vice versa as plain TCP packets, so it can be anything inside
// for example SSL handshake so the encrypted connection could be established between you and target host
// or even SSH connection

// useful links:
// https://stackoverflow.com/questions/10440690/pros-and-cons-of-using-a-http-proxy-v-s-https-proxy/10442767

// below are two handlers that cover these two use cases

// (this first handler handles regular HTTP requests made to our server)
// HTTP proxy
// regular HTTP requests are forwarded to destination target host
// i.e. it works like follows:
// 1) HTTP client connection comes in -> we read HTTP request from client
// 2) we lookup the destination host in the request headers and open connection to the destination
// 3) now we got 2 connections open: one from client and the second to destination target host
// 4) we forward the whole request we got from client (1st connection) to the destination (2nd connection)
// _) for destination host it looks like we initiated the request in the first place
// 5) now when we have response from the destination target host we can reply to the client (1st connection) with the response we got from destination host
// 6) we act as man in the middle and since HTTP is totally unencrypted we can interfere whenever we like and eavesdrop whatever we like
//    we could manipulate request headers for example
//    NOT incoming NOR outgoing connections are encrypted!
// NOTE that although we pipe request and response in the code below its not true tunneling, because we could have just read the whole request
// and the whole response before forwarding, analyze them and only then forward
// https://stackoverflow.com/questions/20351637/how-to-create-a-simple-http-proxy-in-node-js

const proxy = http.createServer((client_req, client_res) => {
    const url = new URL(client_req.url);

    const options = {
        protocol: url.protocol,
        port: url.port || 80,
        host: url.hostname,
        method: client_req.method,
        headers: client_req.headers,
        path: url.pathname + url.search
    };

    const protocol = options.protocol === "https:" ? https : http;
    const proxy = protocol.request(options, function (res) {
        client_res.writeHead(res.statusCode, res.headers)
        res.pipe(client_res, { end: true });
    });

    client_req.pipe(proxy, { end: true });

    proxy.on('error', (err) => {
        console.log(err);
    });
});

// create a HTTP/HTTPS tunneling 
// this handler handles CONNECT request from client requesting to establish tcp channel to target host
// it works as follows:
// 1) client request with CONNECT verb and target host comes in
// 2) proxy initiates tcp connection to target host 
// 3) on success, proxy replies with 'HTTP 200 status to client'
//    (now there are 2 tcp connections involved: one from client to proxy and another one from proxy to target host)
// 4) and after that all the data transferred either form client to target host or vice versa gets transferred transparently
//    so the SSL handshake for example happens directly between client and target host, proxy just relays the traffic back and forth
//    and in case of SSL all the data seen by proxy server is encrypted and it has no way to peek inside
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

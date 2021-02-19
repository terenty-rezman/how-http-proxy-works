> __NOTE__: work in progress

__simple node js http/https proxy for educational purposes__ 

it's nice to see whats going on inside an http proxy when a request comes in \
run the proxy server with:
```
$ npm run start
```
a request to the proxy server can be made with curl:
1) plain HTTP request:
```
$ curl http://www.google.com -vs -x 127.0.0.1:4444
```
2) HTTPS tunneling request:
```
$ curl https://www.google.com -vs -x 127.0.0.1:4444
```
see the sources for details

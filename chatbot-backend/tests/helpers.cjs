const { EventEmitter } = require('node:events');
const path = require('node:path');

// Stub dependencies before importing TypeScript. Each test file runs in its own process.
function stub(relativePath, exports) {
    const id = require.resolve(path.resolve(__dirname, relativePath));
    require.cache[id] = { id, filename: id, loaded: true, exports };
}

function response() {
    return Object.assign(new EventEmitter(), {
        statusCode: 200, headers: {}, writableFinished: false,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; this.writableFinished = true; return this; },
        setHeader(name, value) { this.headers[name] = value; return this; },
    });
}

module.exports = { stub, response };

/*
 * Dependency-free VFSv2 HTTP client.
 *
 *   const text = await VFSv2.read("local@default[alice]:///notes.txt");
 *   const entries = await VFSv2.readdir("local@default[alice]:///docs");
 *
 * Pass dynamic auth headers when the application manages its own token:
 *
 *   VFSv2.configure({
 *       headers: () => ({ Authorization: `Bearer ${accessToken}` })
 *   });
 */
(function (root, factory) {
    "use strict";

    const api = factory(root);

    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }

    root.VFSv2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
    "use strict";

    class VFSError extends Error {
        constructor(message, details = {}) {
            super(message || "VFS request failed");
            this.name = "VFSError";
            this.status = details.status || 0;
            this.code = details.code || "request_failed";
            this.operation = details.operation || "";
            this.requestId = details.requestId || "";
            this.cause = details.cause;
        }

        static async fromResponse(response) {
            let body = null;

            try {
                body = await response.json();
            } catch (_) {
                // The server may return an empty or non-JSON proxy error.
            }

            const problem = body && body.error ? body.error : {};
            return new VFSError(
                problem.message || response.statusText || `VFS request failed (${response.status})`,
                {
                    status: response.status,
                    code: problem.code || "request_failed",
                    operation: problem.operation || "",
                    requestId: problem.request_id || ""
                }
            );
        }
    }

    class Client {
        constructor(options = {}) {
            const fetchImpl = options.fetch || root.fetch;
            if (typeof fetchImpl !== "function") {
                throw new TypeError("VFSv2.Client requires fetch");
            }

            this.baseURL = String(options.baseURL || "/api/v2/vfs").replace(/\/+$/, "");
            this.fetch = fetchImpl.bind ? fetchImpl.bind(root) : fetchImpl;
            this.credentials = options.credentials === undefined ? "include" : options.credentials;
            this.headers = options.headers || null;
        }

        async stat(uri, options = {}) {
            return this._json("stat", uri, { ...options, method: "GET" });
        }

        async readdir(uri, options = {}) {
            const result = await this._json("list", uri, { ...options, method: "GET" });
            return result && Array.isArray(result.items) ? result.items : [];
        }

        async read(uri, options = {}) {
            const response = await this._request("read", uri, { ...options, method: "GET" });
            return response.text();
        }

        async readBytes(uri, options = {}) {
            const response = await this._request("read", uri, { ...options, method: "GET" });
            return new Uint8Array(await response.arrayBuffer());
        }

        async readBlob(uri, options = {}) {
            const response = await this._request("read", uri, { ...options, method: "GET" });
            return response.blob();
        }

        async readJSON(uri, options = {}) {
            const text = await this.read(uri, options);
            return JSON.parse(text);
        }

        async create(uri, data = "", options = {}) {
            await this._request("file", uri, this._bodyOptions("POST", data, options));
        }

        async write(uri, data = "", options = {}) {
            await this._request("file", uri, this._bodyOptions("PUT", data, options));
        }

        async writeJSON(uri, value, options = {}) {
            return this.write(uri, JSON.stringify(value), {
                ...options,
                headers: { "Content-Type": "application/json", ...(options.headers || {}) }
            });
        }

        async mkdir(uri, options = {}) {
            return this._json("directory", uri, { ...options, method: "POST" });
        }

        async move(sourceURI, targetURI, options = {}) {
            await this._request("move", sourceURI, {
                ...options,
                method: "POST",
                headers: { "Content-Type": "application/json", ...(options.headers || {}) },
                body: JSON.stringify({ target_uri: this._uri(targetURI) })
            });
        }

        async remove(uri, options = {}) {
            await this._request("resource", uri, { ...options, method: "DELETE" });
        }

        async control(uri, command, input = null, options = {}) {
            if (typeof command !== "string" || command.length === 0) {
                throw new TypeError("command must be a non-empty string");
            }

            const bodyOptions = this._bodyOptions("POST", input, options);
            bodyOptions.query = { command };
            const response = await this._request("control", uri, bodyOptions);

            switch (options.responseType || "bytes") {
                case "text":
                    return response.text();
                case "json":
                    return response.json();
                case "blob":
                    return response.blob();
                case "response":
                    return response;
                case "bytes":
                    return new Uint8Array(await response.arrayBuffer());
                default:
                    throw new TypeError(`unknown responseType: ${options.responseType}`);
            }
        }

        async exists(uri, options = {}) {
            try {
                await this.stat(uri, options);
                return true;
            } catch (error) {
                if (error instanceof VFSError && error.code === "not_found") {
                    return false;
                }
                throw error;
            }
        }

        // Familiar filesystem aliases.
        async rm(uri, options = {}) {
            return this.remove(uri, options);
        }

        async unlink(uri, options = {}) {
            return this.remove(uri, options);
        }

        async _json(operation, uri, options) {
            const response = await this._request(operation, uri, options);
            return response.json();
        }

        async _request(operation, uri, options = {}) {
            const query = new URLSearchParams({ uri: this._uri(uri) });
            for (const [key, value] of Object.entries(options.query || {})) {
                if (value !== undefined && value !== null) {
                    query.set(key, String(value));
                }
            }

            const headers = new Headers(await this._baseHeaders());
            for (const [key, value] of Object.entries(options.headers || {})) {
                if (value !== undefined && value !== null) {
                    headers.set(key, String(value));
                }
            }

            const request = {
                method: options.method || "GET",
                headers,
                credentials: options.credentials === undefined ? this.credentials : options.credentials,
                signal: options.signal
            };

            if (options.body !== undefined && options.body !== null) {
                request.body = options.body;
            }

            let response;
            try {
                response = await this.fetch(`${this.baseURL}/${operation}?${query}`, request);
            } catch (cause) {
                throw new VFSError(cause && cause.message ? cause.message : "VFS network request failed", {
                    code: "network_error",
                    cause
                });
            }

            if (!response.ok) {
                throw await VFSError.fromResponse(response);
            }

            return response;
        }

        async _baseHeaders() {
            if (typeof this.headers === "function") {
                return (await this.headers()) || {};
            }
            return this.headers || {};
        }

        _bodyOptions(method, data, options) {
            const headers = { ...(options.headers || {}) };
            let body = data;

            if (data !== null && this._isPlainObject(data)) {
                body = JSON.stringify(data);
                if (!this._hasHeader(headers, "Content-Type")) {
                    headers["Content-Type"] = "application/json";
                }
            } else if (typeof data === "string" && !this._hasHeader(headers, "Content-Type")) {
                headers["Content-Type"] = "text/plain;charset=UTF-8";
            }

            return { ...options, method, headers, body };
        }

        _uri(uri) {
            if (typeof uri !== "string" || uri.length === 0) {
                throw new TypeError("uri must be a non-empty canonical VFS URI string");
            }
            return uri;
        }

        _isPlainObject(value) {
            if (value === null || typeof value !== "object") return false;
            const prototype = Object.getPrototypeOf(value);
            return prototype === Object.prototype || prototype === null;
        }

        _hasHeader(headers, expected) {
            const lower = expected.toLowerCase();
            return Object.keys(headers).some((name) => name.toLowerCase() === lower);
        }
    }

    function createClient(options) {
        return new Client(options);
    }

    let defaultClient = null;

    function configure(options) {
        defaultClient = createClient(options);
        return defaultClient;
    }

    function currentClient() {
        if (!defaultClient) {
            defaultClient = createClient();
        }
        return defaultClient;
    }

    const api = { Client, Error: VFSError, client: createClient, configure };
    for (const method of [
        "stat", "readdir", "read", "readBytes", "readBlob", "readJSON",
        "create", "write", "writeJSON", "mkdir", "move", "remove",
        "control", "exists", "rm", "unlink"
    ]) {
        api[method] = (...args) => currentClient()[method](...args);
    }

    return Object.freeze(api);
});

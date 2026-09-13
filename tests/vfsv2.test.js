"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const VFSv2 = require("../data/HTML/frontend/js/vfsv2.js");

const URI = "local@default[alice]:///docs/a.txt";

function jsonResponse(value, status = 200) {
    return new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

function makeClient(responses, options = {}) {
    const calls = [];
    const client = VFSv2.client({
        ...options,
        fetch: async (url, init) => {
            calls.push({ url, init });
            const next = responses.shift();
            return typeof next === "function" ? next(url, init) : next;
        }
    });
    return { client, calls };
}

test("stat, readdir and read expose simple values", async () => {
    const { client, calls } = makeClient([
        jsonResponse({ name: "a.txt", kind: "file", size: 5 }),
        jsonResponse({ items: [{ name: "a.txt" }] }),
        new Response("hello")
    ]);

    assert.equal((await client.stat(URI)).name, "a.txt");
    assert.deepEqual(await client.readdir(URI), [{ name: "a.txt" }]);
    assert.equal(await client.read(URI), "hello");

    assert.equal(calls[0].init.method, "GET");
    assert.equal(new URL(calls[0].url, "http://local").searchParams.get("uri"), URI);
});

test("binary reads return Uint8Array", async () => {
    const { client } = makeClient([new Response(new Uint8Array([1, 2, 3]))]);
    assert.deepEqual(await client.readBytes(URI), new Uint8Array([1, 2, 3]));
});

test("create, write, mkdir, move and remove use the HTTP contract", async () => {
    const target = "local@default[alice]:///docs/b.txt";
    const { client, calls } = makeClient([
        new Response(null, { status: 201 }),
        new Response(null, { status: 204 }),
        jsonResponse({ name: "folder", kind: "directory", is_dir: true }, 201),
        new Response(null, { status: 204 }),
        new Response(null, { status: 204 })
    ]);

    await client.create(URI, "first");
    await client.write(URI, "second");
    assert.equal((await client.mkdir("local@default[alice]:///folder")).is_dir, true);
    await client.move(URI, target);
    await client.remove(target);

    assert.deepEqual(calls.map((call) => call.init.method), ["POST", "PUT", "POST", "POST", "DELETE"]);
    assert.equal(calls[0].init.body, "first");
    assert.equal(calls[1].init.body, "second");
    assert.deepEqual(JSON.parse(calls[3].init.body), { target_uri: target });
});

test("control supports objects and selectable response types", async () => {
    const { client, calls } = makeClient([new Response("done")]);
    const result = await client.control(URI, "export", { format: "pdf" }, { responseType: "text" });

    assert.equal(result, "done");
    assert.equal(new URL(calls[0].url, "http://local").searchParams.get("command"), "export");
    assert.deepEqual(JSON.parse(calls[0].init.body), { format: "pdf" });
    assert.equal(calls[0].init.headers.get("Content-Type"), "application/json");
});

test("server problems become VFSError", async () => {
    const { client } = makeClient([
        jsonResponse({
            error: {
                code: "not_found",
                message: "resource not found",
                operation: "stat",
                request_id: "req-1"
            }
        }, 404)
    ]);

    await assert.rejects(client.stat(URI), (error) => {
        assert.ok(error instanceof VFSv2.Error);
        assert.equal(error.status, 404);
        assert.equal(error.code, "not_found");
        assert.equal(error.operation, "stat");
        assert.equal(error.requestId, "req-1");
        return true;
    });
});

test("exists only hides not_found", async () => {
    const { client } = makeClient([
        jsonResponse({ error: { code: "not_found", message: "missing" } }, 404),
        jsonResponse({ name: "a.txt" })
    ]);

    assert.equal(await client.exists(URI), false);
    assert.equal(await client.exists(URI), true);
});

test("dynamic headers can provide authentication", async () => {
    const { client, calls } = makeClient([jsonResponse({ name: "a.txt" })], {
        headers: () => ({ Authorization: "Basic abc" })
    });

    await client.stat(URI);
    assert.equal(calls[0].init.headers.get("Authorization"), "Basic abc");
    assert.equal(calls[0].init.credentials, "include");
});

test("network failures use network_error", async () => {
    const client = VFSv2.client({
        fetch: async () => {
            throw new Error("offline");
        }
    });

    await assert.rejects(client.read(URI), (error) => {
        assert.ok(error instanceof VFSv2.Error);
        assert.equal(error.code, "network_error");
        assert.equal(error.message, "offline");
        return true;
    });
});

test("configured singleton exposes direct read and readdir operations", async () => {
    const responses = [
        new Response("hello"),
        jsonResponse({ items: [{ name: "a.txt" }] })
    ];
    VFSv2.configure({ fetch: async () => responses.shift() });

    assert.equal(await VFSv2.read(URI), "hello");
    assert.deepEqual(await VFSv2.readdir(URI), [{ name: "a.txt" }]);
});

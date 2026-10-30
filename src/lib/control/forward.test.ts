import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardCommand } from "./forward";

const SECRET = "s".repeat(32);
const fetchMock = vi.fn();
let errSpy: ReturnType<typeof vi.spyOn>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CONTROL_SHARED_SECRET", SECRET);
  vi.stubEnv("FASTAPI_URL", "http://127.0.0.1:8000");
  fetchMock.mockReset();
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  errSpy.mockRestore();
});

describe("forwardCommand", () => {
  it("200 status ok -> sent, with token header, JSON body and a timeout signal", async () => {
    fetchMock.mockResolvedValue(json(200, { status: "ok", command: "P1" }));
    expect(await forwardCommand("P1")).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/control");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-control-token")).toBe(SECRET);
    expect(JSON.parse(init.body)).toEqual({ command: "P1" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("200 status rejected -> failed", async () => {
    fetchMock.mockResolvedValue(json(200, { status: "rejected" }));
    expect(await forwardCommand("P1")).toBe("failed");
  });

  it("200 non-JSON body -> failed", async () => {
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    expect(await forwardCommand("P1")).toBe("failed");
  });

  it("503 -> failed", async () => {
    fetchMock.mockResolvedValue(json(503, { detail: "serial closed" }));
    expect(await forwardCommand("P1")).toBe("failed");
  });

  it("network error -> failed", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await forwardCommand("P1")).toBe("failed");
  });

  it("timeout -> failed", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    expect(await forwardCommand("P1")).toBe("failed");
  });

  it.each([["missing", undefined], ["short", "x".repeat(31)]])(
    "%s secret -> failed without fetch, one log line without the secret",
    async (_n, value) => {
      if (value === undefined) vi.stubEnv("CONTROL_SHARED_SECRET", undefined as unknown as string);
      else vi.stubEnv("CONTROL_SHARED_SECRET", value);
      expect(await forwardCommand("P1")).toBe("failed");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalledTimes(1);
      if (value) expect(JSON.stringify(errSpy.mock.calls)).not.toContain(value);
    },
  );
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { clientIp } from "./clientIp";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp", () => {
  it("first valid x-forwarded-for entry, trimmed", () => {
    expect(clientIp(h({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" }))).toBe("203.0.113.9");
  });
  it.each(["x", "1.2.3.4.5", "<script>"])("garbage XFF %s -> null", (v) => {
    expect(clientIp(h({ "x-forwarded-for": v }))).toBeNull();
  });
  it("garbage XFF falls through to a valid x-real-ip", () => {
    expect(clientIp(h({ "x-forwarded-for": "x", "x-real-ip": " 198.51.100.4 " }))).toBe("198.51.100.4");
  });
  it("garbage x-real-ip -> null", () => {
    expect(clientIp(h({ "x-real-ip": "nope" }))).toBeNull();
  });
  it.each(["fe80::1%eth0", "::1%1"])("IPv6 zone id XFF %s -> null (Postgres inet rejects %%zone)", (v) => {
    expect(clientIp(h({ "x-forwarded-for": v }))).toBeNull();
  });
  it("zone id XFF falls through to a valid x-real-ip", () => {
    expect(clientIp(h({ "x-forwarded-for": "fe80::1%eth0", "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });
  it("IPv6 accepted", () => {
    expect(clientIp(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });
  it("no headers -> null", () => {
    expect(clientIp(h({}))).toBeNull();
  });
  it("ignores cf-connecting-ip unless CLIENT_IP_HEADER selects it", () => {
    expect(clientIp(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.4" }))).toBe("198.51.100.4");
  });
});

describe("clientIp behind Cloudflare Tunnel (CLIENT_IP_HEADER=cf-connecting-ip)", () => {
  beforeEach(() => vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip"));
  afterEach(() => vi.unstubAllEnvs());

  it("uses cf-connecting-ip", () => {
    expect(clientIp(h({ "cf-connecting-ip": " 203.0.113.7 ", "x-forwarded-for": "198.51.100.4" }))).toBe("203.0.113.7");
  });
  it("never falls back to client-controlled x-forwarded-for / x-real-ip", () => {
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.4", "x-real-ip": "198.51.100.5" }))).toBeNull();
  });
  it.each(["x", "fe80::1%eth0"])("garbage cf-connecting-ip %s -> null", (v) => {
    expect(clientIp(h({ "cf-connecting-ip": v }))).toBeNull();
  });
});

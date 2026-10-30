import { describe, it, expect } from "vitest";
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
  it("IPv6 accepted", () => {
    expect(clientIp(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });
  it("no headers -> null", () => {
    expect(clientIp(h({}))).toBeNull();
  });
});

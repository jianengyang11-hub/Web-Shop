import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "../src/core/pin";

describe("pin hashing", () => {
  it("verifies the correct pin against its own hash", async () => {
    const { hash, salt } = await hashPin("1234");
    expect(await verifyPin("1234", salt, hash)).toBe(true);
  });

  it("rejects a wrong pin", async () => {
    const { hash, salt } = await hashPin("1234");
    expect(await verifyPin("9999", salt, hash)).toBe(false);
  });

  it("produces a different salt (and hash) each time", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});

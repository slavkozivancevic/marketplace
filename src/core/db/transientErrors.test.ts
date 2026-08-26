import { describe, it, expect } from "vitest";
import { isTransientDbError, isReadOperation, RETRY_DELAYS_MS } from "./transientErrors";

describe("isTransientDbError", () => {
  it("recognises the Prisma codes that describe reaching the server", () => {
    for (const code of ["P1001", "P1002", "P1008", "P1017"]) {
      expect(isTransientDbError({ code, message: "boom" }), code).toBe(true);
    }
  });

  it("recognises a client that could not initialise a connection", () => {
    expect(isTransientDbError({ name: "PrismaClientInitializationError", message: "x" })).toBe(true);
  });

  it("recognises driver-level transport failures with no Prisma code", () => {
    for (const message of [
      "Connection terminated unexpectedly",
      "connect ECONNREFUSED 10.0.0.1:5432",
      "read ECONNRESET",
      "Can't reach database server at ep-x.eu-central-1.aws.neon.tech:5432",
      "timeout expired",
    ]) {
      expect(isTransientDbError({ message }), message).toBe(true);
    }
  });

  it("does NOT retry application-level failures", () => {
    // Retrying these is pointless at best. P2002 in particular would hide a
    // real conflict behind a delay and then fail anyway.
    for (const err of [
      { code: "P2002", message: "Unique constraint failed on the fields: (`slug`)" },
      { code: "P2025", message: "Record to update not found" },
      { code: "P2003", message: "Foreign key constraint failed" },
      { name: "PrismaClientValidationError", message: "Invalid `prisma.user.findMany()` invocation" },
    ]) {
      expect(isTransientDbError(err), JSON.stringify(err)).toBe(false);
    }
  });

  it("is safe against junk", () => {
    expect(isTransientDbError(null)).toBe(false);
    expect(isTransientDbError(undefined)).toBe(false);
    expect(isTransientDbError("ECONNRESET")).toBe(false); // a bare string is not an error
    expect(isTransientDbError({})).toBe(false);
  });
});

describe("isReadOperation", () => {
  it("allows every read Prisma can issue", () => {
    for (const op of [
      "findUnique",
      "findUniqueOrThrow",
      "findFirst",
      "findFirstOrThrow",
      "findMany",
      "count",
      "aggregate",
      "groupBy",
    ]) {
      expect(isReadOperation(op), op).toBe(true);
    }
  });

  it("refuses every write - a retried write can duplicate an order", () => {
    // The dangerous case is not a connection that failed before the statement
    // ran, but one that dropped after the server already committed.
    for (const op of [
      "create",
      "createMany",
      "createManyAndReturn",
      "update",
      "updateMany",
      "upsert",
      "delete",
      "deleteMany",
      "executeRaw",
      "$executeRaw",
      "queryRaw",
    ]) {
      expect(isReadOperation(op), op).toBe(false);
    }
  });
});

describe("RETRY_DELAYS_MS", () => {
  it("stays short enough to sit inside a user request", () => {
    const total = RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(2_000);
  });

  it("backs off rather than hammering", () => {
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) {
      expect(RETRY_DELAYS_MS[i]).toBeGreaterThan(RETRY_DELAYS_MS[i - 1]);
    }
  });
});

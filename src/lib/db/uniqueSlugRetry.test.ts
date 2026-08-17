import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { createWithUniqueSlugRetry } from "./uniqueSlugRetry";

function p2002(target: unknown): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: target === undefined ? {} : { target },
  });
}

describe("createWithUniqueSlugRetry", () => {
  it("retries with a suffix when the slug collides (target as field array)", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(p2002(["locale", "slug"]))
      .mockResolvedValueOnce("created");

    await expect(createWithUniqueSlugRetry(attempt)).resolves.toBe("created");
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(attempt.mock.calls[0][0]).toBeUndefined();
    expect(typeof attempt.mock.calls[1][0]).toBe("string");
  });

  it("retries when target is the constraint NAME (postgres shape)", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(p2002("ProductTranslation_locale_slug_key"))
      .mockResolvedValueOnce("created");

    await expect(createWithUniqueSlugRetry(attempt)).resolves.toBe("created");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("retries even when Prisma reports no target at all", async () => {
    // Some drivers/versions omit `meta.target` entirely. A create can only be
    // made unique by the suffix anyway, so a blind second attempt is correct.
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(p2002(undefined))
      .mockResolvedValueOnce("created");

    await expect(createWithUniqueSlugRetry(attempt)).resolves.toBe("created");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry instead of looping", async () => {
    const attempt = vi.fn().mockRejectedValue(p2002(["locale", "slug"]));
    await expect(createWithUniqueSlugRetry(attempt)).rejects.toMatchObject({
      code: "P2002",
    });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-P2002 failures", async () => {
    const boom = new Error("connection lost");
    const attempt = vi.fn().mockRejectedValue(boom);
    await expect(createWithUniqueSlugRetry(attempt)).rejects.toBe(boom);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("does not call attempt twice on success", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");
    await expect(createWithUniqueSlugRetry(attempt)).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

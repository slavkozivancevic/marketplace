import { beforeEach, describe, expect, it } from "vitest";
import { useOutboxStore } from "./outboxStore";

const reset = () =>
  useOutboxStore.setState({ entries: [], ownerId: null, parked: {} });

describe("outbox ownership", () => {
  beforeEach(reset);

  it("adopts a queue written before ownership was tracked", () => {
    useOutboxStore.getState().enqueue("c1", "hello", []);
    useOutboxStore.getState().bindOwner("alice");
    const s = useOutboxStore.getState();
    expect(s.ownerId).toBe("alice");
    expect(s.entries.map((e) => e.text)).toEqual(["hello"]);
  });

  it("never hands one account's queue to another", () => {
    const store = useOutboxStore.getState();
    store.bindOwner("alice");
    store.enqueue("c1", "from alice", []);

    useOutboxStore.getState().bindOwner("bob");
    expect(useOutboxStore.getState().entries).toEqual([]);

    useOutboxStore.getState().enqueue("c2", "from bob", []);
    useOutboxStore.getState().bindOwner("alice");
    const s = useOutboxStore.getState();
    expect(s.entries.map((e) => e.text)).toEqual(["from alice"]);
    expect(s.parked.bob.map((e) => e.text)).toEqual(["from bob"]);
    expect(s.parked.alice).toBeUndefined();
  });

  it("ignores a rebind to the same account and an empty id", () => {
    const store = useOutboxStore.getState();
    store.bindOwner("alice");
    store.enqueue("c1", "x", []);
    const before = useOutboxStore.getState();
    useOutboxStore.getState().bindOwner("alice");
    useOutboxStore.getState().bindOwner("");
    expect(useOutboxStore.getState()).toBe(before);
  });
});

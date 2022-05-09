import { SyncBailHook, SyncHook, SyncWaterfallHook } from ".";

describe("sync hook", () => {
  it("calls taps in order", () => {
    const syncHook = new SyncHook<[string, string]>();

    const tap1 = jest.fn();
    const tap2 = jest.fn();

    syncHook.tap("tap1", tap1);
    syncHook.tap("tap2", tap2);

    syncHook.call("hello", "world");

    expect(tap1).toBeCalledTimes(1);
    expect(tap2).toBeCalledTimes(1);

    expect(tap1).toBeCalledWith("hello", "world");
    expect(tap2).toBeCalledWith("hello", "world");
  });

  it("can untap", () => {
    const syncHook = new SyncHook<[string, string]>();

    const tap1 = jest.fn();
    const tap2 = jest.fn();

    const tap1Key = syncHook.tap("tap1", tap1);
    syncHook.tap("tap2", tap2);
    syncHook.untap(tap1Key);
    syncHook.call("hello", "world");

    expect(tap1).toBeCalledTimes(0);
    expect(tap2).toBeCalledTimes(1);

    expect(tap2).toBeCalledWith("hello", "world");
  });
});

describe("sync bail hook", () => {
  it("bails with results", () => {
    const bailHook = new SyncBailHook<[key: number, other: string], string>();

    bailHook.tap("tap1", (key, string) => {
      if (string === "test 1") {
        return "Hello";
      }

      if (string === "test 2") {
        return null;
      }
    });

    bailHook.tap("tap2", (key, string) => {
      if (string === "test 3") {
        return "World";
      }
    });

    expect(bailHook.call(1, "test 1")).toBe("Hello");
    expect(bailHook.call(2, "test 2")).toBe(null);
    expect(bailHook.call(3, "test 3")).toBe("World");
    expect(bailHook.call(4, "test 4")).toBe(undefined);
  });
});

describe("sync waterfall hook", () => {
  it("passes values down", () => {
    const syncWaterfallHook = new SyncWaterfallHook<[string, number, number]>();
    syncWaterfallHook.tap("tap 1", (str, num1, num2) => {
      return `World ${str}`;
    });

    syncWaterfallHook.tap("tap 2", (str, num1, num2) => {
      return `Hello ${str}`;
    });

    expect(syncWaterfallHook.call("!!!", 1, 2)).toBe(`Hello World !!!`);
  });
});

import {
  AsyncParallelBailHook,
  AsyncParallelHook,
  SyncBailHook,
  SyncHook,
  SyncLoopHook,
  SyncWaterfallHook,
} from ".";

const delay = (time: number) =>
  new Promise<void>((r) => {
    setTimeout(r, time);
  });

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

    const tap1Callback = jest.fn();
    const tap2Callback = jest.fn();

    syncWaterfallHook.tap("tap 1", (str, num1, num2) => {
      tap1Callback(str, num1, num2);
      return `World ${str}`;
    });

    syncWaterfallHook.tap("tap 2", (str, num1, num2) => {
      tap2Callback(str, num1, num2);

      return `Hello ${str}`;
    });

    expect(syncWaterfallHook.call("!!!", 1, 2)).toBe(`Hello World !!!`);
    expect(tap1Callback).toBeCalledWith("!!!", 1, 2);
    expect(tap2Callback).toBeCalledWith("World !!!", 1, 2);
  });
});

describe("sync loop hook", () => {
  it("calls things in order", () => {
    const syncLoopHook = new SyncLoopHook<[string, number]>();
    const tap1 = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    const tap2 = jest.fn().mockReturnValueOnce(1);

    syncLoopHook.tap("tap 1", tap1);
    syncLoopHook.tap("tap 2", tap2);

    const rtn = syncLoopHook.call("test", 2);

    expect(tap1).toBeCalledTimes(4);
    expect(tap2).toBeCalledTimes(2);

    expect(rtn).toStrictEqual(undefined);
  });
});

describe("async parallel hook", () => {
  it("calls hooks at the same time", async () => {
    const asyncParallelHook = new AsyncParallelHook<[string, string]>();

    const tap1 = jest.fn();
    const tap2 = jest.fn();

    asyncParallelHook.tap("tap1", (a, b) => {
      tap1(a, b);
      return delay(10);
    });

    asyncParallelHook.tap("tap1", (a, b) => {
      tap2(a, b);
      return delay(20);
    });

    const rtn = asyncParallelHook.call("1", "2");
    expect(tap1).toBeCalledWith("1", "2");
    expect(tap2).toBeCalledWith("1", "2");

    expect(await rtn).toBe(undefined);
  });
});

describe("async parallel bail hook", () => {
  it("returns the first resolved promise", async () => {
    const asyncParallelHook = new AsyncParallelBailHook<
      [string, string],
      string
    >();

    const tap1 = jest.fn();
    const tap2 = jest.fn();

    asyncParallelHook.tap("tap1", async (a, b) => {
      tap1(a, b);
      await delay(20);
      return "foo";
    });

    asyncParallelHook.tap("tap1", async (a, b) => {
      tap2(a, b);
      await delay(10);
      return "bar";
    });

    const rtn = asyncParallelHook.call("1", "2");
    expect(tap1).toBeCalledWith("1", "2");
    expect(tap2).toBeCalledWith("1", "2");

    expect(await rtn).toBe("bar");
  });
});

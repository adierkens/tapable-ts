import {
  AsyncParallelBailHook,
  AsyncParallelHook,
  AsyncSeriesBailHook,
  AsyncSeriesHook,
  AsyncSeriesLoopHook,
  AsyncSeriesWaterfallHook,
  SyncBailHook,
  SyncHook,
  SyncLoopHook,
  SyncWaterfallHook,
} from ".";

const delay = (time: number) =>
  new Promise<void>((r) => {
    setTimeout(r, time);
  });

function createJestIntercept() {
  const funcs = {
    tap: jest.fn(),
    call: jest.fn(),
    loop: jest.fn(),
    error: jest.fn(),
    result: jest.fn(),
    done: jest.fn(),
  };

  return funcs;
}

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

  it("can specify tap order", () => {
    const syncHook = new SyncWaterfallHook<[Array<string>]>();

    syncHook.tap("tap1", (input) => {
      return [...input, 'tap1']
    });
    syncHook.tap({name: "tap2", before: "tap1"}, (input) => {
      return [...input, 'tap2']
    });

    const result = syncHook.call([]);

    expect(result).toStrictEqual(["tap2", "tap1"]);
  });

  it("can specify tap order for future taps", () => {
    const syncHook = new SyncWaterfallHook<[Array<string>]>();

    syncHook.tap({name: "tap2", before: "tap1"}, (input) => {
      return [...input, 'tap2']
    });
    
    syncHook.tap("tap1", (input) => {
      return [...input, 'tap1']
    });

    const result = syncHook.call([]);

    expect(result).toStrictEqual(["tap2", "tap1"]);
  });

  it("works with no taps", () => {
    const syncHook = new SyncHook<[string, string]>();
    expect(() => {
      syncHook.call("hello", "world");
    }).not.toThrow();
  });

  it("reports usage correctly when tapped", () => {
    const syncHook = new SyncHook<[string, string]>();
    expect(syncHook.isUsed()).toBe(false);

    syncHook.tap("foo", () => {});
    expect(syncHook.isUsed()).toBe(true);
  });

  it("reports usage correctly when intercepted", () => {
    const syncHook = new SyncHook<[string, string]>();
    expect(syncHook.isUsed()).toBe(false);

    syncHook.intercept({});
    expect(syncHook.isUsed()).toBe(true);
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

  describe("intercept", () => {
    it("works for basic hooks", () => {
      const hook = new SyncHook<[number]>();
      const intercept = {
        tap: jest.fn(),
        call: jest.fn(),
        result: jest.fn(),
        done: jest.fn(),
      };
      hook.intercept(intercept);
      const t = hook.tap("test", () => {});
      expect(intercept.tap).toBeCalledWith(t);

      hook.call(1);
      expect(intercept.call).toBeCalledWith(1);
      expect(intercept.done).toBeCalled();
      expect(intercept.result).not.toBeCalled();
    });

    it("calls the error hook", () => {
      const hook = new SyncHook<[number]>();
      const intercept = {
        error: jest.fn(),
        result: jest.fn(),
        done: jest.fn(),
      };
      hook.intercept(intercept);

      const err = new Error("Help");
      const t = hook.tap("test", () => {
        throw err;
      });
      expect(() => {
        hook.call(1);
      }).toThrow(err);
      expect(intercept.error).toBeCalledWith(err);
      expect(intercept.done).not.toBeCalled();
      expect(intercept.result).not.toBeCalled();
    });

    it("works with context", () => {
      const hook = new SyncHook<[number]>();

      const tap = jest.fn();

      hook.intercept({
        context: true,
        call(context, args_0) {
          context["foo"] = "bar";
        },
      });

      hook.tap({ name: "test", context: true }, (ctx, num) => {
        tap(ctx, num);
      });
      hook.call(1);

      expect(tap).toBeCalledWith({ foo: "bar" }, 1);
    });
  });

  describe("context", () => {
    it("adds first arg correctly", () => {
      const hook = new SyncHook<
        [number],
        {
          foo: "bar" | "baz";
        }
      >();
      const tapCb = jest.fn();
      hook.tap({ name: "test1", context: true }, (ctx, arg) => {
        ctx["foo"] = "bar";
      });

      hook.tap({ name: "test2", context: true }, tapCb);
      hook.call(3);
      expect(tapCb).toBeCalledWith({ foo: "bar" }, 3);
    });
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

  it("returns nothing with no taps", () => {
    const bailHook = new SyncBailHook<[key: number, other: string], string>();
    expect(bailHook.call(1, "2")).toBe(undefined);
  });

  describe("intercept", () => {
    it("works for basic hooks", () => {
      const hook = new SyncBailHook<[key: number, other: string], string>();
      const intercept = createJestIntercept();
      hook.intercept(intercept);
      const t = hook.tap("test", (k, o) => {
        return "foo";
      });
      expect(intercept.tap).toBeCalledWith(t);

      hook.call(1, "test");
      expect(intercept.call).toBeCalledWith(1, "test");
      expect(intercept.done).not.toBeCalled();
      expect(intercept.result).toBeCalledWith("foo");
    });
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

  it("uses the first value with no returns", () => {
    const syncWaterfallHook = new SyncWaterfallHook<[string, number, number]>();
    expect(syncWaterfallHook.call("!!!", 1, 2)).toBe(`!!!`);
  });

  it("skips over undef values", () => {
    const syncWaterfallHook = new SyncWaterfallHook<[string, number, number]>();

    syncWaterfallHook.tap("tap1", () => {
      return "bar";
    });

    syncWaterfallHook.tap("tap2", () => {
      return undefined as any;
    });

    const tap3 = jest.fn();
    syncWaterfallHook.tap("tap3", (val) => {
      tap3(val);
      return val;
    });

    expect(syncWaterfallHook.call("foo", 1, 2)).toBe("bar");
    expect(tap3).toBeCalledWith("bar");
  });

  describe("intercept", () => {
    it("works for basic hooks", () => {
      const hook = new SyncWaterfallHook<[string, number, number]>();
      const intercept = createJestIntercept();
      hook.intercept(intercept);
      const t = hook.tap("test", (k, o) => {
        return "foo";
      });
      expect(intercept.tap).toBeCalledWith(t);

      hook.call("test", 4, 5);
      expect(intercept.call).toBeCalledWith("test", 4, 5);
      expect(intercept.done).not.toBeCalled();
      expect(intercept.result).toBeCalledWith("foo");
    });
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

  it("handles errors", () => {
    const syncLoopHook = new SyncLoopHook<[string, number]>();
    const tap1 = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);

    const err = new Error("test error");

    const tap2 = jest
      .fn()
      .mockReturnValueOnce(1)
      .mockImplementationOnce(() => {
        throw err;
      });
    const intercept = createJestIntercept();
    syncLoopHook.intercept(intercept);

    syncLoopHook.tap("tap 1", tap1);
    syncLoopHook.tap("tap 2", tap2);

    expect(() => {
      syncLoopHook.call("test", 2);
    }).toThrowError(err);

    expect(tap1).toBeCalledTimes(4);
    expect(tap2).toBeCalledTimes(2);
    expect(intercept.error).toBeCalledWith(err);
  });

  describe("intercept", () => {
    it("calls the loop hook", () => {
      const hook = new SyncLoopHook<[string]>();
      const intercept = createJestIntercept();
      hook.intercept(intercept);

      let count = 0;

      const t = hook.tap("tap1", () => {
        count += 1;
        if (count > 3) {
          return undefined;
        }

        return "something else";
      });

      expect(intercept.tap).toBeCalledWith(t);

      hook.call("test");
      expect(intercept.call).toBeCalledWith("test");
      expect(intercept.done).toBeCalled();
      expect(intercept.loop).toBeCalledTimes(4);
      expect(intercept.result).not.toBeCalled();
    });
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

  it("handles errors", async () => {
    const asyncParallelHook = new AsyncParallelHook<[string, string]>();
    asyncParallelHook.tap("tap1", async (a, b) => {
      throw new Error("err");
    });

    asyncParallelHook.tap("tap1", (a, b) => {
      return delay(20);
    });

    const rtn = asyncParallelHook.call("1", "2");
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

  it("handles errors", async () => {
    const asyncParallelHook = new AsyncParallelBailHook<
      [string, string],
      string
    >();
    const err = new Error("test err");

    const intercept = createJestIntercept();
    asyncParallelHook.intercept(intercept);

    asyncParallelHook.tap("tap1", async (a, b) => {
      await delay(50);
      return "foo";
    });

    asyncParallelHook.tap("tap2", async (a, b) => {
      throw err;
    });

    const rtn = asyncParallelHook.call("1", "2");

    await expect(rtn).rejects.toBe(err);
    expect(intercept.error).toBeCalledWith(err);
  });
});

describe("async series loop hook", () => {
  it("calls hooks in order", async () => {
    const asyncLoopHook = new AsyncSeriesLoopHook<[string, number]>();
    const tap1 = jest
      .fn()
      .mockReturnValueOnce(Promise.resolve(true))
      .mockReturnValueOnce(Promise.resolve(false));
    const tap2 = jest
      .fn()
      .mockReturnValueOnce(Promise.resolve(1))
      .mockReturnValueOnce(Promise.resolve(undefined));

    asyncLoopHook.tap("tap 1", tap1);
    asyncLoopHook.tap("tap 2", tap2);

    const rtn = await asyncLoopHook.call("test", 2);

    expect(tap1).toBeCalledTimes(4);
    expect(tap2).toBeCalledTimes(2);

    expect(rtn).toStrictEqual(undefined);
  });

  it("handles errors", async () => {
    const asyncLoopHook = new AsyncSeriesLoopHook<[string, number]>();
    const tap1 = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);

    const err = new Error("test error");

    const tap2 = jest
      .fn()
      .mockReturnValueOnce(1)
      .mockImplementationOnce(() => {
        throw err;
      });
    const intercept = createJestIntercept();
    asyncLoopHook.intercept(intercept);

    asyncLoopHook.tap("tap 1", tap1);
    asyncLoopHook.tap("tap 2", tap2);

    const rtn = asyncLoopHook.call("1", 2);

    await expect(rtn).rejects.toBe(err);
    expect(intercept.error).toBeCalledWith(err);
    expect(tap1).toBeCalledTimes(4);
    expect(tap2).toBeCalledTimes(2);
  });
});

describe("async series hook", () => {
  it("calls hooks in order", async () => {
    const hook = new AsyncSeriesHook<["foo"]>();

    const tap1 = jest.fn();
    const tap2 = jest.fn();

    hook.tap("tap1", async (...args) => {
      tap1(...args);
      return delay(10);
    });

    hook.tap("tap2", async (...args) => {
      tap2(...args);
      return delay(10);
    });

    const rtn = hook.call("foo");
    expect(tap1).toBeCalledWith("foo");
    expect(tap2).not.toBeCalled();

    await delay(10);
    expect(tap2).toBeCalledWith("foo");

    expect(await rtn).toBe(undefined);
  });

  it("handles errors", async () => {
    const err = new Error("test err");
    const hook = new AsyncSeriesHook<["foo"]>();
    const intercept = createJestIntercept();
    hook.intercept(intercept);

    hook.tap("tap1", async () => {
      return delay(10);
    });

    hook.tap("tap2", async () => {
      throw err;
    });

    const rtn = hook.call("foo");

    await expect(rtn).rejects.toBe(err);
    expect(intercept.error).toBeCalledWith(err);
  });
});

describe("async series bail hook", () => {
  it("bails in order", async () => {
    const bailHook = new AsyncSeriesBailHook<
      [key: number, other: string],
      string
    >();

    bailHook.tap("tap1", async (key, string) => {
      if (string === "test 1") {
        return "Hello";
      }

      if (string === "test 2") {
        return null;
      }
    });

    bailHook.tap("tap2", async (key, string) => {
      if (string === "test 3") {
        return "World";
      }
    });

    expect(await bailHook.call(1, "test 1")).toBe("Hello");
    expect(await bailHook.call(2, "test 2")).toBe(null);
    expect(await bailHook.call(3, "test 3")).toBe("World");
    expect(await bailHook.call(4, "test 4")).toBe(undefined);
  });

  it("handles errors", async () => {
    const bailHook = new AsyncSeriesBailHook<
      [key: number, other: string],
      string
    >();

    const intercept = createJestIntercept();
    bailHook.intercept(intercept);
    const err = new Error("test err");

    bailHook.tap("tap1", async (key, string) => {
      throw err;
    });

    bailHook.tap("tap2", async (key, string) => {
      return "World";
    });

    const rtn = bailHook.call(1, "2");
    await expect(rtn).rejects.toBe(err);
    expect(intercept.error).toBeCalledWith(err);
  });
});

describe("async series waterfall hook", () => {
  it("passes values down", async () => {
    const asyncWaterfallHook = new AsyncSeriesWaterfallHook<
      [string, number, number]
    >();

    const tap1Callback = jest.fn();
    const tap2Callback = jest.fn();

    asyncWaterfallHook.tap("tap 1", async (str, num1, num2) => {
      tap1Callback(str, num1, num2);
      return `World ${str}`;
    });

    asyncWaterfallHook.tap("tap 2", async (str, num1, num2) => {
      tap2Callback(str, num1, num2);

      return `Hello ${str}`;
    });

    expect(await asyncWaterfallHook.call("!!!", 1, 2)).toBe(`Hello World !!!`);
    expect(tap1Callback).toBeCalledWith("!!!", 1, 2);
    expect(tap2Callback).toBeCalledWith("World !!!", 1, 2);
  });

  it("uses the first value with no returns", async () => {
    const asyncWaterfallHook = new AsyncSeriesWaterfallHook<
      [string, number, number]
    >();
    expect(await asyncWaterfallHook.call("!!!", 1, 2)).toBe(`!!!`);
  });

  it("skips over undef values", async () => {
    const asyncWaterfallHook = new AsyncSeriesWaterfallHook<
      [string, number, number]
    >();

    asyncWaterfallHook.tap("tap1", async () => {
      return "bar";
    });

    asyncWaterfallHook.tap("tap2", async () => {
      return undefined as any;
    });

    const tap3 = jest.fn();
    asyncWaterfallHook.tap("tap3", async (val) => {
      tap3(val);
      return val;
    });

    expect(await asyncWaterfallHook.call("foo", 1, 2)).toBe("bar");
    expect(tap3).toBeCalledWith("bar");
  });

  it("handles errors", async () => {
    const asyncWaterfallHook = new AsyncSeriesWaterfallHook<
      [string, number, number]
    >();

    const intercept = createJestIntercept();
    asyncWaterfallHook.intercept(intercept);
    const err = new Error("test err");
    asyncWaterfallHook.tap("tap 1", async (str, num1, num2) => {
      return `World ${str}`;
    });

    asyncWaterfallHook.tap("tap 2", async (str, num1, num2) => {
      throw err;
    });

    const rtn = asyncWaterfallHook.call("!!!", 1, 2);

    await expect(rtn).rejects.toBe(err);
    expect(intercept.error).toBeCalledWith(err);
  });
});

const Benchmark = require("benchmark");
const tapable = require("tapable");
const hooks = require(".");

const syncHookSuite = new Benchmark.Suite("SyncHook");

const syncHookTapable = new tapable.SyncHook(["foo", "bar"]);
const syncHook = new hooks.SyncHook();

syncHookSuite.add("ts-hooks", () => {
  syncHook.tap("tap1", () => {});
  syncHook.tap("tap2", () => {});
  syncHook.tap("tap3", () => {});

  syncHook.call("test 1", "test 2");
});

syncHookSuite.add("tapable", () => {
  syncHookTapable.tap("tap1", () => {});
  syncHookTapable.tap("tap2", () => {});
  syncHookTapable.tap("tap3", () => {});

  syncHookTapable.call("test 1", "test 2");
});

[syncHookSuite].map((s) => {
  s.on("start", () => {
    console.log(s.name);
  })
    .on("cycle", (event) => {
      const bench = event.target;
      console.log(`${bench.name} -- ${bench.hz.toFixed(4)} ops/sec`);
    })
    .on("complete", (event) => {
      console.log(syncHookSuite.filter("fastest").map("name").join(""));
    })
    .run({ async: false });
});

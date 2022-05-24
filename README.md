# tapable-ts

A TypeScript rewrite of [`tapable`](https://github.com/webpack/tapable)

## Tapable

`tapable` is a great plugin system from webpack that enables users to expose _hooks_ from modules within your app that plugins can _tap_ into and customize the behavior. I use it in almost all of my projects, but there are a few quirks with the original that made it hard to use in other applications.

After using it in a bunch of projects, I wanted a bit more control over what's possible; like custom tap execution order, the ability to `untap` a hook, higher level abstractions, `PluginManager`s, etc -- and the performance tradeoffs made in the original library also didn't always align with how I end up using the library.

## API

### Hooks

Hooks are constructed by importing and instantiating a class:

```js
import { SyncHook } from "tapable-ts";

const hook = new SyncHook();
```

if using TypeScript, pass a tuple that represents the arguments as the first type param (and a return type if applicable for the second)

```ts
const hook = new SyncHook<[string, number]>();
```

you can also use named tuples for better editor support:

```ts
const hook = new SyncHook<[name: string, age: number]>();
```

#### Hook Types

The [tapable](https://github.com/webpack/tapable#hook-types) docs do a good job going over the different types of hooks. There are 9 in total:

- `SyncHook`
- `SyncBailHook`
- `SyncWaterfallHook`
- `SyncLoopHook`
- `AsyncParallelHook`
- `AsyncParallelBailHook`
- `AsyncSeriesHook`
- `AsyncSeriesBailHook`
- `AsyncSeriesWaterfallHook`

### Interceptions

The `intercept` API closely resembles the original `tapable` implementation. There are 6 events an interceptor can register for.

3 are applicable to all hooks:

- `tap` - Called when a new `tap` is registered
- `call` - Called when the hook is first called
- `error` - Called when a hook is going to throw

1 only applies for looping hooks:

- `loop` - Called during each new iteration of a looping hook

and either of the following will be called:

- `result` - Called when a hook is going to return a value
- `done` - Called when a hook is finished executing, but no value is returned. This includes _Bail_ hooks that don't return a value.

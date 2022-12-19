import { equalToOrIn } from "./utils"

export type Interceptor<Args extends any[], ReturnType, ContextType> = {
  name?: string;
  loop?: (...args: Args) => void;
  error?: (err: Error) => void;
  result?: (
    r: ReturnType extends Promise<infer AwaitedValue>
      ? AwaitedValue
      : ReturnType
  ) => void;
  done?: () => void;
  tap?: (tap: Tap<Args, ReturnType, ContextType>) => void;
} & (
  | {
      context?: false;
      call?: (...args: Args) => void;
    }
  | {
      context: true;
      call?: (context: ContextType, ...args: Args) => void;
    }
);

export type Tap<Args extends any[], ReturnType, ContextType = unknown> = {
  key: Symbol;
  name: string;
  before?: string | Array<string>;
} & (
  | {
      context: false;
      callback: (...args: Args) => ReturnType;
    }
  | {
      context: true;
      callback: (context: ContextType, ...args: Args) => ReturnType;
    }
);

type BasicTap<Args extends any[], ReturnType, ContextType> = (
  name: string,
  callback: (...args: Args) => ReturnType,
  before?: string | Array<string>
) => Tap<Args, ReturnType, ContextType>;

type TapWithContext<Args extends any[], ReturnType, ContextType> =
  | ((
      options: {
        name: string;
        context?: false;
        before?: string | Array<string>;
      },
      callback: (...args: Args) => ReturnType
    ) => Tap<Args, ReturnType>)
  | ((
      options: {
        name: string;
        context: true;
        before?: string | Array<string>;
      },
      callback: (context: ContextType, ...args: Args) => ReturnType
    ) => Tap<Args, ReturnType>);

interface SyncBaseHookType<Args extends any[], ReturnType, ContextType> {
  tap:
    | BasicTap<Args, ReturnType, ContextType>
    | TapWithContext<Args, ReturnType, ContextType>;
  call(...args: Args): void;
  untap(key: Tap<Args, ReturnType>): void;
  isUsed(): boolean;
  intercept(int: Interceptor<Args, ReturnType, ContextType>): void;
}

function callTap<Args extends any[], ReturnType, ContextType>(
  tap: Tap<Args, ReturnType, ContextType>,
  args: Args,
  ctx: ContextType
) {
  if (tap.context) {
    return tap.callback(ctx, ...args);
  }

  return tap.callback(...args);
}

class InterceptionManager<
  Args extends any[],
  ReturnType,
  ContextType = Record<string, any>
> {
  protected interceptions: Array<Interceptor<Args, ReturnType, ContextType>>;
  private interceptionKeySet: Set<
    keyof Interceptor<Args, ReturnType, ContextType>
  >;

  constructor() {
    this.interceptions = [];
    this.interceptionKeySet = new Set();
  }

  isUsed() {
    return this.interceptions.length > 0;
  }

  intercept(int: Interceptor<Args, ReturnType, ContextType>): void {
    this.interceptions.push(int);
    Object.keys(int).forEach((s) => {
      this.interceptionKeySet.add(s as any);
    });
  }

  tap(tap: Tap<Args, ReturnType, ContextType>): void {
    if (this.interceptionKeySet.has("tap")) {
      this.interceptions.forEach((i) => {
        i.tap?.(tap);
      });
    }
  }

  call(ctx: ContextType, ...args: Args): void {
    if (this.interceptionKeySet.has("call")) {
      this.interceptions.forEach((i) => {
        if (i.context) {
          i.call?.(ctx, ...args);
        } else {
          i.call?.(...args);
        }
      });
    }
  }

  loop(...args: Args): void {
    if (this.interceptionKeySet.has("loop")) {
      this.interceptions.forEach((i) => {
        i.loop?.(...args);
      });
    }
  }

  error(err: unknown): void {
    if (this.interceptionKeySet.has("error")) {
      if (err instanceof Error) {
        const asError: Error = err;
        this.interceptions.forEach((i) => {
          i.error?.(asError);
        });
      }
    }
  }

  result(
    r: ReturnType extends Promise<infer AwaitedValue>
      ? AwaitedValue
      : ReturnType
  ): void {
    if (this.interceptionKeySet.has("result")) {
      this.interceptions.forEach((i) => {
        i.result?.(r);
      });
    }
  }

  done(): void {
    if (this.interceptionKeySet.has("done")) {
      this.interceptions.forEach((i) => {
        i.done?.();
      });
    }
  }
}

abstract class Hook<
  Args extends any[],
  ReturnType,
  ContextType = Record<string, any>
> implements SyncBaseHookType<Args, ReturnType, ContextType>
{
  protected taps: Array<Tap<Args, ReturnType, ContextType>>;
  protected interceptions: InterceptionManager<Args, ReturnType, ContextType>;

  constructor() {
    this.taps = [];
    this.interceptions = new InterceptionManager<
      Args,
      ReturnType,
      ContextType
    >();
  }

  public tap(
    options: { name: string; context?: false; before?: string | Array<string>},
    callback: (...args: Args) => ReturnType
  ): Tap<Args, ReturnType, ContextType>;
  public tap(
    options: { name: string; context: true; before?: string | Array<string> },
    callback: (ctx: ContextType, ...args: Args) => ReturnType
  ): Tap<Args, ReturnType, ContextType>;
  public tap(
    name: string,
    callback: (...args: Args) => ReturnType
  ): Tap<Args, ReturnType, ContextType>;

  public tap(options: any, callback: any): Tap<Args, ReturnType, ContextType> {
    const resolvedOptions =
      typeof options === "string"
        ? {
            name: options,
            context: false,
          }
        : {
            context: false,
            ...options,
          };

    const key = Symbol(resolvedOptions.name);
    const tap: Tap<Args, ReturnType, ContextType> = {
      key,
      ...resolvedOptions,
      callback,
    };

    if(tap.before){
      let insertionIndex = this.taps.length
      const beforeSet = new Set(Array.isArray(tap.before) ? tap.before : [tap.before])
      for(insertionIndex; insertionIndex > 0 && beforeSet.size > 0; insertionIndex--){
        const t = this.taps[insertionIndex-1]
        if(beforeSet.has(t.name)){
          beforeSet.delete(t.name)
        }
        if(t.before && equalToOrIn(tap.name, t.before)){
          break
        }
      }
      this.taps.splice(insertionIndex, 0, tap)
    } else {
      this.taps.push(tap)
    }

    this.interceptions.tap(tap);

    return tap;
  }

  abstract call(...args: Args): ReturnType;

  public untap(tap: Tap<Args, ReturnType, ContextType>) {
    this.taps = this.taps.filter((t) => t.key !== tap.key);
  }

  public isUsed() {
    return this.taps.length > 0 || this.interceptions.isUsed();
  }

  public intercept(int: Interceptor<Args, ReturnType, ContextType>): void {
    this.interceptions.intercept(int);
  }
}

export class SyncHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, void, ContextType> {
  public call(...args: Args) {
    if (!this.isUsed()) {
      return;
    }

    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      this.taps.forEach((t) => {
        callTap(t, args, ctx);
      });
    } catch (err: unknown) {
      this.interceptions.error(err);

      throw err;
    }

    this.interceptions.done();
  }
}

export class SyncBailHook<
  Args extends any[],
  ReturnType,
  ContextType = Record<string, any>
> extends Hook<Args, ReturnType | undefined | null, ContextType> {
  public call(...args: Args): ReturnType | undefined | null {
    if (!this.isUsed()) {
      return;
    }

    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      const rtn = callTap(this.taps[tapIndex], args, ctx);
      if (rtn !== undefined) {
        this.interceptions.result(rtn as any);
        return rtn;
      }
    }

    this.interceptions.done();
  }
}

export class SyncWaterfallHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, Args[0], ContextType> {
  public call(...args: Args): Args[0] {
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    let [rtn, ...rest] = args;

    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      const tapValue = callTap(this.taps[tapIndex], [rtn, ...rest] as any, ctx);
      if (tapValue !== undefined) {
        rtn = tapValue;
      }
    }

    this.interceptions.result(rtn as any);

    return rtn;
  }
}

export class SyncLoopHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, void, ContextType> {
  public call(...args: Args) {
    let finished = false;
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      while (finished !== true) {
        finished = true;
        this.interceptions.loop(...args);
        for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
          const rtn = callTap(this.taps[tapIndex], args, ctx);

          if (rtn !== undefined) {
            finished = false;
            break;
          }
        }
      }
    } catch (e: unknown) {
      this.interceptions.error(e);
      throw e;
    }

    this.interceptions.done();
  }
}

export class AsyncParallelHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, Promise<void>, ContextType> {
  public async call(...args: Args): Promise<void> {
    const ctx: ContextType = {} as any;
    this.interceptions.call(ctx, ...args);

    await Promise.allSettled(this.taps.map((tap) => callTap(tap, args, ctx)));
    this.interceptions.done();
  }
}

export class AsyncParallelBailHook<
  Args extends any[],
  ReturnType,
  ContextType = Record<string, any>
> extends Hook<Args, Promise<ReturnType>, ContextType> {
  public async call(...args: Args): Promise<ReturnType> {
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      const rtn = await Promise.race(
        this.taps.map((tap) => callTap(tap, args, ctx))
      );

      this.interceptions.result(rtn as any);
      return rtn;
    } catch (e: unknown) {
      this.interceptions.error(e);
      throw e;
    }
  }
}

export class AsyncSeriesHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, Promise<void>, ContextType> {
  public async call(...args: Args): Promise<void> {
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
        await callTap(this.taps[tapIndex], args, ctx);
      }
    } catch (e: unknown) {
      this.interceptions.error(e);
      throw e;
    }

    this.interceptions.done();
  }
}

export class AsyncSeriesBailHook<
  Args extends any[],
  ReturnType,
  ContextType = Record<string, any>
> extends Hook<Args, Promise<ReturnType | undefined | null>, ContextType> {
  public async call(...args: Args): Promise<ReturnType | undefined | null> {
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
        const rtn = await callTap(this.taps[tapIndex], args, ctx);
        if (rtn !== undefined) {
          this.interceptions.result(rtn);
          return rtn;
        }
      }
    } catch (e: unknown) {
      this.interceptions.error(e);
      throw e;
    }

    this.interceptions.done();
  }
}

export class AsyncSeriesWaterfallHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, Promise<Args[0]>, ContextType> {
  public async call(...args: Args): Promise<Args[0]> {
    let [rtn, ...rest] = args;
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
        const tapValue = await callTap(
          this.taps[tapIndex],
          [rtn, ...rest] as any,
          ctx
        );
        if (tapValue !== undefined) {
          rtn = tapValue;
        }
      }
    } catch (e: unknown) {
      this.interceptions.error(e);
      throw e;
    }

    this.interceptions.result(rtn);

    return rtn;
  }
}

export class AsyncSeriesLoopHook<
  Args extends any[],
  ContextType = Record<string, any>
> extends Hook<Args, Promise<void>, ContextType> {
  public async call(...args: Args): Promise<void> {
    let finished = false;
    const ctx: ContextType = {} as any;

    this.interceptions.call(ctx, ...args);

    try {
      while (finished !== true) {
        finished = true;
        this.interceptions.loop(...args);
        for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
          const rtn = await callTap(this.taps[tapIndex], args, ctx);

          if (rtn !== undefined) {
            finished = false;
            break;
          }
        }
      }
    } catch (e: unknown) {
      this.interceptions.error(e);
      throw e;
    }

    this.interceptions.done();
  }
}

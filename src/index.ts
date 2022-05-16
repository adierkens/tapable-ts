export interface Interceptor<Args extends any[], ReturnType> {
  name?: string;
  tap?: (tap: Tap<Args, ReturnType>) => void;
  call?: (...args: Args) => void;
  loop?: (...args: Args) => void;
  error?: (err: Error) => void;
  result?: (r: ReturnType) => void;
  done?: () => void;
  register?: (tap: Tap<Args, ReturnType>) => void;
}

export interface Tap<Args extends any[], ReturnType> {
  key: Symbol;
  name: string;
  callback: (...args: Args) => ReturnType;
}

interface SyncBaseHookType<Args extends any[], ReturnType> {
  tap(
    name: string,
    callback: (...args: Args) => ReturnType
  ): Tap<Args, ReturnType>;
  call(...args: Args): void;
  untap(key: Tap<Args, ReturnType>): void;
  isUsed(): boolean;
  intercept(int: Interceptor<Args, ReturnType>): void;
}

class Hook<Args extends any[], ReturnType>
  implements SyncBaseHookType<Args, ReturnType>
{
  protected taps: Array<Tap<Args, ReturnType>> = [];
  protected interceptions: Array<Interceptor<Args, ReturnType>> = [];

  constructor() {}

  public tap(
    name: string,
    callback: (...args: Args) => ReturnType
  ): Tap<Args, ReturnType> {
    const key = Symbol(name);
    const tap: Tap<Args, ReturnType> = {
      key,
      name,
      callback,
    };
    this.taps.push(tap);

    return tap;
  }

  public call(...args: Args) {
    this.interceptions.forEach((i) => {
      i.call?.(...args);
    });
    this.taps.forEach((t) => {
      t.callback(...args);
    });
    this.interceptions.forEach((i) => {
      i.done?.();
    });
  }

  public untap(tap: Tap<Args, ReturnType>) {
    this.taps = this.taps.filter((t) => t.key !== tap.key);
  }

  public isUsed() {
    return this.taps.length > 0;
  }

  public intercept(int: Interceptor<Args, ReturnType>): void {
    this.interceptions.push(int);
  }
}

export class SyncHook<Args extends any[]> extends Hook<Args, void> {}

export class SyncBailHook<Args extends any[], ReturnType> extends Hook<
  Args,
  ReturnType | undefined | null
> {
  public call(...args: Args): ReturnType | undefined | null {
    this.interceptions.forEach((i) => {
      i.call?.(...args);
    });

    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      const rtn = this.taps[tapIndex].callback(...args);
      if (rtn !== undefined) {
        this.interceptions.forEach((i) => {
          i.result?.(rtn);
        });

        this.interceptions.forEach((i) => {
          i.done?.();
        });

        return rtn;
      }
    }

    this.interceptions.forEach((i) => {
      i.done?.();
    });
  }
}

export class SyncWaterfallHook<Args extends any[]> extends Hook<Args, Args[0]> {
  public call(...args: Args): Args[0] {
    this.interceptions.forEach((i) => {
      i.call?.(...args);
    });

    let [rtn, ...rest] = args;

    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      rtn = (this.taps[tapIndex].callback as any)(rtn, ...rest);
    }

    this.interceptions.forEach((i) => {
      i.result?.(rtn);
    });

    this.interceptions.forEach((i) => {
      i.done?.();
    });

    return rtn;
  }
}

export class SyncLoopHook<Args extends any[]> extends Hook<Args, void> {
  public call(...args: Args) {
    let finished = false;

    while (finished !== true) {
      finished = true;
      for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
        const rtn = this.taps[tapIndex].callback(...args);

        if (rtn !== undefined) {
          finished = false;
          break;
        }
      }
    }
  }
}

export class AsyncParallelHook<Args extends any[]> extends Hook<
  Args,
  Promise<void>
> {
  public async call(...args: Args): Promise<void> {
    await Promise.allSettled(this.taps.map((tap) => tap.callback(...args)));
  }
}

export class AsyncParallelBailHook<Args extends any[], ReturnType> extends Hook<
  Args,
  Promise<ReturnType>
> {
  public async call(...args: Args): Promise<ReturnType> {
    return Promise.any(this.taps.map((tap) => tap.callback(...args)));
  }
}

export class AsyncSeriesHook<Args extends any[]> extends Hook<
  Args,
  Promise<void>
> {
  public async call(...args: Args): Promise<void> {
    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      await this.taps[tapIndex].callback(...args);
    }
  }
}

export class AsyncSeriesBailHook<Args extends any[], ReturnType> extends Hook<
  Args,
  Promise<ReturnType>
> {
  public async call(...args: Args): Promise<ReturnType | undefined | null> {
    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      const rtn = await this.taps[tapIndex].callback(...args);
      if (rtn !== undefined) {
        return rtn;
      }
    }
  }
}

export class AsyncSeriesWaterfallHook<
  Args extends any[],
  ReturnType
> extends Hook<Args, Promise<ReturnType>> {
  public async call(...args: Args): Promise<ReturnType> {
    let [rtn, ...rest] = args;

    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      rtn = await (this.taps[tapIndex].callback as any)(rtn, ...rest);
    }

    return rtn;
  }
}

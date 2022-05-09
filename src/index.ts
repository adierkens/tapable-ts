export type HookRegistration = Symbol;

interface SyncBaseHook<Args extends any[], ReturnType> {
  tap(name: string, callback: (...args: Args) => ReturnType): HookRegistration;
  call(...args: Args): void;
  untap(key: HookRegistration): void;
}

class Hook<Args extends any[], ReturnType>
  implements SyncBaseHook<Args, ReturnType>
{
  protected taps: Array<{
    key: HookRegistration;
    name: string;
    callback: (...args: Args) => ReturnType;
  }> = [];

  constructor() {}

  public tap(
    name: string,
    callback: (...args: Args) => ReturnType
  ): HookRegistration {
    const key = Symbol(name);
    this.taps.push({
      key,
      name,
      callback,
    });
    return key;
  }

  public call(...args: Args) {
    this.taps.forEach((t) => {
      t.callback(...args);
    });
  }

  public untap(key: HookRegistration) {
    this.taps = this.taps.filter((t) => t.key !== key);
  }
}

export class SyncHook<Args extends any[]> extends Hook<Args, void> {}

export class SyncBailHook<Args extends any[], ReturnType> extends Hook<
  Args,
  ReturnType | undefined | null
> {
  public tap(
    name: string,
    callback: (...args: Args) => ReturnType | undefined | null
  ): HookRegistration {
    const key = Symbol(name);
    this.taps.push({
      key,
      name,
      callback,
    });
    return key;
  }

  public call(...args: Args): ReturnType | undefined | null {
    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      const rtn = this.taps[tapIndex].callback(...args);
      if (rtn !== undefined) {
        return rtn;
      }
    }
  }
}

export class SyncWaterfallHook<Args extends any[]> extends Hook<Args, Args[0]> {
  public call(...args: Args): Args[0] {
    let [rtn, ...rest] = args;

    for (let tapIndex = 0; tapIndex < this.taps.length; tapIndex += 1) {
      rtn = (this.taps[tapIndex].callback as any)(rtn, ...rest);
    }

    return rtn;
  }
}

export class SyncLoopHook {}

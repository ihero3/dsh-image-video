import { Awaitable, Dict } from "@deepseek-ai/cosmokit";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { Branded } from "@deepseek-ai/dsh-brand";
import { Agent } from "@deepseek-ai/dsh-agent";
import { UserMessage } from "@deepseek-ai/dsh-session";
import * as node_http0 from "node:http";
import { IncomingMessage, ServerResponse } from "node:http";

//#region ../../deepseek-harness/vendor/cordis/lib/types/utils.d.ts
/** Ordered collection of disposable values with O(1) deletion by value. */
declare class DisposableList<T extends WeakKey> {
  private sn;
  private map;
  private weak;
  get length(): number;
  push(value: T): () => boolean;
  delete(value: T): boolean;
  clear(): T[];
  [Symbol.iterator](): MapIterator<T>;
}
/** Metadata used by traceable proxies to rebind `ctx` and associated services. */

/** Shared symbols used to avoid public property-name collisions. */
declare const symbols: {
  shadow: symbol;
  receiver: symbol;
  original: symbol;
  metadata: symbol;
  initHooks: symbol;
  checkProto: symbol;
  effect: typeof Context.effect;
  filter: typeof Context.filter;
  isolate: typeof Context.isolate;
  intercept: typeof Context.intercept;
  init: typeof Service.init;
  check: typeof Service.check;
  config: typeof Service.config;
  invoke: typeof Service.invoke;
  extend: typeof Service.extend;
  tracker: typeof Service.tracker;
  resolveConfig: typeof Service.resolveConfig;
};
/** Return true when a plugin callback should be constructed with `new`. */
//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/registry.d.ts
/**
 * Service dependency declaration accepted by plugins and the `@Inject`
 * decorator.
 *
 * Array form requests services without intercept config. Object form maps each
 * service name to optional intercept config for the plugin context.
 */
type Inject<M = Dict> = (keyof M)[] | { [K in keyof M]?: M[K] };
/** Context keys that correspond to services with typed intercept config. */
type InjectKey = keyof { [K in keyof Context & string as Context[K] extends {
  [symbols.config]: any;
} ? K : never]: any };
/**
 * Decorator for declaring service dependencies on classes or class methods.
 *
 * On classes it contributes to the plugin's static `inject` map. On methods it
 * delays the method call until the declared services are available.
 */
/**
 * @param name — the required service name.
 * @param config — optional intercept config applied for that service.
 * @returns the class or method decorator.
 */
declare function Inject<K extends InjectKey>(name: K, config?: Context[K] extends {
  [symbols.config]: infer T;
} ? T : never): (value: any, decorator: ClassDecoratorContext<any> | ClassMethodDecoratorContext<any>) => void;
/** Utilities for normalizing plugin dependency declarations. */
declare namespace Inject {
  /**
   * Convert array/object/class-inherited inject metadata into a plain map.
   *
   * @param inject — the declaration to normalize; `null`/`undefined` add nothing.
   * @param result — the map to fill (service name → intercept config or `null`).
   * @returns `result`.
   */
  function resolve(inject: Inject | null | undefined, result?: Dict): Dict;
}
/** Supported plugin entrypoint shapes. */
type Plugin<T = any> = Plugin.Function<T> | Plugin.Constructor<T> | Plugin.Object<T>;
/** Types associated with plugin entrypoints and runtime records. */
declare namespace Plugin {
  /** Shared metadata understood by the plugin registry and related tooling. */
  interface Base<T = any> {
    /** Display name used for fiber diagnostics and logger names. */
    name?: string;
    /** Standard-schema validator applied to config before the plugin starts. */
    Config?: StandardSchemaV1<any, T>;
    /** Services the plugin requires; it only loads while all are available. */
    inject?: Inject;
    /** Service name(s) the plugin provides (read by `Service` and by loaders). */
    provide?: string | string[];
    /** Service names whose intercept config the plugin declares it consumes. */
    intercept?: Dict<boolean>;
  }
  interface Transform<S, T> {
    /** Marks the transform object as a schema/config transform. */
    schema?: true;
    /** Convert user-facing config to runtime config. */
    Config: (config: S) => T;
  }
  /** Function plugin called with `(ctx, config)`. */
  interface Function<T = any> extends Base<T> {
    (ctx: Context, config: T): any;
  }
  /** Class plugin constructed with `(ctx, config)`. */
  interface Constructor<T = any> extends Base<T> {
    new (ctx: Context, config: T): any;
  }
  /** Object plugin with an `apply(ctx, config)` method. */
  interface Object<T = any> extends Base<T> {
    apply(ctx: Context, config: T): any;
  }
  /** Mutable registry record shared by all fibers of one plugin callback. */
  interface Runtime {
    /** Display name copied from the first registered plugin shape. */
    name?: string;
    /** Every live fiber of this plugin (one per `ctx.plugin()` call). */
    fibers: DisposableList<Fiber>;
    /** The executable entrypoint all fibers share (registry identity key). */
    callback: globalThis.Function;
    /** Standard-schema validator applied to each fiber's config. */
    Config?: StandardSchemaV1;
  }
}
sideEffect();
/**
 * Plugin registry installed as `ctx.registry` and mixed into every context.
 *
 * It normalizes plugin shapes, tracks plugin runtimes, starts fibers, and
 * exposes map-like inspection over active plugin callbacks.
 */
declare class RegistryService {
  ctx: Context;
  private _counter;
  private _internal;
  constructor(ctx: Context);
  /** Allocate the next fiber uid (increments on every read). */
  get counter(): number;
  /** Number of registered plugin runtimes. */
  get size(): number;
  /**
   * Resolve a supported plugin shape to its executable callback.
   *
   * @param plugin — a function, class, or `{ apply }` object plugin.
   * @returns the callback identifying the plugin, or `undefined` if invalid.
   */
  resolve(plugin: Plugin): Function | undefined;
  /**
   * Look up the runtime record for a plugin.
   *
   * @param plugin — any supported plugin shape.
   * @returns the runtime, or `undefined` when the plugin is not registered.
   */
  get(plugin: Plugin): Plugin.Runtime | undefined;
  /**
   * Check whether a plugin has a registered runtime.
   *
   * @param plugin — any supported plugin shape.
   * @returns `true` when at least one fiber of the plugin exists.
   */
  has(plugin: Plugin): boolean;
  /**
   * Dispose every running fiber for a plugin and remove its runtime record.
   *
   * @param plugin — any supported plugin shape.
   * @returns the removed runtime, or `undefined` when none was registered.
   */
  delete(plugin: Plugin): Plugin.Runtime | undefined;
  /** Iterate the registered plugin callbacks. */
  keys(): MapIterator<Function>;
  /** Iterate the registered plugin runtimes. */
  values(): MapIterator<Plugin.Runtime>;
  /** Iterate `[callback, runtime]` pairs. */
  entries(): MapIterator<[Function, Plugin.Runtime]>;
  /**
   * Visit every registered runtime.
   *
   * @param callback — receives each runtime and its identifying callback.
   */
  forEach(callback: (value: Plugin.Runtime, key: Function) => void): void;
  /**
   * Start a callback once the requested dependencies are available.
   *
   * @param inject — required services, as an array or a name → config map.
   * @param callback — plugin body called with `(ctx, config)`.
   * @returns the fiber; awaiting it settles once loading finished.
   */
  inject(inject: Inject, callback: Plugin.Function<void>): Fiber & PromiseLike<Fiber>;
  /**
   * Start a plugin in the current context and return its fiber.
   *
   * Creates (or reuses) the plugin's runtime record, then starts a new fiber
   * under the current context. Throws if `plugin` is not a supported shape or
   * if the current fiber is already disposed.
   *
   * @param plugin — a function, class, or `{ apply }` object plugin.
   * @param config — the plugin config, validated against its `Config` schema.
   * @param getOuterStack — captures the caller stack for effect diagnostics.
   * @returns the fiber; awaiting it settles once loading finished.
   */
  plugin(plugin: Plugin, config?: any, getOuterStack?: () => string[]): Fiber & PromiseLike<Fiber>;
}
//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/reflect.d.ts
sideEffect();
/** Context property definition known by the reflection service. */
type Property = Property.Service | Property.Accessor;
/** Property definition variants understood by `ReflectService`. */
declare namespace Property {
  /** Service property backed by a provided implementation. */
  interface Service {
    /** Discriminator. */
    type: 'service';
  }
  /** Computed context property backed by custom get/set hooks. */
  interface Accessor {
    /** Discriminator. */
    type: 'accessor';
    /** Compute the property value; `error` carries the caller stack for diagnostics. */
    get: (this: Context, receiver: any, error: Error) => any;
    /** Optional setter; return `false` to reject the write. */
    set?: (this: Context, value: any, receiver: any, error: Error) => boolean;
  }
}
/** Concrete service implementation record stored in the root reflect service. */
interface Impl {
  /** The service name. */
  name: string;
  /** The fiber that provided the service (owns its lifetime). */
  fiber: Fiber;
  /** The current service value. */
  value?: any;
  /** Optional availability predicate consulted before dependents may load. */
  check?: () => boolean;
}
/**
 * Reflection and service-resolution layer installed as `ctx.reflect`.
 *
 * This service powers the context proxy, service registration, accessors, and
 * the mixins that expose core service methods directly on `ctx`.
 */
declare class ReflectService {
  ctx: Context;
  /** Proxy traps implementing service resolution for every context object. */
  static handler: ProxyHandler<Context>;
  /** Service implementations, keyed by isolation label. */
  store: Dict<Impl, symbol>;
  /** Declared context properties (services and accessors), by name. */
  props: Dict<Property>;
  constructor(ctx: Context);
  /**
   * Read a service from the store without the inject requirement.
   *
   * @param name — the service name.
   * @param strict — when `true`, only return implementations whose providing
   * fiber is currently active.
   * @returns the service value, or `undefined` when not (yet) provided.
   */
  get(name: string, strict?: boolean): any;
  _getImpl(name: string, strict?: boolean): Impl | undefined;
  /**
   * Overwrite a provided service's value.
   *
   * @param name — the service name.
   * @param value — the new service value.
   * @param error — carrier for the caller stack in diagnostics.
   * @returns `true` on success.
   * @throws when `name` was never provided, or was provided by another fiber.
   */
  set(name: string, value: any, error?: Error): boolean;
  /**
   * Register a service implementation owned by the current fiber.
   *
   * See the `ctx.provide()` overload above for the full contract.
   *
   * @param name — the service name.
   * @param value — the service value.
   * @param check — optional availability predicate for dependents.
   * @returns a disposer that unregisters the service.
   */
  provide(name: string, value?: any, check?: () => boolean): Disposable<Promise<void>>;
  /**
   * Re-evaluate every fiber that requires one of the given services.
   *
   * @param names — the service names that changed.
   * @param filter — restricts notification to matching isolation scopes.
   * @returns the fibers whose dependency state was refreshed.
   */
  notify(names: string[], filter?: (ctx: Context, name: string) => boolean): Fiber[];
  /**
   * Define a computed context property backed by get/set hooks.
   *
   * @param name — the context property name.
   * @param options — the `get` hook and optional `set` hook.
   * @returns a disposer that removes the accessor.
   */
  accessor(name: string, options: Omit<Property.Accessor, 'type'>): Disposable<Promise<void>>;
  /**
   * Expose selected members of a service directly on `ctx`.
   *
   * See the `ctx.mixin()` overload above for the full contract.
   *
   * @param source — a context property name or a source object.
   * @param mixins — keys to forward, or a source-key → ctx-key map.
   * @returns a disposer that removes all created accessors.
   */
  mixin(source: any, mixins: string[] | Dict<string>): Disposable<Promise<void>>;
  /**
   * Attach this context's tracing wrapper to a value.
   *
   * @param value — the value to wrap.
   * @returns the traceable wrapper (or the value itself when not applicable).
   */
  trace<T>(value: T): T;
  /**
   * Wrap a callback so calls trace `this` and arguments to this context.
   *
   * @param callback — the function to wrap.
   * @returns a proxy delegating to `callback` with traced values.
   */
  bind<T extends Function>(callback: T): T;
}
//# sourceMappingURL=reflect.d.ts.map
//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/fiber.d.ts
sideEffect();
interface AsyncDisposable<T extends Awaitable<void> = Awaitable<void>> extends PromiseLike<() => T> {
  (): T;
}
/**
 * Function returned by an effect to release resources during disposal.
 *
 * Disposers run in reverse registration order when the owning fiber unloads;
 * they may be async, in which case unloading awaits them.
 */
type Disposable<T = any> = () => T;
/**
 * Effect body result accepted by `ctx.effect()` and plugin startup.
 *
 * Either a single disposer, a promise of one, or a (possibly async) iterable
 * yielding several — generator effects register each yielded disposer as it
 * is produced.
 */
type Effect<T = any> = SyncEffect<T> | AsyncEffect<T>;
type SyncEffect<T = any> = Disposable<T> | Iterable<Disposable<T>, void, void>;
type AsyncEffect<T = any> = Promise<Disposable<T>> | AsyncIterable<Disposable<T>, void, void>;
/** Tree node used to expose nested effect labels for diagnostics. */
interface EffectMeta {
  /** Human-readable effect label, e.g. `ctx.on("event")` or `ctx.provide("name")`. */
  label: string;
  /** Metadata of nested effects registered while this effect ran. */
  children: EffectMeta[];
}
/**
 * Lifecycle state for one plugin fiber.
 *
 * `PENDING` — waiting for required services; `LOADING` — the plugin callback
 * is running; `ACTIVE` — loaded and providing; `FAILED` — the callback or its
 * config threw; `UNLOADING` — disposers are running; `DISPOSED` — the fiber
 * was removed and cannot restart.
 */
declare const enum FiberState {
  PENDING = 0,
  LOADING = 1,
  ACTIVE = 2,
  FAILED = 3,
  DISPOSED = 4,
  UNLOADING = 5,
}
/** Framework error with a stable machine-readable code. */

/**
 * Runtime instance of one plugin application.
 *
 * A fiber tracks dependency state, validated config, lifecycle effects, and
 * cleanup for the plugin context returned by `ctx.plugin()`.
 */
declare class Fiber {
  parent: Context;
  inject: Dict<any>;
  runtime: Plugin.Runtime | null;
  /** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
  uid: number | null;
  /** The context this fiber's plugin runs in (extends the parent context). */
  readonly ctx: Context;
  /** The validated plugin config (updated by `update()`). */
  config: any;
  /** The raw plugin config, re-resolved before each activation. */
  _config: any;
  /** Current lifecycle state; transitions emit `internal/status`. */
  state: FiberState;
  /** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
  readonly dispose: () => Promise<void>;
  /** Snapshot of required service implementations while loaded; `undefined` otherwise. */
  store: Dict<Impl> | undefined;
  /** The in-flight load/unload transition, if one is currently running. */
  inertia: Promise<void> | undefined;
  readonly _hooks: Dict<DisposableList<Function>>;
  readonly _disposables: DisposableList<Disposable<any>>;
  protected context: Context;
  private _error;
  private _runner;
  private _store;
  /**
   * Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
   * rather than constructing them directly.
   *
   * @param parent — the context the plugin was loaded from.
   * @param config — raw config, validated against the runtime's schema.
   * @param inject — resolved dependency map (service name → intercept config).
   * @param runtime — the shared plugin runtime, or `null` for the root fiber.
   * @param getOuterStack — captures the caller stack for effect diagnostics.
   */
  constructor(parent: Context, config: any, inject: Dict<any>, runtime: Plugin.Runtime | null, getOuterStack: () => string[]);
  /** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
  get name(): string;
  /**
   * Throw if the fiber has already been disposed.
   *
   * @returns nothing when the fiber is still active.
   * @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
   */
  assertActive(): void;
  private _execute;
  /**
   * Register a cleanup-aware effect on this fiber.
   *
   * `execute` runs immediately; the disposers it produces are collected and
   * run (in reverse order) either when the returned disposer is called or
   * when the fiber unloads, whichever comes first. Calling the disposer twice
   * is a no-op. Throws `CordisError('INACTIVE_EFFECT')` if the fiber is
   * already disposed, and `TypeError` if `execute` returns an invalid shape.
   *
   * @param execute — the effect body; see {@link Effect} for accepted shapes.
   * @param label — effect label shown in `getEffects()` diagnostics.
   * @returns a disposer that tears the effect down and settles once done.
   */
  effect(execute: () => SyncEffect, label?: string): Disposable<Promise<void>>;
  /** Same as above for async effects; the disposer is also awaitable. */
  effect(execute: () => Effect, label?: string): AsyncDisposable<Promise<void>>;
  /**
   * Return metadata for currently registered effects.
   *
   * @returns one {@link EffectMeta} tree per labeled live effect.
   */
  getEffects(): EffectMeta[];
  private _getState;
  private _updateState;
  _checkImpl(name: string): boolean | undefined;
  _refresh(): void;
  private _setEpoch;
  private _resolveConfig;
  private _reload;
  private _unload;
  /**
   * Wait for current lifecycle work and rethrow startup errors.
   *
   * @returns this fiber, once it has settled into a stable state.
   * @throws the config-validation or plugin-startup error, if any.
   */
  await(): Promise<this>;
  /**
   * Dispose and immediately reload this plugin with its current config.
   *
   * @returns a promise resolving once the reload settled.
   * @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
   */
  restart(): Promise<void>;
  /**
   * Validate and apply new config, then restart the plugin.
   *
   * Runs the `internal/update` waterfall first, so update hooks (and HMR)
   * can veto or replace the restart.
   *
   * @param config — the new raw config; validated before anything restarts.
   * @param noSave — hint for persistence hooks not to write the change back.
   * @returns nothing; the restart runs behind the `internal/update` waterfall.
   * @throws {ValidationError} when the new config fails validation.
   */
  update(config: any, noSave?: boolean): void;
}
//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/events.d.ts
sideEffect();
/** Options accepted by `ctx.on()` and `ctx.once()`. */
interface EventOptions {
  /** Add the listener before existing listeners for the same event. */
  prepend?: boolean;
  /** Receive the event regardless of context filter checks. */
  global?: boolean;
}
/** Registered listener record stored by the event service. */
interface Hook extends EventOptions {
  ctx: Context;
  callback: (...args: any[]) => any;
}
/**
 * Event bus installed as `ctx.events` and mixed into every context.
 *
 * The service supports concurrent, synchronous, serial, bail, and waterfall
 * dispatch and automatically disposes listeners with their owning fiber.
 */
declare class EventsService {
  private ctx;
  _hooks: Record<keyof any, Hook[]>;
  constructor(ctx: Context);
  /**
   * Resolve listeners for one dispatch and apply context filtering.
   *
   * @param type — the dispatch mode, reported on `internal/dispatch`.
   * @param args — the raw dispatch arguments; consumed up to the event name.
   * @returns the matching listener callbacks, bound to the dispatch `this`.
   */
  dispatch(type: string, args: any[]): ((...args: any[]) => any)[];
  /**
   * Run listeners concurrently and wait for all of them.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns a promise resolving once every listener has settled.
   */
  parallel(...args: any[]): Promise<void>;
  /**
   * Run listeners synchronously without waiting for returned promises.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   */
  emit(...args: any[]): void;
  /**
   * Run listeners in order, awaiting each, until one returns a bail value.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns the first bail value (see {@link isBailed}), if any.
   */
  serial(...args: any[]): Promise<any>;
  /**
   * Run listeners synchronously until one returns a bail value.
   *
   * @param args — optional `this`, the event name, then listener arguments.
   * @returns the first bail value (see {@link isBailed}), if any.
   */
  bail(...args: any[]): any;
  /**
   * Compose listeners around the final `next` callback.
   *
   * The last dispatch argument is treated as the innermost `next`. Listeners
   * run outermost-first; a listener that does not call `next()` vetoes the
   * rest of the chain, including the built-in behavior.
   *
   * @param args — optional `this`, the event name, listener arguments, then `next`.
   * @returns the outermost listener's return value.
   */
  waterfall(...args: any[]): any;
  /**
   * Store a listener record as an effect on the current fiber.
   *
   * @param label — effect label shown in fiber diagnostics.
   * @param hooks — the listener list for one event.
   * @param callback — the listener to store.
   * @param options — placement and filtering options.
   * @returns a disposer that unregisters the listener.
   */
  register(label: string, hooks: Hook[], callback: any, options: EventOptions): () => void;
  /**
   * Remove a stored listener record.
   *
   * @param hooks — the listener list for one event.
   * @param callback — the listener to remove.
   * @returns `true` if the listener was found and removed.
   */
  unregister(hooks: Hook[], callback: any): true | undefined;
  /**
   * Register an event listener owned by the current fiber.
   *
   * The listener is removed automatically when the fiber unloads. Throws
   * `CordisError('INACTIVE_EFFECT')` if the fiber is already disposed.
   *
   * @param name — the event name to listen for.
   * @param listener — called with the dispatch arguments.
   * @param options — listener options; a boolean is shorthand for `prepend`.
   * @returns a disposer removing the listener; `true` if it was still registered.
   */
  on(name: string | symbol, listener: (...args: any) => any, options?: boolean | EventOptions): any;
  /**
   * Register an event listener that disposes itself after the first call.
   *
   * @param name — the event name to listen for.
   * @param listener — called at most once with the dispatch arguments.
   * @param options — listener options; a boolean is shorthand for `prepend`.
   * @returns a disposer removing the listener; `true` if it was still registered.
   */
  once(name: string, listener: (...args: any) => any, options?: boolean | EventOptions): any;
}
/**
 * Built-in framework events used by core services and extension points.
 *
 * Plugin and status events track fiber lifecycle, service events observe
 * dependency registration, update/get/set/listener events allow core services
 * to intercept runtime operations, and `internal/dispatch` exposes event-bus
 * diagnostics before public events are delivered.
 */

//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/logger.d.ts
sideEffect();
/** Logger method name and severity category. */
type LoggerType = 'error' | 'info' | 'warn' | 'debug';
/** Callable shape for one logger severity method. */
type LoggerMethod = (format: any, ...param: any[]) => void;
/** Formatter used to resolve a printf-style placeholder. */
type Formatter = (value: any, exporter: Exporter, message: Message) => any;
/** Numeric severity used when exporters decide whether to emit a message. */

/** Structured log record delivered to exporters. */
interface Message {
  sn: number;
  ts: number;
  name: string;
  type: LoggerType;
  level: number;
  args: any[];
  fiber?: WeakRef<Fiber>;
}
/** Sink that receives structured log messages. */
interface Exporter {
  colors?: number | false;
  maxLength?: number;
  levels?: Record<string, number>;
  formatters?: Record<string, Formatter>;
  export(message: Message): void;
}
/** Built-in placeholder formatters used by `Logger.format()`. */

/** Options used when creating a named logger facade. */
interface LoggerOptions {
  /** The logger name shown with each message. */
  name: string;
  /** Message fields merged into every record from this logger. */
  meta?: Partial<Message>;
  /** Default maximum level exported when an exporter has no own threshold. */
  level?: number;
}
/** Logger facade identity, inherited message metadata, and optional minimum level. */
interface Logger extends LoggerOptions {}
/** Logger facade severity methods. */
interface Logger extends Record<LoggerType, LoggerMethod> {}
/** Logger facade for one named subsystem. */
declare class Logger {
  private service;
  static color(exporter: Exporter, code: number, value: any, decoration?: string): string;
  static code(name: string, level?: false | number): number;
  static format(exporter: Exporter, message: Message): string;
  constructor(options: LoggerOptions, service: LoggerService);
  private _method;
}
/** ANSI 16-color palette indexes used for logger name coloring. */

/** Logger service configuration merged from context intercepts. */
declare namespace LoggerService {
  interface Intercept {
    name?: string;
    level?: number;
  }
}
/** Callable `ctx.logger` service shape. */
interface LoggerService extends Record<LoggerType, LoggerMethod> {
  (name?: string): Logger;
}
/**
 * Built-in logging service.
 *
 * Call `ctx.logger()` to create a named logger, or call `ctx.logger.info()`
 * directly to log with the current fiber-derived name.
 */
declare class LoggerService {
  bufferSize: number;
  buffer: Message[];
  ctx: Context;
  _snMessage: number;
  _snExporter: number;
  exporters: Map<number, Exporter>;
  constructor(ctx: Context);
  /**
   * Register an exporter and dispose it with the current fiber.
   *
   * @param exporter — the sink that receives structured log messages.
   * @returns a disposer that removes the exporter.
   */
  exporter(exporter: Exporter): Disposable<Promise<void>>;
  private _resolveConfig;
  [symbols.invoke](name?: string): Logger;
}
//# sourceMappingURL=logger.d.ts.map
//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/context.d.ts
/**
 * Public shape of a Cordis context.
 *
 * The concrete `Context` class is proxied at runtime, so this interface is
 * augmented by core services and plugins to describe the properties that may
 * be read from `ctx`.
 */
interface Context {
  /** Isolation map: service name → scope label. Lookups for a name resolve within its label. */
  [symbols.isolate]: Dict<symbol>;
  /** Intercept map: service name → config merged into that service's per-plugin config. */
  [symbols.intercept]: Dict;
  /** The root context of the application (every child context shares it). @experimental */
  root: this;
  /** Base URL used to resolve relative plugin/module specifiers, if the runtime sets one. */
  baseUrl?: string;
  /** The event bus. Its methods are also mixed onto `ctx` (`ctx.on`, `ctx.emit`, ...). */
  events: EventsService;
  /** The logging service. Call `ctx.logger(name)` for a named logger. */
  logger: LoggerService;
  /** The reflection layer backing the context proxy (`ctx.get`, `ctx.provide`, ...). */
  reflect: ReflectService;
  /** The plugin registry. Its methods are mixed onto `ctx` (`ctx.plugin`, `ctx.inject`). */
  registry: RegistryService;
}
/**
 * Root and child dependency containers for Cordis plugins.
 *
 * A context is a proxy: normal property reads go through the service resolver,
 * while `extend()`, `isolate()`, and `intercept()` create scoped child
 * contexts without mutating their parent.
 */
declare class Context {
  /** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
  static readonly effect: unique symbol;
  /** Symbol key for a context's listener filter, consulted on every event dispatch. */
  static readonly filter: unique symbol;
  /** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
  static readonly isolate: unique symbol;
  /** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
  static readonly intercept: unique symbol;
  /**
   * Returns true for Cordis context proxies and context prototypes.
   *
   * Works across realms and across multiple copies of cordis, because the
   * brand is keyed by a global symbol rather than by `instanceof`.
   *
   * @param value — the value to test.
   * @returns `true` if `value` is a Cordis context, narrowing its type.
   */
  static is(value: any): value is Context;
  /** Create the root context and install the built-in services. */
  constructor();
  /**
   * Create a child context with extra metadata on top of the current scope.
   *
   * The child prototypally inherits every property of this context; own
   * properties of `meta` shadow the inherited ones. The parent is not mutated.
   *
   * @param meta — own properties (including symbol keys) to define on the child.
   * @returns a child context inheriting from this one.
   */
  extend(meta?: {}): this;
  /**
   * Create a child context with an independent service scope for `name`.
   *
   * Below the returned context, reads and writes of the service `name`
   * resolve against the new label instead of the parent's, so a different
   * implementation can be provided without affecting the parent scope.
   * Passing the same `label` to two `isolate()` calls joins their scopes.
   *
   * @param name — the service name to isolate.
   * @param label — scope label to join; defaults to a fresh unique symbol.
   * @returns a child context whose `name` service resolves in the new scope.
   */
  isolate(name: string, label?: symbol): this;
  /**
   * Add service-specific intercept config for plugins started below this
   * context.
   *
   * Plugins loaded under the returned context see `config` merged into the
   * service's resolved config (ancestor entries first; see
   * `Service[symbols.resolveConfig]`). The parent context is not affected.
   *
   * @param name — the service name whose config to intercept.
   * @param config — the intercept config to merge for that service.
   * @returns a child context carrying the additional intercept entry.
   */
  intercept<K extends InjectKey>(name: K, config: Context[K] extends {
    [symbols.config]: infer T;
  } ? T : never): this;
  intercept(name: string, config: any): this;
}
//# sourceMappingURL=context.d.ts.map
//#endregion
//#region ../../deepseek-harness/vendor/cordis/lib/types/service.d.ts
/**
 * Base class for services that expose a named API on `ctx`.
 *
 * Subclasses call `super(ctx, name)` from their constructor. The service is
 * registered immediately and is automatically removed with the owning fiber.
 */
declare abstract class Service<out T = never> {
  protected ctx: Context;
  /** Symbol key of an instance method run after construction (class plugins). */
  static readonly init: unique symbol;
  /** Symbol key of the availability predicate passed to `ctx.provide()`. */
  static readonly check: unique symbol;
  /** Symbol key of the phantom intercept-config type parameter. */
  static readonly config: unique symbol;
  /** Symbol key of the call body making a service callable (e.g. `ctx.logger()`). */
  static readonly invoke: unique symbol;
  /** Symbol key of the helper deriving an extended service instance. */
  static readonly extend: unique symbol;
  /** Symbol key of the tracker metadata used for context tracing. */
  static readonly tracker: unique symbol;
  /** Symbol key of the intercept-config resolution helper below. */
  static readonly resolveConfig: unique symbol;
  [symbols.config]: T;
  /** The service name this instance is registered under. */
  name: string;
  /**
   * Register this instance as `name` in the current context.
   *
   * Calls `ctx.reflect.provide(name, this, this[Service.check])`, so the
   * service is unregistered automatically when the owning fiber unloads.
   * Services with a `[Service.invoke]` body return a callable instance.
   *
   * @param ctx — the context to register in (stored as `this.ctx`).
   * @param name — the service name; defaults to the static `provide` field.
   */
  constructor(ctx: Context, name: string);
  protected [symbols.filter](ctx: Context): boolean;
  protected [symbols.extend](props?: any): any;
  /**
   * Merge intercept config from ancestors with optional base and head values.
   *
   * Entries added closer to the root apply first; `base` is prepended and
   * `head` appended. Uses `Config.merge` when the service declares one,
   * otherwise a shallow `Object.assign`.
   *
   * @param base — lowest-precedence config merged before all intercepts.
   * @param head — highest-precedence config merged after all intercepts.
   * @returns the merged config.
   */
  [symbols.resolveConfig](base?: T, head?: T): T;
  static [Symbol.hasInstance](instance: any): boolean;
}
//# sourceMappingURL=service.d.ts.map

//#endregion
//#region ../../deepseek-harness/vendor/schemastery/lib/types/index.d.ts
sideEffect();
type Schema<S = any, T = S> = Schemastery<S, T>;
declare const Schema: Schemastery.Static;
//#endregion
//#region src/config.d.ts
/** 支持的生成服务商。minimax 为 MiniMax 官方平台直连（仅视频），threerouter 为聚合器（所有模型）。 */
type Provider = 'threerouter' | 'wanx' | 'minimax' | 'seedance';
/** 单个服务商的凭证与自定义接口地址。 */
interface ProviderCredentials {
  /** 服务商 API Key；切换 provider 后对应 key 立即生效。 */
  apiKey: string;
  /** 自定义接口地址，留空使用服务商默认端点。 */
  baseURL?: string;
}
/** 水印位置（四角之一）。 */
type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
/**
 * 品牌水印后处理配置。所有尺寸类参数都是**相对图片宽/高的比例**，
 * 保证同一套配置对不同尺寸出图观感一致。
 */
interface WatermarkConfig {
  /** 是否对最终图片合成品牌水印（关闭时图片流程完全不受影响）。 */
  enabled: boolean;
  /** 水印文字。 */
  text: string;
  /** 主文字不透明度（0-1）。 */
  opacity: number;
  /** 水印位置：四角之一。 */
  position: WatermarkPosition;
  /** 字号占图片宽度的比例。 */
  fontSizeRatio: number;
  /** 水平留白占图片宽度的比例。 */
  marginXRatio: number;
  /** 垂直留白占图片高度的比例。 */
  marginYRatio: number;
  /** 是否给水印加柔光（浅色底图上也看得见）。 */
  glowEnabled: boolean;
  /** 柔光颜色。 */
  glowColor: string;
  /** 柔光半径占字号的比例。 */
  glowBlurRatio: number;
}
interface Config {
  /** 当前激活的服务商，切换后立即生效（HMR）。 */
  provider: Provider;
  /** Threerouter 凭证；provider=threerouter 时使用（支持图片+视频）。 */
  threerouter: ProviderCredentials;
  /** 万象（wanx）凭证；provider=wanx 时使用。 */
  wanx: ProviderCredentials;
  /** MiniMax 官方平台凭证；provider=minimax 时使用（图片与视频）。 */
  minimax: ProviderCredentials;
  /** Seedance2.5 凭证；provider=seedance 时使用。 */
  seedance: ProviderCredentials;
  /** 默认图片服务商；留空跟随激活服务商。 */
  defaultImageProvider: '' | Provider;
  /** 默认视频服务商；留空跟随激活服务商，adapter 使用其内置默认模型。 */
  defaultVideoProvider: '' | Provider;
  /** 默认图片模型；留空使用 adapter 内置默认模型。 */
  defaultImageModel: string;
  /** 默认视频模型；留空使用 adapter 内置默认模型。 */
  defaultVideoModel: string;
  /** 默认图片尺寸，形如 "1024*1024"。 */
  defaultImageSize: string;
  /** 默认视频时长（秒），上限 30；具体模型能力由上游校验。 */
  defaultVideoDuration: number;
  /**
   * 图片提交传输方式：
   * - `auto`：优先异步网关（幂等 + 超时找回），服务商不支持或探测到不可用时降级同步；
   * - `async`：强制异步，端点不可用即响亮失败（上线验收口径）；
   * - `sync`：强制同步单次提交（无幂等，仅保证「不自动重提」）。
   */
  imageTransport: 'auto' | 'async' | 'sync';
  /**
   * 提交结果未知（超时/断连/5xx 且按幂等键反查无果）后的策略：
   * - `fail`：不自动重提，响亮失败并回报 request_id（默认，最保守）；
   * - `resubmit-same-key`：用同一个幂等键再提交一次（服务端按键去重，不会重复生成）。
   */
  imageUnknownStatePolicy: 'fail' | 'resubmit-same-key';
  /** 单次 HTTP 请求超时（毫秒）。 */
  timeoutMs: number;
  /** 视频任务轮询间隔（毫秒）。 */
  pollIntervalMs: number;
  /** 视频任务整体超时（毫秒），超时后中止轮询。 */
  pollTimeoutMs: number;
  /** 可重试错误的最大重试次数（仅作用于幂等的读取类请求；生图提交永远不重试）。 */
  retryTimes: number;
  /** 生成媒体落地目录，相对路径基于进程 cwd 解析；插件启动时解析为绝对路径并打日志。 */
  outputsDir: string;
  /** 图片最终结果的品牌水印后处理。 */
  watermark: WatermarkConfig;
}
/** 插件配置 schema，默认服务商为 threerouter（图片+视频统一入口），wanx/seedance 可选。 */
declare const Config: Schema<Config>;
/**
 * 读取指定服务商的凭证，不校验 key 非空。供候选服务商构建时的 key 过滤
 * （resolveModelCandidates 用它跳过未配置 key 的候选），不抛错。
 */
//#endregion
//#region src/watermark.d.ts
/** 水印处理结果。 */
interface WatermarkResult {
  /** 最终图片字节（失败时为原始字节）。 */
  data: Uint8Array;
  /** 最终图片 MIME 类型。 */
  contentType: string;
  /** 是否真的合成了水印（enabled=false / 文本为空 / 出错时为 false）。 */
  applied: boolean;
  /** 未合成时的原因说明（供结果层透明告知）；正常合成时缺省。 */
  note?: string;
}
/**
 * 给图片加品牌水印。
 * @param data - 模型返回的原始图片字节。
 * @param contentType - 原始 MIME 类型（决定输出编码，保持与上游一致的格式）。
 * @param config - 水印配置（enabled=false 时直接原样返回）。
 * @returns 处理结果（含 applied / note，供结果层如实告知）。
 */
declare function applyImageWatermark(data: Uint8Array, contentType: string, config: WatermarkConfig): Promise<WatermarkResult>;
/**
 * 构造水印 SVG。导出供单测直接断言坐标/字号等几何决策，无需真的解码图片。
 * @param width - 图片宽度（像素）。
 * @param height - 图片高度（像素）。
 * @param text - 水印文字（已 trim，非空）。
 * @param config - 水印配置。
 */
declare function buildWatermarkSvg(width: number, height: number, text: string, config: WatermarkConfig): string;
/**
 * 计算字号：基准为 `宽度 × fontSizeRatio`，并保证估算文字宽度不超过
 * 可用宽度（图片宽度减两侧留白）的 95%，避免窄图上水印横向溢出。
 * @param text - 水印文字。
 * @param width - 图片宽度。
 * @param marginX - 单侧水平留白。
 * @param fontSizeRatio - 字号占图片宽度的比例。
 * @returns 最终字号（像素，至少 10px）。
 */
declare function fitFontSize(text: string, width: number, marginX: number, fontSizeRatio: number): number;
//#endregion
//#region src/http-client.d.ts
/**
 * 统一 HTTP 请求客户端：封装 fetch，分类异常，可配置重试。
 * 鉴权失败、配额耗尽等不可重试错误立即抛出；超时、网络抖动按配置重试。
 * @module dsh-image-video/http-client
 */
/** 异常种类，区分可重试与不可重试。 */
type ErrorKind = 'auth' | 'quota' | 'task' | 'timeout' | 'network';
/** 所有生成相关错误的基类，携带友好中文提示与分类标记。 */
declare class GenerationError extends Error {
  readonly kind: ErrorKind;
  /** 是否值得重试：仅超时与网络抖动重试，鉴权/配额/任务逻辑错误立即失败。 */
  readonly retryable: boolean;
  /** 原始 HTTP 状态码，任务级错误可能为 undefined。 */
  readonly status?: number;
  /** 服务端 Retry-After 建议的等待时间（毫秒）。 */
  readonly retryAfterMs?: number;
  /**
   * 服务端返回的机器可读错误码（形如 `{"error":{"code":"IDEMPOTENCY_IN_PROGRESS"}}`）。
   * 生图事务靠它区分「提交未落地（可回退候选）」与「提交状态未知（绝不重提）」，
   * 因此必须比 message 文本更可靠地保留下来。
   */
  readonly code?: string;
  constructor(kind: ErrorKind, message: string, retryable: boolean, status?: number, retryAfterMs?: number, code?: string);
}
/** 服务端错误码：幂等键对应的首次提交仍在进行中（GateWay 异步图片契约）。 */

/**
 * 判定错误是否为「异步图片端点在本环境不可用」：功能未开启（未配对象存储）或
 * 该分组平台不支持 Images API。两者都在创建任务前返回 404，因此降级到同步
 * 单次提交不会产生重复生成。
 */
declare function isAsyncImageUnavailableError(err: unknown): boolean;
/** 判定错误是否为「同一幂等键首次提交仍在进行中」：任务已存在，应凭 request_id 找回而非重提。 */

/**
 * 判定错误是否为「提交状态未知」——客户端无法确认请求是否已在服务端创建任务。
 * 超时、连接中断、502/503 都属于此类：**绝不允许自动重提或换模型**，只能凭
 * request_id 反查（见 image-transaction.ts）。
 */
declare function isUnknownSubmitStateError(err: unknown): boolean;
/**
 * 判定错误是否为「调用方主动取消」。取消同样可能发生在请求已抵达服务端之后，
 * 因此不视为「未提交」——只是不再做任何自动动作（找回/重提都不做）。
 */

/**
 * 判定错误是否为「模型不被该服务商接受」类，供工具层在候选服务商间回退。
 * 实测形态（2026-09）：
 * - threerouter：目录中无可用渠道的模型 → HTTP 503 capacity_error
 *   "No available media generation channels"（网关按模型找渠道，未知模型即无渠道）；
 * - threerouter：分组未开通生图 → HTTP 403 permission_error
 *   "Image generation is not enabled for this group"（文档语义：401=Key 无效，
 *   403=无该分组/模型权限或未开通生图 allow_image_generation——属于「该候选
 *   无法服务此请求」，应换下一候选，而非响亮终止）；
 * - 部分服务商：HTTP 400/404 + 模型不存在类消息（"model not found" / "模型不存在"）；
 * - 能力缺失：如「不支持图片生成」。
 * 注意区分语义相近的参数级 400——如 "model X does not support duration 1s"
 * （时长档位问题，模型本身可用），该类消息不命中本判定，不触发换家。
 * 其余 5xx（无 capacity_error 语义）、Key 无效（401）、配额（429）、超时一律不成立：
 * 响亮失败，避免用别家的 key 静默掩盖本服务商的配置问题。
 */
declare function isModelNotAcceptedError(err: unknown): boolean;
/** 请求选项。 */
interface RequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  /** JSON 请求体；GET 请求忽略。 */
  body?: unknown;
  /** 单次请求超时（毫秒）。 */
  timeoutMs: number;
  /** 最大重试次数（仅对可重试错误生效）。 */
  retryTimes: number;
  /** 取消信号，由调用方（任务管理器）传入。 */
  signal?: AbortSignal;
}
/** 请求结果。 */
interface RequestResult {
  ok: true;
  status: number;
  data: unknown;
  headers: Headers;
}
/**
 * 分类 HTTP 响应错误，生成友好中文提示。
 * 内部实现，不在 execute 外部直接调用。通过 `classifyErrorForTest` 导出用于单元测试。
 */
/**
 * 解析 Retry-After 响应头为毫秒（支持秒数与 HTTP 日期两种形态），上限 180s。
 * 导出供适配器读取 202/409 上的服务端建议轮询间隔。
 */
//#endregion
//#region src/providers/types.d.ts
/** 图片生成请求参数（不传 image 为文生图，传入 image 为图生图/参考图编辑）。 */
interface ImageGenParams {
  /** 客户端生成事务唯一 ID；服务端必须按此字段幂等。 */
  requestId?: string;
  /** 提示词。 */
  prompt: string;
  /** 图片尺寸，如 "1024x1024"（分隔符可能为 `*`，适配器经 normalizeImageSize 归一化）。 */
  size: string;
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string;
  /**
   * 可选参考图，存在时走图生图：http(s) URL、data URL（本地路径已由调用方经
   * media.resolveImageReference 统一解析），适配器只负责放到各自协议字段。
   * 各家语义不同：threerouter /images/edits 按提示词编辑、方舟 Seedream 参考编辑、
   * MiniMax 主体一致性（保留主体换场景）。
   */
  image?: string;
  /**
   * 多参考图（按调用方顺序）：首图通常是底图，其余图片是编辑/身份参考。
   * threerouter 适配器会以 `image_urls` 发给服务端；不支持多图的直连适配器
   * 至少使用第一张图，保持旧版单图协议兼容。
   */
  images?: string[];
}
/** 视频生成请求参数（文生视频，带 image 时为首帧驱动的图生视频）。 */
interface VideoGenParams {
  /** 提示词。 */
  prompt: string;
  /** 视频时长（秒），上限 10。 */
  duration: number;
  /** 可选宽高比，如 "16:9"。存在 image 时构图由首帧图片决定，适配器不传该字段。 */
  aspectRatio?: string;
  /** 可选模型名，留空使用适配器默认模型。 */
  model?: string;
  /**
   * 可选首帧图片，存在时走图生视频：http(s) URL、data URL 或本地文件路径。
   * 调用方经 media.resolveImageReference 统一解析后才传入，适配器只负责放到各自字段。
   */
  image?: string;
  /**
   * wan3.0-video 多关键帧：按时间点排列的参考图序列（如 position '0s' / '1s'…）。
   * 调用方经 media.resolveVideoMedia 统一解析（压缩 + 转 data URL），
  * 适配器按文档转换为 type/url；存在时 image 字段忽略。
   */
  media?: Array<{
    url: string;
    type?: string;
    position?: string;
  }>;
  /** 可选分辨率档位，取值由服务商与模型决定（如 MiniMax-H3 支持 480P/768P/2K）；留空用服务商默认。 */
  resolution?: string;
}
/** 任务提交结果。 */
interface SubmitResult {
  /** 任务 ID；同步接口返回空字符串。 */
  taskId: string;
  /** true 表示需要轮询查询，false 表示同步已返回结果。 */
  async: boolean;
  /** 同步接口直接返回的媒体 URL；async=false 时有值。 */
  mediaUrl?: string;
  /** 媒体类型，用于区分图片/视频渲染。 */
  mediaType: 'image' | 'video';
  /** true 表示请求携带的 duration 因模型不支持自定义时长被丢弃（结果层据此在 notes 注明）。 */
  droppedDuration?: boolean;
  /**
   * 实际发给上游的模型名（含适配器内置默认的兜底结果）。结果层据此向用户
   * 透明报告「这次到底用了哪个模型」，无需再靠配置推断。
   */
  model?: string;
  /**
   * 同步接口直接返回的 base64 图片字节（MiniMax image_generation 等）。
   * 有值时结果层直接落盘，跳过 downloadAndSave 下载步骤。
   */
  mediaBase64?: {
    data: string;
    mediaType: string;
  };
}
/** 任务查询结果。 */
type TaskQueryResult = {
  status: 'pending' | 'running';
} | {
  status: 'succeeded';
  mediaUrl: string;
} | {
  status: 'failed';
  error: string;
};
/**
 * 异步图片提交结果（202 Accepted 形态）。
 * 与 {@link SubmitResult} 的区别：这里只有「任务已被接受」这一个事实，
 * 结果图 URL 必须经轮询端点取得，因此不存在同步返回的 mediaUrl。
 */
interface AsyncImageSubmit {
  /** 网关任务 ID（`imgtask_…`），轮询与找回的唯一句柄。 */
  taskId: string;
  /** 本次提交实际使用的模型名（服务商回报或本地推断）。 */
  model?: string;
  /** 服务端回显的幂等键。 */
  requestId?: string;
  /** true = 服务端幂等回放（`X-Idempotency-Replayed: true`），本次没有新建任务。 */
  replayed?: boolean;
  /** 服务端建议的轮询间隔（`Retry-After` 秒）；缺省用配置的轮询间隔。 */
  retryAfterSec?: number;
}
/**
 * 异步图片网关能力（可选）：提交立即返回任务句柄、结果经轮询取得，
 * 并支持「凭幂等键找回任务」——这是提交响应因超时/断连丢失后不重复
 * 生成的唯一自救通道。只有实现该能力的服务商才允许配置 async 传输。
 */
interface ImageAsyncCapability {
  /** 提交一次图片生成任务，返回任务句柄（服务端保证同一幂等键只创建一次）。 */
  submit(params: ImageGenParams, opts: HttpOpts): Promise<AsyncImageSubmit>;
  /** 查询任务状态；图片任务与视频任务的查询端点可能不同。 */
  query(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>;
  /** 凭幂等键找回原任务；未找到返回 undefined（不抛错，由上层按策略决定）。 */
  findByRequest(requestId: string, opts: HttpOpts): Promise<{
    taskId: string;
  } | undefined>;
}
/** HTTP 请求选项子集，由工具层从 Config 解析后传入。 */
interface HttpOpts {
  apiKey: string;
  baseURL: string;
  timeoutMs: number;
  retryTimes: number;
  signal?: AbortSignal;
}
/** 将 HttpOpts 转换为 RequestOptions。 */

/** 服务商适配器接口。 */
interface ProviderAdapter {
  /** 提交文生图任务（同步语义：返回体即结果，或返回可轮询的异步任务句柄）。 */
  submitImage(params: ImageGenParams, opts: HttpOpts): Promise<SubmitResult>;
  /** 提交文生视频任务（始终异步）。 */
  submitVideo(params: VideoGenParams, opts: HttpOpts): Promise<SubmitResult>;
  /** 查询异步任务状态。 */
  queryTask(taskId: string, opts: HttpOpts): Promise<TaskQueryResult>;
  /**
   * 异步图片网关能力（可选能力声明）。实现它的服务商才能接受 `imageTransport: async`：
   * 提交即返回任务句柄、结果经 `query` 轮询、响应丢失时经 `findByRequest` 找回。
   * 未实现时工具层按同步单次提交处理（仍然只提交一次、超时不重提）。
   */
  imageAsync?: ImageAsyncCapability;
}
/** 从 "1024x1024" 格式解析宽高。 */
//#endregion
//#region src/task-manager.d.ts
/** 轮询完成结果。 */
interface PollResult {
  /** 媒体下载 URL。 */
  mediaUrl: string;
  /** 任务耗时（毫秒）。 */
  elapsedMs: number;
}
/**
 * 查询函数签名：可由适配器（视频/自带异步任务的服务商）或专门的图片任务查询
 * 实现（网关 `/images/tasks/{id}`）提供。
 */
type TaskQueryFn = (taskId: string, opts: HttpOpts) => Promise<TaskQueryResult>;
/**
 * 任务管理器：管理所有进行中的生成任务轮询。
 * 在 apply() 中实例化，通过 ctx.effect 注册卸载清理。
 */
declare class TaskManager {
  /** 进行中的任务，key 为 taskId。 */
  private readonly active;
  /** 配置引用。 */
  private readonly config;
  constructor(ctx: Context, config: Config);
  /**
   * 轮询任务直到完成、失败或超时。
   * 使用 AbortSignal 支持外部取消（插件卸载或工具调用超时）。
   * 轮询过程中不产生中间输出，仅最终结果返回给模型，不阻塞对话上下文。
   * @param taskId - 服务商返回的任务 ID。
   * @param query - 查询实现：适配器实例（用其 queryTask）或直接的查询函数。
   * @param httpOpts - HTTP 请求选项（含凭证与超时）。
   * @param externalSignal - 外部取消信号（工具执行上下文的 exec.signal）。
   * @returns 媒体 URL 与耗时。
   * @throws {GenerationError} 任务失败、超时或被取消（超时错误带 task_id）。
   */
  pollUntilDone(taskId: string, query: ProviderAdapter | TaskQueryFn, httpOpts: HttpOpts, externalSignal?: AbortSignal): Promise<PollResult>;
  /** 获取当前进行中的任务数，供状态展示。 */
  get activeCount(): number;
  /**
   * 判定查询阶段的错误是否属于「瞬时故障、值得继续轮询」。
   * 可重试分类（网络/超时/5xx/限流）与不可重试的鉴权/参数错误区分开：
   * 后者继续轮询只会白等，立即抛出。
   */
  private isTransientQueryError;
  /** 可被取消的延时；信号触发时立即 reject。 */
  private sleep;
}
//#endregion
//#region src/image-transaction.d.ts
/** 图片提交传输方式：async = 网关异步任务（有幂等与找回），sync = 同步端点（无幂等）。 */
type ImageTransport = 'async' | 'sync';
/**
 * 提交状态未知（超时/断连/5xx 且找回无果）后的策略。
 * - `fail`（默认）：不自动重提，响亮失败并给出 requestId，由用户决定是否重试。
 * - `resubmit-same-key`：用**同一个幂等键**再提交一次。服务端保证同一键只创建
 *   一个任务（回放原响应或返回 409 进行中），因此不会重复生成；仅 async 传输可用。
 */
type UnknownStatePolicy = 'fail' | 'resubmit-same-key';
/** 事务状态机取值。 */
type TransactionStatus = /** 已创建，尚未提交。 */
'idle'
/** 提交请求已发出。 */ | 'submitting'
/** 服务端已接受任务（有 taskId）。 */ | 'accepted'
/** 提交结果未知：可能已创建任务，也可能没有——只能反查，不能重提。 */ | 'unknown'
/** 成功拿到结果。 */ | 'succeeded'
/** 明确失败：服务端在创建任务之前拒绝，或任务本身执行失败。 */ | 'failed';
/**
 * 事务账本：一次 `generate_image` 调用对应一个实例，记录提交/找回/结果的
 * 全部事实，作为结果元数据回给用户（「本次到底提交了几次」必须可核对）。
 */
interface ImageTransaction {
  /** 幂等键（服务端按 `Idempotency-Key` 去重，找回也用它）。 */
  readonly requestId: string;
  /** 实际路由到的服务商。 */
  readonly provider: Provider;
  /** 用户配置/工具参数指定的模型（适配器默认值不在其中）。 */
  readonly model: string | undefined;
  /** 传输方式；async 不可用降级时会改为 sync。 */
  transport: ImageTransport;
  status: TransactionStatus;
  /** 物理提交次数（计费风险计数）：正常恒为 1，仅同键重提时为 2。 */
  submitAttempts: number;
  /** 凭 requestId 反查原任务的次数（只读查询，不计费）。 */
  recoveryLookups: number;
  /** 服务端任务 ID（提交被接受后可得）。 */
  taskId?: string;
  /** 提交开始/结束时间戳（毫秒）。 */
  submitStartedAt?: number;
  submitFinishedAt?: number;
  /** 服务端幂等回放标记：为 true 时本次没有新建任务。 */
  replayed?: boolean;
  /** 是否发生过降级（async → sync）或同键重提，供结果层透明告知。 */
  degraded?: boolean;
}
/** 创建事务账本。 */
declare function createImageTransaction(input: {
  requestId: string;
  provider: Provider;
  model: string | undefined;
  transport: ImageTransport;
}): ImageTransaction;
/** 提交预算上限：默认 1；同键重提策略下允许 2（第二次必须复用同一个幂等键）。 */
declare function submitBudget(options?: {
  allowSameKeyRetry?: boolean;
}): number;
/**
 * 消费一次提交预算。达到上限后再次调用一律抛错——这是「一次请求只生成一张」
 * 的硬闸门：任何异常路径都不可能在同一个事务里再发一次新的计费请求。
 * @throws {GenerationError} 当本事务已用尽提交预算。
 */
declare function consumeSubmitBudget(tx: ImageTransaction, options?: {
  allowSameKeyRetry?: boolean;
}): void;
/**
 * 判定当前失败是否允许回退到**下一个候选服务商**。
 *
 * 与 `isModelNotAcceptedError` 的区别在于多了一层事务状态门：
 * - 状态必须停在 `failed`——即服务端明确表示「没有创建任务」；
 *   状态为 `unknown` 时绝不换家（否则可能两家各生成一张、各扣一次费）。
 * - 提交次数必须恰好为 1（未被同键重提污染）。
 * - 5xx 只有实证的「无可用渠道」形态才允许换家：网关按模型查渠道发生在调用上游
 *   之前，无渠道即无任务；其余 5xx 一律视为未知状态。
 * @param err - 提交抛出的错误。
 * @param tx - 当前事务账本。
 * @returns 是否允许换下一个候选服务商。
 */
declare function canFallbackToNextProvider(err: unknown, tx: ImageTransaction): boolean;
/** 结果元数据里的事务摘要（写进工具输出，让用户能核对「提交了几次」）。 */
interface TransactionReport {
  requestId: string;
  transport: ImageTransport;
  submitAttempts: number;
  recoveryLookups: number;
  status: TransactionStatus;
  taskId?: string;
  replayed?: boolean;
  degraded?: boolean;
}
/** 导出事务摘要（缺省字段不出现在结果里，避免噪音）。 */
declare function reportTransaction(tx: ImageTransaction): TransactionReport;
/**
 * 构造「提交状态未知」错误。文案必须做到三件事：说清事实（可能已在计费）、
 * 说清客户端已经做了什么（按幂等键查过了、没查到）、给可执行的下一步
 * （凭 requestId 找回，或用户明确要求后重试）。
 */
declare function unknownStateError(tx: ImageTransaction, cause: unknown): GenerationError;
/** 找回查询预算（次数与间隔）。 */
interface RecoveryBudget {
  /** 最多查询次数（含首次）。 */
  attempts: number;
  /** 相邻两次查询之间的等待（毫秒）；服务端给了 Retry-After 时首次等待优先用它。 */
  delayMs: number;
}
/** 事务执行依赖。 */
interface RunImageTransactionDeps {
  tx: ImageTransaction;
  adapter: ProviderAdapter;
  params: ImageGenParams;
  /** 提交与查询共用的 HTTP 选项（提交路径内部强制 retryTimes: 0）。 */
  httpOpts: HttpOpts;
  /** 提交后的轮询实现（由工具层注入 TaskManager，本模块不关心轮询细节）。 */
  poll: (taskId: string, signal?: AbortSignal) => Promise<{
    mediaUrl: string;
  }>;
  /** 未知状态策略。 */
  unknownStatePolicy: UnknownStatePolicy;
  /** 找回查询预算。 */
  recovery: RecoveryBudget;
  /** 可注入的等待实现（测试用假时钟）。 */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** 过程日志（由工具层转成 notes，透明告知用户为什么走了这条路）。 */
  onNote?: (note: string) => void;
}
/** 事务结果。 */
interface RunImageTransactionResult {
  submit: SubmitResult;
  transport: ImageTransport;
}
/**
 * 执行图片生成事务：**最多一次提交**，提交后轮询结果；提交结果未知时凭幂等键
 * 找回原任务，而不是重新生成。
 *
 * 分支与依据（服务端 HTTP 契约表）：
 * - 202 接受 → 轮询 `task_id`；`X-Idempotency-Replayed` 为真表示本次未新建任务。
 * - 409 `IDEMPOTENCY_IN_PROGRESS` → 任务已存在 → 按 Retry-After 等一下再反查。
 * - 409 `IDEMPOTENCY_KEY_CONFLICT` → 幂等键被复用于不同请求体（客户端 bug）→ 响亮失败。
 * - 404 异步端点不可用 → 抛 {@link AsyncTransportUnavailableError}，由调用方降级同步
 *   （服务端在创建任务前返回，降级不会重复生成）。
 * - 4xx 其他（400/401/403/413/429）→ 明确没建任务 → 状态置 `failed`，允许换候选。
 * - 超时 / 断连 / 5xx → 状态置 `unknown` → 反查；查到就继续等，查不到按策略处理。
 *
 * @returns 提交结果与最终使用的传输方式。
 * @throws {AsyncTransportUnavailableError} 异步端点在本环境不可用（请降级同步）。
 * @throws {GenerationError} 其他分类错误；`tx.status` 反映是否允许换候选。
 */
declare function runImageTransaction(deps: RunImageTransactionDeps): Promise<RunImageTransactionResult>;
/** 异步图片传输在本环境不可用（功能未开启 / 分组平台不支持）：调用方应降级同步。 */
declare class AsyncTransportUnavailableError extends GenerationError {
  constructor(detail: string);
}
/** 异步端点不可用的错误码（工具层据此决定降级）。 */

/** 传输能力探测缓存：避免每次调用都为一个已知不可用的端点付一次 404 往返。 */
interface TransportProbeCache {
  /** 已知不可用状态持续到该时间点（毫秒时间戳）。 */
  unavailableUntil: number;
}
/** 传输能力探测缓存有效期：服务端上线/开启对象存储后自动恢复，无需重启客户端。 */
declare const TRANSPORT_PROBE_TTL_MS: number;
/** 默认找回预算：5 次、间隔 5 秒（服务端提交响应通常秒级落库）。 */
declare const DEFAULT_RECOVERY_BUDGET: RecoveryBudget;
/**
 * 依据配置与探测缓存决定本次调用的传输方式。
 * - `sync`：强制同步（无幂等，仅单次提交保障）。
 * - `async`：强制异步；端点不可用时响亮失败（上线验收用这个口径）。
 * - `auto`：优先异步，服务商不支持或近期探测到不可用时降级同步。
 */
declare function resolveImageTransport(configured: 'async' | 'sync' | 'auto', adapter: ProviderAdapter, probe: TransportProbeCache | undefined, now?: number): ImageTransport;
//#endregion
//#region src/image-preflight.d.ts
/** 预检查输入：本次调用已经解析完的所有决策。 */
interface ImagePreflightInput {
  provider: Provider;
  /** 工具参数 > 配置 defaultImageModel；undefined 表示交给服务商内置默认。 */
  model: string | undefined;
  /** 请求尺寸（可能是 宽*高 / 宽x高 / 比例）。 */
  size: string;
  /** 是否带参考图（决定文生图 / 图生图）。 */
  hasReferenceImage: boolean;
  /** 本次实际使用的传输方式。 */
  transport: ImageTransport;
  /** 适配器是否声明了异步图片网关能力。 */
  adapterSupportsAsync: boolean;
  config: Config;
}
/** 预检查结论：本次调用的完整决策快照，同时作为 notes 透明告知用户。 */
interface ImagePreflight {
  provider: Provider;
  model: string | undefined;
  size: string;
  mode: 'text-to-image' | 'image-to-image';
  transport: ImageTransport;
  /** 水印后处理决策（未开启时 enabled=false）。 */
  watermark: {
    enabled: boolean;
    text: string;
  };
}
/**
 * 执行调用前预检查。任何**确定无法成功**的输入在这里直接失败，绝不带着错误
 * 参数去打一次真金白银的生成请求。
 * @param input - 已解析的调用决策。
 * @returns 预检查结论。
 * @throws {GenerationError} 尺寸写法无法识别、模型明显是视频模型、异步传输不被支持。
 */
declare function resolveImagePreflight(input: ImagePreflightInput): ImagePreflight;
/**
 * 模型名是否明显属于视频模型。命中条件之一即可，且**显式配置优先**：
 * 当用户把 defaultImageModel 明确设成该名字时不再拦截（用户的显式选择胜过启发式）。
 * @param model - 模型名。
 * @param config - 插件配置。
 * @returns 是否判定为视频模型。
 */
declare function looksLikeVideoModel(model: string, config: Config): boolean;
/**
 * 把预检查结论格式化为一行透明告知，写进工具结果 notes：
 * 「本次用了谁、什么模型、什么尺寸、走哪条传输、要不要打水印」一句话说完，
 * 用户不必查配置或翻服务商后台。
 */
declare function formatPreflightNote(preflight: ImagePreflight): string;
//#endregion
//#region src/providers/wanx.d.ts
/** 万象适配器实例。 */
declare const wanxAdapter: ProviderAdapter;
/** 从配置解析万象 HttpOpts（已由 config.resolveActiveProvider 解析凭证）。 */
//#endregion
//#region src/providers/seedance.d.ts
/** Seedance 适配器实例。 */
declare const seedanceAdapter: ProviderAdapter;
/** 复用 downloadMedia。 */

//#endregion
//#region src/providers/threerouter.d.ts
/** Threerouter 适配器实例：统一入口同时支持文生图与文生视频。 */
declare const threerouterAdapter: ProviderAdapter;
/** 复用 downloadMedia。 */
//#endregion
//#region ../../deepseek-harness/packages/attachment/attachment/lib/types/error.d.ts
declare const ATTACHMENT_ERROR_CODES: readonly ["TOO_MANY_IMAGES", "IMAGES_TOO_LARGE", "UNSUPPORTED_IMAGE_TYPE", "INVALID_IMAGE_BASE64", "INVALID_IMAGE", "IMAGE_TYPE_MISMATCH", "IMAGE_TOO_LARGE", "IMAGE_TOO_MANY_PIXELS", "IMAGE_DIMENSION_TOO_LARGE", "INVALID_FILE_BASE64", "INVALID_ATTACHMENT_REF", "ATTACHMENT_CORRUPT", "ATTACHMENT_WRITE_FAILED", "ATTACHMENT_NOT_FOUND", "ATTACHMENT_READ_FAILED", "ATTACHMENT_PROJECTION_UNSUPPORTED", "ATTACHMENT_FILES_UNSUPPORTED"];
/** Stable attachment failure codes used for protocol error routing. */
type AttachmentErrorCode = typeof ATTACHMENT_ERROR_CODES[number];
/**
 * Stable failures suitable for host RPC error mapping.
 *
 * Deliberately re-implements the `HarnessError` shape instead of extending it:
 * the base lives in `@deepseek-ai/dsh-llm`, which itself depends on this
 * package (`ImageBlock` references `ImageAttachmentRef`), so sharing the base
 * would create a dependency cycle. Consumers route on `code`, never on the
 * prototype chain, so the shapes stay interchangeable at the wire boundary.
 */
declare class AttachmentError extends Error {
  /** Stable machine-routing failure code. */
  readonly code: AttachmentErrorCode;
  /**
   * @param message - human-readable failure description without raw bytes or host paths.
   * @param code - stable machine-routing code.
   * @param options - optional chained cause.
   */
  constructor(message: string, code: AttachmentErrorCode, options?: ErrorOptions);
}
/**
 * Identify attachment failures by their stable code across duplicate package installations.
 * @param error - failure raised while validating, persisting, or reading an attachment.
 * @returns whether the failure carries a recognized attachment error code.
 */
//#endregion
//#region ../../deepseek-harness/packages/attachment/attachment/lib/types/brand.d.ts
/** Opaque content-addressed identifier for one immutable attachment object. */
type AttachmentId = Branded<'AttachmentId'>;
/**
 * Brand a validated storage identifier.
 * @param value - backend-produced opaque identifier.
 * @returns the branded identifier.
 */
declare function AttachmentId(value: string): AttachmentId;
/** Opaque deterministic identity for one request-image transformation. */
type ImageVariantId = Branded<'ImageVariantId'>;
/**
 * Brand a validated request-image transformation identifier.
 * @param value - attachment-provider-produced opaque identifier.
 * @returns the branded identifier.
 */
declare function ImageVariantId(value: string): ImageVariantId;
//# sourceMappingURL=brand.d.ts.map
//#endregion
//#region ../../deepseek-harness/packages/attachment/attachment/lib/types/types.d.ts
/** Raster image formats accepted by the version-one attachment path. */
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
/** Durable, serializable reference to one immutable normalized image. */
interface ImageAttachmentRef {
  /** Opaque storage identifier; never a filesystem path or bearer URL. */
  attachmentId: AttachmentId;
  /** Media type verified from the stored bytes. */
  mediaType: ImageMediaType;
  /** Exact encoded byte length. */
  bytes: number;
  /** Intrinsic encoded width in pixels. */
  width: number;
  /** Intrinsic encoded height in pixels. */
  height: number;
  /** Optional display name stripped of local path information. */
  name?: string;
  /**
   * Input dimensions after applying EXIF orientation and before normalization
   * scaling. Present only when normalization reduced the image.
   */
  originalDimensions?: {
    width: number;
    height: number;
  };
}
/**
 * Durable, serializable reference to one verbatim stored file. Files are
 * stored byte-for-byte with no normalization; `attachmentId` is the sha256
 * digest of exactly those bytes.
 */
interface FileAttachmentRef {
  /** Opaque content-addressed storage identifier; never a filesystem path or bearer URL. */
  attachmentId: AttachmentId;
  /** Sanitized display filename, also the stored object's leaf name. */
  name: string;
  /** Exact byte length. */
  bytes: number;
}
/** Base64-encoded file upload accompanying one wire request. */
interface EncodedFileAttachment {
  /** Canonical base64 encoding of the file bytes. */
  data: string;
  /** Optional display name; it is never interpreted as a path. */
  name?: string;
}
/** Request to durably commit one file verbatim. */
interface SaveFileAttachment {
  data: Uint8Array;
  /** Optional browser/provider display name; it is never interpreted as a path. */
  name?: string;
}
/** Request to durably commit one file from bounded byte chunks. */
interface SaveFileStreamAttachment {
  /** Exact file bytes in order; providers must not retain the complete sequence in memory. */
  data: AsyncIterable<Uint8Array>;
  /** Optional cancellation for source reads and storage writes. */
  signal?: AbortSignal;
  /** Optional browser/provider display name; it is never interpreted as a path. */
  name?: string;
}
/** Deployment-resolved limits used by upload admission and request buffering. */
interface ImageAttachmentLimits {
  maxImageBytes: number;
  maxImagesPerMessage: number;
  maxMessageImageBytes: number;
  maxImagePixels: number;
  /** Maximum intrinsic width and maximum intrinsic height in pixels for one image. */
  maxImageDimension: number;
  mediaTypes: readonly ImageMediaType[];
}
/** Base64-encoded image upload accompanying one wire request. */

/**
 * Browser-submitted prompt content accepted by Host prompt endpoints; the
 * accepting Host promotes image parts to durable references through
 * `ctx.attachments.admitPromptContent()` before any message is created, so a wire caller can
 * never cite an attachment it did not upload.
 */
type PromptContentPart = {
  readonly type: 'text';
  readonly text: string;
} | {
  readonly type: 'image';
  readonly mediaType: ImageMediaType;
  readonly data: string;
  readonly name?: string;
};
/** Host prompt content whose file receipts are resolved and whose image bytes await admission. */
type AttachmentAdmissionPart = PromptContentPart | {
  readonly type: 'file';
  readonly attachment: FileAttachmentRef;
};
/** Host-admitted prompt content with every attachment represented by its durable reference. */
type AdmittedPromptContentPart = {
  readonly type: 'text';
  readonly text: string;
} | {
  readonly type: 'image';
  readonly attachment: ImageAttachmentRef;
} | {
  readonly type: 'file';
  readonly attachment: FileAttachmentRef;
};
/** Request to validate and durably commit one image. */
interface SaveImageAttachment {
  data: Uint8Array;
  /** Caller-declared media type, checked against fully decoded bytes. */
  mediaType: ImageMediaType;
  /** Optional browser/provider display name; it is never interpreted as a path. */
  name?: string;
}
/** Stored image bytes returned after reference and digest verification. */
interface StoredImageAttachment {
  ref: ImageAttachmentRef;
  data: Uint8Array;
}
/** Deterministic request-image target selected by one exact model route for one attachment. */
interface ImageRequestTarget {
  /** Target width in pixels; a target above the source keeps the source width. */
  width: number;
  /** Target height in pixels; a target above the source keeps the source height. */
  height: number;
  /** Encoded-byte target before base64 expansion or Files API upload; the smallest quality-ladder output is kept when no quality fits. */
  maxBytes: number;
}
/** Cached request version derived from one provider-independent normalized attachment. */
interface RequestImageAttachment {
  /** Cache and upload-index key over the attachment id, policy, and fixed encoder parameters. */
  variantId: ImageVariantId;
  /** Durable normalized attachment from which this request version was derived. */
  attachment: ImageAttachmentRef;
  /** Encoded request bytes. */
  data: Uint8Array;
  mediaType: ImageMediaType;
  bytes: number;
  width: number;
  height: number;
  /** Provider-compatible sample depth proven after request encoding. */
  depth: 'uchar';
  /** Provider-compatible color space proven after request encoding. */
  space: 'srgb';
  /** Whether the encoded request version retains an alpha channel. */
  hasAlpha: boolean;
}
//# sourceMappingURL=types.d.ts.map

//#endregion
//#region ../../deepseek-harness/packages/attachment/attachment/lib/types/index.d.ts
sideEffect();
/** Immutable binary attachment service. Implementations validate bytes before publishing a reference. */
declare abstract class AttachmentStore extends Service {
  constructor(ctx: Context);
  /** Deployment-resolved image policy used by authoritative and fast-path validation. */
  abstract readonly imageLimits: ImageAttachmentLimits;
  /**
   * Validate one image without persisting it.
   * Batch callers validate every member before saving any member.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns completion after the encoded raster has been fully decoded.
   */
  abstract validateImage(input: SaveImageAttachment): Promise<void>;
  /**
   * Validate one ordered image batch before committing any member.
   * Validation failures start no writes; storage failures return no partial
   * references, although already published content-addressed objects may stay
   * unreachable until a future retention policy collects them.
   * @param inputs - encoded images in their owning message order.
   * @returns durable references in the exact input order.
   */
  protected validateImageBatch(inputs: readonly SaveImageAttachment[]): void;
  /**
   * Validate and durably commit one ordered image batch.
   * @param inputs - encoded images in owning-message order.
   * @returns durable normalized attachment references in the same order after every member succeeds.
   */
  saveImages(inputs: readonly SaveImageAttachment[]): Promise<readonly ImageAttachmentRef[]>;
  /**
   * Admit one Host prompt and replace each uploaded image with its durable reference.
   * Text and durable file references pass through unchanged. A prompt without image parts performs no storage operation.
   * @param content - prompt parts in message order after file receipt resolution.
   * @returns admitted prompt parts in the same order as `content`.
   * @throws AttachmentError when the image batch is refused.
   */
  admitPromptContent(content: readonly AttachmentAdmissionPart[]): Promise<AdmittedPromptContentPart[]>;
  /**
   * Decode and durably commit one canonical base64 file upload.
   * @param input - canonical base64 bytes and optional display name.
   * @returns the durable content-addressed file reference.
   * @throws AttachmentError when the encoding or storage operation is refused.
   */
  admitEncodedFile(input: EncodedFileAttachment): Promise<FileAttachmentRef>;
  /**
   * Identify a failure emitted by this attachment capability by its stable code.
   * @param error - value caught from an attachment operation.
   * @returns whether the value is an attachment failure.
   */
  isAttachmentError(error: unknown): error is AttachmentError;
  /**
   * Validate and durably commit one image before its owning session event is appended.
   * The returned reference describes the persisted normalized image. When
   * normalization reduces the raster, its `originalDimensions` records the
   * orientation-applied input dimensions.
   * @param input - encoded bytes, declared media type, and optional display name.
   * @returns the durable content-addressed normalized image reference.
   */
  abstract saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef>;
  /**
   * Read one image and verify that bytes still match the recorded reference.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend read and verification work.
   * @returns the verified bytes and normalized attachment reference.
   * @throws the signal reason when aborted, or a storage error when verification fails.
   */
  abstract readImage(ref: ImageAttachmentRef, signal?: AbortSignal): Promise<StoredImageAttachment>;
  /**
   * Locate the provider-owned normalized object in the harness host filesystem.
   * @param ref - durable normalized attachment reference.
   * @returns an absolute host path, or undefined when this backend is not host-file-backed.
   * @throws an AttachmentError when the durable reference is invalid.
   */
  imageHostPath(ref: ImageAttachmentRef): string | undefined;
  /**
   * Durably commit one file byte-for-byte before its owning session event is
   * appended. Files carry no admission limits: any byte content and length is
   * accepted, and the stored object is the exact submitted bytes. Backends
   * without verbatim file storage keep this default rejection.
   * @param input - exact bytes and optional display name.
   * @returns the durable content-addressed file reference.
   */
  saveFile(input: SaveFileAttachment): Promise<FileAttachmentRef>;
  /**
   * Durably commit one file byte-for-byte from bounded chunks. Providers must
   * apply backpressure and must not collect the complete file in memory.
   * Backends without streamed verbatim storage keep this default rejection.
   * @param input - ordered exact bytes, optional cancellation, and display name.
   * @returns the durable content-addressed file reference.
   */
  saveFileStream(input: SaveFileStreamAttachment): Promise<FileAttachmentRef>;
  /**
   * Read and verify one verbatim stored file as bounded chunks. Providers must
   * not collect the complete file in memory. Backends without verbatim file
   * reads keep this default rejection.
   * @param ref - durable reference from the session log.
   * @param signal - optional cancellation for backend reads and verification work.
   * @returns exact file bytes in order; integrity failures reject the iteration.
   */
  readFileStream(ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array>;
  /**
   * Locate the verbatim stored file object in the harness host filesystem.
   * @param ref - durable file reference.
   * @returns an absolute host path, or undefined when this backend is not host-file-backed.
   * @throws an AttachmentError when the durable reference is invalid.
   */
  fileHostPath(ref: FileAttachmentRef): string | undefined;
  /**
   * Generate or read one deterministic model-request version from the stored normalized image.
   * @param ref - durable provider-independent normalized attachment reference.
   * @param target - route-chosen dimensions and byte target; an unmet byte target yields the smallest ladder output.
   * @param signal - optional cancellation.
   * @returns request bytes and the cache/upload identity covering every transform input.
   */
  readImageRequest(ref: ImageAttachmentRef, target: ImageRequestTarget, signal?: AbortSignal): Promise<RequestImageAttachment>;
}
//#endregion
//#region ../../deepseek-harness/packages/llm/llm/lib/types/brand.d.ts
/**
 * Correlates a model-issued tool call with its result. Provider-issued for
 * real adapters; synthesized by mocks/assembler fallbacks.
 */
type ToolCallId = Branded<'ToolCallId'>;
/**
 * Brand a string as a {@link ToolCallId}.
 * @param id - the provider-issued or synthesized call id.
 * @returns the same string with the tool-call-id brand.
 */
declare function ToolCallId(id: string): ToolCallId;
/** Provider-issued request identifier retained for diagnostics across package boundaries. */

//#endregion
//#region ../../deepseek-harness/packages/llm/llm/lib/types/types.d.ts
sideEffect();
/** Plain text visible to the end user. */
interface TextBlock {
  type: 'text';
  text: string;
}
/** Reasoning / thinking content, distinct from visible text. */
interface ReasoningBlock {
  type: 'reasoning';
  text: string;
}
/**
 * A durable raster image reference, valid in user or assistant content. The
 * block is deliberately role-neutral; assistant-side rendering is forward
 * compatibility — the current production adapters declare text-only output,
 * so only user messages may carry images.
 */
interface ImageBlock {
  type: 'image';
  /** Immutable bytes and intrinsic display metadata owned by the attachment service. */
  attachment: ImageAttachmentRef;
  /**
   * Derived from a durable image-offload decision or preserved by a message
   * rewrite. Every route sends placeholder text naming the image and its
   * available read-only path instead of image bytes.
   */
  offloaded?: true;
}
/**
 * A durable verbatim file reference, valid in user content. Files never reach
 * a provider natively: request assembly projects every occurrence to
 * deterministic handle text (name, byte size, and the read-only saved path),
 * so adapters and providers see text in its place while the durable log keeps
 * the structured reference for presentation and authorization.
 */
interface FileBlock {
  type: 'file';
  /** Immutable verbatim bytes and display metadata owned by the attachment service. */
  attachment: FileAttachmentRef;
}
/** A tool invocation requested by the model. */
interface ToolCallBlock {
  type: 'tool-call';
  /** Provider-issued call id; correlates with the matching tool result. */
  id: ToolCallId;
  name: string;
  /** Raw JSON string as produced by the model. */
  arguments: string;
}
/** The result of a tool invocation, sent back to the model. */
interface ToolResultBlock {
  type: 'tool-result';
  toolCallId: ToolCallId;
  content: ContentBlock[];
  isError?: boolean;
}
/**
 * Merge-extensible content blocks keyed by `type`. New core blocks must land
 * with adapter, UI, and compaction support.
 */
interface ContentBlockMap {
  'text': TextBlock;
  'reasoning': ReasoningBlock;
  'image': ImageBlock;
  'file': FileBlock;
  'tool-call': ToolCallBlock;
  'tool-result': ToolResultBlock;
}
/** The block `type` tag vocabulary; widens as plugins add entries to {@link ContentBlockMap}. */
type ContentBlockType = keyof ContentBlockMap;
/** Any known content block, derived from {@link ContentBlockMap}; switch on `type` and fall through unknowns (merge-extensible). */
type ContentBlock = ContentBlockMap[ContentBlockType];
/**
 * Why a model response stopped.
 * Merge-extensible so adapters can surface provider-specific reasons.
 */

sideEffect();
/**
 * JSON-schema description of a tool, as sent to the model.
 *
 * Declared here (not in dsh-tools) because it is part of {@link GenerateOptions};
 * dsh-tools' ToolDefinition and dsh-system-prompt's PromptAssembly both import
 * it from this package.
 */
interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema object for the arguments. */
  parameters: Record<string, unknown>;
}
/** A single model request, fully assembled. */

//#endregion
//#region ../../deepseek-harness/packages/llm/llm/lib/types/index.d.ts
sideEffect();

//#endregion
//#region ../../deepseek-harness/packages/util/values/lib/types/index.d.ts
/** Duplicate-install-safe JSON and immutable-value helpers. @module @deepseek-ai/dsh-util-values */
/** A value that round-trips through JSON without loss. */
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
/**
 * Mark an unreachable closed-union branch.
 * @param value - impossible value; an unhandled typed variant fails at the call site.
 * @param context - optional switch-site label included in the failure message.
 * @returns never; a runtime value that escaped its type always throws.
 */

//#endregion
//#region ../../deepseek-harness/packages/core/tools/lib/types/presentation.d.ts
/**
 * Category of a tool call, used by a UI to pick an icon or treatment. The
 * provider-neutral vocabulary lets tools describe themselves without depending
 * on a particular client; `other` is the default.
 */
type ToolCallKind = 'read' | 'edit' | 'delete' | 'move' | 'search' | 'execute' | 'fetch' | 'other';
/**
 * A file location a tool reads or modifies, so a capable UI can "follow along" —
 * highlight or jump to the file (and line) as the tool runs. `path` is what the
 * tool operated on (the model-facing path); `line` is an optional 1-based line
 * to focus (e.g. a read's offset).
 */
interface FileLocation {
  path: string;
  line?: number;
}
/**
 * A single-file change a tool is about to make, for a UI that renders inline
 * diffs. `oldText` is `null` for a new-file create (nothing to diff against);
 * an overwrite also uses `null`, because a call-time presenter has no access to
 * the file's prior content.
 */
interface FileDiff {
  path: string;
  /** Prior content, or `null` for a new file / an overwrite (no prior content available at call time). */
  oldText: string | null;
  /** Content after the change. */
  newText: string;
}
/**
 * Provider-neutral pending-call presentation. Tools declare one tagged intent;
 * UI bridges map it without special-casing tool names.
 */
type ToolCallView = GenericCallView | TerminalCallView | DiffCallView;
/**
 * The default card: a titled tool-call row with an optional category icon, a
 * salient raw input, extra content blocks, and follow-along file locations. Any
 * tool whose call is not a terminal or a diff uses this.
 */
interface GenericCallView {
  card: 'generic';
  /**
   * Human-readable, always-visible label describing what THIS call does. Keep it
   * short — a UI shows it as a card header / log line.
   */
  title: string;
  /** Category for icon/treatment; defaults to `other` when omitted. */
  kind?: ToolCallKind;
  /**
   * The salient input to show in a detail/expanded view (e.g. a background
   * job id). Omit to show nothing; a string renders as-is, an object as pretty
   * JSON. NOT the full raw args object unless that is genuinely what a reader wants.
   */
  rawInput?: unknown;
  /**
   * UI-facing content blocks to show on the pending call alongside the title.
   * Omit to show none. A UI maps these to its own content blocks.
   */
  content?: ContentBlock[];
  /** Files this call reads/modifies, for editor follow-along. Omit for a call that touches no file. */
  locations?: FileLocation[];
}
/**
 * A call that IS a shell command running in a working directory: a capable UI
 * renders it as a terminal card (cwd-headed, with the command as the title and
 * live/afterward output from the {@link TerminalResultView}); an incapable UI
 * falls back to a generic card whose body is the fenced command output. Set by a
 * tool whose call is a foreground command (e.g. `bash`).
 */
interface TerminalCallView {
  card: 'terminal';
  /** The command, shown as the terminal card's title / header line. */
  title: string;
  /**
   * A human-readable one-line summary of what the command does, rendered ABOVE
   * the terminal card (the card itself has no description slot). Omit for none.
   */
  description?: string;
  /**
   * Working directory the command runs in, shown as the terminal header. An
   * ABSOLUTE path is used as-is; a RELATIVE path is resolved by the UI bridge
   * against the session workspace (the pure presenter can't see the session cwd).
   * Omit entirely to let the bridge use the session workspace.
   */
  cwd?: string;
}
/**
 * A call that creates or modifies files, rendered as an inline diff card by a
 * capable UI. Set by a tool whose call writes/edits a file (e.g. `write`,
 * `edit`). The diffs are derived from the call ARGUMENTS (a create's `oldText` is
 * `null`); the tool emits a separate {@link DiffResultView} after `execute` — the
 * applied change (an edit/overwrite hunk with context, or a whole-file diff for a
 * create).
 */
interface DiffCallView {
  card: 'diff';
  /** Card header (e.g. `Write foo.txt`). */
  title: string;
  /** One entry per file the call changes. */
  diffs: FileDiff[];
  /** Files this call modifies, for editor follow-along (usually the diffs' paths). */
  locations?: FileLocation[];
}
/**
 * One numbered line of a file, the unit a {@link ReadResultView} carries so a
 * capable UI can render a syntax-highlighted, line-numbered code view. `number`
 * is the 1-based line number in the file (a window past `offset` keeps the file's
 * own numbering, not a 1-based re-count); `text` is the line without its trailing
 * newline, already truncated to the read tool's per-line cap.
 */
interface ReadFileLine {
  number: number;
  text: string;
}
/**
 * How a tool wants the COMPLETED call shown — the *result* state, after `execute`
 * returns. A `card`-tagged union mirroring {@link ToolCallView}: a UI switches on
 * `card`. Lets the tool reformat its result for a UI distinctly from the
 * model-facing text it returned from `execute`. Returned by
 * `ToolDefinition.presentResult`; omitting the method keeps the pending
 * title and renders the raw result content.
 */
type ToolResultView = GenericResultView | TerminalResultView | DiffResultView | SearchResultView | ReadResultView | WebResultView;
/**
 * The default completed card: an optional replacement title and reformatted
 * content. Omit a field to keep the pending title / render the raw result content.
 */
interface GenericResultView {
  card: 'generic';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /**
   * UI-facing result content (harness {@link ContentBlock}s), reformatted from
   * the model-facing result. Omit to let the UI render the raw result content.
   */
  content?: ContentBlock[];
}
/**
 * The completed state of a {@link TerminalCallView}: the captured output and exit
 * status. A capable UI renders `output` in the terminal card and shows an
 * exit-status pill; an incapable UI gets a fenced ```console fallback the BRIDGE
 * derives from `output` (the tool does not double-encode it).
 */
interface TerminalResultView {
  card: 'terminal';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** Captured command output (stdout+stderr as the tool chooses to combine them). */
  output?: string;
  /**
   * Process exit code, when the run ended by exiting (not a signal). Lets a
   * capable UI show an exit-status pill. Omit when killed by a signal or unknown.
   */
  exitCode?: number;
  /** Signal name that killed the process (e.g. `SIGTERM`). Mutually exclusive with `exitCode`. */
  signal?: string;
}
/**
 * A completed file mutation rendered as an inline diff card, the result-time
 * analogue of {@link DiffCallView}. Because a completed UI update replaces the
 * pending card content, mutation tools return this even when it repeats the
 * call-time diff; otherwise raw result text would replace the diff.
 */
interface DiffResultView {
  card: 'diff';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The change to show, in file order — applied contextual hunks, or a whole-file diff when there is no before-image. */
  diffs: FileDiff[];
}
/** One matched line inside a {@link SearchFileMatches} group: its 1-based line number and text. */
interface SearchLineMatch {
  /** 1-based line number of the match within its file. */
  lineNumber: number;
  /** The matched line text, as the tool surfaced it (the per-line preview budget already applied). */
  line: string;
}
/** One file's grouped content matches for a {@link SearchMatchesResultView}, in first-seen file order. */
interface SearchFileMatches {
  /** The file the matches belong to (the model-facing display path). */
  path: string;
  /** The file's matched lines, in output order. */
  matches: SearchLineMatch[];
}
/**
 * A completed content search (`grep`) rendered as a search card whose matches are
 * grouped by file, so a capable UI can list each file as an expandable group of
 * its matched lines. `shape: 'matches'` discriminates this variant from the path
 * variant ({@link SearchPathsResultView}) within {@link SearchResultView}. The
 * discriminant is `shape`, not `kind`, so it never collides with the
 * {@link ToolCallKind} `kind` an icon-picking bridge reads off a call view.
 */
interface SearchMatchesResultView {
  card: 'search';
  shape: 'matches';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** Matched lines grouped by file, in first-seen file order. */
  files: SearchFileMatches[];
  /**
   * Whether the tool capped the inline result: `files` carries only the retained
   * matches, not every match the search found. A UI shows a capped indicator so it
   * never presents a partial group as complete.
   */
  truncated: boolean;
  /** Total matches the search found before capping (equals the retained count when not `truncated`). */
  total: number;
}
/**
 * A completed path search (`glob`) rendered as a search card whose result is a flat
 * path list. `shape: 'paths'` discriminates this variant from the grouped-matches
 * variant ({@link SearchMatchesResultView}) within {@link SearchResultView}.
 */
interface SearchPathsResultView {
  card: 'search';
  shape: 'paths';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The discovered paths, in the tool's result order (the retained page when `truncated`). */
  paths: string[];
  /**
   * Whether the tool capped the inline result: `paths` carries only the retained
   * page, not every path the search found. A UI shows a capped indicator so it
   * never presents a partial list as complete.
   */
  truncated: boolean;
  /** Total paths the search found before capping (equals `paths.length` when not `truncated`). */
  total: number;
}
/**
 * A completed search rendered as a search card, the result-time view a discovery
 * tool (`grep`, `glob`) returns from `presentResult`. One `card: 'search'` view
 * with two `shape`-discriminated variants: grouped-by-file content matches
 * ({@link SearchMatchesResultView}) and a flat path list
 * ({@link SearchPathsResultView}). Both carry a `truncated`/`total` signal so a UI
 * never presents a capped result as complete. The view carries no result text: a
 * UI without a search card falls back to the raw `tool/result` content. There is
 * no call-time analogue: a search call stays a {@link GenericCallView}
 * (`kind: 'search'`) because the pending state has no matches or paths to show —
 * the structured shape exists only after `execute`.
 */
type SearchResultView = SearchMatchesResultView | SearchPathsResultView;
/**
 * A completed file read rendered as a line-numbered, optionally syntax-highlighted
 * code view by a capable UI. Set by a tool whose call reads file text (e.g.
 * `read`); the pending state stays a {@link GenericCallView} (`kind: 'read'`)
 * because a call carries no content until `execute` returns. The structured
 * `lines`/`path`/`lang`/`totalLines` fields cannot be reconstructed from the
 * model-facing result text alone, so the read tool projects them through its
 * `output.presentationMeta` (persisted with the session log) and `presentResult`
 * narrows that metadata back into this view on live and replay paths alike. A UI
 * without the read capability falls back to `content` (the model-facing text with
 * its envelope stripped), so this view degrades to the generic text card.
 */
interface ReadResultView {
  card: 'read';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The read file's path (the model-facing path; the bridge relativizes it). */
  path: string;
  /**
   * The 1-based first line the window requested, preserved even when `lines` is
   * empty (a byte cap below the first selected line yields an empty window) so a
   * UI knows where the window starts and where a continuation resumes.
   */
  offset: number;
  /** The returned window's lines, in file order, each keeping its file line number. */
  lines: ReadFileLine[];
  /** Exact total line count in the file, so a UI can show a "showing N of M" affordance. */
  totalLines: number;
  /**
   * A syntax-highlighting language hint derived from the file extension (e.g.
   * `ts`, `py`), or omitted when the extension maps to no known language so a UI
   * renders the lines as plain text.
   */
  lang?: string;
  /**
   * The model-facing result content with its envelope stripped, for a UI without
   * the read capability. Omit to let such a UI render the raw result content.
   */
  content?: ContentBlock[];
}
/**
 * One citeable source in a completed {@link WebSearchResultView}, the faithful
 * projection of one web-search source. The presentation projection of `dsh-web`'s
 * `WebSearchSource`: that Service Definition type is authoritative (core cannot depend
 * on the web Service Definition, so the two are declared separately and MUST evolve together).
 * A web tool projects this shape through `output.presentationMeta` because the
 * render text cannot losslessly carry it (see the web-result-card Agent Note); its
 * `presentResult` reads it back.
 */
interface WebSource {
  /** The source URL. */
  url: string;
  /** The source title, when the provider returned one. */
  title?: string;
  /** A short excerpt or summary, when the provider returned one. */
  snippet?: string;
  /** Publication/crawl timestamp as a provider-supplied ISO-8601 string, when present. */
  publishedAt?: string;
}
/**
 * A completed web retrieval rendered as a structured card by a capable UI. Set
 * by a web tool whose call retrieves from the web (`web_search`, `web_fetch`).
 * One `kind`-tagged union carries both shapes because both are web retrieval and
 * a UI renders them with one component family; a UI switches on `kind`. An
 * incapable UI falls back to the raw `tool/result` content (this view carries no
 * `content` copy — see the web-result-card Agent Note). This is the result-time
 * analogue of the `web_search`/`web_fetch` calls' generic call views
 * (`kind: 'search'`/`'fetch'`); those tools keep their generic pending card and
 * add only this completed card.
 *
 * The `kind` field here is this union's own discriminant, NOT a
 * {@link ToolCallKind}: the two values deliberately match the tools' pending
 * `ToolCallKind` (`'search'`/`'fetch'`) so a call and its result read as one
 * category, but a new arm is a union edit plus a consumer branch, not any
 * arbitrary `ToolCallKind` value.
 */
type WebResultView = WebSearchResultView | WebFetchResultView;
/**
 * The completed state of a `web_search` call: the structured sources the model
 * cited, an optional provider answer, and whether the source list was cut to the
 * result cap. A capable UI renders the sources as a citation list; a UI without
 * the `web` capability falls back to the raw `tool/result` content.
 */
interface WebSearchResultView {
  card: 'web';
  kind: 'search';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The faithful, structured sources — the field render text cannot losslessly carry. */
  sources: WebSource[];
  /** The provider-generated answer text, when any. */
  answer?: string;
  /** True when the web service cut the source list to honor the result cap. */
  truncated: boolean;
}
/**
 * The completed state of a `web_fetch` call: the fetched URL, its HTTP status,
 * and whether the content was cut. The body itself is already markdown in the
 * raw `tool/result` content, so this card carries only the retrieval summary and
 * a UI without the `web` capability falls back to that content.
 */
interface WebFetchResultView {
  card: 'web';
  kind: 'fetch';
  /** Replacement title for the completed call. Omit to keep the pending-state title. */
  title?: string;
  /** The final URL after allowed redirects. */
  url: string;
  /** HTTP status code of the fetched response. */
  statusCode: number;
  /**
   * True when the provider capped the decoded body, or the output cap or a
   * pre-conversion source cut trimmed the rendered text (the effective
   * truncation the model-facing text also reflects).
   */
  truncated: boolean;
}
//# sourceMappingURL=presentation.d.ts.map
//#endregion
//#region ../../deepseek-harness/packages/core/tools/lib/types/json-schema.d.ts
/** Scalar JSON values supported by `enum` and `const`. */
type JsonSchemaScalar = string | number | boolean | null;
/** Single-type keywords accepted by the enforced subset. */
type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
/**
 * One raw JSON Schema node in the enforced subset. The optional fields express
 * the external wire schema; {@link assertSupportedJsonSchema} rejects invalid
 * combinations before a caller treats the node as trusted.
 */
interface JsonSchemaNode {
  /** Omit with no constraints for any JSON value, or use `oneOf`. */
  type?: JsonSchemaType;
  /** Exactly one branch must validate; at least two branches are required. */
  oneOf?: JsonSchemaNode[];
  /** Nested property schemas (`type: 'object'` only). */
  properties?: Record<string, JsonSchemaNode>;
  /** Required property names; each must appear in `properties`. */
  required?: string[];
  /** `false` rejects undeclared keys; absent/`true` follows JSON Schema's open default. */
  additionalProperties?: boolean;
  /** Item schema (`type: 'array'` only); absent accepts any JSON item. */
  items?: JsonSchemaNode;
  /** Allowed values for a scalar node. */
  enum?: JsonSchemaScalar[];
  /** The single allowed value for a scalar node. */
  const?: JsonSchemaScalar;
  /** Annotation, ignored for validation. */
  description?: string;
  /** Annotation, ignored for validation. */
  title?: string;
  /** Annotation, ignored for validation but required to be lossless JSON. */
  default?: JsonValue;
  /** Annotation, ignored for validation but required to be lossless JSON. */
  examples?: JsonValue;
}
/** A consumer-constrained object-rooted schema. */

//#endregion
//#region ../../deepseek-harness/packages/core/tools/lib/types/types.d.ts
sideEffect();

//#endregion
//#region ../../deepseek-harness/packages/sandbox/sandbox/lib/types/index.d.ts
sideEffect();

//#endregion
//#region ../../deepseek-harness/packages/ptc-runtime/ptc-runtime/lib/types/index.d.ts
sideEffect();

//#endregion
//#region ../../deepseek-harness/packages/core/tools/lib/types/index.d.ts
sideEffect();
/** Tool-owned canonical output contract used after the body returns a JSON value. */
interface ToolOutputDefinition {
  /** Raw supported JSON Schema enforced against every successful canonical value. */
  readonly schema: JsonSchemaNode;
  /** Pure projection from validated arguments and value to Native/model content. */
  render(args: unknown, value: JsonValue): ContentBlock[];
  /** Pure replayable presentation projection, computed only for top-level calls. */
  presentationMeta?(args: unknown, value: JsonValue): JsonValue;
}
/** A registered tool: its schema plus the execution function. */
interface ToolDefinition extends ToolSchema {
  /** Mandatory canonical output declaration. */
  readonly output: ToolOutputDefinition;
  /**
   * Run one accepted call and return only its canonical lossless-JSON value.
   * Async work must observe or forward `exec.signal` and settle only after its
   * owned work reaches quiescence. The registry preserves caller cancellation
   * through around-dispatch signal replacement and does not abandon this
   * promise, but it cannot hard-kill same-process code.
   * @param args - losslessly snapshotted, frozen model arguments.
   * @param exec - execution identity, cancellation signal, and context deferral.
   * @returns the canonical value declared by `output.schema`.
   */
  execute(args: unknown, exec: ToolRunContext): Promise<unknown>;
  /**
   * Synchronous last-mile transform for model-facing content. The registry
   * snapshots this callback when execution starts and invokes it exactly once
   * for every normalized outcome, including pipeline failures that bypass
   * `tools/post-execute`, immediately before lossless materialization.
   * Returning `undefined` preserves the content; every other result field
   * remains registry-owned. The callback must be total and must not throw.
   * @param exec - immutable execution identity and arguments.
   * @param result - complete normalized outcome before materialization.
   * @returns replacement content, or `undefined` to preserve it.
   */
  finalizeContent?(exec: Readonly<ToolExecution>, result: Readonly<ToolExecutionResult>): ContentBlock[] | undefined;
  /**
   * Cooperative tool-call timeout budget in milliseconds. Omit for no deadline.
   * Enforced by `@deepseek-ai/dsh-tool-call-timeout-policy` (a `tools/execute` wrapper); it
   * is NEVER sent to the model — `schemas()` whitelists only name/description/
   * parameters. Declaring it asserts this tool forwards `exec.signal` to a
   * cooperative implementation that can reach quiescence when the signal aborts.
   */
  timeoutMs?: number;
  /**
   * Pure synchronous classifier for overlap with sibling tool calls. Only
   * `true` opts in; omission, exceptions, non-`true` returns, and invalid
   * `defineTool` arguments are exclusive. This metadata is never model-visible.
   *
   * Opted-in executions must not mutate parent-owned state. Shared state must
   * tolerate concurrent dispatch; recorder races are permitted only when they
   * commute or fail closed. See the
   * [parallel-tool-call Agent Note](../../../../.agents/notes/implemented/feature/2026-07-10-parallel-tool-call-execution.md)
   * for the full contract.
   * @param args - parsed arguments; `defineTool` validates before calling.
   * @returns Whether this call may join a parallel group.
   */
  isConcurrencySafe?(args: unknown): boolean;
  /**
   * Optional: how to present the PENDING state of one call in a UI, derived from
   * the call's `args` (parsed arguments, `unknown` — the tool validates/narrows
   * its own input). Returns a {@link ToolCallView} (a `card`-tagged render intent),
   * or `undefined` (or omit the method) to fall back to a generic presentation
   * (title = tool name, raw args as input). Pure and side-effect-free: a UI may
   * call it during live streaming AND a session-log replay, so it must depend
   * only on `args`.
   */
  presentCall?(args: unknown): ToolCallView | undefined;
  /**
   * Optional: how to present the COMPLETED state, given the same `args` and the
   * durable result projection (`content`, failure state, and optional `meta`). Returns a
   * {@link ToolResultView}, or `undefined` (or omit the method) to keep the
   * pending title and render the raw result content. Pure and side-effect-free
   * for the same replay reason.
   */
  presentResult?(args: unknown, result: ToolResult): ToolResultView | undefined;
}
/** The completed outcome handed to {@link ToolDefinition.presentResult}. */
interface ToolResult {
  /** The final model-facing content (or the rendered error text on failure). */
  content: ContentBlock[];
  /** Whether the call failed. */
  isError: boolean;
  /**
   * The tool-private presentation payload projected by its output declaration.
   * It is persisted verbatim on `tool/result` for Host presenters and Client
   * renderers to narrow independently. Absent when the tool declared no
   * projector or the call was nested under a composite transport.
   */
  meta?: JsonValue;
}
declare const toolExecutionTokenBrand: unique symbol;
/** Opaque call identity that permits correlation without exposing mutable execution state. */
type ToolExecutionToken = symbol & {
  readonly [toolExecutionTokenBrand]: true;
};
/**
 * Caller-supplied description of one tool call. {@link ToolRuntime.execute}
 * adds the registry-owned token to form a pipeline {@link ToolExecution};
 * callers do not choose that token.
 */
interface ToolExecutionInput {
  readonly callId: ToolCallId;
  /**
   * Root model-requested call owning this execution tree. Callers omit it for
   * a root execution; nested dispatchers propagate the enclosing value.
   */
  readonly rootCallId?: ToolCallId;
  readonly name: string;
  /** Binding-time tool schema for a PTC inner call; frozen by its producer and never logged. */
  readonly schema?: ToolSchema;
  /** Losslessly JSON-serializable parsed arguments (tools validate their own schema). */
  readonly arguments: unknown;
  /** The agent on whose behalf the call runs (set by the agent loop). */
  readonly agent?: Agent;
  /**
   * Opaque token of the enclosing transport execution, when one exists. PTC
   * mode sets this on SDK sub-dispatches so commit-style observers can wait for
   * the outer `run_code` outcome without receiving its live mutable execution.
   * The token also marks the call as a transport sub-dispatch rather than a
   * model-direct call: under `mode: 'ptc'`, only calls WITH a parent may
   * execute a native tool name — a model-direct call (no parent) is denied as
   * `UNKNOWN_TOOL` before the policy pipeline. See {@link ToolRuntime.execute}.
   */
  readonly parent?: ToolExecutionToken;
  /** Required caller-owned cancellation for this invocation. */
  readonly signal: AbortSignal;
}
/**
 * Scheduling mode for one pending call. `parallel` may overlap with siblings;
 * `exclusive` runs alone and forms an ordering barrier.
 */

/**
 * One pending tool call inside the registry pipeline. Parsed arguments cross
 * one lossless-JSON materialization boundary before policy and are deep-frozen;
 * call identity, the caller signal, and the registry-assigned {@link token} are
 * readonly. The registry freezes the complete object before `tools/result`
 * observers run.
 */
interface ToolExecution extends ToolExecutionInput {
  /** Root model-requested call, resolved for every root and nested execution. */
  readonly rootCallId: ToolCallId;
  /** Registry-assigned identity shared with nested calls only as their opaque `parent` token. */
  readonly token: ToolExecutionToken;
}
/**
 * Around-dispatch view of a {@link ToolExecution}. A `tools/execute` wrapper
 * may replace the signal for its delegated lifetime, but it cannot remove it.
 * The registry fuses every replacement with the captured caller signal.
 */

/**
 * Runtime context handed to a tool implementation after the registry has
 * accepted a {@link ToolExecution}. {@link deferContext} attaches context to
 * this execution's own result — a composite tool ferries nested-dispatch
 * context back to the outer result, and a leaf tool may mint a fresh
 * plugin-sourced instruction; the loop appends it only after the
 * `tool/result`.
 */
interface ToolRunContext extends ToolExecution {
  /**
   * Defer one context — typically a nested-dispatch context ferried by a
   * composite tool, or a fresh plugin-sourced instruction — until this tool's
   * final result reaches the agent loop. Contexts retain their individual
   * source and metadata and are emitted in call order.
   */
  deferContext(context: UserMessage): void;
  /**
   * Mark a successful final result as terminal for the current agent turn.
   * The marker rides this execution's own result (`concludesTurn` exists only
   * on {@link ToolExecutionSuccess}); a composite that dispatches nested
   * calls forwards it from the nested result, exactly like
   * `additionalContexts`, so only an authoritative nested success can
   * conclude the enclosing run.
   */
  concludeTurn(): void;
}
/**
 * Scheduler-only result after ordered pre-execute and guards. A `post-result`
 * still receives post-execute; a `final-result` bypasses it.
 * @internal
 */

/** Structured error metadata for a failed tool call (alongside the model-facing text). */
interface ToolErrorInfo {
  name: string;
  code: string;
  /** Optional raw user-facing detail; durable projections preserve it but model-facing content does not include it. */
  reason?: string;
}
/** Canonical failure detail; internal routing information remains optional. */
interface ToolFailure {
  /** Human-readable failure message without the Native `Error: ` envelope. */
  message: string;
  /** Internal error class/code used by policy and durable diagnostics. */
  info?: ToolErrorInfo;
}
/**
 * Thrown (internally) when the model requests a tool that isn't registered.
 * Extends {@link HarnessError} (`code: 'UNKNOWN_TOOL'`) so an unknown-tool
 * failure is as routable as a tool-thrown one — retry/sandbox/replay code can
 * distinguish it from a tool body's own error.
 */

/** Successful canonical tool execution, including its Native/model projection. */
interface ToolExecutionSuccess {
  readonly isError: false;
  /** Execution-local canonical value; deliberately omitted from durable events. */
  readonly value: JsonValue;
  readonly content: ContentBlock[];
  readonly error?: never;
  readonly meta?: JsonValue;
  readonly additionalContexts?: UserMessage[];
  /** The agent loop stops after committing this successful result batch. */
  readonly concludesTurn?: true;
}
/** Failed canonical tool execution; failures never carry a successful value. */
interface ToolExecutionFailure {
  readonly isError: true;
  readonly error: ToolFailure;
  readonly value?: never;
  readonly content: ContentBlock[];
  readonly meta?: JsonValue;
  readonly additionalContexts?: UserMessage[];
  readonly concludesTurn?: never;
}
/** The discriminated, execution-local outcome of one tool call. */
type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;
/**
 * Pre-dispatch decision. `allow` runs the call; `deny` materializes its
 * model-facing reason and optional structured error identity; `cancel` selects
 * the canonical cancellation result without presenting a policy denial; `ask`
 * runs only after an approval service returns `allowed-once` and otherwise
 * denies. Input rewriting is excluded because arguments are already logged and
 * presented.
 */
//#endregion
//#region src/media-route.d.ts
/** webServer 服务的本地结构视图（上游 WebServer 的最小消费子集）。 */
interface MediaWebServer {
  /** 监听地址：'127.0.0.1' 或 '0.0.0.0'。 */
  host: string;
  /** 注册命名路由，返回注销函数；重复 (kind, path) 抛错。 */
  register(route: {
    kind: 'exact' | 'prefix';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  }): () => void;
}
/** outputs 媒体路由前缀（prefix 匹配 /outputs 与 /outputs/<文件名>）。 */
//#endregion
//#region src/runtime-defaults.d.ts
/**
 * 运行时覆盖值集合。字段语义与 generate_image / generate_video 工具的
 * 服务商/参数选择一一对应：`undefined` = 未覆盖，工具回落 settings（config）持久值。
 * `imageSize` 为映射后的尺寸串（如 '1024*1024'），`videoAspectRatio` 为比例串
 * （如 '16:9'），`imageStyle` 为风格 id（见 {@link IMAGE_STYLE_OPTIONS}）。
 */
interface RuntimeDefaults {
  /** 图片服务商覆盖（'threerouter' | 'wanx' | 'seedance'，minimax 无图片能力）；undefined 跟随 settings。 */
  imageProvider?: Provider;
  /** 图片尺寸覆盖（'宽*高'）；undefined 跟随 settings。 */
  imageSize?: string;
  /** 图片风格 id 覆盖；undefined 跟随 settings（不拼接风格后缀）。 */
  imageStyle?: string;
  /** 视频服务商覆盖；undefined 跟随 settings。 */
  videoProvider?: Provider;
  /** 视频宽高比覆盖（如 '16:9'）；undefined 跟随 settings。 */
  videoAspectRatio?: string;
  /** 视频时长覆盖（秒，1-10）；undefined 跟随 settings。 */
  videoDuration?: number;
}
/** POST /image-video/defaults 接受的单字段写入：null 清除覆盖，否则为合法值。 */
type RuntimeDefaultsPatch = { [K in keyof RuntimeDefaults]: RuntimeDefaults[K] | null };
/** 内存态运行时默认值存储。 */
interface RuntimeDefaultsStore {
  /** 当前覆盖值快照（只读视图；未覆盖字段不出现在对象上）。 */
  get(): Readonly<RuntimeDefaults>;
  /** 合并写入：null 删除该字段覆盖，其余覆盖写入；返回新快照。 */
  patch(patch: RuntimeDefaultsPatch): Readonly<RuntimeDefaults>;
  /** 清空全部覆盖（插件卸载语义；路由层暂不暴露）。 */
  reset(): void;
}
/** 创建内存态运行时默认值存储。 */
declare function createRuntimeDefaultsStore(): RuntimeDefaultsStore;
/** 图片风格选项：id 即协议值，label 供下拉 UI 展示；'' = 自动（不拼接后缀）。 */
declare const IMAGE_STYLE_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
}>;
/**
 * 把风格 id 拼接为英文提示词后缀（生成服务端通用做法：对所有 provider 生效）。
 * @param prompt - 原始提示词。
 * @param style - 风格 id；undefined / '' / 白名单外一律原样返回。
 * @returns 实际发给服务商的提示词。
 */
declare function applyImageStyle(prompt: string, style: string | undefined): string;
/** 图片尺寸白名单（'宽*高'）；'' 由协议层表示「自动（清除覆盖）」，不在表内。 */
declare const IMAGE_SIZE_OPTIONS: ReadonlyArray<{
  id: string;
  label: string;
  size: string;
}>;
/**
 * 模型家族规则：按厂商关键词对显式 model 参数做小写包含匹配，得到该模型的家族
 * 候选服务商。维护点按「厂商」而非「模型 id」——新模型（wan3.0、qwen-video、
 * minimax 新版本等）自动命中家族规则，无需逐个登记。
 *
 * 家族事实（2026-09）：threerouter 是聚合器，出所有家族的模型（wan/minimax/seedance
 * 及文本/图片模型）；wanx（阿里百炼）、minimax（官方平台，仅视频）、seedance（火山方舟）
 * 是家族直连商。规则数组顺序即匹配优先级（更具体的家族在前）。
 */

/** defaults 路由路径（exact 匹配；桌面渲染进程同源调用）。 */
declare const DEFAULTS_ROUTE_PATH = "/image-video/defaults";
/** GET / POST 响应体：六字段齐全，null = 无运行时覆盖且无 settings 持久默认（工具用内置默认）。 */
type RuntimeDefaultsView = RuntimeDefaultsPatch;
/**
 * settings 持久默认值视图：{@link extractPersistedDefaults} 从 config 提取出的
 * 合法默认值子集，未提取的字段不出现在对象上（undefined → 合并时跳过）。
 */
type PersistedDefaultsView = Partial<RuntimeDefaults>;
/**
 * 从插件持久 config 提取 settings 默认值，作为 defaults 路由合并视图的回落层。
 * 白名单/范围守卫：服务商须命中 PROVIDERS 白名单（空串 = 跟随激活服务商，不
 * 提取）、imageSize 须命中 IMAGE_SIZE_OPTIONS 白名单、videoDuration 须 1-10 整数；
 * settings 手填的遗留越界值一律忽略（composer 显示「自动」，工具用内置默认），
 * 避免把非法持久值经合并视图当作生效值回显。
 * @param config - 已由 Schemastery 填充默认值的插件配置。
 */
declare function extractPersistedDefaults(config: Config): PersistedDefaultsView;
/**
 * 校验并归一化 POST body 为存储 patch。严格协议：仅接受六个已知键；
 * null 清除覆盖；'' 表示「自动」（归一化为 null）；其余值按字段白名单/范围校验。
 * @param body - 已 JSON.parse 的请求体（可能是任意值）。
 * @returns 归一化后的 patch；校验失败返回错误信息（字符串）。
 */
declare function parseDefaultsPatch(body: unknown): {
  ok: true;
  patch: RuntimeDefaultsPatch;
} | {
  ok: false;
  error: string;
};
/**
 * 创建 defaults 路由 handler。GET 返回「运行时覆盖 ?? settings 持久默认」合并
 * 视图；POST 校验写入并返回合并视图；非 GET/POST 405；请求体不可解析或校验
 * 失败 400。
 * @param store - 运行时默认值存储。
 * @param persisted - settings 持久默认回落层（{@link extractPersistedDefaults}
 *   提取；未提供时用空对象，即不回落）。
 */
declare function createDefaultsRouteHandler(store: RuntimeDefaultsStore, persisted?: PersistedDefaultsView): (req: node_http0.IncomingMessage, res: node_http0.ServerResponse) => Promise<void>;
/**
 * 把 defaults 路由注册进 webServer。仅回环地址注册：host 非 127.0.0.1 时返回
 * undefined 且不注册——运行时覆盖值属本机会话状态，不暴露到局域网。
 * @param webServer - webServer 服务实例（结构类型，见 media-route.ts）。
 * @param store - 运行时默认值存储。
 * @param persisted - settings 持久默认回落层（同 {@link createDefaultsRouteHandler}）。
 * @returns 路由注销函数；未注册返回 undefined。
 */
declare function registerDefaultsRoute(webServer: MediaWebServer, store: RuntimeDefaultsStore, persisted?: PersistedDefaultsView): (() => void) | undefined;
//#endregion
//#region src/tools/generate-image.d.ts
/**
 * 工具依赖：配置、任务管理器、attachment 服务实例。
 * `attachments` 由 `apply()` 通过 `ctx.inject(['attachments'], cb)` 在注册时注入，
 * 不在执行体内部运行时 `ctx.get` 读取——依赖关系在构造时即明确。
 */
interface GenerateImageDeps {
  config: Config;
  taskManager: TaskManager;
  attachments: AttachmentStore;
  ctx: Context;
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore;
  /** 已解析为绝对路径的 outputsDir（插件唯一解析点，见 index.apply）。 */
  outputsDir: string;
}
/**
 * 创建 generate_image 工具定义。
 * 工具参数：prompt（必填，找回模式除外）、image（单图）、images（多参考图）、size、model、recoverRequestId。
 */
declare function createGenerateImageTool(deps: GenerateImageDeps): ToolDefinition;
//#endregion
//#region src/tools/generate-video.d.ts
/** 工具依赖。 */
interface GenerateVideoDeps {
  config: Config;
  taskManager: TaskManager;
  /** 运行时默认值存储：composer 热更新覆盖值优先于 settings 持久值。 */
  runtimeDefaults: RuntimeDefaultsStore;
  /**
   * 已解析为绝对路径的 outputsDir（插件唯一解析点，见 index.apply）。
   * 与图片链路共用同一个目录，杜绝旁路产物；缺省时回退 config.outputsDir。
   */
  outputsDir?: string;
}
/**
 * 创建 generate_video 工具定义。
 * 工具参数：prompt（必填）、duration（可选，1-10秒）、model（可选）、aspectRatio（可选）、
 * image（可选首帧图片，传了即图生视频）、resolution（可选分辨率档位）。
 */
declare function createGenerateVideoTool(deps: GenerateVideoDeps): ToolDefinition;
//#endregion
//#region src/index.d.ts
/** Cordis 插件名，用于 loader 诊断。 */
declare const name = "image-video";
/**
 * 必需服务依赖：`tools`（工具注册表）。
 * `attachments` 不在此声明——它由 `generate_image` 通过 `ctx.inject` 按需声明，
 * 缺失时仅 generate_image 不注册，generate_video 与插件本身不受影响。
 */
declare const inject: string[];
/**
 * 插件入口：创建任务管理器（注册卸载清理），注册 generate_image / generate_video 工具。
 *
 * `generate_image` 通过 `ctx.inject(['attachments'], cb)` 显式声明对 attachment 服务的依赖：
 * callback 接收已注入 attachments 的子上下文，从中读取服务实例构造时注入工具，
 * 不在执行体内部运行时 `ctx.get` 读取。attachments 服务撤销时，该 fiber dispose，
 * `ctx.tools.register` 的 disposer 自动注销工具。
 *
 * `generate_video` 不依赖 attachments，始终注册。工具注册的 disposer 由 `ctx.tools.register`
 * 内部经 effect 注册，fiber dispose 时自动清理。
 *
 * @param ctx - 插件上下文。
 * @param config - 已由 Schemastery 填充默认值的插件配置。
 */
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { type AsyncImageSubmit, AsyncTransportUnavailableError, Config, type Config as ConfigType, DEFAULTS_ROUTE_PATH, DEFAULT_RECOVERY_BUDGET, type ErrorKind, GenerationError, IMAGE_SIZE_OPTIONS, IMAGE_STYLE_OPTIONS, type ImageAsyncCapability, type ImageGenParams, type ImagePreflight, type ImageTransaction, type ImageTransport, type PersistedDefaultsView, type Provider, type ProviderAdapter, type ProviderCredentials, type RecoveryBudget, type RequestOptions, type RequestResult, type RuntimeDefaults, type RuntimeDefaultsPatch, type RuntimeDefaultsStore, type RuntimeDefaultsView, type SubmitResult, TRANSPORT_PROBE_TTL_MS, TaskManager, type TaskQueryFn, type TaskQueryResult, type TransactionReport, type TransactionStatus, type TransportProbeCache, type UnknownStatePolicy, type VideoGenParams, type WatermarkConfig, type WatermarkPosition, type WatermarkResult, apply, applyImageStyle, applyImageWatermark, buildWatermarkSvg, canFallbackToNextProvider, consumeSubmitBudget, createDefaultsRouteHandler, createGenerateImageTool, createGenerateVideoTool, createImageTransaction, createRuntimeDefaultsStore, extractPersistedDefaults, fitFontSize, formatPreflightNote, inject, isAsyncImageUnavailableError, isModelNotAcceptedError, isUnknownSubmitStateError, looksLikeVideoModel, name, parseDefaultsPatch, registerDefaultsRoute, reportTransaction, resolveImagePreflight, resolveImageTransport, runImageTransaction, seedanceAdapter, submitBudget, threerouterAdapter, unknownStateError, wanxAdapter };
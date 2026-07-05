/**
 * Ambient utility types shared across the monorepo.
 * Exported via @startername/shared and consumed globally by dependents.
 */
// Define once, export for modules, and re-use for globals to avoid duplication.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type _UnknownRecord = Partial<Record<any, any>>;
type _Nil = null | undefined;
type _NonNil<T> = Exclude<T, _Nil>;
type _Nullable<T> = T | null;
type _Optional<T> = T | undefined;
type _ValueOf<T> = T[keyof T];
type _Awaitable<T> = T | PromiseLike<T>;
type _EmptyObject = Record<never, never>;
type _Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
type _Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
// eslint-disable-next-line no-underscore-dangle
declare const __brand: unique symbol;
type _Branded<T, Brand extends string> = T & { [__brand]: Brand };

export type UnknownRecord = _UnknownRecord;
export type Nil = _Nil;
export type NonNil<T> = _NonNil<T>;
export type Nullable<T> = _Nullable<T>;
export type Optional<T> = _Optional<T>;
export type ValueOf<T> = _ValueOf<T>;
export type Awaitable<T> = _Awaitable<T>;
export type EmptyObject = _EmptyObject;
export type Prettify<T> = _Prettify<T>;
export type Mutable<T> = _Mutable<T>;
export type Branded<T, Brand extends string> = _Branded<T, Brand>;

declare global {
  type UnknownRecord = _UnknownRecord;
  type Nil = _Nil;
  type NonNil<T> = _NonNil<T>;
  type Nullable<T> = _Nullable<T>;
  type Optional<T> = _Optional<T>;
  type ValueOf<T> = _ValueOf<T>;
  type Awaitable<T> = _Awaitable<T>;
  type EmptyObject = _EmptyObject;
  type Prettify<T> = _Prettify<T>;
  type Mutable<T> = _Mutable<T>;
  type Branded<T, Brand extends string> = _Branded<T, Brand>;
}

export {};

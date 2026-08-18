declare const input: unknown;

const hasWindow = typeof window !== "undefined";
vi.mock("./dependency");
const reflected = Reflect.get(input, "value");
const applied = Reflect.apply(String, null, [input]);
const asserted = input as object as { value: string };
const dictionary: Record<string, unknown> = {};
const result = expect(true).toBe(true);
type UnknownAlias = unknown;
const acceptsObject = (value: object): object => value;
const returnsUnknown = (value: unknown): unknown => value;

export {
  acceptsObject,
  applied,
  asserted,
  dictionary,
  hasWindow,
  reflected,
  result,
  returnsUnknown,
  type UnknownAlias,
};

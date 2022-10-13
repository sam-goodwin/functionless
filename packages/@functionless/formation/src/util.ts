import assert from "assert";
import shortUUID from "short-uuid";

/**
 * Makes a type-assertion function for a type {@link T}, using just a single {@link key}.
 */
export function guard<T>(key: keyof T) {
  return (a: any): a is T => a?.[key] !== undefined;
}

/**
 * @param a first value
 * @param b second value
 * @returns `true` if {@link a} deepy equals {@link b}.
 */
export function isDeepEqual(a: any, b: any): boolean {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

export async function awsSDKRetry<T>(call: () => T): Promise<Awaited<T>> {
  return await retry(
    call,
    (err) => (err as any).name === "ThrottlingException",
    () => true,
    5,
    1000,
    2
  );
}

export function wait(waitMillis: number) {
  return new Promise((resolve) => setTimeout(resolve, waitMillis));
}

export const retry = async <T>(
  call: () => T | Promise<T>,
  errorPredicate: (err: unknown) => boolean,
  predicate: (val: T) => boolean,
  attempts: number,
  waitMillis: number,
  factor: number
): Promise<Awaited<T>> => {
  try {
    const item = await call();
    if (!predicate(item)) {
      if (attempts) {
        await wait(waitMillis);
        return retry(
          call,
          errorPredicate,
          predicate,
          attempts - 1,
          waitMillis * factor,
          factor
        );
      } else {
        throw Error("Retry attempts exhausted");
      }
    }
    return item;
  } catch (err) {
    if (errorPredicate(err)) {
      if (attempts) {
        await wait(waitMillis);
        return retry(
          call,
          errorPredicate,
          predicate,
          attempts - 1,
          waitMillis * factor,
          factor
        );
      } else {
        console.error(`Retry attempts exhausted ${(<any>err).message}`);
        throw err;
      }
    }
    throw err;
  }
};

export function uniqueName(
  base?: string,
  maxLength?: number,
  separator: string = "-"
) {
  const n = base
    ? `${base}${separator}${shortUUID.generate()}`
    : shortUUID.generate();
  return maxLength ? n.substring(0, maxLength) : n;
}

/**
 * @see https://stackoverflow.com/a/52171480/968011
 */
export function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (
    (h2 >>> 0).toString(16).padStart(8, "0") +
    (h1 >>> 0).toString(16).padStart(8, "0")
  );
}
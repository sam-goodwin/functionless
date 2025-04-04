import type ts from "typescript";
import type { BinaryOp, CallExpr, Expr, PropAccessExpr } from "./expression";
import {
  isArrayLiteralExpr,
  isBinaryExpr,
  isBooleanLiteralExpr,
  isComputedPropertyNameExpr,
  isForInStmt,
  isForOfStmt,
  isFunctionLike,
  isIdentifier,
  isNoSubstitutionTemplateLiteral,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isPrivateIdentifier,
  isPropAccessExpr,
  isPropAssignExpr,
  isReferenceExpr,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isTemplateExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
} from "./guards";
import type { FunctionlessNode } from "./node";

export type AnyClass = new (...args: any[]) => any;
export type AnyFunction = (...args: any[]) => any;
export type AnyAsyncFunction = (...args: any[]) => Promise<any>;

export function isAnyFunction(a: any): a is AnyFunction {
  return typeof a === "function";
}

/**
 * Create a memoized function.
 *
 * @param f the function that produces the value
 * @returns a function that computes a value on demand at most once.
 */
export function memoize<T>(f: () => T): () => T {
  let isComputed = false;
  let t: T;
  return () => {
    if (!isComputed) {
      t = f();
      isComputed = true;
    }
    return t!;
  };
}

export function isInTopLevelScope(expr: FunctionlessNode): boolean {
  if (expr.parent === undefined) {
    return true;
  }
  return walk(expr.parent);

  function walk(expr: FunctionlessNode): boolean {
    if (isFunctionLike(expr)) {
      return expr.parent === undefined;
    } else if (isForInStmt(expr) || isForOfStmt(expr)) {
      return false;
    } else if (expr.parent === undefined) {
      return true;
    }
    return walk(expr.parent);
  }
}

type EnsureOr<T extends ((a: any) => a is any)[]> = T[number] extends (
  a: any
) => a is infer T
  ? T
  : never;

export function anyOf<T extends ((a: any) => a is any)[]>(
  ...fns: T
): (a: any) => a is EnsureOr<T> {
  return (a: any): a is EnsureOr<T> => fns.some((f) => f(a));
}

export type AnyDepthArray<T> = T | T[] | AnyDepthArray<T>[];

export function flatten<T>(arr: AnyDepthArray<T>): T[] {
  if (Array.isArray(arr)) {
    return (arr as T[]).reduce(
      (a: T[], b: AnyDepthArray<T>) => a.concat(flatten(b)),
      []
    );
  } else {
    return [arr];
  }
}

export function hasParent(node: ts.Node, parent: ts.Node): boolean {
  if (!node.parent) {
    return false;
  } else if (node.parent === parent) {
    return true;
  }
  return hasParent(node.parent, parent);
}

/**
 * Returns true when all ancestors match the predicate.
 * If there are no parents left, `true` is returned.
 * If there is a `stop` provided, matching stop will halt the search and return `true`.
 */
export function hasOnlyAncestors(
  node: ts.Node,
  cont: (node: ts.Node) => boolean,
  stop?: (node: ts.Node) => boolean
): boolean {
  if (!node.parent) {
    return true;
  } else if (stop && stop(node.parent)) {
    return true;
  } else if (!cont(node.parent)) {
    return false;
  }
  return hasOnlyAncestors(node.parent, cont, stop);
}

export type ConstantValue =
  | PrimitiveValue
  | { [key: string]: ConstantValue }
  | ConstantValue[];

export type PrimitiveValue = string | number | boolean | undefined | null;

export const isPrimitive = (val: any): val is PrimitiveValue => {
  return (
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean" ||
    typeof val === "undefined" ||
    val === null
  );
};

/**
 * Determines if a node looks like `Promise.all()`
 */
export function isPromiseAll(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "all";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "all" &&
    ((isIdentifier(expr.expr.expr) && expr.expr.expr.name === "Promise") ||
      (isReferenceExpr(expr.expr.expr) && expr.expr.expr.ref() === Promise))
  );
}

export interface Constant {
  constant: unknown;
}

export function isConstant(x: any): x is Constant {
  return "constant" in x;
}

/**
 * Retrieves a string, number, boolean, undefined, or null constant from the given expression.
 * Wrap the value to not be ambiguous with the undefined value.
 * When one is not found, return undefined (not wrapped).
 *
 * Use assertConstant or assertPrimitive to make type assertions of the constant returned.
 * Values from external string may be complex types like functions.
 * We choose to late evaluate invalid values to support use cases like StepFunctions where it is both a function and has constant properties.
 * new StepFunction().stepFunctionArn
 *
 * "value" -> { constant: "value" }
 * undefined -> { constant: undefined }
 * null -> { constant: undefined }
 * call() -> undefined
 * true -> { constant: true }
 * -10 -> { constant: -10 }
 * "hello" -> { constant:  "hello" }
 * "hello" + "world" -> { constant:  "helloworld" }
 * "hello" + 1 -> { constant:  "hello1" }
 * 1 + "hello" -> { constant:  "2hello" }
 * 1 -> { constant:  1 }
 * -1 -> { constant:  -1 }
 * 1 + 2 -> { constant:  3 }
 *
 * Note: constants that follow references must already be resolved to a simple constant by {@link flattenedExpression}.
 * const obj = { val: "hello" };
 * obj.val -> { constant: "hello" }
 */
export const evalToConstant = (expr: Expr): Constant | undefined => {
  if (
    isStringLiteralExpr(expr) ||
    isNumberLiteralExpr(expr) ||
    isBooleanLiteralExpr(expr) ||
    isNullLiteralExpr(expr) ||
    isUndefinedLiteralExpr(expr)
  ) {
    return { constant: expr.value };
  } else if (isNoSubstitutionTemplateLiteral(expr)) {
    return { constant: expr.text };
  } else if (isArrayLiteralExpr(expr)) {
    const array = [];
    for (const item of expr.items) {
      if (isSpreadElementExpr(item)) {
        const val = evalToConstant(item.expr);
        if (val === undefined) {
          return undefined;
        } else if (Array.isArray(val.constant)) {
          array.push(...val.constant);
        }
      } else {
        const val = evalToConstant(item);
        if (val === undefined) {
          return undefined;
        }
        array.push(val.constant);
      }
    }
    return { constant: array };
  } else if (isObjectLiteralExpr(expr)) {
    const obj: any = {};
    for (const prop of expr.properties) {
      if (isPropAssignExpr(prop)) {
        let name;
        if (isComputedPropertyNameExpr(prop.name)) {
          const nameConst = evalToConstant(prop.name);
          if (
            typeof nameConst?.constant === "string" ||
            typeof nameConst?.constant === "number" ||
            typeof nameConst?.constant === "symbol"
          ) {
            name = nameConst.constant;
          } else {
            return undefined;
          }
        } else {
          name =
            isIdentifier(prop.name) || isPrivateIdentifier(prop.name)
              ? prop.name.name
              : prop.name.value;
        }
        const val = evalToConstant(prop.expr);
        if (val === undefined) {
          return undefined;
        } else {
          obj[name] = val.constant;
        }
      } else if (isSpreadAssignExpr(prop)) {
        const spreadConst = evalToConstant(prop.expr);
        if (spreadConst === undefined) {
          return undefined;
        } else if (
          spreadConst.constant === null ||
          spreadConst.constant === undefined
        ) {
          // no-op, spreading null/undefined achieves nothing
        } else if (typeof spreadConst.constant === "object") {
          for (const [key, val] of Object.entries(spreadConst.constant)) {
            obj[key] = val;
          }
        }
      }
    }
    return { constant: obj };
  } else if (isUnaryExpr(expr) && expr.op === "-") {
    const number = evalToConstant(expr.expr)?.constant;
    if (typeof number === "number") {
      return { constant: -number };
    }
  } else if (isPropAccessExpr(expr)) {
    const obj = evalToConstant(expr.expr)?.constant as any;
    if (obj && isIdentifier(expr.name) && expr.name.name in obj) {
      return { constant: obj[expr.name.name] };
    }
    return undefined;
  } else if (isReferenceExpr(expr)) {
    const value = expr.ref();
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "undefined" ||
      value === null
    ) {
      return { constant: value };
    } else {
      return { constant: value as any };
    }
  } else if (isBinaryExpr(expr)) {
    const left: any = evalToConstant(expr.left);
    const right: any = evalToConstant(expr.right);
    if (left !== undefined && right !== undefined) {
      if (expr.op === "+") {
        return { constant: left.constant + right.constant };
      } else if (expr.op === "-") {
        return { constant: left.constant - right.constant };
      } else if (expr.op === "*") {
        return { constant: left.constant * right.constant };
      } else if (expr.op === "/") {
        return { constant: left.constant / right.constant };
      }
    }
  } else if (isTemplateExpr(expr)) {
    const components: any[] = [expr.head.text];
    for (const span of expr.spans) {
      const exprVal = evalToConstant(span.expr);
      if (exprVal === undefined) {
        // can only evaluate templates if all expressions are constants
        return undefined;
      }
      components.push(exprVal.constant, span.literal.text);
    }
    return { constant: components.map((v) => v).join("") };
  }
  return undefined;
};

export class DeterministicNameGenerator {
  private readonly generatedNames = new Map<FunctionlessNode, string>();

  /**
   * Generate a deterministic and unique variable name for a node.
   *
   * The value is cached so that the same node reference always has the same name.
   *
   * @param node the node to generate a name for
   * @returns a unique variable name that can be used in JSON Path
   */
  public generateOrGet(node: FunctionlessNode): string {
    if (!this.generatedNames.has(node)) {
      this.generatedNames.set(node, `fnl_tmp_${this.generatedNames.size}`);
    }
    return this.generatedNames.get(node)!;
  }
}

/**
 * Generates unique names starting from the given name and then applying the given formatter function.
 *
 * Registers both the original name and the formatted name to ensure no collisions with given or formatted names.
 *
 * a -> a
 * a -> formatted(a, 1)
 * formatted(a, 1) -> formatted(formatted(a, 1), 1) // if a name is given that matches the output of formatted(a, 1), format the new name
 * formatted(a, 2) -> formatted(a, 2)
 * a -> formatted(a, 3) // the output of formatted(a, 2) already was registered, so try formatted(a, 3)
 */
export class UniqueNameGenerator {
  private readonly nameCount = new Map<string, number>();

  constructor(private formatter: (name: string, n: number) => string) {}

  public getUnique(name: string) {
    let nameCount = this.nameCount.get(name);
    if (nameCount !== undefined) {
      let formatted;
      do {
        formatted = this.formatter(name, ++nameCount);
      } while (this.nameCount.has(formatted));
      this.nameCount.set(name, nameCount);
      this.nameCount.set(formatted, 0);
      return formatted;
    } else {
      // first time seeing the name.
      this.nameCount.set(name, 0);
      return name;
    }
  }
}

/**
 * Inverts directional binary operators.
 *
 * Useful when normalizing the processing of the left and right of a binary operator.
 *
 * < -> >
 * > -> <
 * >= -> <=
 * <= -> >=
 */
export const invertBinaryOperator = (op: BinaryOp): BinaryOp => {
  switch (op) {
    case "<":
      return ">";
    case "<=":
      return ">=";
    case ">":
      return "<";
    case ">=":
      return "<=";
    default:
      return op;
  }
};

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;

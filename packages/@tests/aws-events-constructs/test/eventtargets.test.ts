import { aws_events, Stack } from "aws-cdk-lib";
import { StepFunction } from "@functionless/aws-stepfunctions-constructs";
import { Function } from "@functionless/aws-lambda-constructs";
import { Event } from "@functionless/aws-events";
import { ErrorCodes, formatErrorMessage } from "@functionless/error-code";

import { ebEventTargetTestCase, ebEventTargetTestCaseError } from "./util";

type testEvent = Event<{
  value: string;
  optional?: string;
  num: number;
  array: string[];
  "blah-blah": string;
  "blah blah": string;
}>;

test("event path", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => event.source,
    aws_events.RuleTargetInput.fromEventPath("$.source")
  );
});

test("event path index access", () => {
  ebEventTargetTestCase<testEvent>(
    // eslint-disable-next-line dot-notation
    (event) => event["source"],
    aws_events.RuleTargetInput.fromEventPath("$.source")
  );
});

test("event path index access special json path", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => event.detail["blah-blah"],
    aws_events.RuleTargetInput.fromEventPath("$.detail.blah-blah")
  );
});

test("event path index access spaces json path", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => event.detail["blah blah"],
    // Note: this doesn't look right, but it was tested with the event bridge sandbox and worked
    aws_events.RuleTargetInput.fromEventPath("$.detail.blah blah")
  );
});

test("string formatting", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => `hello ${event.source}`,
    aws_events.RuleTargetInput.fromText(
      `hello ${aws_events.EventField.fromPath("$.source")}`
    )
  );
});

test("string formatting with constants", () => {
  ebEventTargetTestCase<testEvent>(
    () => `hello ${"hi?"}`,
    aws_events.RuleTargetInput.fromText("hello hi?")
  );
});

test("constant value", () => {
  ebEventTargetTestCase<testEvent>(
    () => "hello",
    aws_events.RuleTargetInput.fromText("hello")
  );
});

test("string concat", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => "hello " + event.source,
    aws_events.RuleTargetInput.fromText(
      `hello ${aws_events.EventField.fromPath("$.source")}`
    )
  );
});

test("string concat with number", () => {
  ebEventTargetTestCase<testEvent>(
    () => "hello " + 1,
    aws_events.RuleTargetInput.fromText(`hello 1`)
  );
});

test("optional assert", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => event.detail.optional!,
    aws_events.RuleTargetInput.fromEventPath("$.detail.optional")
  );
});

test("object with constants", () => {
  ebEventTargetTestCase<testEvent>(
    () => ({
      value: "hi",
    }),
    aws_events.RuleTargetInput.fromObject({
      value: "hi",
    })
  );
});

test("object with event references", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: event.detail.value,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail.value"),
    })
  );
});

test("object with event template references", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: `hello ${event.detail.value}`,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: `hello ${aws_events.EventField.fromPath("$.detail.value")}`,
    })
  );
});

test("object with event number", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: event.detail.num,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail.num"),
    })
  );
});

test("object with null", () => {
  ebEventTargetTestCase<testEvent>(
    () => ({
      value: null,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: null,
    })
  );
});

test("object with null", () => {
  ebEventTargetTestCase<testEvent>(
    () => ({
      value: undefined,
    }),
    aws_events.RuleTargetInput.fromObject({})
  );
});

test("object with event template number references", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: `hello ${event.detail.num}`,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: `hello ${aws_events.EventField.fromPath("$.detail.num")}`,
    })
  );
});

test("object with event object references", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: event.detail,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail"),
    })
  );
});

test("object with deep event object references", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: { value2: event.detail.value },
    }),
    aws_events.RuleTargetInput.fromObject({
      value: { value2: aws_events.EventField.fromPath("$.detail.value") },
    })
  );
});

test("template with object", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => `{ value: ${{ myValue: event.source }} }`,
    aws_events.RuleTargetInput.fromText(
      `{ value: {\"myValue\":\"${aws_events.EventField.fromPath(
        "$.source"
      )}\"} }`
    )
  );
});

test("object with event array references", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: event.detail.array,
    }),
    aws_events.RuleTargetInput.fromObject({
      value: aws_events.EventField.fromPath("$.detail.array"),
    })
  );
});

test("object with event array literal", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => ({
      value: [event.detail.value],
    }),
    aws_events.RuleTargetInput.fromObject({
      value: [aws_events.EventField.fromPath("$.detail.value")],
    })
  );
});

test("object with bare array literal", () => {
  ebEventTargetTestCase<testEvent>(
    (event) => [event.detail.value],
    aws_events.RuleTargetInput.fromObject([
      aws_events.EventField.fromPath("$.detail.value"),
    ])
  );
});

test("object with bare array literal with null", () => {
  ebEventTargetTestCase<testEvent>(
    () => [null],
    aws_events.RuleTargetInput.fromObject([null])
  );
});

test("object with bare array literal with undefined", () => {
  ebEventTargetTestCase<testEvent>(
    () => [undefined],
    aws_events.RuleTargetInput.fromObject([])
  );
});

test("object with bare null", () => {
  ebEventTargetTestCase<testEvent>(
    () => null,
    aws_events.RuleTargetInput.fromObject(null)
  );
});

test("object with bare undefined", () => {
  ebEventTargetTestCase<testEvent>(
    () => undefined,
    aws_events.RuleTargetInput.fromObject(undefined)
  );
});

type MyString = string;
interface MyTest extends Event<{ s: MyString }> {}

test("event field + another event field should error because there is no way to know if strings", () => {
  ebEventTargetTestCaseError<MyTest>(
    (event) => event.detail.s + event.detail.s,
    "Addition operator is only supported to concatenate at least one string to another value."
  );
});

describe("predefined", () => {
  test("direct event", () => {
    ebEventTargetTestCase<testEvent>((event) => event, {
      bind: () => {
        return { inputPathsMap: {}, inputTemplate: "<aws.events.event>" };
      },
    });
  });

  test("direct rule name", () => {
    ebEventTargetTestCase<testEvent>((_event, u) => u.context.ruleName, {
      bind: () => {
        return {
          inputPathsMap: {},
          inputTemplate: '"<aws.events.rule-name>"',
        };
      },
    });
  });

  test("direct rule name in template", () => {
    ebEventTargetTestCase<testEvent>(
      (_event, u) => `blah ${u.context.ruleName}`,
      {
        bind: () => {
          return {
            inputPathsMap: {},
            inputTemplate: '"blah <aws.events.rule-name>"',
          };
        },
      }
    );
  });

  test("direct event json name", () => {
    ebEventTargetTestCase<testEvent>((_event, u) => u.context.eventJson, {
      bind: () => {
        return {
          inputPathsMap: {},
          inputTemplate: '"<aws.events.event.json>"',
        };
      },
    });
  });

  test("direct event in object", () => {
    ebEventTargetTestCase<testEvent>(
      (event) => ({
        evnt: event,
      }),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '{"evnt":<aws.events.event>}',
        }),
      }
    );
  });

  test("direct event in template", () => {
    ebEventTargetTestCase<testEvent>((event) => `original: ${event}`, {
      bind: () => ({
        inputPathsMap: {},
        inputTemplate: '"original: <aws.events.event>"',
      }),
    });
  });

  test("rule name", () => {
    ebEventTargetTestCase<testEvent>(
      (_, $utils) => ({ value: $utils.context.ruleName }),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '{"value":<aws.events.rule-name>}',
        }),
      }
    );
  });

  test("rule arn", () => {
    ebEventTargetTestCase<testEvent>(
      (_, $utils) => ({ value: $utils.context.ruleArn }),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '{"value":<aws.events.rule-arn>}',
        }),
      }
    );
  });

  test("event json", () => {
    ebEventTargetTestCase<testEvent>(
      (_, $utils) => ({ value: $utils.context.eventJson }),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '{"value":<aws.events.event.json>}',
        }),
      }
    );
  });

  test("time", () => {
    ebEventTargetTestCase<testEvent>(
      (_, $utils) => ({ value: $utils.context.ingestionTime }),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '{"value":<aws.events.ingestion-time>}',
        }),
      }
    );
  });

  test("different utils name", () => {
    ebEventTargetTestCase<testEvent>(
      (_, utils) => ({ value: utils.context.ruleName }),
      {
        bind: () => ({
          inputPathsMap: {},
          inputTemplate: '{"value":<aws.events.rule-name>}',
        }),
      }
    );
  });

  test("different utils name at the top", () => {
    ebEventTargetTestCase<testEvent>((_, utils) => utils.context.ruleName, {
      bind: () => {
        return {
          inputPathsMap: {},
          inputTemplate: '"<aws.events.rule-name>"',
        };
      },
    });
  });
});

describe("referencing", () => {
  test("dereference", () => {
    ebEventTargetTestCase<testEvent>(
      (event) => {
        const value = event.detail.value;

        return { value: value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("dereference and prop access", () => {
    ebEventTargetTestCase<testEvent>(
      (event) => {
        const value = event.detail;

        return { value: value.value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("constant", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const value = "hi";

        return { value: value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  // Functionless doesn't support computed properties currently
  test("constant computed prop name", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const value = "hi";

        return { [value]: value };
      },
      aws_events.RuleTargetInput.fromObject({
        hi: "hi",
      })
    );
  });

  test("constant from object", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = { value: "hi" };

        return { value: config.value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  test("spread with constant object", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = { value: "hi" };

        return { ...config };
      },
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  test("object element access", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = { value: "hi" };

        return { val: config.value };
      },
      aws_events.RuleTargetInput.fromObject({
        val: "hi",
      })
    );
  });

  test("object access", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = { value: "hi" } as any;

        return { val: config.value };
      },
      aws_events.RuleTargetInput.fromObject({
        val: "hi",
      })
    );
  });

  test("constant list", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = ["hi"];

        return { values: config };
      },
      aws_events.RuleTargetInput.fromObject({
        values: ["hi"],
      })
    );
  });

  test("spread with constant list", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = ["hi"];

        return { values: [...config, "there"] };
      },
      aws_events.RuleTargetInput.fromObject({
        values: ["hi", "there"],
      })
    );
  });

  test("array index", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const config = ["hi"];

        return { values: [config[0], "there"] };
      },
      aws_events.RuleTargetInput.fromObject({
        values: ["hi", "there"],
      })
    );
  });

  test("array index variable index", () => {
    ebEventTargetTestCase<testEvent>(
      () => {
        const index = 0;
        const config = ["hi"];

        return { values: [config[index], "there"] };
      },
      aws_events.RuleTargetInput.fromObject({
        values: ["hi", "there"],
      })
    );
  });

  test("constant from outside", () => {
    const value = "hi";

    ebEventTargetTestCase<testEvent>(
      () => {
        return { value: value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: "hi",
      })
    );
  });

  test("constant from outside into object", () => {
    const value = "hello";
    const value2 = "hello2";

    ebEventTargetTestCase<testEvent>(
      () => {
        return { value2, value };
      },
      aws_events.RuleTargetInput.fromObject({
        value2: "hello2",
        value: "hello",
      })
    );
  });

  test("step functions property", () => {
    const stack = new Stack();

    const sfn = new StepFunction(stack, "sfn", () => {});

    ebEventTargetTestCase<testEvent>(
      () => {
        return { sfn: sfn.resource.stateMachineArn };
      },
      aws_events.RuleTargetInput.fromObject({
        sfn: sfn.resource.stateMachineArn,
      })
    );
  });

  test("closure from outside into object", () => {
    const value = () => {};

    ebEventTargetTestCaseError<testEvent>(() => {
      return { value: value };
    }, "Event Bridge input transforms can only output constant values.");
  });
});

describe("not allowed", () => {
  test("empty body", () => {
    ebEventTargetTestCaseError<testEvent>(() => {},
    "No return statement found in event bridge target function.");
  });

  // Note: this cannot happen with the type checker, but validating in case someone tries to hack around it
  test("use of deep fields outside of detail", () => {
    ebEventTargetTestCaseError<testEvent>(
      (event) => ({
        event: (<any>event.source).blah,
      }),
      "Event references with depth greater than one must be on the detail property, got source,blah"
    );
  });

  test("service call", async () => {
    const stack = new Stack();

    const func = new Function(stack, "func", async () => {});
    ebEventTargetTestCaseError<testEvent>(
      () => func("hello"),
      formatErrorMessage(
        ErrorCodes.EventBus_Input_Transformers_do_not_support_Integrations
      )
    );
    await Promise.all(Function.promises);
  });

  // regression: this will be a tsc-level error now that we don't have type information in the AST
  test.skip("math", () => {
    ebEventTargetTestCaseError<testEvent>(
      (event) => event.detail.num + 1,
      "Addition operator is only supported to concatenate at least one string to another value."
    );
  });

  test("non-constants", () => {
    ebEventTargetTestCaseError<testEvent>(
      (event) => (() => event.detail.num)(),
      "Unsupported template expression of kind: CallExpr"
    );
  });

  test("spread obj ref", () => {
    ebEventTargetTestCaseError<testEvent>(
      (event) => ({ ...event.detail, field: "hello" }),
      "Event Bridge input transforms do not support object spreading non-constant objects."
    );
  });

  test("spread array ref", () => {
    ebEventTargetTestCaseError<testEvent>(
      (event) => [...event.detail.array],
      "Event Bridge input transforms do not support array spreading non-constant arrays."
    );
  });

  test("object access missing key", () => {
    ebEventTargetTestCaseError<testEvent>(() => {
      const obj = { val: "" } as any;
      return { val: obj.blah };
    }, "Cannot find property blah in Object with constant keys: val");
  });
});

// https://github.com/functionless/functionless/issues/68
describe.skip("destructure", () => {
  test("destructure parameter", () => {
    ebEventTargetTestCase<testEvent>(
      ({ detail }) => {
        return { value: detail.value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("destructure variable", () => {
    ebEventTargetTestCase<testEvent>(
      (event) => {
        const { value } = event.detail;

        return { value: value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("destructure multi-layer variable", () => {
    ebEventTargetTestCase<testEvent>(
      (event) => {
        const {
          detail: { value },
        } = event;

        return { value: value };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("destructure array doesn't work", () => {
    ebEventTargetTestCaseError<testEvent>((event) => {
      const [first] = event.detail.array;

      return { value: first };
    });
  });

  test("destructure parameter array doesn't work", () => {
    ebEventTargetTestCase<testEvent>(
      ({
        detail: {
          array: [first],
        },
      }) => {
        return { value: first };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("destructure variable rename", () => {
    ebEventTargetTestCase<testEvent>(
      (event) => {
        const { value: val } = event.detail;

        return { value: val };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.detail.value"),
      })
    );
  });

  test("destructure parameter rename", () => {
    ebEventTargetTestCase<testEvent>(
      ({ source: src }) => {
        return { value: src };
      },
      aws_events.RuleTargetInput.fromObject({
        value: aws_events.EventField.fromPath("$.source"),
      })
    );
  });
});

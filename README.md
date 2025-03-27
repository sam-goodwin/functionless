Functionless is an attempt to compile TypeScript code into AWS "Functionless" definitions (e.g. Step Functions or Event Bridge Pipes).

It primarily focused on transforming a TypeScript function into an AWS Step Function workflow definition, but Step Functions weren't Turing Complete (lacked JSONAta back then), so ultimately failed.


```ts
import { StepFunction } from "@functionless/aws-stepfunctions";

import MyDatabase from "./table";

export default StepFunction(async (input: { todoId: string }) => {
  await StepFunction.waitSeconds(10);

  await MyDatabase.attributes.delete({
    Key: {
      pk: {
        S: "todo",
      },
      sk: {
        S: input.todoId,
      },
    },
  });
});
```

The lesson learned from this project is to find solutions that don't necessitate static analysis and compiler tools. "Don't fight your language".

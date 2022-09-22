import { aws_dynamodb, Duration } from "aws-cdk-lib";
import { Function, FunctionProps, Table } from "../src";
import {
  RuntimeTestClients,
  runtimeTestExecutionContext,
  runtimeTestSuite,
} from "./runtime";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever:
    runtimeTestExecutionContext.deployTarget === "AWS"
      ? undefined
      : () => ({
          endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
        }),
};

interface BaseItem<Type extends string, Version extends number> {
  type: Type;
  version: Version;
  pk: `${Type}|${Version}|${string}`;
  sk: string;
}

type Item = Item1v1 | Item1v2 | Item2;

interface Item1v1 extends BaseItem<"Item1", 1> {
  data1: {
    key: string;
  };
}
interface Item1v2 extends BaseItem<"Item1", 2> {
  data: {
    key: string;
  };
}

interface Item2 extends BaseItem<"Item2", 1> {
  data2: {
    key: string;
  };
}

runtimeTestSuite("tableStack", (t: any) => {
  // const test: (
  //   name: string,
  //   body: (
  //     scope: Construct,
  //     role: Role
  //   ) => {
  //     outputs: {
  //       tableArn: string;
  //       functionArn: string;
  //     };
  //   }
  //   // for some reason, adding this variable breaks types of Table
  //   // after: any
  // ) => void = t;

  const test = t;

  test(
    "getItem, batchGetItems, putItem, updateItem, deleteItem, query, scan",
    (scope: any, role: any) => {
      const table = new Table<Item, "pk", "sk">(scope, "JsonSecret", {
        partitionKey: {
          name: "pk",
          type: aws_dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "sk",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      const func = new Function(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async (item: Item1v1) => {
          await table.put({
            Item: item,
          });

          const gotItem = await table.get({
            Key: {
              pk: item.pk,
              sk: item.sk,
            },
          });

          const query = await table.query({
            KeyConditionExpression: "pk = :pk",
            ExpressionAttributeValues: {
              ":pk": item.pk,
            },
            ConsistentRead: true,
          });

          const scan = await table.scan({
            ConsistentRead: true,
          });

          const batch = await table.batchGet({
            Keys: [
              {
                pk: item.pk,
                sk: item.sk,
              },
            ],
          });

          const updated = await table.update({
            Key: {
              pk: item.pk,
              sk: item.sk,
            },
            UpdateExpression: "SET data1 = :data",
            ExpressionAttributeValues: {
              ":data": {
                key: "value2",
              },
            },
            ReturnValues: "ALL_OLD",
          });

          const deleted = await table.delete({
            Key: {
              pk: item.pk,
              sk: item.sk,
            },
            ReturnValues: "UPDATED_NEW",
          });

          const put2 = await table.put({
            Item: item,
            ReturnValues: "ALL_OLD",
          });

          let batchWrite = await table.batchWrite({
            RequestItems: [
              {
                DeleteRequest: {
                  Key: {
                    pk: item.pk,
                    sk: item.sk,
                  },
                },
              },
            ],
          });

          while (batchWrite.UnprocessedItems) {
            batchWrite = await table.batchWrite({
              RequestItems: batchWrite.UnprocessedItems,
            });
          }

          return [
            gotItem.Item ?? null,
            ...(scan.Items ?? []),
            ...(query.Items ?? []),
            ...(batch.Items ?? []),
            updated.Attributes ?? null,
            deleted.Attributes ?? null,
          ];
        }
      );
      func.resource.grantInvoke(role);
      table.resource.grantFullAccess(role);
      return {
        outputs: {
          tableArn: table.resource.tableArn,
          functionArn: func.resource.functionArn,
        },
      };
    },
    async (context: any, clients: RuntimeTestClients) => {
      const item: Item1v1 = {
        type: "Item1",
        version: 1,
        pk: "Item1|1|pk1",
        sk: "sk2",
        data1: {
          key: "value",
        },
      };

      const response = await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify(item),
        })
        .promise();

      expect(JSON.parse(response.Payload as string)).toEqual([
        item,
        item,
        item,
        item,
        item,
        {
          ...item,
          data1: {
            key: "value2",
          },
        },
      ]);
    }
  );
});
import { aws_dynamodb, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Event } from "@functionless/aws-events";
import { EventBus } from "@functionless/aws-events-constructs";
import { Table } from "@functionless/aws-dynamodb-constructs";
import { StepFunction } from "@functionless/aws-stepfunctions-constructs";
import { retry, runtimeTestSuite } from "@functionless/test";

runtimeTestSuite("eventBusStack", (testResource) => {
  testResource(
    "Create bus",
    (parent, role) => {
      // creating a random ID
      const addr = new CfnOutput(parent, "out", { value: "" });
      const bus = new EventBus(parent, "bus", {
        eventBusName: addr.node.addr,
      });

      bus.resource.grantPutEventsTo(role);

      return {
        outputs: {
          bus: addr.node.addr,
        },
      };
    },
    async (context, clients) => {
      await clients.eventBridge
        .putEvents({
          Entries: [
            {
              EventBusName: context.bus,
            },
          ],
        })
        .promise();
    }
  );

  testResource(
    "Bus event starts step function and writes to dynamo",
    (parent, role) => {
      const addr = new CfnOutput(parent, "out", { value: "" });
      const bus = new EventBus<Event<{ id: string }, "test">>(parent, "bus", {
        eventBusName: addr.node.addr,
      });
      const table = Table.fromTable<{ id: string }, "id">(
        new aws_dynamodb.Table(parent, "table", {
          tableName: addr.node.addr + "table",
          partitionKey: {
            name: "id",
            type: aws_dynamodb.AttributeType.STRING,
          },
          removalPolicy: RemovalPolicy.DESTROY,
        })
      );
      const putMachine = new StepFunction<{ id: string }, void>(
        parent,
        "machine",
        async (event) => {
          await table.attributes.put({
            Item: {
              id: { S: event.id },
            },
          });
        }
      );
      bus.resource.grantPutEventsTo(role);
      table.resource.grantReadData(role);
      bus
        .when(parent, "rule", (event) => event.source === "test")
        .map((event) => event.detail)
        .pipe(putMachine);

      return {
        outputs: {
          bus: addr.node.addr,
          table: addr.node.addr + "table",
        },
      };
    },
    async (context, clients) => {
      const id = `${context.bus}${Math.floor(Math.random() * 1000000)}`;

      await clients.eventBridge
        .putEvents({
          Entries: [
            {
              EventBusName: context.bus,
              Source: "test",
              Detail: JSON.stringify({
                id,
              }),
              DetailType: "someType",
            },
          ],
        })
        .promise();

      // Give time for the event to make it to dynamo. Localstack is pretty slow.
      // 1 - 1s
      // 2 - 2s
      // 3 - 4s
      // 4 - 8s
      // 5 - 16s
      const item = await retry(
        () =>
          clients.dynamoDB
            .getItem({
              Key: {
                id: { S: id },
              },
              TableName: context.table,
              ConsistentRead: true,
            })
            .promise(),
        (item) => !!item.Item,
        5,
        10000,
        2
      );

      expect(item.Item).toBeDefined();
    }
  );
});

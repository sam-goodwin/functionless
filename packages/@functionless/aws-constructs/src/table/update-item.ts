import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import { FormatObject } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ReturnValues } from "./return-value";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export type UpdateItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  ReturnValue extends ReturnValues | undefined,
  Format extends JsonFormat
> = Omit<
  Format extends JsonFormat.Document
    ? AWS.DynamoDB.DocumentClient.UpdateItemInput
    : AWS.DynamoDB.UpdateItemInput,
  "TableName" | "Key"
> & {
  Key: Key;
  ReturnValues?: ReturnValue;
};

export interface UpdateItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  ReturnValue extends ReturnValues | undefined,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.DocumentClient.UpdateItemOutput, "TableName"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : ReturnValue extends "ALL_OLD" | "ALL_NEW"
    ? FormatObject<Narrow<Item, Key, Format>, Format>
    : Partial<FormatObject<Narrow<Item, Key, Format>, Format>>;
}

export type UpdateItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Return extends ReturnValues | undefined = undefined
>(
  input: UpdateItemInput<Item, PartitionKey, RangeKey, Key, Return, Format>
) => Promise<
  UpdateItemOutput<Item, PartitionKey, RangeKey, Key, Return, Format>
>;

export function createUpdateItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): UpdateItem<Item, PartitionKey, RangeKey, Format> {
  return createDynamoIntegration<
    UpdateItem<Item, PartitionKey, RangeKey, Format>,
    Format
  >(table, "updateItem", format, "write", (client, [request]) => {
    const input: any = {
      ...(request ?? {}),
      TableName: table.tableName,
    };
    if (format === JsonFormat.AttributeValue) {
      return (client as AWS.DynamoDB).updateItem(input).promise() as any;
    } else {
      return (client as AWS.DynamoDB.DocumentClient)
        .update(input)
        .promise() as any;
    }
  });
}

export type UpdateItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  update: DynamoDBAppsyncExpression;
  condition?: DynamoDBAppsyncExpression;
  _version?: number;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;

export function createUpdateItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): UpdateItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    UpdateItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.updateItem.appsync", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "UpdateItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        vtl.qr(`${request}.put('update', ${input}.get('update'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });
}
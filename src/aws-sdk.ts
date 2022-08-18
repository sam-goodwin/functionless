import type { Service as AWSService } from "aws-sdk";
// eslint-disable-next-line import/no-extraneous-dependencies
import type * as AWS from "aws-sdk";
import { AnyFunction, OverloadUnion } from "./util";

type AWSServiceClass = { new (): AWSService };

/**
 * First we have to extract the names of all Services in the v2 AWS namespace
 *
 * @returns "AccessAnalyzer" | "Account" | ... | "XRay"
 */
export type ServiceKeys = Exclude<
  {
    [K in keyof typeof AWS]: typeof AWS[K] extends AWSServiceClass ? K : never;
  }[keyof typeof AWS],
  "Service"
>;

export type SDK = {
  [serviceName in ServiceKeys]: typeof AWS[serviceName] extends new (
    ...args: any[]
  ) => infer Client
    ? {
        [methodName in keyof Client]: SdkMethod<Client[methodName]>;
      }
    : never;
};

export interface SdkCallInput<Params extends object> {
  /**
   * The parameters to the api call
   */
  params: Params;

  /**
   * The resources for the IAM statement that will be added to the state machine
   * role's policy to allow the state machine to make the API call.
   *
   * Use `["*"]` to grant access to all resources (discouraged).
   *
   * @example ["arn:aws:s3:::my_bucket"]
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
   */
  iamResources: [string, ...string[]];

  /**
   * The action for the IAM statement that will be added to the state machine role's
   * policy to allow the state machine to make the API call.
   *
   * By default the action is inferred from the API call (e.g. `$AWS.SDK.CloudWatch.describeAlarms({})` results in `cloudwatch:DescribeAlarms`)
   *
   * Use in the case where the IAM action name does not match with the API service/action name
   * e.g. `s3:ListBuckets` requires `s3:ListAllMyBuckets`.
   *
   * To see which action to use with which service/method see the {@link https://docs.aws.amazon.com/service-authorization/latest/reference/reference_policies_actions-resources-contextkeys.html | IAM Service Authorization Reference}
   *
   * @default service:method
   * @example s3:ListAllMyBuckets
   */
  iamActions?: string[];

  /**
   * The iam conditions to apply to the IAM Statement that will be added to the state machine role's
   * policy to allow the state machine to make the API call.
   *
   * By default no conditions are applied.
   *
   * For more information check out the {@link https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html | IAM User Guide}
   *
   * @example
   * ```
   * {
   *   "StringEquals" : { "aws:username" : "johndoe" }
   * }
   * ```
   */
  iamConditions?: Record<string, any>;

  /**
   * The service name to use in the ASL (Amazon States Language) definition of the SDK integration.
   * ```json
   * {
   *   "Type": "Task",
   *   "Resource": "arn:aws:states:::aws-sdk:${sdkIntegrationServiceName}:${methodName}"
   * }
   * ```
   *
   * By default the service name is lowercased (e.g. `$AWS.SDK.CloudWatch.describeAlarms` => `"arn:aws:states:::aws-sdk:cloudwatch:describeAlarms"`).
   * Some known special cases are also handled in {@link SDK_INTEGRATION_SERVICE_NAME}.
   *
   * To see which service name to use see the {@link https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html#supported-services-awssdk-list | StepFunctions Developer Guide}
   */
  aslServiceName?: string;
}

export type SdkMethod<API> = API extends AnyFunction
  ? Exclude<OverloadUnion<API>, (cb: AnyFunction) => any> extends (
      input: infer Params extends {}
    ) => AWS.Request<infer Output, any>
    ? (input: SdkCallInput<Params>) => Promise<Output>
    : never
  : never;
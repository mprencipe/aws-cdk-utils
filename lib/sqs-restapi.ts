import {Construct} from "constructs";
import {Aws} from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';

/**
 * Describes the API Gateway response 
 */
type ResponseProps = {
    /**
     * Content type for the response, e.g. text/html
     */
    readonly contentType: string
    /**
     * Raw response
     */
    readonly response: string
}

export type SqsRestApiProps = {
    /**
     * Properties for the REST API
     */
    readonly restApiProps?: apigw.RestApiProps

    /**
     * Properties for the SQS queue
     */
    readonly queueProps?: sqs.QueueProps

    readonly apiOptions?: {
        /**
         * HTTP method for the API, by default POST
         */
        readonly method?: 'OPTIONS' | 'GET' | 'HEAD' | 'PUT' | 'POST' | 'DELETE' | 'PATCH'
        
        /**
         * Content type for the API action, by default application/json
         */
        readonly contentType?: string
        
        /**
         * Success response, by default 'OK'
         */
        readonly successResponse?: ResponseProps

        /**
         * Error response, by default 'Error'
         */
        readonly errorResponse?: ResponseProps

        /**
         * Resource name for the API path, by default 'resources'
         */
        readonly resourceName: string

        /**
         * Request validator, by default none
         */
        readonly requestValidator?: apigw.RequestValidator

        /**
         * API key required, by default false
         */
        readonly apiKeyRequired?: boolean

        /**
         * Request models for incoming data validation, by default none
         */
        readonly requestModels?: {[param: string]: apigw.IModel}
    }
}

/**
 * A REST API that passes all ingested data to an SQS queue.
 */
export class SqsRestApi {

    /**
     * The underlying REST API
     */
    readonly restApi: apigw.RestApi

    /**
     * The underlying SQS queue
     */
    readonly queue: sqs.Queue

    /**
     * @param scope Scope
     * @param props properties
     */
    constructor(scope: Construct, props?: SqsRestApiProps) {
        this.restApi = new apigw.RestApi(scope, 'sqsRestApi', props?.restApiProps ?? {
            description: 'SQS API'
        });
        this.queue = new sqs.Queue(scope, 'restApiQueue', props?.queueProps ?? {
            queueName: 'Rest API queue'
        });

        // create role for API Gateway SQS sending
        const apigwToSqsRole = new iam.Role(scope, 'ApiGatewayToSQSRole', {
            assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
        });
        // grant rights to write CloudWatch logs
        apigwToSqsRole.addToPolicy(new iam.PolicyStatement({
            resources: [
                '*',
            ],
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:DescribeLogGroups',
                'logs:DescribeLogStreams',
                'logs:PutLogEvents',
                'logs:GetLogEvents',
                'logs:FilterLogEvents'
            ],
        }))
        this.queue.grantSendMessages(apigwToSqsRole);

        // https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html
        const requestTemplates: Record<string, string> = {};
        requestTemplates[props?.apiOptions?.contentType ?? 'application/json'] = 'Action=SendMessage&MessageBody=$util.urlEncode($input.body)';

        // create templates for responses
        const successResponseTemplates: Record<string, string> = {};
        successResponseTemplates[props?.apiOptions?.successResponse?.contentType ?? 'text/html'] = props?.apiOptions?.successResponse?.response ?? 'OK';

        const errorResponseTemplates: Record<string, string> = {};
        errorResponseTemplates[props?.apiOptions?.errorResponse?.contentType ?? 'text/html'] = props?.apiOptions?.errorResponse?.response ?? 'Error';

        // integrate API with another AWS service, namely SQS
        const sqsIntegration = new apigw.AwsIntegration({
            service: 'sqs',
            integrationHttpMethod: props?.apiOptions?.method ?? 'POST',
            options: {
                passthroughBehavior: apigw.PassthroughBehavior.NEVER,
                credentialsRole: apigwToSqsRole,
                requestParameters: {
                    'integration.request.header.Content-Type': "'application/x-www-form-urlencoded'",
                },
                requestTemplates,
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseTemplates: successResponseTemplates
                    },
                    {
                        statusCode: '500',
                        responseTemplates: errorResponseTemplates,
                        // match on status code
                        selectionPattern: '500',
                    },
    
                ],
            },
            path: Aws.ACCOUNT_ID + '/' + this.queue.queueName,
        });

        const resource = this.restApi.root.addResource(props?.apiOptions?.resourceName ?? 'resources');
        resource.addMethod(props?.apiOptions?.method ?? 'POST', sqsIntegration, {
            requestValidator: props?.apiOptions?.requestValidator,
            apiKeyRequired: props?.apiOptions?.apiKeyRequired ?? false,
            requestModels: props?.apiOptions?.requestModels ?? {},
            methodResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Content-Type': true,
                    },
                },
                {
                    statusCode: '500',
                    responseParameters: {
                        'method.response.header.Content-Type': true,
                    },
                },
            ],
        });
    }
}

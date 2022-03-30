import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {SqsRestApi} from '../lib/sqs-restapi';

test('Creates a queue and an API with defaults', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    new SqsRestApi(stack);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Description: 'SQS API'
    });
    template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'Rest API queue'
    });
});

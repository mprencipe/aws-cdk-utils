import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {JsonRestApi} from '../lib/jsonrestapi';
import * as lambda from 'aws-cdk-lib/aws-lambda';


test('API Gateway resources are created', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    createApi(stack);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'foos'
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: '{resource_id}'
    });
});

test('Functions are included in stack', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');

    createApi(stack);

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'listresources.handler'
    });
    template.hasResourceProperties('AWS::Lambda::Function', {
        Handler: 'getresource.handler'
    });
});

function createApi(stack: cdk.Stack) {
    const listResourcesLambda = new lambda.Function(stack, 'listResourcesLambda', {
        handler: 'listresources.handler',
        code: lambda.Code.fromInline('boom'),
        runtime: lambda.Runtime.NODEJS_14_X,
    });
    const getResourceLambda = new lambda.Function(stack, 'getResourceLambda', {
        handler: 'getresource.handler',
        code: lambda.Code.fromInline('boom'),
        runtime: lambda.Runtime.NODEJS_14_X,
    });
    new JsonRestApi(stack, 'id', {
        resourceName: 'foos',
        apiKeyRequired: false,
        listResourcesLambda,
        getResourceLambda
    });
}
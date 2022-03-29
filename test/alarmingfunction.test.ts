import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Template } from 'aws-cdk-lib/assertions';
import { AlarmingFunction } from '../lib/alarmingfunction';
import * as lambda from 'aws-cdk-lib/aws-lambda';

test('No timeout throws error', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const topic = new cdk.aws_sns.Topic(stack, 'topic');

    expect(() => new AlarmingFunction(stack, 'fn', topic, {
        code: new lambda.InlineCode('module.exports = function(){}'),
        runtime: lambda.Runtime.NODEJS,
        handler: 'index'
    })).toThrowError();
});

test('Creates Lambda Function', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const topic = new sns.Topic(stack, 'topic');

    new AlarmingFunction(stack, 'fn', topic, {
        functionName: 'func',
        code: new lambda.InlineCode('module.exports = function(){}'),
        runtime: lambda.Runtime.NODEJS,
        handler: 'index',
        timeout: cdk.Duration.minutes(5),
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'func',
        Runtime: 'nodejs',
        Handler: 'index',
        Timeout: 300
    });
});

test('Creates CloudWatch Alarms', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestStack');
    const topic = new sns.Topic(stack, 'topic');

    new AlarmingFunction(stack, 'fn', topic, {
        functionName: 'func',
        code: new lambda.InlineCode('module.exports = function(){}'),
        runtime: lambda.Runtime.NODEJS,
        handler: 'index',
        timeout: cdk.Duration.minutes(5),
    });

    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        EvaluationPeriods: 1,
        AlarmDescription: 'Duration alarm',
        DatapointsToAlarm: 1,
        MetricName: 'Duration',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Maximum',
        Threshold: 300000
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        EvaluationPeriods: 1,
        AlarmDescription: 'Errors alarm',
        DatapointsToAlarm: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 1
    });
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        AlarmDescription: 'Throttle alarm',
        DatapointsToAlarm: 1,
        MetricName: 'Throttles',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 0
    });
});

import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from "aws-cdk-lib/aws-sns";
import {Construct} from "constructs";

/**
 * Creates a Lambda function with CloudWatch Alarms for duration, error and throttle metrics.
 * Alarm notifications go to an SNS topic.
 */
export class AlarmingFunction {

    /**
     * The underlying Lambda Function object
     */
    readonly function: lambda.Function

    private readonly scope: Construct
    private readonly action: cloudwatch_actions.SnsAction

    /**
     * 
     * @param scope Scope
     * @param id Id
     * @param topic SNS topic to which alarms get sent to
     * @param functionProps Lambda Function properties
     */
    constructor(
        scope: Construct,
        id: string,
        topic: sns.ITopic,
        functionProps: lambda.FunctionProps,
    ) {
        this.scope = scope;
        this.function = new lambda.Function(scope, id, functionProps);
        this.action = new cloudwatch_actions.SnsAction(topic);
        this.createAlarms();
    }

    private createAlarms() {
        if (!this.function.timeout) {
            throw new Error('Function timeout is mandatory');
        }
        this.function.metricDuration().with({statistic: 'max'}).createAlarm(this.scope, `${this.function.node.id}DurationAlarm`, {
            alarmName: `${this.function.functionName}DurationAlarm`,
            alarmDescription: 'Duration alarm',
            threshold: this.function.timeout.toMilliseconds(),
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        }).addAlarmAction(this.action);

        this.function.metricErrors().createAlarm(this.scope, `${this.function.node.id}ErrorsAlarm`, {
            alarmName: `${this.function.functionName}ErrorsAlarm`,
            alarmDescription: 'Errors alarm',
            threshold: 1,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
        }).addAlarmAction(this.action);

        this.function.metricThrottles().createAlarm(this.scope, `${this.function.node.id}ThrottleAlarm`, {
            alarmName: `${this.function.functionName}ThrottleAlarm`,
            alarmDescription: 'Throttle alarm',
            threshold: 0,
            evaluationPeriods: 1,
            datapointsToAlarm: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
        }).addAlarmAction(this.action);
    }
}

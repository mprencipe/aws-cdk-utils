import * as cdk from '@aws-cdk/core';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';

export const ERROR_TEMPLATE = `#set($inputRoot = $input.path('$'))
$inputRoot.body
#if ($inputRoot.status > 399)
#set ($context.responseOverride.status = $inputRoot.status)
#set ($context.responseOverride.header.Content-Type = 'text/plain')
#end
`;

function createIntegrationResponse(statusCode: string) {
    return {
        statusCode,
        'application/json': ERROR_TEMPLATE
    };
}

export interface JsonRestApiProps {

  /**
   * Resource name, e.g. "projects".
   */
  readonly resourceName: string

  /**
   * Non-proxy Lambda for listing resources.
   */
  readonly listResourcesLambda: lambda.Function

  /**
   * Non-proxy Lambda for retrieving single resource.
   */
  readonly getResourceLambda: lambda.Function

  /**
   * Is API key required.
   */
  readonly apiKeyRequired: boolean

}

export class JsonRestApi extends apigw.RestApi {

  private readonly apiKeyRequired: boolean;

  constructor(
    scope: cdk.Construct,
    id: string,
    props: JsonRestApiProps,
    restApiProps: apigw.RestApiProps = {}
  ) {

    super(scope, id, restApiProps);

    this.apiKeyRequired = props.apiKeyRequired;

    this.set404Response();

    const root = this.root.addResource(props.resourceName);
    this.addListResources(root, props.listResourcesLambda);

    const resource = root.addResource('{resource_id}');
    this.addGetResource(resource, props.getResourceLambda);
  }

  private addListResources(resource: apigw.Resource, listResourcesLambda: lambda.Function) {
    const integration = new apigw.LambdaIntegration(listResourcesLambda, {
      proxy: false,
      integrationResponses: [
        createIntegrationResponse('200'),
        createIntegrationResponse('500')
      ]
    });
    resource.addMethod('GET', integration, {
      apiKeyRequired: this.apiKeyRequired,
      methodResponses: [
        {statusCode: '200'},
        {statusCode: '500'}
      ]
    });
  }

  private addGetResource(resource: apigw.Resource, getResourceLambda: lambda.Function) {
    const integration = new apigw.LambdaIntegration(getResourceLambda, {
      proxy: false,
      requestParameters: {
        'integration.request.path.resource_id': 'method.request.path.resource_id',
      },
      requestTemplates: {
        'application/json': JSON.stringify({
            resource_id: "$util.escapeJavaScript($input.params('resource_id'))"
        })
      },
      integrationResponses: [
        createIntegrationResponse('200'),
        createIntegrationResponse('400'),
        createIntegrationResponse('404'),
        createIntegrationResponse('500')
      ]
    });
    resource.addMethod('GET', integration, {
      apiKeyRequired: this.apiKeyRequired,
      requestParameters: {
        'method.request.path.resource_id': true
      },
      methodResponses: [
        {statusCode: '200'},
        {statusCode: '400'},
        {statusCode: '404'},
        {statusCode: '500'}
      ]
    });
  }

  private set404Response() {
    new apigw.GatewayResponse(this.stack, `${this.restApiName}-MissingAuthenticationTokenResponse`, {
      restApi: this,
      type: apigw.ResponseType.MISSING_AUTHENTICATION_TOKEN,
      statusCode: '404',
      templates: {
          'text/plain': 'Not found'
      }
  });
  }

}

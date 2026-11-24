package com.epam.indigoeln.aws;

import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.constructs.Construct;

public class MainStack extends Stack {

    public MainStack(Construct scope, String id, StackProps stackProps, String envName, StageParameters props) {
        super(scope, id, stackProps);

        InfraStack infraStack = new InfraStack(this, new InfraStack.Props(
                envName,
                props.getRegion(),
                props.getVpc(),
                props.getDataVolumeAz(),
                props.getEc2KeyPair(),
                props.getHostedZone(),
                props.getHostedZoneName(),
                props.getSecurityGroups(),
                props.getStorageBucketName(),
                props.getLambdaSubnets(),
                props.isCreateS3Gateway()
        ));

        CognitoStack cognitoStack = new CognitoStack(this, new CognitoStack.Props(
                props.getDomainName(),
                envName
        ));

        new ComposeStack(this, new ComposeStack.Props(
                envName,
                props.getRegion(),
                "/indigoeln/" + envName + "/compose",
                infraStack.getInstance(),
                infraStack.getEc2Role(),
                infraStack.getStorageBucket(),
                cognitoStack.getUserPool(),
                // The `combined` target: the base image only installs bingo and the extensions, so the
                // CREATE DATABASE statements for eln/keycloak/signature/sampleregistration live here.
                props.getPostgresImage(),
                // The `*-aws` images: long-running HTTP servers, run by docker-compose on the EC2 instance.
                // The `*-lambda` images are still built by CI but nothing deploys them any more.
                props.getElnAwsImage(),
                props.getReportsAwsImage(),
                props.getSignatureAwsImage(),
                props.getSampleRegistrationAwsImage()
        ));

        new CloudFrontStack(this, new CloudFrontStack.Props(
                envName,
                infraStack.getHostedZone(),
                infraStack.getVpc(),
                infraStack.getInstance(),
                infraStack.getEc2SecurityGroup(),
                props.getDomainName(),
                infraStack.getApiSecret(),
                cognitoStack.getUserPool(),
                cognitoStack.getUserPoolClient()
        ));
    }
}

#!/bin/bash
set -o errexit

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION=true

DEPLOY_STACK=$1

if [[ -z "$DEPLOY_STACK" ]]; then
  echo "Missing stack (possible options: indigoeln-build, indigoeln-sonarqube, or indigoeln-<environment> for each entry of \"environments\" in global.json)"
  exit 1
fi

cdk diff "$DEPLOY_STACK" --no-change-set --profile $AWS_PROFILE
read -p "Deploy? "
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
  cdk deploy "$DEPLOY_STACK" --progress events --require-approval never --method change-set --asset-parallelism false --profile $AWS_PROFILE -v
fi

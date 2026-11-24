# Indigo ELN

The Open-Source Chemistry Electronic Lab Notebook


# Sandbox

To evaluate Indigo ELN features without running it yourself, you can use the sandbox: 
https://indigo-eln.lifescience.opensource.epam.com/

Please contact indigoeln@epam.com to request access


# Installation

Indigo ELN can be run either in your own local or network machine, or in AWS cloud.

## Local Installation

The local docker-compose stack runs the full application — frontend, backend, PostgreSQL, and Keycloak — and is the recommended setup for local development. By default it pulls the released images from AWS Public Container Registry (`public.ecr.aws/m5k0g6n7/indigoeln/*`); see [Running your own build](#running-your-own-build) to run images built from source.

### Prerequisites

- Docker with Docker Compose v2 (`docker compose ...`)
- Java 25 (only if you want to build the backend from source)
- ~4 GB of free RAM

### Running on macOS

Docker Desktop is not required — [Colima](https://github.com/abiosoft/colima) works well as a Docker runtime. 
On **Apple Silicon**, next services (`postgres`, `eln-service`) bundle x86_64-only native libraries, so the VM must run **natively as `aarch64` with Rosetta** for amd64 translation.

```bash
brew install colima docker docker-compose
colima start --arch aarch64 --vz-rosetta --cpu 4 --memory 16 --disk 100
```

### Setup

```bash
git clone https://github.com/epam/IndigoELN.git
cd IndigoELN/deployment-compose
./deploy.sh
```
### Access

| URL | Purpose |
|---|---|
| `http://localhost` | Frontend (use this — port 80 via nginx) |
| `http://localhost:10020` | `eln-service` REST API |
| `http://localhost:8088` | Keycloak admin console (admin / admin) |

> **Important:** open the app at `http://localhost` (port 80), not `http://localhost:5173`. Port 5173 is the Vite dev server (`pnpm run dev`), whose proxy in `frontend/vite.config.ts` forwards `/api` calls to the EPAM-hosted dev backend; local Keycloak tokens will not validate there and you will see `401 Unauthorized` on every API call.

### Users and realm

The `indigo-eln` Keycloak realm — including users, roles, and clients — is provisioned declaratively from `deployment-compose/keycloak-config-cli/realm-config.json` on first start. Edit that file to add or change users.

Two test users are seeded out of the box:

| Username | Password |
|---|---|
| `admin` | `admin` |

Use to log in at `http://localhost` once the stack is up.

### Stopping

```bash
./stop.sh
```

### Running your own build

Every application image can be replaced through an environment variable: `POSTGRES_IMAGE`, `FRONTEND_IMAGE`, `ELN_SERVICE_IMAGE`, `REPORTS_SERVICE_IMAGE`, `SIGNATURE_SERVICE_IMAGE`, `SAMPLEREGISTRATION_SERVICE_IMAGE`.

Build the backend services from source (each produces an `indigoeln/<service>:built` image) and run them:

```bash
cd backend
./gradlew :eln:eln-service:assemble :reports:reports-service:assemble \
  :signature:signature-service:assemble :sampleregistration:sampleregistration-service:assemble
cd ../deployment-compose
ELN_SERVICE_IMAGE=indigoeln/eln-service:built \
REPORTS_SERVICE_IMAGE=indigoeln/reports-service:built \
SIGNATURE_SERVICE_IMAGE=indigoeln/signature-service:built \
SAMPLEREGISTRATION_SERVICE_IMAGE=indigoeln/sampleregistration-service:built \
  ./deploy.sh
```

The frontend inlines its Keycloak settings at build time, so build it with the ones the compose stack uses:

```bash
docker build -t indigoeln/frontend:built \
  --build-arg VITE_AUTH_PROVIDER=keycloak \
  --build-arg VITE_KEYCLOAK_URL=http://localhost:8088 \
  --build-arg VITE_KEYCLOAK_REALM=indigo-eln \
  --build-arg VITE_KEYCLOAK_CLIENT_ID=frontend-client \
  frontend
```

then add `FRONTEND_IMAGE=indigoeln/frontend:built` to the variables above.


## Installation on AWS

**NB**: Right now, the AWS deployment must go to the us-east-1 region (North Virginia): the stack creates the TLS certificate in its own region and attaches it to CloudFront, which only accepts certificates from us-east-1.
The application images are pulled from AWS Public Container Registry by default; you can copy them to your own ECR repository and point the `*Image` parameters (`elnAwsImage` etc.) at that repository instead.


### Prerequisites

- AWS CLI, with `AWS_PROFILE` set to the profile to deploy with (`deploy.sh` passes it to `cdk`), and the Session Manager plugin for connecting to the instance
- AWS CDK CLI (requires Node.js)
- Maven and JDK 17 (`deploy.sh` sets `JAVA_HOME=/usr/lib/jvm/java-17-openjdk`; adjust if yours lives elsewhere)
- An existing VPC and a Route 53 hosted zone; the application domain must belong to that zone, as the TLS certificate is validated through DNS

### Get the code

```bash
git clone https://github.com/epam/IndigoELN.git
cd IndigoELN/deployment-aws
```

### Configure

Copy `cdk.json.example` to `cdk.json`.

Copy `global.json.example` to `global.json` and edit it according to your environment. List the environments you want in `environments`.

For each environment listed there, copy `environment.json.example` to `<<environment-name>>.json` and edit it according to your environment. Every listed environment needs its file, because every CDK run loads all of them.

Remove the `//` comments from all these JSON files: they are not valid JSON and the deployment code rejects them.

The `sonar*` parameters in `global.json` are needed even if you never deploy the build and SonarQube stacks, since every CDK run synthesizes them too.

### Bootstrap CDK

Once per account and region:
```bash
cdk bootstrap aws://<<account>>/us-east-1 --template cdk-bootstrap.yaml
```
If you use `permissionBoundary`, add `--custom-permissions-boundary <<policy-name>>`.

### Deploy CDK stack

Run CDK deployment (stack-name is "indigoeln-" plus environment name):
```bash
./deploy.sh <<stack-name>>
```

After it runs successfully, update docker-compose deployment:

```bash
./deploy-compose.sh <<stack-name>>
```

### Set the admin password

The stack creates an `admin` user in Cognito without a usable password. Set one, either from AWS Console in browser or from command line:
```bash
USER_POOL_ID=$(aws ssm get-parameter --name /indigoeln/<<environment-name>>/compose-env \
  --query Parameter.Value --output text | sed -n 's/^ELN_COGNITO_USER_POOL_ID=//p')
aws cognito-idp admin-set-user-password --user-pool-id "$USER_POOL_ID" \
  --username admin --password '<<password>>' --permanent
```

### Validate installation and troubleshooting

- Make sure CloudFormation stack is deployed and all resources created without errors.

- Connect to the EC2 instance with SSM Session Manager (the instance accepts no inbound connections unless your own security groups allow them):

```bash
aws ssm start-session --target <<instance-id>>
```

- Make sure all docker containers are running:

```bash
cd /opt/indigoeln
sudo docker compose ps --all
sudo docker compose logs <<service>>
```

Container logs are also sent to the CloudWatch log group `/indigoeln/<<environment-name>>/compose`.

- Now you can log into the application at `https://<<domainName>>` (the `domainName` from `<<environment-name>>.json`) as `admin` with the password you set.

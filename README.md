# Indigo ELN

The Open-Source Chemistry Electronic Lab Notebook

> [!NOTE]
> Indigo ELN can be run [in AWS](#installation-on-aws) or [locally via Docker Compose](#local-installation).
> To evaluate its features without running it yourself, try the sandbox: https://indigo-eln.lifescience.opensource.epam.com/ — contact indigoeln@epam.com to request access.


## Rebuilt for the Way Chemists Work Today

We rebuilt Indigo ELN from scratch: new backend, new interface, new database. Every screen and every workflow was designed again with one question in mind: *how do we make the scientist's day easier?*

The result is the fastest, most capable and most enjoyable version of Indigo ELN we've ever released.

## 🧪 From sketch to registered sample, in one place

Draw your reaction in the built-in **Ketcher** editor. **Analyze RXN** matches each structure to real materials from Sample Registration, PubChem or your own materials. **Stoichiometry** is calculated as you go, with proper units and the significant figures you choose. When the product is ready, **record batches, import or export them as SDF, and register them** without leaving the experiment.

## ↩️ Work fearlessly

- **Undo and redo** any edit to an experiment. Mistakes are now just a click away from fixed.
- A full **audit log** and **version history** show who changed what, and when.
- **Edit together without conflict.** When colleagues work on the same experiment, their changes are compared and reconciled, never silently overwritten.

## ✍️ The full lifecycle, built in

Complete, **e-sign**, approve, reopen or repeat experiments, and produce a polished **PDF report** with one click.

## 🔍 Find anything, instantly

**Global Search** works across all your projects, notebooks and experiments. **Starred experiments**, status filters and breadcrumbs keep your current work close at hand.

## 👥 Share exactly what you mean to

Invite a colleague to a single experiment, and **Limited View** gives them access to that experiment and nothing more. **Admin**, **Can Edit** and **Can View** roles keep access clear at every level.

## 🔐 Ready for your organization

**Single Sign-On** works with **Keycloak** or **AWS Cognito**. A hardened, modern stack is built on Quarkus, Java 25, React 19 and PostgreSQL. You can deploy it on **AWS** or run it on your own machine with **a single command**.

## 🚀 Try it today

**Run it locally in minutes:**

```bash
git clone https://github.com/epam/IndigoELN.git
cd IndigoELN/deployment-compose
./deploy.sh
```

Then open `http://localhost` and sign in as `admin` / `admin`.

**Prefer not to install anything?** Try the [online sandbox](https://indigo-eln.lifescience.opensource.epam.com/). Email us to request access.

📖 New to Indigo ELN? The **User Manual** in `documentation/` walks you through everything.

## Coming from 2.x?

Version 3.0 is built on a completely new data store, so existing data needs to be migrated. We're happy to help: write to [indigoeln@epam.com](mailto:indigoeln@epam.com).

---

**Indigo ELN is open source.** Give it a try, tell us what you think, and help us shape what comes next. ⭐ Star the repo, open an issue, or just say hello at [indigoeln@epam.com](mailto:indigoeln@epam.com).

*Welcome to Indigo ELN 3.0. We can't wait to see what you discover with it.* 🧬


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

One test user is seeded out of the box:

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

Likewise for PostgreSQL (the `combined` target creates the application databases):

```bash
docker build -t indigoeln/postgres-combined:built --platform linux/amd64 --target combined postgres
```

then add `POSTGRES_IMAGE=indigoeln/postgres-combined:built`.


## Installation on AWS

**NB**: Right now, the AWS deployment must go to the us-east-1 region (North Virginia): the stack creates the TLS certificate in its own region and attaches it to CloudFront, which only accepts certificates from us-east-1.
The application images are pulled from AWS Public Container Registry by default; you can copy them to your own ECR repository and point the `*Image` parameters (`elnAwsImage` etc.) at that repository instead.


### Prerequisites

- AWS CLI, with `AWS_PROFILE` set to the profile to deploy with (`deploy.sh` passes it to `cdk`), and the Session Manager plugin for connecting to the instance
- AWS CDK CLI (requires Node.js)
- Maven and JDK 17 (see the `JAVA_HOME` note under [Deploy CDK stack](#deploy-cdk-stack))
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

**NB**: The CDK sources build with JDK 17 only; newer JDKs break Lombok. `deploy.sh` sets `JAVA_HOME=/usr/lib/jvm/java-17-openjdk`, whatever `JAVA_HOME` your shell has. If your JDK 17 is installed elsewhere (e.g. `/usr/lib/jvm/java-17-openjdk-amd64` on Debian/Ubuntu, or `$(/usr/libexec/java_home -v 17)` on macOS), edit that line in `deploy.sh` first.

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

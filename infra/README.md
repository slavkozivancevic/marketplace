# CI/CD infrastructure (`infra/`)

AWS-native CD for the marketplace app, authored ahead of AWS access (ROADMAP
#31). Nothing here is deployed yet - this is the hand-deployable scaffold.

## What's here

- **`cicd.cfn.yml`** - CloudFormation stack:
  - GitHub **OIDC provider** + a scoped **preview-deploy role** (assumed by the
    `preview.yml` / `preview-teardown.yml` GitHub Actions, no static keys).
  - **CodeBuild** project that runs [`../buildspec.yml`](../buildspec.yml)
    (`sst deploy`).
  - **CodePipeline**: `Source` (GitHub via **CodeConnections**) ->
    `DeployStaging` -> `ApproveProduction` (manual) -> `DeployProduction`.

> Note: standalone **AWS CodeStar** is retired. We use **AWS CodeConnections**
> (the renamed "CodeStar Connections") for the GitHub source. The CodePipeline
> source action provider is still the literal `CodeStarSourceConnection` - AWS
> kept that identifier after the rename.

## One-time bootstrap

1. **Create a GitHub connection** (console): Developer Tools -> Settings ->
   Connections -> create a **CodeConnections** GitHub connection and
   **authorize** it. Copy its ARN (`arn:aws:codeconnections:...`).
2. **Deploy the stack:**
   ```sh
   aws cloudformation deploy \
     --template-file infra/cicd.cfn.yml \
     --stack-name marketplace-cicd \
     --capabilities CAPABILITY_NAMED_IAM \
     --parameter-overrides \
       GitHubOrg=slavkozivancevic GitHubRepo=marketplace \
       CodeConnectionArn=<arn-from-step-1>
   ```
   If the `token.actions.githubusercontent.com` OIDC provider already exists in
   the account, add `CreateOidcProvider=false`.
3. **Wire GitHub Actions:** take the `PreviewDeployRoleArn` stack output and set
   it as the **`AWS_PREVIEW_ROLE_ARN`** repository *variable* (Settings ->
   Secrets and variables -> Actions -> Variables). `preview.yml` reads it.

## Open decisions (resolve at deploy time)

- **Deploy-role scope.** The preview + CodeBuild roles use `AdministratorAccess`
  because `sst deploy` (Pulumi) creates many resource types. Scope down, or run
  deploys in a dedicated sandbox account, before real production traffic.
- **Canary + rollback (DEPLOYMENT.md §5).** `sst deploy` already updates the
  Lambda directly, so there is no separate CodeDeploy step in the pipeline as
  written. To get the alias-canary + CloudWatch-alarm auto-rollback described in
  the strategy, pick one:
  1. Keep `sst deploy` and rely on **CloudFront** for instant rollback + SST
     redeploy-previous (simplest, $0), **or**
  2. Add **CodeDeploy** on the OpenNext server function's alias via an SST
     `transform` on the `Web` component, and let CodeDeploy shift traffic
     (closest to the "serverless blue/green" goal - wire it when iterating on
     AWS, since it can't be validated locally).
- **Preview databases.** Each `pr-<n>` stage needs a DB - a Neon branch per PR
  (throwaway) is the cheapest; see the note in `preview.yml`.

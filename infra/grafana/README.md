# Grafana dashboards

Dashboards live here as JSON so they are reviewable and restorable. A dashboard
that exists only inside Grafana is in the same position as infrastructure with no
IaC: it works until someone deletes it.

Grafana Cloud (free tier) is the view layer only. It stores nothing and reads
CloudWatch through a scoped, read-only IAM role created in `sst.config.ts`
(`GrafanaCloudWatchReader`). See ROADMAP #23 for why CloudWatch stays the source
of truth: CodeDeploy can gate a rollback on a CloudWatch alarm and on nothing
else.

## Import

Grafana -> Dashboards -> New -> Import -> paste the file's contents -> pick the
`cloudwatch` data source when prompted -> Import.

## Export after editing in the UI

Editing in the browser is fine - just bring the change back:

Dashboard -> Export -> Export as JSON -> **turn OFF** "Export for sharing
externally" -> copy -> overwrite the file here -> commit.

That toggle matters. With it on, Grafana strips the data source into an
`__inputs` placeholder and the file stops matching what is deployed.

## The two hardcoded names, and why

`serverFn` (a hidden dashboard variable) and the log group ARN in the "Routes"
panel both contain a random suffix, and **the two suffixes differ**:

```
function   marketplace-staging-WebServerEucentral1Function-hertbxvr
log group  /aws/lambda/marketplace-staging-WebServerEucentral1Function-bbmwmtzw
```

Pulumi names every resource independently, so the log group is *not*
`/aws/lambda/<function-name>` - the usual assumption is wrong here. Both values
change if the underlying resource is ever replaced (not on a normal code
deploy). The symptom is a panel that goes empty while the rest keep working.

To refresh them:

```bash
aws lambda list-functions --region eu-central-1 \
  --query "Functions[?contains(FunctionName,'marketplace-staging-WebServer')].FunctionName" --output text

aws logs describe-log-groups --region eu-central-1 \
  --query "logGroups[?contains(logGroupName,'marketplace-staging-WebServer')].[logGroupName,arn]" --output text
```

`serverFn` is edited under Dashboard settings -> Variables; the log group is in
the Routes panel's query.

## Panels

| Panel | Source | Why it is built that way |
|---|---|---|
| Request latency p50/p95/p99 | metrics | Log scale - one cold start on a linear axis flattens normal traffic to zero |
| Total vs database (p95) | metrics | The gap between the lines is everything that is not the database |
| Queries per request | metrics | Maximum, not average: one request with hundreds of queries is the bug |
| Failures | metrics | Bars, not lines - a line between two failures implies failures that never happened |
| Lambda cold start vs duration | metrics (AWS/Lambda, free) | Covers the blind spot: `observeRequest` starts timing *after* Lambda init |
| Database wake-ups | metrics | Neon resuming a suspended compute - see below |
| Routes | Logs Insights | `route` is deliberately not a metric dimension - each value would cost $0.30/month |

## Reading these numbers on a scale-to-zero database

Two panels will look alarming and are not.

**Database wake-ups.** Neon's Free plan suspends the compute after 5 minutes
idle. The timeout cannot be changed, and keeping the compute awake would spend
the 100 CU-hour monthly allowance in roughly three weeks - after which Neon
suspends the database until the next billing period. So scale-to-zero is a fixed
property of this environment, not an oversight, and the first request after a
quiet spell waits seconds for the resume.

Prisma's timer bills that entire wait to whichever query happened to run first.
Before the split, staging reported `ProductTranslation.findUnique` with a
*minimum* of 796ms and `Brand.findMany` peaking at 3.3s - impossible figures for
an indexed lookup and a small table, and enough to make the slow-query signal
meaningless. Wake-ups are now counted separately
(`src/lib/observability/idleGap.ts`), so **`slow queries` means a query worth
optimising and nothing else**.

**"Where the time goes" showing ~96% database.** True, but read it alongside
wake-ups: much of that is resume latency rather than query execution. On a
compute that never suspends the two panels tell very different stories.

`pg_stat_statements` is enabled but is of limited use here for the same reason -
its statistics live in shared memory and reset on every compute restart, so on
staging it rarely holds more than the last few minutes of activity.
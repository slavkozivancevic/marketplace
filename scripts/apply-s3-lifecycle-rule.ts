/**
 * Applies the S3 bucket lifecycle rule that auto-deletes orphan uploads.
 *
 * Pending product images carry an object tag `lifecycle=pending`. They are
 * tagged in services/imageProcessor.ts on upload, and the tag is removed in
 * features/products/db/products.ts (syncProductImages) when a product is
 * saved. This rule sweeps anything still tagged after 1 day — covering the
 * case where a user uploads but abandons the form.
 *
 * Idempotent: re-running replaces the bucket's lifecycle config with the
 * same single rule. Run after bucket creation or whenever the rule drifts.
 *
 *   npx tsx scripts/apply-s3-lifecycle-rule.ts
 */

import "dotenv/config";
import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

if (!BUCKET || !REGION) {
  console.error("Missing S3_BUCKET_NAME or AWS_REGION in environment");
  process.exit(1);
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  await s3.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: BUCKET,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "expire-pending-uploads",
            Status: "Enabled",
            Filter: {
              Tag: { Key: "lifecycle", Value: "pending" },
            },
            Expiration: { Days: 1 },
          },
          // Separate rule: S3 forbids combining a Tag filter with
          // AbortIncompleteMultipartUpload, so multipart cleanup runs
          // bucket-wide on its own.
          {
            ID: "abort-stale-multiparts",
            Status: "Enabled",
            Filter: {},
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          },
        ],
      },
    }),
  );

  console.log(`Applied lifecycle rules to ${BUCKET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
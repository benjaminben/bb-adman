// SPEC 6 [1.12], 6.5: builds the S3 client with every setting given here, so the AWS library
// fills nothing from AWS_* variables or from ~/.aws files: explicit keys (from ctx.secret),
// region, endpoint, one attempt, no FIPS or dual-stack, no ARN region, no S3 Express session,
// fixed checksum and defaults modes. Requests go through the pinned-host handler.
// Any error while building is a ProviderFailure of kind other.
import { S3Client } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import type { AdapterContext } from '../types'
import { failureFromS3Error, s3Failure } from './failure'
import {
  isBucketName,
  isRegionName,
  pinnedHandler,
  s3Hosts,
  type PinnableHandler,
} from './pinned-host'

// Socket limits for the real HTTP handler (milliseconds).
const SOCKET_LIMITS = { connectionTimeout: 10_000, requestTimeout: 60_000 }

export type S3Setup = { client: S3Client; bucket: string; root: string; keys: string[] }

function rootOf(prefix: string): string {
  return prefix.replace(/^\/+|\/+$/g, '')
}

function build(ctx: AdapterContext, handler: PinnableHandler | undefined, keys: string[]): S3Setup {
  const settings = ctx.settings().storage.s3
  if (!settings || settings.bucket === '') throw s3Failure('other', 'S3 storage is not set up', [])
  const { bucket, region } = settings
  if (!isRegionName(region)) throw s3Failure('other', 'S3 region is not a region name', [])
  if (!isBucketName(bucket)) throw s3Failure('other', 'S3 bucket is not a bucket name', [])
  const accessKeyId = ctx.secret('s3.accessKeyId')
  keys.push(accessKeyId)
  const secretAccessKey = ctx.secret('s3.secretAccessKey')
  keys.push(secretAccessKey)
  const inner = handler ?? new NodeHttpHandler(SOCKET_LIMITS)
  const client = new S3Client({
    region,
    endpoint: `https://s3.${region}.amazonaws.com`,
    ignoreConfiguredEndpointUrls: true,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 1,
    retryMode: 'standard',
    defaultsMode: 'standard',
    useFipsEndpoint: false,
    useDualstackEndpoint: false,
    useArnRegion: false,
    forcePathStyle: false,
    disableS3ExpressSessionAuth: true,
    followRegionRedirects: false,
    requestChecksumCalculation: 'WHEN_SUPPORTED',
    responseChecksumValidation: 'WHEN_SUPPORTED',
    authSchemePreference: ['sigv4'],
    sigv4aSigningRegionSet: [region],
    userAgentAppId: 'adman',
    requestHandler: pinnedHandler(inner, s3Hosts(bucket, region)),
  })
  return { client, bucket, root: rootOf(settings.prefix), keys }
}

// `handler` replaces the real HTTP handler in tests; the pin still wraps it.
export function buildS3Client(ctx: AdapterContext, handler?: PinnableHandler): S3Setup {
  const keys: string[] = []
  try {
    return build(ctx, handler, keys)
  } catch (error) {
    throw failureFromS3Error(error, keys)
  }
}

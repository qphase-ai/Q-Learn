import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { CmsUsers } from './collections/CmsUsers'
import { Curriculums } from './collections/Curriculums'
import { Lessons } from './collections/Lessons'
import { Levels } from './collections/Levels'
import { Media } from './collections/Media'
import { Modules } from './collections/Modules'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Supabase Storage (S3-compatible). Off unless a bucket is configured; media
// then falls back to local disk, which is for development only.
const s3Enabled = Boolean(process.env.S3_BUCKET)

export default buildConfig({
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || '',
  admin: {
    user: CmsUsers.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' — Q-Learn CMS' },
  },
  collections: [Curriculums, Levels, Modules, Lessons, Media, CmsUsers],
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    // Payload lives in its own schema; Alembic owns `public`. Neither tool
    // ever migrates the other's schema.
    schemaName: 'payload',
    // A lesson's blocks are one jsonb column, not a table per block type.
    blocksAsJSON: true,
    pool: { connectionString: process.env.PAYLOAD_DATABASE_URL || '' },
    // Schema changes always go through committed migrations (pnpm
    // migrate:create), never dev-mode push against the shared database.
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
    prodMigrations: migrations,
  }),
  sharp,
  plugins: [
    s3Storage({
      enabled: s3Enabled,
      alwaysInsertFields: true,
      collections: { media: { signedDownloads: true } },
      bucket: process.env.S3_BUCKET || '',
      config: {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],
})

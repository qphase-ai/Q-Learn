import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Payload only creates its schema when it creates the whole database; on
  // the shared Supabase database the `payload` schema must be created here.
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "payload";`)
  await db.execute(sql`
   CREATE TYPE "payload"."enum_curriculums_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__curriculums_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_levels_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__levels_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_modules_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__modules_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_lessons_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');
  CREATE TYPE "payload"."enum_lessons_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__lessons_v_version_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');
  CREATE TYPE "payload"."enum__lessons_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_cms_users_role" AS ENUM('author', 'publisher');
  CREATE TABLE "payload"."curriculums" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_curriculums_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_curriculums_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__curriculums_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."levels_objectives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."levels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"curriculum_id" integer,
  	"level_number" numeric,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"estimated_hours" numeric,
  	"badge" varchar,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_levels_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_levels_v_version_objectives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_levels_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_curriculum_id" integer,
  	"version_level_number" numeric,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_estimated_hours" numeric,
  	"version_badge" varchar,
  	"version_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__levels_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."modules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"level_id" integer,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_modules_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_modules_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_level_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__modules_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."lessons_objectives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "payload"."lessons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"module_id" integer,
  	"title" varchar,
  	"slug" varchar,
  	"description" varchar,
  	"estimated_time" numeric,
  	"difficulty" "payload"."enum_lessons_difficulty" DEFAULT 'beginner',
  	"order" numeric DEFAULT 0,
  	"blocks" jsonb,
  	"content_ref_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "payload"."enum_lessons_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_lessons_v_version_objectives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload"."_lessons_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_module_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_description" varchar,
  	"version_estimated_time" numeric,
  	"version_difficulty" "payload"."enum__lessons_v_version_difficulty" DEFAULT 'beginner',
  	"version_order" numeric DEFAULT 0,
  	"version_blocks" jsonb,
  	"version_content_ref_id" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__lessons_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"prefix" varchar DEFAULT '',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "payload"."cms_users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "payload"."cms_users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "payload"."enum_cms_users_role" DEFAULT 'author' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"curriculums_id" integer,
  	"levels_id" integer,
  	"modules_id" integer,
  	"lessons_id" integer,
  	"media_id" integer,
  	"cms_users_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."_curriculums_v" ADD CONSTRAINT "_curriculums_v_parent_id_curriculums_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."curriculums"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."levels_objectives" ADD CONSTRAINT "levels_objectives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."levels" ADD CONSTRAINT "levels_curriculum_id_curriculums_id_fk" FOREIGN KEY ("curriculum_id") REFERENCES "payload"."curriculums"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_levels_v_version_objectives" ADD CONSTRAINT "_levels_v_version_objectives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_levels_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_levels_v" ADD CONSTRAINT "_levels_v_parent_id_levels_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_levels_v" ADD CONSTRAINT "_levels_v_version_curriculum_id_curriculums_id_fk" FOREIGN KEY ("version_curriculum_id") REFERENCES "payload"."curriculums"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."modules" ADD CONSTRAINT "modules_level_id_levels_id_fk" FOREIGN KEY ("level_id") REFERENCES "payload"."levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_modules_v" ADD CONSTRAINT "_modules_v_parent_id_modules_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_modules_v" ADD CONSTRAINT "_modules_v_version_level_id_levels_id_fk" FOREIGN KEY ("version_level_id") REFERENCES "payload"."levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."lessons_objectives" ADD CONSTRAINT "lessons_objectives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "payload"."modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v_version_objectives" ADD CONSTRAINT "_lessons_v_version_objectives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."_lessons_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v" ADD CONSTRAINT "_lessons_v_parent_id_lessons_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."_lessons_v" ADD CONSTRAINT "_lessons_v_version_module_id_modules_id_fk" FOREIGN KEY ("version_module_id") REFERENCES "payload"."modules"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_users_sessions" ADD CONSTRAINT "cms_users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_curriculums_fk" FOREIGN KEY ("curriculums_id") REFERENCES "payload"."curriculums"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_levels_fk" FOREIGN KEY ("levels_id") REFERENCES "payload"."levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_modules_fk" FOREIGN KEY ("modules_id") REFERENCES "payload"."modules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_lessons_fk" FOREIGN KEY ("lessons_id") REFERENCES "payload"."lessons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_cms_users_fk" FOREIGN KEY ("cms_users_id") REFERENCES "payload"."cms_users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "curriculums_slug_idx" ON "payload"."curriculums" USING btree ("slug");
  CREATE INDEX "curriculums_updated_at_idx" ON "payload"."curriculums" USING btree ("updated_at");
  CREATE INDEX "curriculums_created_at_idx" ON "payload"."curriculums" USING btree ("created_at");
  CREATE INDEX "curriculums__status_idx" ON "payload"."curriculums" USING btree ("_status");
  CREATE INDEX "_curriculums_v_parent_idx" ON "payload"."_curriculums_v" USING btree ("parent_id");
  CREATE INDEX "_curriculums_v_version_version_slug_idx" ON "payload"."_curriculums_v" USING btree ("version_slug");
  CREATE INDEX "_curriculums_v_version_version_updated_at_idx" ON "payload"."_curriculums_v" USING btree ("version_updated_at");
  CREATE INDEX "_curriculums_v_version_version_created_at_idx" ON "payload"."_curriculums_v" USING btree ("version_created_at");
  CREATE INDEX "_curriculums_v_version_version__status_idx" ON "payload"."_curriculums_v" USING btree ("version__status");
  CREATE INDEX "_curriculums_v_created_at_idx" ON "payload"."_curriculums_v" USING btree ("created_at");
  CREATE INDEX "_curriculums_v_updated_at_idx" ON "payload"."_curriculums_v" USING btree ("updated_at");
  CREATE INDEX "_curriculums_v_latest_idx" ON "payload"."_curriculums_v" USING btree ("latest");
  CREATE INDEX "levels_objectives_order_idx" ON "payload"."levels_objectives" USING btree ("_order");
  CREATE INDEX "levels_objectives_parent_id_idx" ON "payload"."levels_objectives" USING btree ("_parent_id");
  CREATE INDEX "levels_curriculum_idx" ON "payload"."levels" USING btree ("curriculum_id");
  CREATE INDEX "levels_level_number_idx" ON "payload"."levels" USING btree ("level_number");
  CREATE INDEX "levels_slug_idx" ON "payload"."levels" USING btree ("slug");
  CREATE INDEX "levels_updated_at_idx" ON "payload"."levels" USING btree ("updated_at");
  CREATE INDEX "levels_created_at_idx" ON "payload"."levels" USING btree ("created_at");
  CREATE INDEX "levels__status_idx" ON "payload"."levels" USING btree ("_status");
  CREATE INDEX "_levels_v_version_objectives_order_idx" ON "payload"."_levels_v_version_objectives" USING btree ("_order");
  CREATE INDEX "_levels_v_version_objectives_parent_id_idx" ON "payload"."_levels_v_version_objectives" USING btree ("_parent_id");
  CREATE INDEX "_levels_v_parent_idx" ON "payload"."_levels_v" USING btree ("parent_id");
  CREATE INDEX "_levels_v_version_version_curriculum_idx" ON "payload"."_levels_v" USING btree ("version_curriculum_id");
  CREATE INDEX "_levels_v_version_version_level_number_idx" ON "payload"."_levels_v" USING btree ("version_level_number");
  CREATE INDEX "_levels_v_version_version_slug_idx" ON "payload"."_levels_v" USING btree ("version_slug");
  CREATE INDEX "_levels_v_version_version_updated_at_idx" ON "payload"."_levels_v" USING btree ("version_updated_at");
  CREATE INDEX "_levels_v_version_version_created_at_idx" ON "payload"."_levels_v" USING btree ("version_created_at");
  CREATE INDEX "_levels_v_version_version__status_idx" ON "payload"."_levels_v" USING btree ("version__status");
  CREATE INDEX "_levels_v_created_at_idx" ON "payload"."_levels_v" USING btree ("created_at");
  CREATE INDEX "_levels_v_updated_at_idx" ON "payload"."_levels_v" USING btree ("updated_at");
  CREATE INDEX "_levels_v_latest_idx" ON "payload"."_levels_v" USING btree ("latest");
  CREATE INDEX "modules_level_idx" ON "payload"."modules" USING btree ("level_id");
  CREATE INDEX "modules_slug_idx" ON "payload"."modules" USING btree ("slug");
  CREATE INDEX "modules_updated_at_idx" ON "payload"."modules" USING btree ("updated_at");
  CREATE INDEX "modules_created_at_idx" ON "payload"."modules" USING btree ("created_at");
  CREATE INDEX "modules__status_idx" ON "payload"."modules" USING btree ("_status");
  CREATE INDEX "_modules_v_parent_idx" ON "payload"."_modules_v" USING btree ("parent_id");
  CREATE INDEX "_modules_v_version_version_level_idx" ON "payload"."_modules_v" USING btree ("version_level_id");
  CREATE INDEX "_modules_v_version_version_slug_idx" ON "payload"."_modules_v" USING btree ("version_slug");
  CREATE INDEX "_modules_v_version_version_updated_at_idx" ON "payload"."_modules_v" USING btree ("version_updated_at");
  CREATE INDEX "_modules_v_version_version_created_at_idx" ON "payload"."_modules_v" USING btree ("version_created_at");
  CREATE INDEX "_modules_v_version_version__status_idx" ON "payload"."_modules_v" USING btree ("version__status");
  CREATE INDEX "_modules_v_created_at_idx" ON "payload"."_modules_v" USING btree ("created_at");
  CREATE INDEX "_modules_v_updated_at_idx" ON "payload"."_modules_v" USING btree ("updated_at");
  CREATE INDEX "_modules_v_latest_idx" ON "payload"."_modules_v" USING btree ("latest");
  CREATE INDEX "lessons_objectives_order_idx" ON "payload"."lessons_objectives" USING btree ("_order");
  CREATE INDEX "lessons_objectives_parent_id_idx" ON "payload"."lessons_objectives" USING btree ("_parent_id");
  CREATE INDEX "lessons_module_idx" ON "payload"."lessons" USING btree ("module_id");
  CREATE INDEX "lessons_slug_idx" ON "payload"."lessons" USING btree ("slug");
  CREATE INDEX "lessons_content_ref_id_idx" ON "payload"."lessons" USING btree ("content_ref_id");
  CREATE INDEX "lessons_updated_at_idx" ON "payload"."lessons" USING btree ("updated_at");
  CREATE INDEX "lessons_created_at_idx" ON "payload"."lessons" USING btree ("created_at");
  CREATE INDEX "lessons__status_idx" ON "payload"."lessons" USING btree ("_status");
  CREATE INDEX "_lessons_v_version_objectives_order_idx" ON "payload"."_lessons_v_version_objectives" USING btree ("_order");
  CREATE INDEX "_lessons_v_version_objectives_parent_id_idx" ON "payload"."_lessons_v_version_objectives" USING btree ("_parent_id");
  CREATE INDEX "_lessons_v_parent_idx" ON "payload"."_lessons_v" USING btree ("parent_id");
  CREATE INDEX "_lessons_v_version_version_module_idx" ON "payload"."_lessons_v" USING btree ("version_module_id");
  CREATE INDEX "_lessons_v_version_version_slug_idx" ON "payload"."_lessons_v" USING btree ("version_slug");
  CREATE INDEX "_lessons_v_version_version_content_ref_id_idx" ON "payload"."_lessons_v" USING btree ("version_content_ref_id");
  CREATE INDEX "_lessons_v_version_version_updated_at_idx" ON "payload"."_lessons_v" USING btree ("version_updated_at");
  CREATE INDEX "_lessons_v_version_version_created_at_idx" ON "payload"."_lessons_v" USING btree ("version_created_at");
  CREATE INDEX "_lessons_v_version_version__status_idx" ON "payload"."_lessons_v" USING btree ("version__status");
  CREATE INDEX "_lessons_v_created_at_idx" ON "payload"."_lessons_v" USING btree ("created_at");
  CREATE INDEX "_lessons_v_updated_at_idx" ON "payload"."_lessons_v" USING btree ("updated_at");
  CREATE INDEX "_lessons_v_latest_idx" ON "payload"."_lessons_v" USING btree ("latest");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "cms_users_sessions_order_idx" ON "payload"."cms_users_sessions" USING btree ("_order");
  CREATE INDEX "cms_users_sessions_parent_id_idx" ON "payload"."cms_users_sessions" USING btree ("_parent_id");
  CREATE INDEX "cms_users_updated_at_idx" ON "payload"."cms_users" USING btree ("updated_at");
  CREATE INDEX "cms_users_created_at_idx" ON "payload"."cms_users" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_users_email_idx" ON "payload"."cms_users" USING btree ("email");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_curriculums_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("curriculums_id");
  CREATE INDEX "payload_locked_documents_rels_levels_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("levels_id");
  CREATE INDEX "payload_locked_documents_rels_modules_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("modules_id");
  CREATE INDEX "payload_locked_documents_rels_lessons_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("lessons_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_cms_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_cms_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("cms_users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."curriculums" CASCADE;
  DROP TABLE "payload"."_curriculums_v" CASCADE;
  DROP TABLE "payload"."levels_objectives" CASCADE;
  DROP TABLE "payload"."levels" CASCADE;
  DROP TABLE "payload"."_levels_v_version_objectives" CASCADE;
  DROP TABLE "payload"."_levels_v" CASCADE;
  DROP TABLE "payload"."modules" CASCADE;
  DROP TABLE "payload"."_modules_v" CASCADE;
  DROP TABLE "payload"."lessons_objectives" CASCADE;
  DROP TABLE "payload"."lessons" CASCADE;
  DROP TABLE "payload"."_lessons_v_version_objectives" CASCADE;
  DROP TABLE "payload"."_lessons_v" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."cms_users_sessions" CASCADE;
  DROP TABLE "payload"."cms_users" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TYPE "payload"."enum_curriculums_status";
  DROP TYPE "payload"."enum__curriculums_v_version_status";
  DROP TYPE "payload"."enum_levels_status";
  DROP TYPE "payload"."enum__levels_v_version_status";
  DROP TYPE "payload"."enum_modules_status";
  DROP TYPE "payload"."enum__modules_v_version_status";
  DROP TYPE "payload"."enum_lessons_difficulty";
  DROP TYPE "payload"."enum_lessons_status";
  DROP TYPE "payload"."enum__lessons_v_version_difficulty";
  DROP TYPE "payload"."enum__lessons_v_version_status";
  DROP TYPE "payload"."enum_cms_users_role";`)
}

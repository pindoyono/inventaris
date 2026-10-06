CREATE TYPE "public"."distribution_mode" AS ENUM('LENGKAP', 'RINGKAS');--> statement-breakpoint
CREATE TYPE "public"."school_level" AS ENUM('SD', 'SMP', 'SMA', 'SMK', 'SLB');--> statement-breakpoint
CREATE TYPE "public"."school_status" AS ENUM('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'KEPSEK', 'VERIFIKATOR', 'PETUGAS', 'PENGUSUL', 'PEMINJAM');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bmd_codes" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"level" smallint NOT NULL,
	"name" text NOT NULL,
	"parent_code" varchar(32),
	"class" varchar(12),
	"selectable" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite_bmd_codes" (
	"school_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	CONSTRAINT "favorite_bmd_codes_school_id_code_pk" PRIMARY KEY("school_id","code")
);
--> statement-breakpoint
CREATE TABLE "funding_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"funding_source_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_bmd_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"parent_code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"decree_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "platform_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"school_id" uuid,
	"detail" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"code" varchar(5) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" smallint NOT NULL,
	"parent_code" varchar(5)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"building_id" uuid,
	"unit_id" uuid,
	"name" text NOT NULL,
	"code" varchar(20),
	"floor" text,
	"pic_name" text,
	"pic_nip" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_settings" (
	"school_id" uuid PRIMARY KEY NOT NULL,
	"pemda_name" text,
	"dinas_name" text,
	"address_full" text,
	"logo_pemda_file" text,
	"logo_school_file" text,
	"kepsek_name" text,
	"kepsek_nip" text,
	"pengurus_name" text,
	"pengurus_nip" text,
	"pengguna_name" text,
	"pengguna_nip" text,
	"kode_pengguna" varchar(6),
	"kode_kuasa_pengguna" varchar(5),
	"kode_sub_kuasa" varchar(5) DEFAULT '00000' NOT NULL,
	"capitalization" jsonb DEFAULT '{"default":2000000}'::jsonb NOT NULL,
	"approval_levels" smallint DEFAULT 2 NOT NULL,
	"student_accounts" boolean DEFAULT false NOT NULL,
	"distribution_mode" "distribution_mode" DEFAULT 'RINGKAS' NOT NULL,
	"loan_default_days" smallint DEFAULT 1 NOT NULL,
	"unit_label" text DEFAULT 'Unit' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"npsn" char(8) NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"level" "school_level" NOT NULL,
	"province_code" varchar(2) NOT NULL,
	"regency_code" varchar(5) NOT NULL,
	"address" text,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text,
	"ownership_code" char(2) NOT NULL,
	"status" "school_status" DEFAULT 'PENDING' NOT NULL,
	"status_note" text,
	"approved_at" timestamp with time zone,
	"setup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(30) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "user_units" (
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	CONSTRAINT "user_units_user_id_unit_id_pk" PRIMARY KEY("user_id","unit_id")
);
--> statement-breakpoint
CREATE TABLE "user_warehouses" (
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	CONSTRAINT "user_warehouses_user_id_warehouse_id_pk" PRIMARY KEY("user_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"username" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"nip" varchar(30),
	"email" text,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text,
	"npwp" varchar(25),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"room_id" uuid,
	"unit_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_bmd_codes" ADD CONSTRAINT "favorite_bmd_codes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_components" ADD CONSTRAINT "funding_components_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_components" ADD CONSTRAINT "funding_components_funding_source_id_funding_sources_id_fk" FOREIGN KEY ("funding_source_id") REFERENCES "public"."funding_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_sources" ADD CONSTRAINT "funding_sources_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_bmd_codes" ADD CONSTRAINT "local_bmd_codes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_bmd_codes" ADD CONSTRAINT "local_bmd_codes_parent_code_bmd_codes_code_fk" FOREIGN KEY ("parent_code") REFERENCES "public"."bmd_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_logs" ADD CONSTRAINT "platform_logs_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_logs" ADD CONSTRAINT "platform_logs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_province_code_regions_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_regency_code_regions_code_fk" FOREIGN KEY ("regency_code") REFERENCES "public"."regions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uoms" ADD CONSTRAINT "uoms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_school_created_idx" ON "activity_logs" USING btree ("school_id","created_at");--> statement-breakpoint
CREATE INDEX "bmd_codes_parent_idx" ON "bmd_codes" USING btree ("parent_code");--> statement-breakpoint
CREATE UNIQUE INDEX "buildings_school_name_key" ON "buildings" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_components_source_name_key" ON "funding_components" USING btree ("funding_source_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "funding_sources_school_code_key" ON "funding_sources" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "local_bmd_codes_school_code_key" ON "local_bmd_codes" USING btree ("school_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_school_name_key" ON "rooms" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "schools_npsn_key" ON "schools" USING btree ("npsn");--> statement-breakpoint
CREATE INDEX "schools_status_idx" ON "schools" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "units_school_name_key" ON "units" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uoms_school_name_key" ON "uoms" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_school_username_key" ON "users" USING btree ("school_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_school_name_key" ON "vendors" USING btree ("school_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_school_name_key" ON "warehouses" USING btree ("school_id","name");
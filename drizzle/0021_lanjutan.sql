CREATE TYPE "public"."asset_change_kind" AS ENUM('REKLASIFIKASI', 'KOREKSI');--> statement-breakpoint
CREATE TYPE "public"."atr_follow_up" AS ENUM('PEMINDAHTANGANAN', 'PENGALIHAN_STATUS');--> statement-breakpoint
CREATE TYPE "public"."construction_kind" AS ENUM('KDP', 'ATR');--> statement-breakpoint
CREATE TYPE "public"."construction_status" AS ENUM('BERJALAN', 'DIHENTIKAN', 'SELESAI');--> statement-breakpoint
CREATE TYPE "public"."transfer_form" AS ENUM('PENJUALAN', 'TUKAR_MENUKAR', 'HIBAH', 'PENYERTAAN_MODAL');--> statement-breakpoint
CREATE TYPE "public"."utilization_form" AS ENUM('SEWA', 'PINJAM_PAKAI', 'BGS_BSG', 'KSP', 'KSPI');--> statement-breakpoint
CREATE TYPE "public"."utilization_kind" AS ENUM('PEMANFAATAN', 'PENGGUNAAN_SEMENTARA', 'OPERASIONAL_PIHAK_LAIN');--> statement-breakpoint
CREATE TYPE "public"."utilization_status" AS ENUM('RENCANA', 'DISETUJUI', 'BERJALAN', 'SELESAI', 'DITOLAK', 'DIBATALKAN');--> statement-breakpoint
CREATE TYPE "public"."value_change_kind" AS ENUM('PEMBAYARAN_KDP', 'KAPITALISASI', 'KOREKSI');--> statement-breakpoint
CREATE TABLE "asset_changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" "asset_change_kind" NOT NULL,
	"date" date NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"reason" text NOT NULL,
	"doc_no" text,
	"inventory_line_id" uuid,
	"created_by" uuid,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "asset_value_changes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" "value_change_kind" NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"maintenance_id" uuid,
	"doc_no" text,
	"note" text,
	"created_by" uuid,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "constructions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" "construction_kind" NOT NULL,
	"asset_id" uuid NOT NULL,
	"status" "construction_status" DEFAULT 'BERJALAN' NOT NULL,
	"owner_name" text,
	"contract_no" text,
	"contract_date" date,
	"vendor_id" uuid,
	"contract_value" numeric(16, 2) DEFAULT '0' NOT NULL,
	"start_date" date NOT NULL,
	"target_date" date,
	"progress" smallint DEFAULT 0 NOT NULL,
	"stop_reason" text,
	"finished_date" date,
	"bast_no" text,
	"atr_follow_up" "atr_follow_up",
	"note" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constructions_progress_check" CHECK ("constructions"."progress" between 0 and 100),
	CONSTRAINT "constructions_value_check" CHECK ("constructions"."contract_value" >= 0)
);--> statement-breakpoint
CREATE TABLE "utilization_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"utilization_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"portion" text
);--> statement-breakpoint
CREATE TABLE "utilizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" "utilization_kind" NOT NULL,
	"form" "utilization_form",
	"status" "utilization_status" DEFAULT 'RENCANA' NOT NULL,
	"plan_year" smallint NOT NULL,
	"partner" text,
	"purpose" text NOT NULL,
	"term" text,
	"without_approval" boolean DEFAULT false NOT NULL,
	"approval_no" text,
	"approval_date" date,
	"agreement_no" text,
	"agreement_date" date,
	"start_date" date,
	"end_date" date,
	"ended_date" date,
	"contribution" numeric(16, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"last_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilizations_form_check" CHECK (("utilizations"."kind" = 'PEMANFAATAN') = ("utilizations"."form" is not null)),
	CONSTRAINT "utilizations_contribution_check" CHECK ("utilizations"."contribution" >= 0)
);--> statement-breakpoint
ALTER TABLE "asset_inventory_lines" ADD COLUMN "follow_up" "asset_change_kind";--> statement-breakpoint
ALTER TABLE "asset_inventory_lines" ADD COLUMN "follow_up_note" text;--> statement-breakpoint
ALTER TABLE "asset_inventory_lines" ADD COLUMN "follow_up_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "disposal_lines" ADD COLUMN "transfer_form" "transfer_form";--> statement-breakpoint
ALTER TABLE "maintenances" ADD COLUMN "capitalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "asset_changes_asset_idx" ON "asset_changes" USING btree ("school_id","asset_id","id");--> statement-breakpoint
CREATE INDEX "asset_changes_kind_idx" ON "asset_changes" USING btree ("school_id","kind","date");--> statement-breakpoint
CREATE INDEX "asset_value_changes_asset_idx" ON "asset_value_changes" USING btree ("school_id","asset_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "constructions_school_id_key" ON "constructions" USING btree ("school_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "constructions_asset_key" ON "constructions" USING btree ("school_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utilization_lines_asset_key" ON "utilization_lines" USING btree ("utilization_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utilizations_school_id_key" ON "utilizations" USING btree ("school_id","id");--> statement-breakpoint
CREATE INDEX "utilizations_school_status_idx" ON "utilizations" USING btree ("school_id","status");--> statement-breakpoint
ALTER TABLE "asset_changes" ADD CONSTRAINT "asset_changes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_changes" ADD CONSTRAINT "asset_changes_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_value_changes" ADD CONSTRAINT "asset_value_changes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_value_changes" ADD CONSTRAINT "asset_value_changes_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constructions" ADD CONSTRAINT "constructions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constructions" ADD CONSTRAINT "constructions_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "constructions" ADD CONSTRAINT "constructions_school_id_vendor_id_vendors_school_id_id_fk" FOREIGN KEY ("school_id","vendor_id") REFERENCES "public"."vendors"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilization_lines" ADD CONSTRAINT "utilization_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilization_lines" ADD CONSTRAINT "utilization_lines_school_id_utilization_id_utilizations_school_id_id_fk" FOREIGN KEY ("school_id","utilization_id") REFERENCES "public"."utilizations"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilization_lines" ADD CONSTRAINT "utilization_lines_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilizations" ADD CONSTRAINT "utilizations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

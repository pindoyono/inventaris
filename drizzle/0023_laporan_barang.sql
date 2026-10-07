CREATE TYPE "public"."transfer_status" AS ENUM('DRAF', 'DISERAHKAN', 'DITERIMA', 'DITOLAK', 'DIBATALKAN');--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_school_id" uuid NOT NULL,
	"to_school_id" uuid,
	"to_name" text NOT NULL,
	"number" varchar(40),
	"status" "transfer_status" DEFAULT 'DRAF' NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"approval_no" text,
	"approval_date" date,
	"bast_no" text,
	"bast_date" date,
	"items" jsonb NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"handed_by" uuid,
	"received_by" uuid,
	"received_at" timestamp with time zone,
	"receive_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_not_self_check" CHECK ("transfers"."to_school_id" is null or "transfers"."to_school_id" <> "transfers"."from_school_id")
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "totp_last_step" bigint;--> statement-breakpoint
ALTER TABLE "platform_admins" ADD COLUMN "recovery_codes" jsonb;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "useful_life" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "totp_last_step" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_codes" jsonb;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_school_id_schools_id_fk" FOREIGN KEY ("from_school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_school_id_schools_id_fk" FOREIGN KEY ("to_school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_resets_user_idx" ON "password_resets" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transfers_from_idx" ON "transfers" USING btree ("from_school_id","status");--> statement-breakpoint
CREATE INDEX "transfers_to_idx" ON "transfers" USING btree ("to_school_id","status");
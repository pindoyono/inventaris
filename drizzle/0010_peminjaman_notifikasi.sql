-- Peminjaman, notifikasi, antrean email. Indeks unik sebelum FK komposit.
CREATE TYPE "public"."loan_status" AS ENUM('DIAJUKAN', 'DIPINJAM', 'SELESAI', 'DITOLAK', 'DIBATALKAN');
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_try_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"condition_out" "asset_condition",
	"out_at" timestamp with time zone,
	"condition_in" "asset_condition",
	"returned_at" timestamp with time zone,
	"returned_to" uuid,
	"return_note" text
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40),
	"status" "loan_status" NOT NULL,
	"borrower_user_id" uuid,
	"borrower_name" text NOT NULL,
	"borrower_info" text,
	"purpose" text,
	"loaned_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"created_by" uuid NOT NULL,
	"handed_by" uuid,
	"closed_at" timestamp with time zone,
	"last_reason" text,
	"reminded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_outbox_pending_idx" ON "email_outbox" USING btree ("next_try_at") WHERE "email_outbox"."sent_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "loan_lines_loan_asset_key" ON "loan_lines" USING btree ("loan_id","asset_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "loan_lines_asset_out_key" ON "loan_lines" USING btree ("asset_id") WHERE "loan_lines"."out_at" is not null and "loan_lines"."returned_at" is null;
--> statement-breakpoint
CREATE UNIQUE INDEX "loans_school_id_key" ON "loans" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "loans_school_number_key" ON "loans" USING btree ("school_id","number");
--> statement-breakpoint
CREATE INDEX "loans_school_status_idx" ON "loans" USING btree ("school_id","status","due_at");
--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("school_id","user_id","id");
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loan_lines" ADD CONSTRAINT "loan_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loan_lines" ADD CONSTRAINT "loan_lines_school_id_loan_id_loans_school_id_id_fk" FOREIGN KEY ("school_id","loan_id") REFERENCES "public"."loans"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loan_lines" ADD CONSTRAINT "loan_lines_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_school_id_borrower_user_id_users_school_id_id_fk" FOREIGN KEY ("school_id","borrower_user_id") REFERENCES "public"."users"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_school_id_user_id_users_school_id_id_fk" FOREIGN KEY ("school_id","user_id") REFERENCES "public"."users"("school_id","id") ON DELETE cascade ON UPDATE no action;

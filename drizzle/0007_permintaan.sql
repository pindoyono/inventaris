-- Permintaan persediaan dari unit. Indeks unik sebelum FK komposit.
CREATE TYPE "public"."request_status" AS ENUM('DRAF', 'DIAJUKAN', 'DITERUSKAN', 'DIVERIFIKASI', 'DISETUJUI', 'SELESAI', 'DITOLAK', 'DIBATALKAN');
--> statement-breakpoint
CREATE TABLE "request_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"from_status" "request_status",
	"to_status" "request_status" NOT NULL,
	"note" text,
	"user_id" uuid,
	"user_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_request_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"item_id" uuid NOT NULL,
	"qty_requested" numeric(14, 2) NOT NULL,
	"qty_approved" numeric(14, 2),
	"qty_issued" numeric(14, 2),
	"note" text,
	CONSTRAINT "supply_request_lines_qty_check" CHECK ("supply_request_lines"."qty_requested" > 0 and ("supply_request_lines"."qty_approved" is null or "supply_request_lines"."qty_approved" >= 0) and ("supply_request_lines"."qty_issued" is null or "supply_request_lines"."qty_issued" >= 0))
);
--> statement-breakpoint
CREATE TABLE "supply_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40),
	"status" "request_status" DEFAULT 'DRAF' NOT NULL,
	"unit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"purpose" text,
	"mode" "distribution_mode",
	"levels" smallint,
	"requested_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"sp_number" varchar(40),
	"forwarded_by" uuid,
	"forwarded_at" timestamp with time zone,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"sppb_number" varchar(40),
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"issue_doc_id" uuid,
	"closed_at" timestamp with time zone,
	"last_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD COLUMN "request_id" uuid;
--> statement-breakpoint
CREATE INDEX "request_events_req_idx" ON "request_events" USING btree ("school_id","request_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_request_lines_req_line_key" ON "supply_request_lines" USING btree ("request_id","line_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_requests_school_id_key" ON "supply_requests" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_requests_school_number_key" ON "supply_requests" USING btree ("school_id","number");
--> statement-breakpoint
CREATE INDEX "supply_requests_school_status_idx" ON "supply_requests" USING btree ("school_id","status");
--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_school_id_request_id_supply_requests_school_id_id_fk" FOREIGN KEY ("school_id","request_id") REFERENCES "public"."supply_requests"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_request_lines" ADD CONSTRAINT "supply_request_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_request_lines" ADD CONSTRAINT "supply_request_lines_school_id_request_id_supply_requests_school_id_id_fk" FOREIGN KEY ("school_id","request_id") REFERENCES "public"."supply_requests"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_request_lines" ADD CONSTRAINT "supply_request_lines_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_school_id_issue_doc_id_stock_docs_school_id_id_fk" FOREIGN KEY ("school_id","issue_doc_id") REFERENCES "public"."stock_docs"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_request_id_supply_requests_school_id_id_fk" FOREIGN KEY ("school_id","request_id") REFERENCES "public"."supply_requests"("school_id","id") ON DELETE restrict ON UPDATE no action;

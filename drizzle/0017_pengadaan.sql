-- Usulan kebutuhan & pengadaan. Indeks unik sebelum FK komposit.
CREATE TYPE "public"."goods_kind" AS ENUM('PERSEDIAAN', 'ASET');
--> statement-breakpoint
CREATE TYPE "public"."procurement_status" AS ENUM('DRAF', 'DIPESAN', 'DITERIMA_SEBAGIAN', 'DITERIMA', 'DIBATALKAN');
--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('DRAF', 'DIAJUKAN', 'DIVERIFIKASI', 'DISETUJUI', 'SELESAI', 'DITOLAK', 'DIBATALKAN');
--> statement-breakpoint
CREATE TABLE "budget_ceilings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"unit_id" uuid NOT NULL,
	"funding_source_id" uuid NOT NULL,
	"amount" numeric(16, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_ceilings_amount_check" CHECK ("budget_ceilings"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "procurement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"procurement_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"proposal_line_id" uuid,
	"kind" "goods_kind" NOT NULL,
	"item_id" uuid,
	"bmd_code" varchar(32),
	"description" text NOT NULL,
	"brand" text,
	"qty" numeric(14, 2) NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"qty_received" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "procurement_lines_check" CHECK ("procurement_lines"."qty" > 0 and "procurement_lines"."unit_price" >= 0 and "procurement_lines"."qty_received" >= 0 and "procurement_lines"."qty_received" <= "procurement_lines"."qty")
);
--> statement-breakpoint
CREATE TABLE "procurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40) NOT NULL,
	"status" "procurement_status" DEFAULT 'DRAF' NOT NULL,
	"proposal_id" uuid,
	"vendor_id" uuid,
	"funding_source_id" uuid,
	"funding_component_id" uuid,
	"order_date" date NOT NULL,
	"ref_number" text,
	"ref_date" date,
	"tax_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"attachment" text,
	"created_by" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procurements_tax_check" CHECK ("procurements"."tax_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "proposal_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"from_status" "proposal_status",
	"to_status" "proposal_status" NOT NULL,
	"note" text,
	"user_id" uuid,
	"user_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"kind" "goods_kind" NOT NULL,
	"item_id" uuid,
	"bmd_code" varchar(32),
	"description" text NOT NULL,
	"uom" varchar(30) NOT NULL,
	"qty" numeric(14, 2) NOT NULL,
	"est_price" numeric(16, 2) NOT NULL,
	"reason" text,
	"priority" smallint DEFAULT 2 NOT NULL,
	"qty_approved" numeric(14, 2),
	CONSTRAINT "proposal_lines_check" CHECK ("proposal_lines"."qty" > 0 and "proposal_lines"."est_price" >= 0 and ("proposal_lines"."qty_approved" is null or "proposal_lines"."qty_approved" >= 0) and "proposal_lines"."priority" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40),
	"status" "proposal_status" DEFAULT 'DRAF' NOT NULL,
	"unit_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"funding_source_id" uuid,
	"funding_component_id" uuid,
	"title" text NOT NULL,
	"levels" smallint,
	"requested_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"last_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "procurement_id" uuid;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD COLUMN "procurement_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "budget_ceilings_key" ON "budget_ceilings" USING btree ("school_id","year","unit_id","funding_source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "procurement_lines_line_key" ON "procurement_lines" USING btree ("procurement_id","line_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "procurements_school_id_key" ON "procurements" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "procurements_school_number_key" ON "procurements" USING btree ("school_id","number");
--> statement-breakpoint
CREATE INDEX "proposal_events_idx" ON "proposal_events" USING btree ("school_id","proposal_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_lines_line_key" ON "proposal_lines" USING btree ("proposal_id","line_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_lines_school_id_key" ON "proposal_lines" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_school_id_key" ON "proposals" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_school_number_key" ON "proposals" USING btree ("school_id","number");
--> statement-breakpoint
CREATE INDEX "proposals_school_status_idx" ON "proposals" USING btree ("school_id","status");
--> statement-breakpoint
ALTER TABLE "budget_ceilings" ADD CONSTRAINT "budget_ceilings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget_ceilings" ADD CONSTRAINT "budget_ceilings_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget_ceilings" ADD CONSTRAINT "budget_ceilings_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurement_lines" ADD CONSTRAINT "procurement_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurement_lines" ADD CONSTRAINT "procurement_lines_school_id_procurement_id_procurements_school_id_id_fk" FOREIGN KEY ("school_id","procurement_id") REFERENCES "public"."procurements"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurement_lines" ADD CONSTRAINT "procurement_lines_school_id_proposal_line_id_proposal_lines_school_id_id_fk" FOREIGN KEY ("school_id","proposal_line_id") REFERENCES "public"."proposal_lines"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurement_lines" ADD CONSTRAINT "procurement_lines_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_school_id_proposal_id_proposals_school_id_id_fk" FOREIGN KEY ("school_id","proposal_id") REFERENCES "public"."proposals"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_school_id_vendor_id_vendors_school_id_id_fk" FOREIGN KEY ("school_id","vendor_id") REFERENCES "public"."vendors"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_school_id_funding_component_id_funding_components_school_id_id_fk" FOREIGN KEY ("school_id","funding_component_id") REFERENCES "public"."funding_components"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposal_events" ADD CONSTRAINT "proposal_events_school_id_proposal_id_proposals_school_id_id_fk" FOREIGN KEY ("school_id","proposal_id") REFERENCES "public"."proposals"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposal_lines" ADD CONSTRAINT "proposal_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposal_lines" ADD CONSTRAINT "proposal_lines_school_id_proposal_id_proposals_school_id_id_fk" FOREIGN KEY ("school_id","proposal_id") REFERENCES "public"."proposals"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposal_lines" ADD CONSTRAINT "proposal_lines_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_school_id_funding_component_id_funding_components_school_id_id_fk" FOREIGN KEY ("school_id","funding_component_id") REFERENCES "public"."funding_components"("school_id","id") ON DELETE restrict ON UPDATE no action;

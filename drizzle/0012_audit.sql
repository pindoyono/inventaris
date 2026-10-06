-- Audit: opname, inventarisasi aset, penghapusan, pemeliharaan. Indeks unik sebelum FK komposit.
CREATE TYPE "public"."disposal_reason" AS ENUM('RUSAK_BERAT', 'USANG', 'KECURIAN', 'HILANG', 'TERBAKAR_SUSUT', 'KAHAR', 'INVENTARISASI');
--> statement-breakpoint
CREATE TYPE "public"."disposal_status" AS ENUM('DRAF', 'DIAJUKAN', 'DIKIRIM', 'SELESAI', 'DITOLAK', 'DIBATALKAN');
--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('DRAF', 'SELESAI', 'DIBATALKAN');
--> statement-breakpoint
CREATE TYPE "public"."maintenance_kind" AS ENUM('RUTIN', 'PERBAIKAN', 'PENINGKATAN');
--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('BERJALAN', 'SELESAI');
--> statement-breakpoint
CREATE TYPE "public"."opname_status" AS ENUM('DRAF', 'DIAJUKAN', 'DISETUJUI', 'DIBATALKAN');
--> statement-breakpoint
CREATE TABLE "asset_inventories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40) NOT NULL,
	"room_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "inventory_status" DEFAULT 'DRAF' NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"finished_by" uuid,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_inventory_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"inventory_id" uuid NOT NULL,
	"asset_id" uuid,
	"condition_recorded" "asset_condition",
	"found" boolean,
	"condition_found" "asset_condition",
	"extra_name" text,
	"extra_qty" integer,
	"note" text,
	CONSTRAINT "asset_inventory_lines_kind_check" CHECK (("asset_inventory_lines"."asset_id" is not null) <> ("asset_inventory_lines"."extra_name" is not null))
);
--> statement-breakpoint
CREATE TABLE "disposal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"disposal_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"reason" "disposal_reason" NOT NULL,
	"police_letter" text,
	"note" text,
	"prev_status" "asset_status"
);
--> statement-breakpoint
CREATE TABLE "disposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40),
	"status" "disposal_status" DEFAULT 'DRAF' NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"letter_number" text,
	"letter_date" date,
	"sent_at" timestamp with time zone,
	"sk_number" text,
	"sk_date" date,
	"sk_file" text,
	"closed_at" timestamp with time zone,
	"last_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" "maintenance_kind" NOT NULL,
	"status" "maintenance_status" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"executor" text,
	"description" text NOT NULL,
	"cost" numeric(16, 2) DEFAULT '0' NOT NULL,
	"funding_source_id" uuid,
	"funding_component_id" uuid,
	"condition_before" "asset_condition" NOT NULL,
	"condition_after" "asset_condition",
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maintenances_cost_check" CHECK ("maintenances"."cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_opname_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"opname_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"system_qty" numeric(14, 2) NOT NULL,
	"physical_qty" numeric(14, 2),
	"damaged_qty" numeric(14, 2) DEFAULT '0' NOT NULL,
	"surplus_price" numeric(16, 2),
	"note" text,
	CONSTRAINT "stock_opname_lines_qty_check" CHECK ("stock_opname_lines"."system_qty" >= 0 and ("stock_opname_lines"."physical_qty" is null or "stock_opname_lines"."physical_qty" >= 0) and "stock_opname_lines"."damaged_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_opnames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"number" varchar(40) NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "opname_status" DEFAULT 'DRAF' NOT NULL,
	"note" text,
	"created_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"last_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD COLUMN "opname_id" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_inventories_school_id_key" ON "asset_inventories" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_inventories_school_number_key" ON "asset_inventories" USING btree ("school_id","number");
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_inventory_lines_asset_key" ON "asset_inventory_lines" USING btree ("inventory_id","asset_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "disposal_lines_asset_key" ON "disposal_lines" USING btree ("disposal_id","asset_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "disposals_school_id_key" ON "disposals" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "disposals_school_number_key" ON "disposals" USING btree ("school_id","number");
--> statement-breakpoint
CREATE INDEX "maintenances_asset_idx" ON "maintenances" USING btree ("school_id","asset_id","start_date");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_opname_lines_item_key" ON "stock_opname_lines" USING btree ("opname_id","item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_opnames_school_id_key" ON "stock_opnames" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_opnames_school_number_key" ON "stock_opnames" USING btree ("school_id","number");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_opnames_active_wh_key" ON "stock_opnames" USING btree ("warehouse_id") WHERE "stock_opnames"."status" in ('DRAF','DIAJUKAN');
--> statement-breakpoint
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_inventories" ADD CONSTRAINT "asset_inventories_school_id_room_id_rooms_school_id_id_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "public"."rooms"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_inventory_lines" ADD CONSTRAINT "asset_inventory_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_inventory_lines" ADD CONSTRAINT "asset_inventory_lines_school_id_inventory_id_asset_inventories_school_id_id_fk" FOREIGN KEY ("school_id","inventory_id") REFERENCES "public"."asset_inventories"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_inventory_lines" ADD CONSTRAINT "asset_inventory_lines_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disposal_lines" ADD CONSTRAINT "disposal_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disposal_lines" ADD CONSTRAINT "disposal_lines_school_id_disposal_id_disposals_school_id_id_fk" FOREIGN KEY ("school_id","disposal_id") REFERENCES "public"."disposals"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disposal_lines" ADD CONSTRAINT "disposal_lines_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_school_id_funding_component_id_funding_components_school_id_id_fk" FOREIGN KEY ("school_id","funding_component_id") REFERENCES "public"."funding_components"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_lines" ADD CONSTRAINT "stock_opname_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_lines" ADD CONSTRAINT "stock_opname_lines_school_id_opname_id_stock_opnames_school_id_id_fk" FOREIGN KEY ("school_id","opname_id") REFERENCES "public"."stock_opnames"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opname_lines" ADD CONSTRAINT "stock_opname_lines_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_school_id_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE restrict ON UPDATE no action;

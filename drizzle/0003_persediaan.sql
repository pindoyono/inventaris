-- Persediaan: barang (NUSP), dokumen stok, lot FIFO, saldo, buku besar. Indeks unik sebelum FK komposit.
CREATE TYPE "public"."movement_kind" AS ENUM('SALDO_AWAL', 'PENERIMAAN', 'PENYALURAN', 'MUTASI_KELUAR', 'MUTASI_MASUK', 'PENYESUAIAN_TAMBAH', 'PENYESUAIAN_KURANG', 'RUSAK_USANG', 'PEMBALIK');
--> statement-breakpoint
CREATE TYPE "public"."stock_doc_kind" AS ENUM('SALDO_AWAL', 'PENERIMAAN', 'PENYALURAN', 'MUTASI', 'PENYESUAIAN_TAMBAH', 'PENYESUAIAN_KURANG', 'RUSAK_USANG');
--> statement-breakpoint
CREATE TYPE "public"."stock_doc_status" AS ENUM('DRAF', 'DIPOSTING', 'DIBATALKAN');
--> statement-breakpoint
CREATE TABLE "doc_counters" (
	"school_id" uuid NOT NULL,
	"kind" varchar(30) NOT NULL,
	"year" smallint NOT NULL,
	"last" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "doc_counters_school_id_kind_year_pk" PRIMARY KEY("school_id","kind","year")
);
--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"school_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty" numeric(14, 2) DEFAULT '0' NOT NULL,
	"value" numeric(16, 2) DEFAULT '0' NOT NULL,
	"last_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balances_item_id_warehouse_id_pk" PRIMARY KEY("item_id","warehouse_id"),
	CONSTRAINT "stock_balances_check" CHECK ("stock_balances"."qty" >= 0 and "stock_balances"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_doc_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"doc_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"item_id" uuid NOT NULL,
	"qty" numeric(14, 2) NOT NULL,
	"unit_price" numeric(16, 2),
	"note" text,
	CONSTRAINT "stock_doc_lines_qty_check" CHECK ("stock_doc_lines"."qty" > 0),
	CONSTRAINT "stock_doc_lines_price_check" CHECK ("stock_doc_lines"."unit_price" is null or "stock_doc_lines"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" "stock_doc_kind" NOT NULL,
	"status" "stock_doc_status" DEFAULT 'DRAF' NOT NULL,
	"number" varchar(40),
	"date" date NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid,
	"unit_id" uuid,
	"vendor_id" uuid,
	"funding_source_id" uuid,
	"funding_component_id" uuid,
	"acquisition" varchar(30),
	"ref_number" text,
	"ref_date" date,
	"note" text,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"received_date" date NOT NULL,
	"qty_in" numeric(14, 2) NOT NULL,
	"qty_left" numeric(14, 2) NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"doc_id" uuid NOT NULL,
	"origin_lot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_lots_qty_check" CHECK ("stock_lots"."qty_in" > 0 and "stock_lots"."qty_left" >= 0 and "stock_lots"."qty_left" <= "stock_lots"."qty_in"),
	CONSTRAINT "stock_lots_price_check" CHECK ("stock_lots"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" "movement_kind" NOT NULL,
	"doc_id" uuid NOT NULL,
	"doc_number" varchar(40) NOT NULL,
	"lot_id" uuid NOT NULL,
	"qty_in" numeric(14, 2) DEFAULT '0' NOT NULL,
	"qty_out" numeric(14, 2) DEFAULT '0' NOT NULL,
	"unit_price" numeric(16, 2) NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"balance_qty" numeric(14, 2) NOT NULL,
	"balance_value" numeric(16, 2) NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_qty_check" CHECK ("stock_movements"."qty_in" >= 0 and "stock_movements"."qty_out" >= 0 and ("stock_movements"."qty_in" > 0) <> ("stock_movements"."qty_out" > 0)),
	CONSTRAINT "stock_movements_balance_check" CHECK ("stock_movements"."balance_qty" >= 0 and "stock_movements"."balance_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "supply_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"bmd_code" varchar(32) NOT NULL,
	"seq" integer NOT NULL,
	"nusp" varchar(40) NOT NULL,
	"name" text NOT NULL,
	"spec" text,
	"uom_id" uuid NOT NULL,
	"min_stock" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"qr_token" varchar(32) DEFAULT encode(gen_random_bytes(12), 'hex') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supply_items_seq_check" CHECK ("supply_items"."seq" between 1 and 9999),
	CONSTRAINT "supply_items_min_stock_check" CHECK ("supply_items"."min_stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "books_closed_until" date;
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_doc_lines_doc_line_key" ON "stock_doc_lines" USING btree ("doc_id","line_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_docs_school_id_key" ON "stock_docs" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_docs_school_number_key" ON "stock_docs" USING btree ("school_id","number");
--> statement-breakpoint
CREATE INDEX "stock_docs_school_date_idx" ON "stock_docs" USING btree ("school_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX "stock_lots_school_id_key" ON "stock_lots" USING btree ("school_id","id");
--> statement-breakpoint
CREATE INDEX "stock_lots_fifo_idx" ON "stock_lots" USING btree ("school_id","item_id","warehouse_id","received_date","created_at");
--> statement-breakpoint
CREATE INDEX "stock_movements_card_idx" ON "stock_movements" USING btree ("school_id","item_id","warehouse_id","id");
--> statement-breakpoint
CREATE INDEX "stock_movements_doc_idx" ON "stock_movements" USING btree ("school_id","doc_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_items_school_nusp_key" ON "supply_items" USING btree ("school_id","nusp");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_items_school_code_seq_key" ON "supply_items" USING btree ("school_id","bmd_code","seq");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_items_school_id_key" ON "supply_items" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "supply_items_qr_key" ON "supply_items" USING btree ("qr_token");
--> statement-breakpoint
CREATE UNIQUE INDEX "funding_components_school_id_key" ON "funding_components" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "uoms_school_id_key" ON "uoms" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "vendors_school_id_key" ON "vendors" USING btree ("school_id","id");
--> statement-breakpoint
ALTER TABLE "doc_counters" ADD CONSTRAINT "doc_counters_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_school_id_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_doc_lines" ADD CONSTRAINT "stock_doc_lines_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_doc_lines" ADD CONSTRAINT "stock_doc_lines_school_id_doc_id_stock_docs_school_id_id_fk" FOREIGN KEY ("school_id","doc_id") REFERENCES "public"."stock_docs"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_doc_lines" ADD CONSTRAINT "stock_doc_lines_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_to_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","to_warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_vendor_id_vendors_school_id_id_fk" FOREIGN KEY ("school_id","vendor_id") REFERENCES "public"."vendors"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_school_id_funding_component_id_funding_components_school_id_id_fk" FOREIGN KEY ("school_id","funding_component_id") REFERENCES "public"."funding_components"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_school_id_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_school_id_doc_id_stock_docs_school_id_id_fk" FOREIGN KEY ("school_id","doc_id") REFERENCES "public"."stock_docs"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_school_id_item_id_supply_items_school_id_id_fk" FOREIGN KEY ("school_id","item_id") REFERENCES "public"."supply_items"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_school_id_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_school_id_doc_id_stock_docs_school_id_id_fk" FOREIGN KEY ("school_id","doc_id") REFERENCES "public"."stock_docs"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_school_id_lot_id_stock_lots_school_id_id_fk" FOREIGN KEY ("school_id","lot_id") REFERENCES "public"."stock_lots"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supply_items" ADD CONSTRAINT "supply_items_school_id_uom_id_uoms_school_id_id_fk" FOREIGN KEY ("school_id","uom_id") REFERENCES "public"."uoms"("school_id","id") ON DELETE restrict ON UPDATE no action;

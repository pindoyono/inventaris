-- Aset tetap per unit, riwayat, peta token QR. Indeks unik sebelum FK komposit.
CREATE TYPE "public"."asset_condition" AS ENUM('BAIK', 'RUSAK_RINGAN', 'RUSAK_BERAT');
--> statement-breakpoint
CREATE TYPE "public"."asset_event_kind" AS ENUM('DICATAT', 'PINDAH', 'KONDISI', 'STATUS', 'UBAH_DATA');
--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('DIGUNAKAN', 'DIPINJAM', 'DALAM_PEMELIHARAAN', 'DIUSULKAN_HAPUS', 'DIHAPUS', 'HILANG');
--> statement-breakpoint
CREATE TABLE "asset_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"kind" "asset_event_kind" NOT NULL,
	"date" date NOT NULL,
	"from_room_id" uuid,
	"to_room_id" uuid,
	"from_condition" "asset_condition",
	"to_condition" "asset_condition",
	"from_status" "asset_status",
	"to_status" "asset_status",
	"note" text,
	"created_by" uuid,
	"created_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"bmd_code" varchar(32) NOT NULL,
	"kib" varchar(3) NOT NULL,
	"reg_no" integer NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"attrs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"acq_date" date NOT NULL,
	"acq_price" numeric(16, 2) NOT NULL,
	"acquisition" varchar(30) DEFAULT 'PEMBELIAN' NOT NULL,
	"is_intra" boolean NOT NULL,
	"funding_source_id" uuid,
	"funding_component_id" uuid,
	"vendor_id" uuid,
	"ref_number" text,
	"room_id" uuid,
	"unit_id" uuid,
	"condition" "asset_condition" DEFAULT 'BAIK' NOT NULL,
	"status" "asset_status" DEFAULT 'DIGUNAKAN' NOT NULL,
	"batch_id" uuid NOT NULL,
	"qr_token" varchar(32) DEFAULT encode(gen_random_bytes(12), 'hex') NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_reg_no_check" CHECK ("assets"."reg_no" between 1 and 999999),
	CONSTRAINT "assets_price_check" CHECK ("assets"."acq_price" >= 0),
	CONSTRAINT "assets_kib_check" CHECK ("assets"."kib" in ('A','B','C','D','E','F','ATB'))
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"token" varchar(32) PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"ref_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "asset_events_asset_idx" ON "asset_events" USING btree ("school_id","asset_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "assets_school_id_key" ON "assets" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "assets_school_code_reg_key" ON "assets" USING btree ("school_id","bmd_code","reg_no");
--> statement-breakpoint
CREATE UNIQUE INDEX "assets_qr_key" ON "assets" USING btree ("qr_token");
--> statement-breakpoint
CREATE INDEX "assets_school_room_idx" ON "assets" USING btree ("school_id","room_id");
--> statement-breakpoint
CREATE INDEX "assets_school_batch_idx" ON "assets" USING btree ("school_id","batch_id");
--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_school_id_asset_id_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."assets"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_school_id_from_room_id_rooms_school_id_id_fk" FOREIGN KEY ("school_id","from_room_id") REFERENCES "public"."rooms"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "asset_events" ADD CONSTRAINT "asset_events_school_id_to_room_id_rooms_school_id_id_fk" FOREIGN KEY ("school_id","to_room_id") REFERENCES "public"."rooms"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_room_id_rooms_school_id_id_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "public"."rooms"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_vendor_id_vendors_school_id_id_fk" FOREIGN KEY ("school_id","vendor_id") REFERENCES "public"."vendors"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_school_id_funding_component_id_funding_components_school_id_id_fk" FOREIGN KEY ("school_id","funding_component_id") REFERENCES "public"."funding_components"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

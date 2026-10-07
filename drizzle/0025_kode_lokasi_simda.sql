ALTER TABLE "funding_sources" ADD COLUMN "kode_upb" varchar(2);--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "kode_provinsi" varchar(2);--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "kode_kab" varchar(2);--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "kode_bidang" varchar(2);--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "kode_unit" varchar(2);--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "kode_sub_unit" varchar(3);--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "kode_upb" varchar(2) DEFAULT '01' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "label_qr" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "label_logo" boolean DEFAULT true NOT NULL;
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"entity" varchar(30) NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"caption" text,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kir_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"period" varchar(20) NOT NULL,
	"as_of" date NOT NULL,
	"pic_name" text,
	"units" integer NOT NULL,
	"total" numeric(16, 2) NOT NULL,
	"rows" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kir_snapshots" ADD CONSTRAINT "kir_snapshots_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kir_snapshots" ADD CONSTRAINT "kir_snapshots_school_id_room_id_rooms_school_id_id_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "public"."rooms"("school_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("school_id","entity","entity_id");--> statement-breakpoint
CREATE INDEX "kir_snapshots_room_idx" ON "kir_snapshots" USING btree ("school_id","room_id","created_at");
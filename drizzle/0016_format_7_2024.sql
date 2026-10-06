CREATE TYPE "public"."disposal_follow_up" AS ENUM('PEMUSNAHAN', 'PEMINDAHTANGANAN');--> statement-breakpoint
CREATE TYPE "public"."idle_plan" AS ENUM('PENGGUNAAN', 'PEMANFAATAN', 'PEMINDAHTANGANAN');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "idle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "idle_plan" "idle_plan";--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "idle_note" text;--> statement-breakpoint
ALTER TABLE "disposal_lines" ADD COLUMN "follow_up" "disposal_follow_up" DEFAULT 'PEMUSNAHAN' NOT NULL;
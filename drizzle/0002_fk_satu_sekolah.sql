-- FK komposit (school_id, id): rujukan antar tabel sekolah wajib dalam sekolah yang sama.
-- Indeks unik dibuat lebih dulu karena dibutuhkan FK komposit.
CREATE UNIQUE INDEX "buildings_school_id_key" ON "buildings" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "funding_sources_school_id_key" ON "funding_sources" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_school_id_key" ON "rooms" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "units_school_id_key" ON "units" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "users_school_id_key" ON "users" USING btree ("school_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_school_id_key" ON "warehouses" USING btree ("school_id","id");
--> statement-breakpoint
ALTER TABLE "funding_components" DROP CONSTRAINT "funding_components_funding_source_id_funding_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_building_id_buildings_id_fk";
--> statement-breakpoint
ALTER TABLE "rooms" DROP CONSTRAINT "rooms_unit_id_units_id_fk";
--> statement-breakpoint
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_units" DROP CONSTRAINT "user_units_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_units" DROP CONSTRAINT "user_units_unit_id_units_id_fk";
--> statement-breakpoint
ALTER TABLE "user_warehouses" DROP CONSTRAINT "user_warehouses_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_warehouses" DROP CONSTRAINT "user_warehouses_warehouse_id_warehouses_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_room_id_rooms_id_fk";
--> statement-breakpoint
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_unit_id_units_id_fk";
--> statement-breakpoint
ALTER TABLE "funding_components" ADD CONSTRAINT "funding_components_school_id_funding_source_id_funding_sources_school_id_id_fk" FOREIGN KEY ("school_id","funding_source_id") REFERENCES "public"."funding_sources"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_school_id_building_id_buildings_school_id_id_fk" FOREIGN KEY ("school_id","building_id") REFERENCES "public"."buildings"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_school_id_user_id_users_school_id_id_fk" FOREIGN KEY ("school_id","user_id") REFERENCES "public"."users"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_school_id_user_id_users_school_id_id_fk" FOREIGN KEY ("school_id","user_id") REFERENCES "public"."users"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_units" ADD CONSTRAINT "user_units_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_school_id_user_id_users_school_id_id_fk" FOREIGN KEY ("school_id","user_id") REFERENCES "public"."users"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_warehouses" ADD CONSTRAINT "user_warehouses_school_id_warehouse_id_warehouses_school_id_id_fk" FOREIGN KEY ("school_id","warehouse_id") REFERENCES "public"."warehouses"("school_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_school_id_room_id_rooms_school_id_id_fk" FOREIGN KEY ("school_id","room_id") REFERENCES "public"."rooms"("school_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_school_id_unit_id_units_school_id_id_fk" FOREIGN KEY ("school_id","unit_id") REFERENCES "public"."units"("school_id","id") ON DELETE restrict ON UPDATE no action;

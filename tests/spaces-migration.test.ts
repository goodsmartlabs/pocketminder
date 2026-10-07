import { describe,it,expect } from "vitest";
import fs from "node:fs";
import Database from "better-sqlite3";
describe("Spaces migration",()=>{it("backfills existing reminders without losing history and rejects unowned containers",()=>{
 const db=new Database(":memory:");db.pragma("foreign_keys = ON");db.exec(fs.readFileSync("drizzle/0000_init.sql","utf8"));
 db.exec("INSERT INTO users(id,email,name,password_hash) VALUES ('legacy','legacy@example.com','Legacy','x'); INSERT INTO categories(id,user_id,name,slug,color) VALUES ('cat','legacy','Travel','travel','#48786c'); INSERT INTO reminders(id,user_id,series_id,title,important_date,category_id) VALUES ('r','legacy','series','Passport','2027-01-01','cat'); INSERT INTO reminder_history(id,reminder_id,user_id,series_id,event) VALUES ('h','r','legacy','series','created');");
 db.exec("BEGIN");for(const statement of fs.readFileSync("drizzle/0001_fuzzy_lockheed.sql","utf8").split("--> statement-breakpoint"))db.exec(statement);db.exec("COMMIT");
 expect(db.prepare("SELECT space_id FROM reminders WHERE id='r'").get()).toEqual({space_id:"imported-legacy"});expect(db.prepare("SELECT COUNT(*) as n FROM reminder_history").get()).toEqual({n:1});expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
 expect(()=>db.exec("INSERT INTO reminders(id,user_id,series_id,title,important_date) VALUES ('bad','legacy','bad','bad','2027-01-01')")).toThrow();
 db.close();
});});

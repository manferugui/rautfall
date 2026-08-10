CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"player_name" varchar(30) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"result" varchar(20) NOT NULL,
	"score" integer NOT NULL,
	"lines_cleared" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"level" integer NOT NULL,
	"opponent_profile" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_matches_client_match_id_unique" ON "matches" ("client_match_id");
CREATE INDEX IF NOT EXISTS "idx_matches_history" ON "matches" ("player_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "idx_matches_ranking" ON "matches" ("mode", "score" DESC, "created_at" ASC, "id" ASC);

package local.kartsim.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only view of durable race results and room settings. */
@RestController
@RequestMapping("/api")
public class HistoryApi {
    private final Database database;
    private final ObjectMapper json;

    public HistoryApi(Database database, ObjectMapper json) {
        this.database = database;
        this.json = json;
    }

    @GetMapping("/race-results")
    public List<Map<String, Object>> recentResults(
            @RequestParam(value = "name", required = false) String name) {
        if (name != null && (name.length() > 18 || name.isBlank()))
            throw new ApiError(400, "INVALID_NAME");
        return database.transaction(connection -> {
            List<Map<String, Object>> results = new ArrayList<>();
            String sql = """
                SELECT room_id,race_id,player_id,name,rank,elapsed_ms,points,created_at
                FROM race_results
                """ + (name == null ? "" : "WHERE name=? COLLATE NOCASE ") +
                "ORDER BY created_at DESC, id DESC LIMIT 100";
            try (PreparedStatement query = connection.prepareStatement(sql)) {
                if (name != null) query.setString(1, name);
                try (ResultSet rows = query.executeQuery()) {
                    while (rows.next()) {
                        Map<String, Object> result = new java.util.LinkedHashMap<>();
                        result.put("roomId", rows.getString("room_id"));
                        result.put("raceId", rows.getString("race_id"));
                        result.put("playerId", rows.getString("player_id"));
                        result.put("name", rows.getString("name"));
                        result.put("rank", rows.getInt("rank"));
                        result.put("elapsedMs", rows.getObject("elapsed_ms"));
                        result.put("points", rows.getInt("points"));
                        result.put("createdAt", rows.getLong("created_at"));
                        results.add(result);
                    }
                }
            }
            return results;
        });
    }

    @GetMapping("/room-rules")
    public List<Map<String, Object>> savedRules() {
        return database.transaction(connection -> {
            List<Map<String, Object>> rules = new ArrayList<>();
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT room_id,json,updated_at FROM room_rules ORDER BY updated_at DESC LIMIT 100");
                 ResultSet rows = query.executeQuery()) {
                while (rows.next()) {
                    JsonNode settings = json.readTree(rows.getString("json"));
                    rules.add(Map.of("roomId", rows.getString("room_id"),
                        "settings", settings, "updatedAt", rows.getLong("updated_at")));
                }
            }
            return rules;
        });
    }
}

package local.kartsim.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Opt-in mirror for the browser's local profile and ghost records.
 * Unknown game fields remain JSON, so a new client profile version is preserved.
 */
@RestController
@RequestMapping("/api")
public class StorageApi {
    private final Database database;
    private final ObjectMapper json;

    public StorageApi(Database database, ObjectMapper json) {
        this.database = database;
        this.json = json;
    }

    @GetMapping("/profile/{ownerId}")
    public ResponseEntity<JsonNode> profile(@PathVariable String ownerId,
            @RequestHeader(value = "X-Profile-Key", required = false) String key) {
        validOwner(ownerId);
        JsonNode result = database.transaction(connection -> {
            requireOwner(connection, ownerId, key, false);
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT json FROM profiles WHERE owner_id=?")) {
                query.setString(1, ownerId);
                try (ResultSet rows = query.executeQuery()) {
                    return rows.next() ? json.readTree(rows.getString(1)) : null;
                }
            }
        });
        return result == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(result);
    }

    @PutMapping("/profile/{ownerId}")
    public JsonNode saveProfile(@PathVariable String ownerId,
            @RequestHeader(value = "X-Profile-Key", required = false) String key,
            @RequestBody JsonNode profile) {
        validOwner(ownerId);
        requireObject(profile, 1_000_000);
        String value = profile.toString();
        database.transaction(connection -> {
            requireOwner(connection, ownerId, key, true);
            try (PreparedStatement update = connection.prepareStatement("""
                    INSERT INTO profiles(owner_id,json,updated_at) VALUES(?,?,?)
                    ON CONFLICT(owner_id) DO UPDATE SET
                      json=excluded.json, updated_at=excluded.updated_at""")) {
                update.setString(1, ownerId);
                update.setString(2, value);
                update.setLong(3, System.currentTimeMillis());
                update.executeUpdate();
            }
            return null;
        });
        return profile;
    }

    @GetMapping("/records/{ownerId}")
    public List<Map<String, Object>> listRecords(@PathVariable String ownerId,
            @RequestHeader(value = "X-Profile-Key", required = false) String key) {
        validOwner(ownerId);
        return database.transaction(connection -> {
            requireOwner(connection, ownerId, key, false);
            List<Map<String, Object>> records = new ArrayList<>();
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT record_id,json,updated_at FROM records WHERE owner_id=? ORDER BY updated_at DESC")) {
                query.setString(1, ownerId);
                try (ResultSet rows = query.executeQuery()) {
                    while (rows.next()) records.add(Map.of(
                        "recordId", rows.getString(1), "record", json.readTree(rows.getString(2)),
                        "updatedAt", rows.getLong(3)));
                }
            }
            return records;
        });
    }

    @GetMapping("/records/{ownerId}/{recordId}")
    public ResponseEntity<JsonNode> record(@PathVariable String ownerId, @PathVariable String recordId,
            @RequestHeader(value = "X-Profile-Key", required = false) String key) {
        validOwner(ownerId);
        validRecordId(recordId);
        JsonNode result = database.transaction(connection -> {
            requireOwner(connection, ownerId, key, false);
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT json FROM records WHERE owner_id=? AND record_id=?")) {
                query.setString(1, ownerId);
                query.setString(2, recordId);
                try (ResultSet rows = query.executeQuery()) {
                    return rows.next() ? json.readTree(rows.getString(1)) : null;
                }
            }
        });
        return result == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(result);
    }

    @PutMapping("/records/{ownerId}/{recordId}")
    public JsonNode saveRecord(@PathVariable String ownerId, @PathVariable String recordId,
                               @RequestHeader(value = "X-Profile-Key", required = false) String key,
                               @RequestBody JsonNode record) {
        validOwner(ownerId);
        validRecordId(recordId);
        requireDocument(record, 4_000_000, true);
        String value = record.toString();
        database.transaction(connection -> {
            requireOwner(connection, ownerId, key, true);
            try (PreparedStatement update = connection.prepareStatement("""
                    INSERT INTO records(owner_id,record_id,json,updated_at) VALUES(?,?,?,?)
                    ON CONFLICT(owner_id,record_id) DO UPDATE SET
                      json=excluded.json, updated_at=excluded.updated_at""")) {
                update.setString(1, ownerId);
                update.setString(2, recordId);
                update.setString(3, value);
                update.setLong(4, System.currentTimeMillis());
                update.executeUpdate();
            }
            return null;
        });
        return record;
    }

    private static void validOwner(String value) {
        try { UUID.fromString(value); }
        catch (Exception error) { throw new ApiError(400, "INVALID_OWNER_ID"); }
    }
    private static void validRecordId(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{1,100}"))
            throw new ApiError(400, "INVALID_RECORD_ID");
    }
    private static void requireObject(JsonNode value, int maxChars) {
        requireDocument(value, maxChars, false);
    }
    private static void requireDocument(JsonNode value, int maxChars, boolean allowArray) {
        if (value == null || !(value.isObject() || (allowArray && value.isArray())) ||
            value.toString().length() > maxChars)
            throw new ApiError(400, "INVALID_DOCUMENT");
    }

    /** The browser creates a random key once; only its SHA-256 digest is persisted. */
    private static void requireOwner(java.sql.Connection connection, String ownerId,
                                     String key, boolean allowCreate) throws Exception {
        if (key == null || !key.matches("[A-Za-z0-9_-]{43}"))
            throw new ApiError(403, "PROFILE_KEY_REQUIRED");
        String digest = hash(key);
        try (PreparedStatement query = connection.prepareStatement(
                "SELECT secret_hash FROM owner_keys WHERE owner_id=?")) {
            query.setString(1, ownerId);
            try (ResultSet rows = query.executeQuery()) {
                if (rows.next()) {
                    if (!MessageDigest.isEqual(
                            rows.getString(1).getBytes(StandardCharsets.UTF_8),
                            digest.getBytes(StandardCharsets.UTF_8)))
                        throw new ApiError(403, "PROFILE_KEY_INVALID");
                    return;
                }
            }
        }
        if (!allowCreate) throw new ApiError(404, "PROFILE_NOT_FOUND");
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO owner_keys(owner_id,secret_hash,created_at) VALUES(?,?,?)")) {
            insert.setString(1, ownerId);
            insert.setString(2, digest);
            insert.setLong(3, System.currentTimeMillis());
            insert.executeUpdate();
        }
    }

    private static String hash(String value) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
            .digest(value.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }
}

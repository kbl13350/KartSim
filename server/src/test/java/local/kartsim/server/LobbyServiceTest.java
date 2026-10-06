package local.kartsim.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LobbyServiceTest {
    @TempDir Path dataDirectory;
    private final ObjectMapper json = new ObjectMapper();

    @Test
    @SuppressWarnings("unchecked")
    void transferCannotMakeKickTargetTheHost() throws Exception {
        Database database = new Database(dataDirectory.toString());
        LobbyService lobby = new LobbyService(new Accounts(database), database, json);
        try {
            LobbyService.Client alice = connect(lobby, "Alice");
            LobbyService.Client bob = connect(lobby, "Bob");
            LobbyService.Client carol = connect(lobby, "Carol");
            Map<String, Object> created = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "create", "name", "Test Room", "capacity", 3,
                "password", "", "channelName", "speedIndiCombine",
                "gameplay", "ordinary", "mode", "individual",
                "speed", 7, "speedVersion", "国服")));
            Map<String, Object> room = (Map<String, Object>) created.get("room");
            String roomId = (String) room.get("roomId");
            lobby.handle(bob, json.valueToTree(Map.of("type", "join", "roomId", roomId)));
            Map<String, Object> joined = lobby.handle(carol,
                json.valueToTree(Map.of("type", "join", "roomId", roomId)));
            room = (Map<String, Object>) joined.get("room");

            Map<String, Object> kicked = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "kick", "roomId", roomId, "revision", room.get("revision"),
                "playerId", bob.playerId)));
            room = (Map<String, Object>) kicked.get("room");
            Map<String, Object> vote = (Map<String, Object>) room.get("kickVote");
            assertEquals(alice.playerId, room.get("hostId"));

            int revision = (Integer) room.get("revision");
            ApiError error = assertThrows(ApiError.class, () ->
                lobby.handle(alice, json.valueToTree(Map.of(
                    "type", "transfer-host", "roomId", roomId,
                    "revision", revision, "playerId", bob.playerId))));
            assertEquals("VOTE_IN_PROGRESS", error.getMessage());

            Map<String, Object> approved = lobby.handle(carol, json.valueToTree(Map.of(
                "type", "kick-vote", "roomId", roomId, "revision", revision,
                "voteId", vote.get("voteId"), "approve", true)));
            room = (Map<String, Object>) approved.get("room");
            List<Map<String, Object>> members =
                (List<Map<String, Object>>) room.get("members");
            String hostId = (String) room.get("hostId");
            assertEquals(alice.playerId, hostId);
            assertTrue(members.stream().anyMatch(member ->
                member.get("playerId").equals(hostId)));
            assertFalse(members.stream().anyMatch(member ->
                member.get("playerId").equals(bob.playerId)));
        } finally {
            lobby.stop();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void loadFailureIsLimitedToLoadingAndRaceLeaveRecoversRoom() throws Exception {
        Database database = new Database(dataDirectory.toString());
        LobbyService lobby = new LobbyService(new Accounts(database), database, json);
        try {
            List<Map<String, Object>> aliceEvents = new ArrayList<>();
            LobbyService.Client alice = connect(lobby, "Alice", aliceEvents);
            LobbyService.Client bob = connect(lobby, "Bob");
            Map<String, Object> created = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "create", "name", "Race Room", "capacity", 2,
                "password", "", "channelName", "speedIndiCombine",
                "gameplay", "ordinary", "mode", "individual",
                "speed", 7, "speedVersion", "国服")));
            Map<String, Object> room = (Map<String, Object>) created.get("room");
            String roomId = (String) room.get("roomId");
            Map<String, Object> joined = lobby.handle(bob,
                json.valueToTree(Map.of("type", "join", "roomId", roomId)));
            room = (Map<String, Object>) joined.get("room");
            Map<String, Object> track = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "track", "roomId", roomId, "revision", room.get("revision"),
                "trackId", "desert_I01")));
            room = (Map<String, Object>) track.get("room");
            assertEquals("desert_I01", savedRules(database, roomId).get("trackId").textValue());
            Map<String, Object> random = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "random-track", "roomId", roomId,
                "revision", room.get("revision"), "randomTrackCode", 3)));
            room = (Map<String, Object>) random.get("room");
            assertEquals(3, savedRules(database, roomId).get("randomTrackCode").intValue());
            assertFalse(savedRules(database, roomId).has("trackId"));
            Map<String, Object> fixed = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "track", "roomId", roomId, "revision", room.get("revision"),
                "trackId", "forest_I01")));
            room = (Map<String, Object>) fixed.get("room");
            assertEquals("forest_I01", savedRules(database, roomId).get("trackId").textValue());
            Map<String, Object> ready = lobby.handle(bob, json.valueToTree(Map.of(
                "type", "ready", "roomId", roomId,
                "revision", room.get("revision"), "ready", true)));
            room = (Map<String, Object>) ready.get("room");
            Map<String, Object> started = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "start", "roomId", roomId, "revision", room.get("revision"))));
            room = (Map<String, Object>) started.get("room");
            assertEquals("loading", room.get("phase"));
            Map<String, Object> firstRace = (Map<String, Object>) room.get("race");
            assertEquals(Map.of(alice.playerId, 0, bob.playerId, 1),
                firstRace.get("startSlots"));
            String raceId = (String) firstRace.get("raceId");
            lobby.handle(alice, json.valueToTree(Map.of(
                "type", "loaded", "roomId", roomId, "raceId", raceId)));
            Map<String, Object> failed = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "load-failed", "roomId", roomId, "raceId", raceId)));
            room = (Map<String, Object>) failed.get("room");
            assertEquals("open", room.get("phase"));
            assertEquals("LOAD_FAILED", room.get("raceError"));
            Map<String, Object> restarted = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "start", "roomId", roomId, "revision", room.get("revision"))));
            room = (Map<String, Object>) restarted.get("room");
            String secondRaceId = (String) ((Map<String, Object>) room.get("race")).get("raceId");
            lobby.handle(alice, json.valueToTree(Map.of(
                "type", "loaded", "roomId", roomId, "raceId", secondRaceId)));
            Map<String, Object> countdown = lobby.handle(bob, json.valueToTree(Map.of(
                "type", "loaded", "roomId", roomId, "raceId", secondRaceId)));
            assertEquals("countdown", ((Map<String, Object>) countdown.get("room")).get("phase"));
            ApiError tooLate = assertThrows(ApiError.class, () ->
                lobby.handle(bob, json.valueToTree(Map.of(
                    "type", "load-failed", "roomId", roomId, "raceId", secondRaceId))));
            assertEquals("RACE_NOT_LOADING", tooLate.getMessage());

            Map<String, Object> left = lobby.handle(bob, json.valueToTree(Map.of(
                "type", "leave", "roomId", roomId)));
            assertEquals("left", left.get("type"));
            Map<String, Object> last = aliceEvents.getLast();
            Map<String, Object> recovered = (Map<String, Object>) last.get("room");
            assertEquals("open", recovered.get("phase"));
            assertEquals("MEMBER_LEFT", recovered.get("raceError"));
            assertFalse(recovered.containsKey("race"));
            assertEquals(1, ((List<?>) recovered.get("members")).size());
        } finally {
            lobby.stop();
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void departedReturnDoesNotEndPodiumForRemainingPlayers() throws Exception {
        Database database = new Database(dataDirectory.toString());
        LobbyService lobby = new LobbyService(new Accounts(database), database, json);
        try {
            LobbyService.Client alice = connect(lobby, "Alice");
            LobbyService.Client bob = connect(lobby, "Bob");
            LobbyService.Client carol = connect(lobby, "Carol");
            Map<String, Object> created = lobby.handle(alice, json.valueToTree(Map.of(
                "type", "create", "name", "Three Racers", "capacity", 3,
                "password", "", "channelName", "speedIndiCombine",
                "gameplay", "ordinary", "mode", "individual",
                "speed", 7, "speedVersion", "国服")));
            Map<String, Object> room = (Map<String, Object>) created.get("room");
            String roomId = (String) room.get("roomId");
            room = (Map<String, Object>) lobby.handle(bob, json.valueToTree(Map.of(
                "type", "join", "roomId", roomId))).get("room");
            room = (Map<String, Object>) lobby.handle(carol, json.valueToTree(Map.of(
                "type", "join", "roomId", roomId))).get("room");
            room = (Map<String, Object>) lobby.handle(bob, json.valueToTree(Map.of(
                "type", "ready", "roomId", roomId, "revision",
                room.get("revision"), "ready", true))).get("room");
            room = (Map<String, Object>) lobby.handle(carol, json.valueToTree(Map.of(
                "type", "ready", "roomId", roomId, "revision",
                room.get("revision"), "ready", true))).get("room");
            room = (Map<String, Object>) lobby.handle(alice, json.valueToTree(Map.of(
                "type", "start", "roomId", roomId,
                "revision", room.get("revision")))).get("room");
            String raceId = (String) ((Map<String, Object>) room.get("race")).get("raceId");
            for (LobbyService.Client player : List.of(alice, bob, carol))
                lobby.handle(player, json.valueToTree(Map.of(
                    "type", "loaded", "roomId", roomId, "raceId", raceId)));
            Thread.sleep(3_200);
            for (int index = 0; index < 3; index++) {
                LobbyService.Client player = List.of(alice, bob, carol).get(index);
                room = (Map<String, Object>) lobby.handle(player, json.valueToTree(Map.of(
                    "type", "finish", "roomId", roomId, "raceId", raceId,
                    "elapsedMs", 10_000 + index * 1_000))).get("room");
            }
            assertEquals("finished", room.get("phase"));
            lobby.handle(alice, json.valueToTree(Map.of(
                "type", "return-room", "roomId", roomId, "raceId", raceId)));
            lobby.handle(alice, json.valueToTree(Map.of("type", "leave", "roomId", roomId)));
            room = (Map<String, Object>) lobby.handle(bob, json.valueToTree(Map.of(
                "type", "return-room", "roomId", roomId, "raceId", raceId))).get("room");
            assertEquals("finished", room.get("phase"));
            room = (Map<String, Object>) lobby.handle(carol, json.valueToTree(Map.of(
                "type", "return-room", "roomId", roomId, "raceId", raceId))).get("room");
            assertEquals("open", room.get("phase"));
        } finally {
            lobby.stop();
        }
    }

    private LobbyService.Client connect(LobbyService lobby, String name) {
        return connect(lobby, name, new ArrayList<>());
    }

    private LobbyService.Client connect(LobbyService lobby, String name,
                                        List<Map<String, Object>> events) {
        LobbyService.Client client = new LobbyService.Client(UUID.randomUUID().toString(),
            events::add, frame -> {});
        lobby.handle(client, json.valueToTree(Map.of("type", "hello",
            "protocolVersion", 39, "ruleset", "launcher-room-v1",
            "resourceVersion", "p3553", "name", name, "initial", "",
            "raceRuntime", true, "equipment", equipment())));
        return client;
    }

    private static Map<String, Object> equipment() {
        int[] slots = {1,2,3,4,8,9,10,11,12,16,17,18,20,21,52,26,27,30,31,
            32,36,43,45,44,46,58,59,61,70,68,69,71,76,77,78};
        Map<String, Integer> ids = new LinkedHashMap<>();
        for (int slot : slots) ids.put(String.valueOf(slot),
            slot == 1 || slot == 3 ? 1 : 0);
        return Map.of("itemIds", ids, "kartSerial", 0,
            "valueAt3E", 0, "exceedType", 0);
    }

    private JsonNode savedRules(Database database, String roomId) {
        return database.transaction(connection -> {
            try (var query = connection.prepareStatement(
                    "SELECT json FROM room_rules WHERE room_id=?")) {
                query.setString(1, roomId);
                try (var rows = query.executeQuery()) {
                    if (!rows.next()) throw new AssertionError("Room rules not saved");
                    return json.readTree(rows.getString(1));
                }
            }
        });
    }
}

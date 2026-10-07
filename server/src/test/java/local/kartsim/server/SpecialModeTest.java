package local.kartsim.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SpecialModeTest {
    @TempDir Path directory;
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void lateJoinerWaitsWithoutBlockingTheRace() throws Exception {
        try (Fixture fixture = new Fixture(directory.resolve("late"))) {
            List<LobbyService.Client> players = fixture.connect(3);
            List<LobbyService.Client> racers = players.subList(0, 2);
            LobbyService.Client late = players.get(2);
            Map<String, Object> room = fixture.joinAndReady(racers,
                fixture.create(racers, "ordinary", "speedIndiCombine", 8));
            String roomId = (String) room.get("roomId");
            room = fixture.command(racers.getFirst(), Map.of("type", "start",
                "roomId", roomId, "revision", room.get("revision")));
            String raceId = (String) race(room).get("raceId");

            room = fixture.command(late, Map.of("type", "join", "roomId", roomId));
            assertEquals(3, ((List<?>) room.get("members")).size());
            assertEquals("NOT_RACE_PARTICIPANT", fixture.error(() -> fixture.command(late,
                Map.of("type", "loaded", "roomId", roomId, "raceId", raceId))));
            for (LobbyService.Client racer : racers)
                room = fixture.command(racer, Map.of("type", "loaded",
                    "roomId", roomId, "raceId", raceId));
            assertEquals("countdown", room.get("phase"));
        }
    }

    @Test
    void roadblockUsesRunnerDeadlineAndPersistsAnOutcome() throws Exception {
        try (Fixture fixture = new Fixture(directory.resolve("roadblock"))) {
            List<LobbyService.Client> players = fixture.connect(5);
            Map<String, Object> room = fixture.create(players, "roadblock",
                "speedIndiCombine", 5);
            String roomId = (String) room.get("roomId");
            assertEquals(0, room.get("randomTrackCode"));
            assertFalse(room.containsKey("trackId"));
            assertEquals("TRACK_FIXED_TO_RANDOM", fixture.error(() -> fixture.command(
                players.getFirst(), Map.of("type", "track", "roomId", roomId,
                    "trackId", "village_R01"))));

            room = fixture.joinAndReady(players, room);
            room = fixture.command(players.getFirst(), Map.of("type", "start",
                "roomId", roomId, "revision", room.get("revision")));
            Map<String, Object> race = race(room);
            String raceId = (String) race.get("raceId");
            Map<String, Object> startSlots = cast(race.get("startSlots"));
            assertEquals(players.size(), startSlots.size());
            for (int index = 0; index < players.size(); index++)
                assertEquals(index, startSlots.get(players.get(index).playerId));
            assertTrue(GameModes.ROADBLOCK_TRACKS.contains(race.get("trackId")));
            assertEquals(Map.of("ruleset", "web-roadblock-v1",
                "runnerId", players.getFirst().playerId, "limitMs", 180_000,
                "noRunnerManualReset", true), race.get("roadblock"));
            assertFalse(race.containsKey("finishDeadline"));

            for (LobbyService.Client player : players)
                room = fixture.command(player, Map.of("type", "loaded",
                    "roomId", roomId, "raceId", raceId));
            race = race(room);
            assertEquals("countdown", room.get("phase"));
            assertEquals((long) race.get("startAt") + 180_000L,
                race.get("finishDeadline"));
            assertFalse(race.containsKey("finishWindowMs"));
            Thread.sleep(3_100);
            assertEquals("RUNNER_REQUIRED", fixture.error(() -> fixture.command(
                players.get(1), Map.of("type", "finish", "roomId", roomId,
                    "raceId", raceId, "elapsedMs", 1_000))));
            room = fixture.command(players.getFirst(), Map.of("type", "finish",
                "roomId", roomId, "raceId", raceId, "elapsedMs", 1_000));
            race = race(room);
            assertEquals("finished", room.get("phase"));
            assertEquals(startSlots, race.get("startSlots"));
            assertEquals(List.of(), race.get("results"));
            Map<String, Object> outcome = cast(race.get("roadblockOutcome"));
            assertEquals(true, outcome.get("runnerWon"));
            assertEquals("finish", outcome.get("reason"));
            assertEquals((long) outcome.get("endAt") + 3_000L, race.get("raceOverAt"));
            Map<String, Object> finish = cast(((List<?>) race.get("finishes")).getFirst());
            assertEquals((int) ((long) outcome.get("endAt") - (long) race.get("startAt")),
                finish.get("elapsedMs"));
            assertEquals(1, fixture.savedOutcomeCount(raceId, "finish"));
        }
    }

    @Test
    void roadblockRunnerLeaveAndTimeoutGiveBlockersTheWin() throws Exception {
        for (String reason : List.of("runner-left", "timeout")) {
            try (Fixture fixture = new Fixture(directory.resolve(reason))) {
                List<LobbyService.Client> players = fixture.connect(5);
                Map<String, Object> room = fixture.create(players, "roadblock",
                    "speedIndiCombine", 5);
                room = fixture.joinAndReady(players, room);
                String roomId = (String) room.get("roomId");
                room = fixture.command(players.getFirst(), Map.of("type", "start",
                    "roomId", roomId, "revision", room.get("revision")));
                String raceId = (String) race(room).get("raceId");
                for (LobbyService.Client player : players)
                    fixture.command(player, Map.of("type", "loaded",
                        "roomId", roomId, "raceId", raceId));
                Thread.sleep(3_100);
                if (reason.equals("runner-left"))
                    fixture.raw(players.getFirst(), Map.of("type", "leave", "roomId", roomId));
                else fixture.lobby.roadblockTimeout(roomId, raceId);
                List<Map<String, Object>> peerEvents = fixture.events.get(players.get(1).playerId);
                room = cast(peerEvents.getLast().get("room"));
                assertEquals("finished", room.get("phase"));
                assertEquals(reason.equals("runner-left") ?
                    players.get(1).playerId : players.getFirst().playerId,
                    room.get("hostId"));
                Map<String, Object> race = race(room);
                Map<String, Object> outcome = cast(race.get("roadblockOutcome"));
                assertEquals(false, outcome.get("runnerWon"));
                assertEquals(reason, outcome.get("reason"));
                assertFalse(race.containsKey("finishes"));
                assertEquals(List.of(), race.get("results"));
                assertEquals(1, fixture.savedOutcomeCount(raceId, reason));
            }
        }
    }

    @Test
    void giantRelaysOnlyOrderedLegalStateChanges() throws Exception {
        try (Fixture fixture = new Fixture(directory.resolve("giant"))) {
            List<LobbyService.Client> players = fixture.connect(2);
            Map<String, Object> room = fixture.create(players, "giant",
                "speedIndiCombine", 2);
            room = fixture.joinAndReady(players, room);
            String roomId = (String) room.get("roomId");
            room = fixture.command(players.getFirst(), Map.of("type", "start",
                "roomId", roomId, "revision", room.get("revision")));
            Map<String, Object> race = race(room);
            String raceId = (String) race.get("raceId");
            assertTrue(GameModes.GIANT_TRACKS.contains(race.get("trackId")));
            assertEquals(Map.of("ruleset", "p948-giant-p3553-web-v1"), race.get("giant"));
            for (LobbyService.Client player : players)
                fixture.command(player, Map.of("type", "loaded",
                    "roomId", roomId, "raceId", raceId));
            Thread.sleep(3_100);
            assertEquals("INVALID_GIANT_STATE", fixture.error(() -> fixture.raw(
                players.getFirst(), Map.of("type", "giant-state", "roomId", roomId,
                    "raceId", raceId, "sequence", 1, "main", 0,
                    "extra", 0, "status", 0))));
            Map<String, Object> state = fixture.raw(players.getFirst(), Map.of(
                "type", "giant-state", "roomId", roomId, "raceId", raceId,
                "sequence", 1, "main", 1, "extra", 0, "status", 0));
            assertEquals(players.getFirst().playerId, state.get("playerId"));
            assertTrue(fixture.events.get(players.get(1).playerId).stream()
                .anyMatch(event -> event.equals(state)));
            assertEquals("INVALID_SEQUENCE", fixture.error(() -> fixture.raw(
                players.getFirst(), Map.of("type", "giant-state", "roomId", roomId,
                    "raceId", raceId, "sequence", 3, "main", 2,
                    "extra", 0, "status", 0))));
            fixture.raw(players.getFirst(), Map.of("type", "giant-state", "roomId", roomId,
                "raceId", raceId, "sequence", 2, "main", 1,
                "extra", 0, "status", 1));
        }
    }

    @Test
    void teamChargeBroadcastsMeterAndAwardMotionToPeers() throws Exception {
        try (Fixture fixture = new Fixture(directory.resolve("team-gauge"))) {
            List<LobbyService.Client> players = fixture.connect(4);
            Map<String, Object> room = fixture.create(players, "ordinary",
                "speedTeamCombine", 4);
            room = fixture.joinAndReady(players, room);
            String roomId = (String) room.get("roomId");
            room = fixture.command(players.getFirst(), Map.of("type", "start",
                "roomId", roomId, "revision", room.get("revision")));
            String raceId = (String) race(room).get("raceId");
            Map<String, Object> slots = cast(race(room).get("startSlots"));
            assertEquals(List.of(0, 4, 1, 5), players.stream()
                .map(player -> slots.get(player.playerId)).toList());
            for (LobbyService.Client player : players)
                fixture.command(player, Map.of("type", "loaded",
                    "roomId", roomId, "raceId", raceId));
            Thread.sleep(3_100);
            LobbyService.Client host = players.getFirst();
            Map<String, Object> half = fixture.raw(host, Map.of("type", "team-charge",
                "roomId", roomId, "raceId", raceId, "sequence", 1,
                "charge", 4_000));
            assertEquals(1, half.get("team"));
            assertEquals(1, half.get("sequence"));
            assertEquals(0.5, half.get("target"));
            assertTrue(fixture.events.get(players.get(2).playerId).contains(half));
            Map<String, Object> full = fixture.raw(host, Map.of("type", "team-charge",
                "roomId", roomId, "raceId", raceId, "sequence", 2,
                "charge", 4_000));
            assertEquals(1.0, full.get("target"));
            Map<String, Object> reset = fixture.raw(players.get(2), Map.of(
                "type", "team-charge", "roomId", roomId, "raceId", raceId,
                "sequence", 1, "charge", 800));
            assertEquals(3, reset.get("sequence"));
            assertEquals(0.1, reset.get("target"));
            assertEquals("INVALID_SEQUENCE", fixture.error(() -> fixture.raw(
                host, Map.of("type", "team-charge", "roomId", roomId,
                    "raceId", raceId, "sequence", 4, "charge", 100))));
            Map<String, Object> award = fixture.raw(host, Map.of(
                "type", "award-motion", "roomId", roomId,
                "raceId", raceId, "motion", 12));
            assertEquals(host.playerId, award.get("playerId"));
            assertTrue(fixture.events.get(players.get(1).playerId).contains(award));
        }
    }

    @Test
    void rpAndLtePublishModeDataAndCompatibleTracks() throws Exception {
        for (String gameplay : List.of("rp", "lte")) {
            try (Fixture fixture = new Fixture(directory.resolve(gameplay))) {
                List<LobbyService.Client> players = fixture.connect(2);
                String channel = gameplay.equals("rp") ? "speedIndiInfinit" :
                    "speedIndiCombine";
                Map<String, Object> room = fixture.create(players, gameplay, channel, 2);
                if (gameplay.equals("lte")) {
                    assertEquals(0, room.get("randomTrackCode"));
                    assertFalse(room.containsKey("trackId"));
                }
                room = fixture.joinAndReady(players, room);
                room = fixture.command(players.getFirst(), Map.of("type", "start",
                    "roomId", room.get("roomId"), "revision", room.get("revision")));
                Map<String, Object> race = race(room);
                if (gameplay.equals("lte")) {
                    assertTrue(GameModes.LTE_TRACKS.contains(race.get("trackId")));
                    assertEquals(Map.of("ruleset", "web-lte-v1",
                        "featureSet", "dodge-trial"), race.get("lte"));
                } else {
                    Map<String, Object> rp = cast(race.get("rp"));
                    assertEquals("web-rp-speed-v1", rp.get("ruleset"));
                    assertTrue(((String) rp.get("poolRevision"))
                        .matches("[a-f0-9]{64}"));
                    Map<String, Object> draws = cast(rp.get("draws"));
                    assertEquals(2, draws.size());
                    for (LobbyService.Client player : players) {
                        Map<String, Object> draw = cast(draws.get(player.playerId));
                        assertNotNull(draw);
                        assertTrue(List.of(387, 390, 378, 361).contains(draw.get("kartId")));
                        assertEquals(0, draw.get("flyingPetId"));
                    }
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Object value) {
        return (Map<String, Object>) value;
    }
    private static Map<String, Object> race(Map<String, Object> room) {
        return cast(room.get("race"));
    }

    private final class Fixture implements AutoCloseable {
        final Database database;
        final LobbyService lobby;
        final Map<String, List<Map<String, Object>>> events = new LinkedHashMap<>();

        Fixture(Path dataDir) throws Exception {
            database = new Database(dataDir.toString());
            lobby = new LobbyService(new Accounts(database), database, json);
        }

        List<LobbyService.Client> connect(int count) {
            List<LobbyService.Client> players = new ArrayList<>();
            for (int index = 0; index < count; index++) {
                String name = "Player" + index;
                List<Map<String, Object>> messages = new ArrayList<>();
                LobbyService.Client client = new LobbyService.Client(UUID.randomUUID().toString(),
                    messages::add, frame -> {});
                raw(client, Map.of("type", "hello", "protocolVersion", 39,
                    "ruleset", "launcher-room-v1", "resourceVersion", "p3553",
                    "name", name, "initial", "", "equipment", equipment()));
                events.put(client.playerId, messages);
                players.add(client);
            }
            return players;
        }

        Map<String, Object> create(List<LobbyService.Client> players, String gameplay,
                                   String channel, int capacity) {
            String mode = channel.contains("Team") ? "team" : "individual";
            int speed = channel.endsWith("Infinit") ? 4 : 7;
            return command(players.getFirst(), Map.of(
                "type", "create", "name", "Special Race", "capacity", capacity,
                "password", "", "channelName", channel, "gameplay", gameplay,
                "mode", mode, "speed", speed, "speedVersion", "国服"));
        }

        Map<String, Object> joinAndReady(List<LobbyService.Client> players,
                                         Map<String, Object> room) {
            String roomId = (String) room.get("roomId");
            for (int index = 1; index < players.size(); index++)
                room = command(players.get(index), Map.of("type", "join", "roomId", roomId));
            for (int index = 1; index < players.size(); index++)
                room = command(players.get(index), Map.of("type", "ready",
                    "roomId", roomId, "revision", room.get("revision"), "ready", true));
            return room;
        }

        Map<String, Object> command(LobbyService.Client client, Map<String, Object> request) {
            return cast(raw(client, request).get("room"));
        }

        Map<String, Object> raw(LobbyService.Client client, Map<String, Object> request) {
            return lobby.handle(client, json.valueToTree(request));
        }

        String error(Runnable action) {
            return assertThrows(ApiError.class, action::run).getMessage();
        }

        int savedOutcomeCount(String raceId, String reason) {
            return database.transaction(connection -> {
                try (var query = connection.prepareStatement(
                        "SELECT json FROM race_outcomes WHERE race_id=?")) {
                    query.setString(1, raceId);
                    try (var rows = query.executeQuery()) {
                        if (!rows.next()) return 0;
                        JsonNode stored = json.readTree(rows.getString("json"));
                        assertEquals(reason, stored.path("race")
                            .path("roadblockOutcome").path("reason").asText());
                        return 1;
                    }
                }
            });
        }

        @Override public void close() { lobby.stop(); }
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
}

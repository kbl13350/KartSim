package local.kartsim.server;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/** The track and race data required by each client gameplay mode. */
final class GameModes {
    static final int ROADBLOCK_LIMIT_MS = 180_000;

    static final List<String> ROADBLOCK_TRACKS = List.of(
        "desert_I01", "village_I02", "village_R01", "ice_I05", "ice_R04",
        "tomb_I01", "tomb_R01", "mine_I02", "fairy_I04", "china_I02",
        "castle_I02", "castle_I03", "castle_I06", "park_R01", "steam_I01",
        "jurassic_R01", "forest_I01_rvs", "forest_I05_rvs", "forest_I07_rvs",
        "village_I01_rvs", "village_I13_rvs", "ice_I02_rvs", "ice_I04_rvs",
        "northeu_I04_rvs");
    static final List<String> GIANT_TRACKS = List.of(
        "village_R01", "village_I04", "village_I05", "forest_I03", "forest_I04",
        "forest_I05", "forest_I07", "desert_I03", "ice_I03", "tomb_I04",
        "pirate_I03", "moonhill_I01", "moonhill_I03", "gold_I01", "gold_I03",
        "china_I01", "china_I04");
    static final List<String> LTE_TRACKS = List.of(
        "jurassic_R02", "beach_R05", "moonhill_R06");
    private static final List<String> DEFAULT_TRACKS = List.of(
        "village_R01", "desert_I01", "forest_I01", "ice_I03");

    private GameModes() {}

    static void validateCreation(String gameplay, String channel, String version,
                                 int capacity) {
        if (!List.of("ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp")
                .contains(gameplay)) throw new ApiError(400, "INVALID_GAMEPLAY");
        if (!gameplay.equals("ordinary") && !version.equals("p3553"))
            throw new ApiError(400, "RESOURCE_VERSION_UNSUPPORTED");
        if (List.of("roadblock", "giant").contains(gameplay) &&
            !channel.equals("speedIndiCombine"))
            throw new ApiError(400, "INVALID_CHANNEL");
        if (List.of("grip", "lte").contains(gameplay) && !channel.endsWith("Combine"))
            throw new ApiError(400, "INVALID_CHANNEL");
        if (gameplay.equals("roadblock") && capacity < 5)
            throw new ApiError(400, "NOT_ENOUGH_PLAYERS");
    }

    static void initializeTrack(Room room) {
        if (room.gameplay.equals("roadblock") || room.gameplay.equals("lte")) {
            room.trackId = null;
            room.randomTrackCode = 0;
        }
    }

    static void validateTrack(Room room, String trackId) {
        switch (room.gameplay) {
            case "roadblock", "lte" -> throw new ApiError(400, "TRACK_FIXED_TO_RANDOM");
            case "giant" -> {
                if (!GIANT_TRACKS.contains(trackId))
                    throw new ApiError(400, "INVALID_TRACK");
            }
            default -> { }
        }
    }

    static void validateRandomTrack(Room room, int code) {
        if (List.of("roadblock", "lte", "giant").contains(room.gameplay) && code != 0)
            throw new ApiError(400, "INVALID_TRACK");
    }

    static String chooseTrack(Room room) {
        if (room.trackId != null) return room.trackId;
        List<String> pool = switch (room.gameplay) {
            case "roadblock" -> ROADBLOCK_TRACKS;
            case "lte" -> LTE_TRACKS;
            case "giant" -> GIANT_TRACKS;
            default -> DEFAULT_TRACKS;
        };
        return pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
    }

    static void addRaceData(Room room, Room.Race race) {
        switch (room.gameplay) {
            case "roadblock" -> race.roadblock = Map.of(
                "ruleset", "web-roadblock-v1", "runnerId", room.hostId,
                "limitMs", ROADBLOCK_LIMIT_MS, "noRunnerManualReset", true);
            case "giant" -> race.giant = Map.of(
                "ruleset", "p948-giant-p3553-web-v1");
            case "lte" -> race.lte = Map.of(
                "ruleset", "web-lte-v1", "featureSet", "dodge-trial");
            case "rp" -> race.rp = rpDraws(room);
            default -> { }
        }
    }

    private static Map<String, Object> rpDraws(Room room) {
        // These four racing karts were checked against the local P3553 catalog,
        // model, parameter, animation-frame and texture resources. The server
        // cannot trust an arbitrary kart ID supplied in hello/equipment.
        List<Integer> availableKarts = List.of(387, 390, 378, 361);
        Map<String, Object> draws = new LinkedHashMap<>();
        for (Room.Member member : room.members) {
            int kart = availableKarts.get(ThreadLocalRandom.current()
                .nextInt(availableKarts.size()));
            draws.put(member.playerId, Map.of("kartId", kart, "flyingPetId", 0));
        }
        return Map.of("ruleset", "web-rp-speed-v1",
            "poolRevision", sha256(availableKarts.toString()), "draws", draws);
    }

    private static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("Java runtime has no SHA-256", error);
        }
    }
}

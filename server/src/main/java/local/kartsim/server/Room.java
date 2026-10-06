package local.kartsim.server;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Authoritative in-memory room. Only persistent records are written to SQLite. */
public class Room {
    public final String id;
    public String name;
    public String password;
    public final String mode;
    public final String channelName;
    public final String gameplay;
    public final String resourceVersion;
    public final int capacity;
    public final int speed;
    public String hostId;
    public String phase = "open";
    public String trackId = "village_R01";
    public Integer randomTrackCode;
    public int revision = 1;
    public String raceError;
    public Race race;
    public KickVote kickVote;
    public final List<Member> members = new ArrayList<>();
    public final List<Map<String, Object>> chat = new ArrayList<>();
    public int chatSequence;
    public final List<Integer> closedSlots = new ArrayList<>();

    public Room(String id, String name, String password, String mode, String channelName,
                String gameplay, String resourceVersion, int capacity, int speed, String hostId) {
        this.id = id;
        this.name = name;
        this.password = password;
        this.mode = mode;
        this.channelName = channelName;
        this.gameplay = gameplay;
        this.resourceVersion = resourceVersion;
        this.capacity = capacity;
        this.speed = speed;
        this.hostId = hostId;
    }

    public Member member(String playerId) {
        return members.stream().filter(value -> value.playerId.equals(playerId)).findFirst().orElse(null);
    }

    public Map<String, Object> summary() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("roomId", id);
        value.put("name", name);
        value.put("mode", mode);
        value.put("capacity", capacity);
        value.put("speedVersion", "国服");
        value.put("channelName", channelName);
        value.put("speed", speed);
        value.put("gameplay", gameplay);
        value.put("resourceVersion", resourceVersion);
        value.put("count", members.size());
        value.put("locked", !password.isEmpty());
        value.put("gaming", !phase.equals("open"));
        if (trackId != null) value.put("trackId", trackId);
        if (randomTrackCode != null) value.put("randomTrackCode", randomTrackCode);
        return value;
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("roomId", id);
        value.put("revision", revision);
        value.put("name", name);
        value.put("mode", mode);
        value.put("capacity", capacity);
        value.put("speedVersion", "国服");
        value.put("channelName", channelName);
        value.put("speed", speed);
        value.put("gameplay", gameplay);
        value.put("resourceVersion", resourceVersion);
        value.put("hostId", hostId);
        value.put("phase", phase);
        if (trackId != null) value.put("trackId", trackId);
        if (randomTrackCode != null) value.put("randomTrackCode", randomTrackCode);
        value.put("locked", !password.isEmpty());
        value.put("members", members.stream().map(Member::snapshot).toList());
        if (!chat.isEmpty()) value.put("chat", List.copyOf(chat));
        if (!closedSlots.isEmpty()) value.put("closedSlots", List.copyOf(closedSlots));
        if (raceError != null) value.put("raceError", raceError);
        if (kickVote != null) value.put("kickVote", kickVote.snapshot());
        if (race != null) value.put("race", race.snapshot());
        return value;
    }

    public static class KickVote {
        public final String id;
        public final String targetId;
        public final List<String> eligibleIds;
        public final List<String> yesIds = new ArrayList<>();
        public final List<String> noIds = new ArrayList<>();
        public final long deadline;

        public KickVote(String id, String targetId, List<String> eligibleIds, long deadline) {
            this.id = id;
            this.targetId = targetId;
            this.eligibleIds = eligibleIds;
            this.deadline = deadline;
        }

        public Map<String, Object> snapshot() {
            return Map.of("voteId", id, "targetId", targetId,
                "eligibleIds", eligibleIds, "yesIds", List.copyOf(yesIds),
                "noIds", List.copyOf(noIds), "deadline", deadline);
        }
    }

    public static class Member {
        public final String playerId;
        public final String name;
        public int slot;
        public boolean ready;
        public Integer team;
        public Object equipment;
        public String initial;
        public boolean changing;

        public Member(String playerId, String name, int slot, Integer team,
                      Object equipment, String initial) {
            this.playerId = playerId;
            this.name = name;
            this.slot = slot;
            this.team = team;
            this.equipment = equipment;
            this.initial = initial;
        }

        public Map<String, Object> snapshot() {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("playerId", playerId);
            value.put("name", name);
            value.put("slot", slot);
            value.put("ready", ready);
            value.put("team", team);
            if (equipment != null) value.put("equipment", equipment);
            if (initial != null) value.put("initial", initial);
            if (changing) value.put("changing", true);
            return value;
        }
    }

    public static class Race {
        public final String id;
        public final String channelName;
        public final String gameplay;
        public final String trackId;
        public final long loadingDeadline;
        public final List<Map<String, Object>> roster;
        public final List<String> loadedIds = new ArrayList<>();
        public final List<String> returnedIds = new ArrayList<>();
        public final List<Map<String, Object>> finishes = new ArrayList<>();
        public List<Map<String, Object>> results;
        public Long startAt;
        public Long finishDeadline;
        public Long raceOverAt;
        public Integer winningTeam;
        public Map<Integer, Integer> teamScores;

        public Race(String id, String channelName, String gameplay, String trackId,
                    long loadingDeadline, List<Map<String, Object>> roster) {
            this.id = id;
            this.channelName = channelName;
            this.gameplay = gameplay;
            this.trackId = trackId;
            this.loadingDeadline = loadingDeadline;
            this.roster = roster;
        }

        public Map<String, Object> snapshot() {
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("raceId", id);
            value.put("channelName", channelName);
            value.put("gameplay", gameplay);
            value.put("trackId", trackId);
            value.put("loadingDeadline", loadingDeadline);
            value.put("roster", roster);
            value.put("loadedIds", List.copyOf(loadedIds));
            if (startAt != null) value.put("startAt", startAt);
            if (finishDeadline != null) {
                value.put("finishWindowMs", 10_000);
                value.put("finishDeadline", finishDeadline);
            }
            if (!finishes.isEmpty()) value.put("finishes", List.copyOf(finishes));
            if (raceOverAt != null) value.put("raceOverAt", raceOverAt);
            if (results != null) value.put("results", results);
            if (winningTeam != null) value.put("winningTeam", winningTeam);
            if (teamScores != null) value.put("teamScores", teamScores);
            if (!returnedIds.isEmpty()) value.put("returnedIds", List.copyOf(returnedIds));
            return value;
        }
    }
}

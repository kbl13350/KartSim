package local.kartsim.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import java.nio.ByteBuffer;
import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.springframework.stereotype.Service;

/**
 * Local authority for room state. One synchronized command changes one room,
 * then publishes a snapshot with a greater revision to every other member.
 */
@Service
public class LobbyService {
    private static final long START_NANOS = System.nanoTime();
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final Map<String, Client> clients = new HashMap<>();
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    private final Accounts accounts;
    private final Database database;
    private final ObjectMapper json;

    public static class Client {
        public final String connectionId;
        private final Consumer<Map<String, Object>> sendText;
        private final Consumer<byte[]> sendBinary;
        public String playerId;
        public String name;
        public String resourceVersion;
        public String roomId;
        public Object equipment;
        public String initial;

        public Client(String connectionId, Consumer<Map<String, Object>> sendText,
                      Consumer<byte[]> sendBinary) {
            this.connectionId = connectionId;
            this.sendText = sendText;
            this.sendBinary = sendBinary;
        }
        public void emit(Map<String, Object> message) { sendText.accept(message); }
        public void motion(byte[] frame) { sendBinary.accept(frame); }
    }

    public LobbyService(Accounts accounts, Database database, ObjectMapper json) {
        this.accounts = accounts;
        this.database = database;
        this.json = json;
    }

    @PreDestroy
    public void stop() { timer.shutdownNow(); }

    public synchronized boolean liveNameAvailable(String name) {
        return clients.values().stream().noneMatch(client ->
            client.name != null && client.name.equalsIgnoreCase(name));
    }

    public synchronized Map<String, Object> handle(Client client, JsonNode input) {
        String type = text(input, "type", 1, 40);
        if (!type.equals("hello") && client.playerId == null)
            throw new ApiError(400, "HELLO_REQUIRED");
        return switch (type) {
            case "hello" -> hello(client, input);
            case "clock" -> clock(input);
            case "list-ordinary", "list-gameplay" -> list(type, input);
            case "create" -> create(client, input);
            case "join" -> join(client, input);
            case "leave" -> leave(client, input);
            case "get-room-settings" -> getSettings(client, input);
            case "chat" -> chat(client, input, false);
            case "race-chat" -> chat(client, input, true);
            case "ready", "team", "track", "random-track", "slot", "kick",
                 "kick-vote", "transfer-host", "equipment", "changing", "room-settings" ->
                mutate(client, type, input);
            case "start" -> start(client, input);
            case "loaded" -> loaded(client, input);
            case "load-failed" -> loadFailed(client, input);
            case "finish" -> finish(client, input);
            case "return-room" -> returnRoom(client, input);
            case "giant-state" -> giantState(client, input);
            case "team-charge" -> teamCharge(client, input);
            case "award-motion" -> awardMotion(client, input);
            default -> throw new ApiError(400, "UNSUPPORTED_COMMAND");
        };
    }

    public synchronized void disconnect(Client client) {
        if (client.playerId == null) return;
        clients.remove(client.playerId);
        if (client.roomId != null) leaveInternal(client, null);
    }

    public synchronized void relayMotion(Client client, byte[] frame) {
        if (client.roomId == null || frame.length < 136 || frame.length > 234) return;
        ByteBuffer header = ByteBuffer.wrap(frame).order(java.nio.ByteOrder.LITTLE_ENDIAN);
        if (header.getShort(0) != 19_277 || frame[2] < 1 || frame[2] > 10) return;
        Room room = rooms.get(client.roomId);
        if (room == null || room.race == null ||
            !List.of("loading", "countdown", "racing").contains(room.phase) ||
            !uuidAt(frame, 4).equals(room.id) || !uuidAt(frame, 20).equals(room.race.id) ||
            !uuidAt(frame, 36).equals(client.playerId) ||
            !room.race.loadedIds.contains(client.playerId)) return;
        int recipientMask = frame[3] & 0xff;
        for (Room.Member member : room.members) {
            if (member.playerId.equals(client.playerId) ||
                (recipientMask & (1 << member.slot)) == 0 ||
                !room.race.loadedIds.contains(member.playerId)) continue;
            Client recipient = clients.get(member.playerId);
            if (recipient != null) recipient.motion(frame);
        }
    }

    private Map<String, Object> hello(Client client, JsonNode input) {
        if (client.playerId != null) throw new ApiError(400, "ALREADY_CONNECTED");
        if (integer(input, "protocolVersion", 0, 1000) != 39 ||
            !text(input, "ruleset", 1, 40).equals("launcher-room-v1"))
            throw new ApiError(400, "PROTOCOL_MISMATCH");
        String version = text(input, "resourceVersion", 1, 20);
        if (!List.of("p3528", "p3543", "p3553").contains(version))
            throw new ApiError(400, "RESOURCE_VERSION_UNSUPPORTED");
        String suppliedName = text(input, "name", 1, 18);
        String token = optionalText(input, "token", 100);
        Accounts.Account account = token == null ? null : accounts.require(token);
        if (account == null && !accounts.guestNameAvailable(suppliedName))
            throw new ApiError(409, "NICKNAME_TAKEN");
        String name = account != null ? account.nickname() : suppliedName;
        if (clients.values().stream().anyMatch(other -> other.name.equalsIgnoreCase(name)))
            throw new ApiError(409, "NICKNAME_TAKEN");
        client.playerId = UUID.randomUUID().toString();
        client.name = name;
        client.resourceVersion = version;
        client.equipment = validEquipment(input.get("equipment")) ? input.get("equipment") : null;
        client.initial = optionalText(input, "initial", 64);
        clients.put(client.playerId, client);
        return Map.of("type", "welcome", "playerId", client.playerId,
            "protocolVersion", 39, "ruleset", "launcher-room-v1",
            "capabilities", List.of());
    }

    private Map<String, Object> clock(JsonNode input) {
        JsonNode tick = input.get("clientTick");
        if (tick == null || !tick.isNumber() || tick.doubleValue() < 0 ||
            !Double.isFinite(tick.doubleValue()))
            throw new ApiError(400, "INVALID_CLOCK");
        return Map.of("type", "clock", "clientTick", tick.doubleValue(),
            "serverTick", now());
    }

    private Map<String, Object> list(String type, JsonNode input) {
        int page = integer(input, "page", 0, 100_000);
        String gameplay = type.equals("list-ordinary") ? "ordinary" :
            text(input, "gameplay", 1, 20);
        List<Map<String, Object>> matching = rooms.values().stream()
            .filter(room -> room.gameplay.equals(gameplay))
            .map(Room::summary).toList();
        int from = Math.min(matching.size(), page * 10);
        int to = Math.min(matching.size(), from + 10);
        return Map.of("type", "rooms", "page", page, "total", matching.size(),
            "rooms", matching.subList(from, to));
    }

    private Map<String, Object> create(Client client, JsonNode input) {
        if (client.roomId != null) throw new ApiError(400, "ALREADY_IN_ROOM");
        String channel = text(input, "channelName", 1, 40);
        String mode = switch (channel) {
            case "speedIndiCombine", "speedIndiInfinit" -> "individual";
            case "speedTeamCombine", "speedTeamInfinit" -> "team";
            default -> throw new ApiError(400, "INVALID_CHANNEL");
        };
        int speed = channel.endsWith("Infinit") ? 4 : 7;
        if (!mode.equals(text(input, "mode", 1, 20)) ||
            speed != integer(input, "speed", 4, 7) ||
            !"国服".equals(text(input, "speedVersion", 1, 10)))
            throw new ApiError(400, "INVALID_CHANNEL");
        String gameplay = optionalText(input, "gameplay", 20);
        if (gameplay == null) gameplay = "ordinary";
        String name = text(input, "name", 1, 18);
        int capacity = integer(input, "capacity", 2, 8);
        if (mode.equals("team") && capacity % 2 != 0) throw new ApiError(400, "INVALID_CAPACITY");
        GameModes.validateCreation(gameplay, channel, client.resourceVersion, capacity);
        String password = optionalText(input, "password", 12);
        if (password == null) password = "";
        Room room = new Room(UUID.randomUUID().toString(), name, password,
            mode, channel, gameplay, client.resourceVersion, capacity, speed, client.playerId);
        GameModes.initializeTrack(room);
        room.members.add(new Room.Member(client.playerId, client.name, 0,
            mode.equals("team") ? 1 : null, client.equipment, client.initial));
        rooms.put(room.id, room);
        client.roomId = room.id;
        saveRules(room);
        return roomReply(room);
    }

    private Map<String, Object> join(Client client, JsonNode input) {
        if (client.roomId != null) throw new ApiError(400, "ALREADY_IN_ROOM");
        Room room = requireRoom(text(input, "roomId", 1, 64));
        if (!room.phase.equals("open")) throw new ApiError(400, "ROOM_NOT_OPEN");
        if (!room.resourceVersion.equals(client.resourceVersion))
            throw new ApiError(400, "RESOURCE_VERSION_MISMATCH");
        if (!Objects.equals(room.password, optionalText(input, "password", 12) == null ?
                "" : optionalText(input, "password", 12)))
            throw new ApiError(403, "INVALID_PASSWORD");
        if (room.members.size() >= room.capacity) throw new ApiError(400, "ROOM_FULL");
        int slot = availableSlot(room, room.mode.equals("team") ? preferredTeam(room) : null);
        if (slot < 0) throw new ApiError(400, "ROOM_FULL");
        Integer team = room.mode.equals("team") ? (slot < 4 ? 1 : 2) : null;
        room.members.add(new Room.Member(client.playerId, client.name, slot, team,
            client.equipment, client.initial));
        client.roomId = room.id;
        room.revision++;
        broadcastRoom(room, client);
        return roomReply(room);
    }

    private Map<String, Object> leave(Client client, JsonNode input) {
        Room room = memberRoom(client, input);
        leaveInternal(client, room);
        return Map.of("type", "left", "roomId", room.id);
    }

    private void leaveInternal(Client client, Room existing) {
        Room room = existing == null ? rooms.get(client.roomId) : existing;
        client.roomId = null;
        if (room == null) return;
        room.members.removeIf(member -> member.playerId.equals(client.playerId));
        room.kickVote = null;
        if (room.members.isEmpty()) {
            rooms.remove(room.id);
            return;
        }
        if (room.hostId.equals(client.playerId)) room.hostId = room.members.get(0).playerId;
        if (room.gameplay.equals("roadblock") && room.race != null &&
            room.phase.equals("racing")) {
            if (client.playerId.equals(room.race.roadblock.get("runnerId")))
                endRoadblock(room, "runner-left", Math.max(now(), room.race.startAt));
            else {
                room.revision++;
                broadcastRoom(room, null);
            }
            return;
        }
        if (room.phase.equals("finished") && room.race != null) {
            room.race.returnedIds.remove(client.playerId);
            closeRaceWhenReturned(room);
        }
        if (!room.phase.equals("open") && !room.phase.equals("finished")) {
            room.phase = "open";
            room.race = null;
            room.raceError = "MEMBER_LEFT";
        }
        room.revision++;
        broadcastRoom(room, null);
    }

    private Map<String, Object> getSettings(Client client, JsonNode input) {
        Room room = memberRoom(client, input);
        requireHost(room, client);
        return Map.of("type", "room-settings", "roomId", room.id,
            "revision", room.revision, "name", room.name, "password", room.password);
    }

    private Map<String, Object> mutate(Client client, String type, JsonNode input) {
        Room room = memberRoom(client, input);
        if (!room.phase.equals("open")) throw new ApiError(400, "ROOM_NOT_OPEN");
        if (input.has("revision") && integer(input, "revision", 1, Integer.MAX_VALUE) != room.revision)
            throw new ApiError(409, "STALE_REVISION");
        Room.Member member = room.member(client.playerId);
        switch (type) {
            case "ready" -> {
                if (room.hostId.equals(client.playerId)) throw new ApiError(400, "HOST_CANNOT_READY");
                member.ready = booleanField(input, "ready");
            }
            case "team" -> {
                if (!room.mode.equals("team")) throw new ApiError(400, "TEAM_REQUIRED");
                int team = integer(input, "team", 1, 2);
                int slot = availableSlot(room, team);
                if (slot < 0) throw new ApiError(400, "TEAM_FULL");
                member.slot = slot;
                member.team = team;
            }
            case "track" -> {
                requireHost(room, client);
                String track = text(input, "trackId", 1, 64);
                if (!track.matches("[A-Za-z][A-Za-z0-9_]{0,63}"))
                    throw new ApiError(400, "INVALID_TRACK");
                GameModes.validateTrack(room, track);
                room.trackId = track;
                room.randomTrackCode = null;
                saveRules(room);
            }
            case "random-track" -> {
                requireHost(room, client);
                if (!room.resourceVersion.equals("p3553"))
                    throw new ApiError(400, "RESOURCE_VERSION_UNSUPPORTED");
                int code = integer(input, "randomTrackCode", 0, 40);
                if (!List.of(0, 3, 4, 5, 6, 7, 8, 30, 40).contains(code))
                    throw new ApiError(400, "INVALID_TRACK");
                GameModes.validateRandomTrack(room, code);
                room.trackId = null;
                room.randomTrackCode = code;
                saveRules(room);
            }
            case "slot" -> {
                requireHost(room, client);
                int slot = integer(input, "slot", 0, 7);
                boolean closed = booleanField(input, "closed");
                if (room.mode.equals("team") ? slot % 4 >= room.capacity / 2 :
                    slot >= room.capacity)
                    throw new ApiError(400, "INVALID_SLOT");
                if (room.members.stream().anyMatch(value -> value.slot == slot))
                    throw new ApiError(400, "SLOT_OCCUPIED");
                room.closedSlots.remove(Integer.valueOf(slot));
                if (closed) room.closedSlots.add(slot);
            }
            case "kick" -> {
                requireHost(room, client);
                String target = text(input, "playerId", 1, 64);
                if (target.equals(client.playerId)) throw new ApiError(400, "INVALID_TARGET");
                if (room.member(target) == null)
                    throw new ApiError(400, "PLAYER_NOT_FOUND");
                if (room.kickVote != null) throw new ApiError(400, "VOTE_IN_PROGRESS");
                List<String> voters = room.members.stream()
                    .map(value -> value.playerId).filter(id -> !id.equals(target)).toList();
                room.kickVote = new Room.KickVote(UUID.randomUUID().toString(),
                    target, voters, now() + 20_000);
                room.kickVote.yesIds.add(client.playerId);
                String voteId = room.kickVote.id;
                if (voters.size() == 1) resolveVote(room);
                else timer.schedule(() -> voteTimeout(room.id, voteId), 20, TimeUnit.SECONDS);
            }
            case "kick-vote" -> {
                Room.KickVote vote = room.kickVote;
                if (vote == null || !vote.id.equals(text(input, "voteId", 1, 64)) ||
                    !vote.eligibleIds.contains(client.playerId) ||
                    vote.yesIds.contains(client.playerId) || vote.noIds.contains(client.playerId))
                    throw new ApiError(400, "VOTE_NOT_FOUND");
                (booleanField(input, "approve") ? vote.yesIds : vote.noIds).add(client.playerId);
                resolveVote(room);
            }
            case "transfer-host" -> {
                requireHost(room, client);
                if (room.kickVote != null) throw new ApiError(400, "VOTE_IN_PROGRESS");
                String target = text(input, "playerId", 1, 64);
                if (room.member(target) == null) throw new ApiError(400, "PLAYER_NOT_FOUND");
                room.hostId = target;
            }
            case "equipment" -> {
                if (!validEquipment(input.get("equipment")))
                    throw new ApiError(400, "INVALID_EQUIPMENT");
                member.equipment = input.get("equipment");
                member.ready = false;
            }
            case "changing" -> member.changing = booleanField(input, "changing");
            case "room-settings" -> {
                requireHost(room, client);
                room.name = text(input, "name", 1, 18);
                String password = optionalText(input, "password", 12);
                room.password = password == null ? "" : password;
                saveRules(room);
            }
            default -> throw new ApiError(400, "UNSUPPORTED_COMMAND");
        }
        room.revision++;
        broadcastRoom(room, client);
        return roomReply(room);
    }

    private Map<String, Object> chat(Client client, JsonNode input, boolean inRace) {
        Room room = memberRoom(client, input);
        if (inRace && (room.race == null ||
            !room.race.id.equals(text(input, "raceId", 1, 64))))
            throw new ApiError(400, "RACE_NOT_FOUND");
        String messageText = text(input, "text", 1, 120);
        if (messageText.isBlank()) throw new ApiError(400, "INVALID_CHAT");
        Map<String, Object> message = Map.of("sequence", ++room.chatSequence,
            "playerId", client.playerId, "name", client.name, "text", messageText);
        room.chat.add(message);
        if (room.chat.size() > 32) room.chat.remove(0);
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", inRace ? "race-chat" : "chat");
        event.put("roomId", room.id);
        if (inRace) event.put("raceId", room.race.id);
        event.put("message", message);
        broadcastPeerEvent(room, client, event);
        return event;
    }

    private Map<String, Object> start(Client client, JsonNode input) {
        Room room = memberRoom(client, input);
        requireHost(room, client);
        if (!room.phase.equals("open")) throw new ApiError(400, "ROOM_NOT_OPEN");
        if (integer(input, "revision", 1, Integer.MAX_VALUE) != room.revision)
            throw new ApiError(409, "STALE_REVISION");
        if (room.members.size() < 2) throw new ApiError(400, "NOT_ENOUGH_PLAYERS");
        if (room.gameplay.equals("roadblock") && room.members.size() < 5)
            throw new ApiError(400, "NOT_ENOUGH_PLAYERS");
        if (room.members.stream().anyMatch(member ->
                !member.playerId.equals(room.hostId) && !member.ready))
            throw new ApiError(400, "PLAYERS_NOT_READY");
        if (room.members.stream().anyMatch(member -> member.equipment == null))
            throw new ApiError(400, "EQUIPMENT_REQUIRED");
        if (room.mode.equals("team") &&
            (room.members.stream().noneMatch(member -> member.team != null && member.team == 1) ||
             room.members.stream().noneMatch(member -> member.team != null && member.team == 2)))
            throw new ApiError(400, "TEAM_REQUIRED");
        List<Map<String, Object>> roster = room.members.stream()
            .map(Room.Member::snapshot).toList();
        Map<String, Integer> startSlots = new LinkedHashMap<>();
        for (Room.Member member : room.members)
            startSlots.put(member.playerId, member.slot);
        long loadingWindowMs = List.of("roadblock", "giant", "rp", "lte")
            .contains(room.gameplay) ? 90_000 : 30_000;
        room.race = new Room.Race(UUID.randomUUID().toString(),
            room.channelName, room.gameplay, GameModes.chooseTrack(room),
            now() + loadingWindowMs, roster, startSlots);
        GameModes.addRaceData(room, room.race);
        room.kickVote = null;
        room.phase = "loading";
        room.raceError = null;
        room.revision++;
        String raceId = room.race.id;
        timer.schedule(() -> loadingTimeout(room.id, raceId),
            loadingWindowMs, TimeUnit.MILLISECONDS);
        broadcastRoom(room, client);
        return roomReply(room);
    }

    private synchronized void loadingTimeout(String roomId, String raceId) {
        Room room = rooms.get(roomId);
        if (room == null || room.race == null || !room.race.id.equals(raceId) ||
            !room.phase.equals("loading")) return;
        room.phase = "open";
        room.race = null;
        room.raceError = "LOAD_TIMEOUT";
        room.revision++;
        broadcastRoom(room, null);
    }

    private Map<String, Object> loaded(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!room.phase.equals("loading")) throw new ApiError(400, "RACE_NOT_LOADING");
        if (!room.race.loadedIds.contains(client.playerId))
            room.race.loadedIds.add(client.playerId);
        if (room.race.loadedIds.size() == room.members.size()) {
            room.race.startAt = now() + 3_000;
            if (room.gameplay.equals("roadblock")) {
                room.race.finishDeadline = room.race.startAt + GameModes.ROADBLOCK_LIMIT_MS;
                String raceId = room.race.id;
                timer.schedule(() -> roadblockTimeout(room.id, raceId),
                    GameModes.ROADBLOCK_LIMIT_MS + 3_000L, TimeUnit.MILLISECONDS);
            }
            room.phase = "countdown";
            String raceId = room.race.id;
            timer.schedule(() -> beginRace(room.id, raceId), 3, TimeUnit.SECONDS);
        }
        room.revision++;
        broadcastRoom(room, client);
        return roomReply(room);
    }

    private synchronized void beginRace(String roomId, String raceId) {
        Room room = rooms.get(roomId);
        if (room == null || room.race == null || !room.race.id.equals(raceId) ||
            !room.phase.equals("countdown")) return;
        room.phase = "racing";
        room.revision++;
        broadcastRoom(room, null);
    }

    private Map<String, Object> loadFailed(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!room.phase.equals("loading"))
            throw new ApiError(400, "RACE_NOT_LOADING");
        room.phase = "open";
        room.race = null;
        room.raceError = "LOAD_FAILED";
        room.revision++;
        broadcastRoom(room, client);
        return roomReply(room);
    }

    private Map<String, Object> finish(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!room.phase.equals("racing")) throw new ApiError(400, "RACE_NOT_RUNNING");
        int elapsed = integer(input, "elapsedMs", 0, Integer.MAX_VALUE);
        if (room.gameplay.equals("roadblock")) {
            if (!client.playerId.equals(room.race.roadblock.get("runnerId")))
                throw new ApiError(403, "RUNNER_REQUIRED");
            if (now() >= room.race.finishDeadline)
                endRoadblock(room, "timeout", room.race.finishDeadline);
            else endRoadblock(room, "finish", now());
            return roomReply(room);
        }
        if (room.race.finishes.stream().anyMatch(row -> row.get("playerId").equals(client.playerId)))
            throw new ApiError(400, "ALREADY_FINISHED");
        room.race.finishes.add(Map.of("playerId", client.playerId, "elapsedMs", elapsed));
        if (room.race.finishDeadline == null) {
            room.race.finishDeadline = now() + 10_000;
            String raceId = room.race.id;
            timer.schedule(() -> finalizeRace(room.id, raceId), 10, TimeUnit.SECONDS);
        }
        if (room.race.finishes.size() == room.race.loadedIds.size())
            finalizeRace(room.id, room.race.id);
        else {
            room.revision++;
            broadcastRoom(room, client);
        }
        return roomReply(room);
    }

    synchronized void roadblockTimeout(String roomId, String raceId) {
        Room room = rooms.get(roomId);
        if (room == null || room.race == null || !room.race.id.equals(raceId) ||
            !room.phase.equals("racing")) return;
        endRoadblock(room, "timeout", room.race.finishDeadline);
    }

    /** The runner is the only racer who can win; blockers win at the time limit. */
    private void endRoadblock(Room room, String reason, long observedAt) {
        Room.Race race = room.race;
        long endAt = Math.max(race.startAt, Math.min(observedAt, race.finishDeadline));
        String runnerId = (String) race.roadblock.get("runnerId");
        if (reason.equals("finish")) {
            race.finishes.add(Map.of("playerId", runnerId,
                "elapsedMs", (int) (endAt - race.startAt)));
        }
        race.roadblockOutcome = Map.of("runnerWon", reason.equals("finish"),
            "reason", reason, "endAt", endAt);
        race.raceOverAt = endAt + 3_000;
        race.results = List.of();
        room.phase = "finished";
        room.revision++;
        saveResults(room);
        broadcastRoom(room, null);
    }

    private Map<String, Object> giantState(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!room.gameplay.equals("giant") || !room.phase.equals("racing") ||
            !room.race.loadedIds.contains(client.playerId))
            throw new ApiError(400, "GIANT_STATE_UNAVAILABLE");
        int sequence = integer(input, "sequence", 1, Integer.MAX_VALUE);
        int main = integer(input, "main", 0, 4);
        int extra = integer(input, "extra", 0, 2);
        int status = integer(input, "status", 0, 1);
        if (main != 4 && extra != 0) throw new ApiError(400, "INVALID_GIANT_STATE");
        Room.GiantState previous = room.race.giantStates.get(client.playerId);
        int oldSequence = previous == null ? 0 : previous.sequence();
        int oldMain = previous == null ? 0 : previous.main();
        int oldExtra = previous == null ? 0 : previous.extra();
        if (sequence != oldSequence + 1) throw new ApiError(409, "INVALID_SEQUENCE");
        int next = (oldMain + oldExtra + 1) % 7;
        if (status == 1 ? main != oldMain || extra != oldExtra :
            main != Math.min(next, 4) || extra != Math.max(0, next - 4))
            throw new ApiError(400, "INVALID_GIANT_STATE");
        room.race.giantStates.put(client.playerId,
            new Room.GiantState(sequence, main, extra, status));
        Map<String, Object> event = Map.of("type", "giant-state",
            "roomId", room.id, "raceId", room.race.id, "playerId", client.playerId,
            "sequence", sequence, "main", main, "extra", extra, "status", status);
        broadcastPeerEvent(room, client, event);
        return event;
    }

    /** Sum the team's drift charge and publish the next normalized meter target. */
    private Map<String, Object> teamCharge(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!room.mode.equals("team") || room.speed == 4 ||
            room.gameplay.equals("grip") || !room.phase.equals("racing") ||
            !room.race.loadedIds.contains(client.playerId))
            throw new ApiError(400, "TEAM_GAUGE_UNAVAILABLE");
        Integer team = room.member(client.playerId).team;
        if (team == null) throw new ApiError(400, "TEAM_REQUIRED");
        int sequence = integer(input, "sequence", 1, Integer.MAX_VALUE);
        int previous = room.race.teamChargeSequences.getOrDefault(client.playerId, 0);
        if (sequence != previous + 1) throw new ApiError(409, "INVALID_SEQUENCE");
        JsonNode amount = input.get("charge");
        if (amount == null || !amount.isNumber() ||
            !Double.isFinite(amount.doubleValue()) || amount.doubleValue() <= 0 ||
            amount.doubleValue() > 100_000)
            throw new ApiError(400, "INVALID_CHARGE");
        double current = room.race.teamGaugeTargets.getOrDefault(team, 0.0);
        double target = Math.min(1.0, current + amount.doubleValue() / 8_000.0);
        room.race.teamChargeSequences.put(client.playerId, sequence);
        room.race.teamGaugeTargets.put(team, target >= 1 ? 0.0 : target);
        int gaugeSequence = room.race.teamGaugeSequences.merge(team, 1, Integer::sum);
        Map<String, Object> event = Map.of("type", "team-gauge",
            "roomId", room.id, "raceId", room.race.id,
            "team", team, "sequence", gaugeSequence, "target", target);
        broadcastPeerEvent(room, client, event);
        return event;
    }

    private Map<String, Object> awardMotion(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!List.of("racing", "finished").contains(room.phase))
            throw new ApiError(400, "RACE_NOT_RUNNING");
        int motion = integer(input, "motion", 3, 12);
        if (!List.of(3, 4, 5, 12).contains(motion))
            throw new ApiError(400, "INVALID_MOTION");
        Map<String, Object> event = Map.of("type", "award-motion",
            "roomId", room.id, "raceId", room.race.id,
            "playerId", client.playerId, "motion", motion);
        broadcastPeerEvent(room, client, event);
        return event;
    }

    private void broadcastPeerEvent(Room room, Client sender, Map<String, Object> event) {
        for (Room.Member member : room.members) {
            Client receiver = clients.get(member.playerId);
            if (receiver != null && receiver != sender) receiver.emit(event);
        }
    }

    private synchronized void finalizeRace(String roomId, String raceId) {
        Room room = rooms.get(roomId);
        if (room == null || room.race == null || !room.race.id.equals(raceId) ||
            !room.phase.equals("racing")) return;
        Room.Race race = room.race;
        race.finishDeadline = now();
        race.raceOverAt = race.finishDeadline + 6_000;
        Map<String, Integer> times = new HashMap<>();
        for (Map<String, Object> finish : race.finishes)
            times.put((String) finish.get("playerId"), (Integer) finish.get("elapsedMs"));
        List<String> order = new ArrayList<>(race.loadedIds);
        order.sort(Comparator.comparingInt(id -> times.getOrDefault(id, Integer.MAX_VALUE)));
        race.results = new ArrayList<>();
        int[] points = {10, 8, 6, 4, 2, 1, 0, 0};
        for (int index = 0; index < order.size(); index++) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("playerId", order.get(index));
            row.put("rank", index + 1);
            row.put("elapsedMs", times.get(order.get(index)));
            row.put("points", times.containsKey(order.get(index)) ? points[index] : 0);
            race.results.add(row);
        }
        if (room.mode.equals("team")) {
            Map<Integer, Integer> scores = new HashMap<>();
            scores.put(1, 0);
            scores.put(2, 0);
            for (Map<String, Object> result : race.results) {
                Room.Member member = room.member((String) result.get("playerId"));
                if (member != null && member.team != null)
                    scores.put(member.team, Math.min(39,
                        scores.get(member.team) + (Integer) result.get("points")));
            }
            race.teamScores = scores;
            race.winningTeam = scores.get(2) > scores.get(1) ? 2 : 1;
        }
        room.phase = "finished";
        room.revision++;
        saveResults(room);
        broadcastRoom(room, null);
    }

    private Map<String, Object> returnRoom(Client client, JsonNode input) {
        Room room = raceRoom(client, input);
        if (!room.phase.equals("finished")) throw new ApiError(400, "RACE_NOT_FINISHED");
        if (!room.race.returnedIds.contains(client.playerId))
            room.race.returnedIds.add(client.playerId);
        closeRaceWhenReturned(room);
        room.revision++;
        broadcastRoom(room, client);
        return roomReply(room);
    }

    private static void closeRaceWhenReturned(Room room) {
        if (room.race == null || !room.phase.equals("finished") ||
            !room.members.stream().allMatch(member ->
                room.race.returnedIds.contains(member.playerId))) return;
        room.phase = "open";
        room.race = null;
        room.raceError = null;
        for (Room.Member member : room.members) member.ready = false;
    }

    private void saveResults(Room room) {
        Room.Race race = room.race;
        database.transaction(connection -> {
            try (PreparedStatement insert = connection.prepareStatement("""
                    INSERT OR IGNORE INTO race_outcomes
                    (race_id,room_id,gameplay,track_id,json,created_at)
                    VALUES(?,?,?,?,?,?)""")) {
                insert.setString(1, race.id);
                insert.setString(2, room.id);
                insert.setString(3, room.gameplay);
                insert.setString(4, race.trackId);
                insert.setString(5, json.writeValueAsString(Map.of(
                    "roomId", room.id, "mode", room.mode, "gameplay", room.gameplay,
                    "race", race.snapshot())));
                insert.setLong(6, System.currentTimeMillis());
                insert.executeUpdate();
            }
            try (PreparedStatement insert = connection.prepareStatement("""
                    INSERT OR IGNORE INTO race_results
                    (room_id,race_id,player_id,name,rank,elapsed_ms,points,created_at)
                    VALUES(?,?,?,?,?,?,?,?)""")) {
                for (Map<String, Object> result : race.results) {
                    String playerId = (String) result.get("playerId");
                    Room.Member member = room.member(playerId);
                    insert.setString(1, room.id);
                    insert.setString(2, race.id);
                    insert.setString(3, playerId);
                    insert.setString(4, member == null ? playerId : member.name);
                    insert.setInt(5, (Integer) result.get("rank"));
                    Integer elapsed = (Integer) result.get("elapsedMs");
                    if (elapsed == null) insert.setNull(6, java.sql.Types.INTEGER);
                    else insert.setInt(6, elapsed);
                    insert.setInt(7, (Integer) result.get("points"));
                    insert.setLong(8, System.currentTimeMillis());
                    insert.addBatch();
                }
                insert.executeBatch();
            }
            return null;
        });
    }

    private void resolveVote(Room room) {
        Room.KickVote vote = room.kickVote;
        if (vote == null) return;
        int majority = vote.eligibleIds.size() / 2 + 1;
        if (vote.yesIds.size() >= majority) {
            Client kicked = clients.get(vote.targetId);
            if (kicked != null) {
                kicked.roomId = null;
                kicked.emit(Map.of("type", "left", "roomId", room.id));
            }
            room.members.removeIf(member -> member.playerId.equals(vote.targetId));
            if (room.hostId.equals(vote.targetId) && !room.members.isEmpty())
                room.hostId = room.members.get(0).playerId;
            room.kickVote = null;
        } else if (vote.noIds.size() > vote.eligibleIds.size() - majority) {
            room.kickVote = null;
        }
    }

    private synchronized void voteTimeout(String roomId, String voteId) {
        Room room = rooms.get(roomId);
        if (room == null || room.kickVote == null || !room.kickVote.id.equals(voteId)) return;
        room.kickVote = null;
        room.revision++;
        broadcastRoom(room, null);
    }

    private void saveRules(Room room) {
        Map<String, Object> rules = new LinkedHashMap<>();
        rules.put("name", room.name);
        rules.put("channelName", room.channelName);
        rules.put("mode", room.mode);
        rules.put("capacity", room.capacity);
        rules.put("speed", room.speed);
        rules.put("gameplay", room.gameplay);
        rules.put("resourceVersion", room.resourceVersion);
        if (room.trackId != null) rules.put("trackId", room.trackId);
        if (room.randomTrackCode != null) rules.put("randomTrackCode", room.randomTrackCode);
        database.transaction(connection -> {
            try (PreparedStatement update = connection.prepareStatement("""
                    INSERT INTO room_rules(room_id,json,updated_at) VALUES(?,?,?)
                    ON CONFLICT(room_id) DO UPDATE SET
                      json=excluded.json, updated_at=excluded.updated_at""")) {
                update.setString(1, room.id);
                update.setString(2, json.writeValueAsString(rules));
                update.setLong(3, System.currentTimeMillis());
                update.executeUpdate();
            }
            return null;
        });
    }

    private Room raceRoom(Client client, JsonNode input) {
        Room room = memberRoom(client, input);
        if (room.race == null ||
            !room.race.id.equals(text(input, "raceId", 1, 64)))
            throw new ApiError(400, "RACE_NOT_FOUND");
        return room;
    }
    private Room memberRoom(Client client, JsonNode input) {
        String id = text(input, "roomId", 1, 64);
        Room room = requireRoom(id);
        if (!id.equals(client.roomId) || room.member(client.playerId) == null)
            throw new ApiError(403, "NOT_ROOM_MEMBER");
        return room;
    }
    private Room requireRoom(String id) {
        Room room = rooms.get(id);
        if (room == null) throw new ApiError(404, "ROOM_NOT_FOUND");
        return room;
    }
    private static void requireHost(Room room, Client client) {
        if (!room.hostId.equals(client.playerId)) throw new ApiError(403, "HOST_REQUIRED");
    }
    private static int preferredTeam(Room room) {
        long first = room.members.stream().filter(member -> Objects.equals(member.team, 1)).count();
        long second = room.members.stream().filter(member -> Objects.equals(member.team, 2)).count();
        return first <= second ? 1 : 2;
    }
    private static int availableSlot(Room room, Integer team) {
        int size = room.mode.equals("team") ? room.capacity / 2 : room.capacity;
        int first = team == null || team == 1 ? 0 : 4;
        for (int slot = first; slot < first + size; slot++) {
            int candidate = slot;
            if (!room.closedSlots.contains(candidate) &&
                room.members.stream().noneMatch(member -> member.slot == candidate)) return candidate;
        }
        return -1;
    }
    private void broadcastRoom(Room room, Client except) {
        Map<String, Object> event = roomReply(room);
        for (Room.Member member : room.members) {
            Client recipient = clients.get(member.playerId);
            if (recipient != null && recipient != except) recipient.emit(event);
        }
    }
    private static Map<String, Object> roomReply(Room room) {
        return Map.of("type", "room", "room", room.snapshot());
    }
    private static long now() {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - START_NANOS);
    }
    private static boolean validEquipment(JsonNode value) {
        if (value == null || !value.isObject() || !value.has("itemIds") ||
            !value.get("itemIds").isObject()) return false;
        int[] slots = {1,2,3,4,8,9,10,11,12,16,17,18,20,21,52,26,27,30,31,
            32,36,43,45,44,46,58,59,61,70,68,69,71,76,77,78};
        JsonNode ids = value.get("itemIds");
        if (ids.size() != slots.length) return false;
        for (int slot : slots) {
            JsonNode item = ids.get(String.valueOf(slot));
            if (item == null || !item.isIntegralNumber() || !item.canConvertToInt() ||
                item.intValue() < 0 || item.intValue() > 65535) return false;
        }
        if (ids.get("1").intValue() == 0) return false;
        for (String key : List.of("kartSerial", "exceedType", "valueAt3E")) {
            JsonNode number = value.get(key);
            int maximum = key.equals("valueAt3E") ? 255 : 65535;
            if (number == null || !number.isIntegralNumber() ||
                !number.canConvertToInt() || number.intValue() < 0 ||
                number.intValue() > maximum) return false;
        }
        if (ids.get("3").intValue() == 0) {
            JsonNode systemKart = value.get("systemKart");
            if (systemKart == null || !systemKart.isTextual() ||
                !systemKart.textValue().matches("[A-Za-z][A-Za-z0-9_]{0,63}"))
                return false;
            JsonNode variant = value.get("systemKartVariant");
            return variant == null || (variant.isTextual() &&
                variant.textValue().matches("[A-Za-z][A-Za-z0-9_]{0,63}"));
        }
        return !value.has("systemKart") && !value.has("systemKartVariant");
    }
    private static String uuidAt(byte[] frame, int start) {
        StringBuilder hex = new StringBuilder(32);
        for (int index = start; index < start + 16; index++)
            hex.append(String.format("%02x", frame[index] & 0xff));
        String value = hex.toString();
        return value.substring(0, 8) + "-" + value.substring(8, 12) + "-" +
            value.substring(12, 16) + "-" + value.substring(16, 20) + "-" + value.substring(20);
    }
    private static String text(JsonNode input, String key, int min, int max) {
        JsonNode value = input.get(key);
        if (value == null || !value.isTextual()) throw new ApiError(400, "INVALID_" + key.toUpperCase());
        String string = value.textValue();
        if (string.codePointCount(0, string.length()) < min ||
            string.codePointCount(0, string.length()) > max ||
            string.codePoints().anyMatch(Character::isISOControl))
            throw new ApiError(400, "INVALID_" + key.toUpperCase());
        return string;
    }
    private static String optionalText(JsonNode input, String key, int max) {
        return !input.hasNonNull(key) ? null : text(input, key, 0, max);
    }
    private static int integer(JsonNode input, String key, int min, int max) {
        JsonNode value = input.get(key);
        if (value == null || !value.isIntegralNumber() || !value.canConvertToInt() ||
            value.intValue() < min || value.intValue() > max)
            throw new ApiError(400, "INVALID_" + key.toUpperCase());
        return value.intValue();
    }
    private static boolean booleanField(JsonNode input, String key) {
        JsonNode value = input.get(key);
        if (value == null || !value.isBoolean()) throw new ApiError(400, "INVALID_" + key.toUpperCase());
        return value.booleanValue();
    }
}

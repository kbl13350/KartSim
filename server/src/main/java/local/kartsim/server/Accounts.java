package local.kartsim.server;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Local accounts and invitations. Passwords and session tokens are never stored raw. */
@Service
public class Accounts {
    private static final Logger LOG = LoggerFactory.getLogger(Accounts.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_]{3,24}");
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");
    private final Database database;

    public record Account(String id, String username, String nickname, boolean admin) {
        public Map<String, Object> publicView() {
            return Map.of("nickname", nickname, "admin", admin, "username", username);
        }
    }
    public record Login(Account account, String token) {}

    public Accounts(Database database) {
        this.database = database;
        database.transaction(connection -> {
            if (count(connection, "SELECT COUNT(*) FROM invites") == 0 &&
                count(connection, "SELECT COUNT(*) FROM accounts") == 0) {
                String code = System.getenv("KART_BOOTSTRAP_INVITE");
                if (code == null || code.isBlank()) code = randomCode(18);
                insertInvite(connection, code);
                LOG.info("First local account invitation: {}", code);
            }
            return null;
        });
    }

    public boolean guestNameAvailable(String name) {
        if (!validName(name, 18)) throw new ApiError(400, "INVALID_GUEST_NAME");
        return database.transaction(connection -> {
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT 1 FROM accounts WHERE nickname = ? COLLATE NOCASE")) {
                query.setString(1, name);
                try (ResultSet rows = query.executeQuery()) { return !rows.next(); }
            }
        });
    }

    public Account register(String username, String nickname, String password, String invite) {
        if (username == null || !USERNAME.matcher(username).matches() ||
            !validName(nickname, 16) || password == null || password.length() < 12 ||
            password.length() > 128) throw new ApiError(400, "INVALID_ACCOUNT_FIELDS");
        if (invite == null || invite.length() > 128) throw new ApiError(400, "INVALID_INVITE");
        return database.transaction(connection -> {
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT 1 FROM invites WHERE code_hash=? AND used_by IS NULL")) {
                query.setString(1, sha256(invite));
                try (ResultSet rows = query.executeQuery()) {
                    if (!rows.next()) throw new ApiError(400, "INVALID_INVITE");
                }
            }
            if (exists(connection, "SELECT 1 FROM accounts WHERE username=? COLLATE NOCASE", username))
                throw new ApiError(409, "USERNAME_TAKEN");
            if (exists(connection, "SELECT 1 FROM accounts WHERE nickname=? COLLATE NOCASE", nickname))
                throw new ApiError(409, "NICKNAME_TAKEN");
            String id = UUID.randomUUID().toString();
            boolean admin = count(connection, "SELECT COUNT(*) FROM accounts") == 0;
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO accounts(id,username,nickname,password_hash,admin,created_at) VALUES(?,?,?,?,?,?)")) {
                insert.setString(1, id);
                insert.setString(2, username);
                insert.setString(3, nickname);
                insert.setString(4, passwordHash(password));
                insert.setInt(5, admin ? 1 : 0);
                insert.setLong(6, System.currentTimeMillis());
                insert.executeUpdate();
            }
            try (PreparedStatement use = connection.prepareStatement(
                    "UPDATE invites SET used_by=? WHERE code_hash=?")) {
                use.setString(1, id);
                use.setString(2, sha256(invite));
                use.executeUpdate();
            }
            return new Account(id, username, nickname, admin);
        });
    }

    public Login login(String username, String password) {
        if (username == null || password == null) throw new ApiError(401, "INVALID_CREDENTIALS");
        return database.transaction(connection -> {
            Account account;
            String stored;
            try (PreparedStatement query = connection.prepareStatement(
                    "SELECT id,username,nickname,admin,password_hash FROM accounts WHERE username=? COLLATE NOCASE")) {
                query.setString(1, username);
                try (ResultSet rows = query.executeQuery()) {
                    if (!rows.next()) throw new ApiError(401, "INVALID_CREDENTIALS");
                    account = account(rows);
                    stored = rows.getString("password_hash");
                }
            }
            if (!verifyPassword(password, stored)) throw new ApiError(401, "INVALID_CREDENTIALS");
            String token = randomCode(32);
            try (PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)")) {
                insert.setString(1, sha256(token));
                insert.setString(2, account.id());
                insert.setLong(3, Instant.now().plus(30, ChronoUnit.DAYS).toEpochMilli());
                insert.executeUpdate();
            }
            return new Login(account, token);
        });
    }

    public Account require(String token) {
        Account account = find(token);
        if (account == null) throw new ApiError(401, "LOGIN_REQUIRED");
        return account;
    }

    public Account find(String token) {
        if (token == null || !TOKEN.matcher(token).matches()) return null;
        return database.transaction(connection -> {
            try (PreparedStatement query = connection.prepareStatement("""
                    SELECT a.id,a.username,a.nickname,a.admin FROM sessions s
                    JOIN accounts a ON a.id=s.account_id
                    WHERE s.token_hash=? AND s.expires_at>?""")) {
                query.setString(1, sha256(token));
                query.setLong(2, System.currentTimeMillis());
                try (ResultSet rows = query.executeQuery()) {
                    return rows.next() ? account(rows) : null;
                }
            }
        });
    }

    public Account rename(String token, String nickname) {
        if (!validName(nickname, 16)) throw new ApiError(400, "INVALID_ACCOUNT_FIELDS");
        Account account = require(token);
        return database.transaction(connection -> {
            if (exists(connection, "SELECT 1 FROM accounts WHERE nickname=? COLLATE NOCASE AND id<>?",
                    nickname, account.id())) throw new ApiError(409, "NICKNAME_TAKEN");
            try (PreparedStatement update = connection.prepareStatement(
                    "UPDATE accounts SET nickname=? WHERE id=?")) {
                update.setString(1, nickname);
                update.setString(2, account.id());
                update.executeUpdate();
            }
            return new Account(account.id(), account.username(), nickname, account.admin());
        });
    }

    public void logout(String token) {
        if (token == null) return;
        database.transaction(connection -> {
            try (PreparedStatement delete = connection.prepareStatement(
                    "DELETE FROM sessions WHERE token_hash=?")) {
                delete.setString(1, sha256(token));
                delete.executeUpdate();
            }
            return null;
        });
    }

    public String createInvite(String token) {
        Account account = require(token);
        if (!account.admin()) throw new ApiError(403, "ADMIN_REQUIRED");
        String code = randomCode(18);
        database.transaction(connection -> { insertInvite(connection, code); return null; });
        return code;
    }

    private static Account account(ResultSet rows) throws Exception {
        return new Account(rows.getString("id"), rows.getString("username"),
            rows.getString("nickname"), rows.getInt("admin") == 1);
    }
    private static void insertInvite(Connection connection, String code) throws Exception {
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT INTO invites(code_hash,created_at) VALUES(?,?)")) {
            insert.setString(1, sha256(code));
            insert.setLong(2, System.currentTimeMillis());
            insert.executeUpdate();
        }
    }
    private static boolean exists(Connection connection, String sql, String... values) throws Exception {
        try (PreparedStatement query = connection.prepareStatement(sql)) {
            for (int index = 0; index < values.length; index++) query.setString(index + 1, values[index]);
            try (ResultSet rows = query.executeQuery()) { return rows.next(); }
        }
    }
    private static int count(Connection connection, String sql) throws Exception {
        try (PreparedStatement query = connection.prepareStatement(sql);
             ResultSet rows = query.executeQuery()) {
            rows.next();
            return rows.getInt(1);
        }
    }
    private static boolean validName(String name, int maximum) {
        return name != null && !name.isBlank() && name.equals(name.trim()) &&
            name.codePointCount(0, name.length()) <= maximum &&
            name.codePoints().noneMatch(cp -> Character.isISOControl(cp) || cp == '<' || cp == '>');
    }
    private static String randomCode(int bytes) {
        byte[] value = new byte[bytes];
        RANDOM.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }
    private static String sha256(String input) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                .digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } catch (Exception error) { throw new IllegalStateException(error); }
    }
    private static String passwordHash(String password) {
        try {
            byte[] salt = new byte[16]; RANDOM.nextBytes(salt);
            byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(new PBEKeySpec(password.toCharArray(), salt, 120_000, 256)).getEncoded();
            return "120000:" + Base64.getEncoder().encodeToString(salt) + ":" +
                Base64.getEncoder().encodeToString(hash);
        } catch (Exception error) { throw new IllegalStateException(error); }
    }
    private static boolean verifyPassword(String password, String saved) {
        try {
            String[] parts = saved.split(":");
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] expected = Base64.getDecoder().decode(parts[2]);
            byte[] actual = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(new PBEKeySpec(password.toCharArray(), salt,
                    Integer.parseInt(parts[0]), expected.length * 8)).getEncoded();
            return MessageDigest.isEqual(actual, expected);
        } catch (Exception error) { return false; }
    }
}

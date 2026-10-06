package local.kartsim.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermissions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class DatabasePermissionsTest {
    @TempDir Path temporary;

    @Test
    void tightensExistingDirectoryAndDatabaseFiles() throws Exception {
        assumeTrue(Files.getFileStore(temporary)
            .supportsFileAttributeView(PosixFileAttributeView.class));
        Path directory = temporary.resolve("data");
        Files.createDirectory(directory);
        Files.setPosixFilePermissions(directory,
            PosixFilePermissions.fromString("rwxr-xr-x"));
        Path databaseFile = directory.resolve("kart.db");
        Files.createFile(databaseFile);
        Files.setPosixFilePermissions(databaseFile,
            PosixFilePermissions.fromString("rw-r--r--"));

        Database database = new Database(directory.toString());
        database.transaction(connection -> {
            try (var insert = connection.prepareStatement(
                    "INSERT INTO profiles(owner_id,json,updated_at) VALUES(?,?,?)")) {
                insert.setString(1, "test");
                insert.setString(2, "{}");
                insert.setLong(3, 1L);
                insert.executeUpdate();
            }
            return null;
        });
        assertEquals(PosixFilePermissions.fromString("rwx------"),
            Files.getPosixFilePermissions(directory));
        assertEquals(PosixFilePermissions.fromString("rw-------"),
            Files.getPosixFilePermissions(databaseFile));
        for (String suffix : new String[] {"-wal", "-shm"}) {
            Path file = directory.resolve("kart.db" + suffix);
            if (Files.exists(file)) {
                assertEquals(PosixFilePermissions.fromString("rw-------"),
                    Files.getPosixFilePermissions(file));
            }
        }
    }
}

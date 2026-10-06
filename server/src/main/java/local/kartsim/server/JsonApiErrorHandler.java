package local.kartsim.server;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class JsonApiErrorHandler {
    @ExceptionHandler(ApiError.class)
    public ResponseEntity<Map<String, String>> rejected(ApiError error) {
        return ResponseEntity.status(error.status()).body(Map.of("error", error.getMessage()));
    }
}

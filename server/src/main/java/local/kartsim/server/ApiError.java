package local.kartsim.server;

/** Stable code returned to the browser for a rejected request. */
public class ApiError extends RuntimeException {
    private final int status;

    public ApiError(int status, String code) {
        super(code);
        this.status = status;
    }

    public int status() { return status; }
}

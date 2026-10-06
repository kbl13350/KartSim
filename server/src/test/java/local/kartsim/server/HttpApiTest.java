package local.kartsim.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class HttpApiTest {
    @Test
    void configMatchesTheLoopbackHostTheBrowserUsed() {
        HttpApi api = new HttpApi(null, null);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setLocalPort(8787);
        request.setServerName("localhost");
        assertEquals("http://localhost:8787", api.config(request).get("backendOrigin"));
        request.setServerName("127.0.0.1");
        assertEquals("http://127.0.0.1:8787", api.config(request).get("backendOrigin"));
        request.setServerName("example.com");
        assertEquals("INVALID_HOST", assertThrows(ApiError.class,
            () -> api.config(request)).getMessage());
    }
}

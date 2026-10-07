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

    @Test
    void configAcceptsOnlyTheConfiguredLanHosts() {
        HttpApi api = new HttpApi(null, null, new LocalNetwork(" 192.168.1.8 , bad host "));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setLocalPort(8787);
        request.setServerName("192.168.1.8");
        assertEquals("http://192.168.1.8:8787", api.config(request).get("backendOrigin"));
        request.setServerName("192.168.1.9");
        assertEquals("INVALID_HOST", assertThrows(ApiError.class,
            () -> api.config(request)).getMessage());
    }

    @Test
    void wildcardLanHostsAnswerOnAnyAddress() {
        HttpApi api = new HttpApi(null, null, new LocalNetwork("*"));
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setLocalPort(8787);
        request.setServerName("10.0.0.23");
        assertEquals("http://10.0.0.23:8787", api.config(request).get("backendOrigin"));
    }

    @Test
    void proxiedPagesShareTheirOwnOrigin() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setLocalPort(8787);
        request.addHeader("X-Forwarded-Host", "192.168.1.8:8780");
        assertEquals(null, new HttpApi(null, null, new LocalNetwork("*"))
            .config(request).get("backendOrigin"));
        assertEquals("INVALID_HOST", assertThrows(ApiError.class,
            () -> new HttpApi(null, null).config(request)).getMessage());
    }
}

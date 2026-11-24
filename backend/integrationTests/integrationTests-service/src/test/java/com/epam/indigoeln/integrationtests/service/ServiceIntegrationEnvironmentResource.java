package com.epam.indigoeln.integrationtests.service;

import com.epam.indigoeln.test.ComposeRunner;
import com.epam.indigoeln.test.SharedTestEnvironment;
import org.junit.jupiter.api.extension.BeforeAllCallback;
import org.junit.jupiter.api.extension.ExtensionContext;

import java.io.File;
import java.util.Map;

public class ServiceIntegrationEnvironmentResource implements BeforeAllCallback {

    @Override
    public void beforeAll(ExtensionContext context) {
        SharedTestEnvironment.install(context, Impl::new);
    }

    static class Impl extends SharedTestEnvironment {

        final ComposeRunner composeRunner;

        Impl() {
            // The services under test are the images quarkusIntTest builds (assemble -> buildDocker);
            // postgres and the frontend stay on the compose file's published defaults.
            composeRunner = new ComposeRunner(new File("../../../deployment-compose/docker-compose.yml"), Map.of(
                    "ELN_SERVICE_IMAGE", "indigoeln/eln-service:built",
                    "REPORTS_SERVICE_IMAGE", "indigoeln/reports-service:built",
                    "SIGNATURE_SERVICE_IMAGE", "indigoeln/signature-service:built",
                    "SAMPLEREGISTRATION_SERVICE_IMAGE", "indigoeln/sampleregistration-service:built"
            ), "postgres", "frontend", "keycloak-healthcheck", "nginx", "eln-service", "reports-service", "signature-service", "sampleregistration-service");
        }

        @Override
        protected void start() {
            composeRunner.start();
        }

        @Override
        protected void stop() {
            composeRunner.stop();
        }
    }
}

import com.github.jk1.license.filter.LicenseBundleNormalizer
import com.github.jk1.license.render.TextReportRenderer

// Third-party notices for the distributed Docker images: license texts and NOTICE files of every
// runtime dependency, extracted into build/licenses, which Dockerfile.jvm copies to /licenses.

plugins {
    id("com.github.jk1.dependency-license-report")
}

val licensesDir = layout.buildDirectory.dir("licenses")

licenseReport {
    outputDir = licensesDir.get().asFile.absolutePath
    // Quarkus's own prod classpath, not runtimeClasspath: only it carries the conditional
    // dependencies Quarkus adds (e.g. quarkus-flyway-postgresql), which do land in quarkus-app/lib.
    configurations = arrayOf("quarkusProdRuntimeClasspathConfiguration")
    excludeOwnGroup = true
    filters = arrayOf(LicenseBundleNormalizer())
    renderers = arrayOf(TextReportRenderer("THIRD-PARTY-NOTICES.txt"))
}

val readme = """
    Third-party software in this image
    ==================================

    THIRD-PARTY-NOTICES.txt lists every bundled library with its license. License and NOTICE files
    shipped inside the libraries are reproduced in the subdirectories next to it.

    Base image: registry.access.redhat.com/ubi9/openjdk-25, used unmodified. Its packages carry
    their own licenses under /usr/share/licenses. Source code is available from Red Hat as UBI
    source containers (https://catalog.redhat.com/software/base-images).

    LGPL-licensed libraries listed in THIRD-PARTY-NOTICES.txt (such as JasperReports and OpenPDF)
    are included as unmodified, separate jar files in /deployments/lib and may be replaced with
    modified versions. Their source code is available from the project URLs listed there, e.g.
    https://github.com/Jaspersoft/jasperreports and https://github.com/LibrePDF/OpenPDF.
    The OpenPDF jar carries its MPL-2.0 and LGPL-2.1 texts in META-INF. Where LGPL-3.0 code is
    present, the GNU GPL v3 text it refers to is in GPL-3.0.txt.

    Libraries offered under a choice of licenses (e.g. Jakarta APIs: EPL-2.0 OR GPL-2.0 with
    Classpath Exception) are used under the EPL-2.0, Apache-2.0 or BSD option.
""".trimIndent() + "\n"

tasks.named("generateLicenseReport") {
    // jk1's ReportTask keeps a reference to the Project.
    notCompatibleWithConfigurationCache("jk1 ReportTask holds a Project reference")
    val readmeText = readme
    val readmeFile = licensesDir.map { it.file("README.txt").asFile }
    inputs.property("readme", readmeText)
    outputs.file(readmeFile)
    doLast {
        readmeFile.get().writeText(readmeText)
    }
}

// quarkusBuild, not assemble: deployment-compose/deploy.sh runs quarkusBuild alone before `docker build`.
plugins.withId("io.quarkus") {
    tasks.named("quarkusBuild") {
        dependsOn("generateLicenseReport")
    }
}

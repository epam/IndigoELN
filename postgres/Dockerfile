FROM public.ecr.aws/docker/library/bash:latest AS builder

RUN mkdir /build
WORKDIR /build
RUN wget https://lifescience.opensource.epam.com/downloads/bingo-1.46.0/bingo-postgres-17-linux-x86_64.zip -O bingo.zip

RUN unzip bingo.zip && tar xzf bingo-postgres*.tgz
RUN mv */ bingo-postgres
WORKDIR /build/bingo-postgres

RUN chmod +x ./bingo-pg-install.sh
RUN ./bingo-pg-install.sh -libdir /usr/local/lib/postgresql -y

FROM public.ecr.aws/docker/library/postgres:17.9 AS base

COPY --from=builder /build/bingo-postgres/lib/libbingo-postgres.so /usr/local/lib/postgresql/
COPY --from=builder /build/bingo-postgres/bingo_install.sql /docker-entrypoint-initdb.d/00_bingo_install.sql
COPY init.sql /docker-entrypoint-initdb.d/10_create_extensions.sql

# Third-party notice for the bingo extension, which ships no license file of its own.
RUN mkdir -p /licenses/bingo && \
    cp /usr/share/common-licenses/Apache-2.0 /licenses/bingo/LICENSE && \
    printf '%s\n' \
      'Third-party software in this image' \
      '' \
      'Bingo PostgreSQL cartridge 1.46.0 (/usr/local/lib/postgresql/libbingo-postgres.so)' \
      'Copyright EPAM Systems. Licensed under the Apache License 2.0, see bingo/LICENSE.' \
      'Source: https://github.com/epam/Indigo' \
      '' \
      'Base image: postgres:17.9 (Debian), used unmodified. Its packages carry their own' \
      'licenses under /usr/share/doc/*/copyright; source code is available from' \
      'https://sources.debian.org and https://github.com/docker-library/postgres.' \
      > /licenses/README.txt

RUN echo "shared_preload_libraries = 'pg_stat_statements'" >> /usr/share/postgresql/postgresql.conf.sample && \
    echo "pg_stat_statements.track = all" >> /usr/share/postgresql/postgresql.conf.sample && \
    echo "pg_stat_statements.max = 10000" >> /usr/share/postgresql/postgresql.conf.sample

# All of the app's databases in one instance, for the compose stack and the integration tests.
# Runs after 00_bingo_install.sql, so `TEMPLATE postgres` carries the bingo schema into each new
# database. The default target: `docker build` gives this, `--target base` gives the image above.
FROM base AS combined

COPY --chmod=755 init-combined.sh /docker-entrypoint-initdb.d/50_create_databases.sh

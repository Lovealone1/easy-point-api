# Backup sidecar: pg_dump | gzip | openssl-encrypt → upload to S3-compatible storage.
# Based on the postgres image so pg_dump always matches the server's major version.
FROM postgres:17-alpine

RUN apk add --no-cache aws-cli openssl bash coreutils tzdata

WORKDIR /backup
COPY backup.sh entrypoint.sh ./
RUN chmod +x backup.sh entrypoint.sh

ENTRYPOINT ["/backup/entrypoint.sh"]

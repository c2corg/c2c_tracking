#!/bin/sh
# Prepares the Garage of docker-compose.s3.yml for the S3 tests: layout, access key
# (the one of env-vars.s3.mjs) and the `tracking` bucket.
set -eu

garage() { docker compose -f docker-compose.s3.yml exec -T garage /garage "$@"; }

# the node needs a few seconds before answering
for _ in $(seq 1 30); do
  garage status >/dev/null 2>&1 && break
  sleep 1
done

node_id=$(garage node id -q | cut -d@ -f1)
garage layout assign -z dc1 -c 1G "$node_id"
garage layout apply --version 1
garage key import --yes -n tracking GK000000000000000000000001 0000000000000000000000000000000000000000000000000000000000000002
garage bucket create tracking
garage bucket allow --read --write --owner tracking --key tracking

import { BlockList, isIP } from 'node:net';

// Addresses a URL received from a vendor must not point to: the service would otherwise fetch internal resources
const internal = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const) {
  internal.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
] as const) {
  internal.addSubnet(network, prefix, 'ipv6');
}

/** Checks that a URL received from a vendor (e.g. a file to download) is an http(s) URL of a public host. */
export const isExternalUrl = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false;
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    return false;
  }
  const version = isIP(host);
  return version === 0 || !internal.check(host, version === 4 ? 'ipv4' : 'ipv6');
};

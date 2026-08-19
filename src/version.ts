/**
 * Single source of truth for the server version.
 *
 * package.json's "version" field is kept in sync with this constant manually (there's no
 * build step that generates one from the other) — bump both together on release.
 */
export const VERSION = "0.2.0";

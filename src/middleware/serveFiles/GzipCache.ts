import {BunFile} from "bun";

export class GzipCache {
  async setup() {}
  async fetch(file: BunFile) {
    // keep typescript happy, but this method should be overridden
    return new Response(null);
  }
}
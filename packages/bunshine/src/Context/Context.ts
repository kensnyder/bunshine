import { Context } from 'request-class-router';
import file, { type FileResponseOptions } from '../file/file';
import { FileLike } from '../file/file-io';

export default Context;

/** Get the IP address info of the client */
Object.defineProperty(Context.prototype, 'ip', {
  get(): { address: string; family: string; port: number } | null {
    return this.server.requestIP(this.request);
  },
});

/** A shorthand for `new Response(bunFile, fileHeaders)` plus range features */
Object.defineProperty(Context.prototype, 'file', {
  value: async function (
    this: Context,
    pathOrData: FileLike,
    fileOptions: FileResponseOptions = {}
  ) {
    return file.call(this, pathOrData, {
      range: this.request.headers.get('Range') || undefined,
      ...fileOptions,
    });
  },
});

import type Context from '../Context/Context';

export type LoggerOptions = {
  writer?: (msg: string) => void;
  exceptWhen?: (
    context: Context,
    response: Response | null
  ) => boolean | Promise<boolean>;
};

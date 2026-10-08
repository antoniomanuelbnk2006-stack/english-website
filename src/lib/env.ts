import 'server-only';
import { ServerEnv, parseEnv } from './env.schema';

/** Variables de entorno del servidor, validadas al cargar el módulo. Nunca llegan al cliente. */
export const env = parseEnv(ServerEnv, process.env);

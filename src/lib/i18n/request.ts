// El idioma elegido en la dirección (`?lang=fr`) viaja del proxy al renderizado en esta cabecera
// de la petición (ADR-0032). Vale solo para esa página: sin cookies de preferencias aceptadas no
// se guarda en ningún sitio.
export const LOCALE_REQUEST_HEADER = 'x-senal-locale';

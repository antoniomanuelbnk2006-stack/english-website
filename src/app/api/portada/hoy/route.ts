import { NextResponse } from 'next/server';
import { buildTodayPreview } from '@/features/today/lib/preview';
import { getToday } from '@/features/today/server/today';
import { requireUser } from '@/lib/auth';

// La copia de «Hoy» que la portada enseña dentro del portátil a quien tiene la sesión abierta
// (design-system/senal/pages/portada.md, «Hero»). Sus datos son de quien la pide: no se guarda
// en ninguna caché.
const PRIVATE = { 'Cache-Control': 'private, no-store' };

// Sin sesión, o sin nivel elegido (la app manda antes a /nivel), la portada sigue con «Crea tu
// plan». Sin sesión ya responde así el proxy; esto es la segunda barrera.
export async function GET() {
  const session = await requireUser();
  if (!session.ok) return new NextResponse(null, { status: 204, headers: PRIVATE });
  const today = await getToday();
  if (!today.level) return new NextResponse(null, { status: 204, headers: PRIVATE });
  return NextResponse.json(buildTodayPreview({ ...today, level: today.level }), {
    headers: PRIVATE,
  });
}

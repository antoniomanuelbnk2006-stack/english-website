'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { deleteInput } from '@/features/journal/server/actions';

export function DeleteEntry({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteInput({ id });
          if (result.ok) router.refresh();
        })
      }
    >
      <Trash2 aria-hidden="true" strokeWidth={1.75} />
    </Button>
  );
}

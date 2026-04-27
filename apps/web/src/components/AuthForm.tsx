'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

const SAFE_NEXT = new Set(['/webtrading', '/webtrading/health', '/webtrading/history']);

const Schema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
type Input = z.infer<typeof Schema>;

type Props = {
  mode: 'signup' | 'signin';
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get('next');
  const next = nextParam && SAFE_NEXT.has(nextParam) ? nextParam : '/webtrading';
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({
    resolver: zodResolver(Schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        });
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: { message?: string };
        };
        if (!res.ok) {
          toast.error(body.message ?? body.error?.message ?? 'Signup failed');
          return;
        }
        toast.success('Account created — signing you in');
      }
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(body.message ?? body.error?.message ?? 'Signin failed');
        return;
      }
      router.push(next);
    } catch {
      toast.error('Network error');
    }
  });

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="block">
        <span className="text-sm text-[color:var(--color-fg-dim)]">Email</span>
        <input
          {...register('email')}
          autoComplete="email"
          className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-[color:var(--color-down)]">{errors.email.message}</p>
        )}
      </label>
      <label className="block">
        <span className="text-sm text-[color:var(--color-fg-dim)]">Password</span>
        <input
          type="password"
          {...register('password')}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="mt-1 block w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-[color:var(--color-down)]">{errors.password.message}</p>
        )}
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Working...' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>
    </form>
  );
}

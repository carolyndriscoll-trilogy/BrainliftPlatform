import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import type { BrainliftData } from '@shared/schema';
import { useBrainlift } from '@/hooks/useBrainlift';
import { BuilderShell } from '@/components/builder/BuilderShell';

interface BuilderPageProps {
  slug: string;
}

type BuilderResponse = BrainliftData & {
  userPermission?: 'owner' | 'editor' | 'viewer' | null;
};

export default function BuilderPage({ slug }: BuilderPageProps) {
  const [, setLocation] = useLocation();
  const [editingAuthor, setEditingAuthor] = useState(false);
  const [authorInput, setAuthorInput] = useState('');

  const {
    data,
    isLoading,
    error,
    updateAuthor,
  } = useBrainlift(slug, false);

  const { data: session } = authClient.useSession();
  const isAdmin = session?.user?.role === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 text-center">
        <h1>Brainlift not found</h1>
        <p>No brainlift exists at this URL.</p>
        <Link href="/">← Back to home</Link>
      </div>
    );
  }

  const builderData = data as BuilderResponse;
  const userPermission = builderData.userPermission ?? null;
  const canModify = userPermission === 'owner' || userPermission === 'editor' || isAdmin;

  if (builderData.sourceType !== 'builder') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold">This BrainLift does not use the native builder</h1>
          <p className="mt-3 text-muted-foreground">
            Open it in the standard BrainLift workspace instead.
          </p>
          <button
            onClick={() => setLocation(`/grading/${slug}`)}
            className="mt-6 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium"
          >
            Open BrainLift
          </button>
        </div>
      </div>
    );
  }

  if (!canModify) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold">You do not have edit access to this builder</h1>
          <p className="mt-3 text-muted-foreground">
            You can still view the BrainLift in the standard workspace.
          </p>
          <button
            onClick={() => setLocation(`/grading/${slug}`)}
            className="mt-6 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium"
          >
            Open BrainLift
          </button>
        </div>
      </div>
    );
  }

  const handleUpdateAuthor = (author: string) => {
    updateAuthor(author).then(() => setEditingAuthor(false));
  };

  return (
    <BuilderShell
      data={builderData}
      slug={slug}
      onPreview={() => setLocation(`/grading/${slug}`)}
      editingAuthor={editingAuthor}
      setEditingAuthor={setEditingAuthor}
      authorInput={authorInput}
      setAuthorInput={setAuthorInput}
      onUpdateAuthor={handleUpdateAuthor}
    />
  );
}

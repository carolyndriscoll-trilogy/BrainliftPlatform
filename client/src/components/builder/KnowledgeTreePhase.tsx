import { Plus, FolderTree } from 'lucide-react';
import type { BrainliftData } from '@shared/schema';
import { useKnowledgeTree } from '@/hooks/useKnowledgeTree';
import { CategoryCard } from './CategoryCard';
import { TactileButton } from '@/components/ui/tactile-button';

interface KnowledgeTreePhaseProps {
  data: BrainliftData;
  slug: string;
}

export function KnowledgeTreePhase({ data, slug }: KnowledgeTreePhaseProps) {
  const {
    createCategory, isCreatingCategory,
    updateCategory, deleteCategory,
    createSource, updateSource, deleteSource,
    createFact, updateFact, deleteFact,
    createSummary, updateSummary, deleteSummary,
  } = useKnowledgeTree(slug);

  const categories = data.knowledgeTree?.categories || [];

  const handleAddCategory = async () => {
    await createCategory({ name: 'New Category' });
  };

  const handleUpdateCategory = async (id: number, fields: { name: string }) => {
    await updateCategory({ id, ...fields });
  };

  const handleDeleteCategory = async (id: number) => {
    await deleteCategory(id);
  };

  const handleCreateSource = async (data: { categoryId: number; title: string; url?: string }) => {
    await createSource(data);
  };

  const handleUpdateSource = async (id: number, fields: { title?: string; url?: string }) => {
    await updateSource({ id, ...fields });
  };

  const handleDeleteSource = async (id: number) => {
    await deleteSource(id);
  };

  const handleCreateFact = async (data: { sourceId: number; text: string }) => {
    await createFact(data);
  };

  const handleUpdateFact = async (id: number, fields: { text: string }) => {
    await updateFact({ id, ...fields });
  };

  const handleDeleteFact = async (id: number) => {
    await deleteFact(id);
  };

  const handleCreateSummary = async (data: { sourceId: number; text: string }) => {
    await createSummary(data);
  };

  const handleUpdateSummary = async (id: number, fields: { text: string }) => {
    await updateSummary({ id, ...fields });
  };

  const handleDeleteSummary = async (id: number) => {
    await deleteSummary(id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground m-0">Knowledge Tree</h2>
          <p className="text-muted-foreground text-sm mt-1 m-0">
            Organize your research into categories, sources, facts, and your own take on each source.
          </p>
        </div>
        <TactileButton
          variant="raised"
          onClick={handleAddCategory}
          disabled={isCreatingCategory}
          className="flex items-center gap-1.5"
        >
          <Plus size={14} />
          Add Category
        </TactileButton>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-lg border border-dashed border-border">
          <FolderTree size={32} className="text-muted-foreground/30 mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">Your research starts here</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-4">
            Add sources from the Learning Stream or paste a URL. Organize them into categories, extract key facts, and write your own take.
          </p>
          <TactileButton
            variant="raised"
            onClick={handleAddCategory}
            disabled={isCreatingCategory}
            className="flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Your First Category
          </TactileButton>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onCreateSource={handleCreateSource}
              onUpdateSource={handleUpdateSource}
              onDeleteSource={handleDeleteSource}
              onCreateFact={handleCreateFact}
              onUpdateFact={handleUpdateFact}
              onDeleteFact={handleDeleteFact}
              onCreateSummary={handleCreateSummary}
              onUpdateSummary={handleUpdateSummary}
              onDeleteSummary={handleDeleteSummary}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ActivityFeed, type ActivityFeedProps, type ActivityPost } from "./ActivityFeed";
import { ACTIVITY_POSTS } from "../../test-data/activityFeedData";

/**
 * Le fil d'un réseau social interne : publications, images, j'aime, commentaires repliables et
 * partage. Le composant ne retient pas les réactions : les stories tiennent l'état, comme le ferait
 * l'application.
 */
const meta: Meta<typeof ActivityFeed> = {
  title: "Widgets/ActivityFeed",
  component: ActivityFeed,
};
export default meta;
type Story = StoryObj<typeof ActivityFeed>;

const ME = { name: "Michaël Thomas" };

/** Un fil vivant : « J'aime » bascule, « Partager » compte, un commentaire envoyé s'ajoute. */
function LiveFeed(props: Omit<ActivityFeedProps, "posts"> & { posts?: ActivityPost[] }) {
  const [posts, setPosts] = useState<ActivityPost[]>(props.posts ?? ACTIVITY_POSTS);
  const update = (id: string, f: (p: ActivityPost) => ActivityPost) => setPosts((all) => all.map((p) => (p.id === id ? f(p) : p)));
  return (
    <ActivityFeed
      {...props}
      posts={posts}
      currentUser={ME}
      onLike={(id, liked) => update(id, (p) => ({ ...p, liked, likes: (p.likes ?? 0) + (liked ? 1 : -1) }))}
      onShare={(id) => update(id, (p) => ({ ...p, shares: (p.shares ?? 0) + 1 }))}
      onComment={(id, text) =>
        update(id, (p) => ({
          ...p,
          commentCount: (p.commentCount ?? p.comments?.length ?? 0) + 1,
          comments: [...(p.comments ?? []), { id: `new-${id}-${p.comments?.length ?? 0}`, author: ME, text, time: "à l'instant" }],
        }))
      }
    />
  );
}

/** En cartes : en-tête, texte, image à fond perdu, barre de réactions. */
export const Default: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <LiveFeed />
    </div>
  ),
};

/** Les commentaires de la première publication dépliés, avec la zone « Écrire un commentaire ». */
export const CommentsOpen: Story = {
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <LiveFeed defaultOpenComments={["p1"]} />
    </div>
  ),
};

/** Liste compacte : une ligne par publication, texte sur deux lignes au plus, image en vignette. */
export const List: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <LiveFeed variant="list" />
    </div>
  ),
};

/** Sans rappels : « J'aime » est désactivé, ni partage ni zone de saisie — un fil en lecture seule. */
export const ReadOnly: Story = {
  args: { posts: ACTIVITY_POSTS.slice(0, 3) },
  render: (args) => (
    <div style={{ maxWidth: 560 }}>
      <ActivityFeed {...args} />
    </div>
  ),
};

/** Sans publication, le message `emptyMessage`. */
export const Empty: Story = {
  args: { posts: [], emptyMessage: "Personne n'a encore rien publié." },
};

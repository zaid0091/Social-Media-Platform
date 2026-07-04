import PostDetailClient from './PostDetailClient';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/posts/${id}/`);
    if (res.ok) {
      const post = await res.json();
      return {
        title: `Post by @${post.author.username} | Social Platform`,
        description: post.content || 'View post on Social Platform.',
        openGraph: {
          title: `Post by @${post.author.username}`,
          description: post.content || 'View post on Social Platform.',
          images: post.media && post.media.length > 0 ? [{ url: post.media[0].media_url }] : [],
        }
      };
    }
  } catch (err) {}
  
  return {
    title: 'View Post | Social Platform',
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  return <PostDetailClient id={id} />;
}

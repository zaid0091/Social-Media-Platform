import PostDetailClient from './PostDetailClient';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/posts/${id}/`);
    if (res.ok) {
      const post = await res.json();
      const firstWords = post.content 
        ? post.content.split(' ').slice(0, 8).join(' ') + (post.content.split(' ').length > 8 ? '...' : '') 
        : `Post by @${post.author.username}`;
      const ogImage = post.media && post.media.length > 0 ? post.media[0].media_url : null;
      return {
        title: `${firstWords} | Social Platform`,
        description: post.content || 'View post on Social Platform.',
        openGraph: {
          title: firstWords,
          description: post.content || 'View post on Social Platform.',
          images: ogImage ? [{ url: ogImage }] : [],
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
